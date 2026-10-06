
from app.extensions import db, utcnow

RECURRING_FREQUENCIES = ("weekly", "monthly", "yearly")


class RecurringTransaction(db.Model):
    __tablename__ = "recurring_transactions"

    id = db.Column(db.Integer, primary_key=True)
    description = db.Column(db.String(200), nullable=False)
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    category_id = db.Column(db.Integer, db.ForeignKey("categories.id"), nullable=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=False)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id"), nullable=True)
    frequency = db.Column(db.String(20), nullable=False, default="monthly")
    next_due_date = db.Column(db.Date, nullable=False)
    # Adiamento só da ocorrência atual. Lançada, a próxima volta ao calendário
    # normal: aluguel do dia 5 adiado para o 12 continua vencendo dia 5 depois.
    postponed_until = db.Column(db.Date, nullable=True)
    active = db.Column(db.Boolean, nullable=False, default=True)
    # Duas chaves diferentes: `active` diz se a conta ainda existe na rotina,
    # `auto` diz quem lança. No manual o valor real varia todo mês (a luz nunca
    # vem igual), então quem lança é você, informando o valor daquele mês.
    auto = db.Column(db.Boolean, nullable=False, default=True, server_default=db.true())
    created_at = db.Column(db.DateTime, default=utcnow)

    @property
    def due_date(self):
        """Quando a ocorrência atual vence de fato (com adiamento, se houver)."""
        return self.postponed_until or self.next_due_date

    def to_dict(self):
        return {
            "id": self.id,
            "description": self.description,
            "amount": float(self.amount),
            "type": self.type,
            "category_id": self.category_id,
            "account_id": self.account_id,
            "playlist_id": self.playlist_id,
            "frequency": self.frequency,
            "next_due_date": self.next_due_date.isoformat()
            if self.next_due_date
            else None,
            "postponed_until": self.postponed_until.isoformat() if self.postponed_until else None,
            "due_date": self.due_date.isoformat() if self.due_date else None,
            "active": self.active,
            "auto": self.auto,
            "category": self.category.to_dict() if self.category else None,
            "account_name": self.account.name if self.account else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
