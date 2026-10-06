from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.playlist import Playlist
from app.models.shopping_item import SHOPPING_PRIORITIES, ShoppingItem
from app.utils.parse import money

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

    description = (data.get("description") or "").strip()
    if not description:
        return jsonify({"error": "O campo 'description' é obrigatório"}), 400

    amount = money(data.get("amount"), "amount", allow_zero=True, required=False)

    playlist_id = data.get("playlist_id")
    if playlist_id and not db.session.get(Playlist, playlist_id):
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
        description = (data.get("description") or "").strip()
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

    db.session.commit()
    return jsonify(item.to_dict())


@shopping_items_bp.delete("/<int:item_id>")
def delete_shopping_item(item_id):
    item = db.get_or_404(ShoppingItem, item_id)
    db.session.delete(item)
    db.session.commit()
    return "", 204
