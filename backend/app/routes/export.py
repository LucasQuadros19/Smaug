"""Exportação em CSV — para abrir no Excel e manter uma cópia fora do app."""

import csv
import io
import os
import re
from datetime import date, datetime

import click
import xlsxwriter
from flask import Blueprint, Response, current_app, g
from sqlalchemy.orm import joinedload, selectinload

from app.models.account import Account
from app.models.loan import Loan
from app.models.playlist import Playlist
from app.models.snapshot import Snapshot
from app.models.transaction import Transaction
from app.models.user import User

export_bp = Blueprint("export", __name__)


_FORMULA_START = ("=", "+", "-", "@", "\t", "\r")
_NUMBER = re.compile(r"-?\d+(,\d+)?")


def _cell(value):
    """Texto começando com = + - @ vira fórmula no Excel; número negativo não."""
    text = str(value)
    if text.startswith(_FORMULA_START) and not _NUMBER.fullmatch(text):
        return "'" + text
    return text


def _csv_response(rows, filename):
    """CSV com separador `;` e vírgula decimal — o que o Excel pt-BR espera."""
    buffer = io.StringIO()
    writer = csv.writer(buffer, delimiter=";")
    writer.writerows([_cell(value) for value in row] for row in rows)

    stamp = date.today().isoformat()
    return Response(
        # BOM para o Excel reconhecer os acentos.
        "﻿" + buffer.getvalue(),
        mimetype="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}-{stamp}.csv"'},
    )


def _money(value):
    if value is None:
        return ""
    return f"{float(value):.2f}".replace(".", ",")


@export_bp.get("/patrimonio.csv")
def export_snapshots():
    return _csv_response(_snapshot_rows(), "smaug-patrimonio")


def _snapshot_rows():
    """A planilha inteira, no mesmo formato da tabela da tela."""
    positions = Playlist.query.order_by(Playlist.created_at).all()
    accounts = Account.query.order_by(Account.created_at).all()
    snapshots = (
        Snapshot.query.options(selectinload(Snapshot.entries))
        .order_by(Snapshot.date, Snapshot.id)
        .all()
    )

    header = (
        ["Data"]
        + [p.name for p in positions]
        + [a.name for a in accounts]
        + ["Entrada", "Investido", "Patrimonio", "Obs"]
    )
    counting = {p.id for p in positions if p.counts_in_net_worth}
    rows = [header]
    for snapshot in snapshots:
        data = snapshot.to_dict(counting)
        rows.append(
            [snapshot.date.isoformat()]
            + [_money(data["positions"].get(str(p.id), 0)) for p in positions]
            + [_money(data["cash"].get(str(a.id), 0)) for a in accounts]
            + [
                _money(data["inflow"]),
                _money(data["invested"]),
                _money(data["net_worth"]),
                snapshot.notes or "",
            ]
        )
    return rows


@export_bp.get("/transacoes.csv")
def export_transactions():
    return _csv_response(_transaction_rows(), "smaug-transacoes")


def _transaction_rows():
    transactions = (
        Transaction.query.options(
            joinedload(Transaction.category),
            joinedload(Transaction.account),
            joinedload(Transaction.playlist),
        )
        .order_by(Transaction.date.desc(), Transaction.id.desc())
        .all()
    )

    rows = [["Data", "Descricao", "Tipo", "Valor", "Categoria", "Conta", "Posicao", "Notas"]]
    for t in transactions:
        rows.append(
            [
                t.date.isoformat(),
                t.description,
                "Receita" if t.type == "income" else "Despesa",
                _money(t.amount),
                t.category.name if t.category else "",
                t.account.name if t.account else "",
                t.playlist.name if t.playlist else "",
                t.notes or "",
            ]
        )
    return rows


@export_bp.get("/emprestimos.csv")
def export_loans():
    return _csv_response(_loan_rows(), "smaug-emprestimos")


_ATIVOS = ("active", "late")


def _loan_rows(only_active=False):
    """Uma linha por participante — assim o rateio fica legível na planilha."""
    query = Loan.query.options(selectinload(Loan.participants), selectinload(Loan.repayments))
    if only_active:
        query = query.filter(Loan.status.in_(_ATIVOS))
    loans = query.order_by(Loan.start_date.desc()).all()

    rows = [
        [
            "Para quem",
            "Emprestado em",
            "Valor total",
            "Taxa % ao mes",
            "Meses",
            "Situacao",
            "Participante",
            "Entrou com",
            "Ganha por mes",
            "Comissao por mes",
            "E voce",
            "Ja recebido",
            "Em aberto (seu)",
            "Obs",
        ]
    ]
    for loan in loans:
        base = [
            loan.borrower,
            loan.start_date.isoformat() if loan.start_date else "",
            _money(loan.amount),
            _money(loan.interest_rate),
            loan.months,
            loan.status,
        ]
        tail = [_money(loan.my_repaid), _money(loan.my_outstanding), loan.notes or ""]
        if not loan.participants:
            rows.append(base + ["", "", "", "", "", *tail])
            continue
        for participant in loan.participants:
            rows.append(
                base
                + [
                    participant.name,
                    _money(participant.contributed),
                    _money(participant.gain),
                    _money(participant.commission),
                    "sim" if participant.is_me else "",
                    *tail,
                ]
            )
    return rows


