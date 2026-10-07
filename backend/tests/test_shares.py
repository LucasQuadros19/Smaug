"""Compartilhamento: só com as duas partes de acordo, só o que cada lado escolheu mostrar."""

import pytest
from conftest import SENHA

TUDO = ["contas", "patrimonio", "emprestimos", "mercado", "calculos"]


def eu(client):
    return client.get("/api/auth/me").get_json()["id"]


def ligar(dono, outro, dono_mostra, outro_mostra=()):
    convite = dono.post("/api/shares", json={"user_id": eu(outro), "sections": dono_mostra})
    assert convite.status_code == 201, convite.get_data(as_text=True)
    aceite = outro.post(f"/api/shares/{convite.get_json()['id']}/accept", json={"sections": list(outro_mostra)})
    assert aceite.status_code == 200, aceite.get_data(as_text=True)
    return convite.get_json()["id"]


@pytest.fixture
def ana(entrar):
    client = entrar("ana")
    conta = client.post("/api/accounts", json={"name": "Conta da Ana", "type": "checking", "initial_balance": 1000}).get_json()
    client.post("/api/loans", json={"borrower": "Devedor da Ana", "amount": 100, "start_date": "2026-10-01"})
    client.post(
        "/api/transactions",
        json={"description": "Gasto da Ana", "account_id": conta["id"], "amount": 10, "type": "expense", "date": "2026-10-01"},
    )
    return client


def como(client, dono):
    """Chamadas do `client` olhando os dados de `dono`."""
    headers = {"X-Owner": eu(dono)}
    return lambda method, url, **kw: getattr(client, method)(url, headers=headers, **kw)


def test_convite_aceite_e_cada_lado_escolhe(ana, entrar):
    bia = entrar("bia")
    convite = ana.post("/api/shares", json={"user_id": eu(bia), "sections": ["emprestimos"]}).get_json()
    assert convite["status"] == "outgoing" and convite["user"]["username"] == "bia"
    recebido = bia.get("/api/shares").get_json()[0]
    assert recebido["status"] == "incoming"
    assert recebido["they_share"] == ["emprestimos"] and recebido["i_share"] == []

    bia.post(f"/api/shares/{convite['id']}/accept", json={"sections": ["mercado", "contas"]})
    lado_ana = ana.get("/api/shares").get_json()[0]
    assert lado_ana["status"] == "active"
    assert lado_ana["i_share"] == ["emprestimos"] and lado_ana["they_share"] == ["contas", "mercado"]


def test_convite_errado_e_ninguem_mexe_no_compartilhamento_dos_outros(ana, entrar):
    bia, carla = entrar("bia"), entrar("carla")
    assert ana.post("/api/shares", json={"user_id": eu(ana), "sections": []}).status_code == 400
    assert ana.post("/api/shares", json={"user_id": "1", "sections": []}).status_code == 400
    assert ana.post("/api/shares", json={"user_id": "00000000-0000-4000-8000-000000000000", "sections": []}).status_code == 404
    assert ana.post("/api/shares", json={"user_id": eu(bia), "sections": ["senhas"]}).status_code == 400
    assert ana.post("/api/shares", json={"user_id": eu(bia), "sections": "tudo"}).status_code == 400

    share = ana.post("/api/shares", json={"user_id": eu(bia), "sections": []}).get_json()["id"]
    assert ana.post("/api/shares", json={"user_id": eu(bia), "sections": []}).status_code == 409
    assert bia.post("/api/shares", json={"user_id": eu(ana), "sections": []}).status_code == 409
    assert ana.post(f"/api/shares/{share}/accept", json={"sections": []}).status_code == 400
    assert bia.put(f"/api/shares/{share}", json={"sections": TUDO}).status_code == 400

    assert carla.get("/api/shares").get_json() == []
    assert carla.post(f"/api/shares/{share}/accept", json={"sections": []}).status_code == 404
    assert carla.put(f"/api/shares/{share}", json={"sections": []}).status_code == 404
    assert carla.delete(f"/api/shares/{share}").status_code == 404


