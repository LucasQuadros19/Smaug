"""Invariantes do sistema — o que nunca pode acontecer com o dinheiro."""

import pytest


@pytest.fixture
def cenario(make_account, make_position):
    conta = make_account(initial=100)
    obra = make_position(name="obra", opening=1_000)
    cripto = make_position(name="cripto", opening=0)
    return conta, obra, cripto


def test_nao_transfere_mais_do_que_a_posicao_tem(client, cenario, summary):
    """Regressão: tirar 5.000 de uma posição de 1.000 criava dívida fantasma."""
    _, obra, cripto = cenario

    response = client.post(
        "/api/snapshots/transfer",
        json={
            "from": {"type": "playlist", "id": obra.id},
            "to": {"type": "playlist", "id": cripto.id},
            "amount": 5_000,
            "date": "2026-01-01",
        },
    )
    assert response.status_code == 400
    assert "não tem" in response.get_json()["error"]

    valores = {p["name"]: p["opening_value"] for p in summary()["playlists_summary"]}
    assert valores["obra"] == 1_000  # intacta
    assert valores["cripto"] == 0


def test_nao_liquida_mais_do_que_a_posicao_tem(client, cenario, summary):
    conta, obra, _ = cenario

    response = client.post(
        "/api/snapshots/settle",
        json={
            "from": {"type": "playlist", "id": obra.id},
            "to_account_id": conta.id,
            "received": 500,
            "reduce_by": 5_000,
            "date": "2026-01-01",
        },
    )
    assert response.status_code == 400

    valores = {p["name"]: p["opening_value"] for p in summary()["playlists_summary"]}
    assert valores["obra"] == 1_000


def test_transferir_o_valor_exato_ainda_funciona(client, cenario, summary):
    """O limite é inclusivo: dá para esvaziar a posição, só não estourar."""
    _, obra, cripto = cenario

    response = client.post(
        "/api/snapshots/transfer",
        json={
            "from": {"type": "playlist", "id": obra.id},
            "to": {"type": "playlist", "id": cripto.id},
            "amount": 1_000,
            "date": "2026-01-01",
        },
    )
    assert response.status_code == 201

    valores = {p["name"]: p["opening_value"] for p in summary()["playlists_summary"]}
    assert valores["obra"] == 0
    assert valores["cripto"] == 1_000


def test_conta_pode_ficar_negativa(client, cenario, summary):
    """Conta no vermelho é real (cheque especial); posição negativa não é."""
    conta, obra, _ = cenario

    response = client.post(
        "/api/snapshots/invest",
        json={
            "to": {"type": "playlist", "id": obra.id},
            "from_account_id": conta.id,
            "amount": 5_000,
            "date": "2026-01-01",
        },
    )
    assert response.status_code == 201
    assert summary()["total_balance"] == -4_900


def test_nao_apaga_transacao_amarrada_a_um_recebimento(client, make_account, make_position):
    """Regressão: apagar por fora tirava o dinheiro do caixa mas o recebimento
    continuava abatendo o empréstimo — o valor sumia sem deixar rastro."""
    conta = make_account(initial=0)
    make_position(name="empréstimo", opening=0, auto_source="loans")

    loan_id = client.post(
        "/api/loans",
        json={
            "borrower": "Y",
            "amount": 10_000,
            "start_date": "2026-01-01",
            "status": "active",
            "participants": [],
        },
    ).get_json()["id"]
    client.post(
        f"/api/loans/{loan_id}/repayments",
        json={"date": "2026-02-01", "amount": 5_000, "my_share": 5_000, "account_id": conta.id},
    )

    transacoes = client.get("/api/transactions").get_json()["items"]
    assert len(transacoes) == 1

    response = client.delete(f"/api/transactions/{transacoes[0]['id']}")
    assert response.status_code == 400
    assert "Empréstimos" in response.get_json()["error"]

    # Nada mudou: o dinheiro continua lá e o empréstimo consistente.
    assert client.get("/api/transactions").get_json()["total"] == 1
    loan = client.get("/api/loans").get_json()[0]
    assert loan["my_repaid"] == 5_000
    assert loan["my_outstanding"] == 5_000


def test_apagar_emprestimo_desfaz_o_caixa(client, make_account, make_position, summary):
    """Regressão: o cascade levava as parcelas mas deixava os lançamentos para
    trás — o dinheiro recebido ficava na conta sem nenhum empréstimo por trás."""
    conta = make_account(initial=0)
    make_position(name="empréstimo", opening=0, auto_source="loans")

    loan_id = client.post(
        "/api/loans",
        json={
            "borrower": "Z",
            "amount": 10_000,
            "start_date": "2026-01-01",
            "status": "active",
            "participants": [],
        },
    ).get_json()["id"]
    client.post(
        f"/api/loans/{loan_id}/repayments",
        json={"date": "2026-02-01", "amount": 3_000, "my_share": 3_000, "account_id": conta.id},
    )
    assert summary()["total_balance"] == 3_000

    assert client.delete(f"/api/loans/{loan_id}").status_code == 204

    # Empréstimo apagado, caixa de volta ao zero: nada sobra órfão.
    assert client.get("/api/transactions").get_json()["total"] == 0
    assert summary()["total_balance"] == 0
