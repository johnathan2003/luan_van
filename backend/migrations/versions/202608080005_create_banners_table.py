"""create official 'banners' table + backfill approved banner_auctions

Trước đây get_live_banners() đọc TRỰC TIẾP từ banner_auctions (banner_status
='approved') — không có bảng "chính thức" riêng để admin quản lý thủ công
(sửa/xoá/thêm banner không qua đấu giá). Bảng mới "banners" là nguồn dữ liệu
DUY NHẤT cho get_live_banners() từ giờ, admin có toàn quyền CRUD trên đây.

Backfill: banner nào đã approved trước migration này -> tạo 1 row banners
tương ứng (status='active') để không bị "biến mất" khỏi trang chủ.

Revision ID: 202608080005
Revises: 202608080004
Create Date: 2026-08-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608080005'
down_revision = '202608080004'
branch_labels = None
depends_on = None


def _column_exists(conn, table, column) -> bool:
    return conn.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :t AND column_name = :c
    """), {"t": table, "c": column}).first() is not None


def _constraint_exists(conn, name) -> bool:
    return conn.execute(text("""
        SELECT 1 FROM pg_constraint WHERE conname = :n
    """), {"n": name}).first() is not None


def upgrade() -> None:
    conn = op.get_bind()

    exists = conn.execute(text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'banners'
    """)).first()
    if not exists:
        op.create_table(
            'banners',
            sa.Column('banner_id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('slot_id', sa.Integer(), sa.ForeignKey('banner_slots.slot_id', ondelete='SET NULL'), nullable=True),
            sa.Column('position', sa.String(50), nullable=False),
            sa.Column('image_url', sa.String(500), nullable=False),
            sa.Column('title', sa.String(255), nullable=True),
            sa.Column('link', sa.String(500), nullable=True),
            sa.Column('shop_id', sa.Integer(), sa.ForeignKey('shops.shop_id', ondelete='SET NULL'), nullable=True),
            sa.Column('shop_name', sa.String(200), nullable=True),
            sa.Column('source_auction_id', sa.Integer(), sa.ForeignKey('banner_auctions.auction_id', ondelete='SET NULL'), nullable=True),
            sa.Column('status', sa.String(20), nullable=False, server_default='active'),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
            sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()),
        )
    else:
        # "banners" đã tồn tại từ migration cũ 202606250002 (schema cũ của
        # app.models.admin_config.Banner đã bị xoá — model đó không còn dùng
        # nữa) — vá schema cho khớp app.models.wallet_auction.Banner thay vì
        # giả định bảng trống/đúng cấu trúc.
        if not _column_exists(conn, 'banners', 'slot_id'):
            op.add_column('banners', sa.Column('slot_id', sa.Integer(), nullable=True))
        if not _constraint_exists(conn, 'fk_banners_slot_id'):
            conn.execute(text("""
                ALTER TABLE banners ADD CONSTRAINT fk_banners_slot_id
                FOREIGN KEY (slot_id) REFERENCES banner_slots(slot_id) ON DELETE SET NULL
            """))

        if not _column_exists(conn, 'banners', 'position'):
            op.add_column('banners', sa.Column('position', sa.String(50), nullable=True))

        if not _column_exists(conn, 'banners', 'source_auction_id'):
            op.add_column('banners', sa.Column('source_auction_id', sa.Integer(), nullable=True))
        if not _constraint_exists(conn, 'fk_banners_source_auction_id'):
            conn.execute(text("""
                ALTER TABLE banners ADD CONSTRAINT fk_banners_source_auction_id
                FOREIGN KEY (source_auction_id) REFERENCES banner_auctions(auction_id) ON DELETE SET NULL
            """))

        if not _column_exists(conn, 'banners', 'created_by'):
            op.add_column('banners', sa.Column('created_by', sa.Integer(), nullable=True))
        if not _constraint_exists(conn, 'fk_banners_created_by'):
            conn.execute(text("""
                ALTER TABLE banners ADD CONSTRAINT fk_banners_created_by
                FOREIGN KEY (created_by) REFERENCES users(user_id)
            """))

        # status: cột cũ là enum banner_status ('pending'/'active'/'rejected'),
        # code mới ghi chuỗi tự do ('active'/'inactive') -> đổi sang varchar.
        status_type = conn.execute(text("""
            SELECT data_type FROM information_schema.columns
            WHERE table_name = 'banners' AND column_name = 'status'
        """)).scalar()
        if status_type == 'USER-DEFINED':
            conn.execute(text("ALTER TABLE banners ALTER COLUMN status DROP DEFAULT"))
            conn.execute(text("ALTER TABLE banners ALTER COLUMN status TYPE VARCHAR(20) USING status::text"))
            conn.execute(text("ALTER TABLE banners ALTER COLUMN status SET DEFAULT 'active'"))

        # title NOT NULL ở schema cũ -> model mới cho phép NULL.
        conn.execute(text("ALTER TABLE banners ALTER COLUMN title DROP NOT NULL"))
        # image_url NOT NULL ở model mới, nhưng nới lỏng ở DB để tránh vỡ nếu
        # bảng cũ đang có row NULL — code luôn set giá trị khi insert.
        if _column_exists(conn, 'banners', 'image_url'):
            conn.execute(text("ALTER TABLE banners ALTER COLUMN image_url DROP NOT NULL"))

    # Backfill: banner đã approved trước đây -> banners (status=active), 1 lần
    # duy nhất (idempotent nhờ NOT EXISTS theo source_auction_id).
    conn.execute(text("""
        INSERT INTO banners (slot_id, position, image_url, title, link, shop_id, shop_name, source_auction_id, status, created_at)
        SELECT ba.slot_id, bs.position, ba.banner_image_url, ba.banner_title, ba.banner_link,
               ba.winner_shop_id, s.shop_name, ba.auction_id, 'active', COALESCE(ba.banner_reviewed_at, ba.banner_submitted_at, ba.created_at)
        FROM banner_auctions ba
        JOIN banner_slots bs ON bs.slot_id = ba.slot_id
        LEFT JOIN shops s ON s.shop_id = ba.winner_shop_id
        WHERE ba.banner_status = 'approved'
          AND ba.banner_image_url IS NOT NULL
          AND NOT EXISTS (
              SELECT 1 FROM banners b WHERE b.source_auction_id = ba.auction_id
          )
    """))


def downgrade() -> None:
    # Không tự ý drop "banners" ở đây — bảng này có thể đã tồn tại từ trước
    # migration 202606250002 (schema cũ) và downgrade của migration đó mới là
    # nơi chịu trách nhiệm xoá bảng.
    pass
