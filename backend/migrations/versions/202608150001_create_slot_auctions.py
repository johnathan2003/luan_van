"""create flash_slot / top_slot auction tables + product tags/boost

2 hệ đấu giá "gắn sản phẩm vào vị trí đặc quyền" tách riêng nhau:
  - flash_slots/flash_slot_auctions/flash_slot_bids -> thắng thì lên khu
    Flash Sale trang chủ.
  - top_slots/top_slot_auctions/top_slot_bids -> thắng thì được boost tìm
    kiếm/danh mục/liên quan (qua product_boosts).

Kèm theo:
  - shop_bid_violations: đếm dồn vi phạm (thắng nhưng không trả nốt 80%
    trong 30 phút), dùng chung cho cả flash + top, đủ 3 -> banned.
  - product_tags / product_tag_map: kho tag + gắn tag cho sản phẩm, tự sinh
    khi tạo/sửa sản phẩm (từ category + tên) — dùng chung toàn hệ thống,
    không riêng gì top slot.
  - product_boosts: sản phẩm đang được ưu tiên hiển thị, sinh ra khi 1
    top_slot_auctions chuyển status='live'.

Revision ID: 202608150001
Revises: 202608140003
Create Date: 2026-08-15

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608150001'
down_revision = '202608140003'
branch_labels = None
depends_on = None


def _table_exists(conn, table) -> bool:
    return conn.execute(text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = :t
    """), {"t": table}).first() is not None


