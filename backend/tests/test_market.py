"""Mercado: custo médio, compra com/sem conta, venda além do que tenho. Sem internet."""

import pytest

from app.models.market import MarketSymbol
from app.services import market_service, rates


@pytest.fixture
def mercado(monkeypatch, db, tmp_path, app):
    """WEGE3 a R$ 50 e AAPL a US$ 200, dólar a R$ 5 — tudo fixo."""
    monkeypatch.setattr(rates, "_fetch", lambda: {"USD": {"rate": "5", "updated_at": "agora"}})
    monkeypatch.setattr(rates, "_cache", {"at": float("-inf"), "rates": {}})
    app.instance_path = str(tmp_path)

    precos = {"WEGE3.SA": 50, "AAPL": 200}
    monkeypatch.setattr(
        market_service,
        "quotes",
        lambda symbols: {
            s.id: {"price": precos[s.provider_id], "previous_close": precos[s.provider_id] - 1, "change_pct": 2}
            for s in symbols
        },
    )
    weg = MarketSymbol(code="WEGE3", kind="stock", provider_id="WEGE3.SA", name="WEG", currency="BRL")
    apple = MarketSymbol(code="AAPL", kind="stock", provider_id="AAPL", name="Apple", currency="USD")
    db.session.add_all([weg, apple])
    db.session.commit()
    return weg, apple


def _comprar(client, symbol, qty, price, side="buy", **extra):
    return client.post(
        "/api/market/trades",
        json={"symbol_id": symbol.id, "side": side, "quantity": qty, "price": price, "date": "2026-10-01", **extra},
    )


def test_custo_medio_e_ganho(client, mercado):
    weg, _ = mercado
    _comprar(client, weg, 2, 40)
    _comprar(client, weg, 2, 44)  # médio 42
    _comprar(client, weg, 1, 60, side="sell")  # realiza (60 − 42) × 1

    item = next(s for s in client.get("/api/market").get_json()["symbols"] if s["code"] == "WEGE3")
    h = item["holding"]
    assert h["quantity"] == 3
    assert h["average_price"] == 42
    assert h["realized_brl"] == 18
    assert h["value_brl"] == 150  # 3 × 50
    assert h["gain_brl"] == 150 - 126


def test_acao_em_dolar_vira_real_pela_cotacao_do_dia(client, mercado):
    _, apple = mercado
    _comprar(client, apple, 1, 180)
    portfolio = client.get("/api/market").get_json()["portfolio"]
    assert portfolio["cost_brl"] == 900  # 180 × 5
    assert portfolio["value_brl"] == 1000  # 200 × 5


def test_conta_so_e_debitada_se_informada(client, mercado, make_account, summary):
    weg, _ = mercado
    conta = make_account(initial=1000)

    _comprar(client, weg, 2, 50)  # sem conta
    assert summary()["total_balance"] == 1000

    _comprar(client, weg, 2, 50, account_id=conta.id)
    assert summary()["total_balance"] == 900


def test_nao_vende_mais_do_que_tem(client, mercado):
    weg, _ = mercado
    _comprar(client, weg, 1, 50)
    assert _comprar(client, weg, 2, 50, side="sell").status_code == 400


def test_mercado_nao_entra_no_patrimonio(client, mercado, make_account, summary):
    weg, _ = mercado
    make_account(initial=1000)
    _comprar(client, weg, 10, 50)
    assert summary()["net_worth"] == 1000


def test_apagar_compra_desfaz_o_lancamento(client, mercado, make_account, summary):
    weg, _ = mercado
    conta = make_account(initial=1000)
    trade = _comprar(client, weg, 2, 50, account_id=conta.id).get_json()
    client.delete(f"/api/market/trades/{trade['id']}")
    assert summary()["total_balance"] == 1000
