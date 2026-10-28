"""Backup por e-mail pela tela: quem pode mexer, o que é recusado, e o que o worker manda para quem."""

import gzip
from datetime import date, datetime

import pytest

from app.extensions import db
from app.models.backup_config import BackupConfig
from app.routes import backup
from tests.conftest import SENHA

VALIDO = {
    "senha_login": SENHA,
    "destinatarios": [{"email": "Eu@Gmail.com", "banco": True}, {"email": "socio@gmail.com", "banco": False}],
    "freq_banco": "diario",
    "freq_planilha": "semanal",
    "senha_arquivos": "senha-dos-anexos-123",
}


@pytest.fixture
def dono(entrar):
    return entrar("dono")


def test_so_quem_criou_a_primeira_conta_mexe(dono, entrar):
    outro = entrar("outro")
    assert outro.get("/api/backup").status_code == 403
    assert outro.put("/api/backup", json={**VALIDO, "senha_login": SENHA}).status_code == 403
    assert outro.post("/api/backup/enviar", json={}).status_code == 403
    assert dono.get("/api/backup").get_json()["configurado"] is False


def test_salvar_pede_a_senha_do_login_e_nao_devolve_a_dos_anexos(dono, app_limpo):
    errada = dono.put("/api/backup", json={**VALIDO, "senha_login": "errada"})
    assert errada.status_code == 400
    assert dono.get("/api/backup").get_json()["configurado"] is False

    salvo = dono.put("/api/backup", json=VALIDO).get_json()
    assert salvo["destinatarios"] == [{"email": "eu@gmail.com", "banco": True}, {"email": "socio@gmail.com", "banco": False}]
    assert salvo["tem_senha"] is True and salvo["configurado"] is True
    assert "senha" not in salvo and "senha-dos-anexos-123" not in str(salvo)

    # Sem senha nova, a antiga fica.
    dono.put("/api/backup", json={**VALIDO, "senha_arquivos": ""})
    with app_limpo.app_context():
        assert db.session.get(BackupConfig, 1).senha == "senha-dos-anexos-123"


@pytest.mark.parametrize("mudanca", [
    {"destinatarios": [{"email": "sem-arroba"}]},
    {"destinatarios": [{"email": "a@b.com"}, {"email": "A@b.com"}]},
    {"destinatarios": [{"email": f"x{i}@b.com"} for i in range(21)]},
    {"destinatarios": "a@b.com"},
    {"freq_banco": "toda hora"},
    {"senha_arquivos": "curta"},
])
def test_recusa_dado_invalido(dono, mudanca):
    assert dono.put("/api/backup", json={**VALIDO, **mudanca}).status_code == 400
    assert dono.get("/api/backup").get_json()["configurado"] is False


def test_enviar_agora_so_com_lista_salva(dono):
    assert dono.post("/api/backup/enviar", json={}).status_code == 400
    dono.put("/api/backup", json=VALIDO)
    pedido = dono.post("/api/backup/enviar", json={}).get_json()
    assert pedido["envio_pedido_em"] is not None


def test_frequencia_de_cada_arquivo():
    cfg = {"banco": "diario", "planilha": "semanal"}
    assert backup.arquivos_do_dia(cfg, date(2026, 10, 28)) == {"banco"}  # quarta
    assert backup.arquivos_do_dia(cfg, date(2026, 10, 30)) == {"banco", "planilha"}  # sexta
    mensal = {"banco": "mensal", "planilha": "desligado"}
    assert backup.arquivos_do_dia(mensal, date(2026, 10, 30)) == set()
    assert backup.arquivos_do_dia(mensal, date(2026, 10, 31)) == {"banco"}


def test_banco_so_para_quem_foi_marcado():
    destinatarios = [{"email": "a@x.com", "banco": True}, {"email": "b@x.com", "banco": False}]
    assert backup.grupos(destinatarios, {"banco", "planilha"}) == [(["a@x.com"], ["banco", "planilha"]), (["b@x.com"], ["planilha"])]
    assert backup.grupos(destinatarios, {"banco"}) == [(["a@x.com"], ["banco"])]


@pytest.fixture
def mandados(monkeypatch):
    lista = []
    monkeypatch.setattr(backup.envio, "enviar", lambda config, anexos, problemas: lista.append((config, anexos, problemas)))
    monkeypatch.setenv("BACKUP_SMTP_USER", "envia@gmail.com")
    monkeypatch.setenv("BACKUP_SMTP_PASS", "abcd")
    return lista


def _dump(pasta):
    caminho = pasta / f"saldos-{datetime.now():%Y%m%d-%H%M%S}.sql.gz"
    caminho.write_bytes(gzip.compress(b"COPY x;\n-- PostgreSQL database dump complete\n"))
    return str(caminho)


def test_enviar_agora_manda_os_dois_e_mostra_o_resultado(dono, app_limpo, tmp_path, mandados):
    dono.put("/api/backup", json=VALIDO)
    dono.post("/api/backup/enviar", json={})
    sql = _dump(tmp_path)

    with app_limpo.app_context():
        backup.atender_pedido(str(tmp_path))
        backup.atender_pedido(str(tmp_path))  # pedido atendido não manda de novo

    assert len(mandados) == 2
    (com_banco, anexos_banco, _), (sem_banco, anexos_planilha, avisos) = mandados
    assert com_banco["BACKUP_EMAIL"] == "eu@gmail.com" and com_banco["BACKUP_SENHA"] == "senha-dos-anexos-123"
    assert anexos_banco[0] == sql and anexos_banco[1].endswith(".xlsx")
    assert sem_banco["BACKUP_EMAIL"] == "socio@gmail.com"
    assert len(anexos_planilha) == 1 and anexos_planilha[0].endswith(".xlsx") and avisos == []

    tela = dono.get("/api/backup").get_json()
    assert tela["envio_pedido_em"] is None
    assert tela["ultimo_envio"]["ok"] is True
    assert "socio@gmail.com" in tela["ultimo_envio"]["texto"]


def test_falha_no_envio_aparece_na_tela(dono, app_limpo, tmp_path, monkeypatch):
    def recusa(*_):
        raise ValueError("Faltam no .env: BACKUP_SMTP_USER")

    monkeypatch.setattr(backup.envio, "enviar", recusa)
    dono.put("/api/backup", json=VALIDO)
    _dump(tmp_path)
    with app_limpo.app_context():
        assert backup.enviar_copia(str(tmp_path), arquivos=backup.ARQUIVOS) is False
    ultimo = dono.get("/api/backup").get_json()["ultimo_envio"]
    assert ultimo["ok"] is False and "BACKUP_SMTP_USER" in ultimo["texto"]


def test_sem_salvar_na_tela_vale_o_env(app_limpo, tmp_path, mandados, monkeypatch):
    monkeypatch.setenv("BACKUP_EMAIL", "a@x.com, b@x.com")
    monkeypatch.setenv("BACKUP_SENHA", "senha-do-env-longa")
    _dump(tmp_path)
    with app_limpo.app_context():
        backup.enviar_copia(str(tmp_path), date(2026, 10, 28))
    assert len(mandados) == 1
    config, anexos, _ = mandados[0]
    assert config["BACKUP_EMAIL"] == "a@x.com,b@x.com" and config["BACKUP_SENHA"] == "senha-do-env-longa"
    assert len(anexos) == 2
