"""Valores de posições derivadas de outras telas.

Uma posição com `auto_source` não é digitada: ela é a soma do que está
registrado na tela de origem. Mexer lá reflete no patrimônio, na planilha e
nos gráficos sem precisar reeditar nada.
"""

from decimal import Decimal

from sqlalchemy.orm import selectinload

from app.models.loan import Loan

# Empréstimos quitados saem do patrimônio; o dinheiro já voltou para o caixa.
OPEN_LOAN_STATUSES = ("active", "late")


def _open_loans():
    return (
        Loan.query.options(
            selectinload(Loan.participants), selectinload(Loan.repayments)
        )
        .filter(Loan.status.in_(OPEN_LOAN_STATUSES))
        .all()
    )


def loans_total() -> Decimal:
    """Meu dinheiro ainda na rua: principal meu menos o que já voltou."""
    return sum((loan.my_outstanding for loan in _open_loans()), Decimal(0))


def pending_to_partners() -> Decimal:
    """Dinheiro de sócio que está no meu caixa esperando repasse.

    Entra como passivo: está na conta mas não é meu.
    """
    loans = (
        Loan.query.options(selectinload(Loan.repayments)).all()
    )
    return sum((loan.pending_to_partners for loan in loans), Decimal(0))


def auto_value_map(playlists) -> dict:
    """{playlist_id: valor} só para as posições derivadas (hoje só "loans")."""
    auto = [p for p in playlists if p.auto_source == "loans"]
    if not auto:
        return {}
    total = loans_total()
    return {p.id: total for p in auto}
