"""comissao manual por pessoa

Revision ID: 8c3e1f6b2d71
Revises: 5d2f7c1a9e40
Create Date: 2026-10-11 19:00:00.000000

A comissão deixa de ser % do lucro calculada e vira um valor digitado, de quem
a pessoa escolher. Empréstimos antigos com comissão: o valor calculado passa
para a linha "eu" e sai de dentro do "recebe" dela, onde o cálculo antigo o punha.
"""
from decimal import Decimal

from alembic import op
import sqlalchemy as sa


revision = '8c3e1f6b2d71'
down_revision = '5d2f7c1a9e40'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('loan_participants', schema=None) as batch_op:
        batch_op.add_column(sa.Column('commission', sa.Numeric(12, 2), nullable=False, server_default='0'))

    bind = op.get_bind()
    loans = bind.execute(sa.text("SELECT id, commission_rate FROM loans WHERE commission_rate > 0")).all()
    for loan_id, rate in loans:
        people = bind.execute(
            sa.text("SELECT id, contributed, to_receive, is_me FROM loan_participants WHERE loan_id = :id ORDER BY id"),
            {"id": loan_id},
        ).all()
        me = next((p for p in people if p.is_me), None)
        if me is None:
            continue
        received = sum((Decimal(p.to_receive) for p in people), Decimal(0))
        contributed = sum((Decimal(p.contributed) for p in people), Decimal(0))
        commission = (max(received - contributed, Decimal(0)) * Decimal(rate) / 100).quantize(Decimal("0.01"))
        commission = min(commission, Decimal(me.to_receive))
        bind.execute(
            sa.text("UPDATE loan_participants SET commission = :c, to_receive = to_receive - :c WHERE id = :id"),
            {"c": commission, "id": me.id},
        )

    with op.batch_alter_table('loans', schema=None) as batch_op:
        batch_op.drop_column('commission_rate')


def downgrade():
    with op.batch_alter_table('loans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('commission_rate', sa.Numeric(5, 2), nullable=True))

    op.execute("UPDATE loan_participants SET to_receive = to_receive + commission")

    with op.batch_alter_table('loan_participants', schema=None) as batch_op:
        batch_op.drop_column('commission')
