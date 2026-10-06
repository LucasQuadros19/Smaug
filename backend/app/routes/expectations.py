from datetime import date

from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.account import Account
from app.models.playlist import Playlist
from app.models.playlist_expectation import PlaylistExpectation
from app.models.transaction import Transaction

expectations_bp = Blueprint("expectations", __name__)



def _with_playlist(item):
    data = item.to_dict()
    data["playlist"] = {
        "id": item.playlist.id,
        "name": item.playlist.name,
        "icon": item.playlist.icon,
        "color": item.playlist.color,
    }
    return data


@expectations_bp.get("")
def list_expectations():
    query = PlaylistExpectation.query

    playlist_id = request.args.get("playlist_id", type=int)
    if playlist_id:
        query = query.filter_by(playlist_id=playlist_id)

    status = request.args.get("status")
    if status:
        query = query.filter_by(status=status)

    items = query.order_by(PlaylistExpectation.expected_date).all()
    return jsonify([_with_playlist(item) for item in items])


@expectations_bp.post("")
def create_expectation():
    data = request.get_json(silent=True) or {}

    playlist_id = data.get("playlist_id")
    if not playlist_id or not Playlist.query.get(playlist_id):
        return jsonify({"error": "playlist_id inválido"}), 400

    description = (data.get("description") or "").strip()
    if not description:
        return jsonify({"error": "O campo 'description' é obrigatório"}), 400

    amount = data.get("amount")
    if amount is None or float(amount) <= 0:
        return jsonify({"error": "amount deve ser maior que zero"}), 400

    expected_date = data.get("expected_date")
    if not expected_date:
        return jsonify({"error": "O campo 'expected_date' é obrigatório (YYYY-MM-DD)"}), 400

    account_id = data.get("account_id")
    if account_id and not Account.query.get(account_id):
        return jsonify({"error": "account_id inválido"}), 400

    item = PlaylistExpectation(
        playlist_id=playlist_id,
        description=description,
        amount=amount,
        expected_date=date.fromisoformat(expected_date),
        account_id=account_id,
    )
    db.session.add(item)
    db.session.commit()
    return jsonify(_with_playlist(item)), 201


@expectations_bp.put("/<int:item_id>")
def update_expectation(item_id):
    item = PlaylistExpectation.query.get_or_404(item_id)
    data = request.get_json(silent=True) or {}

    if "description" in data:
        description = (data.get("description") or "").strip()
        if not description:
            return jsonify({"error": "O campo 'description' não pode ser vazio"}), 400
        item.description = description
    if "amount" in data:
        if float(data["amount"]) <= 0:
            return jsonify({"error": "amount deve ser maior que zero"}), 400
        item.amount = data["amount"]
    if "expected_date" in data:
        item.expected_date = date.fromisoformat(data["expected_date"])
    if "account_id" in data:
        if data["account_id"] and not Account.query.get(data["account_id"]):
            return jsonify({"error": "account_id inválido"}), 400
        item.account_id = data["account_id"]

    db.session.commit()
    return jsonify(_with_playlist(item))


@expectations_bp.delete("/<int:item_id>")
def delete_expectation(item_id):
    item = PlaylistExpectation.query.get_or_404(item_id)
    db.session.delete(item)
    db.session.commit()
    return "", 204


@expectations_bp.post("/<int:item_id>/launch")
def launch_expectation(item_id):
    """Lança uma transação real a partir da expectativa. Pode ser chamado
    quantas vezes for preciso — a expectativa continua ali, pronta para o
    próximo lançamento (ex: mesma parcela todo mês)."""
    item = PlaylistExpectation.query.get_or_404(item_id)
    data = request.get_json(silent=True) or {}

    account_id = data.get("account_id") or item.account_id
    if not account_id or not Account.query.get(account_id):
        return jsonify({"error": "account_id inválido"}), 400

    amount = data.get("amount", item.amount)
    if float(amount) <= 0:
        return jsonify({"error": "amount deve ser maior que zero"}), 400

    date_value = data.get("date")
    tx_date = date.fromisoformat(date_value) if date_value else date.today()

    transaction = Transaction(
        account_id=account_id,
        category_id=data.get("category_id"),
        playlist_id=item.playlist_id,
        description=item.description,
        amount=amount,
        type="income",
        date=tx_date,
        notes=data.get("notes"),
    )
    db.session.add(transaction)
    db.session.commit()

    return jsonify({"expectation": _with_playlist(item), "transaction": transaction.to_dict()})
