"""Mercado: ações e cripto acompanhadas, e o que você comprou.

Tudo o que você tem aqui entra no patrimônio pela posição "Mercado", sempre
pela cotação de agora — o patrimônio sobe e desce com o mercado.
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
    # Corretagem e taxas em reais: entram no custo da compra e saem do que a venda rende.
    fees = db.Column(db.Numeric(12, 2), nullable=False, default=0, server_default="0")
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
            "fees": float(self.fees or 0),
            "account_id": self.account_id,
            "notes": self.notes,
        }


def holding(trades) -> dict:
    """Posição pelo custo médio: quanto tenho, quanto paguei e o que já realizei.

    Venda baixa o custo pelo preço médio — a diferença para o preço de venda é
    lucro (ou prejuízo) realizado. Em reais, cada compra vale pela cotação do dia
    e as taxas entram no custo (compra) ou saem do que a venda rendeu.
    `by_month` junta vendas e lucro realizado por mês, para a estimativa de IR.
    """
    quantity = Decimal(0)
    cost = Decimal(0)
    cost_brl = Decimal(0)
    realized_brl = Decimal(0)
    by_month = {}
    for trade in sorted(trades, key=lambda t: (t.date, t.id or 0)):
        q, p = Decimal(trade.quantity), Decimal(trade.price)
        fx = Decimal(trade.fx_rate or 1)
        fees = Decimal(trade.fees or 0)
        if trade.side == "buy":
            quantity += q
            cost += q * p
            cost_brl += q * p * fx + fees
        else:
            average = cost / quantity if quantity else Decimal(0)
            average_brl = cost_brl / quantity if quantity else Decimal(0)
            quantity -= q
            cost -= average * q
            cost_brl -= average_brl * q
            gain = q * p * fx - fees - average_brl * q
            realized_brl += gain
            month = by_month.setdefault(trade.date.strftime("%Y-%m"), {"sales": Decimal(0), "realized": Decimal(0)})
            month["sales"] += q * p * fx
            month["realized"] += gain
    return {
        "quantity": quantity,
        "cost": cost,
        "cost_brl": cost_brl,
        "average_price": cost / quantity if quantity else Decimal(0),
        "realized_brl": realized_brl,
        "by_month": by_month,
    }


def market_value(pos, quote, fx):
    """Quanto vale no patrimônio, em reais: pela cotação de agora.

    Sem cotação (sem internet, fonte fora do ar), vale o que foi pago em vez de zero.
    """
    qty = pos["quantity"]
    if qty <= 0:
        return Decimal(0)
    if quote and fx is not None:
        return qty * Decimal(str(quote["price"])) * fx
    return pos["cost_brl"]
