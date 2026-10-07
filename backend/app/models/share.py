from app.extensions import db, utcnow

# O que dá para compartilhar. O Dashboard só abre com todas.
SECTIONS = ("contas", "patrimonio", "emprestimos", "mercado", "calculos")


class Share(db.Model):
    """Ligação entre duas contas, aceita pelas duas.

    Cada lado escolhe o que mostra ao outro — tudo, algumas partes ou nada — e
    pode mudar isso quando quiser. Quem recebe vê e edita o que foi mostrado.
    """

    __tablename__ = "shares"
    __table_args__ = (db.UniqueConstraint("inviter_id", "invitee_id"),)

    id = db.Column(db.Integer, primary_key=True)
    inviter_id = db.Column(db.Uuid, db.ForeignKey("users.id"), nullable=False, index=True)
    invitee_id = db.Column(db.Uuid, db.ForeignKey("users.id"), nullable=False, index=True)
    inviter_sections = db.Column(db.JSON, nullable=False, default=list)
    invitee_sections = db.Column(db.JSON, nullable=False, default=list)
    accepted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=utcnow)

    inviter = db.relationship("User", foreign_keys=[inviter_id])
    invitee = db.relationship("User", foreign_keys=[invitee_id])

    def sections_of(self, user_id):
        """O que `user_id` mostra para o outro lado."""
        return self.inviter_sections if user_id == self.inviter_id else self.invitee_sections

    def set_sections_of(self, user_id, sections):
        if user_id == self.inviter_id:
            self.inviter_sections = sections
        else:
            self.invitee_sections = sections

    def to_dict(self, me):
        other = self.invitee if me == self.inviter_id else self.inviter
        if self.accepted_at:
            status = "active"
        else:
            status = "outgoing" if me == self.inviter_id else "incoming"
        return {
            "id": self.id,
            "status": status,
            "user": {"id": str(other.id), "username": other.username},
            "i_share": self.sections_of(me),
            "they_share": self.sections_of(other.id),
        }
