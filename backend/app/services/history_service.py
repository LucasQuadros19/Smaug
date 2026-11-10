"""Séries históricas do dashboard: fluxo de caixa por período e evolução do
patrimônio ao longo do tempo."""

import calendar
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import case, func, or_

from app.extensions import db
from app.models.account import Account
from app.models.category import Category
from app.models.month_leftover import MonthLeftover
from app.models.playlist import DECLARED_ASSET_TYPES, Playlist
from app.models.transaction import Transaction
from app.services.auto_value_service import auto_value_map


def exclude_asset_moves(query):
    """Tira das receitas e despesas o dinheiro que só mudou de forma.

    Vale para ativos de capital (empréstimo, investimento, obra): aportar não é
    gasto. Nem as transferências da planilha (Aportei, Vendi, Transferir). Não vale para ativos de valor declarado (veículo, imóvel) — abastecer
    a moto é despesa de verdade, o dinheiro foi embora. Dashboard, gráfico e
    orçamentos usam esta mesma regra.
    """
    return query.outerjoin(Playlist, Transaction.playlist_id == Playlist.id).filter(
        Transaction.transfer_group.is_(None),
        or_(
            Transaction.playlist_id.is_(None),
            Playlist.kind != "asset",
            Playlist.asset_type.in_(DECLARED_ASSET_TYPES),
        ),
    )


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
        exclude_asset_moves(db.session.query(Transaction.date, Transaction.type, func.sum(Transaction.amount)))
        .filter(Transaction.date >= window_start, Transaction.date <= window_end)
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
        .filter(Transaction.date <= cutoff, Transaction.account_id.isnot(None))
        .scalar()
    )
    return initial_total + Decimal(net or 0)


def _parked_value(opening, net, mode="capital", debt=False):
    """Passivo (declarado negativo) fica negativo; ativo não desce de zero.

    Em ativo de valor declarado (veículo, imóvel) os lançamentos são custos e
    não mexem no valor — vale só o que foi declarado.
    """
    if mode == "declarado":
        return opening
    raw = opening + net
    return raw if opening < 0 or debt else max(raw, Decimal(0))


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
    # Posição ligada a outra tela não tem histórico próprio: vale o de agora, como o declarado.
    auto = auto_value_map(counting)

    for label, _start, end in build_periods(reference, granularity, count):
        cash = _cash_until(end, initial_total)
        nets = _net_by_playlist_until(end)

        point = {"period": label, "cash": float(cash), "assets": {}}
        parked_total = Decimal(0)
        for playlist in counting:
            if playlist.id in auto:
                parked = auto[playlist.id]
            else:
                parked = _parked_value(
                    playlist.opening_brl, nets.get(playlist.id, Decimal(0)), playlist.value_mode, playlist.asset_type == "debt"
                )
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


ANALYTICS_GRANULARITIES = ("day", "week", "month", "year")


def _bucket(day: date, granularity: str) -> str:
    if granularity == "day":
        return day.isoformat()
    if granularity == "week":
        return (day - timedelta(days=day.weekday())).isoformat()
    if granularity == "month":
        return day.strftime("%Y-%m")
    return str(day.year)


def analytics_periods(reference: date, granularity: str):
    """A janela da tela de Análises: os dias do mês, 13 semanas, os meses do ano ou os anos com lançamento."""
    if granularity == "day":
        start, end = month_bounds(reference.replace(day=1))
        return [(d.isoformat(), d, d) for d in (start + timedelta(days=i) for i in range(end.day))]
    if granularity == "week":
        return build_periods(reference, "weekly", 13)
    if granularity == "month":
        return build_periods(date(reference.year, 12, 1), "monthly", 12)
    last = date.today().year
    earliest = [
        d
        for d in (
            db.session.query(func.min(Transaction.date)).scalar(),
            db.session.query(func.min(MonthLeftover.month)).scalar(),
        )
        if d
    ]
    first = max(min(earliest).year if earliest else last, last - 49)
    return [(str(y), date(y, 1, 1), date(y, 12, 31)) for y in range(first, last + 1)]


