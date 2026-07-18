from app.database import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("ALTER TABLE shops ADD COLUMN IF NOT EXISTS is_mall BOOLEAN NOT NULL DEFAULT false"))
    conn.execute(text("ALTER TABLE shops ADD COLUMN IF NOT EXISTS mall_request_status VARCHAR(20) DEFAULT 'none'"))
    conn.execute(text("ALTER TABLE shops ADD COLUMN IF NOT EXISTS mall_requested_at TIMESTAMP"))
    conn.commit()

print("Done - mall columns added successfully")
