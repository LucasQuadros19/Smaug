from app.extensions import db, utcnow
from app.tenancy import Owned

EVENT_DIRECTIONS = ("in", "out")


class CalendarEvent(Owned, db.Model):
    """Evento livre do calendário: IPVA, aniversário, consulta. O valor é opcional."""

    __tablename__ = "calendar_events"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    date = db.Column(db.Date, nullable=False, index=True)
    amount = db.Column(db.Numeric(12, 2), nullable=True)
    # "in" entra dinheiro, "out" sai; vazio é só um lembrete.
    direction = db.Column(db.String(3), nullable=True)
    color = db.Column(db.String(20), nullable=False, default="#8b5cf6")
    notes = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "date": self.date.isoformat(),
            "amount": float(self.amount) if self.amount is not None else None,
            "direction": self.direction,
            "color": self.color,
            "notes": self.notes,
        }
