"""Warehouse 3-tier: thêm city, ward_code, warehouse_shippers, 3 roles mới, seed HN+HCM

Revision ID: 202507210001
Revises: 202607160001, 202607200001
Create Date: 2026-07-21
"""
from alembic import op
import sqlalchemy as sa

revision = '202507210001'
down_revision = ('202607160001', '202607200001')
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── 1. Thêm cột city, ward_code vào warehouses ───────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE warehouses
            ADD COLUMN IF NOT EXISTS city      VARCHAR(50),
            ADD COLUMN IF NOT EXISTS ward_code VARCHAR(20);
    """))

    # Cập nhật cột tier: đổi tên cho dễ đọc (tier 1=city hub, 2=district, 3=ward)
    # tier đã tồn tại từ migration trước (default 3), không cần ALTER thêm

    # ── 2. Bảng warehouse_shippers (gắn shipper vào kho cấp 3) ──────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS warehouse_shippers (
            id               SERIAL PRIMARY KEY,
            warehouse_id     INTEGER NOT NULL REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
            shipper_id       INTEGER NOT NULL REFERENCES shippers(shipper_id) ON DELETE CASCADE,
            assigned_by      INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            assigned_at      TIMESTAMP DEFAULT NOW(),
            status           VARCHAR(20) DEFAULT 'active',
            UNIQUE (warehouse_id, shipper_id)
        );
    """))

    # ── 3. Thêm 3 role mới cho quản lý kho 3 cấp ────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO roles (role_name, description)
        VALUES
            ('warehouse_hub_manager',      'Quản lý kho cấp 1 — kho tổng thành phố'),
            ('warehouse_district_manager', 'Quản lý kho cấp 2 — kho phân phối quận/huyện'),
            ('warehouse_ward_manager',     'Quản lý kho cấp 3 — kho giao hàng phường/xã')
        ON CONFLICT (role_name) DO NOTHING;
    """))

    # ── 4. Seed kho cấp 1 (2 city hubs) ─────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO warehouses (name, province, address, tier, city, is_active)
        VALUES
            ('Kho Tổng Hà Nội',         'Hà Nội',           'Đông Anh, Hà Nội',         1, 'hanoi', TRUE),
            ('Kho Tổng TP. Hồ Chí Minh','TP. Hồ Chí Minh',  'Bình Chánh, TP. Hồ Chí Minh', 1, 'hcmc', TRUE)
        ON CONFLICT DO NOTHING;
    """))

    # ── 5. Seed kho cấp 2 Hà Nội (30 quận/huyện/thị xã) ─────────────────────
    conn.execute(sa.text("""
        DO $$
        DECLARE
            hub_hn_id INTEGER;
        BEGIN
            SELECT warehouse_id INTO hub_hn_id FROM warehouses WHERE city = 'hanoi' AND tier = 1 LIMIT 1;

            IF hub_hn_id IS NOT NULL THEN
                INSERT INTO warehouses (name, province, district, city, tier, parent_warehouse_id, is_active)
                VALUES
                    ('Kho Ba Đình',      'Hà Nội', 'Ba Đình',      'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Hoàn Kiếm',   'Hà Nội', 'Hoàn Kiếm',   'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Tây Hồ',      'Hà Nội', 'Tây Hồ',      'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Long Biên',   'Hà Nội', 'Long Biên',   'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Cầu Giấy',    'Hà Nội', 'Cầu Giấy',    'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Đống Đa',     'Hà Nội', 'Đống Đa',     'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Hai Bà Trưng','Hà Nội', 'Hai Bà Trưng','hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Hoàng Mai',   'Hà Nội', 'Hoàng Mai',   'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Thanh Xuân',  'Hà Nội', 'Thanh Xuân',  'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Nam Từ Liêm', 'Hà Nội', 'Nam Từ Liêm', 'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Bắc Từ Liêm', 'Hà Nội', 'Bắc Từ Liêm','hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Hà Đông',     'Hà Nội', 'Hà Đông',     'hanoi', 2, hub_hn_id, TRUE),
                    ('Kho Sơn Tây',     'Hà Nội', 'Sơn Tây',     'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Ba Vì',       'Hà Nội', 'Ba Vì',       'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Chương Mỹ',   'Hà Nội', 'Chương Mỹ',   'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Đan Phượng',  'Hà Nội', 'Đan Phượng',  'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Đông Anh',    'Hà Nội', 'Đông Anh',    'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Gia Lâm',     'Hà Nội', 'Gia Lâm',     'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Hoài Đức',    'Hà Nội', 'Hoài Đức',    'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Mê Linh',     'Hà Nội', 'Mê Linh',     'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Mỹ Đức',      'Hà Nội', 'Mỹ Đức',      'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Phú Xuyên',   'Hà Nội', 'Phú Xuyên',   'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Phúc Thọ',    'Hà Nội', 'Phúc Thọ',    'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Quốc Oai',    'Hà Nội', 'Quốc Oai',    'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Sóc Sơn',     'Hà Nội', 'Sóc Sơn',     'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Thạch Thất',  'Hà Nội', 'Thạch Thất',  'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Thanh Oai',   'Hà Nội', 'Thanh Oai',   'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Thanh Trì',   'Hà Nội', 'Thanh Trì',   'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Thường Tín',  'Hà Nội', 'Thường Tín',  'hanoi', 2, hub_hn_id, FALSE),
                    ('Kho Ứng Hòa',     'Hà Nội', 'Ứng Hòa',     'hanoi', 2, hub_hn_id, FALSE)
                ON CONFLICT DO NOTHING;
            END IF;
        END $$;
    """))

    # ── 6. Seed kho cấp 2 TP. Hồ Chí Minh (22 quận/huyện/TP) ───────────────
    conn.execute(sa.text("""
        DO $$
        DECLARE
            hub_hcm_id INTEGER;
        BEGIN
            SELECT warehouse_id INTO hub_hcm_id FROM warehouses WHERE city = 'hcmc' AND tier = 1 LIMIT 1;

            IF hub_hcm_id IS NOT NULL THEN
                INSERT INTO warehouses (name, province, district, city, tier, parent_warehouse_id, is_active)
                VALUES
                    ('Kho Quận 1',       'TP. Hồ Chí Minh', 'Quận 1',       'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Quận 3',       'TP. Hồ Chí Minh', 'Quận 3',       'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Quận 4',       'TP. Hồ Chí Minh', 'Quận 4',       'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Quận 5',       'TP. Hồ Chí Minh', 'Quận 5',       'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Quận 6',       'TP. Hồ Chí Minh', 'Quận 6',       'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Quận 7',       'TP. Hồ Chí Minh', 'Quận 7',       'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Quận 8',       'TP. Hồ Chí Minh', 'Quận 8',       'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Quận 10',      'TP. Hồ Chí Minh', 'Quận 10',      'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Quận 11',      'TP. Hồ Chí Minh', 'Quận 11',      'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Quận 12',      'TP. Hồ Chí Minh', 'Quận 12',      'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Bình Thạnh',   'TP. Hồ Chí Minh', 'Bình Thạnh',   'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Gò Vấp',       'TP. Hồ Chí Minh', 'Gò Vấp',       'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Phú Nhuận',    'TP. Hồ Chí Minh', 'Phú Nhuận',    'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Tân Bình',     'TP. Hồ Chí Minh', 'Tân Bình',     'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Tân Phú',      'TP. Hồ Chí Minh', 'Tân Phú',      'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Bình Tân',     'TP. Hồ Chí Minh', 'Bình Tân',     'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho TP. Thủ Đức',  'TP. Hồ Chí Minh', 'TP. Thủ Đức',  'hcmc', 2, hub_hcm_id, TRUE),
                    ('Kho Bình Chánh',   'TP. Hồ Chí Minh', 'Bình Chánh',   'hcmc', 2, hub_hcm_id, FALSE),
                    ('Kho Cần Giờ',      'TP. Hồ Chí Minh', 'Cần Giờ',      'hcmc', 2, hub_hcm_id, FALSE),
                    ('Kho Củ Chi',       'TP. Hồ Chí Minh', 'Củ Chi',       'hcmc', 2, hub_hcm_id, FALSE),
                    ('Kho Hóc Môn',      'TP. Hồ Chí Minh', 'Hóc Môn',      'hcmc', 2, hub_hcm_id, FALSE),
                    ('Kho Nhà Bè',       'TP. Hồ Chí Minh', 'Nhà Bè',       'hcmc', 2, hub_hcm_id, FALSE)
                ON CONFLICT DO NOTHING;
            END IF;
        END $$;
    """))


def downgrade():
    conn = op.get_bind()

    # Xóa seed data cấp 2
    conn.execute(sa.text("DELETE FROM warehouses WHERE tier IN (1,2) AND city IN ('hanoi','hcmc')"))

    # Xóa roles mới
    conn.execute(sa.text("""
        DELETE FROM roles WHERE role_name IN (
            'warehouse_hub_manager',
            'warehouse_district_manager',
            'warehouse_ward_manager'
        )
    """))

    # Xóa bảng warehouse_shippers
    conn.execute(sa.text("DROP TABLE IF EXISTS warehouse_shippers"))

    # Xóa cột mới
    conn.execute(sa.text("ALTER TABLE warehouses DROP COLUMN IF EXISTS ward_code"))
    conn.execute(sa.text("ALTER TABLE warehouses DROP COLUMN IF EXISTS city"))
