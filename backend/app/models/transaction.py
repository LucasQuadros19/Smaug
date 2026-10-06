from datetime import datetime

from app.extensions import db

TRANSACTION_TYPES = ("income", "expense")


class Transaction(db.Model):
    __tablename__ = "transactions"

    id = db.Column(db.Integer, primary_key=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id"), nullable=True)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    date = db.Column(db.Date, nullable=False)
    notes = db.Column(db.String(500), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "account_id": self.account_id,
            "category_id": self.category_id,
            "playlist_id": self.playlist_id,
            "description": self.description,
            "amount": float(self.amount),
            "type": self.type,
            "date": self.date.isoformat() if self.date else None,
            "notes": self.notes,
            "category": self.category.to_dict() if self.category else None,
            "account_name": self.account.name if self.account else None,
            "playlist": self.playlist.to_dict() if self.playlist else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
