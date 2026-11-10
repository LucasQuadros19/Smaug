"""passivos e sobra informada

Revision ID: d8a3b6c4e9f1
Revises: c5d1e8f2a7b4
Create Date: 2026-11-10 16:00:00.000000

`playlists.as_liability`: ativo que você marca como passivo (vai para a direita
da Evolução). `month_leftovers`: a sobra do mês que você digita.
"""
from alembic import op
import sqlalchemy as sa


revision = 'd8a3b6c4e9f1'
down_revision = 'c5d1e8f2a7b4'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('playlists', schema=None) as batch_op:
        batch_op.add_column(sa.Column('as_liability', sa.Boolean(), nullable=False, server_default=sa.false()))

    op.create_table(
        'month_leftovers',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('month', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'month', name='uq_month_leftover_user_month'),
    )
    with op.batch_alter_table('month_leftovers', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_month_leftovers_user_id'), ['user_id'], unique=False)


def downgrade():
    with op.batch_alter_table('month_leftovers', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_month_leftovers_user_id'))
    op.drop_table('month_leftovers')
    with op.batch_alter_table('playlists', schema=None) as batch_op:
        batch_op.drop_column('as_liability')
