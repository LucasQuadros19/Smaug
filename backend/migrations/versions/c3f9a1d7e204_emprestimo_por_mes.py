"""emprestimo por mes

Revision ID: c3f9a1d7e204
Revises: b7a4d2e9c815
Create Date: 2026-10-11 21:00:00.000000

Empréstimo passa a ter meses e jeito de pagar (só juros ou parcelas); o ganho de
cada pessoa vira "por mês" e os recebimentos dizem se são juros ou principal.
Os antigos são de 1 mês: o ganho é o que a pessoa recebia menos o que entrou,
e os recebimentos já feitos contam como principal (como contavam antes).
"""
from alembic import op
import sqlalchemy as sa


revision = 'c3f9a1d7e204'
down_revision = 'b7a4d2e9c815'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('loans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('months', sa.Integer(), nullable=False, server_default='1'))
        batch_op.add_column(sa.Column('schedule', sa.String(length=20), nullable=False, server_default='interest_only'))

    with op.batch_alter_table('loan_participants', schema=None) as batch_op:
        batch_op.add_column(sa.Column('gain', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.execute("UPDATE loan_participants SET gain = GREATEST(to_receive - contributed, 0)"
               if op.get_bind().dialect.name == "postgresql"
               else "UPDATE loan_participants SET gain = MAX(to_receive - contributed, 0)")
    with op.batch_alter_table('loan_participants', schema=None) as batch_op:
        batch_op.drop_column('to_receive')

    with op.batch_alter_table('loan_repayments', schema=None) as batch_op:
        batch_op.add_column(sa.Column('kind', sa.String(length=10), nullable=False, server_default='principal'))


def downgrade():
    with op.batch_alter_table('loan_repayments', schema=None) as batch_op:
        batch_op.drop_column('kind')

    with op.batch_alter_table('loan_participants', schema=None) as batch_op:
        batch_op.add_column(sa.Column('to_receive', sa.Numeric(12, 2), nullable=False, server_default='0'))
    op.execute(
        "UPDATE loan_participants SET to_receive = contributed + gain * "
        "(SELECT months FROM loans WHERE loans.id = loan_participants.loan_id)"
    )
    with op.batch_alter_table('loan_participants', schema=None) as batch_op:
        batch_op.drop_column('gain')

    with op.batch_alter_table('loans', schema=None) as batch_op:
        batch_op.drop_column('schedule')
        batch_op.drop_column('months')
