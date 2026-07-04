"""merge mall and shipper branches into single linear chain

Revision ID: 202607040001
Revises: 202406240002, 202606250002
Create Date: 2026-07-04
"""
from alembic import op
import sqlalchemy as sa

revision = '202607040001'
# Merge 2 nhánh: mall branch (202406240002) + shipper branch (202606250002)
down_revision = ('202406240002', '202606250002')
branch_labels = None
depends_on = None


def upgrade():
    """Chỉ dùng để gộp 2 nhánh — không có thay đổi schema."""
    # Đảm bảo 3 cột mall tồn tại (idempotent safety net)
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
            'mall_request_status', sa.String(20), nullable=True, server_default='none'
        ))

    if 'mall_requested_at' not in existing:
        op.add_column('shops', sa.Column(
            'mall_requested_at', sa.DateTime(), nullable=True
        ))


def downgrade():
    pass
