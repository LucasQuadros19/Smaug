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
    assert _valor(client, bot) == 0
    assert all(t["description"] != "Editado à força (planilha)" for t in client.get("/api/transactions").get_json()["items"])
