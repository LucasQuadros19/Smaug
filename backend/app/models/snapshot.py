
from app.extensions import db, utcnow


class Snapshot(db.Model):
    """Uma linha do registro de patrimônio: nesta data, cada posição vale X."""

    __tablename__ = "snapshots"

    id = db.Column(db.Integer, primary_key=True)
    date = db.Column(db.Date, nullable=False)
    # Coluna "Entrada" da planilha original. É preservada e exibida, mas não
    # entra em nenhuma soma — o uso dela na planilha era inconsistente.
    inflow = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    notes = db.Column(db.String(300), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    entries = db.relationship(
        "SnapshotEntry", backref="snapshot", cascade="all, delete-orphan"
    )

    def to_dict(self):
        positions = {}
        native = {}
        cash = {}
        for entry in self.entries:
            if entry.playlist_id is not None:
                positions[str(entry.playlist_id)] = float(entry.value)
                if entry.native_value is not None:
                    native[str(entry.playlist_id)] = float(entry.native_value)
            elif entry.account_id is not None:
                cash[str(entry.account_id)] = float(entry.value)

        invested = sum(positions.values())
        cash_total = sum(cash.values())
        return {
            "id": self.id,
            "date": self.date.isoformat() if self.date else None,
            "inflow": float(self.inflow or 0),
            "notes": self.notes,
            "positions": positions,
            # Só posições em outra moeda: o valor digitado (US$, BTC...).
            "native": native,
            "cash": cash,
            "invested": invested,
            "cash_total": cash_total,
            "net_worth": invested + cash_total,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SnapshotEntry(db.Model):
    __tablename__ = "snapshot_entries"

    id = db.Column(db.Integer, primary_key=True)
    snapshot_id = db.Column(db.Integer, db.ForeignKey("snapshots.id"), nullable=False)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id"), nullable=True)
    account_id = db.Column(db.Integer, db.ForeignKey("accounts.id"), nullable=True)
    # Sempre em reais, convertido na data do registro — o histórico não muda
    # quando o dólar muda.
    value = db.Column(db.Numeric(12, 2), nullable=False, default=0)
    # Posição em outra moeda: o valor na moeda dela (ex: US$ 1.200).
    native_value = db.Column(db.Numeric(18, 8), nullable=True)

    def to_dict(self):
        return {
            "id": self.id,
            "snapshot_id": self.snapshot_id,
            "playlist_id": self.playlist_id,
            "account_id": self.account_id,
            "value": float(self.value),
        }
