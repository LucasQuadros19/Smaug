"""Mercado (área de teste): ações e cripto acompanhadas, e o que você comprou.

Isolado de propósito: nada aqui entra no patrimônio, nos ativos ou na
evolução. Só conversa com uma conta quando você escolhe uma na compra.
"""

from decimal import Decimal

from app.extensions import db, utcnow
from app.tenancy import Owned

MARKET_KINDS = ("stock", "crypto")
TRADE_SIDES = ("buy", "sell")


class MarketSymbol(Owned, db.Model):
    __tablename__ = "market_symbols"

    id = db.Column(db.Integer, primary_key=True)
    code = db.Column(db.String(20), nullable=False)  # como você digitou: WEGE3, AAPL, BTC
    kind = db.Column(db.String(10), nullable=False)
    # Como a fonte conhece: "WEGE3.SA" no Yahoo, "bitcoin" no CoinGecko.
    provider_id = db.Column(db.String(60), nullable=False)
    name = db.Column(db.String(120), nullable=False)
    currency = db.Column(db.String(3), nullable=False)  # moeda da cotação: BRL, USD
    created_at = db.Column(db.DateTime, default=utcnow)

    trades = db.relationship(
        "MarketTrade", backref="symbol", cascade="all, delete-orphan", order_by="MarketTrade.date"
    )

    __table_args__ = (db.UniqueConstraint("user_id", "kind", "provider_id", name="uq_market_symbols_owner"),)


class MarketTrade(Owned, db.Model):
    """Uma compra ou venda. `price` é por unidade, na moeda do código."""

    __tablename__ = "market_trades"

    id = db.Column(db.Integer, primary_key=True)
    symbol_id = db.Column(db.Integer, db.ForeignKey("market_symbols.id"), nullable=False)
    side = db.Column(db.String(4), nullable=False)
    date = db.Column(db.Date, nullable=False)
    quantity = db.Column(db.Numeric(18, 8), nullable=False)
    price = db.Column(db.Numeric(18, 8), nullable=False)
    # Reais por unidade da moeda no dia da compra: o custo em R$ de uma ação
    # americana não muda quando o dólar muda depois.
    fx_rate = db.Column(db.Numeric(18, 8), nullable=False, default=1)
    # Só quando você escolheu uma conta: o lançamento que tirou/pôs o dinheiro.
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    transaction_id = db.Column(db.Integer, db.ForeignKey("transactions.id"), nullable=True)
    notes = db.Column(db.String(200), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "symbol_id": self.symbol_id,
            "side": self.side,
            "date": self.date.isoformat(),
            "quantity": float(self.quantity),
            "price": float(self.price),
            "fx_rate": float(self.fx_rate),
            "account_id": self.account_id,
            "notes": self.notes,
        }


def holding(trades) -> dict:
    """Posição pelo custo médio: quanto tenho, quanto paguei e o que já realizei.

    Venda baixa o custo pelo preço médio — a diferença para o preço de venda é
    lucro (ou prejuízo) realizado. Em reais, cada compra vale pela cotação do dia.
    """
    quantity = Decimal(0)
    cost = Decimal(0)
    cost_brl = Decimal(0)
    realized_brl = Decimal(0)
    for trade in sorted(trades, key=lambda t: (t.date, t.id or 0)):
        q, p = Decimal(trade.quantity), Decimal(trade.price)
        fx = Decimal(trade.fx_rate or 1)
        if trade.side == "buy":
            quantity += q
            cost += q * p
            cost_brl += q * p * fx
        else:
            average = cost / quantity if quantity else Decimal(0)
            average_brl = cost_brl / quantity if quantity else Decimal(0)
            quantity -= q
            cost -= average * q
            cost_brl -= average_brl * q
            realized_brl += (p * fx - average_brl) * q
    return {
        "quantity": quantity,
        "cost": cost,
        "cost_brl": cost_brl,
        "average_price": cost / quantity if quantity else Decimal(0),
        "realized_brl": realized_brl,
    }
