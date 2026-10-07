"""Cadastro, login, sessão e preferências."""

import pytest
from conftest import SENHA, new_app

from app.extensions import db
from app.models.account import Account
from app.models.category import DEFAULT_CATEGORIES, Category
from app.tenancy import Owned


def test_api_pede_login(app_limpo):
    anonimo = app_limpo.test_client()
    assert anonimo.get("/api/accounts").status_code == 401
    assert anonimo.get("/api/dashboard/summary").status_code == 401
    assert anonimo.get("/api/auth/me").status_code == 401
    assert anonimo.post("/api/accounts", json={"name": "x"}).status_code == 401


def test_cadastro_entra_logado_com_categorias_padrao(entrar):
    ana = entrar("Ana")
    eu = ana.get("/api/auth/me").get_json()
    assert eu["username"] == "ana"
    assert len(eu["id"]) == 36
    assert len(ana.get("/api/categories").get_json()) == len(DEFAULT_CATEGORIES)


def test_cookie_de_sessao_protegido(app_limpo):
    response = app_limpo.test_client().post("/api/auth/signup", json={"username": "ana", "password": SENHA})
    cookie = response.headers["Set-Cookie"]
    assert "HttpOnly" in cookie and "SameSite=Lax" in cookie


def test_cadastro_recusa_repetido_e_dado_ruim(entrar, app_limpo):
    entrar("ana")
    anonimo = app_limpo.test_client()
    assert anonimo.post("/api/auth/signup", json={"username": "ANA ", "password": SENHA}).status_code == 409
    assert anonimo.post("/api/auth/signup", json={"username": "a", "password": SENHA}).status_code == 400
    assert anonimo.post("/api/auth/signup", json={"username": "<script>", "password": SENHA}).status_code == 400
    assert anonimo.post("/api/auth/signup", json={"username": "bia", "password": "curta"}).status_code == 400
    assert anonimo.post("/api/auth/signup", json={"username": "bia", "password": ["x" * 9]}).status_code == 400


def test_login_e_logout(entrar, app_limpo):
    ana = entrar("ana")
    assert ana.post("/api/auth/logout", json={}).status_code == 204
    assert ana.get("/api/auth/me").status_code == 401

    assert ana.post("/api/auth/login", json={"username": "ana", "password": "errada-123"}).status_code == 401
    assert ana.post("/api/auth/login", json={"username": "ninguem", "password": SENHA}).status_code == 401
    assert ana.post("/api/auth/login", json={"username": "Ana", "password": SENHA}).status_code == 200
    assert ana.get("/api/auth/me").get_json()["username"] == "ana"


def test_bloqueia_depois_de_5_senhas_erradas(entrar, app_limpo):
    entrar("ana")
    anonimo = app_limpo.test_client()
    for _ in range(5):
        assert anonimo.post("/api/auth/login", json={"username": "ana", "password": "errada-123"}).status_code == 401
    assert anonimo.post("/api/auth/login", json={"username": "ana", "password": SENHA}).status_code == 429


def test_primeira_conta_fica_com_os_dados_de_antes(entrar, app_limpo):
    with app_limpo.app_context():
        db.session.add_all([Account(name="Conta antiga", type="cash"), Category(name="Categoria antiga", type="expense")])
        db.session.commit()

    ana = entrar("ana")
    assert [a["name"] for a in ana.get("/api/accounts").get_json()] == ["Conta antiga"]
    # Já tinha categoria: não ganha as padrão por cima.
    assert [c["name"] for c in ana.get("/api/categories").get_json()] == ["Categoria antiga"]
    assert ana.get("/api/auth/me").get_json()["hidden_tabs"] == []

    bia = entrar("bia")
    assert bia.get("/api/accounts").get_json() == []
    assert len(bia.get("/api/categories").get_json()) == len(DEFAULT_CATEGORIES)
    assert bia.get("/api/auth/me").get_json()["hidden_tabs"] == ["/bot", "/mercado"]


def test_abas_escondidas(entrar):
    entrar("ana")
    bia = entrar("bia")
    response = bia.put("/api/auth/me", json={"hidden_tabs": ["/mercado", "/metas", "/metas"]})
    assert response.get_json()["hidden_tabs"] == ["/mercado", "/metas"]
    assert bia.get("/api/auth/me").get_json()["hidden_tabs"] == ["/mercado", "/metas"]
    for ruim in ("/mercado", ["javascript:alert(1)"], [1], ["/Mercado"], ["/x"] * 41):
        assert bia.put("/api/auth/me", json={"hidden_tabs": ruim}).status_code == 400


def test_todo_model_de_dados_tem_dono():
    # Usuário e compartilhamento são da conta, não dados financeiros: as rotas filtram pelo usuário logado.
    sem_dono = {m.class_.__name__ for m in db.Model.registry.mappers if not issubclass(m.class_, Owned)}
    assert sem_dono == {"User", "Share"}


def test_secret_key_fraca_nao_sobe(tmp_path):
    with pytest.raises(RuntimeError):
        new_app(tmp_path, SECRET_KEY="123")


def test_trocar_senha_desconecta_os_outros_aparelhos(entrar, app_limpo):
    celular = entrar("ana")
    computador = app_limpo.test_client()
    assert computador.post("/api/auth/login", json={"username": "ana", "password": SENHA}).status_code == 200

    assert celular.post("/api/auth/password", json={"current": "errada-123", "new": "nova-senha-1"}).status_code == 400
    assert celular.post("/api/auth/password", json={"current": SENHA, "new": "curta"}).status_code == 400
    assert celular.post("/api/auth/password", json={"current": SENHA, "new": "nova-senha-1"}).status_code == 204

    assert celular.get("/api/auth/me").status_code == 200
    assert computador.get("/api/auth/me").status_code == 401
    anonimo = app_limpo.test_client()
    assert anonimo.post("/api/auth/login", json={"username": "ana", "password": SENHA}).status_code == 401
    assert anonimo.post("/api/auth/login", json={"username": "ana", "password": "nova-senha-1"}).status_code == 200
