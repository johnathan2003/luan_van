"""thêm auction_fund cho shop_wallet — nhãn tự đánh dấu "tiền đấu giá"

Trước đây tab "Tiền đấu giá" trên WalletPage chỉ là mock localStorage,
dùng nhầm khái niệm `reserved` (vốn dùng để escrow tiền khi đang có bid
đang dẫn đầu, tự động tăng/giảm bởi place_bid — không phải quỹ nạp trước).

Cột mới `auction_fund` là một nhãn shop TỰ đánh dấu một phần balance là
"dành cho đấu giá" — thuần tuý hiển thị/ghi chú, KHÔNG trừ vào `available`
và KHÔNG ảnh hưởng logic đặt giá (place_bid vẫn dùng balance - reserved
như cũ). Chuyển tiền vào đây là hành động tức thời, tự shop thực hiện,
không qua admin duyệt.

Revision ID: 202608160006
Revises: 202608160005
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608160006'
down_revision = '202608160005'
branch_labels = None
depends_on = None


def _column_exists(conn, table, column) -> bool:
    return conn.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :t AND column_name = :c
    """), {"t": table, "c": column}).first() is not None


def upgrade() -> None:
    conn = op.get_bind()
    if not _column_exists(conn, 'shop_wallet', 'auction_fund'):
        op.add_column(
            'shop_wallet',
            sa.Column('auction_fund', sa.Numeric(15, 2), nullable=False, server_default='0'),
        )


def downgrade() -> None:
    op.drop_column('shop_wallet', 'auction_fund')
