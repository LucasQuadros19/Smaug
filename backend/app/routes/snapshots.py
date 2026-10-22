import uuid
from datetime import date as date_cls
from decimal import Decimal

from flask import Blueprint, jsonify, request
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.models.account import Account
from app.models.playlist import Playlist
from app.models.snapshot import Snapshot, SnapshotEntry
from app.models.transaction import Transaction
from app.services.auto_value_service import auto_value_map
from app.services.balance_service import get_balances_by_account, get_playlist_totals
from app.utils.pagination import paginate
from app.utils.parse import find, iso_date, money, text

snapshots_bp = Blueprint("snapshots", __name__)

# Valor na moeda da posição: 8 casas para caber fração de bitcoin.
NATIVE_PLACES = Decimal("0.00000001")

FORCED_EDIT = "Editado à força (planilha)"
BALANCE_FIX = "Ajuste de saldo (planilha)"


def _record_move(legs, when, description, notes=None):
    """Lança no Caixa um Aportei/Vendi/Transferir. `legs`: [(tipo, objeto, sai?, valor)].

    Conta: sair é despesa, entrar é receita. Ativo de capital: sair é retorno e
    entrar é aporte, sem conta. Ativo de valor declarado não ganha lançamento
    (o lançamento não mexe no valor dele): o registro acerta o valor. Conta e
    ativo de capital no mesmo sentido viram um lançamento só, como um aporte
    lançado à mão no Caixa.
    """
    rows = []
    for kind, obj, leaving, amount in legs:
        if kind == "account":
            rows.append({"account_id": obj.id, "playlist_id": None, "type": "expense" if leaving else "income", "amount": amount})
        elif obj.value_mode == "capital":
            rows.append({"account_id": None, "playlist_id": obj.id, "type": "income" if leaving else "expense", "amount": amount})
    cash = [r for r in rows if r["account_id"]]
    held = [r for r in rows if r["playlist_id"]]
    if len(cash) == 1 and len(held) == 1 and cash[0]["type"] == held[0]["type"]:
        rows = [{**cash[0], "playlist_id": held[0]["playlist_id"]}]
    group = uuid.uuid4()
    for row in rows:
        db.session.add(
            Transaction(description=description[:200], date=when, notes=(notes or None) and notes[:500], transfer_group=group, **row)
        )
    db.session.flush()


def _moved(playlist, totals):
    """O que os lançamentos já somaram ao valor da posição, na moeda dela.
    Valor declarado (moto, imóvel) não muda com lançamento."""
    rate = playlist.rate
    if playlist.value_mode == "declarado" or not rate:
        return Decimal(0)
    entry = totals.get(playlist.id, {})
    moved = entry.get("out", Decimal(0)) - entry.get("in", Decimal(0))
    return (moved / rate).quantize(NATIVE_PLACES)


def current_values(playlists):
    """Quanto cada posição vale agora, na moeda dela: o mesmo número das telas
    de Ativos e do Dashboard, e não só o valor digitado."""
    totals = get_playlist_totals()
    auto = auto_value_map(playlists)
    values = {}
    for playlist in playlists:
        if playlist.id in auto:
            values[playlist.id] = auto[playlist.id]
            continue
        opening = Decimal(playlist.opening_value or 0)
        value = opening + _moved(playlist, totals)
        # Voltou mais do que foi: o lucro já está no caixa, não parado aqui.
        # Valor declarado negativo é dívida e continua negativo.
        values[playlist.id] = value if opening < 0 else max(value, Decimal(0))
    return values


def set_value(playlist, target, current, totals, when, forced=False):
    """Faz a posição valer `target` (na moeda dela) em todo o sistema.

    O valor de um ativo de capital é o digitado + os lançamentos, então o
    digitado vira o que falta para chegar em `target`. Zerar à mão vira uma
    saída de 100%, sem conta (nenhum dinheiro entrou em lugar nenhum), para o
    ativo mostrar para onde o valor foi.
    """
    if forced and target == 0 and playlist.value_mode == "capital":
        amount = (abs(current) * playlist.rate).quantize(Decimal("0.01"))
        if amount:
            db.session.add(
                Transaction(
                    account_id=None,
                    playlist_id=playlist.id,
                    description=FORCED_EDIT,
                    amount=amount,
                    type="income" if current > 0 else "expense",
                    date=when,
                )
            )
            db.session.flush()
            totals = get_playlist_totals()
    playlist.opening_value = target - _moved(playlist, totals)


