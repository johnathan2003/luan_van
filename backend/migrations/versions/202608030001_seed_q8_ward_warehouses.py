"""Seed 5 kho cấp 3 (Phường 1-5) thuộc Kho Quận 8, TP.HCM

Revision ID: 202608030001
Revises: 202607300001
Create Date: 2026-08-03

Hệ thống chưa có kho cấp 3 (ward) nào — cần ví dụ cụ thể để test luồng tạo
tài khoản quản lý Kho phường (Tier 3). Thêm 5 kho cấp 3 thuộc Kho Quận 8
(đã có sẵn từ migration 202507210001), đánh số Phường 1 → Phường 5.
"""
from alembic import op
import sqlalchemy as sa

revision = '202608030001'
down_revision = '202607300001'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    conn.execute(sa.text("""
        DO $$
        DECLARE
            q8_id INTEGER;
        BEGIN
            SELECT warehouse_id INTO q8_id
            FROM warehouses
            WHERE city = 'hcmc' AND tier = 2 AND district = 'Quận 8'
            LIMIT 1;

            IF q8_id IS NOT NULL THEN
                INSERT INTO warehouses (name, province, district, ward, ward_code, city, tier, parent_warehouse_id, is_active)
                VALUES
                    ('Kho Phường 1', 'TP. Hồ Chí Minh', 'Quận 8', 'Phường 1', 'Q8-P1', 'hcmc', 3, q8_id, TRUE),
                    ('Kho Phường 2', 'TP. Hồ Chí Minh', 'Quận 8', 'Phường 2', 'Q8-P2', 'hcmc', 3, q8_id, TRUE),
                    ('Kho Phường 3', 'TP. Hồ Chí Minh', 'Quận 8', 'Phường 3', 'Q8-P3', 'hcmc', 3, q8_id, TRUE),
                    ('Kho Phường 4', 'TP. Hồ Chí Minh', 'Quận 8', 'Phường 4', 'Q8-P4', 'hcmc', 3, q8_id, TRUE),
                    ('Kho Phường 5', 'TP. Hồ Chí Minh', 'Quận 8', 'Phường 5', 'Q8-P5', 'hcmc', 3, q8_id, TRUE)
                ON CONFLICT DO NOTHING;
            END IF;
        END $$;
    """))


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("""
        DELETE FROM warehouses
        WHERE city = 'hcmc' AND tier = 3 AND district = 'Quận 8'
          AND ward IN ('Phường 1', 'Phường 2', 'Phường 3', 'Phường 4', 'Phường 5')
    """))
