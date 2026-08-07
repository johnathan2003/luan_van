"""add status and suspended_reason to shops

Revision ID: 202608030005
Revises: 202608020002
Create Date: 2026-08-03

"""
from alembic import op
import sqlalchemy as sa

revision = '202608030005'
down_revision = '202608020002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Tạo enum type an toàn — bỏ qua nếu đã tồn tại (idempotent)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE shop_status_enum AS ENUM ('active', 'suspended', 'banned');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)

    conn = op.get_bind()
    existing = {row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='shops'")
    )}

    if 'status' not in existing:
        op.add_column('shops', sa.Column(
            'status',
            sa.Enum('active', 'suspended', 'banned', name='shop_status_enum', create_type=False),
            nullable=False,
            server_default='active',
        ))
    if 'suspended_reason' not in existing:
        op.add_column('shops', sa.Column('suspended_reason', sa.Text(), nullable=True))
    if 'suspended_at' not in existing:
        op.add_column('shops', sa.Column('suspended_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('shops', 'suspended_at')
    op.drop_column('shops', 'suspended_reason')
    op.drop_column('shops', 'status')
    op.execute("DROP TYPE IF EXISTS shop_status_enum")
