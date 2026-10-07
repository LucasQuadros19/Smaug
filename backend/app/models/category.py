
from app.extensions import db, utcnow
from app.tenancy import Owned

CATEGORY_TYPES = ("income", "expense")

# Toda conta nova começa com estas.
DEFAULT_CATEGORIES = [
    {"name": "Salário", "type": "income", "color": "#22c55e", "icon": "💼"},
    {"name": "Freelance / Renda extra", "type": "income", "color": "#84cc16", "icon": "🧑‍💻"},
    {"name": "Investimentos", "type": "income", "color": "#10b981", "icon": "📈"},
    {"name": "Vendas", "type": "income", "color": "#14b8a6", "icon": "🏷️"},
    {"name": "Reembolso", "type": "income", "color": "#06b6d4", "icon": "💳"},
    {"name": "Presente recebido", "type": "income", "color": "#a3e635", "icon": "🎉"},
    {"name": "Outras receitas", "type": "income", "color": "#65a30d", "icon": "💵"},
    {"name": "Alimentação", "type": "expense", "color": "#f97316", "icon": "🍔"},
    {"name": "Mercado", "type": "expense", "color": "#fb923c", "icon": "🛒"},
    {"name": "Transporte", "type": "expense", "color": "#eab308", "icon": "🚗"},
    {"name": "Moradia", "type": "expense", "color": "#f43f5e", "icon": "🏠"},
    {"name": "Contas e utilidades", "type": "expense", "color": "#facc15", "icon": "💡"},
    {"name": "Assinaturas", "type": "expense", "color": "#a855f7", "icon": "📺"},
    {"name": "Lazer", "type": "expense", "color": "#8b5cf6", "icon": "🎮"},
    {"name": "Saúde", "type": "expense", "color": "#06b6d4", "icon": "💊"},
    {"name": "Educação", "type": "expense", "color": "#3b82f6", "icon": "📚"},
    {"name": "Vestuário", "type": "expense", "color": "#ec4899", "icon": "👕"},
    {"name": "Cuidados pessoais", "type": "expense", "color": "#f472b6", "icon": "🧴"},
    {"name": "Pets", "type": "expense", "color": "#78716c", "icon": "🐾"},
    {"name": "Presentes e doações", "type": "expense", "color": "#fb7185", "icon": "🎁"},
    {"name": "Investimentos", "type": "expense", "color": "#10b981", "icon": "💹"},
    {"name": "Impostos e taxas", "type": "expense", "color": "#64748b", "icon": "🏛️"},
    {"name": "Outras despesas", "type": "expense", "color": "#64748b", "icon": "🧾"},
]


class Category(Owned, db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    color = db.Column(db.String(20), nullable=False, default="#6366f1")
    icon = db.Column(db.String(10), nullable=False, default="💰")
    created_at = db.Column(db.DateTime, default=utcnow)

    transactions = db.relationship("Transaction", backref="category")
    budgets = db.relationship(
        "Budget", backref="category", cascade="all, delete-orphan"
    )
    recurring_transactions = db.relationship("RecurringTransaction", backref="category")

    def to_dict(self):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "color": self.color,
            "icon": self.icon,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
