"""Ponte para a API do bot (repositório bot-trader): a tela fala com o Smaug e o Smaug com o bot.

O token do bot fica só aqui no servidor; o navegador nunca o vê. Os robôs mexem com
dinheiro de verdade, então só entra quem está em BOT_USERS, vendo a própria conta
(com dados compartilhados na tela, a checagem de compartilhamento já barra antes).
"""

import json
import re
import urllib.error
import urllib.parse
import urllib.request

from flask import Blueprint, abort, current_app, g, request

bot_bp = Blueprint("bot", __name__)

_CAMINHO = re.compile(r"(estrategias|backtest|contas|robos)(/[a-z0-9-]{1,64}){0,2}")
_PARAMETROS = ("limite",)
_OFFLINE = "O bot não respondeu. Ele está ligado? (BOT_API_URL no .env do Smaug)"


@bot_bp.before_request
def so_quem_pode():
    usuarios = {u.strip().lower() for u in current_app.config["BOT_USERS"].split(",") if u.strip()}
    if g.user.username not in usuarios:
        abort(403, "Seu usuário não tem acesso ao bot (BOT_USERS no .env do Smaug)")
    if not current_app.config["BOT_API_TOKEN"]:
        abort(503, "Bot não configurado: defina BOT_API_TOKEN no .env do Smaug")


def _json(corpo):
    try:
        return json.loads(corpo) if corpo else None
    except ValueError:
        return None


@bot_bp.route("/<path:caminho>", methods=["GET", "POST", "PUT", "DELETE"])
def repassar(caminho):
    if not _CAMINHO.fullmatch(caminho):
        abort(404)
    query = urllib.parse.urlencode({k: request.args[k] for k in _PARAMETROS if k in request.args})
    url = f"{current_app.config['BOT_API_URL'].rstrip('/')}/api/v1/{caminho}" + (f"?{query}" if query else "")
    pedido = urllib.request.Request(
        url,
        data=json.dumps(request.get_json()).encode() if request.method in ("POST", "PUT") else None,
        method=request.method,
        headers={"Authorization": f"Bearer {current_app.config['BOT_API_TOKEN']}", "Content-Type": "application/json"},
    )
    # A primeira simulação de um par baixa anos de velas da Bybit: pode levar um minuto.
    try:
        with urllib.request.urlopen(pedido, timeout=120 if caminho.startswith("backtest") else 20) as resposta:
            corpo = resposta.read()
            return (_json(corpo) if corpo else ""), resposta.status
    except urllib.error.HTTPError as erro:
        if erro.code == 401:
            return {"error": "O bot recusou o token: o BOT_API_TOKEN do Smaug e o do bot precisam ser iguais"}, 502
        mensagem = (_json(erro.read()) or {}).get("error") or f"O bot respondeu com erro {erro.code}"
        return {"error": mensagem}, erro.code if erro.code < 500 else 502
    except OSError:
        return {"error": _OFFLINE}, 502
