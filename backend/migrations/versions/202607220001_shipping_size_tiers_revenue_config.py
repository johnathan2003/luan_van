"""Shipping size tiers + revenue config + shipment pkg columns

Revision ID: 202607220002
Revises: 202607220001
Create Date: 2026-07-22
"""
from alembic import op
import sqlalchemy as sa

revision = '202607220002'
down_revision = '202607220001'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── 1. Bảng shipping_size_tiers (5 bậc cố định) ─────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS shipping_size_tiers (
            tier_id        SERIAL PRIMARY KEY,
            tier_level     SMALLINT     NOT NULL UNIQUE,
            label          VARCHAR(50),
            max_length_cm  INTEGER      NOT NULL,
            max_width_cm   INTEGER      NOT NULL,
            max_height_cm  INTEGER      NOT NULL,
            max_weight_kg  NUMERIC(6,2) NOT NULL,
            extra_fee      INTEGER      NOT NULL DEFAULT 0,
            updated_by     INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            updated_at     TIMESTAMP DEFAULT NOW()
        );
    """))

    # Seed 5 bậc mặc định (INSERT hoặc bỏ qua nếu đã có)
    conn.execute(sa.text("""
        INSERT INTO shipping_size_tiers
            (tier_level, label, max_length_cm, max_width_cm, max_height_cm, max_weight_kg, extra_fee)
        VALUES
            (1, 'Siêu nhỏ',    10,  10,  10,  1.0,    0),
            (2, 'Nhỏ',         20,  20,  20,  1.0,  10000),
            (3, 'Vừa',         30,  30,  30,  1.5,  25000),
            (4, 'Lớn',         50,  50,  50,  3.5,  70000),
            (5, 'Cồng kềnh',  100, 100, 100,  5.0, 120000)
        ON CONFLICT (tier_level) DO NOTHING;
    """))

    # ── 2. Bảng revenue_config (lịch sử thay đổi %) ──────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS revenue_config (
            config_id    SERIAL PRIMARY KEY,
            shop_rate    NUMERIC(5,2) NOT NULL DEFAULT 70.00,
            admin_rate   NUMERIC(5,2) NOT NULL DEFAULT 15.00,
            shipper_rate NUMERIC(5,2) NOT NULL DEFAULT 5.00,
            vat_rate     NUMERIC(5,2) NOT NULL DEFAULT 10.00,
            is_active    BOOLEAN DEFAULT TRUE,
            changed_by   INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            changed_at   TIMESTAMP DEFAULT NOW(),
            note         TEXT
        );
    """))

    # Seed row mặc định
    conn.execute(sa.text("""
        INSERT INTO revenue_config (shop_rate, admin_rate, shipper_rate, vat_rate, is_active, note)
        SELECT 70.00, 15.00, 5.00, 10.00, TRUE, 'Cài đặt mặc định ban đầu'
        WHERE NOT EXISTS (SELECT 1 FROM revenue_config);
    """))

    # ── 3. Thêm cột pkg_* + size_tier + extra_fee vào shipments ──────────────
    conn.execute(sa.text("""
        ALTER TABLE shipments
            ADD COLUMN IF NOT EXISTS pkg_length_cm  NUMERIC(6,1),
            ADD COLUMN IF NOT EXISTS pkg_width_cm   NUMERIC(6,1),
            ADD COLUMN IF NOT EXISTS pkg_height_cm  NUMERIC(6,1),
            ADD COLUMN IF NOT EXISTS pkg_weight_kg  NUMERIC(6,2),
            ADD COLUMN IF NOT EXISTS size_tier      SMALLINT,
            ADD COLUMN IF NOT EXISTS extra_fee      INTEGER DEFAULT 0;
    """))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("""
        ALTER TABLE shipments
            DROP COLUMN IF EXISTS pkg_length_cm,
            DROP COLUMN IF EXISTS pkg_width_cm,
            DROP COLUMN IF EXISTS pkg_height_cm,
            DROP COLUMN IF EXISTS pkg_weight_kg,
            DROP COLUMN IF EXISTS size_tier,
            DROP COLUMN IF EXISTS extra_fee;
    """))
    conn.execute(sa.text("DROP TABLE IF EXISTS revenue_config;"))
    conn.execute(sa.text("DROP TABLE IF EXISTS shipping_size_tiers;"))