def _create_snapshot(payload, forced=False):
    """Cria o registro e faz o resto do sistema concordar com ele.

    `forced`: valores digitados à mão no "Novo registro" (ver `set_value`).
    Retorna (dict, None) em caso de sucesso ou (None, (mensagem, status)).
    """
    when = payload.get("date")
    when = when if isinstance(when, date_cls) else iso_date(when, "date")

    entries = payload.get("entries")
    if not isinstance(entries, list) or not entries:
        return None, ("É preciso informar ao menos uma posição em 'entries'", 400)

    snapshot = Snapshot(
        date=when,
        inflow=money(payload.get("inflow"), "inflow", allow_negative=True, required=False) or 0,
        notes=text(payload.get("notes"), "notes") or None,
    )
    db.session.add(snapshot)
    db.session.flush()

    # Até a data do registro: o que entrou e saiu depois continua valendo no saldo de hoje.
    moved = get_balances_by_account(until=when)
    current = current_values(Playlist.query.all())
    totals = get_playlist_totals()

    for raw in entries:
        if not isinstance(raw, dict):
            db.session.rollback()
            return None, ("Cada entrada precisa de playlist_id ou account_id", 400)
        value = money(raw.get("value"), "value", allow_negative=True, required=False) or Decimal(0)
        native_value = None
        playlist_id = raw.get("playlist_id")
        account_id = raw.get("account_id")

        if playlist_id:
            playlist = find(Playlist, playlist_id)
            if not playlist:
                db.session.rollback()
                return None, (f"playlist_id {playlist_id} inválido", 400)
            # Posição em outra moeda: `value` veio na moeda dela. O registro
            # guarda os dois — o histórico em reais, a tela na moeda original.
            if playlist.currency != "BRL" and not playlist.auto_source:
                rate = playlist.rate
                if rate is None:
                    db.session.rollback()
                    return None, (f"Sem cotação de {playlist.currency} ainda — confira a internet", 400)
                native_value = value.quantize(NATIVE_PLACES)
                value = (value * rate).quantize(Decimal("0.01"))
            # Posição derivada tem a origem como fonte da verdade: o registro
            # guarda o valor do dia, mas não sobrescreve de onde ele vem.
            target = native_value if native_value is not None else value
            if not playlist.auto_source and target != current[playlist.id]:
                set_value(playlist, target, current[playlist.id], totals, when, forced)
        elif account_id:
            account = find(Account, account_id)
            if not account:
                db.session.rollback()
                return None, (f"account_id {account_id} inválido", 400)
            # O saldo naquela data passa a ser o valor registrado. A diferença
            # vira lançamento no Caixa: corrigir o saldo não pode ser invisível.
            diff = value - Decimal(account.initial_balance or 0) - Decimal(moved.get(account.id) or 0)
            if diff:
                db.session.add(
                    Transaction(
                        account_id=account.id,
                        description=BALANCE_FIX,
                        amount=abs(diff),
                        type="income" if diff > 0 else "expense",
                        date=when,
                    )
                )
        else:
            db.session.rollback()
            return None, ("Cada entrada precisa de playlist_id ou account_id", 400)

        db.session.add(
            SnapshotEntry(
                snapshot_id=snapshot.id,
                playlist_id=playlist_id,
                account_id=account_id,
                value=value,
                native_value=native_value,
            )
        )

    db.session.commit()
    return snapshot.to_dict(counting_ids()), None


def counting_ids():
    """Posições que contam no patrimônio: só elas somam no total do registro."""
    return {pid for (pid,) in db.session.query(Playlist.id).filter(Playlist.counts_in_net_worth.is_(True))}


@snapshots_bp.get("")
def list_snapshots():
    query = (
        Snapshot.query
        # selectinload evita o N+1: uma query para os snapshots e outra para
        # todas as entradas, em vez de uma por linha.
        .options(selectinload(Snapshot.entries))
        .order_by(Snapshot.date.desc(), Snapshot.id.desc())
    )
    counting = counting_ids()
    return jsonify(paginate(query, lambda s: s.to_dict(counting)))


