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
    # NOTE: 'phone' column is already added by 202608020001_add_price_images_to_shop_registration.
    # This migration became a duplicate after merging branches; kept as a no-op so the
    # revision id stays valid for migrations that depend on it (202608030005, 202608030006).
    pass


def downgrade() -> None:
    pass
