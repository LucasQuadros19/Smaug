"""usuarios e dono de cada registro

Revision ID: a36f5cff50f8
Revises: a083e91cf7cb
Create Date: 2026-10-07 01:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a36f5cff50f8'
down_revision = 'a083e91cf7cb'
branch_labels = None
depends_on = None

# Os dados que já existem ficam sem dono até a primeira conta ser criada.
TABLES = (
    'accounts', 'budgets', 'categories', 'goals', 'loans', 'loan_participants', 'loan_repayments',
    'market_symbols', 'market_trades', 'playlists', 'playlist_expectations', 'recurring_transactions',
    'sheets', 'shopping_items', 'snapshots', 'snapshot_entries', 'transactions',
)


def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('username', sa.String(length=30), nullable=False),
        sa.Column('password_hash', sa.String(length=255), nullable=False),
        sa.Column('hidden_tabs', sa.JSON(), nullable=False, server_default='[]'),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('username'),
    )
    for table in TABLES:
        op.add_column(table, sa.Column('user_id', sa.Uuid(), nullable=True))
        op.create_index(f'ix_{table}_user_id', table, ['user_id'])
        op.create_foreign_key(f'fk_{table}_user_id', table, 'users', ['user_id'], ['id'])

    op.drop_constraint('market_symbols_kind_provider_id_key', 'market_symbols', type_='unique')
    op.create_unique_constraint('uq_market_symbols_owner', 'market_symbols', ['user_id', 'kind', 'provider_id'])


def downgrade():
    op.drop_constraint('uq_market_symbols_owner', 'market_symbols', type_='unique')
    op.create_unique_constraint('market_symbols_kind_provider_id_key', 'market_symbols', ['kind', 'provider_id'])

    for table in TABLES:
        op.drop_constraint(f'fk_{table}_user_id', table, type_='foreignkey')
        op.drop_index(f'ix_{table}_user_id', table_name=table)
        op.drop_column(table, 'user_id')
    op.drop_table('users')
