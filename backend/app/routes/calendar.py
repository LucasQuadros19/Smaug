"""Calendário: o que vence, entra e sai em cada dia do mês.

Junta numa lista só: recorrentes (pagas e previstas), empréstimos, previsões
dos ativos, prazos de metas e eventos livres. Vendo os dados de outra conta,
cada fonte só aparece se a parte dela estiver compartilhada.
"""

from datetime import date

from flask import Blueprint, g, jsonify, request
from sqlalchemy.orm import joinedload, selectinload
from werkzeug.exceptions import BadRequest

from app.extensions import db
from app.models.calendar_event import EVENT_DIRECTIONS, CalendarEvent
from app.models.goal import Goal
from app.models.loan import Loan, LoanRepayment
from app.models.playlist_expectation import PlaylistExpectation
from app.models.recurring import RecurringTransaction
from app.models.transaction import Transaction
from app.services.history_service import month_bounds
from app.services.recurring_service import next_due_after
from app.utils.parse import color, iso_date, money, text

calendar_bp = Blueprint("calendar", __name__)

MAX_YEARS_AWAY = 10


def _visible(section):
    return g.sections is None or section in g.sections


def _month(value):
    try:
        year, month = (int(part) for part in str(value).split("-"))
        first = date(year, month, 1)
    except ValueError:
        raise BadRequest("Mês inválido (use YYYY-MM)") from None
    # As recorrentes são projetadas semana a semana até o mês pedido: sem limite,
    # o ano 9999 seriam centenas de milhares de voltas por recorrência.
    if abs(year - date.today().year) > MAX_YEARS_AWAY:
        raise BadRequest(f"Escolha um mês até {MAX_YEARS_AWAY} anos de hoje")
    return first


def _item(kind, when, title, *, key, amount=None, direction=None, status=None, link=None, **extra):
    return {
        "key": key,
        "kind": kind,
        "date": when.isoformat(),
        "title": title,
        "amount": float(amount) if amount is not None else None,
        "direction": direction,
        "status": status,
        "link": link,
        **extra,
    }


def _recurring(start, end, today):
    items = []
    paid = (
        db.session.query(Transaction.id, Transaction.recurring_id, Transaction.date, Transaction.description,
                         Transaction.amount, Transaction.type)
        .filter(Transaction.recurring_id.isnot(None), Transaction.date >= start, Transaction.date <= end)
        .all()
    )
    for tx_id, recurring_id, when, description, amount, tx_type in paid:
        items.append(_item(
            "income" if tx_type == "income" else "bill", when, description, key=f"tx{tx_id}",
            amount=amount, direction="in" if tx_type == "income" else "out", status="done", link="/transacoes",
        ))

    for rec in RecurringTransaction.query.filter(RecurringTransaction.active.is_(True)).all():
        direction = "in" if rec.type == "income" else "out"
        current, when = rec.next_due_date, rec.due_date
        while when <= end:
            if when >= start:
                late = when < today and not rec.auto
                status = "overdue" if late else "postponed" if rec.postponed_until and when == rec.due_date else None
                items.append(_item(
                    "income" if direction == "in" else "bill", when, rec.description, key=f"rec{rec.id}-{when}",
                    amount=rec.amount, direction=direction, status=status, link="/recorrentes",
                ))
            current = next_due_after(current, rec.frequency, rec.due_day)
            when = current
    return items


