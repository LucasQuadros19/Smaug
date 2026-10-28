"""A Evolução ganha sozinha a linha do dia quando algo muda de valor; sem mudança, nada."""

from datetime import date


def linhas(client):
    return client.get("/api/snapshots").get_json()["items"]


def lancar(client, conta, valor, tipo="expense"):
    resposta = client.post(
        "/api/transactions",
        json={"account_id": conta.id, "description": "x", "amount": valor, "type": tipo, "date": date.today().isoformat()},
    )
    assert resposta.status_code == 201, resposta.get_data(as_text=True)


def test_mudanca_grava_a_linha_de_hoje_e_mais_mudanca_atualiza_a_mesma(client, make_account):
    conta = make_account(initial=1000)
    lancar(client, conta, 100)
    [linha] = linhas(client)
    assert linha["auto"] is True and linha["date"] == date.today().isoformat()
    assert linha["cash"] == {str(conta.id): 900}

    lancar(client, conta, 50)
    [linha] = linhas(client)  # continua uma linha só no dia
    assert linha["cash"] == {str(conta.id): 850}


def test_sem_mudanca_de_valor_nao_grava(client, make_account):
    conta = make_account(initial=1000)
    lancar(client, conta, 100)
    antes = linhas(client)
    client.post("/api/categories", json={"name": "Lazer", "type": "expense"})
    client.post("/api/goals", json={"name": "Viagem", "target_amount": 10000, "saved_amount": 0})
    client.post("/api/shopping-items", json={"description": "Pão"})
    assert linhas(client) == antes


def test_igual_a_ultima_linha_nao_grava_de_novo(client, make_account):
    conta = make_account(initial=1000)
    lancar(client, conta, 100)
    lancar(client, conta, 100, tipo="income")  # voltou para 1000
    lancar(client, conta, 100)
    assert len(linhas(client)) == 1


def test_registro_feito_a_mao_nao_e_mexido(client, make_account):
    conta = make_account(initial=1000)
    client.post(
        "/api/snapshots",
        json={"date": date.today().isoformat(), "notes": "meu", "entries": [{"account_id": conta.id, "value": 1000}]},
    )
    lancar(client, conta, 200)
    manual, automatica = sorted(linhas(client), key=lambda linha: linha["auto"])
    assert (manual["notes"], manual["cash"][str(conta.id)]) == ("meu", 1000)
    assert automatica["auto"] is True and automatica["cash"][str(conta.id)] == 800


def test_conta_criada_hoje_por_engano_apaga(client, make_account):
    conta = make_account(initial=1000)
    lancar(client, conta, 100)
    assert client.get("/api/transactions").get_json()["total"] == 1
    tx = client.get("/api/transactions").get_json()["items"][0]
    client.delete(f"/api/transactions/{tx['id']}")
    nova = client.post("/api/accounts", json={"name": "Errada", "type": "cash", "initial_balance": 50}).get_json()
    assert client.delete(f"/api/accounts/{nova['id']}").status_code == 204
    # A linha de hoje foi refeita sem ela.
    assert str(nova["id"]) not in linhas(client)[0]["cash"]

