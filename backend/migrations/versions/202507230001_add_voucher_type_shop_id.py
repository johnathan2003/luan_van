"""Add voucher_type and shop_id to vouchers table

Revision ID: 202507230001
Revises: 202607220001
Create Date: 2026-07-23

Lý do: admin.py và voucher_service.py cần voucher_type để phân biệt
voucher platform vs shop voucher. shop_id để link về shop chủ sở hữu.
"""
from alembic import op
import sqlalchemy as sa

revision = "202507230001"
down_revision = "202607220001"
branch_labels = None
depends_on = None


def upgrade():
    # Thêm voucher_type với default "platform" để không break rows cũ
    op.add_column(
        "vouchers",
        sa.Column(
            "voucher_type",
            sa.String(20),
            nullable=False,
            server_default="platform",
        ),
    )
    # Thêm shop_id (nullable — chỉ có khi voucher_type = "shop")
    op.add_column(
        "vouchers",
        sa.Column(
            "shop_id",
            sa.Integer(),
            sa.ForeignKey("shops.shop_id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("idx_voucher_type", "vouchers", ["voucher_type"])
    op.create_index("idx_voucher_shop", "vouchers", ["shop_id"])


def downgrade():
    op.drop_index("idx_voucher_shop", table_name="vouchers")
    op.drop_index("idx_voucher_type", table_name="vouchers")
    op.drop_column("vouchers", "shop_id")
    op.drop_column("vouchers", "voucher_type")
