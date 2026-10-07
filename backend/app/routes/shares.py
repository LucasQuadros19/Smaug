"""Compartilhamento entre contas.

Para abrir os dados de outra conta, a tela manda o id dela no cabeçalho
`X-Owner` (ou em `?owner=`, nos links de download). Só vale com a ligação
aceita e só nas partes que o dono mostra;
aí as consultas passam a enxergar e gravar os dados dele (ver `app.tenancy`).
"""

import uuid

from flask import Blueprint, abort, g, jsonify, request
from sqlalchemy import and_, or_
from sqlalchemy.orm import joinedload
from werkzeug.exceptions import BadRequest

from app.extensions import db, utcnow
from app.models.share import SECTIONS, Share
from app.models.user import User

shares_bp = Blueprint("shares", __name__)

# A parte de cada rota. Rota fora daqui não abre dados de outra conta.
_SECTION_BY_BLUEPRINT = {
    "accounts": "contas",
    "categories": "contas",
    "transactions": "contas",
    "recurring": "contas",
    "budgets": "contas",
    "shopping_items": "contas",
    "playlists": "patrimonio",
    "expectations": "patrimonio",
    "snapshots": "patrimonio",
    "goals": "patrimonio",
    "loans": "emprestimos",
    "market": "mercado",
    "sheets": "calculos",
}
_SECTION_BY_ENDPOINT = {
    "export.export_transactions": "contas",
    "export.export_snapshots": "patrimonio",
    "export.export_loans": "emprestimos",
}
# Sempre sobre a própria conta, mesmo vendo os dados de outra.
_OWN_ACCOUNT_BLUEPRINTS = {"auth", "shares"}
# Cotações: não são dados de ninguém.
_PUBLIC_ENDPOINTS = {"rates"}
# Listas que os formulários usam; sem a parte delas saem só com nome (ver `limited_view`).
_FORM_LISTS = {"accounts.list_accounts", "categories.list_categories", "playlists.list_playlists"}


def _no_access():
    return jsonify({"error": "Essa parte não está compartilhada com você"}), 403


def apply_shared_view():
    """Depois do login: se a tela pediu os dados de outra conta, confere e troca o dono."""
    raw = request.headers.get("X-Owner") or request.args.get("owner")
    if not raw or raw == str(g.user.id) or request.blueprint in _OWN_ACCOUNT_BLUEPRINTS:
        return None
    try:
        owner_id = uuid.UUID(raw)
    except ValueError:
        return _no_access()

    share = Share.query.filter(
        Share.accepted_at.isnot(None),
        or_(
            and_(Share.inviter_id == owner_id, Share.invitee_id == g.user.id),
            and_(Share.invitee_id == owner_id, Share.inviter_id == g.user.id),
        ),
    ).first()
    sections = set(share.sections_of(owner_id)) if share else set()
    if not sections:
        return _no_access()

    g.owner_id = owner_id
    g.sections = sections
    if request.endpoint in _PUBLIC_ENDPOINTS or (request.method == "GET" and request.endpoint in _FORM_LISTS):
        return None
    if request.blueprint == "dashboard":
        needed = set(SECTIONS)
    else:
        section = _SECTION_BY_ENDPOINT.get(request.endpoint) or _SECTION_BY_BLUEPRINT.get(request.blueprint)
        needed = {section} if section else None
    if needed is None or not needed <= sections:
        return _no_access()
    return None


def limited_view(*sections):
    """Vendo outra conta sem nenhuma destas partes: a lista vai só com nomes, sem valores."""
    return g.sections is not None and not g.sections.intersection(sections)


def _sections(data):
    sections = data.get("sections")
    if not isinstance(sections, list) or not all(isinstance(s, str) and s in SECTIONS for s in sections):
        raise BadRequest(f"Escolha entre {', '.join(SECTIONS)}")
    return [s for s in SECTIONS if s in sections]


def _mine(share_id):
    share = Share.query.filter(
        Share.id == share_id, or_(Share.inviter_id == g.user.id, Share.invitee_id == g.user.id)
    ).first()
    if share is None:
        abort(404)
    return share


@shares_bp.get("")
def list_shares():
    shares = (
        Share.query.options(joinedload(Share.inviter), joinedload(Share.invitee))
        .filter(or_(Share.inviter_id == g.user.id, Share.invitee_id == g.user.id))
        .order_by(Share.created_at, Share.id)
        .all()
    )
    return jsonify([share.to_dict(g.user.id) for share in shares])


@shares_bp.post("")
def invite():
    data = request.get_json(silent=True) or {}
    sections = _sections(data)
    try:
        other_id = uuid.UUID(str(data.get("user_id") or "").strip())
    except ValueError:
        return jsonify({"error": "Código inválido"}), 400
    if other_id == g.user.id:
        return jsonify({"error": "Esse é o seu próprio código"}), 400
    if db.session.get(User, other_id) is None:
        return jsonify({"error": "Nenhuma conta com esse código"}), 404
    existing = Share.query.filter(
        or_(
            and_(Share.inviter_id == g.user.id, Share.invitee_id == other_id),
            and_(Share.inviter_id == other_id, Share.invitee_id == g.user.id),
        )
    ).first()
    if existing:
        return jsonify({"error": "Vocês já têm um compartilhamento — veja na lista"}), 409

    share = Share(inviter_id=g.user.id, invitee_id=other_id, inviter_sections=sections)
    db.session.add(share)
    db.session.commit()
    return jsonify(share.to_dict(g.user.id)), 201


@shares_bp.post("/<int:share_id>/accept")
def accept(share_id):
    share = _mine(share_id)
    if share.invitee_id != g.user.id or share.accepted_at:
        return jsonify({"error": "Esse convite não espera resposta sua"}), 400
    share.invitee_sections = _sections(request.get_json(silent=True) or {})
    share.accepted_at = utcnow()
    db.session.commit()
    return jsonify(share.to_dict(g.user.id))


@shares_bp.put("/<int:share_id>")
def update_sections(share_id):
    """Cada lado muda só o que ele mesmo mostra."""
    share = _mine(share_id)
    if share.invitee_id == g.user.id and not share.accepted_at:
        return jsonify({"error": "Aceite o convite primeiro"}), 400
    share.set_sections_of(g.user.id, _sections(request.get_json(silent=True) or {}))
    db.session.commit()
    return jsonify(share.to_dict(g.user.id))


@shares_bp.delete("/<int:share_id>")
def end(share_id):
    """Recusar, cancelar ou encerrar: qualquer um dos dois lados pode."""
    db.session.delete(_mine(share_id))
    db.session.commit()
    return "", 204
