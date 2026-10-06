from decimal import Decimal

from sqlalchemy import case, func

from app.extensions import db
from app.models.transaction import Transaction


def get_balances_by_account():
    """Retorna {account_id: saldo_das_transacoes} (sem contar initial_balance)."""
    rows = (
        db.session.query(
            Transaction.account_id,
            func.sum(
                case(
                    (Transaction.type == "income", Transaction.amount),
                    else_=-Transaction.amount,
                )
            ).label("net"),
        )
        .group_by(Transaction.account_id)
        .all()
    )
    return {row.account_id: row.net or Decimal("0") for row in rows}


def get_playlist_totals():
    """Retorna {playlist_id: {"in": Decimal, "out": Decimal}}."""
    rows = (
        db.session.query(
            Transaction.playlist_id,
            Transaction.type,
            func.sum(Transaction.amount).label("total"),
        )
        .filter(Transaction.playlist_id.isnot(None))
        .group_by(Transaction.playlist_id, Transaction.type)
        .all()
    )
    totals = {}
    for playlist_id, tx_type, total in rows:
        entry = totals.setdefault(playlist_id, {"in": Decimal("0"), "out": Decimal("0")})
        entry["in" if tx_type == "income" else "out"] = total or Decimal("0")
    return totals
