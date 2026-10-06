"""Folhas de cálculo: só guardam o texto; as contas são feitas na tela."""


def test_cria_edita_e_apaga_folha(client):
    sheet = client.post("/api/sheets", json={"title": "Empréstimo Pedro"}).get_json()
    assert sheet["content"] == ""

    texto = "capital = 10.000\njuros: capital * 10%\nsoma"
    salvo = client.put(f"/api/sheets/{sheet['id']}", json={"content": texto}).get_json()
    assert salvo["content"] == texto

    assert client.put(f"/api/sheets/{sheet['id']}", json={"title": "  "}).status_code == 400
    assert client.delete(f"/api/sheets/{sheet['id']}").status_code == 204
    assert client.get("/api/sheets").get_json() == []
