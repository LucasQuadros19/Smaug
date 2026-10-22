"""lançamento sem conta

Revision ID: c3e8a1f5d702
Revises: b4d1e7f2a903
Create Date: 2026-10-22 10:00:00.000000

Zerar um ativo à mão na planilha vira uma saída de 100% sem conta: o valor do
ativo some sem dinheiro entrar em conta nenhuma.
"""
from alembic import op
import sqlalchemy as sa


revision = 'c3e8a1f5d702'
down_revision = 'b4d1e7f2a903'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.alter_column('account_id', existing_type=sa.Integer(), nullable=True)


def downgrade():
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.alter_column('account_id', existing_type=sa.Integer(), nullable=False)
