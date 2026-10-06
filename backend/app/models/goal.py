from datetime import date

from app.extensions import db, utcnow


class Goal(db.Model):
    """Uma meta: chegar a X reais. Ligada a uma posição (ativo/grupo) ou, sem
    posição, ao patrimônio total."""

    __tablename__ = "goals"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    icon = db.Column(db.String(10), nullable=False, default="🎯")
    target_amount = db.Column(db.Numeric(12, 2), nullable=False)
    deadline = db.Column(db.Date, nullable=True)
    playlist_id = db.Column(db.Integer, db.ForeignKey("playlists.id", ondelete="SET NULL"), nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    playlist = db.relationship("Playlist")

    def to_dict(self, current: float):
        target = float(self.target_amount)
        remaining = max(target - current, 0)
        today = date.today()

        months_left = None
        monthly_needed = None
        if self.deadline and self.deadline >= today:
            # Conta o mês corrente: faltando 0 meses ainda dá para guardar este.
            months_left = (self.deadline.year - today.year) * 12 + self.deadline.month - today.month + 1
            monthly_needed = remaining / months_left

        return {
            "id": self.id,
            "name": self.name,
            "icon": self.icon,
            "target_amount": target,
            "deadline": self.deadline.isoformat() if self.deadline else None,
            "playlist_id": self.playlist_id,
            "playlist": (
                {"id": self.playlist.id, "name": self.playlist.name, "icon": self.playlist.icon, "kind": self.playlist.kind}
                if self.playlist
                else None
            ),
            "current": current,
            "remaining": remaining,
            "progress": min(current / target, 1) if target > 0 else 0,
            "done": current >= target,
            "overdue": bool(self.deadline and self.deadline < today and current < target),
            "months_left": months_left,
            "monthly_needed": monthly_needed,
        }
