"""Add warehouse tables, shipper_type, and extend shipment schema

Revision ID: 202507150001
Revises: 202607040001
Create Date: 2026-07-15
"""
from alembic import op
import sqlalchemy as sa

revision = '202507150001'
down_revision = '202607040001'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── 1. Bảng warehouses ────────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS warehouses (
            warehouse_id   SERIAL PRIMARY KEY,
            name           VARCHAR(200) NOT NULL,
            province       VARCHAR(100) NOT NULL,
            address        VARCHAR(500),
            lat            NUMERIC(10, 6),
            lng            NUMERIC(10, 6),
            is_active      BOOLEAN DEFAULT TRUE,
            created_at     TIMESTAMP DEFAULT NOW()
        );
    """))

    # ── 2. Bảng warehouse_managers ───────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS warehouse_managers (
            manager_id   INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
            warehouse_id INTEGER REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
            created_at   TIMESTAMP DEFAULT NOW()
        );
    """))

    # ── 3. Thêm cột shipper_type vào shippers ────────────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE shippers
            ADD COLUMN IF NOT EXISTS shipper_type      VARCHAR(50) DEFAULT 'free' NOT NULL,
            ADD COLUMN IF NOT EXISTS zone_province     VARCHAR(100),
            ADD COLUMN IF NOT EXISTS home_warehouse_id INTEGER REFERENCES warehouses(warehouse_id);
    """))

    # ── 4. Thêm cột shipper_type vào shipper_registrations ───────────────────
    conn.execute(sa.text("""
        ALTER TABLE shipper_registrations
            ADD COLUMN IF NOT EXISTS shipper_type      VARCHAR(50) DEFAULT 'free',
            ADD COLUMN IF NOT EXISTS zone_province     VARCHAR(100),
            ADD COLUMN IF NOT EXISTS home_warehouse_id INTEGER REFERENCES warehouses(warehouse_id);
    """))

    # ── 5. Thêm cột mới vào shipments ────────────────────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE shipments
            ADD COLUMN IF NOT EXISTS shipment_type     VARCHAR(50) DEFAULT 'local',
            ADD COLUMN IF NOT EXISTS src_warehouse_id  INTEGER REFERENCES warehouses(warehouse_id),
            ADD COLUMN IF NOT EXISTS dest_warehouse_id INTEGER REFERENCES warehouses(warehouse_id);
    """))

    # ── 6. Seed kho mặc định ─────────────────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO warehouses (name, province, address) VALUES
            ('Kho TP.HCM',    'TP. Hồ Chí Minh', '123 Điện Biên Phủ, Q.Bình Thạnh'),
            ('Kho Hà Nội',    'Hà Nội',           '45 Giải Phóng, Hoàng Mai'),
            ('Kho Đà Nẵng',   'Đà Nẵng',          '88 Nguyễn Văn Linh'),
            ('Kho Cần Thơ',   'Cần Thơ',          '10 Nguyễn Trãi, Ninh Kiều'),
            ('Kho Hải Phòng', 'Hải Phòng',        '33 Lạch Tray, Ngô Quyền')
        ON CONFLICT DO NOTHING;
    """))

    # ── 7. Role warehouse_manager ─────────────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO roles (role_name)
        VALUES ('warehouse_manager')
        ON CONFLICT (role_name) DO NOTHING;
    """))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("ALTER TABLE shipments DROP COLUMN IF EXISTS dest_warehouse_id"))
    conn.execute(sa.text("ALTER TABLE shipments DROP COLUMN IF EXISTS src_warehouse_id"))
    conn.execute(sa.text("ALTER TABLE shipments DROP COLUMN IF EXISTS shipment_type"))
    conn.execute(sa.text("ALTER TABLE shipper_registrations DROP COLUMN IF EXISTS home_warehouse_id"))
    conn.execute(sa.text("ALTER TABLE shipper_registrations DROP COLUMN IF EXISTS zone_province"))
    conn.execute(sa.text("ALTER TABLE shipper_registrations DROP COLUMN IF EXISTS shipper_type"))
    conn.execute(sa.text("ALTER TABLE shippers DROP COLUMN IF EXISTS home_warehouse_id"))
    conn.execute(sa.text("ALTER TABLE shippers DROP COLUMN IF EXISTS zone_province"))
    conn.execute(sa.text("ALTER TABLE shippers DROP COLUMN IF EXISTS shipper_type"))
    conn.execute(sa.text("DROP TABLE IF EXISTS warehouse_managers"))
    conn.execute(sa.text("DROP TABLE IF EXISTS warehouses"))
