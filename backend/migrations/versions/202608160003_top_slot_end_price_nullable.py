"""top slot: bỏ mua đứt (endPrice) — chỉ còn đấu giá thường

Theo yêu cầu mới: 2 loại vị trí sản phẩm khác nhau —
  - Flash Sale (nhiều vị trí)   -> CÓ cơ chế mua đứt (endPrice), giữ nguyên.
  - Top sản phẩm (trong trang)  -> CHỈ đấu giá thường (không mua đứt), thắng
    thì cọc 20% + tất toán 80% sau 30 phút, y hệt luồng bid hiện có.

end_price trên top_slot_auctions chuyển NOT NULL -> NULLABLE. Từ giờ admin
mở phiên Top sẽ không cần (và không nên) nhập endPrice — service layer
(place_bid/settle_auction) đã tự bỏ qua nhánh buyout khi end_price is None.

Revision ID: 202608160003
Revises: 202608160002
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa

revision = '202608160003'
down_revision = '202608160002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.alter_column('top_slot_auctions', 'end_price', existing_type=sa.Numeric(15, 2), nullable=True)


def downgrade() -> None:
    op.execute("UPDATE top_slot_auctions SET end_price = 0 WHERE end_price IS NULL")
    op.alter_column('top_slot_auctions', 'end_price', existing_type=sa.Numeric(15, 2), nullable=False)
