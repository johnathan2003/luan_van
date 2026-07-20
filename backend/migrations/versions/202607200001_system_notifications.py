"""System notifications broadcast table

Revision ID: 202607200001
Revises: 202607160001
Create Date: 2026-07-20
"""
from alembic import op
import sqlalchemy as sa

revision = '202607200001'
down_revision = '202607160001'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS system_notifications (
            id          SERIAL PRIMARY KEY,
            title       VARCHAR(255) NOT NULL,
            content     TEXT NOT NULL,
            type        VARCHAR(50)  NOT NULL DEFAULT 'info',
            audience    VARCHAR(50)  NOT NULL DEFAULT 'all',
            send_at     TIMESTAMP,
            sent        BOOLEAN NOT NULL DEFAULT FALSE,
            created_by  INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            created_at  TIMESTAMP DEFAULT NOW(),
            updated_at  TIMESTAMP DEFAULT NOW()
        );
    """))


def downgrade():
    op.execute("DROP TABLE IF EXISTS system_notifications;")
