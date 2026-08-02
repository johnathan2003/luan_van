"""add phone to shop_registrations

Revision ID: 202608020002
Revises: 202608020001
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa

revision = '202608020002'
down_revision = '202608020001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('shop_registrations', sa.Column('phone', sa.String(20), nullable=True))


def downgrade() -> None:
    op.drop_column('shop_registrations', 'phone')
