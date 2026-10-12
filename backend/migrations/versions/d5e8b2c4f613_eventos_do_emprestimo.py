"""eventos do emprestimo

Revision ID: d5e8b2c4f613
Revises: c3f9a1d7e204
Create Date: 2026-10-11 23:00:00.000000

Cada recebimento ou adiamento vira um passo no histórico do empréstimo, com o
que havia antes para poder desfazer. `months_charged` conta os meses de juros
que já venceram; nos antigos, é quantos recebimentos de juros houve.
"""
from alembic import op
import sqlalchemy as sa


revision = 'd5e8b2c4f613'
down_revision = 'c3f9a1d7e204'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'loan_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('loan_id', sa.Integer(), nullable=False),
        sa.Column('kind', sa.String(length=10), nullable=False),
        sa.Column('date', sa.Date(), nullable=False),
        sa.Column('due_before', sa.Date(), nullable=True),
        sa.Column('due_after', sa.Date(), nullable=True),
        sa.Column('charged', sa.Boolean(), nullable=False),
        sa.Column('months_before', sa.Integer(), nullable=False),
        sa.Column('status_before', sa.String(length=20), nullable=False),
        sa.Column('notes', sa.String(length=300), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('user_id', sa.Uuid(), nullable=True),
        sa.ForeignKeyConstraint(['loan_id'], ['loans.id']),
        sa.ForeignKeyConstraint(['user_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    with op.batch_alter_table('loan_events', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_loan_events_loan_id'), ['loan_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_loan_events_user_id'), ['user_id'], unique=False)

    with op.batch_alter_table('loan_repayments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('event_id', sa.Integer(), nullable=True))
        batch_op.create_index(batch_op.f('ix_loan_repayments_event_id'), ['event_id'], unique=False)
        batch_op.create_foreign_key('fk_loan_repayments_event_id', 'loan_events', ['event_id'], ['id'])

    with op.batch_alter_table('loans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('months_charged', sa.Integer(), nullable=False, server_default='0'))
    op.execute(
        "UPDATE loans SET months_charged = "
        "(SELECT COUNT(*) FROM loan_repayments r WHERE r.loan_id = loans.id AND r.kind = 'interest')"
    )


def downgrade():
    with op.batch_alter_table('loans', schema=None) as batch_op:
        batch_op.drop_column('months_charged')

    with op.batch_alter_table('loan_repayments', schema=None) as batch_op:
        batch_op.drop_constraint('fk_loan_repayments_event_id', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_loan_repayments_event_id'))
        batch_op.drop_column('event_id')

    with op.batch_alter_table('loan_events', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_loan_events_user_id'))
        batch_op.drop_index(batch_op.f('ix_loan_events_loan_id'))
    op.drop_table('loan_events')
