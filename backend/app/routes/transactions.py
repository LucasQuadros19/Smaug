from datetime import date

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.account import Account
from app.models.category import Category
from app.models.transaction import TRANSACTION_TYPES, Transaction
from app.utils.pagination import paginate

transactions_bp = Blueprint("transactions", __name__)



def _eager():
    """to_dict() lê categoria, conta e playlist — sem isso são 3 queries por linha."""
    return (
        joinedload(Transaction.category),
        joinedload(Transaction.account),
        joinedload(Transaction.playlist),
    )


def _apply_filters(query):
    account_id = request.args.get("account_id", type=int)
    if account_id:
        query = query.filter(Transaction.account_id == account_id)

    category_id = request.args.get("category_id", type=int)
    if category_id:
        query = query.filter(Transaction.category_id == category_id)

    playlist_id = request.args.get("playlist_id", type=int)
    if playlist_id:
        query = query.filter(Transaction.playlist_id == playlist_id)

    tx_type = request.args.get("type")
    if tx_type:
        query = query.filter(Transaction.type == tx_type)

    start_date = request.args.get("start_date")
    if start_date:
        query = query.filter(Transaction.date >= date.fromisoformat(start_date))

    end_date = request.args.get("end_date")
    if end_date:
        query = query.filter(Transaction.date <= date.fromisoformat(end_date))

    search = request.args.get("search")
    if search:
        query = query.filter(Transaction.description.ilike(f"%{search}%"))

    # "caixa" = gasto/receita de verdade. "transfers" = movimentação de
    # patrimônio (marcada com playlist/ativo), que não é ganho nem perda.
    scope = request.args.get("scope")
    if scope == "cash":
        query = query.filter(Transaction.playlist_id.is_(None))
    elif scope == "transfers":
        query = query.filter(Transaction.playlist_id.isnot(None))

    return query


@transactions_bp.get("")
def list_transactions():
    query = _apply_filters(Transaction.query).options(*_eager())
    query = query.order_by(Transaction.date.desc(), Transaction.id.desc())

    result = paginate(query, lambda t: t.to_dict())

    # Totais de TODAS as linhas do filtro, não só da página — senão o resumo
    # da tela mudaria conforme você navega.
    totals = dict(
        _apply_filters(db.session.query(Transaction.type, func.sum(Transaction.amount)))
        .group_by(Transaction.type)
        .all()
    )
    result["totals"] = {
        "income": float(totals.get("income") or 0),
        "expense": float(totals.get("expense") or 0),
    }

    # Gasto por categoria dentro do filtro atual — permite ver "quanto foi em
    # alimentação neste período" sem precisar somar à mão.
    rows = (
        _apply_filters(
            db.session.query(
                Category.id,
                Category.name,
                Category.icon,
                Category.color,
                func.sum(Transaction.amount).label("total"),
                func.count(Transaction.id).label("count"),
            ).outerjoin(Category, Transaction.category_id == Category.id)
        )
        .filter(Transaction.type == "expense")
        .group_by(Category.id, Category.name, Category.icon, Category.color)
        .order_by(func.sum(Transaction.amount).desc())
        .all()
    )
    result["by_category"] = [
        {
            "category_id": r.id,
            "name": r.name or "Sem categoria",
            "icon": r.icon or "—",
            "color": r.color or "#64748b",
            "total": float(r.total or 0),
            "count": r.count,
        }
        for r in rows
    ]
    return jsonify(result)


@transactions_bp.post("")
def create_transaction():
    data = request.get_json(silent=True) or {}

    description = (data.get("description") or "").strip()
    if not description:
        return jsonify({"error": "O campo 'description' é obrigatório"}), 400

    account_id = data.get("account_id")
    if not account_id or not Account.query.get(account_id):
        return jsonify({"error": "account_id inválido"}), 400

    tx_type = data.get("type")
    if tx_type not in TRANSACTION_TYPES:
        return jsonify({"error": f"type deve ser um de {TRANSACTION_TYPES}"}), 400

    amount = data.get("amount")
    if amount is None or float(amount) <= 0:
        return jsonify({"error": "amount deve ser maior que zero"}), 400

    date_value = data.get("date")
    if not date_value:
        return jsonify({"error": "O campo 'date' é obrigatório (YYYY-MM-DD)"}), 400

    transaction = Transaction(
        description=description,
        account_id=account_id,
        category_id=data.get("category_id"),
        playlist_id=data.get("playlist_id"),
        amount=amount,
        type=tx_type,
        date=date.fromisoformat(date_value),
        notes=data.get("notes"),
    )
    db.session.add(transaction)
    db.session.commit()
    return jsonify(transaction.to_dict()), 201


@transactions_bp.put("/<int:transaction_id>")
def update_transaction(transaction_id):
    transaction = Transaction.query.get_or_404(transaction_id)
    data = request.get_json(silent=True) or {}

    if "description" in data:
        description = (data.get("description") or "").strip()
        if not description:
            return jsonify({"error": "O campo 'description' não pode ser vazio"}), 400
        transaction.description = description
    if "account_id" in data:
        if not Account.query.get(data["account_id"]):
            return jsonify({"error": "account_id inválido"}), 400
        transaction.account_id = data["account_id"]
    if "category_id" in data:
        transaction.category_id = data["category_id"]
    if "playlist_id" in data:
        transaction.playlist_id = data["playlist_id"]
    if "type" in data:
        if data["type"] not in TRANSACTION_TYPES:
            return jsonify({"error": f"type deve ser um de {TRANSACTION_TYPES}"}), 400
        transaction.type = data["type"]
    if "amount" in data:
        if float(data["amount"]) <= 0:
            return jsonify({"error": "amount deve ser maior que zero"}), 400
        transaction.amount = data["amount"]
    if "date" in data:
        transaction.date = date.fromisoformat(data["date"])
    if "notes" in data:
        transaction.notes = data["notes"]

    db.session.commit()
    return jsonify(transaction.to_dict())


@transactions_bp.delete("/<int:transaction_id>")
def delete_transaction(transaction_id):
    from app.models.loan import LoanRepayment

    transaction = Transaction.query.get_or_404(transaction_id)

    # Lançamentos gerados por um recebimento de empréstimo não podem ser
    # apagados soltos: o dinheiro sairia do caixa mas o recebimento continuaria
    # abatendo o empréstimo, e o valor sumiria sem rastro.
    linked = LoanRepayment.query.filter(
        (LoanRepayment.transaction_id == transaction_id)
        | (LoanRepayment.partner_transaction_id == transaction_id)
    ).first()
    if linked:
        return jsonify(
            {
                "error": (
                    "Esse lançamento veio de um recebimento de empréstimo. "
                    "Desfaça por lá, na tela de Empréstimos, para tudo ficar consistente."
                )
            }
        ), 400

    db.session.delete(transaction)
    db.session.commit()
    return "", 204
