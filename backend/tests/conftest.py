"""Fixtures dos testes.

Roda contra um SQLite temporário — os testes não tocam no banco real e não
precisam do Docker de pé. O `client` já entra logado como o usuário "dono".
"""

from datetime import date

import pytest
from flask import has_request_context
from sqlalchemy import event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session

from app import create_app
from app.extensions import db as _db
from app.models.account import Account
from app.models.category import Category
from app.models.playlist import Playlist
from app.models.transaction import Transaction
from app.models.user import User
from app.tenancy import Owned

SECRET = "chave-so-para-os-testes-" + "x" * 16
_dono = None


@event.listens_for(Engine, "connect")
def _foreign_keys_on(dbapi_connection, _record):
    """O SQLite ignora chave estrangeira por padrão; o Postgres não."""
    if type(dbapi_connection).__module__.startswith("sqlite3"):
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


@event.listens_for(Session, "before_flush")
def _dono_dos_dados_de_teste(session, _context, _instances):
    """O que o teste cria direto no banco é do usuário logado no `client`."""
    if _dono is None or has_request_context():
        return
    for obj in session.new:
        if isinstance(obj, Owned) and obj.user_id is None:
            obj.user_id = _dono


def new_app(tmp_path, **config):
    return create_app(
        {
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
            "TESTING": True,
            "SECRET_KEY": SECRET,
            **config,
        }
    )


@pytest.fixture
def app(tmp_path):
    global _dono
    application = new_app(tmp_path)
    with application.app_context():
        _db.create_all()
        dono = User(username="dono", password_hash="!")
        _db.session.add(dono)
        _db.session.commit()
        _dono = dono.id
        yield application
        _dono = None
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    test_client = app.test_client()
    with test_client.session_transaction() as session:
        session["uid"] = str(_dono)
    return test_client


@pytest.fixture
def app_limpo(tmp_path):
    """Sem usuário pronto e sem app context aberto: cada requisição tem a própria
    sessão do banco, como em produção — nada passa de um usuário para outro em cache."""
    application = new_app(tmp_path)
    with application.app_context():
        _db.create_all()
    yield application
    with application.app_context():
        _db.drop_all()


SENHA = "senha-forte-123"


@pytest.fixture
def entrar(app_limpo):
    """Cria a conta e devolve um client logado nela."""

    def _entrar(nome):
        test_client = app_limpo.test_client()
        response = test_client.post("/api/auth/signup", json={"username": nome, "password": SENHA})
        assert response.status_code == 201, response.get_data(as_text=True)
        return test_client

    return _entrar


@pytest.fixture
def db(app):  # noqa: ARG001 - fixture de ordenação: garante o app antes do banco
    return _db


# ---------------------------------------------------------------- helpers


@pytest.fixture
def make_account(db):
    def _make(name="Dinheiro", initial=0):
        account = Account(name=name, type="cash", initial_balance=initial)
        db.session.add(account)
        db.session.commit()
        return account

    return _make


@pytest.fixture
def make_position(db):
    def _make(name="obra", opening=0, counts=True, kind="asset", auto_source=None,
              asset_type="investment"):
        playlist = Playlist(
            name=name,
            kind=kind,
            counts_in_net_worth=counts,
            opening_value=opening,
            auto_source=auto_source,
            asset_type=asset_type,
        )
        db.session.add(playlist)
        db.session.commit()
        return playlist

    return _make


@pytest.fixture
def make_category(db):
    def _make(name="Alimentação", type_="expense"):
        category = Category(name=name, type=type_)
        db.session.add(category)
        db.session.commit()
        return category

    return _make


@pytest.fixture
def make_transaction(db):
    def _make(account, amount, type_="expense", playlist=None, category=None, when=None):
        transaction = Transaction(
            account_id=account.id,
            playlist_id=playlist.id if playlist else None,
            category_id=category.id if category else None,
            description="teste",
            amount=amount,
            type=type_,
            date=when or date.today(),
        )
        db.session.add(transaction)
        db.session.commit()
        return transaction

    return _make


@pytest.fixture
def summary(client):
    """Atalho para o resumo do dashboard."""

    def _get(**params):
        query = "&".join(f"{k}={v}" for k, v in params.items())
        response = client.get(f"/api/dashboard/summary{'?' + query if query else ''}")
        assert response.status_code == 200, response.get_data(as_text=True)
        return response.get_json()

    return _get
