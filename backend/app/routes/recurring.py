from datetime import date

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from app.extensions import db
from app.models.account import Account
from app.models.recurring import RECURRING_FREQUENCIES, RecurringTransaction
from app.models.transaction import TRANSACTION_TYPES, Transaction
from app.services.recurring_service import advance, generate_due_transactions

recurring_bp = Blueprint("recurring", __name__)


def _parse_date(value):
    """Aceita 'YYYY-MM-DD' ou um date já pronto. Devolve (date, erro)."""
    if isinstance(value, date):
        return value, None
    try:
        return date.fromisoformat(value), None
    except (TypeError, ValueError):
        return None, "data inválida (use YYYY-MM-DD)"


@recurring_bp.get("")
def list_recurring():
    items = RecurringTransaction.query.order_by(
        func.coalesce(RecurringTransaction.postponed_until, RecurringTransaction.next_due_date)
    ).all()
    return jsonify([item.to_dict() for item in items])


@recurring_bp.post("")
def create_recurring():
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

    frequency = data.get("frequency", "monthly")
    if frequency not in RECURRING_FREQUENCIES:
        return jsonify({"error": f"frequency deve ser um de {RECURRING_FREQUENCIES}"}), 400

    if not data.get("next_due_date"):
        return jsonify({"error": "O campo 'next_due_date' é obrigatório (YYYY-MM-DD)"}), 400
    next_due_date, erro = _parse_date(data["next_due_date"])
    if erro:
        return jsonify({"error": erro}), 400

    item = RecurringTransaction(
        description=description,
        account_id=account_id,
        category_id=data.get("category_id"),
        playlist_id=data.get("playlist_id"),
        amount=amount,
        type=tx_type,
        frequency=frequency,
        next_due_date=next_due_date,
        active=data.get("active", True),
        auto=data.get("auto", True),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@recurring_bp.put("/<int:item_id>")
def update_recurring(item_id):
    item = RecurringTransaction.query.get_or_404(item_id)
    data = request.get_json(silent=True) or {}

    if "description" in data:
        description = (data.get("description") or "").strip()
        if not description:
            return jsonify({"error": "O campo 'description' não pode ser vazio"}), 400
        item.description = description
    if "account_id" in data:
        if not Account.query.get(data["account_id"]):
            return jsonify({"error": "account_id inválido"}), 400
        item.account_id = data["account_id"]
    if "category_id" in data:
        item.category_id = data["category_id"]
    if "playlist_id" in data:
        item.playlist_id = data["playlist_id"]
    if "type" in data:
        if data["type"] not in TRANSACTION_TYPES:
            return jsonify({"error": f"type deve ser um de {TRANSACTION_TYPES}"}), 400
        item.type = data["type"]
    if "amount" in data:
        if float(data["amount"]) <= 0:
            return jsonify({"error": "amount deve ser maior que zero"}), 400
        item.amount = data["amount"]
    if "frequency" in data:
        if data["frequency"] not in RECURRING_FREQUENCIES:
            return jsonify({"error": f"frequency deve ser um de {RECURRING_FREQUENCIES}"}), 400
        item.frequency = data["frequency"]
    if "next_due_date" in data:
        parsed, erro = _parse_date(data["next_due_date"])
        if erro:
            return jsonify({"error": erro}), 400
        item.next_due_date = parsed
        # Mudou a data à mão: o adiamento antigo deixa de fazer sentido.
        item.postponed_until = None
    if "active" in data:
        item.active = bool(data["active"])
    if "auto" in data:
        item.auto = bool(data["auto"])

    db.session.commit()
    return jsonify(item.to_dict())


@recurring_bp.delete("/<int:item_id>")
def delete_recurring(item_id):
    item = RecurringTransaction.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return "", 204


@recurring_bp.post("/generate")
def generate_recurring():
    created = generate_due_transactions()
    return jsonify({"generated": len(created)})


@recurring_bp.post("/<int:item_id>/launch")
def launch_recurring(item_id):
    """Lança uma recorrência manual com o valor real daquele mês.

    O `amount` é opcional: sem ele vale o valor cadastrado. A data avança um
    período, então lançar duas vezes cobre dois meses — e não duplica o mesmo.
    """
    item = RecurringTransaction.query.get_or_404(item_id)
    data = request.get_json(silent=True) or {}

    amount = data.get("amount", item.amount)
    try:
        if float(amount) <= 0:
            return jsonify({"error": "amount deve ser maior que zero"}), 400
    except (TypeError, ValueError):
        return jsonify({"error": "amount inválido"}), 400

    if data.get("date"):
        tx_date, erro = _parse_date(data["date"])
        if erro:
            return jsonify({"error": erro}), 400
    else:
        tx_date = item.due_date

    transaction = Transaction(
        account_id=item.account_id,
        category_id=item.category_id,
        playlist_id=item.playlist_id,
        description=item.description,
        amount=amount,
        type=item.type,
        date=tx_date,
        notes=data.get("notes") or "Lançado manualmente (recorrente)",
    )
    db.session.add(transaction)

    advance(item)
    db.session.commit()

    return jsonify({"recurring": item.to_dict(), "transaction": transaction.to_dict()}), 201


@recurring_bp.post("/<int:item_id>/postpone")
def postpone_recurring(item_id):
    """Adia a ocorrência atual (automática ou manual) até `until`.

    `until: null` desfaz o adiamento. A automática só é gerada na nova data;
    a manual só aparece como pendente a partir dela.
    """
    item = RecurringTransaction.query.get_or_404(item_id)
    data = request.get_json(silent=True) or {}

    if data.get("until") is None:
        item.postponed_until = None
    else:
        until, erro = _parse_date(data["until"])
        if erro:
            return jsonify({"error": erro}), 400
        if until <= item.next_due_date:
            return jsonify({"error": "A nova data precisa ser depois do vencimento original"}), 400
        item.postponed_until = until

    db.session.commit()
    return jsonify(item.to_dict())
