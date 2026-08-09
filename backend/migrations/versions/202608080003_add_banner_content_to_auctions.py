"""add banner image/title/link + duyệt vào banner_auctions

Khi shop thắng đấu giá banner, họ cần nộp ảnh/thông tin banner thật để
superadmin duyệt trước khi hiển thị lên site — trước đây banner_auctions chỉ
lưu giá/người thắng, KHÔNG có nơi lưu nội dung banner (ảnh) nào cả.

Revision ID: 202608080003
Revises: 202608080002
Create Date: 2026-08-08

"""
from alembic import op
import sqlalchemy as sa

revision = '202608080003'
down_revision = '202608080002'
branch_labels = None
depends_on = None

_COLUMNS = [
    ("banner_image_url",    sa.String(500)),
    ("banner_title",        sa.String(255)),
    ("banner_link",         sa.String(500)),
    # banner_status: pending | approved | rejected — chỉ có ý nghĩa sau khi
    # shop đã submit ảnh (NULL = chưa submit gì)
    ("banner_status",       sa.String(30)),
    ("banner_submitted_at", sa.DateTime()),
    ("banner_reviewed_at",  sa.DateTime()),
    ("banner_reject_reason", sa.Text()),
]


def _column_exists(table: str, column: str) -> bool:
    bind = op.get_bind()
    result = bind.execute(sa.text(
        "SELECT 1 FROM information_schema.columns WHERE table_name = :t AND column_name = :c"
    ), {"t": table, "c": column})
    return result.first() is not None


def upgrade() -> None:
    for name, coltype in _COLUMNS:
        if not _column_exists("banner_auctions", name):
            op.add_column("banner_auctions", sa.Column(name, coltype, nullable=True))


def downgrade() -> None:
    for name, _ in reversed(_COLUMNS):
        if _column_exists("banner_auctions", name):
            op.drop_column("banner_auctions", name)
