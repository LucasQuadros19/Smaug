"""O envio dos backups por e-mail: o que escolhe, o que denuncia, se a cifra abre
e o que a limpeza da caixa apaga."""

import gzip
import importlib.util
import io
import os
import subprocess
import tarfile
import time
from datetime import datetime
from pathlib import Path

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


def test_anexo_cifrado_abre_com_a_senha_e_so_com_ela(tmp_path):
    pacote = envio.empacotar([str(dump(tmp_path / "saldos-1.sql.gz"))])
    cifrado = envio.cifrar(pacote, SENHA)
    assert b"dump complete" not in cifrado

    def abrir(senha):
        return subprocess.run(
            ["openssl", "enc", "-d", *envio.CIFRA, "-pass", f"pass:{senha}"],
            input=cifrado, capture_output=True,
        )

    assert abrir("errada").stdout != pacote
    with tarfile.open(fileobj=io.BytesIO(abrir(SENHA).stdout)) as tar:
        assert tar.getnames() == ["saldos-1.sql.gz"]


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
