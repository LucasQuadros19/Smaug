"""meta separada

Revision ID: f3a8c2e6b941
Revises: e9c4a7b2d518
Create Date: 2026-10-28 15:00:00.000000

Meta que não olha o patrimônio nem uma posição: a pessoa informa quanto já
guardou (uma viagem de 10 mil não aparece batida só porque o patrimônio é maior).
"""
from alembic import op
import sqlalchemy as sa


revision = 'f3a8c2e6b941'
down_revision = 'e9c4a7b2d518'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('goals', schema=None) as batch_op:
        batch_op.add_column(sa.Column('saved_amount', sa.Numeric(precision=12, scale=2), nullable=True))


def downgrade():
    with op.batch_alter_table('goals', schema=None) as batch_op:
        batch_op.drop_column('saved_amount')
