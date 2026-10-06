"""Fixtures dos testes.

Roda contra um SQLite temporário — os testes não tocam no banco real e não
precisam do Docker de pé.
"""

from datetime import date

import pytest

from app import create_app
from app.extensions import db as _db
from app.models.account import Account
from app.models.category import Category
from app.models.playlist import Playlist
from app.models.transaction import Transaction


@pytest.fixture
def app(tmp_path):
    application = create_app(
        {
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{tmp_path / 'test.db'}",
            "TESTING": True,
        }
    )
    with application.app_context():
        _db.create_all()
        yield application
        _db.session.remove()
        _db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


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
