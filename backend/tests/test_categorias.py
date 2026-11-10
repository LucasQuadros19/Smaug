"""Ordem das categorias e a categoria "Repasse" dos empréstimos."""

from app.models.category import Category
from app.models.transaction import Transaction


def nomes(client, tipo="expense"):
    return [c["name"] for c in client.get(f"/api/categories?type={tipo}").get_json()]


def test_ordem_escolhida_vale_nas_listas(client, make_category):
    a, b, c = make_category("Aluguel"), make_category("Bar"), make_category("Café")
    assert nomes(client) == ["Aluguel", "Bar", "Café"]

    assert client.put("/api/categories/order", json={"ids": [c.id, a.id, b.id]}).status_code == 204
    assert nomes(client) == ["Café", "Aluguel", "Bar"]

    nova = client.post("/api/categories", json={"name": "Academia", "type": "expense"}).get_json()
    assert nomes(client)[-1] == "Academia" and nova["id"]


def test_ordem_invalida(client, make_category):
    a = make_category("Aluguel")
    for body in ({}, {"ids": "1,2"}, {"ids": []}, {"ids": [a.id, a.id]}, {"ids": [True]}, {"ids": ["1"]}):
        assert client.put("/api/categories/order", json=body).status_code == 400, body
    assert client.put("/api/categories/order", json={"ids": [a.id, 999999]}).status_code == 404


def test_ordem_nao_mexe_em_categoria_de_outra_conta(entrar):
    ana, bia = entrar("ana"), entrar("bia")
    da_ana = ana.get("/api/categories").get_json()[0]["id"]
    assert bia.put("/api/categories/order", json={"ids": [da_ana]}).status_code == 404


def _receber_com_repasse(client, conta, loan_id, **extra):
    return client.post(
        f"/api/loans/{loan_id}/repayments",
        json={"date": "2026-03-10", "amount": 2000, "my_share": 1000, "partners_share": 1000,
              "account_id": conta.id, **extra},
    ).get_json()


def test_repasse_cria_a_categoria_uma_vez_so(client, db, loan_setup):
    conta, _, loan_id = loan_setup
    assert not Category.query.filter_by(name="Repasse").count()

    _receber_com_repasse(client, conta, loan_id, partners_settled=True)
    loan = _receber_com_repasse(client, conta, loan_id)
    pendente = next(r for r in loan["repayments"] if not r["partners_settled"])
    assert client.post(f"/api/loans/{loan_id}/repayments/{pendente['id']}/settle-partners", json={}).status_code == 200

    repasse = Category.query.filter_by(name="Repasse").one()
    assert (repasse.type, repasse.icon) == ("expense", "🤝")
    saidas = Transaction.query.filter(Transaction.description.like("Repasse a sócios%")).all()
    assert len(saidas) == 2 and {t.category_id for t in saidas} == {repasse.id}
    assert nomes(client)[-1] == "Repasse"


def test_repasse_usa_a_categoria_que_ja_existe(client, loan_setup, make_category):
    conta, _, loan_id = loan_setup
    minha = make_category("repasse")
    _receber_com_repasse(client, conta, loan_id, partners_settled=True)
    saida = Transaction.query.filter(Transaction.description.like("Repasse a sócios%")).one()
    assert saida.category_id == minha.id
    assert Category.query.filter(Category.name.ilike("repasse")).count() == 1


def test_ativo_marcado_como_passivo(client):
    moto = client.post("/api/playlists", json={"name": "moto", "kind": "asset", "asset_type": "vehicle",
                                               "opening_value": 36700}).get_json()
    assert moto["as_liability"] is False
    moto = client.put(f"/api/playlists/{moto['id']}", json={"as_liability": True}).get_json()
    assert moto["as_liability"] is True


