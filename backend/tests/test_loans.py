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
    """Meu principal e meus juros voltaram: fecha, mesmo com o sócio por acertar."""
    conta, _, loan_id = loan_setup
    loan = client.post(
        f"/api/loans/{loan_id}/repayments",
        json={"date": "2026-06-10", "account_id": conta.id, "parts": [
            {"kind": "principal", "amount": 25_000, "my_share": 25_000},
            {"kind": "interest", "amount": 2_500, "my_share": 2_500},
        ]},
    ).get_json()
    assert loan["status"] == "paid"
    assert loan["my_outstanding"] == 0


def test_desfazer_recebimento_reabre_e_limpa_lancamentos(client, loan_setup, summary):
    conta, _, loan_id = loan_setup
    loan = client.post(
        f"/api/loans/{loan_id}/repayments",
        json={"date": "2026-06-10", "account_id": conta.id, "parts": [
            {"kind": "principal", "amount": 25_000, "my_share": 25_000},
            {"kind": "interest", "amount": 2_500, "my_share": 2_500},
        ]},
    ).get_json()
    assert loan["status"] == "paid"
    parte = loan["repayments"][0]["id"]
    assert client.delete(f"/api/loans/{loan_id}/repayments/{parte}").status_code == 400  # desfaz-se o passo inteiro

    response = client.delete(f"/api/loans/{loan_id}/events/{loan['events'][-1]['id']}")
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


# --- comissão: digitada à mão, de quem eu escolher ------------------------


@pytest.fixture
def comissao(client, make_account):
    """João põe 10k e recebe 10,7k; eu entro com zero e fico com 300 de comissão."""
    conta = make_account(initial=0)
    loan = client.post(
        "/api/loans",
        json={
            "borrower": "Pedro",
            "amount": 10_000,
            "start_date": "2026-01-10",
            "participants": [
                {"name": "João", "contributed": 10_000, "to_receive": 10_700, "is_me": False},
                {"name": "Eu", "contributed": 0, "to_receive": 0, "commission": 300, "is_me": True},
            ],
        },
    ).get_json()
    return conta, loan


def test_comissao_entra_no_total_a_receber(comissao):
    _, loan = comissao
    assert loan["total_to_receive"] == 11_000
    assert loan["profit"] == 1_000
    assert loan["commission"] == 300
    assert loan["my_to_receive"] == 300
    assert loan["my_outstanding"] == 0  # não pus dinheiro: nada meu na rua


def test_comissao_de_outra_pessoa_nao_e_minha(client):
    loan = client.post(
        "/api/loans",
        json={
            "borrower": "Pedro",
            "amount": 1_000,
            "start_date": "2026-01-10",
            "participants": [
                {"name": "Eu", "contributed": 1_000, "to_receive": 1_050, "is_me": True},
                {"name": "Ana", "contributed": 0, "to_receive": 0, "commission": 50, "is_me": False},
            ],
        },
    ).get_json()
    assert loan["my_to_receive"] == 1_050
    assert loan["total_to_receive"] == 1_100


def test_so_comissao_nao_quita_antes_de_eu_receber(client, comissao):
    conta, loan = comissao
    # Primeira parcela: só dinheiro do João passando pela minha conta.
    parcial = client.post(
        f"/api/loans/{loan['id']}/repayments",
        json={"amount": 5_000, "my_share": 0, "partners_share": 5_000, "account_id": conta.id},
    ).get_json()
    assert parcial["status"] == "active"

    final = client.post(
        f"/api/loans/{loan['id']}/repayments",
        json={"amount": 6_000, "my_share": 300, "partners_share": 5_700, "account_id": conta.id},
    ).get_json()
    assert final["status"] == "paid"


def test_comissao_negativa_e_recusada(client):
    response = client.post(
        "/api/loans",
        json={
            "borrower": "X",
            "amount": 1,
            "start_date": "2026-01-10",
            "participants": [{"name": "Eu", "contributed": 1, "to_receive": 1, "commission": -5, "is_me": True}],
        },
    )
    assert response.status_code == 400


