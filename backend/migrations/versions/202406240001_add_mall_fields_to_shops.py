"""add mall fields to shops

Revision ID: 202406240001
Revises: 202606230001
Create Date: 2024-06-24 00:00:01
"""
from alembic import op
import sqlalchemy as sa

revision = '202406240001'
down_revision = '202606230001'
branch_labels = None
depends_on = None


def upgrade():
    # Tạo enum type an toàn — bỏ qua nếu đã tồn tại (idempotent)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE mall_request_status_enum
                AS ENUM ('none', 'pending', 'approved', 'rejected');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
    """)

    # Thêm từng column — bỏ qua nếu đã tồn tại
    conn = op.get_bind()
    existing = {row[0] for row in conn.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name='shops'")
    )}

    if 'is_mall' not in existing:
        op.add_column('shops', sa.Column(
            'is_mall', sa.Boolean(), nullable=False, server_default='false'
        ))

    if 'mall_request_status' not in existing:
        op.add_column('shops', sa.Column(
            'mall_request_status',
            sa.Enum('none', 'pending', 'approved', 'rejected',
                    name='mall_request_status_enum', create_type=False),
            nullable=True,
            server_default='none',
        ))

    if 'mall_requested_at' not in existing:
        op.add_column('shops', sa.Column(
            'mall_requested_at', sa.DateTime(), nullable=True
        ))


def downgrade():
    op.drop_column('shops', 'mall_requested_at')
    op.drop_column('shops', 'mall_request_status')
    op.drop_column('shops', 'is_mall')
    op.execute("DROP TYPE IF EXISTS mall_request_status_enum")
