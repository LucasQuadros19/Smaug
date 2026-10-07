"""Uma conta não vê, não altera e não aponta para os dados de outra."""

import pytest
from flask import g

from app.extensions import db
from app.models.account import Account
from app.models.transaction import Transaction
from app.models.user import User
from app.services import market_service

LISTAS = [
    "/api/accounts",
    "/api/categories",
    "/api/transactions",
    "/api/recurring",
    "/api/budgets?month=2026-10",
    "/api/playlists",
    "/api/expectations",
    "/api/shopping-items",
    "/api/loans",
    "/api/goals",
    "/api/sheets",
    "/api/snapshots",
    "/api/market",
    "/api/market/portfolio/history",
    "/api/dashboard/summary?month=2026-10",
    "/api/export/transacoes.csv",
    "/api/export/patrimonio.csv",
    "/api/export/emprestimos.csv",
]


def criar(client, url, body):
    response = client.post(url, json=body)
    assert response.status_code == 201, (url, response.get_data(as_text=True))
    return response.get_json()


def tudo_que_ve(client):
    return {url: client.get(url).get_data(as_text=True) for url in LISTAS}


@pytest.fixture
def ana(entrar, monkeypatch):
    """Uma conta com um registro de cada tipo, todos com "Ana" no nome."""
    monkeypatch.setattr(
        market_service,
        "resolve",
        lambda code, kind: {"code": code, "provider_id": code, "name": f"Papel da Ana {code}", "currency": "BRL"},
    )
    monkeypatch.setattr(market_service, "quotes", lambda symbols: {})

    client = entrar("ana")
    ids = {}
    ids["conta"] = criar(client, "/api/accounts", {"name": "Conta da Ana", "type": "checking", "initial_balance": 1000})["id"]
    ids["categoria"] = criar(client, "/api/categories", {"name": "Categoria da Ana", "type": "expense"})["id"]
    ids["ativo"] = criar(client, "/api/playlists", {"name": "Ativo da Ana", "kind": "asset", "opening_value": 500})["id"]
    ids["transacao"] = criar(
        client,
        "/api/transactions",
        {"description": "Gasto da Ana", "account_id": ids["conta"], "category_id": ids["categoria"],
         "amount": 10, "type": "expense", "date": "2026-10-01"},
    )["id"]
    ids["recorrente"] = criar(
        client,
        "/api/recurring",
        {"description": "Aluguel da Ana", "account_id": ids["conta"], "amount": 100, "type": "expense",
         "next_due_date": "2099-01-01"},
    )["id"]
    ids["orcamento"] = criar(client, "/api/budgets", {"category_id": ids["categoria"], "limit_amount": 100, "month": "2026-10"})["id"]
    ids["previsto"] = criar(
        client,
        "/api/expectations",
        {"playlist_id": ids["ativo"], "description": "Previsto da Ana", "amount": 50, "expected_date": "2099-01-01"},
    )["id"]
    ids["compra"] = criar(client, "/api/shopping-items", {"description": "Compra da Ana"})["id"]
    ids["emprestimo"] = criar(client, "/api/loans", {"borrower": "Devedor da Ana", "amount": 100, "start_date": "2026-10-01"})["id"]
    ids["recebimento"] = criar(
        client,
        f"/api/loans/{ids['emprestimo']}/repayments",
        {"account_id": ids["conta"], "amount": 40, "my_share": 30, "partners_share": 10},
    )["repayments"][0]["id"]
    ids["meta"] = criar(client, "/api/goals", {"name": "Meta da Ana", "target_amount": 1000})["id"]
    ids["folha"] = criar(client, "/api/sheets", {"title": "Folha da Ana", "content": "1+1"})["id"]
    ids["registro"] = criar(client, "/api/snapshots", {"date": "2026-10-01", "entries": [{"account_id": ids["conta"], "value": 1000}]})["id"]
    ids["codigo"] = criar(client, "/api/market/symbols", {"code": "ANA3", "kind": "stock"})["id"]
    ids["operacao"] = criar(client, "/api/market/trades", {"symbol_id": ids["codigo"], "side": "buy", "quantity": 1, "price": 10})["id"]
    return client, ids


