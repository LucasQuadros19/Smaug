from decimal import Decimal

from flask import Blueprint, jsonify, request

from app.extensions import db
from app.models.playlist import (
    ASSET_TYPES,
    DEFAULT_ASSET_TYPE,
    PLAYLIST_KINDS,
    Playlist,
)
from app.models.recurring import RecurringTransaction
from app.models.transaction import Transaction
from app.services.auto_value_service import auto_value_map
from app.services.balance_service import get_playlist_totals
from app.services.rates import CURRENCIES
from app.utils.parse import color, money

playlists_bp = Blueprint("playlists", __name__)


@playlists_bp.get("")
def list_playlists():
    playlists = Playlist.query.order_by(Playlist.created_at).all()
    totals = get_playlist_totals()
    auto = auto_value_map(playlists)
    return jsonify(
        [
            p.to_dict(
                total_in=totals.get(p.id, {}).get("in", Decimal("0")),
                total_out=totals.get(p.id, {}).get("out", Decimal("0")),
                auto_value=auto.get(p.id),
            )
            for p in playlists
        ]
    )


@playlists_bp.get("/<int:playlist_id>")
def get_playlist(playlist_id):
    playlist = db.get_or_404(Playlist, playlist_id)
    totals = get_playlist_totals()
    entry = totals.get(playlist_id, {})
    return jsonify(
        playlist.to_dict(
            total_in=entry.get("in", Decimal("0")),
            total_out=entry.get("out", Decimal("0")),
            auto_value=auto_value_map([playlist]).get(playlist.id),
        )
    )


@playlists_bp.get("/<int:playlist_id>/history")
def playlist_history(playlist_id):
    """Linha do tempo da posição: quanto valia em cada registro.

    Serve para responder "quanto essa obra rendeu e há quanto tempo o dinheiro
    está parado nela" sem garimpar a planilha inteira.
    """
    from datetime import date

    from sqlalchemy.orm import selectinload

    from app.models.snapshot import Snapshot, SnapshotEntry

    playlist = db.get_or_404(Playlist, playlist_id)

    rows = (
        db.session.query(Snapshot.date, SnapshotEntry.value)
        .join(SnapshotEntry, SnapshotEntry.snapshot_id == Snapshot.id)
        .filter(SnapshotEntry.playlist_id == playlist_id)
        .order_by(Snapshot.date, Snapshot.id)
        .all()
    )
    # Vários registros no mesmo dia: vale o último, que é o estado final do dia.
    by_date = {}
    for when, value in rows:
        by_date[when.isoformat()] = float(value)
    series = [{"date": d, "value": v} for d, v in by_date.items()]

    totals = get_playlist_totals().get(playlist_id, {})
    auto = auto_value_map([playlist]).get(playlist_id)
    current = playlist.to_dict(
        total_in=totals.get("in", Decimal("0")),
        total_out=totals.get("out", Decimal("0")),
        auto_value=auto,
    )

    # Primeira vez que a posição teve valor — para dizer há quanto tempo o
    # dinheiro está ali.
    first_funded = next((p["date"] for p in series if p["value"] != 0), None)
    days_held = None
    if first_funded and current["outstanding"]:
        days_held = (date.today() - date.fromisoformat(first_funded)).days

    transactions = (
        Transaction.query.options(selectinload(Transaction.account))
        .filter_by(playlist_id=playlist_id)
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .limit(50)
        .all()
    )

    return jsonify(
        {
            "playlist": current,
            "series": series,
            "first_funded": first_funded,
            "days_held": days_held,
            "peak": max((p["value"] for p in series), default=0),
            "transactions": [t.to_dict() for t in transactions],
        }
    )


