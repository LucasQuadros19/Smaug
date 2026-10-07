from datetime import date

from app.extensions import db, utcnow
from app.tenancy import Owned

EXPECTATION_STATUSES = ("pending", "received", "cancelled")


class PlaylistExpectation(Owned, db.Model):
    __tablename__ = "playlist_expectations"

    id = db.Column(db.Integer, primary_key=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id"), nullable=False)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    expected_date = db.Column(db.Date, nullable=False)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending")
    transaction_id = db.Column(db.Integer, db.ForeignKey("transactions.id"), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "playlist_id": self.playlist_id,
            "description": self.description,
            "amount": float(self.amount),
            "expected_date": self.expected_date.isoformat() if self.expected_date else None,
            "account_id": self.account_id,
            "status": self.status,
            "transaction_id": self.transaction_id,
            "is_overdue": self.status == "pending" and self.expected_date < date.today(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
