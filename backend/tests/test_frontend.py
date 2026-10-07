"""Em produção o Flask entrega o frontend compilado junto com a API."""

from conftest import new_app


def test_frontend_compilado_e_servido_sem_engolir_a_api(tmp_path):
    dist = tmp_path / "dist"
    (dist / "assets").mkdir(parents=True)
    (dist / "index.html").write_text("tela")
    (dist / "assets" / "app.js").write_text("js")
    (tmp_path / "segredo.txt").write_text("fora do dist")

    client = new_app(tmp_path, FRONTEND_DIST=str(dist)).test_client()

    assert client.get("/").get_data(as_text=True) == "tela"
    assert client.get("/grupos/3").get_data(as_text=True) == "tela"
    assert client.get("/assets/app.js").get_data(as_text=True) == "js"
    assert client.get("/assets/..%2f..%2fsegredo.txt").get_data(as_text=True) == "tela"
    assert client.get("/").headers["X-Frame-Options"] == "DENY"

    response = client.get("/api/nao-existe")
    assert response.status_code == 401
    assert "error" in response.get_json()
