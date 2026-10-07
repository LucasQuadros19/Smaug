
from app.extensions import db, utcnow
from app.tenancy import Owned


class Sheet(Owned, db.Model):
    """Uma folha de cálculo: texto livre, uma conta por linha. As contas são
    feitas na tela; aqui só fica guardado o que você escreveu."""

    __tablename__ = "sheets"

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(100), nullable=False, default="Nova folha")
    content = db.Column(db.Text, nullable=False, default="")
    created_at = db.Column(db.DateTime, default=utcnow)
    updated_at = db.Column(db.DateTime, default=utcnow, onupdate=utcnow)

    def to_dict(self):
        return {
            "id": self.id,
            "title": self.title,
            "content": self.content,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
