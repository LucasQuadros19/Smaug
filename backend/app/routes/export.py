"""Exportação em CSV — para abrir no Excel e manter uma cópia fora do app."""

import csv
import io
import re
from datetime import date

from flask import Blueprint, Response
from sqlalchemy.orm import joinedload, selectinload

from app.models.account import Account
from app.models.loan import Loan
from app.models.playlist import Playlist
from app.models.snapshot import Snapshot
from app.models.transaction import Transaction

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
    rows = [header]
    for snapshot in snapshots:
        data = snapshot.to_dict()
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
    return _csv_response(rows, "smaug-patrimonio")


@export_bp.get("/transacoes.csv")
def export_transactions():
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
    return _csv_response(rows, "smaug-transacoes")


@export_bp.get("/emprestimos.csv")
def export_loans():
    """Uma linha por participante — assim o rateio fica legível na planilha."""
    loans = (
        Loan.query.options(selectinload(Loan.participants), selectinload(Loan.repayments))
        .order_by(Loan.start_date.desc())
        .all()
    )

    rows = [
        [
            "Para quem",
            "Emprestado em",
            "Valor total",
            "Taxa %",
            "Situacao",
            "Participante",
            "Entrou com",
            "Recebe",
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
            loan.status,
        ]
        tail = [_money(loan.my_repaid), _money(loan.my_outstanding), loan.notes or ""]
        if not loan.participants:
            rows.append(base + ["", "", "", "", *tail])
            continue
        for participant in loan.participants:
            rows.append(
                base
                + [
                    participant.name,
                    _money(participant.contributed),
                    _money(participant.to_receive),
                    "sim" if participant.is_me else "",
                    *tail,
                ]
            )
    return _csv_response(rows, "smaug-emprestimos")
