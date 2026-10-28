"""linha do dia

Revision ID: a4d9e1c7f352
Revises: f3a8c2e6b941
Create Date: 2026-10-28 18:00:00.000000

Depois de uma mudança que mexe em valor, a Evolução grava sozinha a linha do
dia (uma por dia). `auto` separa essas linhas das feitas à mão.
"""
from alembic import op
import sqlalchemy as sa


revision = 'a4d9e1c7f352'
down_revision = 'f3a8c2e6b941'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('snapshots', schema=None) as batch_op:
        batch_op.add_column(sa.Column('auto', sa.Boolean(), nullable=False, server_default=sa.false()))


def downgrade():
    with op.batch_alter_table('snapshots', schema=None) as batch_op:
        batch_op.drop_column('auto')