def _create_slot_family(prefix: str) -> None:
    """Tạo bộ 3 bảng {prefix}_slots / {prefix}_slot_auctions / {prefix}_slot_bids
    — flash và top dùng chung khuôn này, chỉ khác tên bảng."""
    slots_tbl    = f"{prefix}_slots"
    auctions_tbl = f"{prefix}_slot_auctions"
    bids_tbl     = f"{prefix}_slot_bids"

    op.create_table(
        slots_tbl,
        sa.Column('slot_id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(200), nullable=False),
        sa.Column('base_price', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('is_active', sa.Boolean(), server_default='true'),
        sa.Column('image_width', sa.Integer(), nullable=True),
        sa.Column('image_height', sa.Integer(), nullable=True),
        sa.Column('image_format', sa.String(100), nullable=True),
        sa.Column('content_rules', sa.Text(), nullable=True),
        sa.Column('current_auction_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        auctions_tbl,
        sa.Column('auction_id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('slot_id', sa.Integer(), sa.ForeignKey(f'{slots_tbl}.slot_id', ondelete='CASCADE'), nullable=False),
        sa.Column('announced_at', sa.DateTime(), server_default=sa.func.now()),
        sa.Column('start_time', sa.DateTime(), nullable=False),
        sa.Column('end_time', sa.DateTime(), nullable=False),
        sa.Column('image_width', sa.Integer(), nullable=True),
        sa.Column('image_height', sa.Integer(), nullable=True),
        sa.Column('image_format', sa.String(100), nullable=True),
        sa.Column('content_rules', sa.Text(), nullable=True),
        sa.Column('start_price', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('current_price', sa.Numeric(15, 2), nullable=False, server_default='0'),
        sa.Column('end_price', sa.Numeric(15, 2), nullable=False),
        sa.Column('end_price_hits', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('status', sa.String(20), nullable=False, server_default='upcoming'),
        sa.Column('winner_shop_id', sa.Integer(), sa.ForeignKey('shops.shop_id', ondelete='SET NULL'), nullable=True),
        sa.Column('winner_bid_id', sa.Integer(), nullable=True),
        sa.Column('winner_product_id', sa.Integer(), sa.ForeignKey('products.product_id', ondelete='SET NULL'), nullable=True),
        sa.Column('win_type', sa.String(20), nullable=True),
        sa.Column('deposit_amount', sa.Numeric(15, 2), nullable=True),
        sa.Column('deposit_charged_at', sa.DateTime(), nullable=True),
        sa.Column('payment_deadline', sa.DateTime(), nullable=True),
        sa.Column('final_paid_at', sa.DateTime(), nullable=True),
        sa.Column('display_duration_days', sa.Integer(), nullable=False, server_default='2'),
        sa.Column('display_until', sa.DateTime(), nullable=True),
        sa.Column('submission_image_url', sa.String(500), nullable=True),
        sa.Column('submission_title', sa.String(255), nullable=True),
        sa.Column('submission_link', sa.String(500), nullable=True),
        sa.Column('submission_status', sa.String(20), nullable=True),
        sa.Column('submitted_at', sa.DateTime(), nullable=True),
        sa.Column('review_deadline', sa.DateTime(), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('reject_reason', sa.Text(), nullable=True),
        sa.Column('activates_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index(f'idx_{auctions_tbl}_slot', auctions_tbl, ['slot_id'])
    op.create_index(f'idx_{auctions_tbl}_status', auctions_tbl, ['status'])

    op.create_table(
        bids_tbl,
        sa.Column('bid_id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('auction_id', sa.Integer(), sa.ForeignKey(f'{auctions_tbl}.auction_id', ondelete='CASCADE'), nullable=False),
        sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.shop_id', ondelete='CASCADE'), nullable=False),
        sa.Column('amount', sa.Numeric(15, 2), nullable=False),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index(f'idx_{bids_tbl}_auction', bids_tbl, ['auction_id'])
    op.create_index(f'idx_{bids_tbl}_shop', bids_tbl, ['shop_id'])

    # FK ngược slots.current_auction_id -> auctions.auction_id (thêm sau vì
    # 2 bảng tham chiếu vòng nhau)
    op.create_foreign_key(
        f'fk_{slots_tbl}_current_auction', slots_tbl, auctions_tbl,
        ['current_auction_id'], ['auction_id'], ondelete='SET NULL',
    )
    # FK ngược auctions.winner_bid_id -> bids.bid_id
    op.create_foreign_key(
        f'fk_{auctions_tbl}_winner_bid', auctions_tbl, bids_tbl,
        ['winner_bid_id'], ['bid_id'], ondelete='SET NULL',
    )


def upgrade() -> None:
    conn = op.get_bind()

    if not _table_exists(conn, 'flash_slots'):
        _create_slot_family('flash')

    if not _table_exists(conn, 'top_slots'):
        _create_slot_family('top')

    if not _table_exists(conn, 'shop_bid_violations'):
        op.create_table(
            'shop_bid_violations',
            sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.shop_id', ondelete='CASCADE'), primary_key=True),
            sa.Column('violation_count', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('banned', sa.Boolean(), nullable=False, server_default='false'),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        )

    if not _table_exists(conn, 'product_tags'):
        op.create_table(
            'product_tags',
            sa.Column('tag_id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('tag_name', sa.String(100), nullable=False, unique=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index('idx_product_tags_name', 'product_tags', ['tag_name'], unique=True)

    if not _table_exists(conn, 'product_tag_map'):
        op.create_table(
            'product_tag_map',
            sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.product_id', ondelete='CASCADE'), nullable=False),
            sa.Column('tag_id', sa.Integer(), sa.ForeignKey('product_tags.tag_id', ondelete='CASCADE'), nullable=False),
            sa.UniqueConstraint('product_id', 'tag_id', name='uq_product_tag'),
        )
        op.create_index('idx_product_tag_map_product', 'product_tag_map', ['product_id'])
        op.create_index('idx_product_tag_map_tag', 'product_tag_map', ['tag_id'])

    if not _table_exists(conn, 'product_boosts'):
        op.create_table(
            'product_boosts',
            sa.Column('boost_id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.product_id', ondelete='CASCADE'), nullable=False),
            sa.Column('source_auction_id', sa.Integer(), sa.ForeignKey('top_slot_auctions.auction_id', ondelete='SET NULL'), nullable=True),
            sa.Column('expires_at', sa.DateTime(), nullable=False),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index('idx_product_boosts_product', 'product_boosts', ['product_id'])
        op.create_index('idx_product_boosts_expires', 'product_boosts', ['expires_at'])


def downgrade() -> None:
    op.drop_table('product_boosts')
    op.drop_table('product_tag_map')
    op.drop_table('product_tags')
    op.drop_table('shop_bid_violations')
    for prefix in ('top', 'flash'):
        op.drop_constraint(f'fk_{prefix}_slots_current_auction', f'{prefix}_slots', type_='foreignkey')
        op.drop_constraint(f'fk_{prefix}_slot_auctions_winner_bid', f'{prefix}_slot_auctions', type_='foreignkey')
        op.drop_table(f'{prefix}_slot_bids')
        op.drop_table(f'{prefix}_slot_auctions')
        op.drop_table(f'{prefix}_slots')
