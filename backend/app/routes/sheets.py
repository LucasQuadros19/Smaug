from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.sheet import Sheet

sheets_bp = Blueprint("sheets", __name__)


def _apply(sheet, data):
    if "title" in data:
        title = (data.get("title") or "").strip()
        if not title:
            return "O título não pode ser vazio"
        sheet.title = title[:100]
    if "content" in data:
        sheet.content = data.get("content") or ""
    return None


@sheets_bp.get("")
def list_sheets():
    return jsonify([s.to_dict() for s in Sheet.query.order_by(Sheet.created_at, Sheet.id).all()])


@sheets_bp.post("")
def create_sheet():
    sheet = Sheet(title="Nova folha", content="")
    error = _apply(sheet, request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400
    db.session.add(sheet)
    db.session.commit()
    return jsonify(sheet.to_dict()), 201


@sheets_bp.put("/<int:sheet_id>")
def update_sheet(sheet_id):
    sheet = db.get_or_404(Sheet, sheet_id)
    error = _apply(sheet, request.get_json(silent=True) or {})
    if error:
        return jsonify({"error": error}), 400
    db.session.commit()
    return jsonify(sheet.to_dict())


@sheets_bp.delete("/<int:sheet_id>")
def delete_sheet(sheet_id):
    sheet = db.get_or_404(Sheet, sheet_id)
    db.session.delete(sheet)
    db.session.commit()
    return "", 204
