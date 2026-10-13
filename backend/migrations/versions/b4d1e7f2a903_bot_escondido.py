"""bot escondido

Revision ID: b4d1e7f2a903
Revises: f2b6d8a4c391
Create Date: 2026-10-13 12:00:00.000000

O Bot (robôs e simulações) está em desenvolvimento: sai da barra lateral de todo
mundo e volta pelas Configurações.
"""
import json

from alembic import op
import sqlalchemy as sa


revision = 'b4d1e7f2a903'
down_revision = 'f2b6d8a4c391'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    for user_id, tabs in bind.execute(sa.text("SELECT id, hidden_tabs FROM users")).all():
        tabs = json.loads(tabs) if isinstance(tabs, str) else (tabs or [])
        if "/bot" not in tabs:
            bind.execute(
                sa.text("UPDATE users SET hidden_tabs = :tabs WHERE id = :id"),
                {"tabs": json.dumps(sorted([*tabs, "/bot"])), "id": user_id},
            )


def downgrade():
    pass
