"""backfill: sản phẩm đang ở status='approved' (chờ shop tự đăng bán) -> active

Trước khi sửa approve_product(), admin duyệt xong sản phẩm chỉ chuyển sang
'approved' chứ chưa hiện công khai, phải chờ shop bấm "Đăng bán" mới thành
'active'. Nay admin duyệt là active ngay — migration này backfill các sản
phẩm cũ đang kẹt ở 'approved' để chúng lên sàn luôn, không phải chờ shop vào
bấm lại.

Revision ID: 202608040001
Revises: 202608030006
Create Date: 2026-08-04

"""
from alembic import op

revision = '202608040001'
down_revision = '202608030006'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE products SET status = 'active' WHERE status = 'approved'")


def downgrade() -> None:
    # Không thể phân biệt sản phẩm nào trước đó là 'approved' vs 'active' thật
    # sự (đã được shop bấm đăng bán) — downgrade để nguyên, không revert data.
    pass
