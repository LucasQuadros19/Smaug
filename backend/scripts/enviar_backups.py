#!/usr/bin/env python3
"""Manda por e-mail, com senha, uma cópia do backup mais recente de um sistema.

É a cópia fora do servidor: se a máquina estragar, o backup está no Gmail.
Cada arquivo vai num anexo: a planilha .xlsx abre no Excel/Numbers com a senha
(precisa do msoffcrypto-tool); os outros vão cifrados com o `openssl`. No Smaug
quem chama é o worker (`flask backup worker`), com a configuração da tela.
Solto, lê o .env do sistema, passado como argumento:

    python3 enviar_backups.py /home/lucas/fozesc/.env

Variáveis no .env (só letras, números e hífen nos valores):

    BACKUP_NOME=Fozesc
    BACKUP_PASTA=/home/lucas/fozesc/volumes/backups
    BACKUP_EMAIL=para.quem.vai@gmail.com        (vários: separe por vírgula)
    BACKUP_SMTP_USER=conta.que.envia@gmail.com
    BACKUP_SMTP_PASS=senha de app de 16 letras do Google
    BACKUP_SENHA=senha da criptografia, anotada também FORA do servidor
    BACKUP_DIAS=30                              (opcional)

Para não lotar a conta que envia, os e-mails do backup com mais de BACKUP_DIAS
dias vão para a lixeira dela, menos o primeiro de cada mês, que fica para
sempre. Se BACKUP_EMAIL for a mesma conta, a limpeza vale para tudo.

Para abrir a cópia do banco no Mac (pede a BACKUP_SENHA):
    openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -md sha256 -in ARQUIVO.sql.gz.enc -out ARQUIVO.sql.gz
"""

import email
import gzip
import imaplib
import io
import os
import re
import smtplib
import subprocess
import sys
import time
from datetime import datetime, timedelta
from email.header import decode_header, make_header
from email.message import EmailMessage

MAX_HORAS = 26
MAX_ANEXO = 20 * 1024 * 1024
TIPO_XLSX = ("application", "vnd.openxmlformats-officedocument.spreadsheetml.sheet")
CIFRA = ["-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-md", "sha256"]


def ler_env(caminho):
    config = {}
    with open(caminho) as f:
        for linha in f:
            chave, sep, valor = linha.strip().partition("=")
            if sep and not chave.startswith("#"):
                config[chave.strip()] = valor.strip().strip("'\"")
    return config


def mais_recente(pasta, sufixos):
    achados = []
    for raiz, pastas, nomes in os.walk(pasta):
        # mensal/ guarda cópias (feitas depois, com data mais nova) do que já está fora dela.
        pastas[:] = [p for p in pastas if p != "mensal"]
        achados += [os.path.join(raiz, nome) for nome in nomes if nome.endswith(sufixos)]
    return max(achados, key=os.path.getmtime, default=None)


def dump_completo(caminho):
    """O pg_dump só escreve o rodapé quando chega ao fim."""
    try:
        with gzip.open(caminho, "rt", errors="replace") as f:
            return any("dump complete" in linha for linha in f)
    except (OSError, EOFError):
        return False


def escolher(pasta, agora):
    """Devolve os arquivos para mandar e a lista de problemas encontrados."""
    if not os.path.isdir(pasta):
        return [], [f"a pasta {pasta} não existe"]
    arquivos, problemas = [], []
    sql = mais_recente(pasta, (".sql.gz",))
    planilha = mais_recente(pasta, (".xlsx", ".zip"))
    if sql is None:
        problemas.append("nenhum .sql.gz")
    else:
        horas = (agora - os.path.getmtime(sql)) / 3600
        if horas > MAX_HORAS:
            problemas.append(f"o último backup tem {horas:.0f} horas — parou de rodar?")
        if not dump_completo(sql):
            problemas.append(f"{os.path.basename(sql)} está incompleto")
        arquivos.append(sql)
    if planilha is None:
        problemas.append("nenhuma planilha")
    else:
        arquivos.append(planilha)
    return arquivos, problemas