def _loan_history_rows():
    """Cada passo dos empréstimos ativos: quando saiu, cada recebimento e cada adiamento."""
    loans = (
        Loan.query.options(selectinload(Loan.repayments), selectinload(Loan.events))
        .filter(Loan.status.in_(_ATIVOS))
        .order_by(Loan.start_date.desc())
        .all()
    )
    rows = [["Para quem", "Data", "O que foi", "Juros", "Principal", "Multa", "Total", "Parte dos socios",
             "Vencia", "Novo vencimento", "Obs"]]

    def recebido(parts, kind):
        return _money(sum((r.amount for r in parts if r.kind == kind), 0)) if parts else ""

    for loan in loans:
        passos = [(loan.start_date, 0, ["Emprestou", "", "", "", _money(loan.amount), "", "", "", loan.notes or ""])]
        for event in loan.events:
            parts = event.parts
            o_que = "Adiamento" if event.kind == "postpone" else "Recebimento"
            passos.append((event.date, event.id, [
                o_que, recebido(parts, "interest"), recebido(parts, "principal"), recebido(parts, "fee"),
                _money(sum((r.amount for r in parts), 0)) if parts else "",
                _money(sum((r.partners_share for r in parts), 0)) if parts else "",
                event.due_before.isoformat() if event.due_before else "",
                event.due_after.isoformat() if event.due_after else "",
                event.notes or "",
            ]))
        # Recebimentos de antes do histórico por passos não têm evento.
        for r in loan.repayments:
            if r.event_id is None:
                passos.append((r.date, 0, [
                    "Recebimento", *[(_money(r.amount) if r.kind == k else "") for k in ("interest", "principal", "fee")],
                    _money(r.amount), _money(r.partners_share), "", "", r.notes or "",
                ]))
        for when, _, resto in sorted(passos, key=lambda p: (p[0], p[1])):
            rows.append([loan.borrower, when.isoformat() if when else "", *resto])
    return rows


_ABAS = {
    "Patrimônio": _snapshot_rows,
    "Caixa": _transaction_rows,
    "Empréstimos": lambda: _loan_rows(only_active=True),
    "Histórico dos empréstimos": _loan_history_rows,
}
_DATA = re.compile(r"\d{4}-\d{2}-\d{2}")


def _escrever(folha, linhas, formatos):
    """Número e data viram número e data de verdade no Excel; o resto vai como texto
    (`write_string`: texto começando com = nunca vira fórmula)."""
    larguras = {}
    for i, linha in enumerate(linhas):
        for j, valor in enumerate(linha):
            texto = str(valor)
            if i == 0:
                folha.write_string(i, j, texto, formatos["titulo"])
            elif isinstance(valor, (int, float)):
                folha.write_number(i, j, valor)
            elif _NUMBER.fullmatch(texto):
                folha.write_number(i, j, float(texto.replace(",", ".")), formatos["dinheiro"])
            elif _DATA.fullmatch(texto):
                folha.write_datetime(i, j, datetime.strptime(texto, "%Y-%m-%d"), formatos["data"])
            else:
                folha.write_string(i, j, texto)
            larguras[j] = max(larguras.get(j, 8), min(len(texto) + 2, 50))
    for j, largura in larguras.items():
        folha.set_column(j, j, largura)
    folha.freeze_panes(1, 0)
    if linhas:
        folha.autofilter(0, 0, max(len(linhas) - 1, 0), max(len(linhas[0]) - 1, 0))


def gravar_planilhas(destino):
    """Grava num .xlsx os mesmos dados dos CSVs da tela, uma aba por assunto (para o backup).
    Com mais de um usuário, cada aba leva o nome de quem é."""
    usuarios = User.query.order_by(User.username).all()
    tmp = destino + ".tmp"
    with xlsxwriter.Workbook(tmp) as livro:
        formatos = {
            "titulo": livro.add_format({"bold": True}),
            "dinheiro": livro.add_format({"num_format": "#,##0.00"}),
            "data": livro.add_format({"num_format": "dd/mm/yyyy"}),
        }
        usadas = set()
        for user in usuarios:
            with current_app.test_request_context():
                g.owner_id = user.id
                for aba, linhas in _ABAS.items():
                    # O Excel aceita até 31 letras e não repete nome de aba.
                    nome = aba if len(usuarios) == 1 else f"{user.username[:17]} - {aba}"[:31]
                    if nome in usadas:
                        nome = f"{aba} {len(usadas)}"
                    usadas.add(nome)
                    _escrever(livro.add_worksheet(nome), linhas(), formatos)
    os.replace(tmp, destino)


@export_bp.cli.command("planilhas")
@click.argument("destino")
def save_sheets(destino):
    """Grava num .xlsx os mesmos dados dos CSVs da tela, uma aba por assunto (para o backup)."""
    gravar_planilhas(destino)
    click.echo(f"planilha ok: {destino}")
