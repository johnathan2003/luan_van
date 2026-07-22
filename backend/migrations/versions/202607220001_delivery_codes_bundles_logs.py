"""delivery_codes_bundles_logs

Revision ID: 202607220001
Revises: 202507210001
Create Date: 2026-07-22

Thêm:
  - shipments.delivery_code       VARCHAR(30) UNIQUE  — mã SD-YYYYMMDD-xxxxxx
  - shipments.current_warehouse_id FK warehouses
  - bảng shipment_logs            — lịch sử vị trí đơn
  - bảng interprovincial_bundles  — mã LT liên tỉnh
  - bảng bundle_shipments         — đơn SD trong bundle LT
"""
from alembic import op
import sqlalchemy as sa

revision = '202607220001'
down_revision = ('202507210001', '202607200001')
branch_labels = None
depends_on = None


def upgrade():
    # ── 1. Cột mới trong shipments ──────────────────────────────────────────
    op.execute("""
        ALTER TABLE shipments
            ADD COLUMN IF NOT EXISTS delivery_code       VARCHAR(30) UNIQUE,
            ADD COLUMN IF NOT EXISTS current_warehouse_id INTEGER
                REFERENCES warehouses(warehouse_id) ON DELETE SET NULL;
    """)

    # ── 2. Bảng lịch sử vị trí đơn ─────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS shipment_logs (
            log_id          SERIAL PRIMARY KEY,
            shipment_id     INTEGER NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
            warehouse_id    INTEGER REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
            status          VARCHAR(50) NOT NULL,
            note            VARCHAR(300),
            created_by      INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            created_at      TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_shipment_log_shipment ON shipment_logs(shipment_id);
        CREATE INDEX IF NOT EXISTS idx_shipment_log_created  ON shipment_logs(created_at);
    """)

    # ── 3. Bảng bundle liên tỉnh ────────────────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS interprovincial_bundles (
            bundle_id           SERIAL PRIMARY KEY,
            bundle_code         VARCHAR(40) NOT NULL UNIQUE,
            src_hub_id          INTEGER NOT NULL REFERENCES warehouses(warehouse_id),
            dest_hub_id         INTEGER NOT NULL REFERENCES warehouses(warehouse_id),
            -- pending → sealed → in_transit → arrived → distributed
            status              VARCHAR(30) NOT NULL DEFAULT 'pending',
            total_shipments     INTEGER DEFAULT 0,
            total_cod           NUMERIC(14,2) DEFAULT 0,
            created_by          INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            sealed_by           INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            sealed_at           TIMESTAMP,
            arrived_confirmed_by INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            arrived_at          TIMESTAMP,
            created_at          TIMESTAMP DEFAULT NOW(),
            updated_at          TIMESTAMP DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_bundle_status ON interprovincial_bundles(status);
        CREATE INDEX IF NOT EXISTS idx_bundle_src    ON interprovincial_bundles(src_hub_id);
        CREATE INDEX IF NOT EXISTS idx_bundle_dest   ON interprovincial_bundles(dest_hub_id);
    """)

    # ── 4. Bảng liên kết bundle ↔ shipment ─────────────────────────────────
    op.execute("""
        CREATE TABLE IF NOT EXISTS bundle_shipments (
            id          SERIAL PRIMARY KEY,
            bundle_id   INTEGER NOT NULL REFERENCES interprovincial_bundles(bundle_id) ON DELETE CASCADE,
            shipment_id INTEGER NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
            added_at    TIMESTAMP DEFAULT NOW(),
            UNIQUE (bundle_id, shipment_id)
        );
        CREATE INDEX IF NOT EXISTS idx_bundle_shipments_bundle   ON bundle_shipments(bundle_id);
        CREATE INDEX IF NOT EXISTS idx_bundle_shipments_shipment ON bundle_shipments(shipment_id);
    """)


def downgrade():
    op.execute("DROP TABLE IF EXISTS bundle_shipments CASCADE;")
    op.execute("DROP TABLE IF EXISTS interprovincial_bundles CASCADE;")
    op.execute("DROP TABLE IF EXISTS shipment_logs CASCADE;")
    op.execute("""
        ALTER TABLE shipments
            DROP COLUMN IF EXISTS delivery_code,
            DROP COLUMN IF EXISTS current_warehouse_id;
    """)
