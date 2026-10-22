"""transferência no caixa

Revision ID: d7f2b9c4e816
Revises: c3e8a1f5d702
Create Date: 2026-10-22 12:00:00.000000

Aportei, Vendi e Transferir da planilha passam a gerar lançamentos no Caixa,
ligados por transfer_group: ficam fora de receitas e despesas e saem juntos.
"""
from alembic import op
import sqlalchemy as sa


revision = 'd7f2b9c4e816'
down_revision = 'c3e8a1f5d702'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transfer_group', sa.Uuid(), nullable=True))
        batch_op.create_index(batch_op.f('ix_transactions_transfer_group'), ['transfer_group'], unique=False)


def downgrade():
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_transactions_transfer_group'))
        batch_op.drop_column('transfer_group')
