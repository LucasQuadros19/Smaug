"""mercado sempre varia

Revision ID: f2b6d8a4c391
Revises: e7a3c9d1b852
Create Date: 2026-10-12 14:00:00.000000

Sai a escolha de "valor anotado": o Mercado entra sempre no patrimônio, pela
cotação de agora, por uma posição "Mercado" criada sozinha, e posição em outra
moeda sempre acompanha o câmbio. Quem já tem códigos ganha a posição agora, e as
compras já pagas por conta passam a ser patrimônio (não gasto).
"""
from alembic import op
import sqlalchemy as sa


revision = 'f2b6d8a4c391'
down_revision = 'e7a3c9d1b852'
branch_labels = None
depends_on = None


def upgrade():
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

    bind = op.get_bind()
    owners = bind.execute(sa.text(
        "SELECT DISTINCT user_id FROM market_symbols WHERE user_id IS NOT NULL AND user_id NOT IN "
        "(SELECT user_id FROM playlists WHERE auto_source = 'market' AND user_id IS NOT NULL)"
    )).scalars().all()
    for owner in owners:
        bind.execute(
            sa.text(
                "INSERT INTO playlists (name, kind, asset_type, icon, color, counts_in_net_worth, opening_value, "
                "currency, auto_source, user_id, created_at) VALUES ('Mercado', 'asset', 'investment', '📈', "
                "'#2a78d6', :yes, 0, 'BRL', 'market', :owner, CURRENT_TIMESTAMP)"
            ),
            {"owner": owner, "yes": True},
        )
    bind.execute(sa.text(
        "UPDATE transactions SET playlist_id = (SELECT MIN(p.id) FROM playlists p "
        "WHERE p.auto_source = 'market' AND p.user_id = transactions.user_id) "
        "WHERE id IN (SELECT transaction_id FROM market_trades WHERE transaction_id IS NOT NULL)"
    ))


def downgrade():
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
