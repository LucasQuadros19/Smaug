"""Recorrentes: quem lança é o automático ou você."""

from datetime import date, timedelta

import pytest


@pytest.fixture
def criar(client, make_account):
    conta = make_account(initial=0)

    def _criar(auto=True, amount=200, frequency="monthly", vencimento=None, tipo="expense"):
        response = client.post(
            "/api/recurring",
            json={
                "description": "Conta de luz",
                "account_id": conta.id,
                "category_id": None,
                "amount": amount,
                "type": tipo,
                "frequency": frequency,
                # Por padrão já vencida, que é o caso interessante.
                "next_due_date": (vencimento or date.today() - timedelta(days=1)).isoformat(),
                "auto": auto,
            },
        )
        assert response.status_code == 201, response.get_data(as_text=True)
        return response.get_json()

    return _criar


def test_automatica_lanca_sozinha(client, criar):
    criar(auto=True)
    assert client.post("/api/recurring/generate", json={}).get_json()["generated"] == 1
    assert client.get("/api/transactions").get_json()["total"] == 1


def test_manual_nao_lanca_sozinha(client, criar):
    """O ponto do botão: no manual nada acontece até você mandar."""
    criar(auto=False)
    assert client.post("/api/recurring/generate", json={}).get_json()["generated"] == 0
    assert client.get("/api/transactions").get_json()["total"] == 0


def test_manual_lanca_o_valor_do_mes(client, criar, summary):
    """A luz veio 237,42 em vez dos 200 previstos: vale o valor informado."""
    item = criar(auto=False, amount=200)

    response = client.post(f"/api/recurring/{item['id']}/launch", json={"amount": 237.42})
    assert response.status_code == 201

    transacoes = client.get("/api/transactions").get_json()["items"]
    assert len(transacoes) == 1
    assert transacoes[0]["amount"] == 237.42
    assert summary()["total_balance"] == -237.42

    # O valor cadastrado continua sendo a previsão, não é sobrescrito.
    assert response.get_json()["recurring"]["amount"] == 200


def test_lancar_avanca_o_vencimento(client, criar):
    """Sem avançar, clicar duas vezes lançaria o mesmo mês de novo."""
    item = criar(auto=False, vencimento=date(2026, 1, 10))

    primeiro = client.post(f"/api/recurring/{item['id']}/launch", json={})
    assert primeiro.get_json()["recurring"]["next_due_date"] == "2026-02-10"

    segundo = client.post(f"/api/recurring/{item['id']}/launch", json={})
    assert segundo.get_json()["recurring"]["next_due_date"] == "2026-03-10"

    # Dois lançamentos, um para cada mês — e cada um na sua data.
    datas = sorted(t["date"] for t in client.get("/api/transactions").get_json()["items"])
    assert datas == ["2026-01-10", "2026-02-10"]


def test_sem_amount_usa_o_valor_cadastrado(client, criar):
    item = criar(auto=False, amount=99.9)
    client.post(f"/api/recurring/{item['id']}/launch", json={})
    assert client.get("/api/transactions").get_json()["items"][0]["amount"] == 99.9


def test_alternar_o_botao_muda_quem_lanca(client, criar):
    """Automática vira manual e para de gerar; volta e gera de novo."""
    item = criar(auto=True)

    assert client.put(f"/api/recurring/{item['id']}", json={"auto": False}).get_json()["auto"] is False
    assert client.post("/api/recurring/generate", json={}).get_json()["generated"] == 0

    assert client.put(f"/api/recurring/{item['id']}", json={"auto": True}).get_json()["auto"] is True
    assert client.post("/api/recurring/generate", json={}).get_json()["generated"] == 1


def test_pausada_nao_lanca_de_jeito_nenhum(client, criar):
    item = criar(auto=True)
    client.put(f"/api/recurring/{item['id']}", json={"active": False})
    assert client.post("/api/recurring/generate", json={}).get_json()["generated"] == 0


def test_recorrencia_nasce_automatica(client, make_account):
    """Compatibilidade: quem não manda 'auto' continua no comportamento antigo."""
    conta = make_account(initial=0)
    response = client.post(
        "/api/recurring",
        json={
            "description": "Salário",
            "account_id": conta.id,
            "amount": 5_000,
            "type": "income",
            "frequency": "monthly",
            "next_due_date": date.today().isoformat(),
        },
    )
    assert response.get_json()["auto"] is True


def test_lancamento_recusa_valor_invalido(client, criar):
    item = criar(auto=False)
    assert client.post(f"/api/recurring/{item['id']}/launch", json={"amount": 0}).status_code == 400
    assert client.post(f"/api/recurring/{item['id']}/launch", json={"amount": -5}).status_code == 400
    assert client.get("/api/transactions").get_json()["total"] == 0
