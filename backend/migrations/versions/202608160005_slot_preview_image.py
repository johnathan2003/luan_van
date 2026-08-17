"""thêm preview_image_url cho banner_slots / flash_slots / top_slots

Admin upload/thay 1 ảnh minh hoạ vị trí cho mỗi slot, để shop biết banner/
sản phẩm thắng đấu giá sẽ thật sự lên chỗ nào trên trang (khác với ảnh nội
dung shop tự nộp sau khi thắng). Trước đây các ảnh này nằm tĩnh, hardcode
trong frontend/public/img/banner_admin/ — không ai quản lý được.

Revision ID: 202608160005
Revises: 202608160004
Create Date: 2026-08-16

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608160005'
down_revision = '202608160004'
branch_labels = None
depends_on = None

_TABLES = ('banner_slots', 'flash_slots', 'top_slots')


def _column_exists(conn, table, column) -> bool:
    return conn.execute(text("""
        SELECT 1 FROM information_schema.columns
        WHERE table_name = :t AND column_name = :c
    """), {"t": table, "c": column}).first() is not None


def upgrade() -> None:
    conn = op.get_bind()
    for table in _TABLES:
        if not _column_exists(conn, table, 'preview_image_url'):
            op.add_column(table, sa.Column('preview_image_url', sa.String(500), nullable=True))


def downgrade() -> None:
    for table in _TABLES:
        op.drop_column(table, 'preview_image_url')
