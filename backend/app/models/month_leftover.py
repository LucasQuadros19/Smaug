from app.extensions import db, utcnow
from app.tenancy import Owned


class MonthLeftover(Owned, db.Model):
    """Quanto sobrou no mês, digitado por você (olhando o banco). A tela de
    Análises mostra ao lado da sobra calculada pelos lançamentos."""

    __tablename__ = "month_leftovers"
    __table_args__ = (db.UniqueConstraint("user_id", "month", name="uq_month_leftover_user_month"),)

    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.Date, nullable=False)  # sempre dia 1 do mês
    amount = db.Column(db.Numeric(12, 2), nullable=False)
    created_at = db.Column(db.DateTime, default=utcnow)
