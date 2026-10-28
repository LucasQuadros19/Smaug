"""O envio dos backups por e-mail: o que escolhe, o que denuncia, se a cifra abre
e o que a limpeza da caixa apaga."""

import gzip
import importlib.util
import io
import os
import subprocess
import time
from datetime import datetime
from pathlib import Path

import pytest

spec = importlib.util.spec_from_file_location(
    "enviar_backups", Path(__file__).parents[1] / "scripts" / "enviar_backups.py"
)
envio = importlib.util.module_from_spec(spec)
spec.loader.exec_module(envio)

SENHA = "senha-de-teste-longa"


def dump(caminho, completo=True, horas_atras=0):
    caminho.parent.mkdir(parents=True, exist_ok=True)
    rodape = "-- PostgreSQL database dump complete\n" if completo else ""
    caminho.write_bytes(gzip.compress(f"COPY x;\n{rodape}".encode()))
    quando = time.time() - horas_atras * 3600
    os.utime(caminho, (quando, quando))
    return caminho


def test_pega_o_mais_novo_de_qualquer_subpasta(tmp_path):
    dump(tmp_path / "semanal" / "F1.sql.gz", horas_atras=40)
    novo = dump(tmp_path / "diario" / "F2.sql.gz", horas_atras=2)
    (tmp_path / "diario" / "F2.xlsx").write_bytes(b"x")

    arquivos, problemas = envio.escolher(str(tmp_path), time.time())

    assert arquivos == [str(novo), str(tmp_path / "diario" / "F2.xlsx")]
    assert problemas == []


def test_denuncia_backup_parado_incompleto_e_sem_planilha(tmp_path):
    dump(tmp_path / "diario" / "F.sql.gz", completo=False, horas_atras=30)

    _, problemas = envio.escolher(str(tmp_path), time.time())

    assert problemas == ["o último backup tem 30 horas — parou de rodar?",
                         "F.sql.gz está incompleto", "nenhuma planilha"]
    assert envio.escolher(str(tmp_path / "nada"), time.time())[1] == [f"a pasta {tmp_path / 'nada'} não existe"]


def test_a_copia_mensal_nao_passa_na_frente_da_mais_nova(tmp_path):
    novo = dump(tmp_path / "saldos-20261028-093700.sql.gz", horas_atras=1)
    # O mensal/ recebe uma cópia logo depois: data de arquivo mais nova, mesmo conteúdo.
    dump(tmp_path / "mensal" / "saldos-202610.sql.gz")

    assert envio.mais_recente(str(tmp_path), (".sql.gz",)) == str(novo)


def test_copia_do_banco_abre_com_a_senha_e_so_com_ela(tmp_path):
    original = dump(tmp_path / "saldos-1.sql.gz").read_bytes()
    nome, cifrado, tipo = envio.anexo(str(tmp_path / "saldos-1.sql.gz"), SENHA)
    assert (nome, tipo) == ("saldos-1.sql.gz.enc", ("application", "octet-stream"))
    assert original not in cifrado

    def abrir(senha):
        return subprocess.run(
            ["openssl", "enc", "-d", *envio.CIFRA, "-pass", f"pass:{senha}"],
            input=cifrado, capture_output=True,
        )

    assert abrir("errada").stdout != original
    assert abrir(SENHA).stdout == original


def test_planilha_vai_como_excel_que_pede_a_senha(tmp_path):
    import msoffcrypto
    import xlsxwriter

    caminho = tmp_path / "planilha-1.xlsx"
    with xlsxwriter.Workbook(str(caminho)) as livro:
        livro.add_worksheet("Caixa").write_string(0, 0, "Mercado")

    nome, cifrado, tipo = envio.anexo(str(caminho), SENHA)
    assert (nome, tipo) == ("planilha-1.xlsx", envio.TIPO_XLSX)
    arquivo = msoffcrypto.OfficeFile(io.BytesIO(cifrado))
    assert arquivo.is_encrypted()
    with pytest.raises(Exception):
        arquivo.load_key(password="errada")
        arquivo.decrypt(io.BytesIO())
    aberto = io.BytesIO()
    arquivo = msoffcrypto.OfficeFile(io.BytesIO(cifrado))
    arquivo.load_key(password=SENHA)
    arquivo.decrypt(aberto)
    assert aberto.getvalue() == caminho.read_bytes()


def test_cada_arquivo_vai_num_anexo(tmp_path, monkeypatch):
    enviadas = []

    class Gmail:
        def __init__(self, *_, **__): pass
        def __enter__(self): return self
        def __exit__(self, *_): pass
        def login(self, *_): pass
        def send_message(self, msg): enviadas.append(msg)

    monkeypatch.setattr(envio.smtplib, "SMTP_SSL", Gmail)
    monkeypatch.setattr(envio, "limpar_antigos", lambda *_: 0)
    sql = str(dump(tmp_path / "saldos-1.sql.gz"))
    planilha = tmp_path / "planilha-1.xlsx"
    import xlsxwriter
    with xlsxwriter.Workbook(str(planilha)) as livro:
        livro.add_worksheet("Caixa")

    config = {"BACKUP_NOME": "Smaug", "BACKUP_EMAIL": "eu@x.com", "BACKUP_SMTP_USER": "envia@x.com",
              "BACKUP_SMTP_PASS": "abcd", "BACKUP_SENHA": SENHA}
    assunto = envio.enviar(config, [sql, str(planilha)], [])

    assert assunto.startswith("Backup Smaug ") and assunto.endswith("— OK")
    nomes = [a.get_filename() for a in enviadas[0].iter_attachments()]
    assert nomes == ["saldos-1.sql.gz.enc", "planilha-1.xlsx"]
    corpo = enviadas[0].get_body().get_content()
    assert "Abre no Excel" in corpo and "-in saldos-1.sql.gz.enc -out saldos-1.sql.gz" in corpo


def test_limpeza_guarda_os_recentes_e_o_primeiro_ok_de_cada_mes():
    agora = datetime(2026, 10, 22)
    mensagens = [
        (b"1", datetime(2026, 8, 1), "Backup Fozesc 01/08/2026 — PROBLEMA (1)"),
        (b"2", datetime(2026, 8, 2), "Backup Fozesc 02/08/2026 — OK"),
        (b"3", datetime(2026, 8, 3), "Backup Fozesc 03/08/2026 — OK"),
        (b"4", datetime(2026, 9, 1), "Backup Fozesc 01/09/2026 — OK"),
        (b"5", datetime(2026, 9, 21), "Backup Fozesc 21/09/2026 — OK"),
        (b"6", datetime(2026, 10, 1), "Backup Fozesc 01/10/2026 — OK"),
    ]

    assert envio.para_apagar(mensagens, agora, dias=30) == [b"1", b"3", b"5"]
