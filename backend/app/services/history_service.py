"""Séries históricas do dashboard: fluxo de caixa por período e evolução do
patrimônio ao longo do tempo."""

import calendar
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, or_

from app.extensions import db
from app.models.account import Account
from app.models.playlist import Playlist
from app.models.transaction import Transaction


def month_bounds(month: date):
    last_day = calendar.monthrange(month.year, month.month)[1]
    return month, date(month.year, month.month, last_day)


def shift_month(month: date, delta: int) -> date:
    index = month.month - 1 + delta
    return date(month.year + index // 12, index % 12 + 1, 1)


def build_periods(reference: date, granularity: str, count: int):
    """Lista de (label, inicio, fim) terminando no período de `reference`."""
    periods = []
    if granularity == "weekly":
        # semana começa na segunda-feira
        week_start = reference - timedelta(days=reference.weekday())
        for i in range(count - 1, -1, -1):
            start = week_start - timedelta(weeks=i)
            end = start + timedelta(days=6)
            periods.append((start.strftime("%Y-%m-%d"), start, end))
    else:
        base = reference.replace(day=1)
        for i in range(count - 1, -1, -1):
            month = shift_month(base, -i)
            start, end = month_bounds(month)
            periods.append((month.strftime("%Y-%m"), start, end))
    return periods


def get_cashflow_series(reference: date, granularity: str = "monthly"):
    """Receitas/despesas por período — exclui movimento de ativos.

    Uma única query agrupada cobre a série inteira; antes era uma por período.
    """
    count = 12 if granularity == "weekly" else 6
    periods = build_periods(reference, granularity, count)
    if not periods:
        return []

    window_start = periods[0][1]
    window_end = periods[-1][2]

    rows = (
        db.session.query(Transaction.date, Transaction.type, func.sum(Transaction.amount))
        .outerjoin(Playlist, Transaction.playlist_id == Playlist.id)
        .filter(
            or_(Transaction.playlist_id.is_(None), Playlist.kind != "asset"),
            Transaction.date >= window_start,
            Transaction.date <= window_end,
        )
        .group_by(Transaction.date, Transaction.type)
        .all()
    )

    series = []
    for label, start, end in periods:
        totals = {"income": 0.0, "expense": 0.0}
        for tx_date, tx_type, total in rows:
            if start <= tx_date <= end:
                totals[tx_type] += float(total or 0)
        series.append({"period": label, "income": totals["income"], "expense": totals["expense"]})
    return series


def _net_by_playlist_until(cutoff: date):
    """{playlist_id: saída − entrada acumulada até a data}."""
    rows = (
        db.session.query(
            Transaction.playlist_id,
            func.sum(
                case(
                    (Transaction.type == "expense", Transaction.amount),
                    else_=-Transaction.amount,
                )
            ),
        )
        .filter(Transaction.playlist_id.isnot(None), Transaction.date <= cutoff)
        .group_by(Transaction.playlist_id)
        .all()
    )
    return {pid: Decimal(total or 0) for pid, total in rows}


def _cash_until(cutoff: date, initial_total: Decimal):
    net = (
        db.session.query(
            func.sum(
                case(
                    (Transaction.type == "income", Transaction.amount),
                    else_=-Transaction.amount,
                )
            )
        )
        .filter(Transaction.date <= cutoff)
        .scalar()
    )
    return initial_total + Decimal(net or 0)


def _parked_value(opening, net, mode="capital"):
    """Passivo (declarado negativo) fica negativo; ativo não desce de zero.

    Em ativo de valor declarado (veículo, imóvel) os lançamentos são custos e
    não mexem no valor — vale só o que foi declarado.
    """
    if mode == "declarado":
        return opening
    raw = opening + net
    return raw if opening < 0 else max(raw, Decimal(0))


def get_net_worth_series(reference: date, granularity: str = "monthly"):
    """Evolução do patrimônio: total, caixa e cada ativo que conta.

    Quando existem snapshots (registros de patrimônio), usa o histórico real.
    Sem snapshots, cai no cálculo a partir das transações — nesse caso o valor
    declarado (opening_value) não tem data e é tratado como presente desde o
    início da série.
    """
    from app.models.snapshot import Snapshot

    if Snapshot.query.first() is not None:
        return _net_worth_from_snapshots()

    count = 12 if granularity == "weekly" else 6
    periods = build_periods(reference, granularity, count)

    initial_total = Decimal(
        db.session.query(func.sum(Account.initial_balance)).scalar() or 0
    )
    counting = Playlist.query.filter_by(counts_in_net_worth=True).all()
    assets = [p for p in counting if p.kind == "asset"]

    series = []
    for label, _start, end in periods:
        cash = _cash_until(end, initial_total)
        nets = _net_by_playlist_until(end)

        point = {"period": label, "cash": float(cash), "assets": {}}
        parked_total = Decimal(0)
        for playlist in counting:
            parked = _parked_value(
                playlist.opening_brl,
                nets.get(playlist.id, Decimal(0)),
                playlist.value_mode,
            )
            parked_total += parked
            if playlist.kind == "asset":
                point["assets"][str(playlist.id)] = float(parked)

        point["net_worth"] = float(cash + parked_total)
        series.append(point)

    return {
        "series": series,
        "assets": [
            {"id": a.id, "name": a.name, "color": a.color, "icon": a.icon} for a in assets
        ],
    }


def _net_worth_from_snapshots():
    """Série histórica real a partir dos registros de patrimônio.

    Quando há mais de um registro na mesma data (a planilha original tinha
    vários), vale o último — é o estado final daquele dia.
    """
    from sqlalchemy.orm import selectinload

    from app.models.snapshot import Snapshot

    snapshots = (
        Snapshot.query.options(selectinload(Snapshot.entries))
        .order_by(Snapshot.date, Snapshot.id)
        .all()
    )
    counting_ids = {
        p.id: p for p in Playlist.query.filter_by(counts_in_net_worth=True).all()
    }
    assets = [p for p in counting_ids.values() if p.kind == "asset"]

    by_date = {}
    for snap in snapshots:
        cash = Decimal(0)
        asset_values = {}
        parked_total = Decimal(0)
        for entry in snap.entries:
            if entry.account_id is not None:
                cash += Decimal(entry.value)
            elif entry.playlist_id in counting_ids:
                parked_total += Decimal(entry.value)
                if counting_ids[entry.playlist_id].kind == "asset":
                    asset_values[str(entry.playlist_id)] = float(entry.value)

        by_date[snap.date.isoformat()] = {
            "period": snap.date.isoformat(),
            "cash": float(cash),
            "assets": asset_values,
            "net_worth": float(cash + parked_total),
        }

    return {
        "series": list(by_date.values()),
        "assets": [
            {"id": a.id, "name": a.name, "color": a.color, "icon": a.icon} for a in assets
        ],
        "source": "snapshots",
    }


def get_allocation():
    """Onde o dinheiro está agora, item a item — para o gráfico de composição."""
    from app.services.balance_service import get_balances_by_account

    balances = get_balances_by_account()
    items = []

    for account in Account.query.order_by(Account.created_at).all():
        value = float(account.initial_balance + balances.get(account.id, 0))
        if value > 0:
            items.append(
                {
                    "label": account.name,
                    "value": value,
                    "group": "Contas",
                    "icon": "🏦",
                }
            )

    nets = _net_by_playlist_until(date.today())
    for playlist in Playlist.query.filter_by(counts_in_net_worth=True).all():
        parked = float(
            _parked_value(
                playlist.opening_brl,
                nets.get(playlist.id, Decimal(0)),
                playlist.value_mode,
            )
        )
        # O gráfico de composição mostra onde o dinheiro está; um passivo não é
        # uma "fatia" do bolo, então fica de fora (aparece na tabela e no total).
        if parked > 0:
            items.append(
                {
                    "label": playlist.name,
                    "value": parked,
                    "group": "Ativos" if playlist.kind == "asset" else "Grupos",
                    "icon": playlist.icon,
                }
            )

    items.sort(key=lambda i: i["value"], reverse=True)
    return items
