"""Tudo ligado: Mercado no patrimônio (sempre pela cotação), saída do empréstimo,
lista de compras e previsões no caixa, e os padrões de mercado."""

import pytest

from app.models.market import MarketSymbol
from app.services import market_service, rates


@pytest.fixture
def cotacoes(monkeypatch, tmp_path, app):
    """Sem internet: dólar a R$ 5, WEGE3 a R$ 40 e AAPL a US$ 200. `precos` muda o preço no teste."""
    dolar = {"USD": {"rate": "5", "updated_at": "agora"}}
    monkeypatch.setattr(rates, "_fetch", lambda: dolar)
    monkeypatch.setattr(rates, "_cache", {"at": float("-inf"), "rates": {}})
    app.instance_path = str(tmp_path)
    precos = {"WEGE3.SA": 40, "AAPL": 200}
    monkeypatch.setattr(
        market_service, "quotes", lambda symbols: {s.id: {"price": precos[s.provider_id]} for s in symbols}
    )
    return precos, dolar


@pytest.fixture
def weg(db, cotacoes):
    symbol = MarketSymbol(code="WEGE3", kind="stock", provider_id="WEGE3.SA", name="WEG", currency="BRL")
    db.session.add(symbol)
    db.session.commit()
    return symbol


def _ativo(client, nome="Ações", **extra):
    response = client.post("/api/playlists", json={"name": nome, "kind": "asset", **extra})
    assert response.status_code == 201, response.get_data(as_text=True)
    return response.get_json()


def _trade(client, symbol, side="buy", qty=10, price=30, date="2026-10-01", **extra):
    return client.post(
        "/api/market/trades",
        json={"symbol_id": symbol.id, "side": side, "quantity": qty, "price": price, "date": date, **extra},
    )


# --- padrões de mercado ----------------------------------------------------


def test_padroes_vem_preenchidos_e_so_o_que_muda_e_guardado(client):
    settings = client.get("/api/auth/me").get_json()["settings"]
    assert settings["late_fine"] == 2 and settings["late_interest"] == 1 and settings["loan_rate"] == 4

    response = client.put("/api/auth/me", json={"settings": {"loan_rate": 6.5, "grace_days": 3}})
    assert response.status_code == 200
    settings = response.get_json()["settings"]
    assert settings["loan_rate"] == 6.5 and settings["grace_days"] == 3 and settings["late_fine"] == 2


@pytest.mark.parametrize(
    "patch",
    [
        {"inventado": 1}, {"late_fine": -1}, {"loan_months": 1.5}, {"business_days": 1}, {"loan_schedule": "anual"},
        {"stock_tax": "15"}, [], {"theme": "azul"}, {"start_page": "https://fora.com"}, {"hide_values": "sim"},
    ],
)
def test_padrao_invalido_e_recusado(client, patch):
    assert client.put("/api/auth/me", json={"settings": patch}).status_code == 400


def test_padroes_do_sistema(client):
    settings = client.get("/api/auth/me").get_json()["settings"]
    assert (settings["theme"], settings["hide_values"], settings["start_page"], settings["week_starts_monday"]) == ("dark", False, "/", False)
    assert (settings["show_goals"], settings["show_category_breakdown"]) == (False, False)
    patch = {"theme": "system", "hide_values": True, "start_page": "/emprestimos", "week_starts_monday": True}
    assert client.put("/api/auth/me", json={"settings": patch}).get_json()["settings"] | patch == client.get("/api/auth/me").get_json()["settings"]


# --- Mercado no patrimônio ----------------------------------------------------


def test_mercado_entra_sozinho_no_patrimonio_e_compra_nao_e_gasto(client, weg, make_account, summary):
    conta = make_account(initial=1_000)
    assert _trade(client, weg, account_id=conta.id, fees=1).status_code == 201

    data = summary(month="2026-10")
    assert data["month_expense"] == 0
    assert data["total_balance"] == 699  # 10 × 30 + 1 de taxa
    mercado = [p for p in data["playlists_summary"] if p["auto_source"] == "market"]
    assert len(mercado) == 1 and mercado[0]["outstanding"] == 400  # 10 × R$ 40 de agora
    assert data["net_worth"] == 1_099


