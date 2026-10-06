from datetime import date

from sqlalchemy import func, or_
from sqlalchemy.orm import joinedload, selectinload

from decimal import Decimal

from app.extensions import db
from app.models.account import Account
from app.models.budget import Budget
from app.models.category import Category
from app.models.playlist import DECLARED_ASSET_TYPES, Playlist
from app.models.playlist_expectation import PlaylistExpectation
from app.models.transaction import Transaction
from app.services.auto_value_service import auto_value_map, pending_to_partners
from app.services.balance_service import get_balances_by_account, get_playlist_totals
from app.services.planning_service import get_alerts, goals_with_progress
from app.services.history_service import (
    get_cashflow_series,
    get_net_worth_series,
    month_bounds,
    shift_month,
)



def _exclude_assets(query):
    """Tira do mês o dinheiro que só mudou de forma.

    Vale para ativos de capital (empréstimo, investimento, obra): aportar não é
    gasto. Não vale para ativos de valor declarado (veículo, imóvel) — abastecer
    a moto é despesa de verdade, o dinheiro foi embora.
    """
    return query.outerjoin(Playlist, Transaction.playlist_id == Playlist.id).filter(
        or_(
            Transaction.playlist_id.is_(None),
            Playlist.kind != "asset",
            Playlist.asset_type.in_(DECLARED_ASSET_TYPES),
        )
    )


def _totals_for_range(start, end):
    rows = (
        _exclude_assets(db.session.query(Transaction.type, func.sum(Transaction.amount)))
        .filter(Transaction.date >= start, Transaction.date <= end)
        .group_by(Transaction.type)
        .all()
    )
    totals = {"income": 0, "expense": 0}
    for tx_type, total in rows:
        totals[tx_type] = float(total or 0)
    return totals


