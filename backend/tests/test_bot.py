"""Ponte para a API do bot: quem pode usar, o que passa e como os erros chegam na tela."""

import io
import json
import urllib.error
import uuid

import pytest

from app.routes import bot as rota_bot


class _Resposta:
    def __init__(self, status, corpo):
        self.status = status
        self._corpo = b"" if corpo is None else json.dumps(corpo).encode()

    def read(self):
        return self._corpo

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False


@pytest.fixture
def bot(app, monkeypatch):
    """Finge a API do bot: guarda os pedidos e responde o que o teste puser em `resposta`."""
    app.config.update(BOT_API_URL="http://bot:8000/", BOT_API_TOKEN="segredo", BOT_USERS="Dono, outro")
    estado = {"pedidos": [], "resposta": (200, {"ok": True})}

    def urlopen(pedido, timeout):
        estado["pedidos"].append((pedido, timeout))
        status, corpo = estado["resposta"]
        if isinstance(status, Exception):
            raise status
        if status >= 400:
            raise urllib.error.HTTPError(pedido.full_url, status, "erro", {}, io.BytesIO(json.dumps(corpo).encode()))
        return _Resposta(status, corpo)

    monkeypatch.setattr(rota_bot.urllib.request, "urlopen", urlopen)
    return estado


def test_repassa_com_o_token_do_servidor(client, bot):
    bot["resposta"] = (200, [{"id": "abc", "status": "ligado"}])
    resposta = client.get("/api/bot/robos")
    assert resposta.status_code == 200 and resposta.get_json() == [{"id": "abc", "status": "ligado"}]
    pedido, timeout = bot["pedidos"][0]
    assert pedido.full_url == "http://bot:8000/api/v1/robos"
    assert pedido.get_header("Authorization") == "Bearer segredo"
    assert timeout == 20


def test_simulacao_manda_o_corpo_e_espera_mais(client, bot):
    client.post("/api/bot/backtest", json={"cripto": "BTCUSDT", "dias": 365})
    pedido, timeout = bot["pedidos"][0]
    assert pedido.get_method() == "POST" and json.loads(pedido.data) == {"cripto": "BTCUSDT", "dias": 365}
    assert timeout == 120

    client.post("/api/bot/backtest/carteira", json={"capital": 110})
    pedido, timeout = bot["pedidos"][1]
    assert pedido.full_url.endswith("/api/v1/backtest/carteira") and timeout == 120


def test_so_passa_o_parametro_conhecido(client, bot):
    client.get("/api/bot/robos/abc123/logs?limite=50&outra=1")
    assert bot["pedidos"][0][0].full_url == "http://bot:8000/api/v1/robos/abc123/logs?limite=50"


def test_excluir_devolve_vazio(client, bot):
    bot["resposta"] = (204, None)
    resposta = client.delete("/api/bot/robos/abc123")
    assert resposta.status_code == 204 and resposta.data == b""


@pytest.mark.parametrize("caminho", ["outra-coisa", "robos/a.b", "robos/a/b/c", "robos/%2e%2e/x", "health"])
def test_caminho_fora_da_lista(client, bot, caminho):
    assert client.get(f"/api/bot/{caminho}").status_code == 404
    assert bot["pedidos"] == []


def test_usuario_fora_de_bot_users(app, client, bot):
    app.config["BOT_USERS"] = "outro"
    resposta = client.get("/api/bot/robos")
    assert resposta.status_code == 403 and "BOT_USERS" in resposta.get_json()["error"]
    assert bot["pedidos"] == []


def test_vendo_conta_compartilhada_nao_mexe_no_bot(client, bot):
    assert client.get("/api/bot/robos", headers={"X-Owner": str(uuid.uuid4())}).status_code == 403
    assert bot["pedidos"] == []


def test_sem_token_configurado(app, client, bot):
    app.config["BOT_API_TOKEN"] = None
    assert client.get("/api/bot/robos").status_code == 503


def test_erro_do_bot_chega_na_tela(client, bot):
    bot["resposta"] = (400, {"error": "Compra › EMA rápida: mínimo 1"})
    resposta = client.post("/api/bot/robos", json={})
    assert resposta.status_code == 400 and resposta.get_json() == {"error": "Compra › EMA rápida: mínimo 1"}


def test_token_errado_nao_desloga_do_smaug(client, bot):
    bot["resposta"] = (401, {"error": "Token do bot inválido"})
    resposta = client.get("/api/bot/robos")
    assert resposta.status_code == 502 and "BOT_API_TOKEN" in resposta.get_json()["error"]


@pytest.mark.parametrize("falha", [urllib.error.URLError("recusado"), TimeoutError()])
def test_bot_desligado(client, bot, falha):
    bot["resposta"] = (falha, None)
    resposta = client.get("/api/bot/contas")
    assert resposta.status_code == 502 and "ligado" in resposta.get_json()["error"]