def test_valor_acompanha_a_cotacao(client, weg, cotacoes, summary):
    precos, _ = cotacoes
    _trade(client, weg)
    antes = summary()["net_worth"]
    precos["WEGE3.SA"] = 90
    assert summary()["net_worth"] == antes + 500  # 10 × (90 − 40)


def test_sem_cotacao_vale_o_que_foi_pago(client, weg, monkeypatch, summary):
    _trade(client, weg, fees=1)
    monkeypatch.setattr(market_service, "quotes", lambda symbols: {})
    mercado = next(p for p in summary()["playlists_summary"] if p["auto_source"] == "market")
    assert mercado["outstanding"] == 301


def test_uma_posicao_mercado_so(client, db, cotacoes):
    from app.models.market import MarketSymbol as Symbol

    for code, provider, currency in (("WEGE3", "WEGE3.SA", "BRL"), ("AAPL", "AAPL", "USD")):
        db.session.add(Symbol(code=code, kind="stock", provider_id=provider, name=code, currency=currency))
    db.session.commit()
    for symbol in Symbol.query.all():
        _trade(client, symbol, price=1)
    assert len([p for p in client.get("/api/playlists").get_json() if p["auto_source"] == "market"]) == 1


def test_nao_vende_antes_de_comprar_nem_apaga_compra_ja_vendida(client, weg):
    _trade(client, weg, date="2026-10-05")
    assert _trade(client, weg, side="sell", qty=5, date="2026-10-01").status_code == 400
    assert _trade(client, weg, side="sell", qty=5, date="2026-10-06").status_code == 201

    compra = next(t for t in client.get("/api/market").get_json()["symbols"][0]["trades"] if t["side"] == "buy")
    assert client.delete(f"/api/market/trades/{compra['id']}").status_code == 400


def test_ir_estimado_do_mes(client, weg):
    from datetime import date

    hoje = date.today().isoformat()
    client.put("/api/auth/me", json={"settings": {"stock_exempt": 100}})
    _trade(client, weg, qty=10, price=30, date=hoje)
    _trade(client, weg, side="sell", qty=10, price=40, date=hoje)  # vende R$ 400, lucro R$ 100

    tax = client.get("/api/market").get_json()["tax"]["stock"]
    assert tax["sales"] == 400 and tax["realized"] == 100 and tax["tax"] == 15


# --- saída do empréstimo ------------------------------------------------------


def _emprestimo(client, conta, **extra):
    return client.post(
        "/api/loans",
        json={
            "borrower": "Carlos",
            "amount": 1_000,
            "start_date": "2026-10-02",
            "participants": [{"name": "Eu", "contributed": 1_000, "gain": 100, "is_me": True}],
            "outflow": {"account_id": conta.id, "amount": 1_000},
            **extra,
        },
    ).get_json()


def test_saida_do_emprestimo_ligado_nao_e_gasto(client, make_account, make_position, summary):
    conta = make_account(initial=5_000)
    make_position(name="Empréstimos", auto_source="loans", asset_type="loan")
    loan = _emprestimo(client, conta)
    assert loan["outflow"] == {"account_id": conta.id, "amount": 1_000, "date": "2026-10-02"}

    data = summary(month="2026-10")
    assert data["total_balance"] == 4_000
    assert data["net_worth"] == 5_000  # o dinheiro só foi para a rua
    assert data["month_expense"] == 0


def test_saida_sem_posicao_ligada_conta_como_gasto(client, make_account, summary):
    conta = make_account(initial=5_000)
    _emprestimo(client, conta)
    assert summary(month="2026-10")["month_expense"] == 1_000


def test_saida_muda_pelo_emprestimo_e_some_com_ele(client, make_account, summary):
    conta = make_account(initial=5_000)
    loan = _emprestimo(client, conta)
    tx = client.get("/api/transactions").get_json()["items"][0]
    assert client.put(f"/api/transactions/{tx['id']}", json={"amount": 10}).status_code == 400

    client.put(f"/api/loans/{loan['id']}", json={"outflow": {"account_id": conta.id, "amount": 800}})
    assert summary()["total_balance"] == 4_200
    client.put(f"/api/loans/{loan['id']}", json={"outflow": None})
    assert summary()["total_balance"] == 5_000

    loan = _emprestimo(client, conta)
    client.delete(f"/api/loans/{loan['id']}")
    assert summary()["total_balance"] == 5_000