def get_summary(month: date, granularity: str = "monthly", compact: bool = False):
    """`compact` pula as séries e a composição — usado por telas que só
    precisam dos totais (ex: o resumo no topo de Transações)."""
    start, end = month_bounds(month)

    accounts = Account.query.all()
    balances = get_balances_by_account()
    accounts_balance = [
        {
            "id": acc.id,
            "name": acc.name,
            "color": acc.color,
            "type": acc.type,
            "balance": float(acc.initial_balance + balances.get(acc.id, 0)),
        }
        for acc in accounts
    ]
    total_balance = sum(a["balance"] for a in accounts_balance)

    month_totals = _totals_for_range(start, end)

    # Mês anterior, para mostrar a variação nos cards em vez de só o absoluto.
    prev_start, prev_end = month_bounds(shift_month(start, -1))
    previous_totals = _totals_for_range(prev_start, prev_end)

    expenses_by_category_query = db.session.query(
        Category.id,
        Category.name,
        Category.color,
        Category.icon,
        func.sum(Transaction.amount).label("total"),
    ).join(Transaction, Transaction.category_id == Category.id)
    expenses_by_category = (
        _exclude_assets(expenses_by_category_query)
        .filter(
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Category.id)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    expenses_by_category = [
        {
            "category_id": row.id,
            "name": row.name,
            "color": row.color,
            "icon": row.icon,
            "total": float(row.total),
        }
        for row in expenses_by_category
    ]

    budgets = Budget.query.options(joinedload(Budget.category)).filter_by(month=start).all()
    spent_rows = (
        _exclude_assets(db.session.query(Transaction.category_id, func.sum(Transaction.amount)))
        .filter(
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Transaction.category_id)
        .all()
    )
    spent_map = {category_id: float(total) for category_id, total in spent_rows}
    budgets_progress = [
        {
            **b.to_dict(spent=spent_map.get(b.category_id, 0)),
        }
        for b in budgets
    ]

    recent_transactions = (
        Transaction.query.options(
            joinedload(Transaction.category),
            joinedload(Transaction.account),
            joinedload(Transaction.playlist),
        )
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(8)
        .all()
    )

    playlist_totals = get_playlist_totals()
    playlists = Playlist.query.order_by(Playlist.created_at).all()
    auto = auto_value_map(playlists)
    playlists_summary = [
        p.to_dict(
            total_in=playlist_totals.get(p.id, {}).get("in", Decimal("0")),
            total_out=playlist_totals.get(p.id, {}).get("out", Decimal("0")),
            auto_value=auto.get(p.id),
        )
        for p in playlists
    ]

    asset_playlists = [p for p in playlists_summary if p["kind"] == "asset"]
    # "Aportado" inclui o que já era seu (opening_value) mais o que saiu do caixa.
    # Em ativo de valor declarado o que sai é custo (gasolina), não aporte: só o
    # valor declarado conta, senão abastecer pareceria investir na moto.
    total_invested = sum(
        p["opening_value"] + (0 if p["value_mode"] == "declarado" else p["total_out"])
        for p in asset_playlists
    )
    total_returned = sum(
        0 if p["value_mode"] == "declarado" else p["total_in"] for p in asset_playlists
    )
    asset_summary = {
        "total_invested": total_invested,
        "total_returned": total_returned,
        "total_outstanding": total_invested - total_returned,
    }

    # Valor ainda parado num ativo/playlist que conta no patrimônio.
    # O clamp em zero existe para impedir que lucro já realizado (e portanto já
    # somado no saldo da conta) infle o patrimônio de novo. Uma posição
    # declarada negativa é passivo (dívida) e continua negativa.
    def _parked(entry):
        raw = entry["outstanding"] or 0
        return raw if (entry["opening_value"] or 0) < 0 else max(raw, 0)

    parked_in_assets = sum(
        _parked(p) for p in playlists_summary if p["kind"] == "asset" and p["counts_in_net_worth"]
    )
    parked_in_playlists = sum(
        _parked(p) for p in playlists_summary if p["kind"] == "group" and p["counts_in_net_worth"]
    )
    # Dinheiro de sócio que já voltou e ainda não foi repassado: está na conta
    # (e portanto em total_balance) mas não é patrimônio meu.
    owed_to_partners = float(pending_to_partners())
    net_worth = total_balance + parked_in_assets + parked_in_playlists - owed_to_partners

    upcoming = (
        PlaylistExpectation.query.options(selectinload(PlaylistExpectation.playlist))
        .filter_by(status="pending")
        .order_by(PlaylistExpectation.expected_date)
        .limit(5)
        .all()
    )
    upcoming_expectations = []
    for item in upcoming:
        data = item.to_dict()
        data["playlist"] = {
            "id": item.playlist.id,
            "name": item.playlist.name,
            "icon": item.playlist.icon,
            "color": item.playlist.color,
        }
        upcoming_expectations.append(data)

    summary = {
        "total_balance": total_balance,
        "net_worth": net_worth,
        "parked_in_assets": parked_in_assets,
        "parked_in_playlists": parked_in_playlists,
        "owed_to_partners": owed_to_partners,
        "accounts_balance": accounts_balance,
        "month_income": month_totals["income"],
        "month_expense": month_totals["expense"],
        "month_savings": month_totals["income"] - month_totals["expense"],
        "previous_month": {
            "income": previous_totals["income"],
            "expense": previous_totals["expense"],
            "savings": previous_totals["income"] - previous_totals["expense"],
        },
        "expenses_by_category": expenses_by_category,
        "budgets_progress": budgets_progress,
        "recent_transactions": [t.to_dict() for t in recent_transactions],
        "playlists_summary": playlists_summary,
        "asset_summary": asset_summary,
        "upcoming_expectations": upcoming_expectations,
        "granularity": granularity,
        "goals": goals_with_progress(net_worth, playlists_summary),
    }
    summary["alerts"] = get_alerts(summary, include_budgets=start == date.today().replace(day=1))

    if not compact:
        summary["cashflow_series"] = get_cashflow_series(end, granularity)
        summary["net_worth_series"] = get_net_worth_series(end, granularity, playlists)
        # Onde o dinheiro está: os mesmos valores do patrimônio. Passivo não é fatia do bolo.
        allocation = [
            {"label": a["name"], "value": a["balance"], "group": "Contas", "icon": "🏦"}
            for a in accounts_balance
            if a["balance"] > 0
        ] + [
            {
                "label": p["name"],
                "value": _parked(p),
                "group": "Ativos" if p["kind"] == "asset" else "Grupos",
                "icon": p["icon"],
            }
            for p in playlists_summary
            if p["counts_in_net_worth"] and _parked(p) > 0
        ]
        summary["allocation"] = sorted(allocation, key=lambda i: i["value"], reverse=True)

    return summary
