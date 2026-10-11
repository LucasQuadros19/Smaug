import calendar
from datetime import date, timedelta

from sqlalchemy import func

from app.extensions import db
from app.models.recurring import RecurringTransaction
from app.models.transaction import Transaction


def _add_months(d: date, months: int, day: int) -> date:
    month_index = d.month - 1 + months
    year = d.year + month_index // 12
    month = month_index % 12 + 1
    return date(year, month, min(day, calendar.monthrange(year, month)[1]))


def next_due_after(current: date, frequency: str, day: int | None = None) -> date:
    """Próximo vencimento. Usada tanto pelo gerador automático quanto pelo
    lançamento manual, para os dois avançarem a data do mesmo jeito.

    `day` é o dia escolhido no cadastro: o do dia 31 cai no 28 em fevereiro e
    volta ao 31 em março, em vez de ficar no 28 para sempre."""
    if frequency == "weekly":
        return current + timedelta(days=7)
    months = 12 if frequency == "yearly" else 1
    return _add_months(current, months, day or current.day)


def advance(item):
    """Passa para a próxima ocorrência. O adiamento valia só para a atual."""
    item.next_due_date = next_due_after(item.next_due_date, item.frequency, item.due_day)
    item.postponed_until = None


def generate_due_transactions():
    """Cria transações para as recorrências automáticas vencidas até hoje.

    As marcadas como manuais ficam de fora de propósito: elas esperam você
    lançar com o valor real do mês (`POST /recurring/<id>/launch`).
    """
    today = date.today()
    created = []

    # Trava as linhas: dois pedidos ao mesmo tempo (dois aparelhos abrindo o app)
    # lançariam a mesma ocorrência duas vezes. O segundo espera o primeiro e já
    # encontra a data avançada.
    recurring_items = (
        RecurringTransaction.query.filter(
            RecurringTransaction.active.is_(True),
            RecurringTransaction.auto.is_(True),
            func.coalesce(RecurringTransaction.postponed_until, RecurringTransaction.next_due_date) <= today,
        )
        .with_for_update()
        .all()
    )

    for item in recurring_items:
        while item.due_date <= today:
            transaction = Transaction(
                account_id=item.account_id,
                category_id=item.category_id,
                playlist_id=item.playlist_id,
                recurring_id=item.id,
                description=item.description,
                amount=item.amount,
                type=item.type,
                date=item.due_date,
                notes="Gerado automaticamente (recorrente)",
            )
            db.session.add(transaction)
            created.append(transaction)
            advance(item)

    if created:
        db.session.commit()

    return created
