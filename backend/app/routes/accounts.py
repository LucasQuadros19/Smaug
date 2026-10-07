from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.account import ACCOUNT_TYPES, Account
from app.routes.shares import limited_view
from app.services.balance_service import get_balances_by_account
from app.utils.parse import color, money

accounts_bp = Blueprint("accounts", __name__)


@accounts_bp.get("")
def list_accounts():
    accounts = Account.query.order_by(Account.created_at).all()
    if limited_view("contas", "patrimonio"):
        return jsonify([{"id": a.id, "name": a.name, "type": a.type, "color": a.color} for a in accounts])
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
        initial_balance=money(data.get("initial_balance"), "initial_balance", allow_negative=True, required=False) or 0,
        color=color(data.get("color"), "#6366f1"),
    )
    db.session.add(account)
    db.session.commit()
    return jsonify(account.to_dict(balance=account.initial_balance)), 201


@accounts_bp.put("/<int:account_id>")
def update_account(account_id):
    account = db.get_or_404(Account, account_id)
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
        account.initial_balance = (
            money(data["initial_balance"], "initial_balance", allow_negative=True, required=False) or 0
        )
    if "color" in data:
        account.color = color(data["color"], account.color)

    db.session.commit()
    balances = get_balances_by_account()
    return jsonify(
        account.to_dict(balance=account.initial_balance + balances.get(account.id, 0))
    )


@accounts_bp.delete("/<int:account_id>")
def delete_account(account_id):
    from app.models.loan import LoanRepayment
    from app.models.market import MarketTrade
    from app.models.playlist_expectation import PlaylistExpectation
    from app.models.snapshot import SnapshotEntry

    account = db.get_or_404(Account, account_id)
    if SnapshotEntry.query.filter_by(account_id=account_id).first():
        return jsonify(
            {"error": "Essa conta está nos registros de patrimônio — apagar mudaria o histórico. Zere o saldo dela em vez de apagar."}
        ), 400
    if LoanRepayment.query.filter_by(account_id=account_id).first() or MarketTrade.query.filter_by(account_id=account_id).first():
        return jsonify(
            {"error": "Essa conta recebeu valores de empréstimos ou do Mercado. Desfaça esses registros antes de apagar."}
        ), 400

    PlaylistExpectation.query.filter_by(account_id=account_id).update({"account_id": None})
    db.session.delete(account)
    db.session.commit()
    return "", 204
