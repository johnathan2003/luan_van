"""merge heads: shipping_size_tiers + add_voucher_type_shop_id

Revision ID: 202607300001
Revises: 202607220002, 202507230001
Create Date: 2026-07-30

Giải quyết lỗi "Multiple head revisions" — gộp 2 nhánh:
  - 202607220002  (shipping_size_tiers_revenue_config)
  - 202507230001  (add_voucher_type_shop_id)
"""
from alembic import op
import sqlalchemy as sa

revision = '202607300001'
down_revision = ('202607220002', '202507230001')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
