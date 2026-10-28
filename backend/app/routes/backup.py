"""Backup por e-mail: a tela de Configurações e o worker que manda.

Só quem criou a primeira conta (o dono do servidor) vê e muda: a cópia do banco
leva os dados de todas as contas. O worker (`flask backup worker`) roda no
container `planilhas`: todo dia às 16h grava a planilha nova e manda o que a
frequência de cada arquivo pede; a cada 30 s atende o botão "Enviar agora".
"""

import calendar
import os
import re
import time
from datetime import date, datetime

from flask import Blueprint, abort, g, jsonify, request
from sqlalchemy import update
from werkzeug.security import check_password_hash

from app.extensions import db
from app.models.backup_config import BackupConfig
from app.models.user import User
from app.routes.auth import MAX_FAILURES, _recent_failures
from app.routes.export import gravar_planilhas
from scripts import enviar_backups as envio

backup_bp = Blueprint("backup", __name__)

FREQUENCIAS = {"diario": "todo dia", "semanal": "toda sexta", "mensal": "todo fim de mês", "desligado": "não envia"}
CAMPOS = {"freq_banco": "banco", "freq_planilha": "planilha"}
ARQUIVOS = tuple(CAMPOS.values())
EMAIL = re.compile(r'[^@\s,;<>"]+@[^@\s,;<>"]+\.[^@\s,;<>".]+')
MAX_DESTINATARIOS = 20
HORA_ENVIO = 16
DIAS_PLANILHA = 14


def _exigir_dono():
    primeiro = User.query.order_by(User.created_at, User.id).first()
    if primeiro is None or primeiro.id != g.user.id:
        abort(403, "Só quem criou a primeira conta mexe no backup")


def _serializar(c):
    return {
        "destinatarios": c.destinatarios or [],
        "freq_banco": c.freq_banco or "diario",
        "freq_planilha": c.freq_planilha or "diario",
        "tem_senha": bool(c.senha),
        "configurado": c.id is not None,
        "ultimo_envio": c.ultimo_envio,
        "envio_pedido_em": c.envio_pedido_em.strftime("%Y-%m-%d %H:%M") if c.envio_pedido_em else None,
    }


@backup_bp.get("")
def ver():
    _exigir_dono()
    return jsonify(_serializar(db.session.get(BackupConfig, 1) or BackupConfig(destinatarios=[])))


@backup_bp.put("")
def salvar():
    _exigir_dono()
    data = request.get_json(silent=True) or {}
    if _recent_failures(g.user.id) >= MAX_FAILURES:
        return jsonify({"error": "Muitas tentativas erradas. Espere 15 minutos e tente de novo."}), 429
    senha_login = data.get("senha_login")
    # 400, não 401: a tela trata 401 como sessão expirada e desloga.
    if not isinstance(senha_login, str) or not check_password_hash(g.user.password_hash, senha_login):
        _recent_failures(g.user.id, add=True)
        return jsonify({"error": "Senha incorreta — nada foi alterado"}), 400

    lista = data.get("destinatarios")
    if not isinstance(lista, list) or len(lista) > MAX_DESTINATARIOS:
        abort(400, f"Informe até {MAX_DESTINATARIOS} e-mails")
    destinatarios = []
    for d in lista:
        email = str(d.get("email") or "").strip().lower() if isinstance(d, dict) else ""
        if len(email) > 120 or not EMAIL.fullmatch(email):
            abort(400, f"E-mail inválido: {email or '(vazio)'}")
        if any(x["email"] == email for x in destinatarios):
            abort(400, f"E-mail repetido: {email}")
        destinatarios.append({"email": email, "banco": d.get("banco") is True})

    if any(data.get(campo) not in FREQUENCIAS for campo in CAMPOS):
        abort(400, "Frequência inválida")

    nova = data.get("senha_arquivos") or ""
    if not isinstance(nova, str) or (nova and not (12 <= len(nova) <= 64 and nova.isprintable())):
        abort(400, "A senha dos arquivos precisa ter de 12 a 64 caracteres")

    cfg = db.session.get(BackupConfig, 1)
    if cfg is None:
        cfg = BackupConfig(id=1)
        db.session.add(cfg)
    cfg.destinatarios = destinatarios
    for campo in CAMPOS:
        setattr(cfg, campo, data[campo])
    if nova:
        cfg.senha = nova
    db.session.commit()
    return jsonify(_serializar(cfg))


@backup_bp.post("/enviar")
def pedir_envio():
    _exigir_dono()
    cfg = db.session.get(BackupConfig, 1)
    if cfg is None or not cfg.destinatarios:
        abort(400, "Salve a lista de e-mails antes de enviar")
    if not cfg.envio_pedido_em:
        cfg.envio_pedido_em = datetime.now()
        db.session.commit()
    return jsonify(_serializar(cfg))


# ---------------------------------------------------------------- worker


def ler_config():
    """A tela de Configurações. Enquanto ela não for salva, vale o .env do servidor."""
    cfg = db.session.get(BackupConfig, 1)
    if cfg is None:
        emails = [e.strip() for e in os.environ.get("BACKUP_EMAIL", "").split(",") if e.strip()]
        return {"destinatarios": [{"email": e, "banco": True} for e in emails],
                "senha": os.environ.get("BACKUP_SENHA"), "banco": "diario", "planilha": "diario"}
    return {"destinatarios": cfg.destinatarios or [], "senha": cfg.senha or os.environ.get("BACKUP_SENHA"),
            "banco": cfg.freq_banco, "planilha": cfg.freq_planilha}