def test_zerar_divida_paga_nao_mexe_no_caixa(client, make_account, summary):
    make_account(initial=1000)
    divida = client.post("/api/playlists", json={"name": "dívida", "kind": "asset", "asset_type": "debt",
                                                 "opening_value": -4000}).get_json()
    assert summary()["net_worth"] == -3000

    # Marcar como passivo (sem mandar o valor) não pode mexer na dívida.
    client.put(f"/api/playlists/{divida['id']}", json={"name": "dívida", "as_liability": True})
    assert summary()["net_worth"] == -3000

    paga = client.put(f"/api/playlists/{divida['id']}", json={"value": 0}).get_json()
    assert paga["outstanding"] == 0
    data = summary()
    assert (data["net_worth"], data["total_balance"]) == (1000, 1000)
    assert Transaction.query.count() == 0


def _divida(client, valor=-4000):
    return client.post("/api/playlists", json={"name": "dívida", "kind": "asset", "asset_type": "debt",
                                               "opening_value": valor}).get_json()["id"]


def test_pagar_e_aumentar_divida_com_e_sem_caixa(client, make_account, summary):
    conta = make_account(initial=1000)
    divida = _divida(client)
    url = f"/api/playlists/{divida}/debt"

    # Pago por fora: só a dívida muda.
    assert client.post(url, json={"direction": "pay", "amount": 1500}).status_code == 201
    data = summary()
    assert (data["total_balance"], data["net_worth"]) == (1000, -1500)

    # Pago da conta: a conta paga, o patrimônio não muda.
    assert client.post(url, json={"direction": "pay", "amount": 500, "account_id": conta.id}).status_code == 201
    data = summary()
    assert (data["total_balance"], data["net_worth"]) == (500, -1500)

    # Juros que caíram (sem caixa) e dinheiro que entrou emprestado (com caixa).
    assert client.post(url, json={"direction": "increase", "amount": 200}).status_code == 201
    assert client.post(url, json={"direction": "increase", "amount": 300, "account_id": conta.id}).status_code == 201
    data = summary()
    assert (data["total_balance"], data["net_worth"]) == (800, -1700)
    divida_agora = next(p for p in data["playlists_summary"] if p["id"] == divida)
    assert divida_agora["outstanding"] == -2500
    # Nada disso é gasto ou receita do mês.
    assert (data["month_income"], data["month_expense"]) == (0, 0)


def test_divida_paga_pode_voltar_a_aumentar(client, summary):
    divida = _divida(client)
    client.put(f"/api/playlists/{divida}", json={"value": 0})
    assert client.post(f"/api/playlists/{divida}/debt", json={"direction": "pay", "amount": 1}).status_code == 400
    assert client.post(f"/api/playlists/{divida}/debt", json={"direction": "increase", "amount": 700}).status_code == 201
    assert summary()["net_worth"] == -700


def test_ajuste_de_divida_invalido(client, make_account, make_position):
    divida = _divida(client, -100)
    url = f"/api/playlists/{divida}/debt"
    assert client.post(url, json={"direction": "pay", "amount": 101}).status_code == 400
    assert client.post(url, json={"direction": "sumir", "amount": 1}).status_code == 400
    assert client.post(url, json={"direction": "pay", "amount": -5}).status_code == 400
    assert client.post(url, json={"direction": "pay", "amount": 5, "account_id": 999999}).status_code == 400
    obra = make_position("obra")
    assert client.post(f"/api/playlists/{obra.id}/debt", json={"direction": "pay", "amount": 1}).status_code == 400


def test_divida_fica_fora_de_aportado_e_recebido(client, make_account, make_position, make_transaction, summary):
    conta = make_account(initial=10_000)
    obra = make_position("obra", opening=1000)
    make_transaction(conta, 500, playlist=obra)
    divida = _divida(client)
    client.post(f"/api/playlists/{divida}/debt", json={"direction": "pay", "amount": 1000, "account_id": conta.id})
    client.post(f"/api/playlists/{divida}/debt", json={"direction": "increase", "amount": 2000})

    data = summary()
    assert data["asset_summary"] == {"total_invested": 1500, "total_returned": 0, "total_outstanding": 1500}
    assert data["parked_in_assets"] == 1500 - 5000
