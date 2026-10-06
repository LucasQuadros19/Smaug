"""Entrada inválida, CSRF, erros sem vazar detalhes e exclusões que quebrariam o histórico."""

from datetime import date

import pytest

from app.models.market import MarketSymbol, MarketTrade
from app.models.snapshot import Snapshot, SnapshotEntry


def _tx(client, conta, **extra):
    body = {"description": "x", "account_id": conta.id, "amount": 10, "type": "expense", "date": "2026-10-01"}
    return client.post("/api/transactions", json={**body, **extra})


def test_escrita_sem_json_e_recusada(client, make_account):
    conta = make_account()
    response = client.post(
        "/api/transactions",
        data=f"description=x&account_id={conta.id}&amount=10&type=expense&date=2026-10-01",
        content_type="application/x-www-form-urlencoded",
    )
    assert response.status_code == 415


@pytest.mark.parametrize("valor", ["NaN", "Infinity", "-Infinity", "abc", [1], {"a": 1}, True])
def test_valor_invalido_e_400_e_nao_salva(client, make_account, valor):
    conta = make_account()
    assert _tx(client, conta, amount=valor).status_code == 400
    assert client.get("/api/transactions").get_json()["total"] == 0


def test_data_invalida_e_400(client, make_account):
    assert _tx(client, make_account(), date="31/12/2026").status_code == 400
    assert client.get("/api/transactions?start_date=ontem").status_code == 400
    assert client.get("/api/dashboard/summary?month=2026-13").status_code == 400


def test_cor_invalida_e_400(client):
    response = client.post("/api/categories", json={"name": "x", "type": "expense", "color": "red;background:url(x)"})
    assert response.status_code == 400


def test_erros_saem_em_json_sem_detalhes_internos(client):
    response = client.put("/api/transactions/999999", json={})
    assert response.status_code == 404
    assert "error" in response.get_json()
    assert client.get("/api/transactions/999999").get_json()["error"]


def test_cabecalhos_de_seguranca(client):
    response = client.get("/api/accounts")
    assert response.headers["X-Content-Type-Options"] == "nosniff"
    assert response.headers["Cache-Control"] == "no-store"


def test_paginacao_tem_limite(client):
    page = client.get("/api/transactions?per_page=100000").get_json()
    assert page["per_page"] == 200


def test_csv_neutraliza_formula_mas_nao_numero_negativo(client, make_account):
    conta = make_account(initial=0)
    _tx(client, conta, description="=HYPERLINK(\"http://x\")")
    csv = client.get("/api/export/transacoes.csv").get_data(as_text=True)
    assert "'=HYPERLINK" in csv
    assert ';"=HYPERLINK' not in csv and ";=HYPERLINK" not in csv


def _com_registro(db, account_id=None, playlist_id=None):
    snapshot = Snapshot(date=date(2026, 10, 1))
    db.session.add(snapshot)
    db.session.flush()
    db.session.add(SnapshotEntry(snapshot_id=snapshot.id, account_id=account_id, playlist_id=playlist_id, value=1))
    db.session.commit()


def test_nao_apaga_conta_que_esta_no_historico(client, db, make_account):
    conta = make_account()
    _com_registro(db, account_id=conta.id)
    response = client.delete(f"/api/accounts/{conta.id}")
    assert response.status_code == 400
    assert "registros de patrimônio" in response.get_json()["error"]


def test_nao_apaga_ativo_que_esta_no_historico(client, db, make_position):
    obra = make_position()
    _com_registro(db, playlist_id=obra.id)
    assert client.delete(f"/api/playlists/{obra.id}").status_code == 400


def test_lancamento_do_mercado_so_sai_pelo_mercado(client, db, make_account):
    conta = make_account(initial=1000)
    tx = _tx(client, conta).get_json()
    symbol = MarketSymbol(code="X", kind="stock", provider_id="X", name="x", currency="BRL")
    db.session.add(symbol)
    db.session.flush()
    db.session.add(MarketTrade(symbol_id=symbol.id, side="buy", date=date.today(),
                               quantity=1, price=10, fx_rate=1, transaction_id=tx["id"], account_id=conta.id))
    db.session.commit()

    assert client.delete(f"/api/transactions/{tx['id']}").status_code == 400
    assert client.delete(f"/api/accounts/{conta.id}").status_code == 400


def test_codigo_do_mercado_invalido_nem_sai_para_a_internet(client):
    response = client.post("/api/market/symbols", json={"code": "../../etc", "kind": "stock"})
    assert response.status_code == 400


def test_composicao_usa_o_valor_dos_emprestimos(client, make_account, make_position, summary):
    """Antes a fatia do ativo ligado aos empréstimos usava o valor guardado, não o total dos empréstimos."""
    make_account(initial=0)
    make_position(name="empréstimo", opening=0, auto_source="loans")
    client.post(
        "/api/loans",
        json={
            "borrower": "Ana",
            "amount": 1000,
            "start_date": "2026-01-01",
            "participants": [{"name": "Eu", "contributed": 1000, "to_receive": 1100, "is_me": True}],
        },
    )
    allocation = summary()["allocation"]
    assert {"label": "empréstimo", "value": 1000.0, "group": "Ativos", "icon": "📁"} in allocation