def _loans(start, end, today):
    items = []
    loans = Loan.query.options(selectinload(Loan.participants)).filter(
        ((Loan.start_date >= start) & (Loan.start_date <= end))
        | ((Loan.due_date >= start) & (Loan.due_date <= end))
    ).all()
    for loan in loans:
        if start <= loan.start_date <= end:
            items.append(_item("loan", loan.start_date, f"Emprestou para {loan.borrower}", key=f"loan{loan.id}",
                               amount=loan.amount, direction="out", link="/emprestimos"))
        if loan.due_date and start <= loan.due_date <= end and loan.status != "paid":
            items.append(_item("loan", loan.due_date, f"Retorno de {loan.borrower}", key=f"due{loan.id}",
                               amount=loan.total_to_receive or None, direction="in",
                               status="overdue" if loan.due_date < today else None, link="/emprestimos"))
    repayments = (
        LoanRepayment.query.options(joinedload(LoanRepayment.loan))
        .filter(LoanRepayment.date >= start, LoanRepayment.date <= end)
        .all()
    )
    for repayment in repayments:
        items.append(_item("loan", repayment.date, f"Recebido de {repayment.loan.borrower}", key=f"rep{repayment.id}",
                           amount=repayment.amount, direction="in", status="done", link="/emprestimos"))
    return items


def _planned(start, end, today):
    items = []
    expectations = (
        PlaylistExpectation.query.options(joinedload(PlaylistExpectation.playlist))
        .filter(
            PlaylistExpectation.status == "pending",
            PlaylistExpectation.expected_date >= start,
            PlaylistExpectation.expected_date <= end,
        )
        .all()
    )
    for exp in expectations:
        items.append(_item(
            "expectation", exp.expected_date, f"{exp.description} · {exp.playlist.name}", key=f"exp{exp.id}",
            amount=exp.amount, direction="in", status="overdue" if exp.expected_date < today else None,
            link=f"/{'ativos' if exp.playlist.kind == 'asset' else 'grupos'}/{exp.playlist_id}",
        ))
    for goal in Goal.query.filter(Goal.deadline >= start, Goal.deadline <= end).all():
        items.append(_item("goal", goal.deadline, f"Prazo da meta {goal.name}", key=f"goal{goal.id}",
                           amount=goal.target_amount, link="/metas"))
    return items


@calendar_bp.get("")
def month():
    start, end = month_bounds(_month(request.args.get("month") or date.today().strftime("%Y-%m")))
    today = date.today()

    items = []
    if _visible("contas"):
        items += _recurring(start, end, today)
        items += [
            _item("event", e.date, e.title, key=f"ev{e.id}", amount=e.amount, direction=e.direction, event=e.to_dict())
            for e in CalendarEvent.query.filter(CalendarEvent.date >= start, CalendarEvent.date <= end).all()
        ]
    if _visible("emprestimos"):
        items += _loans(start, end, today)
    if _visible("patrimonio"):
        items += _planned(start, end, today)

    items.sort(key=lambda i: (i["date"], i["kind"], i["title"]))
    return jsonify({"month": start.strftime("%Y-%m"), "items": items})


def _apply(event, data):
    if "title" in data or event.id is None:
        title = text(data.get("title"), "title")
        if not title:
            raise BadRequest("O campo 'title' é obrigatório")
        event.title = title
    if "date" in data or event.id is None:
        event.date = iso_date(data.get("date"), "date")
    if "amount" in data:
        event.amount = money(data["amount"], "amount", required=False)
    if "direction" in data:
        if data["direction"] not in (None, *EVENT_DIRECTIONS):
            raise BadRequest("direction deve ser 'in', 'out' ou vazio")
        event.direction = data["direction"]
    if "color" in data:
        event.color = color(data["color"], event.color or "#8b5cf6")
    if "notes" in data:
        event.notes = text(data["notes"], "notes") or None


@calendar_bp.post("/events")
def create_event():
    event = CalendarEvent()
    _apply(event, request.get_json(silent=True) or {})
    db.session.add(event)
    db.session.commit()
    return jsonify(event.to_dict()), 201


@calendar_bp.put("/events/<int:event_id>")
def update_event(event_id):
    event = db.get_or_404(CalendarEvent, event_id)
    _apply(event, request.get_json(silent=True) or {})
    db.session.commit()
    return jsonify(event.to_dict())


@calendar_bp.delete("/events/<int:event_id>")
def delete_event(event_id):
    db.session.delete(db.get_or_404(CalendarEvent, event_id))
    db.session.commit()
    return "", 204
