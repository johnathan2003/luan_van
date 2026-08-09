"""rename role 'warehouse_manager' -> 'Admin_emp'

Role cấp "Quản lý tổng" (do admin tạo, quản lý toàn bộ nhánh kho, tạo được
tài khoản hub/district/ward cấp dưới) đổi tên từ "warehouse_manager" sang
"Admin_emp" cho rõ nghĩa: đây là nhân viên nội bộ, không phải khách hàng —
xem middleware/auth.py::EMPLOYMENT_ROLES. Chỉ đổi role_name (role_id giữ
nguyên) nên mọi user_roles đang trỏ vào role này tự động theo tên mới,
không mất dữ liệu/không cần gán lại.

Revision ID: 202608080002
Revises: 202608080001
Create Date: 2026-08-08

"""
from alembic import op
import sqlalchemy as sa

revision = '202608080002'
down_revision = '202608080001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("UPDATE roles SET role_name = 'Admin_emp' WHERE role_name = 'warehouse_manager'")


def downgrade() -> None:
    op.execute("UPDATE roles SET role_name = 'warehouse_manager' WHERE role_name = 'Admin_emp'")
