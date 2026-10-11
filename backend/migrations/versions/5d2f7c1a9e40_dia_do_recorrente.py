"""dia do recorrente

Revision ID: 5d2f7c1a9e40
Revises: 341f0b19ef7a
Create Date: 2026-10-11 17:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = '5d2f7c1a9e40'
down_revision = '341f0b19ef7a'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('recurring_transactions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('due_day', sa.SmallInteger(), nullable=True))


def downgrade():
    with op.batch_alter_table('recurring_transactions', schema=None) as batch_op:
        batch_op.drop_column('due_day')
