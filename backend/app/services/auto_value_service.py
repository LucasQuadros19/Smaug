"""Valores de posições derivadas de outras telas.

Uma posição com `auto_source` não é digitada: ela é a soma do que está
registrado na tela de origem (Empréstimos, ou tudo o que está no Mercado). Mexer lá reflete no patrimônio, na planilha e nos gráficos sem precisar
reeditar nada.
"""

from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import selectinload

from app.models.loan import Loan

# Empréstimos quitados saem do patrimônio; o dinheiro já voltou para o caixa.
OPEN_LOAN_STATUSES = ("active", "late")


def loans_total() -> Decimal:
    """Meu dinheiro ainda na rua: principal meu menos o que já voltou."""
    loans = (
        Loan.query.options(selectinload(Loan.participants), selectinload(Loan.repayments))
        .filter(Loan.status.in_(OPEN_LOAN_STATUSES))
        .all()
    )
    return sum((loan.my_outstanding for loan in loans), Decimal(0))


def pending_to_partners() -> Decimal:
    """Dinheiro de sócio que está no meu caixa esperando repasse.

    Entra como passivo: está na conta mas não é meu.
    """
    loans = (
        Loan.query.options(selectinload(Loan.repayments)).all()
    )
    return sum((loan.pending_to_partners for loan in loans), Decimal(0))


def market_total() -> Decimal:
    """Tudo o que tenho no Mercado, em reais, pela cotação de agora."""
    from app.models.market import MarketSymbol, holding, market_value
    from app.services import market_service
    from app.services.rates import rate

    symbols = MarketSymbol.query.options(selectinload(MarketSymbol.trades)).all()
    positions = {s.id: holding(s.trades) for s in symbols}
    held = [s for s in symbols if positions[s.id]["quantity"] > 0]
    quotes = market_service.quotes(held) if held else {}
    total = sum(
        (market_value(positions[s.id], quotes.get(s.id), rate(s.currency)) for s in held), Decimal(0)
    )
    return total.quantize(Decimal("0.01"))


def market_position():
    """A posição que leva o Mercado para o patrimônio. Criada sozinha na primeira vez."""
    from app.extensions import db
    from app.models.playlist import Playlist

    position = Playlist.query.filter_by(auto_source="market").order_by(Playlist.id).first()
    if position is None:
        position = Playlist(
            name="Mercado",
            kind="asset",
            asset_type="investment",
            icon="📈",
            color="#2a78d6",
            counts_in_net_worth=True,
            auto_source="market",
        )
        db.session.add(position)
        db.session.flush()
    return position


def auto_value_map(playlists) -> dict:
    """{playlist_id: valor} só para as posições ligadas a outra tela."""
    result = {}
    from_loans = [p for p in playlists if p.auto_source == "loans"]
    if from_loans:
        total = loans_total()
        result.update({p.id: total for p in from_loans})
    from_market = [p.id for p in playlists if p.auto_source == "market"]
    if from_market:
        # Uma posição só leva o Mercado; se houver mais de uma, a mais antiga fica com tudo.
        from app.extensions import db
        from app.models.playlist import Playlist

        first = db.session.query(func.min(Playlist.id)).filter(Playlist.auto_source == "market").scalar()
        total = market_total() if first in from_market else Decimal(0)
        result.update({pid: total if pid == first else Decimal(0) for pid in from_market})
    return result
