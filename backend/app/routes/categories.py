from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.category import CATEGORY_TYPES, Category

categories_bp = Blueprint("categories", __name__)


@categories_bp.get("")
def list_categories():
    category_type = request.args.get("type")
    query = Category.query
    if category_type:
        query = query.filter_by(type=category_type)
    categories = query.order_by(Category.name).all()
    return jsonify([c.to_dict() for c in categories])


@categories_bp.post("")
def create_category():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "O campo 'name' é obrigatório"}), 400

    category_type = data.get("type")
    if category_type not in CATEGORY_TYPES:
        return jsonify({"error": f"type deve ser um de {CATEGORY_TYPES}"}), 400

    category = Category(
        name=name,
        type=category_type,
        color=data.get("color", "#6366f1"),
        icon=data.get("icon", "💰"),
    )
    db.session.add(category)
    db.session.commit()
    return jsonify(category.to_dict()), 201


@categories_bp.put("/<int:category_id>")
def update_category(category_id):
    category = Category.query.get_or_404(category_id)
    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "O campo 'name' não pode ser vazio"}), 400
        category.name = name
    if "type" in data:
        if data["type"] not in CATEGORY_TYPES:
            return jsonify({"error": f"type deve ser um de {CATEGORY_TYPES}"}), 400
        category.type = data["type"]
    if "color" in data:
        category.color = data["color"]
    if "icon" in data:
        category.icon = data["icon"]

    db.session.commit()
    return jsonify(category.to_dict())


@categories_bp.delete("/<int:category_id>")
def delete_category(category_id):
    category = Category.query.get_or_404(category_id)
    db.session.delete(category)
    db.session.commit()
    return "", 204
