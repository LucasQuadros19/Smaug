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


def get_net_worth_series(reference: date, granularity: str, playlists: list):
    """Evolução do patrimônio: total, caixa e cada ativo que conta.

    Com registros de patrimônio, usa o histórico real. Sem eles, calcula pelas
    transações — e o valor declarado, que não tem data, vale desde o início.
    """
    counting = [p for p in playlists if p.counts_in_net_worth]
    assets = [{"id": p.id, "name": p.name, "color": p.color, "icon": p.icon} for p in counting if p.kind == "asset"]

    series = _net_worth_from_snapshots(counting)
    if series:
        return {"series": series, "assets": assets, "source": "snapshots"}

    count = 12 if granularity == "weekly" else 6
    initial_total = Decimal(db.session.query(func.sum(Account.initial_balance)).scalar() or 0)

    for label, _start, end in build_periods(reference, granularity, count):
        cash = _cash_until(end, initial_total)
        nets = _net_by_playlist_until(end)

        point = {"period": label, "cash": float(cash), "assets": {}}
        parked_total = Decimal(0)
        for playlist in counting:
            parked = _parked_value(playlist.opening_brl, nets.get(playlist.id, Decimal(0)), playlist.value_mode)
            parked_total += parked
            if playlist.kind == "asset":
                point["assets"][str(playlist.id)] = float(parked)

        point["net_worth"] = float(cash + parked_total)
        series.append(point)

    return {"series": series, "assets": assets}


def _net_worth_from_snapshots(counting: list) -> list:
    """Série real a partir dos registros de patrimônio. Vários registros no
    mesmo dia: vale o último, que é o estado final daquele dia.

    Lê só as colunas necessárias: montar objeto por valor pesa com anos de histórico.
    """
    from app.models.snapshot import Snapshot, SnapshotEntry

    kinds = {p.id: p.kind for p in counting}
    rows = (
        db.session.query(Snapshot.id, Snapshot.date, SnapshotEntry.playlist_id, SnapshotEntry.account_id, SnapshotEntry.value)
        .join(SnapshotEntry, SnapshotEntry.snapshot_id == Snapshot.id)
        .order_by(Snapshot.date, Snapshot.id)
        .all()
    )

    by_date = {}
    totals = {}
    current = None
    for snapshot_id, when, playlist_id, account_id, value in rows:
        if snapshot_id != current:
            current = snapshot_id
            key = when.isoformat()
            point = by_date[key] = {"period": key, "cash": 0.0, "assets": {}, "net_worth": 0.0}
            sums = totals[key] = [Decimal(0), Decimal(0)]
        if account_id is not None:
            sums[0] += value
        elif playlist_id in kinds:
            sums[1] += value
            if kinds[playlist_id] == "asset":
                point["assets"][str(playlist_id)] = float(value)

    for key, (cash_total, parked_total) in totals.items():
        by_date[key]["cash"] = float(cash_total)
        by_date[key]["net_worth"] = float(cash_total + parked_total)
    return list(by_date.values())