@snapshots_bp.get("/current")
def current_snapshot():
    """A linha "Agora" da planilha: o que um registro salvo neste momento guardaria."""
    playlists = Playlist.query.filter_by(kind="asset").all()
    values = current_values(playlists)
    balances = get_balances_by_account()
    entries = []
    for playlist in playlists:
        value, native = values[playlist.id], None
        if playlist.currency != "BRL" and not playlist.auto_source:
            native, value = value, (value * (playlist.rate or 0)).quantize(Decimal("0.01"))
        entries.append(SnapshotEntry(playlist_id=playlist.id, value=value, native_value=native))
    entries += [
        SnapshotEntry(account_id=a.id, value=a.initial_balance + balances.get(a.id, 0))
        for a in Account.query.all()
    ]
    # Fora da sessão: só monta a linha, não grava nada.
    return jsonify(Snapshot(date=date_cls.today(), inflow=0, entries=entries).to_dict(counting_ids()))


@snapshots_bp.post("")
def create_snapshot():
    result, error = _create_snapshot(request.get_json(silent=True) or {}, forced=True)
    if error:
        return jsonify({"error": error[0]}), error[1]
    return jsonify(result), 201


def transfer_between(origin, target, raw_amount, when=None, notes=None, description=None):
    """Move um valor de um lugar para outro: lança no Caixa e gera um registro novo.

    Nada some nem aparece do nada: o patrimônio total continua igual, só muda
    onde o dinheiro está.
    """
    amount = money(raw_amount, "amount")
    when = iso_date(when, "date", required=False) or date_cls.today()

    if not isinstance(origin, dict) or not isinstance(target, dict):
        return jsonify({"error": "Informe 'from' e 'to' como {type, id}"}), 400
    if origin.get("type") == target.get("type") and str(origin.get("id")) == str(target.get("id")):
        return jsonify({"error": "Origem e destino precisam ser diferentes"}), 400

    balances = get_balances_by_account(until=when)
    playlists = {p.id: p for p in Playlist.query.all()}
    # Na moeda de cada posição; `amount` é sempre em reais.
    positions = current_values(list(playlists.values()))
    account_rows = {a.id: a for a in Account.query.all()}
    accounts = {
        a.id: Decimal(a.initial_balance or 0) + Decimal(balances.get(a.id, 0))
        for a in account_rows.values()
    }
    legs = []

    def apply(ref, delta):
        kind = ref.get("type")
        try:
            ref_id = int(ref.get("id"))
        except (TypeError, ValueError):
            return f"id inválido: {ref.get('id')}"
        if kind == "playlist":
            if ref_id not in positions:
                return f"posição {ref_id} não encontrada"
            if playlists[ref_id].auto_source:
                return f"'{playlists[ref_id].name}' vem de outra tela — registre por lá"
            rate = playlists[ref_id].rate
            if rate is None:
                return f"Sem cotação de {playlists[ref_id].currency} ainda — confira a internet"
            # Conta pode ficar negativa (cheque especial é real); posição não.
            # Sem isso, tirar mais do que existe criava uma dívida fantasma.
            available = max(positions[ref_id], Decimal(0)) * rate
            if delta < 0 and -delta > available:
                name = playlists[ref_id].name
                return f"'{name}' não tem esse valor: só há {available:.2f} disponível"
            positions[ref_id] = (positions[ref_id] + delta / rate).quantize(NATIVE_PLACES)
            legs.append(("playlist", playlists[ref_id], delta < 0, amount))
        elif kind == "account":
            if ref_id not in accounts:
                return f"conta {ref_id} não encontrada"
            accounts[ref_id] += delta
            legs.append(("account", account_rows[ref_id], delta < 0, amount))
        else:
            return f"type inválido: {kind}"
        return None

    for ref, delta in ((origin, -amount), (target, amount)):
        problem = apply(ref, delta)
        if problem:
            return jsonify({"error": problem}), 400

    names = [obj.name for _, obj, _, _ in legs]
    _record_move(legs, when, description or f"Transferência: {names[0]} → {names[1]}", notes)

    entries = [{"playlist_id": pid, "value": v} for pid, v in positions.items()]
    entries += [{"account_id": aid, "value": v} for aid, v in accounts.items()]

    result, error = _create_snapshot(
        {
            "date": when,
            "notes": notes,
            "entries": entries,
        }
    )
    if error:
        return jsonify({"error": error[0]}), error[1]
    return jsonify(result), 201


@snapshots_bp.post("/transfer")
def transfer():
    data = request.get_json(silent=True) or {}
    return transfer_between(
        origin=data.get("from"),
        target=data.get("to"),
        raw_amount=data.get("amount"),
        when=data.get("date"),
        notes=data.get("notes"),
    )


