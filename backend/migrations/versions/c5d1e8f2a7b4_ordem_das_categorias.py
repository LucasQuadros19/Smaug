"""ordem das categorias

Revision ID: c5d1e8f2a7b4
Revises: b7e2f4a9c1d3
Create Date: 2026-11-10 15:00:00.000000

Em Categorias dá para arrastar a ordem; os seletores seguem ela. As que já
existem ficam com 0 e continuam em ordem alfabética até alguém mexer.
"""
from alembic import op
import sqlalchemy as sa


revision = 'c5d1e8f2a7b4'
down_revision = 'b7e2f4a9c1d3'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.add_column(sa.Column('position', sa.Integer(), nullable=False, server_default='0'))


def downgrade():
    with op.batch_alter_table('categories', schema=None) as batch_op:
        batch_op.drop_column('position')
