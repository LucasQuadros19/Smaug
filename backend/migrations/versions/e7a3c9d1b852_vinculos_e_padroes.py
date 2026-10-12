"""vinculos e padroes

Revision ID: e7a3c9d1b852
Revises: d5e8b2c4f613
Create Date: 2026-10-12 10:00:00.000000

Liga o resto do sistema: códigos do Mercado entram no patrimônio por uma
posição (pela cotação ou por um preço anotado), posição em outra moeda pode
fixar o câmbio, empréstimo e item da lista de compras podem lançar no caixa,
e cada usuário guarda os próprios padrões de mercado. Tudo aditivo: o que já
existe continua como estava (código do Mercado fica fora do patrimônio).
"""
from alembic import op
import sqlalchemy as sa


revision = 'e7a3c9d1b852'
down_revision = 'd5e8b2c4f613'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.add_column(sa.Column('settings', sa.JSON(), nullable=True))

    with op.batch_alter_table('playlists', schema=None) as batch_op:
        batch_op.add_column(sa.Column('follows_market', sa.Boolean(), nullable=False, server_default=sa.true()))
        batch_op.add_column(sa.Column('noted_rate', sa.Numeric(18, 8), nullable=True))

    with op.batch_alter_table('market_symbols', schema=None) as batch_op:
        batch_op.add_column(sa.Column('playlist_id', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('follows_market', sa.Boolean(), nullable=False, server_default=sa.false()))
        batch_op.add_column(sa.Column('noted_price', sa.Numeric(18, 8), nullable=True))
        batch_op.add_column(sa.Column('noted_rate', sa.Numeric(18, 8), nullable=True))
        batch_op.create_index(batch_op.f('ix_market_symbols_playlist_id'), ['playlist_id'], unique=False)
        batch_op.create_foreign_key(
            'fk_market_symbols_playlist_id', 'playlists', ['playlist_id'], ['id'], ondelete='SET NULL'
        )

    with op.batch_alter_table('market_trades', schema=None) as batch_op:
        batch_op.add_column(sa.Column('fees', sa.Numeric(12, 2), nullable=False, server_default='0'))

    with op.batch_alter_table('loans', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transaction_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_loans_transaction_id', 'transactions', ['transaction_id'], ['id'], ondelete='SET NULL'
        )

    with op.batch_alter_table('shopping_items', schema=None) as batch_op:
        batch_op.add_column(sa.Column('transaction_id', sa.Integer(), nullable=True))
        batch_op.create_foreign_key(
            'fk_shopping_items_transaction_id', 'transactions', ['transaction_id'], ['id'], ondelete='SET NULL'
        )


def downgrade():
    with op.batch_alter_table('shopping_items', schema=None) as batch_op:
        batch_op.drop_constraint('fk_shopping_items_transaction_id', type_='foreignkey')
        batch_op.drop_column('transaction_id')

    with op.batch_alter_table('loans', schema=None) as batch_op:
        batch_op.drop_constraint('fk_loans_transaction_id', type_='foreignkey')
        batch_op.drop_column('transaction_id')

    with op.batch_alter_table('market_trades', schema=None) as batch_op:
        batch_op.drop_column('fees')

    with op.batch_alter_table('market_symbols', schema=None) as batch_op:
        batch_op.drop_constraint('fk_market_symbols_playlist_id', type_='foreignkey')
        batch_op.drop_index(batch_op.f('ix_market_symbols_playlist_id'))
        batch_op.drop_column('noted_rate')
        batch_op.drop_column('noted_price')
        batch_op.drop_column('follows_market')
        batch_op.drop_column('playlist_id')

    with op.batch_alter_table('playlists', schema=None) as batch_op:
        batch_op.drop_column('noted_rate')
        batch_op.drop_column('follows_market')

    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_column('settings')
