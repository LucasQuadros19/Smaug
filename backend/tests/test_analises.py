"""Tela de Análises (sobra e gastos por período) e o X dos avisos do Dashboard."""

from datetime import date, timedelta

from app.models.recurring import RecurringTransaction


def analises(client, **params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    response = client.get(f"/api/transactions/analytics?{query}")
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.get_json()


def test_mes_a_mes_com_sobra_e_categorias(client, db, make_account, make_category, make_position, make_transaction):
    conta = make_account()
    mercado = make_category("Mercado")
    salario = make_category("Salário", "income")
    investimento = make_position("bolsa")
    moto = make_position("moto", opening=30000, asset_type="vehicle")

    make_transaction(conta, 5000, "income", category=salario, when=date(2025, 1, 5))
    make_transaction(conta, 800, category=mercado, when=date(2025, 1, 10)).description = "Mercado"
    make_transaction(conta, 200, category=mercado, when=date(2025, 1, 20)).description = "mercado"
    make_transaction(conta, 300, playlist=moto, when=date(2025, 3, 2)).description = "Gasolina"
    db.session.commit()
    # Aportar não é gasto: fica fora, como no Dashboard.
    make_transaction(conta, 1000, playlist=investimento, when=date(2025, 3, 3))
    make_transaction(conta, 999, category=mercado, when=date(2024, 12, 31))

    data = analises(client, granularity="month", ref="2025-06-15")
    assert (data["start"], data["end"]) == ("2025-01-01", "2025-12-31")
    assert [p["period"] for p in data["periods"]][:3] == ["2025-01", "2025-02", "2025-03"]
    janeiro, fevereiro, marco = data["periods"][:3]
    assert (janeiro["income"], janeiro["expense"]) == (5000, 1000)
    assert janeiro["categories"] == {str(mercado.id): {"total": 1000, "count": 2}}
    assert (fevereiro["income"], fevereiro["expense"]) == (0, 0)
    assert marco["expense"] == 300 and marco["categories"] == {"0": {"total": 300, "count": 1}}

    assert [(c["name"], c["total"]) for c in data["categories"]] == [("Mercado", 1000), ("Sem categoria", 300)]
    assert data["top_descriptions"] == [
        {"description": "Mercado", "total": 1000, "count": 2, "icon": "💰"},
        {"description": "Gasolina", "total": 300, "count": 1, "icon": "—"},
    ]


def test_dias_semanas_e_anos(client, make_account, make_transaction):
    conta = make_account()
    make_transaction(conta, 50, when=date(2025, 2, 3))
    make_transaction(conta, 70, when=date(2023, 5, 1))

    dias = analises(client, granularity="day", ref="2025-02-20")
    assert len(dias["periods"]) == 28 and dias["periods"][2] == {
        "period": "2025-02-03", "start": "2025-02-03", "end": "2025-02-03",
        "income": 0, "expense": 50, "informed": None, "categories": {"0": {"total": 50, "count": 1}},
    }
    # Fevereiro de 2025 tem 4 de cada dia da semana; dia 3 é segunda.
    assert dias["weekdays"][0] == {"weekday": 0, "total": 50, "average": 12.5}

    semanas = analises(client, granularity="week", ref="2025-02-05")
    assert len(semanas["periods"]) == 13
    assert semanas["periods"][-1]["period"] == "2025-02-03" and semanas["periods"][-1]["expense"] == 50

    anos = analises(client, granularity="year")
    assert anos["periods"][0]["period"] == "2023" and anos["periods"][0]["expense"] == 70
    assert anos["periods"][-1]["period"] == str(date.today().year)


def test_parametros_invalidos(client):
    assert client.get("/api/transactions/analytics?granularity=hora").status_code == 400
    assert client.get("/api/transactions/analytics?ref=2025-13-01").status_code == 400
    assert client.get("/api/transactions/analytics?ref=0001-01-01").status_code == 400


def test_esconder_aviso_e_mostrar_de_novo(client, db, make_account, summary):
    conta = make_account()
    luz = RecurringTransaction(
        description="Luz", amount=200, type="expense", account_id=conta.id,
        frequency="monthly", next_due_date=date.today() - timedelta(days=2), auto=False,
    )
    db.session.add(luz)
    db.session.commit()

    aviso = summary()["alerts"][0]
    assert aviso["key"] == f"recorrente:{luz.id}:{luz.next_due_date.isoformat()}"

    assert client.post("/api/auth/me/dismissed-alerts", json={"key": aviso["key"]}).status_code == 204
    data = summary()
    assert data["alerts"] == [] and data["alerts_hidden"] == 1

    # O mês seguinte é outro aviso: volta a aparecer sozinho.
    luz.next_due_date = date.today() + timedelta(days=1)
    db.session.commit()
    assert summary()["alerts"][0]["title"] == "Lançar Luz"

    luz.next_due_date = date.today() - timedelta(days=2)
    db.session.commit()
    assert summary()["alerts"] == []
    assert client.put("/api/auth/me", json={"dismissed_alerts": []}).status_code == 200
    assert summary()["alerts"][0]["key"] == aviso["key"]


def test_aviso_invalido(client):
    for key in (None, 12, "", "sem-dois-pontos", "x:" + "1" * 61, "Maiúscula:1", "a:<script>"):
        assert client.post("/api/auth/me/dismissed-alerts", json={"key": key}).status_code == 400
    assert client.put("/api/auth/me", json={"dismissed_alerts": "tudo"}).status_code == 400
    assert client.put("/api/auth/me", json={"dismissed_alerts": ["ok:1"] * 201}).status_code == 400


def test_primeiro_ano_e_so_da_propria_conta(entrar):
    ana, bia = entrar("ana"), entrar("bia")
    conta = ana.post("/api/accounts", json={"name": "Conta", "type": "checking"}).get_json()["id"]
    ana.post("/api/transactions", json={"description": "Antigo", "account_id": conta, "amount": 10,
                                        "type": "expense", "date": "2020-05-01"})
    assert analises(ana, granularity="year")["periods"][0]["period"] == "2020"
    assert [p["period"] for p in analises(bia, granularity="year")["periods"]] == [str(date.today().year)]

    ana.put("/api/categories/order", json={"ids": [c["id"] for c in ana.get("/api/categories").get_json()]})
    nova = bia.post("/api/categories", json={"name": "Nova", "type": "expense"})
    assert nova.status_code == 201
    assert [c["name"] for c in bia.get("/api/categories?type=expense").get_json()][-1] == "Nova"


def test_sobra_informada_no_mes_e_somada_no_ano(client):
    assert client.put("/api/transactions/leftovers/2025-03", json={"amount": 650}).status_code == 204
    assert client.put("/api/transactions/leftovers/2025-04", json={"amount": -120.5}).status_code == 204
    assert client.put("/api/transactions/leftovers/2025-03", json={"amount": 700}).status_code == 204

    meses = analises(client, granularity="month", ref="2025-01-01")["periods"]
    assert [p["informed"] for p in meses[1:5]] == [None, 700, -120.5, None]
    anos = {p["period"]: p["informed"] for p in analises(client, granularity="year")["periods"]}
    assert anos["2025"] == 579.5
    assert analises(client, granularity="day", ref="2025-03-01")["periods"][0]["informed"] is None

    assert client.put("/api/transactions/leftovers/2025-03", json={"amount": None}).status_code == 204
    assert analises(client, granularity="month", ref="2025-01-01")["periods"][2]["informed"] is None


def test_sobra_informada_invalida(client):
    for month in ("2025-13", "2025", "1900-01", "2025-03-01"):
        assert client.put(f"/api/transactions/leftovers/{month}", json={"amount": 1}).status_code == 400, month
    assert client.put("/api/transactions/leftovers/2025-03", json={"amount": "muito"}).status_code == 400


def test_sobra_informada_e_de_cada_conta(entrar):
    ana, bia = entrar("ana"), entrar("bia")
    assert ana.put("/api/transactions/leftovers/2025-03", json={"amount": 650}).status_code == 204
    assert bia.put("/api/transactions/leftovers/2025-03", json={"amount": 10}).status_code == 204
    assert analises(ana, granularity="month", ref="2025-01-01")["periods"][2]["informed"] == 650
    assert analises(bia, granularity="month", ref="2025-01-01")["periods"][2]["informed"] == 10


def test_mes_que_comeca_no_dia_24(client, make_account, make_transaction):
    conta = make_account()
    make_transaction(conta, 5000, "income", when=date(2026, 11, 24))
    make_transaction(conta, 1000, "income", when=date(2026, 12, 5))
    make_transaction(conta, 300, when=date(2026, 11, 23))
    make_transaction(conta, 700, when=date(2026, 12, 23))
    make_transaction(conta, 90, when=date(2026, 12, 24))
    assert client.put("/api/auth/me", json={"settings": {"month_start_day": 24}}).status_code == 200
    client.put("/api/transactions/leftovers/2026-12", json={"amount": 5300})

    meses = {p["period"]: p for p in analises(client, granularity="month", ref="2026-12-10")["periods"]}
    dezembro = meses["2026-12"]
    assert (dezembro["start"], dezembro["end"]) == ("2026-11-24", "2026-12-23")
    assert (dezembro["income"], dezembro["expense"], dezembro["informed"]) == (6000, 700, 5300)
    assert meses["2026-11"]["expense"] == 300
    assert meses["2026-01"]["start"] == "2025-12-24"

    # 24/12 em diante já é janeiro do ano seguinte.
    janeiro = analises(client, granularity="month", ref="2026-12-28")["periods"][0]
    assert (janeiro["period"], janeiro["expense"]) == ("2027-01", 90)
    anos = {p["period"]: p for p in analises(client, granularity="year")["periods"]}
    assert (anos["2026"]["start"], anos["2026"]["end"]) == ("2025-12-24", "2026-12-23")
    assert anos["2026"]["income"] == 6000

    for ruim in (0, 29, 2.5, "24"):
        assert client.put("/api/auth/me", json={"settings": {"month_start_day": ruim}}).status_code == 400
    # A tela manda o dia no pedido; vale ele, não o salvo.
    assert analises(client, granularity="month", ref="2026-12-10", month_start=1)["periods"][11]["start"] == "2026-12-01"
    assert client.get("/api/transactions/analytics?month_start=29").status_code == 400
