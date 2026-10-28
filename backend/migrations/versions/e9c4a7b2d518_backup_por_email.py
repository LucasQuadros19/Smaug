"""backup por e-mail

Revision ID: e9c4a7b2d518
Revises: d7f2b9c4e816
Create Date: 2026-10-28 12:00:00.000000

Quem recebe o backup, a senha do anexo e a frequência de cada arquivo saem do
.env do servidor e passam a ser editados em Configurações.
"""
from alembic import op
import sqlalchemy as sa


revision = 'e9c4a7b2d518'
down_revision = 'd7f2b9c4e816'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'backup_config',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('destinatarios', sa.JSON(), nullable=False),
        sa.Column('senha', sa.String(length=64), nullable=True),
        sa.Column('freq_banco', sa.String(length=10), nullable=False),
        sa.Column('freq_planilha', sa.String(length=10), nullable=False),
        sa.Column('ultimo_envio', sa.JSON(), nullable=True),
        sa.Column('envio_pedido_em', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade():
    op.drop_table('backup_config')
