from datetime import date

from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.goal import Goal
from app.models.playlist import Playlist
from app.services.dashboard_service import get_summary

goals_bp = Blueprint("goals", __name__)


def _goal_dict(goal_id):
    # O progresso depende do patrimônio e das posições: o resumo já calcula os dois.
    goals = get_summary(date.today().replace(day=1), compact=True)["goals"]
    return next(g for g in goals if g["id"] == goal_id)


def _apply(goal, data):
    """Valida e aplica os campos enviados. Devolve mensagem de erro ou None."""
    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return "O campo 'name' é obrigatório"
        goal.name = name
    if "icon" in data:
        goal.icon = data["icon"] or "🎯"
    if "target_amount" in data:
        try:
            target = float(data["target_amount"])
        except (TypeError, ValueError):
            return "target_amount inválido"
        if target <= 0:
            return "target_amount deve ser maior que zero"
        goal.target_amount = data["target_amount"]
    if "deadline" in data:
        try:
            goal.deadline = date.fromisoformat(data["deadline"]) if data["deadline"] else None
        except (TypeError, ValueError):
            return "deadline inválido (use YYYY-MM-DD)"
    if "playlist_id" in data:
        if data["playlist_id"] and not db.session.get(Playlist, data["playlist_id"]):
            return "playlist_id inválido"
        goal.playlist_id = data["playlist_id"] or None
    return None


@goals_bp.get("")
def list_goals():
    return jsonify(get_summary(date.today().replace(day=1), compact=True)["goals"])


@goals_bp.post("")
def create_goal():
    data = request.get_json(silent=True) or {}
    if "target_amount" not in data or "name" not in data:
        return jsonify({"error": "Informe 'name' e 'target_amount'"}), 400
    goal = Goal()
    error = _apply(goal, data)
    if error:
        return jsonify({"error": error}), 400
    db.session.add(goal)
    db.session.commit()
    return jsonify(_goal_dict(goal.id)), 201


@goals_bp.put("/<int:goal_id>")
def update_goal(goal_id):
    goal = Goal.query.get_or_404(goal_id)
    error = _apply(goal, request.get_json(silent=True) or {})
    if error:
        db.session.rollback()
        return jsonify({"error": error}), 400
    db.session.commit()
    return jsonify(_goal_dict(goal.id))


@goals_bp.delete("/<int:goal_id>")
def delete_goal(goal_id):
    goal = Goal.query.get_or_404(goal_id)
    db.session.delete(goal)
    db.session.commit()
    return "", 204
