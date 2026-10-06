
from app.extensions import db, utcnow

SHOPPING_PRIORITIES = ("low", "medium", "high")


class ShoppingItem(db.Model):
    __tablename__ = "shopping_items"

    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id"), nullable=True)
    priority = db.Column(db.String(20), nullable=False, default="medium")
    notes = db.Column(db.String(500), nullable=True)
    purchased = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "description": self.description,
            "amount": float(self.amount) if self.amount is not None else None,
            "playlist_id": self.playlist_id,
            "priority": self.priority,
            "notes": self.notes,
            "purchased": self.purchased,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