def test_quem_recebe_ve_e_edita_so_o_que_foi_compartilhado(ana, entrar):
    bia = entrar("bia")
    ligar(ana, bia, ["emprestimos"])
    pedir = como(bia, ana)

    emprestimo = pedir("get", "/api/loans").get_json()[0]
    assert emprestimo["borrower"] == "Devedor da Ana"
    assert pedir("put", f"/api/loans/{emprestimo['id']}", json={"notes": "editado pela bia"}).status_code == 200
    assert pedir("post", "/api/loans", json={"borrower": "Novo da Bia", "amount": 5, "start_date": "2026-10-02"}).status_code == 201
    da_ana = {loan["borrower"]: loan for loan in ana.get("/api/loans").get_json()}
    assert da_ana["Devedor da Ana"]["notes"] == "editado pela bia"
    assert "Novo da Bia" in da_ana
    assert bia.get("/api/loans").get_json() == []

    # Os formulários listam contas e ativos, mas só com nome.
    contas = pedir("get", "/api/accounts").get_json()
    assert contas == [{"id": contas[0]["id"], "name": "Conta da Ana", "type": "checking", "color": "#6366f1"}]
    assert "opening_value" not in str(pedir("get", "/api/playlists").get_json())
    # Recebimento de empréstimo cai numa conta de quem compartilhou.
    recebimento = pedir("post", f"/api/loans/{emprestimo['id']}/repayments", json={"account_id": contas[0]["id"], "amount": 10})
    assert recebimento.status_code == 201

    for method, url in [
        ("get", "/api/transactions"),
        ("get", f"/api/accounts/{contas[0]['id']}"),
        ("put", f"/api/accounts/{contas[0]['id']}"),
        ("post", "/api/accounts"),
        ("get", "/api/dashboard/summary"),
        ("get", "/api/snapshots"),
        ("get", "/api/goals"),
        ("get", "/api/market"),
        ("get", "/api/sheets"),
        ("get", "/api/export/transacoes.csv"),
        ("post", "/api/recurring/generate"),
    ]:
        kwargs = {"json": {"name": "x"}} if method in ("post", "put") else {}
        assert pedir(method, url, **kwargs).status_code in (403, 405), (method, url)
    assert pedir("get", "/api/export/emprestimos.csv").status_code == 200
    # Link de download não manda cabeçalho: o dono vai no endereço, com a mesma checagem.
    assert "Devedor da Ana" in bia.get(f"/api/export/emprestimos.csv?owner={eu(ana)}").get_data(as_text=True)
    assert bia.get(f"/api/export/transacoes.csv?owner={eu(ana)}").status_code == 403


def test_um_lado_so_nao_abre_o_outro(ana, entrar):
    bia = entrar("bia")
    ligar(ana, bia, ["emprestimos"])
    assert como(ana, bia)("get", "/api/loans").status_code == 403
    carla = entrar("carla")
    assert como(carla, ana)("get", "/api/loans").status_code == 403


def test_convite_pendente_nao_abre_nada(ana, entrar):
    bia = entrar("bia")
    ana.post("/api/shares", json={"user_id": eu(bia), "sections": TUDO})
    assert como(bia, ana)("get", "/api/loans").status_code == 403


def test_mudar_ou_encerrar_corta_o_acesso_na_hora(ana, entrar):
    bia = entrar("bia")
    share = ligar(ana, bia, ["emprestimos"])
    pedir = como(bia, ana)
    assert ana.put(f"/api/shares/{share}", json={"sections": []}).status_code == 200
    assert pedir("get", "/api/loans").status_code == 403
    ana.put(f"/api/shares/{share}", json={"sections": ["emprestimos"]})
    assert pedir("get", "/api/loans").status_code == 200
    assert bia.delete(f"/api/shares/{share}").status_code == 204
    assert pedir("get", "/api/loans").status_code == 403


def test_tudo_abre_o_dashboard_igual_ao_do_dono(ana, entrar):
    bia = entrar("bia")
    ligar(ana, bia, TUDO)
    resumo = como(bia, ana)("get", "/api/dashboard/summary?compact=1")
    assert resumo.status_code == 200
    assert resumo.get_json()["net_worth"] == ana.get("/api/dashboard/summary?compact=1").get_json()["net_worth"]


def test_dados_de_quem_recebe_nao_se_misturam(ana, entrar):
    bia = entrar("bia")
    conta_bia = bia.post("/api/accounts", json={"name": "Conta da Bia", "type": "cash"}).get_json()["id"]
    ligar(ana, bia, ["contas"])
    pedir = como(bia, ana)
    lancamento = {"description": "x", "amount": 1, "type": "expense", "date": "2026-10-01"}
    assert pedir("post", "/api/transactions", json={**lancamento, "account_id": conta_bia}).status_code == 400

    conta_ana = pedir("get", "/api/accounts").get_json()[0]["id"]
    assert pedir("post", "/api/transactions", json={**lancamento, "account_id": conta_ana}).status_code == 201
    assert ana.get("/api/transactions").get_json()["total"] == 2
    assert bia.get("/api/transactions").get_json()["total"] == 0


def test_rotas_da_propria_conta_ignoram_o_cabecalho(ana, entrar):
    bia = entrar("bia")
    ligar(ana, bia, TUDO)
    pedir = como(bia, ana)
    assert pedir("get", "/api/auth/me").get_json()["username"] == "bia"
    pedir("put", "/api/auth/me", json={"hidden_tabs": ["/metas"]})
    assert bia.get("/api/auth/me").get_json()["hidden_tabs"] == ["/metas"]
    assert ana.get("/api/auth/me").get_json()["hidden_tabs"] == []
    assert pedir("post", "/api/auth/password", json={"current": SENHA, "new": "outra-senha-1"}).status_code == 204
    assert ana.post("/api/auth/logout", json={}).status_code == 204
    assert ana.post("/api/auth/login", json={"username": "ana", "password": SENHA}).status_code == 200