def test_lancamento_do_recebimento_nao_muda_de_valor_solto(client, loan_setup):
    """Regressão: editar o valor por Transações desencontrava caixa e empréstimo."""
    conta, _, loan_id = loan_setup
    client.post(f"/api/loans/{loan_id}/repayments", json={"account_id": conta.id, "amount": 1_000})
    lancamento = client.get("/api/transactions").get_json()["items"][0]

    valor = client.put(f"/api/transactions/{lancamento['id']}", json={"amount": 50})
    descricao = client.put(f"/api/transactions/{lancamento['id']}", json={**lancamento, "description": "Parcela 1"})

    assert valor.status_code == 400
    assert descricao.status_code == 200
    assert client.get("/api/transactions").get_json()["items"][0]["amount"] == 1_000


# --- por mês: só juros, parcelas e continuar para o próximo mês -----------


def _mensal(client, **extra):
    """10k meu, 10% ao mês = 1.000 de juros por mês."""
    return client.post(
        "/api/loans",
        json={
            "borrower": "Pedro",
            "amount": 10_000,
            "start_date": "2026-01-10",
            "due_date": "2026-02-10",
            "participants": [{"name": "Eu", "contributed": 10_000, "gain": 1_000, "is_me": True}],
            **extra,
        },
    ).get_json()


def _receber(client, loan, conta, parts, **extra):
    response = client.post(
        f"/api/loans/{loan['id']}/repayments",
        json={"date": "2026-02-10", "account_id": conta.id, "parts": parts, **extra},
    )
    assert response.status_code == 201, response.get_data(as_text=True)
    return response.get_json()


def test_so_juros_continua_e_conta_como_receita(client, make_account, summary):
    conta = make_account()
    loan = _mensal(client, months=3)
    assert loan["profit"] == 3_000 and loan["total_to_receive"] == 13_000
    assert loan["next_payment"] == {"month": 1, "principal": 0, "my_principal": 0, "interest": 1_000, "my_interest": 1_000}

    loan = _receber(client, loan, conta, [{"kind": "interest", "amount": 1_000}], next_due_date="2026-03-10")

    assert loan["status"] == "active"
    assert loan["due_date"] == "2026-03-10" and loan["months_charged"] == 1
    assert loan["my_outstanding"] == 10_000  # juros não tiram dinheiro da rua
    assert summary(month="2026-02")["month_income"] == 1_000


def test_ultimo_mes_sugere_o_principal_e_quitar_fecha(client, make_account):
    conta = make_account()
    loan = _mensal(client, months=2)
    loan = _receber(client, loan, conta, [{"kind": "interest", "amount": 1_000}], next_due_date="2026-03-10")
    assert loan["next_payment"]["principal"] == 10_000

    loan = _receber(client, loan, conta, [
        {"kind": "principal", "amount": 10_000},
        {"kind": "interest", "amount": 1_000},
    ])
    assert loan["status"] == "paid"


def test_quitar_antes_do_combinado_fecha(client, make_account):
    conta = make_account()
    loan = _mensal(client, months=6)
    loan = _receber(client, loan, conta, [{"kind": "interest", "amount": 1_000}], next_due_date="2026-03-10")
    loan = _receber(client, loan, conta, [
        {"kind": "principal", "amount": 10_000},
        {"kind": "interest", "amount": 1_000},
    ])
    assert loan["status"] == "paid"
    assert loan["months"] == 2 and loan["profit"] == 2_000


def test_continuar_alem_do_combinado_soma_mais_um_mes(client, make_account):
    conta = make_account()
    loan = _mensal(client)
    loan = _receber(client, loan, conta, [{"kind": "interest", "amount": 1_000}], next_due_date="2026-03-10")
    assert loan["months"] == 2
    assert loan["profit"] == 2_000
    assert loan["status"] == "active"


def test_parcelas_dividem_o_principal_que_falta(client, make_account):
    conta = make_account()
    loan = _mensal(client, months=3, schedule="installments")
    assert loan["next_payment"]["principal"] == 3_333.33

    loan = _receber(client, loan, conta, [
        {"kind": "principal", "amount": 3_333.33},
        {"kind": "interest", "amount": 1_000},
    ], next_due_date="2026-03-10")
    assert loan["next_payment"]["principal"] == 3_333.34  # 6.666,67 em 2 meses
    assert loan["principal_outstanding"] == 6_666.67


