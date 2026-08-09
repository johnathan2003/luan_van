"""add zalopay_app_trans_id/zalopay_response to payments

Thêm ZaloPay làm cổng thanh toán thứ 3 (giống Momo/VNPay) — cần 2 cột riêng
để lưu app_trans_id (mã tra cứu giao dịch ZaloPay dùng khi callback) và raw
response JSON, tương tự momo_request_id/momo_response, vnpay_txn_ref/vnpay_response
đã có sẵn.

Revision ID: 202608080001
Revises: 202608040001
Create Date: 2026-08-08

"""
from alembic import op
import sqlalchemy as sa

revision = '202608080001'
down_revision = '202608040001'
branch_labels = None
depends_on = None


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.first() is not None


def upgrade() -> None:
    if not _column_exists("payments", "zalopay_app_trans_id"):
        op.add_column("payments", sa.Column("zalopay_app_trans_id", sa.String(64), nullable=True))
    if not _column_exists("payments", "zalopay_response"):
        op.add_column("payments", sa.Column("zalopay_response", sa.JSON(), nullable=True))


def downgrade() -> None:
    if _column_exists("payments", "zalopay_response"):
        op.drop_column("payments", "zalopay_response")
    if _column_exists("payments", "zalopay_app_trans_id"):
        op.drop_column("payments", "zalopay_app_trans_id")
