"""calendario

Revision ID: b7a4d2e9c815
Revises: 8c3e1f6b2d71
Create Date: 2026-10-11 19:30:00.000000

"""
from alembic import op
import sqlalchemy as sa


revision = 'b7a4d2e9c815'
down_revision = '8c3e1f6b2d71'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'calendar_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=120), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('amount', sa.Numeric(precision=12, scale=2), nullable=True),
        sa.Column('direction', sa.String(length=3), nullable=True),
        sa.Column('color', sa.String(length=20), nullable=False),
        sa.Column('notes', sa.String(length=300), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('calendar_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_calendar_events_date'), ['date'], unique=False)
        batch_op.create_index(batch_op.f('ix_calendar_events_user_id'), ['user_id'], unique=False)

    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.add_column(sa.Column('recurring_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_transactions_recurring_id'), ['recurring_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_transactions_recurring_id', 'recurring_transactions', ['recurring_id'], ['id'], ondelete='SET NULL'
        )


def downgrade():
    with op.batch_alter_table('transactions', schema=None) as batch_op:
        batch_op.drop_constraint('fk_transactions_recurring_id', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_transactions_recurring_id'))
        batch_op.drop_column('recurring_id')

    with op.batch_alter_table('calendar_events', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_calendar_events_user_id'))
        batch_op.drop_index(batch_op.f('ix_calendar_events_date'))

    op.drop_table('calendar_events')