@pytest.mark.parametrize("extra", [{"months": 0}, {"months": "3"}, {"months": True}, {"schedule": "anual"}])
def test_plano_invalido_e_recusado(client, extra):
    response = client.post(
        "/api/loans", json={"borrower": "X", "amount": 1, "start_date": "2026-01-10", **extra}
    )
    assert response.status_code == 400


# --- adiamento, pagamento parcial, multa e desfazer -----------------------


def _adiar(client, loan, **body):
    return client.post(f"/api/loans/{loan['id']}/postpone", json=body)


def test_adiar_com_juros_deixa_o_mes_pendente(client, make_account):
    loan = _mensal(client, months=2)
    response = _adiar(client, loan, due_date="2026-03-10")
    assert response.status_code == 201
    loan = response.get_json()

    assert loan["due_date"] == "2026-03-10"
    assert loan["interest_pending"] == 1_000
    assert loan["months"] == 2 and loan["months_charged"] == 1
    assert loan["next_payment"]["interest"] == 2_000  # o mês adiado + o atual


def test_adiar_sem_juros_e_carencia(client):
    loan = _mensal(client, months=2)
    loan = _adiar(client, loan, due_date="2026-03-10", charge_interest=False).get_json()
    assert loan["interest_pending"] == 0
    assert loan["months_charged"] == 0
    assert loan["next_payment"]["interest"] == 1_000


def test_adiar_exige_data_depois_e_emprestimo_aberto(client, make_account):
    loan = _mensal(client)
    assert _adiar(client, loan, due_date="2026-02-01").status_code == 400
    assert _adiar(client, loan).status_code == 400
    _receber(client, loan, make_account(), [{"kind": "principal", "amount": 10_000}, {"kind": "interest", "amount": 1_000}])
    assert _adiar(client, loan, due_date="2026-04-10").status_code == 400


def test_pagamento_parcial_nao_muda_o_vencimento(client, make_account):
    conta = make_account()
    loan = _mensal(client, months=2)
    loan = _adiar(client, loan, due_date="2026-03-10").get_json()

    loan = _receber(client, loan, conta, [{"kind": "interest", "amount": 400}])

    assert loan["due_date"] == "2026-03-10"
    assert loan["interest_pending"] == 600
    assert loan["status"] == "active"


def test_multa_e_receita_e_nao_quita(client, make_account, summary):
    conta = make_account()
    loan = _mensal(client)
    loan = _receber(client, loan, conta, [{"kind": "fee", "amount": 11_000}])
    assert loan["status"] == "active"  # multa não paga principal nem juros
    assert summary(month="2026-02")["month_income"] == 11_000


def test_desfazer_so_o_ultimo_passo_e_volta_tudo(client, make_account, summary):
    conta = make_account()
    loan = _mensal(client, months=2)
    loan = _receber(client, loan, conta, [{"kind": "interest", "amount": 1_000}], next_due_date="2026-03-10")
    loan = _adiar(client, loan, due_date="2026-04-10").get_json()
    primeiro, ultimo = loan["events"]

    assert client.delete(f"/api/loans/{loan['id']}/events/{primeiro['id']}").status_code == 400
    loan = client.delete(f"/api/loans/{loan['id']}/events/{ultimo['id']}").get_json()
    assert loan["due_date"] == "2026-03-10" and loan["months"] == 2 and loan["months_charged"] == 1

    loan = client.delete(f"/api/loans/{loan['id']}/events/{primeiro['id']}").get_json()
    assert loan["due_date"] == "2026-02-10" and loan["months_charged"] == 0 and loan["events"] == []
    assert summary(month="2026-02")["month_income"] == 0  # o lançamento dos juros sumiu junto


def test_pagou_a_mais_desconta_do_proximo(client, make_account):
    conta = make_account()
    loan = _mensal(client, months=2)
    loan = _adiar(client, loan, due_date="2026-03-10").get_json()
    loan = _receber(client, loan, conta, [{"kind": "interest", "amount": 1_500}])
    assert loan["interest_pending"] == 0
    assert loan["next_payment"]["interest"] == 500
