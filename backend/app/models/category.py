from datetime import datetime

from app.extensions import db

CATEGORY_TYPES = ("income", "expense")


class Category(db.Model):
    __tablename__ = "categories"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    color = db.Column(db.String(20), nullable=False, default="#6366f1")
    icon = db.Column(db.String(10), nullable=False, default="💰")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

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