def test_nao_ve_nada_da_outra_conta(ana, entrar):
    bia = entrar("bia")
    for url, body in tudo_que_ve(bia).items():
        assert "Ana" not in body, url
    resumo = bia.get("/api/dashboard/summary").get_json()
    assert resumo["total_balance"] == 0 and resumo["net_worth"] == 0


def test_nao_abre_altera_nem_apaga_o_que_e_da_outra_conta(ana, entrar):
    client_ana, ids = ana
    antes = tudo_que_ve(client_ana)
    bia = entrar("bia")
    emprestimo = f"/api/loans/{ids['emprestimo']}"
    pedidos = [
        ("put", f"/api/accounts/{ids['conta']}", {"name": "x"}),
        ("delete", f"/api/accounts/{ids['conta']}", None),
        ("put", f"/api/categories/{ids['categoria']}", {"name": "x"}),
        ("delete", f"/api/categories/{ids['categoria']}", None),
        ("put", f"/api/transactions/{ids['transacao']}", {"amount": 1}),
        ("delete", f"/api/transactions/{ids['transacao']}", None),
        ("put", f"/api/recurring/{ids['recorrente']}", {"amount": 1}),
        ("post", f"/api/recurring/{ids['recorrente']}/launch", {}),
        ("post", f"/api/recurring/{ids['recorrente']}/postpone", {"until": None}),
        ("delete", f"/api/recurring/{ids['recorrente']}", None),
        ("put", f"/api/budgets/{ids['orcamento']}", {"limit_amount": 1}),
        ("delete", f"/api/budgets/{ids['orcamento']}", None),
        ("get", f"/api/playlists/{ids['ativo']}", None),
        ("get", f"/api/playlists/{ids['ativo']}/history", None),
        ("put", f"/api/playlists/{ids['ativo']}", {"name": "x"}),
        ("delete", f"/api/playlists/{ids['ativo']}", None),
        ("put", f"/api/expectations/{ids['previsto']}", {"amount": 1}),
        ("post", f"/api/expectations/{ids['previsto']}/launch", {}),
        ("delete", f"/api/expectations/{ids['previsto']}", None),
        ("put", f"/api/shopping-items/{ids['compra']}", {"purchased": True}),
        ("delete", f"/api/shopping-items/{ids['compra']}", None),
        ("put", emprestimo, {"borrower": "x"}),
        ("post", f"{emprestimo}/repayments", {"account_id": ids["conta"], "amount": 1}),
        ("post", f"{emprestimo}/repayments/{ids['recebimento']}/settle-partners", {}),
        ("delete", f"{emprestimo}/repayments/{ids['recebimento']}", None),
        ("delete", emprestimo, None),
        ("put", f"/api/goals/{ids['meta']}", {"name": "x"}),
        ("delete", f"/api/goals/{ids['meta']}", None),
        ("put", f"/api/sheets/{ids['folha']}", {"content": "x"}),
        ("delete", f"/api/sheets/{ids['folha']}", None),
        ("delete", f"/api/snapshots/{ids['registro']}", None),
        ("get", f"/api/market/symbols/{ids['codigo']}/history", None),
        ("delete", f"/api/market/trades/{ids['operacao']}", None),
        ("delete", f"/api/market/symbols/{ids['codigo']}", None),
    ]
    for method, url, body in pedidos:
        response = getattr(bia, method)(url, **({} if body is None else {"json": body}))
        assert response.status_code == 404, (method, url, response.status_code)

    assert tudo_que_ve(client_ana) == antes


