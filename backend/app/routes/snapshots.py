from datetime import date as date_cls
from decimal import Decimal, InvalidOperation

from flask import Blueprint, jsonify, request
from sqlalchemy import case, func
from sqlalchemy.orm import selectinload

from app.extensions import db
from app.utils.pagination import paginate
from app.models.account import Account
from app.models.playlist import Playlist
from app.models.snapshot import Snapshot, SnapshotEntry
from app.models.transaction import Transaction

snapshots_bp = Blueprint("snapshots", __name__)

# Valor na moeda da posição: 8 casas para caber fração de bitcoin.
NATIVE_PLACES = Decimal("0.00000001")



def _moved_by_account():
    """Quanto cada conta já andou por transações — usado na reconciliação."""
    return dict(
        db.session.query(
            Transaction.account_id,
            func.sum(
                case(
                    (Transaction.type == "income", Transaction.amount),
                    else_=-Transaction.amount,
                )
            ),
        )
        .group_by(Transaction.account_id)
        .all()
    )


def _create_snapshot(payload):
    """Cria o registro e sincroniza o estado atual com ele.

    Retorna (dict, None) em caso de sucesso ou (None, (mensagem, status)).
    """
    date_value = payload.get("date")
    if not date_value:
        return None, ("O campo 'date' é obrigatório (YYYY-MM-DD)", 400)

    entries = payload.get("entries")
    if not isinstance(entries, list) or not entries:
        return None, ("É preciso informar ao menos uma posição em 'entries'", 400)

    snapshot = Snapshot(
        date=date_cls.fromisoformat(date_value) if isinstance(date_value, str) else date_value,
        inflow=payload.get("inflow") or 0,
        notes=(payload.get("notes") or "").strip() or None if payload.get("notes") else None,
    )
    db.session.add(snapshot)
    db.session.flush()

    moved = _moved_by_account()

    for raw in entries:
        value = Decimal(str(raw.get("value") or 0))
        native_value = None
        playlist_id = raw.get("playlist_id")
        account_id = raw.get("account_id")

        if playlist_id:
            playlist = Playlist.query.get(playlist_id)
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
            if not playlist.auto_source:
                playlist.opening_value = native_value if native_value is not None else value
        elif account_id:
            account = Account.query.get(account_id)
            if not account:
                db.session.rollback()
                return None, (f"account_id {account_id} inválido", 400)
            # Força o saldo exibido a bater com o valor registrado.
            account.initial_balance = value - Decimal(moved.get(account_id) or 0)
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
    return snapshot.to_dict(), None


@snapshots_bp.get("")
def list_snapshots():
    query = (
        Snapshot.query
        # selectinload evita o N+1: uma query para os snapshots e outra para
        # todas as entradas, em vez de uma por linha.
        .options(selectinload(Snapshot.entries))
        .order_by(Snapshot.date.desc(), Snapshot.id.desc())
    )
    return jsonify(paginate(query, lambda s: s.to_dict()))


@snapshots_bp.post("")
def create_snapshot():
    result, error = _create_snapshot(request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error[0]}), error[1]
    return jsonify(result), 201