def arquivos_do_dia(cfg, hoje):
    fim_do_mes = hoje.day == calendar.monthrange(hoje.year, hoje.month)[1]
    vale = {"diario": True, "semanal": hoje.weekday() == 4, "mensal": fim_do_mes}
    return {a for a in ARQUIVOS if vale.get(cfg[a], False)}


def grupos(destinatarios, arquivos):
    """Quem recebe o banco num e-mail, quem não recebe em outro. Grupo sem arquivo não recebe nada."""
    saida = []
    for com_banco in (True, False):
        emails = [d["email"] for d in destinatarios if bool(d.get("banco")) == com_banco]
        lista = [a for a in ARQUIVOS if a in arquivos and (com_banco or a != "banco")]
        if emails and lista:
            saida.append((emails, lista))
    return saida


def nova_planilha(pasta):
    """A planilha do dia em `pasta`, e fora as com mais de DIAS_PLANILHA dias. Devolve o erro, se houver."""
    try:
        gravar_planilhas(os.path.join(pasta, f"planilha-{datetime.now():%Y%m%d-%H%M%S}.xlsx"))
    except Exception as erro:  # noqa: BLE001
        return f"a planilha de hoje falhou: {erro}"
    limite = time.time() - DIAS_PLANILHA * 86400
    for nome in os.listdir(pasta):
        caminho = os.path.join(pasta, nome)
        # "planilhas-*.zip" são as de antes do Excel.
        if nome.startswith("planilha") and nome.endswith((".xlsx", ".zip")) and os.path.getmtime(caminho) < limite:
            os.remove(caminho)
    return None


def enviar_copia(pasta, hoje=None, arquivos=None):
    """Grava a planilha nova e manda os arquivos do dia (ou `arquivos`): o banco só
    para quem foi marcado, a planilha para todos. O resultado aparece na tela."""
    hoje = hoje or date.today()
    erro_planilha = nova_planilha(pasta)
    if erro_planilha:
        print(erro_planilha)
    cfg = ler_config()
    if not cfg["destinatarios"]:
        print("Backup por e-mail desligado: ninguém na lista.")
        return False
    arquivos = arquivos_do_dia(cfg, hoje) if arquivos is None else set(arquivos)
    envios = grupos(cfg["destinatarios"], arquivos)
    if not envios:
        print("Hoje não sai e-mail (pela frequência de cada arquivo).")
        return False

    achados, problemas = envio.escolher(pasta, time.time())
    if erro_planilha:
        problemas.append(erro_planilha)
    banco = [a for a in achados if a.endswith(".sql.gz")]
    planilha = [a for a in achados if not a.endswith(".sql.gz")]
    base = {
        "BACKUP_NOME": os.environ.get("BACKUP_NOME") or "Smaug",
        "BACKUP_SMTP_USER": os.environ.get("BACKUP_SMTP_USER"),
        "BACKUP_SMTP_PASS": os.environ.get("BACKUP_SMTP_PASS"),
        "BACKUP_SENHA": cfg["senha"],
        "BACKUP_DIAS": os.environ.get("BACKUP_DIAS"),
    }

    # Quem só recebe a planilha não precisa saber do dump do servidor.
    avisos_planilha = ([] if planilha else ["nenhuma planilha"]) + ([erro_planilha] if erro_planilha else [])

    resultados = []
    for emails, lista in envios:
        anexos = (banco if "banco" in lista else []) + (planilha if "planilha" in lista else [])
        avisos = problemas if "banco" in lista else avisos_planilha
        try:
            envio.enviar({**base, "BACKUP_EMAIL": ",".join(emails)}, anexos, avisos)
            ok, motivo = True, ""
        except Exception as erro:  # noqa: BLE001
            ok, motivo = False, str(erro)
            print(f"Falhou para {', '.join(emails)}: {erro}")
        resultados.append((emails, lista, ok, motivo))

    texto = "; ".join(
        f"{' e '.join(lista)} para {', '.join(emails)}" + ("" if ok else f" FALHOU: {motivo[:200]}")
        for emails, lista, ok, motivo in resultados
    )
    if problemas and all(ok for *_, ok, _ in resultados):
        texto += " (com aviso: " + "; ".join(problemas) + ")"
    todos_ok = all(ok for *_, ok, _ in resultados)
    linha = db.session.get(BackupConfig, 1)
    if linha is not None:
        linha.ultimo_envio = {"quando": datetime.now().strftime("%Y-%m-%d %H:%M"), "ok": todos_ok, "texto": texto}
        db.session.commit()
    return todos_ok


def atender_pedido(pasta):
    """Botão "Enviar agora": os dois arquivos para a lista salva."""
    pedido = db.session.execute(
        update(BackupConfig)
        .where(BackupConfig.id == 1, BackupConfig.envio_pedido_em.isnot(None))
        .values(envio_pedido_em=None)
    ).rowcount
    db.session.commit()
    if pedido:
        print("Pedido de envio pela tela: os dois arquivos agora.")
        enviar_copia(pasta, arquivos=ARQUIVOS)


@backup_bp.cli.command("worker")
def worker():
    """Fica rodando: envio das 16h e o botão "Enviar agora"."""
    pasta = os.environ.get("BACKUP_PASTA") or "/backups"
    print(f"Backup por e-mail: todo dia às {HORA_ENVIO}h, arquivos em {pasta}.")
    feito_em = None
    while True:
        agora = datetime.now()
        try:
            if agora.hour == HORA_ENVIO and feito_em != agora.date():
                feito_em = agora.date()
                enviar_copia(pasta, agora.date())
            atender_pedido(pasta)
        except Exception as erro:  # noqa: BLE001
            db.session.rollback()
            print(f"Falha no worker do backup: {erro}")
        finally:
            db.session.remove()
        time.sleep(30)
