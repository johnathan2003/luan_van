"""create media_assets table (đăng ký tập trung mọi ảnh upload)

Trước đây mỗi tính năng (product/banner/shop/user) tự upload file ra
uploads/<subfolder>/ mà không có sổ đăng ký chung nào — không ai (kể cả
super) có cái nhìn tổng thể mọi ảnh đang tồn tại trong hệ thống.

Từ giờ save_upload_file() ghi thêm 1 dòng vào media_assets mỗi lần upload
thành công (mọi subfolder: products/banners/shops/users/...), mỗi ảnh có
1 "code" riêng. Super đọc bảng này để thấy TOÀN BỘ ảnh trong hệ thống.

Revision ID: 202608140003
Revises: 202608140002
Create Date: 2026-08-14

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608140003'
down_revision = '202608140002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    exists = conn.execute(text("""
        SELECT 1 FROM information_schema.tables WHERE table_name = 'media_assets'
    """)).first()
    if not exists:
        op.create_table(
            'media_assets',
            sa.Column('media_id', sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column('code', sa.String(40), nullable=False, unique=True),
            sa.Column('url', sa.String(500), nullable=False),
            sa.Column('subfolder', sa.String(50), nullable=False),
            sa.Column('original_filename', sa.String(255), nullable=True),
            sa.Column('content_type', sa.String(100), nullable=True),
            sa.Column('size_bytes', sa.Integer(), nullable=True),
            sa.Column('uploaded_by', sa.Integer(), sa.ForeignKey('users.user_id'), nullable=True),
            sa.Column('created_at', sa.DateTime(), server_default=sa.func.now()),
        )
        op.create_index('idx_media_code', 'media_assets', ['code'], unique=True)
        op.create_index('idx_media_subfolder_created', 'media_assets', ['subfolder', 'created_at'])


def downgrade() -> None:
    op.drop_table('media_assets')
