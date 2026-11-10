"""avisos escondidos

Revision ID: b7e2f4a9c1d3
Revises: a4d9e1c7f352
Create Date: 2026-11-10 10:00:00.000000

O X de cada aviso do Dashboard guarda a chave dele aqui, na conta de quem escondeu.
"""
from alembic import op
import sqlalchemy as sa


revision = 'b7e2f4a9c1d3'
down_revision = 'a4d9e1c7f352'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('dismissed_alerts', sa.JSON(), nullable=True))


def downgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('dismissed_alerts')
