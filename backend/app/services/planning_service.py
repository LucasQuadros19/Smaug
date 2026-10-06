"""Metas e avisos — os dois partem dos números que o resumo do dashboard já calcula."""

from datetime import date, timedelta

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.models.goal import Goal
from app.models.loan import Loan
from app.models.playlist_expectation import PlaylistExpectation
from app.models.recurring import RecurringTransaction

_LEVEL_ORDER = {"danger": 0, "warning": 1, "info": 2}


def _brl(value: float) -> str:
    return "R$ " + f"{value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _dm(d: date) -> str:
    return d.strftime("%d/%m")


def goals_with_progress(net_worth: float, playlists_summary: list) -> list:
    """Meta ligada a uma posição acompanha o valor dela; sem posição, o patrimônio."""
    values = {p["id"]: max(p["outstanding"] or 0, 0) for p in playlists_summary}
    goals = Goal.query.options(selectinload(Goal.playlist)).order_by(Goal.deadline.is_(None), Goal.deadline, Goal.id).all()
    return [g.to_dict(current=values.get(g.playlist_id, 0) if g.playlist_id else net_worth) for g in goals]


def get_alerts(summary: dict, include_budgets: bool) -> list:
    """O que pede atenção agora. `include_budgets` só no mês corrente — olhando
    um mês passado, orçamento estourado lá não é novidade."""
    today = date.today()
    alerts = []

    def add(level, title, detail, link):
        alerts.append({"level": level, "title": title, "detail": detail, "link": link})

    manual_due = RecurringTransaction.query.filter(
        RecurringTransaction.active.is_(True),
        RecurringTransaction.auto.is_(False),
        func.coalesce(RecurringTransaction.postponed_until, RecurringTransaction.next_due_date)
        <= today + timedelta(days=3),
    ).order_by(func.coalesce(RecurringTransaction.postponed_until, RecurringTransaction.next_due_date))
    for item in manual_due:
        late = item.due_date < today
        postponed = " (adiada)" if item.postponed_until else ""
        add(
            "danger" if late else "warning",
            f"Lançar {item.description}",
            f"{'Venceu' if late else 'Vence'} em {_dm(item.due_date)}{postponed} · recorrente manual",
            "/recorrentes",
        )

    for loan in Loan.query.filter(Loan.status.in_(("active", "late"))):
        due = loan.due_date
        if loan.status == "late" or (due and due < today):
            detail = f"Venceu em {_dm(due)}" if due else "Marcado como atrasado"
            add("danger", f"Empréstimo de {loan.borrower} atrasado", detail, "/emprestimos")
        elif due and due <= today + timedelta(days=7):
            add("warning", f"Empréstimo de {loan.borrower} vence em breve", f"Vence em {_dm(due)}", "/emprestimos")

    overdue_expectations = (
        PlaylistExpectation.query.options(selectinload(PlaylistExpectation.playlist))
        .filter(PlaylistExpectation.status == "pending", PlaylistExpectation.expected_date < today)
        .order_by(PlaylistExpectation.expected_date)
    )
    for exp in overdue_expectations:
        base = "/ativos" if exp.playlist.kind == "asset" else "/grupos"
        add(
            "warning",
            f"{exp.description} ainda não chegou",
            f"{_brl(float(exp.amount))} previsto para {_dm(exp.expected_date)} em {exp.playlist.name}",
            f"{base}/{exp.playlist_id}",
        )

    if include_budgets:
        for budget in summary["budgets_progress"]:
            spent, limit = budget["spent"] or 0, budget["limit_amount"]
            name = budget["category"]["name"] if budget["category"] else "categoria"
            if spent >= limit:
                add("danger", f"Orçamento de {name} estourado", f"{_brl(spent)} de {_brl(limit)}", "/orcamentos")
            elif spent >= 0.9 * limit:
                add("warning", f"Orçamento de {name} quase no limite", f"{_brl(spent)} de {_brl(limit)}", "/orcamentos")

    for goal in summary["goals"]:
        if goal["overdue"]:
            add("warning", f"Meta {goal['name']} passou do prazo", f"Faltam {_brl(goal['remaining'])}", "/metas")

    if summary["owed_to_partners"] > 0:
        add(
            "info",
            "Repasse pendente aos sócios",
            f"{_brl(summary['owed_to_partners'])} na sua conta que não é seu",
            "/emprestimos",
        )

    alerts.sort(key=lambda a: _LEVEL_ORDER[a["level"]])
    return alerts