# --- previsões e lista de compras ----------------------------------------------


@pytest.fixture
def previsao(client, make_account, make_position):
    conta = make_account()
    ativo = make_position(name="Apartamento", asset_type="property")
    item = client.post(
        "/api/expectations",
        json={"playlist_id": ativo.id, "description": "Aluguel", "amount": 2_000, "expected_date": "2026-10-10", "account_id": conta.id},
    ).get_json()
    return conta, item


def _lancar(client, item, **body):
    response = client.post(f"/api/expectations/{item['id']}/launch", json={"date": "2026-10-10", **body})
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.get_json()["expectation"]


def test_lancar_e_esperar_de_novo(client, previsao):
    _, item = previsao
    item = _lancar(client, item, then="next", next_date="2026-11-10")
    assert item["expected_date"] == "2026-11-10" and item["status"] == "pending"


def test_lancar_e_encerrar(client, previsao):
    _, item = previsao
    assert _lancar(client, item, then="close")["status"] == "received"


def test_chegou_so_parte(client, previsao):
    _, item = previsao
    item = _lancar(client, item, amount=1_500, then="partial")
    assert item["amount"] == 500 and item["status"] == "pending"
    item = _lancar(client, item, amount=500, then="partial")
    assert item["status"] == "received"


def test_proxima_data_e_obrigatoria_para_esperar_de_novo(client, previsao):
    _, item = previsao
    assert client.post(f"/api/expectations/{item['id']}/launch", json={"then": "next"}).status_code == 400


def test_comprei_lanca_no_caixa_e_desmarcar_desfaz(client, make_account, summary):
    conta = make_account(initial=500)
    item = client.post("/api/shopping-items", json={"description": "Tênis", "amount": 300}).get_json()

    marcado = client.put(
        f"/api/shopping-items/{item['id']}",
        json={"purchased": True, "launch": {"account_id": conta.id, "amount": 280}},
    ).get_json()
    assert marcado["transaction_id"] and marcado["amount"] == 280
    assert summary()["total_balance"] == 220

    client.put(f"/api/shopping-items/{item['id']}", json={"purchased": False})
    assert summary()["total_balance"] == 500


# --- patrimônio ----------------------------------------------------------------


def test_registro_so_soma_o_que_conta_no_patrimonio(client, make_account, make_position):
    conta = make_account()
    dentro = make_position(name="Obra", opening=1_000)
    fora = make_position(name="Coleção", opening=500, counts=False)
    registro = client.post(
        "/api/snapshots",
        json={"date": "2026-10-01", "entries": [
            {"playlist_id": dentro.id, "value": 1_000},
            {"playlist_id": fora.id, "value": 500},
            {"account_id": conta.id, "value": 100},
        ]},
    ).get_json()
    assert registro["positions"][str(fora.id)] == 500  # aparece na linha
    assert registro["net_worth"] == 1_100  # mas fica fora do total


def test_transferencia_grava_o_valor_da_posicao_ligada(client, make_account, make_position):
    conta = make_account(initial=2_000)
    obra = make_position(name="Obra", opening=0)
    loans = make_position(name="Empréstimos", auto_source="loans", asset_type="loan")
    _emprestimo(client, conta)

    registro = client.post(
        "/api/snapshots/transfer",
        json={"from": {"type": "account", "id": conta.id}, "to": {"type": "playlist", "id": obra.id}, "amount": 500},
    ).get_json()
    assert registro["positions"][str(loans.id)] == 1_000  # antes gravava 0

    erro = client.post(
        "/api/snapshots/transfer",
        json={"from": {"type": "playlist", "id": loans.id}, "to": {"type": "account", "id": conta.id}, "amount": 100},
    )
    assert erro.status_code == 400


def test_grafico_sem_registros_usa_o_valor_da_posicao_ligada(client, make_account, make_position, summary):
    conta = make_account(initial=5_000)
    make_position(name="Empréstimos", auto_source="loans", asset_type="loan")
    _emprestimo(client, conta)
    data = summary()
    assert data["net_worth_series"]["series"][-1]["net_worth"] == data["net_worth"]