def anexo(caminho, senha):
    """(nome, dados, tipo) de um arquivo com senha: a planilha abre no próprio Excel;
    o resto vai cifrado com o openssl."""
    nome = os.path.basename(caminho)
    with open(caminho, "rb") as f:
        if nome.endswith(".xlsx"):
            # Importado aqui: solto, só com a cópia do banco, o script roda sem ele.
            from msoffcrypto.format.ooxml import OOXMLFile

            saida = io.BytesIO()
            OOXMLFile(f).encrypt(senha, saida)
            return nome, saida.getvalue(), TIPO_XLSX
        return nome + ".enc", cifrar(f.read(), senha), ("application", "octet-stream")


def cifrar(dados, senha):
    # A senha vai pelo ambiente: na linha de comando qualquer um veria no `ps`.
    return subprocess.run(
        ["openssl", "enc", *CIFRA, "-salt", "-pass", "env:BACKUP_SENHA"],
        input=dados,
        capture_output=True,
        check=True,
        env={**os.environ, "BACKUP_SENHA": senha},
    ).stdout


def para_apagar(mensagens, agora, dias):
    """De [(uid, data, assunto)], os antigos que podem sair: fica o primeiro
    de cada mês (de preferência um OK) e tudo dos últimos `dias` dias."""
    antigos = [m for m in mensagens if m[1] < agora - timedelta(days=dias)]
    guardar = {}
    for m in sorted(antigos, key=lambda m: (not m[2].endswith("OK"), m[1])):
        guardar.setdefault((m[1].year, m[1].month), m[0])
    return [m[0] for m in antigos if m[0] not in guardar.values()]


def limpar_antigos(config, nome, dias):
    with imaplib.IMAP4_SSL("imap.gmail.com", timeout=60) as imap:
        imap.login(config["BACKUP_SMTP_USER"], config["BACKUP_SMTP_PASS"].replace(" ", ""))
        # O nome das pastas muda com o idioma da conta; a marca \All/\Trash não.
        pastas = {}
        for linha in imap.list()[1]:
            marcas, _, pasta = linha.decode().partition(') "/" ')
            for marca in ("\\All", "\\Trash"):
                if marca in marcas.lstrip("(").split():
                    pastas[marca] = pasta
        imap.select(pastas["\\All"])
        busca = f'"subject:(Backup {nome}) older_than:{dias}d"'
        uids = imap.uid("SEARCH", "X-GM-RAW", busca)[1][0].split()
        if not uids:
            return 0
        mensagens = []
        resposta = imap.uid("FETCH", b",".join(uids), "(INTERNALDATE BODY.PEEK[HEADER.FIELDS (SUBJECT)])")[1]
        for item in resposta:
            if not isinstance(item, tuple):
                continue
            uid = re.search(rb"UID (\d+)", item[0]).group(1)
            data = datetime(*imaplib.Internaldate2tuple(item[0])[:6])
            assunto = str(make_header(decode_header(email.message_from_bytes(item[1])["Subject"] or "")))
            if re.match(rf"Backup {nome} \d\d/\d\d/\d{{4}} — ", assunto):
                mensagens.append((uid, data, assunto))
        apagar = para_apagar(mensagens, datetime.now(), dias)
        if apagar:
            imap.uid("MOVE", b",".join(apagar), pastas["\\Trash"])
        return len(apagar)


OBRIGATORIAS = ("BACKUP_NOME", "BACKUP_EMAIL", "BACKUP_SMTP_USER", "BACKUP_SMTP_PASS", "BACKUP_SENHA")


