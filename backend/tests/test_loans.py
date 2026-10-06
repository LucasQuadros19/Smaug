"""Empréstimos: parcelas, rateio com sócios e a posição derivada."""

import pytest


@pytest.fixture
def loan_setup(client, make_account, make_position):
    """Empréstimo de 50k dividido meio a meio, com posição espelhando."""
    conta = make_account(initial=0)
    posicao = make_position(name="empréstimo", opening=0, auto_source="loans")
    response = client.post(
        "/api/loans",
        json={
            "borrower": "Carlos",
            "amount": 50_000,
            "start_date": "2026-01-10",
            "status": "active",
            "participants": [
                {"name": "Eu", "contributed": 25_000, "to_receive": 27_500, "is_me": True},
                {"name": "Sócio", "contributed": 25_000, "to_receive": 27_500, "is_me": False},
            ],
        },
    )
    assert response.status_code == 201
    return conta, posicao, response.get_json()["id"]


def test_posicao_reflete_apenas_a_minha_parte(loan_setup, summary):
    _, _, _ = loan_setup
    data = summary()
    assert data["parked_in_assets"] == 25_000
    assert data["net_worth"] == 25_000


def test_emprestimo_sem_socios_conta_inteiro(client, make_account, make_position, summary):
    make_account(initial=0)
    make_position(name="empréstimo", opening=0, auto_source="loans")
    client.post(
        "/api/loans",
        json={
            "borrower": "Ana",
            "amount": 10_000,
            "start_date": "2026-01-10",
            "status": "active",
            "participants": [],
        },
    )
    assert summary()["parked_in_assets"] == 10_000


def test_socios_sem_ninguem_marcado_como_eu_nao_conta(
    client, make_account, make_position, summary
):
    """Não dá para adivinhar qual parte é minha — melhor zero do que errado."""
    make_account(initial=0)
    make_position(name="empréstimo", opening=0, auto_source="loans")
    client.post(
        "/api/loans",
        json={
            "borrower": "X",
            "amount": 10_000,
            "start_date": "2026-01-10",
            "status": "active",
            "participants": [{"name": "Sócio", "contributed": 10_000, "to_receive": 11_000}],
        },
    )
    assert summary()["parked_in_assets"] == 0


def test_recebimento_parcial_abate_sem_quitar(client, loan_setup, summary):
    conta, _, loan_id = loan_setup

    response = client.post(
        f"/api/loans/{loan_id}/repayments",
        json={
            "date": "2026-03-10",
            "amount": 20_000,
            "my_share": 10_000,
            "partners_share": 10_000,
            "account_id": conta.id,
        },
    )
    assert response.status_code == 201
    loan = response.get_json()

    assert loan["status"] == "active"  # ainda não quitou
    assert loan["my_outstanding"] == 15_000  # 25.000 − 10.000

    data = summary()
    assert data["parked_in_assets"] == 15_000
    assert data["total_balance"] == 20_000  # tudo entrou na conta
    assert data["owed_to_partners"] == 10_000  # metade não é minha
    # 20.000 na conta − 10.000 do sócio + 15.000 ainda na rua
    assert data["net_worth"] == 25_000


def test_parte_do_socio_nao_infla_o_patrimonio(client, loan_setup, summary):
    """Regressão: sem o passivo, o caixa do sócio virava patrimônio meu."""
    conta, _, loan_id = loan_setup
    antes = summary()["net_worth"]

    client.post(
        f"/api/loans/{loan_id}/repayments",
        json={
            "date": "2026-03-10",
            "amount": 10_000,
            "my_share": 5_000,
            "partners_share": 5_000,
            "account_id": conta.id,
        },
    )
    # Só moveu dinheiro de lugar: nada de lucro ainda.
    assert summary()["net_worth"] == antes


def test_repasse_ao_socio_tira_do_caixa(client, loan_setup, summary):
    conta, _, loan_id = loan_setup
    loan = client.post(
        f"/api/loans/{loan_id}/repayments",
        json={
            "date": "2026-03-10",
            "amount": 20_000,
            "my_share": 10_000,
            "partners_share": 10_000,
            "account_id": conta.id,
        },
    ).get_json()
    repayment_id = loan["repayments"][0]["id"]

    response = client.post(
        f"/api/loans/{loan_id}/repayments/{repayment_id}/settle-partners", json={}
    )
    assert response.status_code == 200

    data = summary()
    assert data["total_balance"] == 10_000  # os 10k do sócio saíram
    assert data["owed_to_partners"] == 0
    assert data["net_worth"] == 25_000  # inalterado: só saiu o que não era meu


def test_recebimento_com_lucro_aumenta_o_patrimonio(client, loan_setup, summary):
    conta, _, loan_id = loan_setup
    antes = summary()["net_worth"]

    # Volta tudo o que era meu (25k) mais 2.5k de juros.
    client.post(
        f"/api/loans/{loan_id}/repayments",
        json={
            "date": "2026-06-10",
            "amount": 27_500,
            "my_share": 27_500,
            "partners_share": 0,
            "account_id": conta.id,
        },
    )

    data = summary()
    assert data["net_worth"] == antes + 2_500
    assert data["month_expense"] == 0  # não é gasto
    assert data["parked_in_assets"] == 0


def test_quita_sozinho_quando_a_minha_parte_volta_toda(client, loan_setup):
    conta, _, loan_id = loan_setup
    loan = client.post(
        f"/api/loans/{loan_id}/repayments",
        json={"date": "2026-06-10", "amount": 25_000, "my_share": 25_000, "account_id": conta.id},
    ).get_json()
    assert loan["status"] == "paid"
    assert loan["my_outstanding"] == 0


def test_desfazer_recebimento_reabre_e_limpa_lancamentos(client, loan_setup, summary):
    conta, _, loan_id = loan_setup
    loan = client.post(
        f"/api/loans/{loan_id}/repayments",
        json={"date": "2026-06-10", "amount": 25_000, "my_share": 25_000, "account_id": conta.id},
    ).get_json()
    assert loan["status"] == "paid"
    repayment_id = loan["repayments"][0]["id"]

    response = client.delete(f"/api/loans/{loan_id}/repayments/{repayment_id}")
    assert response.status_code == 200
    assert response.get_json()["status"] == "active"

    data = summary()
    assert data["total_balance"] == 0  # o lançamento sumiu junto
    assert data["parked_in_assets"] == 25_000


def test_partes_maiores_que_o_recebido_sao_recusadas(client, loan_setup):
    conta, _, loan_id = loan_setup
    response = client.post(
        f"/api/loans/{loan_id}/repayments",
        json={
            "date": "2026-03-10",
            "amount": 1_000,
            "my_share": 800,
            "partners_share": 500,
            "account_id": conta.id,
        },
    )
    assert response.status_code == 400
    assert "passar do valor recebido" in response.get_json()["error"]
