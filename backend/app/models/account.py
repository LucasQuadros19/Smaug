
from app.extensions import db, utcnow

ACCOUNT_TYPES = ("checking", "savings", "credit_card", "cash", "investment")


class Account(db.Model):
    __tablename__ = "accounts"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20), nullable=False, default="checking")
    initial_balance = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    color = db.Column(db.String(20), nullable=False, default="#6366f1")
    created_at = db.Column(db.DateTime, default=utcnow)

    transactions = db.relationship(
        "Transaction", backref="account", cascade="all, delete-orphan"
    )
    recurring_transactions = db.relationship(
        "RecurringTransaction", backref="account", cascade="all, delete-orphan"
    )

    def to_dict(self, balance=None):
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "initial_balance": float(self.initial_balance),
            "color": self.color,
            "balance": float(balance) if balance is not None else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
