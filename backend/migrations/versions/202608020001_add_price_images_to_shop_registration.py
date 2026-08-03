"""add price_min, price_max, product_image_urls to shop_registrations

Revision ID: 202608020001
Revises: 202607300001
Create Date: 2026-08-02

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '202608020001'
down_revision = '202607300001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('shop_registrations', sa.Column('phone', sa.String(20), nullable=True))
    op.add_column('shop_registrations', sa.Column('price_min', sa.Float(), nullable=True))
    op.add_column('shop_registrations', sa.Column('price_max', sa.Float(), nullable=True))
    op.add_column('shop_registrations', sa.Column('product_image_urls', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('shop_registrations', 'product_image_urls')
    op.drop_column('shop_registrations', 'price_max')
    op.drop_column('shop_registrations', 'price_min')
    op.drop_column('shop_registrations', 'phone')
