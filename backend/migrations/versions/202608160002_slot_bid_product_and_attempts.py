"""add product_id to slot bids + submission_attempts to slot auctions

Sửa luồng đấu giá slot theo yêu cầu mới:
  - Shop chọn sản phẩm quảng bá NGAY từ lần bid đầu tiên (product_id trên
    flash_slot_bids / top_slot_bids), không còn chọn lại lúc nộp nội dung.
  - Giới hạn tối đa 3 lần nộp nội dung trong hạn 6h — riêng cho win_type=
    'buyout' (mua luôn qua endPrice) — submission_attempts đếm số lần đã nộp.

Revision ID: 202608160002
Revises: 202608160001
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608160002'
down_revision = '202608160001'
branch_labels = None
depends_on = None


def _column_exists(conn, table, column) -> bool:
    return conn.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :t AND column_name = :c
    """), {"t": table, "c": column}).first() is not None


def upgrade() -> None:
    conn = op.get_bind()

    for prefix in ('flash', 'top'):
        bids_tbl = f'{prefix}_slot_bids'
        auctions_tbl = f'{prefix}_slot_auctions'

        if not _column_exists(conn, bids_tbl, 'product_id'):
            op.add_column(bids_tbl, sa.Column(
                'product_id', sa.Integer(),
                sa.ForeignKey('products.product_id', ondelete='SET NULL'),
                nullable=True,
            ))
            op.create_index(f'idx_{bids_tbl}_product', bids_tbl, ['product_id'])

        if not _column_exists(conn, auctions_tbl, 'submission_attempts'):
            op.add_column(auctions_tbl, sa.Column(
                'submission_attempts', sa.Integer(), nullable=False, server_default='0',
            ))


def downgrade() -> None:
    for prefix in ('flash', 'top'):
        bids_tbl = f'{prefix}_slot_bids'
        auctions_tbl = f'{prefix}_slot_auctions'
        op.drop_column(auctions_tbl, 'submission_attempts')
        op.drop_index(f'idx_{bids_tbl}_product', table_name=bids_tbl)
        op.drop_column(bids_tbl, 'product_id')
