"""Calendário: recorrentes pagas e previstas, empréstimos, previsões, metas e eventos."""

from datetime import date, timedelta

from test_shares import como, ligar


def _mes(client, mes):
    response = client.get(f"/api/calendar?month={mes}")
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.get_json()["items"]


def test_recorrente_paga_e_as_proximas_aparecem(client, make_account):
    """A ocorrência já lançada fica no dia dela como paga; as próximas, como previstas."""
    conta = make_account()
    hoje = date.today()
    primeiro = hoje.replace(day=1)
    client.post(
        "/api/recurring",
        json={"description": "Faxina", "account_id": conta.id, "type": "expense", "amount": 150,
              "frequency": "weekly", "next_due_date": primeiro.isoformat()},
    )
    client.post("/api/recurring/generate", json={})

    semanas = [primeiro + timedelta(weeks=n) for n in range(6) if (primeiro + timedelta(weeks=n)).month == hoje.month]
    itens = _mes(client, hoje.strftime("%Y-%m"))

    assert [(i["date"], i["status"] == "done") for i in itens] == [(d.isoformat(), d <= hoje) for d in semanas]
    assert all(i["direction"] == "out" and i["amount"] == 150 for i in itens)


def test_recorrente_futura_aparece_nos_meses_seguintes(client, make_account):
    conta = make_account()
    client.post(
        "/api/recurring",
        json={"description": "Salário", "account_id": conta.id, "type": "income", "amount": 5_000,
              "frequency": "monthly", "next_due_date": "2030-01-31", "auto": False},
    )
    fevereiro = _mes(client, "2030-02")
    assert [(i["date"], i["kind"], i["direction"]) for i in fevereiro] == [("2030-02-28", "income", "in")]
    assert _mes(client, "2030-03")[0]["date"] == "2030-03-31"


def test_emprestimo_previsao_meta_e_evento(client, make_account, make_position):
    conta = make_account()
    ativo = make_position(name="obra")
    loan = client.post(
        "/api/loans",
        json={"borrower": "Carlos", "amount": 1_000, "start_date": "2030-05-02", "due_date": "2030-05-20",
              "participants": [{"name": "Eu", "contributed": 1_000, "to_receive": 1_100, "is_me": True}]},
    ).get_json()
    client.post(f"/api/loans/{loan['id']}/repayments", json={"account_id": conta.id, "amount": 300, "date": "2030-05-10"})
    client.post("/api/expectations", json={"playlist_id": ativo.id, "description": "Parcela", "amount": 200, "expected_date": "2030-05-15"})
    client.post("/api/goals", json={"name": "Reserva", "target_amount": 10_000, "deadline": "2030-05-31"})
    evento = client.post("/api/calendar/events", json={"title": "IPVA", "date": "2030-05-05", "amount": 900, "direction": "out"})
    assert evento.status_code == 201

    itens = {i["title"]: i for i in _mes(client, "2030-05")}

    assert itens["Emprestou para Carlos"]["date"] == "2030-05-02"
    assert itens["Recebido de Carlos"]["status"] == "done"
    assert itens["Retorno de Carlos"]["amount"] == 1_100
    assert itens["Parcela · obra"]["link"] == f"/ativos/{ativo.id}"
    assert itens["Prazo da meta Reserva"]["kind"] == "goal"
    assert itens["IPVA"]["event"]["amount"] == 900


def test_evento_editar_apagar_e_validar(client):
    evento = client.post("/api/calendar/events", json={"title": "Consulta", "date": "2030-01-10"}).get_json()
    assert evento["amount"] is None and evento["direction"] is None

    editado = client.put(f"/api/calendar/events/{evento['id']}", json={"title": "Dentista", "color": "#22c55e"}).get_json()
    assert editado["title"] == "Dentista" and editado["date"] == "2030-01-10"

    assert client.post("/api/calendar/events", json={"date": "2030-01-10"}).status_code == 400
    assert client.post("/api/calendar/events", json={"title": "X", "date": "2030-01-10", "direction": "lado"}).status_code == 400
    assert client.get("/api/calendar?month=2030-13").status_code == 400
    assert client.get("/api/calendar?month=9999-12").status_code == 400
    assert client.delete(f"/api/calendar/events/{evento['id']}").status_code == 204
    assert _mes(client, "2030-01") == []


def test_compartilhado_mostra_so_as_partes_liberadas(entrar):
    ana, bia = entrar("ana"), entrar("bia")
    ana.post("/api/loans", json={"borrower": "Devedor", "amount": 100, "start_date": "2030-06-01"})
    ana.post("/api/calendar/events", json={"title": "Particular", "date": "2030-06-02"})
    ligar(ana, bia, ["emprestimos"])

    ver = como(bia, ana)
    titulos = [i["title"] for i in ver("get", "/api/calendar?month=2030-06").get_json()["items"]]

    assert titulos == ["Emprestou para Devedor"]
    assert ver("post", "/api/calendar/events", json={"title": "X", "date": "2030-06-03"}).status_code == 403
