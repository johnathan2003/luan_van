"""merge heads: shop status/suspend branch + demo shop/product seed branch

Revision ID: 202608030006
Revises: 202608030005, 202608030004
Create Date: 2026-08-03

"""
from alembic import op
import sqlalchemy as sa

revision = '202608030006'
down_revision = ('202608030005', '202608030004')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
