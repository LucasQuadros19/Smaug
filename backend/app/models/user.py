import uuid

from app.extensions import db, utcnow


class User(db.Model):
    __tablename__ = "users"

    # Aleatório: ninguém chega a outra conta testando 1, 2, 3...
    id = db.Column(db.Uuid, primary_key=True, default=uuid.uuid4)
    username = db.Column(db.String(30), nullable=False, unique=True)
    password_hash = db.Column(db.String(255), nullable=False)
    # Caminhos das abas escondidas na barra lateral ("/mercado"). A URL continua abrindo.
    hidden_tabs = db.Column(db.JSON, nullable=False, default=list)
    # Vai no cookie de login; trocar a senha soma 1 e desconecta os outros aparelhos.
    session_version = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, default=utcnow)

    def to_dict(self):
        return {"id": str(self.id), "username": self.username, "hidden_tabs": self.hidden_tabs}
