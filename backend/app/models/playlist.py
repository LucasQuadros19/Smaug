from datetime import datetime
from decimal import Decimal

from app.extensions import db

PLAYLIST_KINDS = ("group", "asset")

# Cada tipo de ativo decide o que um lançamento faz com o valor dele:
#
#   "capital"   — o valor É o dinheiro aplicado. Aportar aumenta, receber de
#                 volta diminui. Os lançamentos são patrimônio mudando de forma,
#                 então ficam fora das despesas/receitas do mês.
#   "declarado" — o valor é uma cotação sua (tabela FIPE, avaliação) e só muda
#                 quando você edita. Os lançamentos são custos e receitas de
#                 verdade: saem do caixa e contam no mês, sem mexer no valor.
#                 Abastecer a moto não deixa a moto mais cara.
ASSET_TYPE_MODES = {
    "investment": "capital",
    "loan": "capital",
    "construction": "capital",
    "debt": "capital",
    "vehicle": "declarado",
    "property": "declarado",
    "other": "capital",
}
ASSET_TYPES = tuple(ASSET_TYPE_MODES)
DEFAULT_ASSET_TYPE = "investment"

# Os tipos cujos lançamentos são gasto/receita de verdade — usado nas consultas.
DECLARED_ASSET_TYPES = tuple(t for t, mode in ASSET_TYPE_MODES.items() if mode == "declarado")


class Playlist(db.Model):
    __tablename__ = "playlists"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    description = db.Column(db.String(300), nullable=True)
    color = db.Column(db.String(20), nullable=False, default="#8b5cf6")
    icon = db.Column(db.String(10), nullable=False, default="📁")
    kind = db.Column(db.String(20), nullable=False, default="group")
    counts_in_net_worth = db.Column(db.Boolean, nullable=False, default=True)
    # Valor que você já tinha antes de começar a registrar (moto que já é sua,
    # empréstimo antigo). Conta no patrimônio sem debitar nenhuma conta.
    # Fica na moeda da posição (`currency`): 1200 numa posição em USD são
    # US$ 1.200. Oito casas para caber fração de bitcoin.
    opening_value = db.Column(db.Numeric(18, 8), nullable=False, default=0)
    currency = db.Column(db.String(3), nullable=False, default="BRL", server_default="BRL")
    # Quando preenchido, o valor da posição é derivado de outra tela em vez de
    # digitado. Hoje só "loans" (soma da minha parte nos empréstimos abertos).
    auto_source = db.Column(db.String(20), nullable=True)
    # Só faz sentido em kind="asset". Ver ASSET_TYPE_MODES acima.
    asset_type = db.Column(
        db.String(20), nullable=False, default=DEFAULT_ASSET_TYPE, server_default=DEFAULT_ASSET_TYPE
    )
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    transactions = db.relationship("Transaction", backref="playlist")
    recurring_transactions = db.relationship("RecurringTransaction", backref="playlist")
    expectations = db.relationship(
        "PlaylistExpectation", backref="playlist", cascade="all, delete-orphan"
    )
    shopping_items = db.relationship(
        "ShoppingItem", backref="playlist", cascade="all, delete-orphan"
    )

    @property
    def value_mode(self):
        """Como os lançamentos afetam o valor. Grupos seguem a regra de capital
        (o saldo do grupo é a soma dos lançamentos, que é o que se espera)."""
        if self.kind != "asset":
            return "capital"
        return ASSET_TYPE_MODES.get(self.asset_type or DEFAULT_ASSET_TYPE, "capital")

    @property
    def rate(self):
        from app.services.rates import rate

        return rate(self.currency)

    @property
    def opening_brl(self) -> Decimal:
        """O valor da posição em reais, pela cotação de agora. Sem cotação
        conhecida (nunca houve internet) vale zero em vez de um número inventado."""
        r = self.rate
        if r is None:
            return Decimal(0)
        return (Decimal(self.opening_value or 0) * r).quantize(Decimal("0.01"))

    def to_dict(self, total_in=None, total_out=None, auto_value=None):
        # Posição derivada ignora o valor digitado e usa o que veio da origem.
        # Daqui para baixo tudo é em reais; `native_value` é o valor na moeda dela.
        is_auto = auto_value is not None
        opening = float(auto_value if is_auto else self.opening_brl)
        rate = self.rate
        balance = None
        outstanding = None
        if total_in is not None and total_out is not None:
            balance = float(total_in) - float(total_out)
            if is_auto or self.value_mode == "declarado":
                # Auto: a origem já é a verdade completa; somar os lançamentos
                # contaria o mesmo dinheiro duas vezes.
                # Declarado: o valor é a cotação. Gasolina e revisão saem do
                # caixa, não entram no preço da moto.
                outstanding = opening
            else:
                # Quanto ainda está parado aqui: o que já era seu + o que saiu
                # do caixa para cá − o que já voltou.
                outstanding = opening + float(total_out) - float(total_in)
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "color": self.color,
            "icon": self.icon,
            "kind": self.kind,
            "counts_in_net_worth": self.counts_in_net_worth,
            "opening_value": opening,
            "currency": self.currency or "BRL",
            "native_value": float(self.opening_value or 0),
            "rate": float(rate) if rate is not None else None,
            "auto_source": self.auto_source,
            "asset_type": self.asset_type or DEFAULT_ASSET_TYPE,
            "value_mode": self.value_mode,
            "total_in": float(total_in) if total_in is not None else None,
            "total_out": float(total_out) if total_out is not None else None,
            "balance": balance,
            "outstanding": outstanding,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
