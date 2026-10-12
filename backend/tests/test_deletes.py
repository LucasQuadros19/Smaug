"""Exclusões: apagam o que devem, mantêm o resto e explicam quando não dá."""

from datetime import date

from app.models.market import MarketSymbol
from app.models.snapshot import Snapshot, SnapshotEntry
from app.services import market_service


def test_toda_exclusao_de_id_que_nao_existe_e_404(client, app):
    rotas = [r for r in app.url_map.iter_rules() if "DELETE" in r.methods and r.rule.startswith("/api/")]
    assert rotas
    for rota in rotas:
        url = rota.rule
        for arg in rota.arguments:
            url = url.replace(f"<int:{arg}>", "999999")
        assert client.delete(url).status_code == 404, url


def test_conta_com_lancamentos_apaga_junto(client, make_account, make_transaction, summary):
    conta = make_account(initial=100)
    make_transaction(conta, 30)
    assert client.delete(f"/api/accounts/{conta.id}").status_code == 204
    assert client.get("/api/transactions").get_json()["total"] == 0


def test_conta_na_evolucao_explica_por_que_nao_apaga(client, db, make_account):
    conta = make_account()
    registro = Snapshot(date=date(2026, 1, 1))
    db.session.add(registro)
    db.session.flush()
    db.session.add(SnapshotEntry(snapshot_id=registro.id, account_id=conta.id, value=0))
    db.session.commit()
    resposta = client.delete(f"/api/accounts/{conta.id}")
    assert resposta.status_code == 400
    assert "registros de patrimônio" in resposta.get_json()["error"]


def test_categoria_em_uso_apaga_e_lancamentos_ficam(client, make_account, make_category, make_transaction):
    conta = make_account()
    categoria = make_category()
    make_transaction(conta, 10, category=categoria)
    client.post("/api/budgets", json={"category_id": categoria.id, "limit_amount": 100, "month": "2026-10"})
    client.post(
        "/api/recurring",
        json={"description": "Luz", "account_id": conta.id, "category_id": categoria.id, "type": "expense", "amount": 50, "next_due_date": "2030-01-01"},
    )
    assert client.delete(f"/api/categories/{categoria.id}").status_code == 204
    tx = client.get("/api/transactions").get_json()["items"][0]
    assert tx["category_id"] is None
    assert client.get("/api/recurring").get_json()[0]["category_id"] is None


def test_posicao_em_uso_apaga_e_solta_o_resto(client, make_account, make_position, make_transaction):
    conta = make_account()
    obra = make_position(name="Obra")
    make_transaction(conta, 10, playlist=obra)
    client.post("/api/goals", json={"name": "Meta", "target_amount": 100, "playlist_id": obra.id})
    client.post("/api/shopping-items", json={"description": "Cimento", "playlist_id": obra.id})
    client.post("/api/expectations", json={"playlist_id": obra.id, "description": "x", "amount": 1, "expected_date": "2030-01-01"})
    assert client.delete(f"/api/playlists/{obra.id}").status_code == 204
    assert client.get("/api/transactions").get_json()["items"][0]["playlist_id"] is None
    assert client.get("/api/goals").get_json()[0]["playlist_id"] is None


def test_posicao_do_mercado_nao_apaga_com_codigos(client, db, make_account, monkeypatch):
    monkeypatch.setattr(market_service, "quotes", lambda symbols: {})
    db.session.add(MarketSymbol(code="X", kind="stock", provider_id="X.SA", name="X", currency="BRL"))
    db.session.commit()
    conta = make_account(initial=1_000)
    client.post("/api/market/trades", json={"symbol_id": 1, "side": "buy", "quantity": 1, "price": 10, "account_id": conta.id})
    mercado = next(p for p in client.get("/api/playlists").get_json() if p["auto_source"] == "market")
    resposta = client.delete(f"/api/playlists/{mercado['id']}")
    assert resposta.status_code == 400 and "Mercado" in resposta.get_json()["error"]


def test_lancamento_gerado_explica_onde_desfazer(client, make_account):
    conta = make_account(initial=5_000)
    client.post(
        "/api/loans",
        json={"borrower": "Ana", "amount": 100, "start_date": "2026-10-01", "outflow": {"account_id": conta.id, "amount": 100}},
    )
    tx = client.get("/api/transactions").get_json()["items"][0]
    resposta = client.delete(f"/api/transactions/{tx['id']}")
    assert resposta.status_code == 400 and "Empréstimos" in resposta.get_json()["error"]


def test_recorrente_apagada_deixa_o_que_ja_gerou(client, make_account):
    conta = make_account()
    item = client.post(
        "/api/recurring",
        json={"description": "Luz", "account_id": conta.id, "type": "expense", "amount": 50, "next_due_date": "2026-01-01"},
    ).get_json()
    client.post("/api/recurring/generate", json={})
    gerados = client.get("/api/transactions").get_json()["total"]
    assert gerados > 0
    assert client.delete(f"/api/recurring/{item['id']}").status_code == 204
    assert client.get("/api/transactions").get_json()["total"] == gerados


def test_lista_mostra_de_onde_veio_o_lancamento(client, make_account):
    conta = make_account(initial=5_000)
    client.post(
        "/api/loans",
        json={"borrower": "Ana", "amount": 100, "start_date": "2026-10-01", "outflow": {"account_id": conta.id, "amount": 100}},
    )
    client.post("/api/transactions", json={"description": "Pão", "account_id": conta.id, "type": "expense", "amount": 5, "date": "2026-10-02"})
    items = {t["description"]: t for t in client.get("/api/transactions").get_json()["items"]}
    assert items["Empréstimo para Ana"]["origin"]["link"] == "/emprestimos"
    assert items["Pão"]["origin"] is None


def _emprestimo_com_caixa(client, conta):
    loan = client.post(
        "/api/loans",
        json={
            "borrower": "Ana",
            "amount": 1_000,
            "start_date": "2026-10-01",
            "participants": [{"name": "Eu", "contributed": 1_000, "gain": 100, "is_me": True}],
            "outflow": {"account_id": conta.id, "amount": 1_000},
        },
    ).get_json()
    client.post(f"/api/loans/{loan['id']}/repayments", json={"account_id": conta.id, "parts": [{"kind": "interest", "amount": 100}]})
    return loan


def test_apagar_emprestimo_mantendo_o_caixa(client, make_account, summary):
    conta = make_account(initial=5_000)
    loan = _emprestimo_com_caixa(client, conta)
    antes = summary()["total_balance"]
    assert client.delete(f"/api/loans/{loan['id']}?keep_cash=1").status_code == 204
    assert summary()["total_balance"] == antes  # o caixa não mexe
    items = client.get("/api/transactions").get_json()["items"]
    assert len(items) == 2 and all(t["origin"] is None for t in items)  # viraram lançamentos comuns


def test_apagar_emprestimo_desfazendo_o_caixa(client, make_account, summary):
    conta = make_account(initial=5_000)
    loan = _emprestimo_com_caixa(client, conta)
    assert client.delete(f"/api/loans/{loan['id']}").status_code == 204
    assert summary()["total_balance"] == 5_000
    assert client.get("/api/transactions").get_json()["total"] == 0