def get_analytics(reference: date, granularity: str):
    """Entradas, saídas e gastos por categoria em cada período da janela, com a mesma regra do dashboard."""
    periods = analytics_periods(reference, granularity)
    start, end = periods[0][1], periods[-1][2]

    rows = (
        exclude_asset_moves(
            db.session.query(
                Transaction.date,
                Transaction.type,
                Transaction.category_id,
                func.sum(Transaction.amount),
                func.count(Transaction.id),
            )
        )
        .filter(Transaction.date >= start, Transaction.date <= end)
        .group_by(Transaction.date, Transaction.type, Transaction.category_id)
        .all()
    )

    points = {
        label: {
            "period": label, "start": s.isoformat(), "end": e.isoformat(),
            "income": 0.0, "expense": 0.0, "informed": None, "categories": {},
        }
        for label, s, e in periods
    }
    # A sobra que você digitou é por mês: aparece na visão por mês e somada na por ano.
    if granularity in ("month", "year"):
        for month, amount in db.session.query(MonthLeftover.month, MonthLeftover.amount).filter(
            MonthLeftover.month >= start, MonthLeftover.month <= end
        ):
            point = points[_bucket(month, granularity)]
            point["informed"] = (point["informed"] or 0.0) + float(amount)
    by_category = {}
    by_weekday = [0.0] * 7
    for day, tx_type, category_id, total, count in rows:
        value = float(total or 0)
        point = points[_bucket(day, granularity)]
        point[tx_type] += value
        if tx_type != "expense":
            continue
        key = str(category_id or 0)
        entry = point["categories"].setdefault(key, {"total": 0.0, "count": 0})
        entry["total"] += value
        entry["count"] += count
        overall = by_category.setdefault(category_id, {"total": 0.0, "count": 0})
        overall["total"] += value
        overall["count"] += count
        by_weekday[day.weekday()] += value

    info = {
        c.id: c
        for c in db.session.query(Category.id, Category.name, Category.icon, Category.color).filter(
            Category.id.in_([cid for cid in by_category if cid])
        )
    }
    categories = sorted(
        (
            {
                "category_id": cid,
                "name": info[cid].name if cid in info else "Sem categoria",
                "icon": info[cid].icon if cid in info else "—",
                "color": info[cid].color if cid in info else "#64748b",
                **totals,
            }
            for cid, totals in by_category.items()
        ),
        key=lambda c: c["total"],
        reverse=True,
    )

    # Média por dia da semana só nos dias que já passaram: o resto do mês ainda não gastou.
    elapsed = max((min(end, date.today()) - start).days + 1, 0)
    occurrences = [0] * 7
    for i in range(elapsed):
        occurrences[(start.weekday() + i) % 7] += 1

    # Lançamentos com a mesma descrição somados: "Mercado da semana" 45x diz mais que o maior gasto solto.
    top = (
        exclude_asset_moves(
            db.session.query(
                func.min(Transaction.description),
                func.sum(Transaction.amount),
                func.count(Transaction.id),
                func.max(Transaction.category_id),
            )
        )
        .filter(Transaction.type == "expense", Transaction.date >= start, Transaction.date <= end)
        .group_by(func.lower(Transaction.description))
        .order_by(func.sum(Transaction.amount).desc())
        .limit(8)
        .all()
    )

    return {
        "granularity": granularity,
        "start": start.isoformat(),
        "end": end.isoformat(),
        "periods": list(points.values()),
        "categories": categories,
        "weekdays": [
            {"weekday": i, "total": by_weekday[i], "average": by_weekday[i] / occurrences[i] if occurrences[i] else 0.0}
            for i in range(7)
        ],
        "top_descriptions": [
            {
                "description": description,
                "total": float(total),
                "count": count,
                "icon": info[category_id].icon if category_id in info else "—",
            }
            for description, total, count, category_id in top
        ],
    }