def transfer_between(origin, target, raw_amount, when=None, notes=None):
    """Move um valor de um lugar para outro, gerando um registro novo.

    Nada some nem aparece do nada: o patrimônio total continua igual, só muda
    onde o dinheiro está.
    """
    from app.services.balance_service import get_balances_by_account

    try:
        amount = Decimal(str(raw_amount or 0))
    except (InvalidOperation, TypeError):
        return jsonify({"error": "amount inválido"}), 400
    if amount <= 0:
        return jsonify({"error": "amount deve ser maior que zero"}), 400

    if not origin or not target:
        return jsonify({"error": "Informe 'from' e 'to' como {type, id}"}), 400
    if origin.get("type") == target.get("type") and str(origin.get("id")) == str(target.get("id")):
        return jsonify({"error": "Origem e destino precisam ser diferentes"}), 400

    balances = get_balances_by_account()
    playlists = {p.id: p for p in Playlist.query.all()}
    # Na moeda de cada posição; `amount` é sempre em reais.
    positions = {pid: Decimal(p.opening_value or 0) for pid, p in playlists.items()}
    accounts = {
        a.id: Decimal(a.initial_balance or 0) + Decimal(balances.get(a.id, 0))
        for a in Account.query.all()
    }

    def apply(ref, delta):
        kind = ref.get("type")
        try:
            ref_id = int(ref.get("id"))
        except (TypeError, ValueError):
            return f"id inválido: {ref.get('id')}"
        if kind == "playlist":
            if ref_id not in positions:
                return f"posição {ref_id} não encontrada"
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
        elif kind == "account":
            if ref_id not in accounts:
                return f"conta {ref_id} não encontrada"
            accounts[ref_id] += delta
        else:
            return f"type inválido: {kind}"
        return None

    for ref, delta in ((origin, -amount), (target, amount)):
        problem = apply(ref, delta)
        if problem:
            return jsonify({"error": problem}), 400

    entries = [{"playlist_id": pid, "value": v} for pid, v in positions.items()]
    entries += [{"account_id": aid, "value": v} for aid, v in accounts.items()]

    result, error = _create_snapshot(
        {
            "date": when or date_cls.today().isoformat(),
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
    from app.services.balance_service import get_balances_by_account

    data = request.get_json(silent=True) or {}

    origin = data.get("from")
    if not origin or origin.get("type") != "playlist":
        return jsonify({"error": "Informe 'from' como {type:'playlist', id}"}), 400

    playlist = Playlist.query.get(origin.get("id"))
    if not playlist:
        return jsonify({"error": "posição não encontrada"}), 400
    if playlist.auto_source:
        return jsonify(
            {"error": "Essa posição vem de outra tela — quite por lá (ex: Empréstimos)"}
        ), 400

    account = Account.query.get(data.get("to_account_id"))
    if not account:
        return jsonify({"error": "Informe a conta que recebeu o dinheiro"}), 400

    rate = playlist.rate
    if rate is None:
        return jsonify({"error": f"Sem cotação de {playlist.currency} ainda — confira a internet"}), 400

    try:
        received = Decimal(str(data.get("received") or 0))
        # Tudo em reais aqui; a posição guarda na moeda dela.
        current = (Decimal(playlist.opening_value or 0) * rate).quantize(Decimal("0.01"))
        raw_reduce = data.get("reduce_by")
        # Sem 'reduce_by' é baixa total da posição.
        reduce_by = current if raw_reduce is None else Decimal(str(raw_reduce))
    except Exception:
        return jsonify({"error": "valores inválidos"}), 400

    if received <= 0:
        return jsonify({"error": "received deve ser maior que zero"}), 400
    if reduce_by <= 0:
        return jsonify({"error": "reduce_by deve ser maior que zero"}), 400
    # Baixar mais do que a posição tem viraria dívida fantasma.
    available = max(current, Decimal(0))
    if reduce_by > available:
        return jsonify(
            {"error": f"'{playlist.name}' vale {available:.2f} — não dá para baixar {reduce_by:.2f}"}
        ), 400

    balances = get_balances_by_account()
    positions = {p.id: Decimal(p.opening_value or 0) for p in Playlist.query.all()}
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

    entries = [{"playlist_id": pid, "value": v} for pid, v in positions.items()]
    entries += [{"account_id": aid, "value": v} for aid, v in accounts.items()]

    result, error = _create_snapshot(
        {
            "date": data.get("date") or date_cls.today().isoformat(),
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

    playlist = Playlist.query.get((data.get("to") or {}).get("id"))
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
    )


@snapshots_bp.delete("/<int:snapshot_id>")
def delete_snapshot(snapshot_id):
    """Remove só o registro histórico — não mexe no estado atual."""
    snapshot = Snapshot.query.get_or_404(snapshot_id)
    db.session.delete(snapshot)
    db.session.commit()
    return "", 204
