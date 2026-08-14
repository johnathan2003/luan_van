"""create flash_sale_picks table (admin ghim sản phẩm cho khu Flash Sale)

Trước đây Flash Sale trang chủ tự động lấy top 12 sản phẩm bán chạy nhất
(GET /products?sort=popular) — không admin nào chỉnh được. Bảng mới cho phép
admin ghim thủ công tối đa 10 sản phẩm cố định lên đầu Flash Sale (quản lý
qua /api/super/flash-sale); nếu chưa ghim gì thì API vẫn fallback về hành
vi tự động cũ.

Revision ID: 202608140002
Revises: 202608140001
Create Date: 2026-08-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608140002'
down_revision = '202608140001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'flash_sale_picks'
    """)).first()
    if not exists:
        op.create_table(
            'flash_sale_picks',
            sa.Column('pick_id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('product_id', sa.Integer(), sa.ForeignKey('products.product_id', ondelete='CASCADE'), nullable=False, unique=True),
            sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
            sa.Column('created_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index('idx_flash_sale_sort', 'flash_sale_picks', ['sort_order'])


def downgrade() -> None:
    op.drop_table('flash_sale_picks')