def test_nao_aponta_para_registro_da_outra_conta(ana, entrar):
    client_ana, ids = ana
    antes = tudo_que_ve(client_ana)
    bia = entrar("bia")
    conta = criar(bia, "/api/accounts", {"name": "Conta da Bia", "type": "checking", "initial_balance": 100})["id"]
    ativo = criar(bia, "/api/playlists", {"name": "Ativo da Bia", "kind": "asset", "opening_value": 100})["id"]
    codigo = criar(bia, "/api/market/symbols", {"code": "BIA3", "kind": "stock"})["id"]
    previsto = criar(
        bia, "/api/expectations", {"playlist_id": ativo, "description": "x", "amount": 1, "expected_date": "2099-01-01"}
    )["id"]
    emprestimo = criar(bia, "/api/loans", {"borrower": "x", "amount": 100, "start_date": "2026-10-01"})["id"]
    recebimento = criar(
        bia, f"/api/loans/{emprestimo}/repayments", {"account_id": conta, "amount": 40, "my_share": 30, "partners_share": 10}
    )["repayments"][0]["id"]
    tx = {"description": "x", "account_id": conta, "amount": 1, "type": "expense", "date": "2026-10-01"}
    minha_tx = criar(bia, "/api/transactions", tx)["id"]
    ja_tinha = tudo_que_ve(bia)

    pedidos = [
        ("post", "/api/transactions", {**tx, "account_id": ids["conta"]}),
        ("post", "/api/transactions", {**tx, "category_id": ids["categoria"]}),
        ("post", "/api/transactions", {**tx, "playlist_id": ids["ativo"]}),
        ("put", f"/api/transactions/{minha_tx}", {"account_id": ids["conta"]}),
        ("put", f"/api/transactions/{minha_tx}", {"category_id": ids["categoria"]}),
        ("put", f"/api/transactions/{minha_tx}", {"playlist_id": ids["ativo"]}),
        ("post", "/api/recurring", {**tx, "next_due_date": "2099-01-01", "category_id": ids["categoria"]}),
        ("post", "/api/recurring", {**tx, "next_due_date": "2099-01-01", "playlist_id": ids["ativo"]}),
        ("post", "/api/budgets", {"category_id": ids["categoria"], "limit_amount": 1, "month": "2026-10"}),
        ("post", "/api/goals", {"name": "x", "target_amount": 1, "playlist_id": ids["ativo"]}),
        ("post", "/api/expectations", {"playlist_id": ids["ativo"], "description": "x", "amount": 1, "expected_date": "2099-01-01"}),
        ("post", f"/api/expectations/{previsto}/launch", {"account_id": ids["conta"]}),
        ("post", f"/api/expectations/{previsto}/launch", {"account_id": conta, "category_id": ids["categoria"]}),
        ("post", "/api/shopping-items", {"description": "x", "playlist_id": ids["ativo"]}),
        ("post", "/api/market/trades", {"symbol_id": ids["codigo"], "side": "buy", "quantity": 1, "price": 1}),
        ("post", "/api/market/trades", {"symbol_id": codigo, "side": "buy", "quantity": 1, "price": 1, "account_id": ids["conta"]}),
        ("post", f"/api/loans/{emprestimo}/repayments", {"account_id": ids["conta"], "amount": 1}),
        ("post", f"/api/loans/{emprestimo}/repayments/{recebimento}/settle-partners", {"account_id": ids["conta"]}),
        ("post", "/api/snapshots", {"date": "2026-10-01", "entries": [{"account_id": ids["conta"], "value": 1}]}),
        ("post", "/api/snapshots", {"date": "2026-10-01", "entries": [{"playlist_id": ids["ativo"], "value": 1}]}),
        ("post", "/api/snapshots/transfer", {"from": {"type": "account", "id": conta}, "to": {"type": "account", "id": ids["conta"]}, "amount": 1}),
        ("post", "/api/snapshots/settle", {"from": {"type": "playlist", "id": ids["ativo"]}, "to_account_id": conta, "received": 1}),
        ("post", "/api/snapshots/settle", {"from": {"type": "playlist", "id": ativo}, "to_account_id": ids["conta"], "received": 1}),
        ("post", "/api/snapshots/invest", {"to": {"type": "playlist", "id": ids["ativo"]}, "from_account_id": conta, "amount": 1}),
        ("post", "/api/snapshots/invest", {"to": {"type": "playlist", "id": ativo}, "from_account_id": ids["conta"], "amount": 1}),
    ]
    for method, url, body in pedidos:
        response = getattr(bia, method)(url, json=body)
        assert response.status_code in (400, 404), (method, url, response.status_code, response.get_data(as_text=True))

    assert tudo_que_ve(bia) == ja_tinha
    assert tudo_que_ve(client_ana) == antes


def test_update_e_delete_em_massa_so_alcancam_as_proprias_linhas(ana, entrar, app_limpo):
    entrar("bia")
    with app_limpo.test_request_context():
        g.owner_id = User.query.filter_by(username="bia").one().id
        assert Account.query.update({"name": "x"}) == 0
        assert Transaction.query.delete() == 0
        db.session.rollback()
