from datetime import date

from flask import Blueprint, jsonify, request
from werkzeug.exceptions import BadRequest

from app.extensions import db
from app.models.account import Account
from app.models.category import Category
from app.models.playlist import Playlist
from app.models.shopping_item import SHOPPING_PRIORITIES, ShoppingItem
from app.models.transaction import Transaction
from app.utils.parse import find, iso_date, money, text

shopping_items_bp = Blueprint("shopping_items", __name__)

PRIORITY_ORDER = {"high": 0, "medium": 1, "low": 2}


@shopping_items_bp.get("")
def list_shopping_items():
    playlist_id = request.args.get("playlist_id", type=int)
    if playlist_id:
        query = ShoppingItem.query.filter_by(playlist_id=playlist_id)
    else:
        query = ShoppingItem.query.filter(ShoppingItem.playlist_id.is_(None))

    items = query.all()
    items.sort(
        key=lambda i: (
            i.purchased,
            PRIORITY_ORDER.get(i.priority, 1),
            i.created_at or "",
        )
    )
    return jsonify([item.to_dict() for item in items])


@shopping_items_bp.post("")
def create_shopping_item():
    data = request.get_json(silent=True) or {}

    description = text(data.get("description"), "description")
    if not description:
        return jsonify({"error": "O campo 'description' é obrigatório"}), 400

    amount = money(data.get("amount"), "amount", allow_zero=True, required=False)

    playlist_id = data.get("playlist_id")
    if playlist_id and not find(Playlist, playlist_id):
        return jsonify({"error": "playlist_id inválido"}), 400

    priority = data.get("priority", "medium")
    if priority not in SHOPPING_PRIORITIES:
        return jsonify({"error": f"priority deve ser um de {SHOPPING_PRIORITIES}"}), 400

    item = ShoppingItem(
        description=description,
        amount=amount,
        playlist_id=playlist_id,
        priority=priority,
        notes=data.get("notes"),
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(item.to_dict()), 201


@shopping_items_bp.put("/<int:item_id>")
def update_shopping_item(item_id):
    item = db.get_or_404(ShoppingItem, item_id)
    data = request.get_json(silent=True) or {}

    if "description" in data:
        description = text(data.get("description"), "description")
        if not description:
            return jsonify({"error": "O campo 'description' não pode ser vazio"}), 400
        item.description = description
    if "amount" in data:
        item.amount = money(data["amount"], "amount", allow_zero=True, required=False)
    if "priority" in data:
        if data["priority"] not in SHOPPING_PRIORITIES:
            return jsonify({"error": f"priority deve ser um de {SHOPPING_PRIORITIES}"}), 400
        item.priority = data["priority"]
    if "notes" in data:
        item.notes = data["notes"]
    if "purchased" in data:
        item.purchased = bool(data["purchased"])
        if item.purchased and data.get("launch"):
            _launch(item, data["launch"])
        elif not item.purchased and item.transaction_id:
            # Desmarcou: o gasto lançado junto sai do caixa também.
            transaction = db.session.get(Transaction, item.transaction_id)
            item.transaction_id = None
            db.session.flush()
            if transaction:
                db.session.delete(transaction)

    db.session.commit()
    return jsonify(item.to_dict())


def _launch(item, raw):
    """Lança a compra no caixa: gasto na conta, marcado com o grupo/ativo da lista."""
    if not isinstance(raw, dict):
        raise BadRequest("launch deve ter account_id e amount")
    account = find(Account, raw.get("account_id"))
    if not account:
        raise BadRequest("Informe a conta que pagou")
    category_id = raw.get("category_id")
    if category_id and not find(Category, category_id):
        raise BadRequest("category_id inválido")
    amount = money(raw.get("amount", item.amount), "Valor pago")
    transaction = Transaction(
        account_id=account.id,
        category_id=category_id or None,
        playlist_id=item.playlist_id,
        description=item.description,
        amount=amount,
        type="expense",
        date=iso_date(raw.get("date"), "date", required=False) or date.today(),
        notes="Lista de compras",
    )
    db.session.add(transaction)
    db.session.flush()
    item.transaction_id = transaction.id
    item.amount = amount


@shopping_items_bp.delete("/<int:item_id>")
def delete_shopping_item(item_id):
    """Tira da lista. O gasto que já foi lançado fica no caixa: a compra aconteceu."""
    item = db.get_or_404(ShoppingItem, item_id)
    db.session.delete(item)
    db.session.commit()
    return "", 204
