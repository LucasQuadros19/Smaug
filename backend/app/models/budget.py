
from app.extensions import db, utcnow
from app.tenancy import Owned


class Budget(Owned, db.Model):
    __tablename__ = "budgets"
    __table_args__ = (
        db.UniqueConstraint("category_id", "month", name="uq_budget_category_month"),
    )

    id = db.Column(db.Integer, primary_key=True)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=False)
    month = db.Column(db.Date, nullable=False)  # sempre dia 1 do mês
    limit_amount = db.Column(db.Numeric(12, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self, spent=None):
        return {
            "id": self.id,
            "category_id": self.category_id,
            "month": self.month.isoformat() if self.month else None,
            "limit_amount": float(self.limit_amount),
            "spent": float(spent) if spent is not None else None,
            "category": self.category.to_dict() if self.category else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
