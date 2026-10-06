from datetime import date, datetime

from flask import Blueprint, jsonify, request
from sqlalchemy import func
from sqlalchemy.orm import joinedload

from app.extensions import db
from app.models.budget import Budget
from app.models.category import Category
from app.models.transaction import Transaction
from app.services.history_service import month_bounds
from app.utils.parse import money

budgets_bp = Blueprint("budgets", __name__)


def _parse_month(value):
    """Aceita 'YYYY-MM' ou 'YYYY-MM-DD' e retorna o primeiro dia do mês."""
    value = str(value)
    if len(value) == 7:
        dt = datetime.strptime(value, "%Y-%m")
    else:
        dt = datetime.strptime(value, "%Y-%m-%d")
    return date(dt.year, dt.month, 1)



def _spent_by_category(month: date):
    start, end = month_bounds(month)
    rows = (
        db.session.query(
            Transaction.category_id, func.sum(Transaction.amount).label("total")
        )
        .filter(
            Transaction.type == "expense",
            Transaction.date >= start,
            Transaction.date <= end,
        )
        .group_by(Transaction.category_id)
        .all()
    )
    return {row.category_id: row.total for row in rows}


@budgets_bp.get("")
def list_budgets():
    month_param = request.args.get("month")
    month = _parse_month(month_param) if month_param else date.today().replace(day=1)

    budgets = Budget.query.options(joinedload(Budget.category)).filter_by(month=month).all()
    spent_map = _spent_by_category(month)
    return jsonify(
        [b.to_dict(spent=spent_map.get(b.category_id, 0)) for b in budgets]
    )


@budgets_bp.post("")
def create_budget():
    data = request.get_json(silent=True) or {}

    category_id = data.get("category_id")
    if not category_id or not db.session.get(Category, category_id):
        return jsonify({"error": "category_id inválido"}), 400

    limit_amount = money(data.get("limit_amount"), "limit_amount")

    month_param = data.get("month")
    if not month_param:
        return jsonify({"error": "O campo 'month' é obrigatório (YYYY-MM)"}), 400
    month = _parse_month(month_param)

    if Budget.query.filter_by(category_id=category_id, month=month).first():
        return jsonify({"error": "Já existe um orçamento para essa categoria neste mês"}), 400

    budget = Budget(category_id=category_id, month=month, limit_amount=limit_amount)
    db.session.add(budget)
    db.session.commit()
    spent_map = _spent_by_category(month)
    return jsonify(budget.to_dict(spent=spent_map.get(category_id, 0))), 201


@budgets_bp.put("/<int:budget_id>")
def update_budget(budget_id):
    budget = db.get_or_404(Budget, budget_id)
    data = request.get_json(silent=True) or {}

    if "limit_amount" in data:
        budget.limit_amount = money(data["limit_amount"], "limit_amount")

    db.session.commit()
    spent_map = _spent_by_category(budget.month)
    return jsonify(budget.to_dict(spent=spent_map.get(budget.category_id, 0)))


@budgets_bp.delete("/<int:budget_id>")
def delete_budget(budget_id):
    budget = db.get_or_404(Budget, budget_id)
    db.session.delete(budget)
    db.session.commit()
    return "", 204
