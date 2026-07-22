"""Warehouse tiers + shop wallet + banner auction

Revision ID: 202607160001
Revises: 202507150001, 202607070001
Create Date: 2026-07-16
"""
from alembic import op
import sqlalchemy as sa

revision = '202607160001'
down_revision = ('202507150001', '202607070001')
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # ── 1. Mở rộng bảng warehouses ──────────────────────────────────────────
    conn.execute(sa.text("""
        ALTER TABLE warehouses
            ADD COLUMN IF NOT EXISTS tier             SMALLINT    NOT NULL DEFAULT 3,
            ADD COLUMN IF NOT EXISTS district         VARCHAR(100),
            ADD COLUMN IF NOT EXISTS ward             VARCHAR(100),
            ADD COLUMN IF NOT EXISTS parent_warehouse_id INTEGER REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS manager_id       INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
    """))

    # ── 2. Bảng warehouse_transfers ─────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS warehouse_transfers (
            transfer_id          SERIAL PRIMARY KEY,
            from_warehouse_id    INTEGER NOT NULL REFERENCES warehouses(warehouse_id),
            to_warehouse_id      INTEGER NOT NULL REFERENCES warehouses(warehouse_id),
            transfer_type        VARCHAR(50)  NOT NULL DEFAULT 'forward',
            status               VARCHAR(50)  NOT NULL DEFAULT 'pending',
            note                 TEXT,
            created_by           INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            created_at           TIMESTAMP DEFAULT NOW(),
            departed_at          TIMESTAMP,
            arrived_at           TIMESTAMP
        );
    """))

    # ── 3. Bảng transfer_packages ────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS transfer_packages (
            id            SERIAL PRIMARY KEY,
            transfer_id   INTEGER NOT NULL REFERENCES warehouse_transfers(transfer_id) ON DELETE CASCADE,
            shipment_id   INTEGER NOT NULL REFERENCES shipments(shipment_id) ON DELETE CASCADE,
            added_at      TIMESTAMP DEFAULT NOW(),
            UNIQUE(transfer_id, shipment_id)
        );
    """))

    # ── 4. Bảng shop_wallet ──────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS shop_wallet (
            wallet_id    SERIAL PRIMARY KEY,
            shop_id      INTEGER NOT NULL UNIQUE REFERENCES shops(shop_id) ON DELETE CASCADE,
            balance      NUMERIC(15, 2) NOT NULL DEFAULT 0,
            reserved     NUMERIC(15, 2) NOT NULL DEFAULT 0,
            created_at   TIMESTAMP DEFAULT NOW(),
            updated_at   TIMESTAMP DEFAULT NOW()
        );
    """))

    # ── 5. Bảng shop_wallet_transactions ────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS shop_wallet_transactions (
            txn_id       SERIAL PRIMARY KEY,
            wallet_id    INTEGER NOT NULL REFERENCES shop_wallet(wallet_id) ON DELETE CASCADE,
            shop_id      INTEGER NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            amount       NUMERIC(15, 2) NOT NULL,
            txn_type     VARCHAR(30)  NOT NULL,
            ref_type     VARCHAR(50),
            ref_id       INTEGER,
            note         TEXT,
            created_at   TIMESTAMP DEFAULT NOW()
        );
    """))

    # ── 6. Bảng banner_slots ─────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS banner_slots (
            slot_id              SERIAL PRIMARY KEY,
            name                 VARCHAR(200) NOT NULL,
            position             VARCHAR(50)  NOT NULL DEFAULT 'top',
            width                INTEGER,
            height               INTEGER,
            base_price           NUMERIC(15, 2) NOT NULL DEFAULT 0,
            duration_days        INTEGER NOT NULL DEFAULT 7,
            is_active            BOOLEAN DEFAULT TRUE,
            current_auction_id   INTEGER,
            created_at           TIMESTAMP DEFAULT NOW()
        );
    """))

    # ── 7. Bảng banner_auctions ──────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS banner_auctions (
            auction_id       SERIAL PRIMARY KEY,
            slot_id          INTEGER NOT NULL REFERENCES banner_slots(slot_id) ON DELETE CASCADE,
            start_time       TIMESTAMP NOT NULL,
            end_time         TIMESTAMP NOT NULL,
            status           VARCHAR(30) NOT NULL DEFAULT 'upcoming',
            start_price      NUMERIC(15, 2) NOT NULL DEFAULT 0,
            current_price    NUMERIC(15, 2) NOT NULL DEFAULT 0,
            winner_shop_id   INTEGER REFERENCES shops(shop_id) ON DELETE SET NULL,
            winner_bid_id    INTEGER,
            created_at       TIMESTAMP DEFAULT NOW()
        );
    """))

    # ── 8. Bảng banner_bids ──────────────────────────────────────────────────
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS banner_bids (
            bid_id       SERIAL PRIMARY KEY,
            auction_id   INTEGER NOT NULL REFERENCES banner_auctions(auction_id) ON DELETE CASCADE,
            shop_id      INTEGER NOT NULL REFERENCES shops(shop_id) ON DELETE CASCADE,
            amount       NUMERIC(15, 2) NOT NULL,
            status       VARCHAR(30) NOT NULL DEFAULT 'active',
            created_at   TIMESTAMP DEFAULT NOW()
        );
    """))

    # FK ngược: banner_slots.current_auction_id → banner_auctions.auction_id
    conn.execute(sa.text("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_banner_slots_current_auction'
                  AND table_name = 'banner_slots'
            ) THEN
                ALTER TABLE banner_slots
                    ADD CONSTRAINT fk_banner_slots_current_auction
                    FOREIGN KEY (current_auction_id) REFERENCES banner_auctions(auction_id) ON DELETE SET NULL;
            END IF;
        END $$;
    """))

    # FK ngược: banner_auctions.winner_bid_id → banner_bids.bid_id
    conn.execute(sa.text("""
        DO $$ BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE constraint_name = 'fk_banner_auctions_winner_bid'
                  AND table_name = 'banner_auctions'
            ) THEN
                ALTER TABLE banner_auctions
                    ADD CONSTRAINT fk_banner_auctions_winner_bid
                    FOREIGN KEY (winner_bid_id) REFERENCES banner_bids(bid_id) ON DELETE SET NULL;
            END IF;
        END $$;
    """))

    # ── 9. Role warehouse_chief ───────────────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO roles (role_name)
        VALUES ('warehouse_chief')
        ON CONFLICT (role_name) DO NOTHING;
    """))

    # ── 10. Seed banner slots mặc định ───────────────────────────────────────
    conn.execute(sa.text("""
        INSERT INTO banner_slots (name, position, width, height, base_price, duration_days)
        VALUES
            ('Banner chính trang chủ',     'top',      1200, 300, 500000, 7),
            ('Banner phụ trang chủ',       'middle',   800,  200, 300000, 7),
            ('Banner sidebar phải',        'sidebar',  300,  600, 200000, 7),
            ('Banner danh mục sản phẩm',   'category', 1000, 150, 150000, 7)
        ON CONFLICT DO NOTHING;
    """))


def downgrade():
    conn = op.get_bind()

    # Xoá FK ngược trước
    conn.execute(sa.text("ALTER TABLE banner_auctions DROP CONSTRAINT IF EXISTS fk_banner_auctions_winner_bid"))
    conn.execute(sa.text("ALTER TABLE banner_slots DROP CONSTRAINT IF EXISTS fk_banner_slots_current_auction"))

    conn.execute(sa.text("DROP TABLE IF EXISTS banner_bids"))
    conn.execute(sa.text("DROP TABLE IF EXISTS banner_auctions"))
    conn.execute(sa.text("DROP TABLE IF EXISTS banner_slots"))
    conn.execute(sa.text("DROP TABLE IF EXISTS shop_wallet_transactions"))
    conn.execute(sa.text("DROP TABLE IF EXISTS shop_wallet"))
    conn.execute(sa.text("DROP TABLE IF EXISTS transfer_packages"))
    conn.execute(sa.text("DROP TABLE IF EXISTS warehouse_transfers"))

    conn.execute(sa.text("ALTER TABLE warehouses DROP COLUMN IF EXISTS manager_id"))
    conn.execute(sa.text("ALTER TABLE warehouses DROP COLUMN IF EXISTS parent_warehouse_id"))
    conn.execute(sa.text("ALTER TABLE warehouses DROP COLUMN IF EXISTS ward"))
    conn.execute(sa.text("ALTER TABLE warehouses DROP COLUMN IF EXISTS district"))
    conn.execute(sa.text("ALTER TABLE warehouses DROP COLUMN IF EXISTS tier"))

    conn.execute(sa.text("DELETE FROM roles WHERE role_name = 'warehouse_chief'"))