@playlists_bp.post("")
def create_playlist():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    if not name:
        return jsonify({"error": "O campo 'name' é obrigatório"}), 400

    kind = data.get("kind", "group")
    if kind not in PLAYLIST_KINDS:
        return jsonify({"error": f"kind deve ser um de {PLAYLIST_KINDS}"}), 400

    # Ativos guardam valor (moto, empréstimo) e por padrão contam no patrimônio;
    # playlists são consumo (roupas, viagem) e por padrão não contam.
    counts = data.get("counts_in_net_worth")
    if counts is None:
        counts = kind == "asset"

    asset_type = data.get("asset_type") or DEFAULT_ASSET_TYPE
    if asset_type not in ASSET_TYPES:
        return jsonify({"error": f"asset_type deve ser um de {ASSET_TYPES}"}), 400

    currency = data.get("currency") or "BRL"
    if currency not in CURRENCIES:
        return jsonify({"error": f"currency deve ser uma de {CURRENCIES}"}), 400

    playlist = Playlist(
        name=name,
        description=data.get("description"),
        color=color(data.get("color"), "#8b5cf6"),
        icon=data.get("icon", "📁"),
        kind=kind,
        counts_in_net_worth=bool(counts),
        opening_value=money(data.get("opening_value"), "opening_value", allow_negative=True, required=False) or 0,
        currency=currency,
        asset_type=asset_type,
        auto_source="loans" if data.get("auto_source") == "loans" else None,
    )
    db.session.add(playlist)
    db.session.commit()
    return jsonify(playlist.to_dict(total_in=0, total_out=0)), 201


@playlists_bp.put("/<int:playlist_id>")
def update_playlist(playlist_id):
    playlist = db.get_or_404(Playlist, playlist_id)
    data = request.get_json(silent=True) or {}

    if "name" in data:
        name = (data.get("name") or "").strip()
        if not name:
            return jsonify({"error": "O campo 'name' não pode ser vazio"}), 400
        playlist.name = name
    if "description" in data:
        playlist.description = data["description"]
    if "color" in data:
        playlist.color = color(data["color"], playlist.color)
    if "icon" in data:
        playlist.icon = data["icon"]
    if "kind" in data:
        if data["kind"] not in PLAYLIST_KINDS:
            return jsonify({"error": f"kind deve ser um de {PLAYLIST_KINDS}"}), 400
        playlist.kind = data["kind"]
    if "counts_in_net_worth" in data:
        playlist.counts_in_net_worth = bool(data["counts_in_net_worth"])
    if "opening_value" in data:
        # Na moeda da posição. Negativo é permitido: representa um passivo (dívida).
        playlist.opening_value = (
            money(data["opening_value"], "opening_value", allow_negative=True, required=False) or 0
        )
    if "currency" in data:
        if data["currency"] not in CURRENCIES:
            return jsonify({"error": f"currency deve ser uma de {CURRENCIES}"}), 400
        playlist.currency = data["currency"]
    if "asset_type" in data:
        novo_tipo = data["asset_type"] or DEFAULT_ASSET_TYPE
        if novo_tipo not in ASSET_TYPES:
            return jsonify({"error": f"asset_type deve ser um de {ASSET_TYPES}"}), 400
        playlist.asset_type = novo_tipo
    if "auto_source" in data:
        source = data["auto_source"] or None
        if source not in (None, "loans"):
            return jsonify({"error": "auto_source deve ser 'loans' ou vazio"}), 400
        playlist.auto_source = source

    db.session.commit()
    totals = get_playlist_totals()
    entry = totals.get(playlist_id, {})
    return jsonify(
        playlist.to_dict(
            total_in=entry.get("in", Decimal("0")), total_out=entry.get("out", Decimal("0"))
        )
    )


@playlists_bp.delete("/<int:playlist_id>")
def delete_playlist(playlist_id):
    from app.models.snapshot import SnapshotEntry

    playlist = db.get_or_404(Playlist, playlist_id)
    if SnapshotEntry.query.filter_by(playlist_id=playlist_id).first():
        return jsonify(
            {
                "error": "Esse item está nos registros de patrimônio — apagar mudaria o histórico. "
                "Para tirá-lo do total, desligue 'Contar no patrimônio' ou zere o valor."
            }
        ), 400
    Transaction.query.filter_by(playlist_id=playlist_id).update({"playlist_id": None})
    RecurringTransaction.query.filter_by(playlist_id=playlist_id).update({"playlist_id": None})
    db.session.delete(playlist)
    db.session.commit()
    return "", 204
