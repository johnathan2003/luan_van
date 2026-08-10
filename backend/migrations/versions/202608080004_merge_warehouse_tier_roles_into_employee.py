"""merge warehouse_hub/district/ward_manager roles into 'employee'

3 role kho cấp dưới (hub/district/ward) trước đây là 3 role riêng biệt —
giờ gộp chung thành role "employee" (giống nhân viên shop), phân biệt qua
bảng phụ SystemEmployee (kho) vs ShopEmployee (shop). Tier (hub/district/
ward) giờ suy ra từ WarehouseManager -> Warehouse.tier thay vì role string
riêng — xem app/middleware/auth.py::_user_warehouse_tier().

Role "Admin_emp" (Quản lý tổng) GIỮ NGUYÊN, không đổi.

An toàn: chỉ update user_roles.role_id trỏ sang role "employee" (tạo mới nếu
chưa có), rồi xoá row cũ nếu trùng — không mất tài khoản, không đổi
WarehouseManager/SystemEmployee đã gắn sẵn.

Revision ID: 202608080004
Revises: 202608080003
Create Date: 2026-08-10

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text

revision = '202608080004'
down_revision = '202608080003'
branch_labels = None
depends_on = None

_OLD_ROLES = (
    "warehouse_hub_manager",
    "warehouse_district_manager",
    "warehouse_ward_manager",
)


def upgrade() -> None:
    conn = op.get_bind()

    # Đảm bảo role "employee" tồn tại
    conn.execute(text("""
        INSERT INTO roles (role_name, description)
        SELECT 'employee', 'Nhan vien (shop hoac noi bo do Admin_emp tao)'
        WHERE NOT EXISTS (SELECT 1 FROM roles WHERE role_name = 'employee')
    """))
    employee_role_id = conn.execute(
        text("SELECT role_id FROM roles WHERE role_name = 'employee'")
    ).scalar()

    for old_role_name in _OLD_ROLES:
        old_role_id = conn.execute(
            text("SELECT role_id FROM roles WHERE role_name = :r"), {"r": old_role_name}
        ).scalar()
        if not old_role_id:
            continue

        # User đang giữ role cũ mà CHƯA có role "employee" -> repoint thẳng
        conn.execute(text("""
            UPDATE user_roles SET role_id = :new_id
            WHERE role_id = :old_id
              AND user_id NOT IN (
                  SELECT user_id FROM user_roles WHERE role_id = :new_id
              )
        """), {"new_id": employee_role_id, "old_id": old_role_id})

        # User nào đã có sẵn role "employee" (hiếm) -> xoá row role cũ, tránh trùng
        conn.execute(
            text("DELETE FROM user_roles WHERE role_id = :old_id"),
            {"old_id": old_role_id},
        )


def downgrade() -> None:
    # Không khôi phục lại 3 role riêng — tier đã có thể suy ra lại từ
    # WarehouseManager.warehouse_id nếu cần rollback thủ công.
    pass
