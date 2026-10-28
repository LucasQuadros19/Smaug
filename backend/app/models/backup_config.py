from app.extensions import db


class BackupConfig(db.Model):
    """O backup por e-mail, editado em Configurações por quem criou a primeira conta.

    Uma linha só (id 1). É do sistema, não de um usuário: a cópia do banco leva
    os dados de todas as contas.
    """

    __tablename__ = "backup_config"

    id = db.Column(db.Integer, primary_key=True)
    # [{"email": "...", "banco": true}]: quem não tem o banco recebe só a planilha.
    destinatarios = db.Column(db.JSON, nullable=False, default=list)
    # Abre o anexo. Nunca volta para a tela.
    senha = db.Column(db.String(64))
    freq_banco = db.Column(db.String(10), nullable=False, default="diario")
    freq_planilha = db.Column(db.String(10), nullable=False, default="semanal")
    # {"quando": "AAAA-MM-DD HH:MM", "ok": bool, "texto": "..."}, gravado pelo worker.
    ultimo_envio = db.Column(db.JSON)
    # Botão "Enviar agora": o worker vê, limpa e manda.
    envio_pedido_em = db.Column(db.DateTime)
