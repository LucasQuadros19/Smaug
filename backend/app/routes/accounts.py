from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.account import ACCOUNT_TYPES, Account
from app.services.balance_service import get_balances_by_account

accounts_bp = Blueprint("accounts", __name__)


@accounts_bp.get("")
def list_accounts():
    accounts = Account.query.order_by(Account.created_at).all()
    balances = get_balances_by_account()
    return jsonify(
        [
            acc.to_dict(balance=acc.initial_balance + balances.get(acc.id, 0))
            for acc in accounts
        ]
    )


@accounts_bp.post("")
def create_account():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "O campo 'name' é obrigatório"}), 400

    account_type = data.get("type", "checking")
    if account_type not in ACCOUNT_TYPES:
        return jsonify({"error": f"type deve ser um de {ACCOUNT_TYPES}"}), 400

    account = Account(
        name=name,
        type=account_type,
        initial_balance=data.get("initial_balance", 0) or 0,
        color=data.get("color", "#6366f1"),
    )
    db.session.add(account)
    db.session.commit()
    return jsonify(account.to_dict(balance=account.initial_balance)), 201


@accounts_bp.put("/<int:account_id>")
def update_account(account_id):
    account = Account.query.get_or_404(account_id)
    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "O campo 'name' não pode ser vazio"}), 400
        account.name = name
    if "type" in data:
        if data["type"] not in ACCOUNT_TYPES:
            return jsonify({"error": f"type deve ser um de {ACCOUNT_TYPES}"}), 400
        account.type = data["type"]
    if "initial_balance" in data:
        account.initial_balance = data["initial_balance"] or 0
    if "color" in data:
        account.color = data["color"]

    db.session.commit()
    balances = get_balances_by_account()
    return jsonify(
        account.to_dict(balance=account.initial_balance + balances.get(account.id, 0))
    )


@accounts_bp.delete("/<int:account_id>")
def delete_account(account_id):
    account = Account.query.get_or_404(account_id)
    db.session.delete(account)
    db.session.commit()
    return "", 204
