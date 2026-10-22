"""A planilha de patrimônio e o resto do sistema contam o mesmo valor por ativo."""

from datetime import date


def _valor(client, position):
    return client.get(f"/api/playlists/{position.id}").get_json()["outstanding"]


def _registrar(client, **valores):
    """`valores`: {"p<id>": valor, "a<id>": valor}, como o formulário manda."""
    entries = [
        {"playlist_id" if k[0] == "p" else "account_id": int(k[1:]), "value": v} for k, v in valores.items()
    ]
    response = client.post("/api/snapshots", json={"date": date.today().isoformat(), "entries": entries})
    assert response.status_code == 201, response.get_data(as_text=True)


def test_dinheiro_aportado_por_lancamento_aparece_na_planilha(client, make_account, make_position, make_transaction):
    conta = make_account(initial=5_000)
    bot = make_position(name="bot")
    make_transaction(conta, 1_000, playlist=bot)

    agora = client.get("/api/snapshots/current").get_json()

    assert agora["positions"][str(bot.id)] == 1_000
    assert agora["cash"][str(conta.id)] == 4_000
    assert agora["net_worth"] == 5_000


def test_atualizar_na_planilha_muda_o_valor_do_ativo(client, make_account, make_position, make_transaction):
    conta = make_account(initial=5_000)
    bot = make_position(name="bot")
    make_transaction(conta, 1_000, playlist=bot)

    _registrar(client, **{f"p{bot.id}": 1_500, f"a{conta.id}": 4_000})

    assert _valor(client, bot) == 1_500
    assert client.get("/api/snapshots/current").get_json()["net_worth"] == 5_500
    assert len(client.get("/api/transactions").get_json()["items"]) == 1


def test_zerar_na_planilha_vira_saida_forcada_sem_conta(client, make_account, make_position, make_transaction, summary):
    conta = make_account(initial=5_000)
    bot = make_position(name="bot", opening=608)
    make_transaction(conta, 1_000, playlist=bot)

    _registrar(client, **{f"p{bot.id}": 0, f"a{conta.id}": 4_000})

    assert _valor(client, bot) == 0
    forcada = client.get("/api/transactions").get_json()["items"][0]
    assert forcada["description"] == "Editado à força (planilha)"
    assert (forcada["type"], forcada["amount"], forcada["account_id"]) == ("income", 1_608, None)
    assert summary()["total_balance"] == 4_000  # nenhum dinheiro entrou na conta
    assert summary()["month_income"] == 0  # não é receita do mês

    # Dá para corrigir a descrição sem ter que inventar uma conta.
    response = client.put(f"/api/transactions/{forcada['id']}", json={**forcada, "description": "bot desligado"})
    assert response.status_code == 200, response.get_data(as_text=True)


def test_vender_pela_planilha_usa_o_valor_real_e_nao_gera_saida_forcada(client, make_account, make_position, make_transaction):
    conta = make_account(initial=5_000)
    bot = make_position(name="bot")
    make_transaction(conta, 1_000, playlist=bot)

    response = client.post(
        "/api/snapshots/settle",
        json={"from": {"type": "playlist", "id": bot.id}, "to_account_id": conta.id, "received": 1_200},
    )

    assert response.status_code == 201, response.get_data(as_text=True)
    assert response.get_json()["realized_gain"] == 200
    assert _valor(client, bot) == -200  # negativo = lucro já realizado, como no Caixa
    assert all(t["description"] != "Editado à força (planilha)" for t in client.get("/api/transactions").get_json()["items"])


def _caixa(client, **params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return client.get(f"/api/transactions?{query}").get_json()["items"]


def test_aportei_vira_lancamento_no_caixa_sem_ser_despesa(client, make_account, make_position, summary):
    conta = make_account(initial=5_000)
    bot = make_position(name="bot")

    response = client.post(
        "/api/snapshots/invest",
        json={"to": {"type": "playlist", "id": bot.id}, "from_account_id": conta.id, "amount": 1_000},
    )

    assert response.status_code == 201, response.get_data(as_text=True)
    [aporte] = _caixa(client)
    assert (aporte["description"], aporte["type"], aporte["amount"]) == ("Aporte em bot", "expense", 1_000)
    assert (aporte["account_id"], aporte["playlist_id"], aporte["transfer"]) == (conta.id, bot.id, True)
    assert _valor(client, bot) == 1_000
    resumo = summary()
    assert (resumo["total_balance"], resumo["month_expense"], resumo["net_worth"]) == (4_000, 0, 5_000)


def test_vendi_lanca_o_valor_recebido_na_conta(client, make_account, make_position, make_transaction, summary):
    conta = make_account(initial=0)
    bot = make_position(name="bot", opening=1_000)

    client.post(
        "/api/snapshots/settle",
        json={"from": {"type": "playlist", "id": bot.id}, "to_account_id": conta.id, "received": 1_200},
    )

    [venda] = _caixa(client)
    assert (venda["description"], venda["type"], venda["amount"]) == ("Venda / retorno de bot", "income", 1_200)
    assert summary()["total_balance"] == 1_200
    assert summary()["month_income"] == 0


def test_transferencia_entre_contas_sai_de_uma_entra_na_outra_e_apaga_junto(client, make_account, summary):
    nubank = make_account(name="Nubank", initial=1_000)
    inter = make_account(name="Inter", initial=0)

    client.post(
        "/api/snapshots/transfer",
        json={"from": {"type": "account", "id": nubank.id}, "to": {"type": "account", "id": inter.id}, "amount": 300},
    )

    pontas = {t["account_id"]: t for t in _caixa(client)}
    assert pontas[nubank.id]["type"] == "expense" and pontas[inter.id]["type"] == "income"
    assert {t["description"] for t in pontas.values()} == {"Transferência: Nubank → Inter"}
    saldos = {a["id"]: a["balance"] for a in summary()["accounts_balance"]}
    assert (saldos[nubank.id], saldos[inter.id]) == (700, 300)
    assert (summary()["month_income"], summary()["month_expense"]) == (0, 0)
    assert _caixa(client, scope="cash") == []

    ponta = pontas[inter.id]
    mudar_valor = client.put(f"/api/transactions/{ponta['id']}", json={**ponta, "amount": 1})
    assert mudar_valor.status_code == 400
    assert "apague" in mudar_valor.get_json()["error"]
    assert client.put(f"/api/transactions/{ponta['id']}", json={**ponta, "description": "pro Inter"}).status_code == 200

    assert client.delete(f"/api/transactions/{ponta['id']}").status_code == 204
    assert _caixa(client) == []
    assert summary()["total_balance"] == 1_000


def test_corrigir_saldo_na_planilha_vira_ajuste_no_caixa(client, make_account, summary):
    conta = make_account(initial=1_000)

    _registrar(client, **{f"a{conta.id}": 700})

    [ajuste] = _caixa(client)
    assert (ajuste["description"], ajuste["type"], ajuste["amount"]) == ("Ajuste de saldo (planilha)", "expense", 300)
    assert summary()["total_balance"] == 700
    assert summary()["month_expense"] == 300  # o dinheiro saiu de verdade, só não tinha sido lançado
    assert client.get("/api/accounts").get_json()[0]["initial_balance"] == 1_000


def test_editar_quanto_vale_o_ativo_conta_os_lancamentos(client, make_account, make_position, make_transaction):
    conta = make_account(initial=5_000)
    bot = make_position(name="bot")
    make_transaction(conta, 1_000, playlist=bot)

    assert client.put(f"/api/playlists/{bot.id}", json={"value": 1_500}).status_code == 200

    assert _valor(client, bot) == 1_500