def enviar(config, arquivos, problemas):
    """Manda `arquivos` para BACKUP_EMAIL, um anexo com senha para cada, e tira os
    antigos da caixa. Devolve o assunto. Configuração faltando ou inválida: ValueError."""
    faltando = [k for k in OBRIGATORIAS if not config.get(k)]
    if faltando:
        raise ValueError(f"Faltam no .env: {', '.join(faltando)}")
    if len(config["BACKUP_SENHA"]) < 12:
        raise ValueError("BACKUP_SENHA curta demais (mínimo 12 caracteres)")
    nome = config["BACKUP_NOME"]
    if not re.fullmatch(r"[\w-]+", nome):
        raise ValueError("BACKUP_NOME: use só letras, números e hífen")
    dias = int(config.get("BACKUP_DIAS") or 30)
    problemas = list(problemas)

    anexos, total = [], 0
    for caminho in arquivos:
        item = anexo(caminho, config["BACKUP_SENHA"])
        if total + len(item[1]) > MAX_ANEXO:
            problemas.append(f"{os.path.basename(caminho)} ficou de fora: passou do limite de tamanho do Gmail")
            continue
        total += len(item[1])
        anexos.append((caminho, *item))

    linhas = [f"Backup do {nome} de {datetime.now():%d/%m/%Y}.", ""]
    if problemas:
        linhas += ["PROBLEMAS:", *[f"  - {p}" for p in problemas], ""]
    cifrados = []
    for caminho, arquivo, _, tipo in anexos:
        feito = f"{datetime.fromtimestamp(os.path.getmtime(caminho)):%d/%m às %H:%M}"
        if tipo == TIPO_XLSX:
            linhas += [f"{arquivo}: a planilha com os dados de {feito}, uma aba por assunto.",
                       "  Abre no Excel ou no Numbers com a senha do backup.", ""]
        elif arquivo.endswith(".sql.gz.enc"):
            linhas += [f"{arquivo}: a cópia do banco de {feito}, para restaurar o sistema. Não precisa abrir.", ""]
            cifrados.append(arquivo)
        else:
            linhas += [f"{arquivo}: de {feito}.", ""]
            cifrados.append(arquivo)
    if cifrados:
        linhas.append("Para abrir no Mac o que termina em .enc (pede a senha do backup):")
        linhas += [f"  openssl enc -d {' '.join(CIFRA)} -in {a} -out {a.removesuffix('.enc')}" for a in cifrados]

    msg = EmailMessage()
    situacao = f"PROBLEMA ({len(problemas)})" if problemas else "OK"
    msg["Subject"] = f"Backup {nome} {datetime.now():%d/%m/%Y} — {situacao}"
    msg["From"] = config["BACKUP_SMTP_USER"]
    msg["To"] = config["BACKUP_EMAIL"]
    msg.set_content("\n".join(linhas))
    for _, arquivo, dados, tipo in anexos:
        msg.add_attachment(dados, maintype=tipo[0], subtype=tipo[1], filename=arquivo)

    with smtplib.SMTP_SSL("smtp.gmail.com", 465, timeout=60) as smtp:
        # O Google mostra a senha de app em blocos com espaço; ela vale sem eles.
        smtp.login(config["BACKUP_SMTP_USER"], config["BACKUP_SMTP_PASS"].replace(" ", ""))
        smtp.send_message(msg)
    print(f"{datetime.now():%Y-%m-%d %H:%M} enviado: {msg['Subject']}")

    # Depois do envio: se a limpeza falhar, o backup de hoje já foi.
    try:
        print(f"  {limpar_antigos(config, nome, dias)} e-mail(s) antigo(s) para a lixeira")
    except Exception as erro:  # noqa: BLE001
        print(f"  a limpeza dos antigos falhou: {erro}")
    return msg["Subject"]


def main():
    if len(sys.argv) != 2:
        sys.exit(f"Uso: {sys.argv[0]} /caminho/do/.env")
    config = ler_env(sys.argv[1])
    if not config.get("BACKUP_PASTA"):
        sys.exit("Faltam no .env: BACKUP_PASTA")
    arquivos, problemas = escolher(config["BACKUP_PASTA"], time.time())
    try:
        enviar(config, arquivos, problemas)
    except ValueError as erro:
        sys.exit(str(erro))


if __name__ == "__main__":
    main()
