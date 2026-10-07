"""Contas: cadastro, login, senha e preferências.

A sessão é o cookie assinado do Flask (HttpOnly, SameSite=Lax) e guarda o id e
a versão da sessão do usuário — trocar a senha muda a versão e derruba os outros aparelhos.
"""

import re
import threading
import time
import uuid

from flask import Blueprint, current_app, g, jsonify, request, session
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash, generate_password_hash

from app.extensions import db
from app.models.category import DEFAULT_CATEGORIES, Category
from app.models.user import User
from app.routes.shares import apply_shared_view
from app.tenancy import claim_orphans

auth_bp = Blueprint("auth", __name__)

PUBLIC_ENDPOINTS = {"auth.login", "auth.signup"}
DEFAULT_HIDDEN_TABS = ["/bot", "/mercado"]
MAX_FAILURES = 5
LOCK_SECONDS = 15 * 60

_USERNAME = re.compile(r"[a-z0-9._-]{3,30}")
_TAB = re.compile(r"/[a-z-]{1,30}")
_failures_lock = threading.Lock()


def load_user():
    """Antes de toda requisição: quem está logado e de quem são os dados.

    `g.user` é quem está logado; `g.owner_id` é o dono dos dados que a requisição
    alcança — o próprio usuário, ou quem compartilhou com ele (`g.sections` diz o quê).
    """
    g.user = None
    g.owner_id = None
    g.sections = None
    raw = session.get("uid")
    if raw:
        try:
            g.user = db.session.get(User, uuid.UUID(raw))
        except ValueError:
            pass
        if g.user is not None and session.get("sv", 0) != g.user.session_version:
            g.user = None
        if g.user is None:
            session.clear()
    if g.user is None:
        if request.path.startswith("/api/") and request.endpoint not in PUBLIC_ENDPOINTS:
            return jsonify({"error": "Faça login para continuar"}), 401
        return None
    g.owner_id = g.user.id
    return apply_shared_view()


def _username(value):
    return str(value or "").strip().lower()


def _valid_password(value):
    return isinstance(value, str) and 8 <= len(value) <= 128


def _start_session(user):
    session.clear()
    session["uid"] = str(user.id)
    session["sv"] = user.session_version
    session.permanent = True


# ponytail: tentativas contadas em memória, por processo; com mais de um worker do gunicorn, guardar no banco
def _recent_failures(user_id, add=False):
    failures = current_app.extensions.setdefault("login_failures", {})
    now = time.monotonic()
    with _failures_lock:
        recent = [t for t in failures.get(user_id, []) if now - t < LOCK_SECONDS]
        if add:
            recent.append(now)
        failures[user_id] = recent
        return len(recent)


@auth_bp.post("/signup")
def signup():
    data = request.get_json(silent=True) or {}
    username = _username(data.get("username"))
    password = data.get("password")
    if not _USERNAME.fullmatch(username):
        return jsonify({"error": "O usuário precisa ter de 3 a 30 letras, números, ponto, hífen ou _"}), 400
    if not _valid_password(password):
        return jsonify({"error": "A senha precisa ter de 8 a 128 caracteres"}), 400

    # A primeira conta fica com os dados que já existiam antes de haver contas.
    first = db.session.query(User.id).first() is None
    user = User(
        username=username,
        password_hash=generate_password_hash(password),
        hidden_tabs=[] if first else list(DEFAULT_HIDDEN_TABS),
    )
    db.session.add(user)
    try:
        db.session.flush()
    except IntegrityError:
        db.session.rollback()
        return jsonify({"error": "Esse usuário já existe"}), 409

    g.owner_id = user.id
    if first:
        claim_orphans(user.id)
    if Category.query.first() is None:
        db.session.add_all(Category(**category) for category in DEFAULT_CATEGORIES)
    db.session.commit()
    _start_session(user)
    return jsonify(user.to_dict()), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    username = _username(data.get("username"))
    password = data.get("password")
    user = User.query.filter_by(username=username).first() if _USERNAME.fullmatch(username) else None

    if user is not None and _recent_failures(user.id) >= MAX_FAILURES:
        return jsonify({"error": "Muitas tentativas erradas. Espere 15 minutos e tente de novo."}), 429
    if user is None or not isinstance(password, str) or not check_password_hash(user.password_hash, password):
        if user is not None:
            _recent_failures(user.id, add=True)
        return jsonify({"error": "Usuário ou senha incorretos"}), 401

    current_app.extensions["login_failures"].pop(user.id, None)
    _start_session(user)
    return jsonify(user.to_dict())


@auth_bp.post("/logout")
def logout():
    session.clear()
    return "", 204


@auth_bp.post("/password")
def change_password():
    """Troca a senha; este aparelho continua logado e os outros saem."""
    data = request.get_json(silent=True) or {}
    current, new = data.get("current"), data.get("new")
    if _recent_failures(g.user.id) >= MAX_FAILURES:
        return jsonify({"error": "Muitas tentativas erradas. Espere 15 minutos e tente de novo."}), 429
    # 400, não 401: a tela trata 401 como sessão expirada e desloga.
    if not isinstance(current, str) or not check_password_hash(g.user.password_hash, current):
        _recent_failures(g.user.id, add=True)
        return jsonify({"error": "A senha atual não confere"}), 400
    if not _valid_password(new):
        return jsonify({"error": "A nova senha precisa ter de 8 a 128 caracteres"}), 400

    g.user.password_hash = generate_password_hash(new)
    g.user.session_version += 1
    db.session.commit()
    _start_session(g.user)
    return "", 204


@auth_bp.get("/me")
def me():
    return jsonify(g.user.to_dict())


@auth_bp.put("/me")
def update_me():
    data = request.get_json(silent=True) or {}
    if "hidden_tabs" in data:
        tabs = data["hidden_tabs"]
        if (
            not isinstance(tabs, list)
            or len(tabs) > 40
            or not all(isinstance(tab, str) and _TAB.fullmatch(tab) for tab in tabs)
        ):
            return jsonify({"error": "Lista de abas inválida"}), 400
        g.user.hidden_tabs = sorted(set(tabs))
    db.session.commit()
    return jsonify(g.user.to_dict())
