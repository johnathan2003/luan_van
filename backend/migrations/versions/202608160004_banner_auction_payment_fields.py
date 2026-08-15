"""banner_auctions: thêm mua đứt (endPrice) + cọc 20/80 + hạn duyệt nội dung

Đưa banner_auctions lên ngang cơ chế slot_auctions (nhưng vẫn giữ reserve/
release lúc bid — khác slot):
  - end_price          BẮT BUỘC (mọi phiên banner đều có mua đứt).
  - win_type            'buyout' | 'bid'
  - deposit_amount / deposit_charged_at / payment_deadline / final_paid_at
    — cọc 20% (bid) hoặc 100% (buyout) trừ thật, khác reserve.
  - submission_attempts — giới hạn 10 lần nộp nội dung, chỉ áp dụng buyout
    (khác slot chỉ giới hạn 3 lần).
  - review_deadline     — hạn 6h duyệt nội dung.
  - activates_at        — mốc 0:00 mới thật sự promote vào bảng "banners"
    (trước đây duyệt xong lên ngay lập tức).

Revision ID: 202608160004
Revises: 202608160003
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608160004'
down_revision = '202608160003'
branch_labels = None
depends_on = None

_TABLE = 'banner_auctions'


def _column_exists(conn, table, column) -> bool:
    return conn.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :t AND column_name = :c
    """), {"t": table, "c": column}).first() is not None


def upgrade() -> None:
    conn = op.get_bind()

    def add(col_name, col_def):
        if not _column_exists(conn, _TABLE, col_name):
            op.add_column(_TABLE, col_def)

    add('end_price', sa.Column('end_price', sa.Numeric(15, 2), nullable=False, server_default='0'))
    add('win_type', sa.Column('win_type', sa.String(20), nullable=True))
    add('deposit_amount', sa.Column('deposit_amount', sa.Numeric(15, 2), nullable=True))
    add('deposit_charged_at', sa.Column('deposit_charged_at', sa.DateTime(), nullable=True))
    add('payment_deadline', sa.Column('payment_deadline', sa.DateTime(), nullable=True))
    add('final_paid_at', sa.Column('final_paid_at', sa.DateTime(), nullable=True))
    add('submission_attempts', sa.Column('submission_attempts', sa.Integer(), nullable=False, server_default='0'))
    add('review_deadline', sa.Column('review_deadline', sa.DateTime(), nullable=True))
    add('activates_at', sa.Column('activates_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    for col in (
        'activates_at', 'review_deadline', 'submission_attempts',
        'final_paid_at', 'payment_deadline', 'deposit_charged_at',
        'deposit_amount', 'win_type', 'end_price',
    ):
        op.drop_column(_TABLE, col)