@snapshots_bp.post("/settle")
def settle():
    """Vende/liquida uma posição e põe o dinheiro numa conta.

    Diferente da transferência, os dois lados podem ter valores diferentes: a
    casa sai dos livros por R$50.848 mas você recebeu R$60.000. A diferença é
    lucro realizado e aparece como crescimento do patrimônio.
    """
    data = request.get_json(silent=True) or {}

    origin = data.get("from")
    if not isinstance(origin, dict) or origin.get("type") != "playlist":
        return jsonify({"error": "Informe 'from' como {type:'playlist', id}"}), 400

    playlist = find(Playlist, origin.get("id"))
    if not playlist:
        return jsonify({"error": "posição não encontrada"}), 400
    if playlist.auto_source:
        return jsonify(
            {"error": "Essa posição vem de outra tela — quite por lá (ex: Empréstimos)"}
        ), 400

    account = find(Account, data.get("to_account_id"))
    if not account:
        return jsonify({"error": "Informe a conta que recebeu o dinheiro"}), 400

    rate = playlist.rate
    if rate is None:
        return jsonify({"error": f"Sem cotação de {playlist.currency} ainda — confira a internet"}), 400

    received = money(data.get("received"), "received")
    when = iso_date(data.get("date"), "date", required=False) or date_cls.today()
    all_positions = Playlist.query.all()
    positions = current_values(all_positions)
    # Tudo em reais aqui; a posição guarda na moeda dela.
    current = (positions[playlist.id] * rate).quantize(Decimal("0.01"))
    raw_reduce = data.get("reduce_by")
    # Sem 'reduce_by' é baixa total da posição.
    reduce_by = current if raw_reduce is None else money(raw_reduce, "reduce_by")
    if reduce_by <= 0:
        return jsonify({"error": "reduce_by deve ser maior que zero"}), 400
    # Baixar mais do que a posição tem viraria dívida fantasma.
    available = max(current, Decimal(0))
    if reduce_by > available:
        return jsonify(
            {"error": f"'{playlist.name}' vale {available:.2f} — não dá para baixar {reduce_by:.2f}"}
        ), 400

    balances = get_balances_by_account(until=when)
    accounts = {
        a.id: Decimal(a.initial_balance or 0) + Decimal(balances.get(a.id, 0))
        for a in Account.query.all()
    }

    # Baixa total zera exato; parcial converte o valor baixado para a moeda da posição.
    positions[playlist.id] = (
        Decimal(0)
        if raw_reduce is None
        else (positions[playlist.id] - reduce_by / rate).quantize(NATIVE_PLACES)
    )
    accounts[account.id] += received
    _record_move(
        [("playlist", playlist, True, reduce_by), ("account", account, False, received)],
        when,
        f"Venda / retorno de {playlist.name}",
        data.get("notes"),
    )

    entries = [{"playlist_id": pid, "value": v} for pid, v in positions.items()]
    entries += [{"account_id": aid, "value": v} for aid, v in accounts.items()]

    result, error = _create_snapshot(
        {
            "date": when,
            "notes": data.get("notes"),
            "entries": entries,
        }
    )
    if error:
        return jsonify({"error": error[0]}), error[1]

    result["realized_gain"] = float(received - reduce_by)
    return jsonify(result), 201


@snapshots_bp.post("/invest")
def invest():
    """Coloca mais dinheiro numa posição, saindo de uma conta.

    É o oposto de `/settle`: aportar mais R$5k na obra sem precisar montar uma
    transferência à mão. O patrimônio total não muda, só sai do caixa.
    """
    data = request.get_json(silent=True) or {}

    target = data.get("to")
    playlist = find(Playlist, target.get("id")) if isinstance(target, dict) else None
    if not playlist:
        return jsonify({"error": "Informe a posição em 'to' como {type:'playlist', id}"}), 400
    if playlist.auto_source:
        return jsonify(
            {"error": "Essa posição vem de outra tela — registre por lá (ex: Empréstimos)"}
        ), 400

    return transfer_between(
        origin={"type": "account", "id": data.get("from_account_id")},
        target={"type": "playlist", "id": playlist.id},
        raw_amount=data.get("amount"),
        when=data.get("date"),
        notes=data.get("notes"),
        description=f"Aporte em {playlist.name}",
    )


@snapshots_bp.delete("/<int:snapshot_id>")
def delete_snapshot(snapshot_id):
    """Remove só o registro histórico — não mexe no estado atual."""
    snapshot = db.get_or_404(Snapshot, snapshot_id)
    db.session.delete(snapshot)
    db.session.commit()
    return "", 204
