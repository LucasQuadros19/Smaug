"""compartilhamento entre contas e versao da sessao

Revision ID: 341f0b19ef7a
Revises: a36f5cff50f8
Create Date: 2026-10-07 02:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '341f0b19ef7a'
down_revision = 'a36f5cff50f8'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('users', sa.Column('session_version', sa.Integer(), nullable=False, server_default='0'))
    op.create_table(
        'shares',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('inviter_id', sa.Uuid(), nullable=False),
        sa.Column('invitee_id', sa.Uuid(), nullable=False),
        sa.Column('inviter_sections', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('invitee_sections', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('accepted_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['inviter_id'], ['users.id']),
        sa.ForeignKeyConstraint(['invitee_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('inviter_id', 'invitee_id'),
    )
    op.create_index('ix_shares_inviter_id', 'shares', ['inviter_id'])
    op.create_index('ix_shares_invitee_id', 'shares', ['invitee_id'])


def downgrade():
    op.drop_index('ix_shares_invitee_id', table_name='shares')
    op.drop_index('ix_shares_inviter_id', table_name='shares')
    op.drop_table('shares')
    op.drop_column('users', 'session_version')
