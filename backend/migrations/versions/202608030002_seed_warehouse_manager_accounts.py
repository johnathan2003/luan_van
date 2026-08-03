"""Seed tài khoản quản lý kho mẫu — 2 Hub (HN, HCM), 10 Quận (1-10 TP.HCM), 5 Phường (Q8)

Revision ID: 202608030002
Revises: 202608030001
Create Date: 2026-08-03

Tạo sẵn tài khoản đăng nhập cho các kho đã seed từ trước, theo đúng quy tắc
email tự động của hệ thống: {tài khoản}cap{cấp}{mã kho}@buyzo.com, mật khẩu =
toàn bộ phần trước @ (giống cách backend /api/v1/warehouse-accounts tạo).

Dùng "Kho" làm tài khoản gốc cho toàn bộ 17 tài khoản này. Bỏ qua (không tạo
trùng) nếu email đã tồn tại — an toàn khi chạy lại hoặc nếu admin đã tự tạo
tay 1 vài tài khoản trong số này trước đó.
"""
import re
import unicodedata

import bcrypt
import sqlalchemy as sa
from alembic import op

revision = '202608030002'
down_revision = '202608030001'
branch_labels = None
depends_on = None


def _strip_diacritics(s: str) -> str:
    s = s.replace("đ", "d").replace("Đ", "D")
    nfkd = unicodedata.normalize("NFD", s)
    return "".join(c for c in nfkd if unicodedata.category(c) != "Mn")


def _warehouse_code(name: str) -> str:
    """Phải khớp với app/routes/warehouse_accounts.py::_warehouse_code()."""
    s = _strip_diacritics(name or "")
    s = re.sub(r"^\s*kho\s+", "", s, flags=re.IGNORECASE)
    words = re.findall(r"[A-Za-z0-9]+", s)
    code = "".join(w.upper() if w.isdigit() else w[0].upper() for w in words if w)
    return code or "W"


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


TIER_ROLE_NAME = {
    1: "warehouse_hub_manager",
    2: "warehouse_district_manager",
    3: "warehouse_ward_manager",
}

USERNAME_BASE = "Kho"

ACCOUNTS = (
    [
        {"city": "hanoi", "tier": 1, "district": None, "ward": None, "full_name": "Quản lý Kho Tổng Hà Nội"},
        {"city": "hcmc", "tier": 1, "district": None, "ward": None, "full_name": "Quản lý Kho Tổng TP. Hồ Chí Minh"},
    ]
    + [
        {"city": "hcmc", "tier": 2, "district": f"Quận {i}", "ward": None, "full_name": f"Quản lý Kho Quận {i}"}
        for i in range(1, 11)
    ]
    + [
        {
            "city": "hcmc", "tier": 3, "district": "Quận 8", "ward": f"Phường {i}",
            "full_name": f"Quản lý Kho Phường {i} — Quận 8",
        }
        for i in range(1, 6)
    ]
)


def upgrade():
    conn = op.get_bind()

    admin_row = conn.execute(sa.text("""
        SELECT u.user_id FROM users u
        JOIN user_roles ur ON ur.user_id = u.user_id AND ur.status = 'active'
        JOIN roles r ON r.role_id = ur.role_id
        WHERE r.role_name IN ('admin', 'superadmin')
        ORDER BY u.user_id LIMIT 1
    """)).first()
    if not admin_row:
        # Không tìm thấy admin nào — bỏ qua seed (system_employees.created_by NOT NULL)
        return
    admin_id = admin_row[0]

    for spec in ACCOUNTS:
        where = "city = :city AND tier = :tier"
        params = {"city": spec["city"], "tier": spec["tier"]}
        where += " AND district = :district" if spec["district"] is not None else " AND district IS NULL"
        if spec["district"] is not None:
            params["district"] = spec["district"]
        where += " AND ward = :ward" if spec["ward"] is not None else " AND ward IS NULL"
        if spec["ward"] is not None:
            params["ward"] = spec["ward"]

        wh = conn.execute(sa.text(f"SELECT warehouse_id, name FROM warehouses WHERE {where} LIMIT 1"), params).first()
        if not wh:
            continue  # kho tương ứng chưa tồn tại — bỏ qua, không tạo tài khoản mồ côi
        wh_id, wh_name = wh

        code = _warehouse_code(wh_name)
        local_part = f"{USERNAME_BASE}cap{spec['tier']}{code}"
        email = f"{local_part}@buyzo.com"

        if conn.execute(sa.text("SELECT 1 FROM users WHERE email = :e"), {"e": email}).first():
            continue  # đã tồn tại — bỏ qua, tránh tạo trùng

        new_user_id = conn.execute(sa.text("""
            INSERT INTO users (email, password_hash, full_name, status)
            VALUES (:email, :pw, :name, 'active') RETURNING user_id
        """), {"email": email, "pw": _hash(local_part), "name": spec["full_name"]}).scalar()

        role_name = TIER_ROLE_NAME[spec["tier"]]
        role_row = conn.execute(sa.text("SELECT role_id FROM roles WHERE role_name = :r"), {"r": role_name}).first()
        if role_row:
            role_id = role_row[0]
        else:
            role_id = conn.execute(sa.text("""
                INSERT INTO roles (role_name, description) VALUES (:r, :d) RETURNING role_id
            """), {"r": role_name, "d": f"BuyZo — {role_name}"}).scalar()

        # "current_role" là từ khoá dành riêng của PostgreSQL (giống CURRENT_USER) —
        # BẮT BUỘC phải đặt trong dấu ngoặc kép khi dùng raw SQL, nếu không sẽ lỗi
        # cú pháp (ORM thường tự quote giúp, raw SQL thì không).
        conn.execute(sa.text("""
            INSERT INTO user_roles (user_id, role_id, status, "current_role", assigned_by)
            VALUES (:uid, :rid, 'active', TRUE, :admin)
        """), {"uid": new_user_id, "rid": role_id, "admin": admin_id})

        conn.execute(sa.text("""
            INSERT INTO system_employees (user_id, emp_name, role_name, status, created_by)
            VALUES (:uid, :name, 'warehouse_admin', 'active', :admin)
        """), {"uid": new_user_id, "name": spec["full_name"], "admin": admin_id})

        conn.execute(sa.text("""
            INSERT INTO warehouse_managers (manager_id, warehouse_id) VALUES (:uid, :wid)
            ON CONFLICT (manager_id) DO UPDATE SET warehouse_id = EXCLUDED.warehouse_id
        """), {"uid": new_user_id, "wid": wh_id})


def downgrade():
    conn = op.get_bind()
    conn.execute(sa.text("""
        DELETE FROM warehouse_managers WHERE manager_id IN (
            SELECT user_id FROM users WHERE email ~* '^Khocap[0-9]+[A-Z0-9]*@buyzo\\.com$'
        )
    """))
    conn.execute(sa.text("""
        DELETE FROM system_employees WHERE user_id IN (
            SELECT user_id FROM users WHERE email ~* '^Khocap[0-9]+[A-Z0-9]*@buyzo\\.com$'
        )
    """))
    conn.execute(sa.text("""
        DELETE FROM user_roles WHERE user_id IN (
            SELECT user_id FROM users WHERE email ~* '^Khocap[0-9]+[A-Z0-9]*@buyzo\\.com$'
        )
    """))
    conn.execute(sa.text("""
        DELETE FROM users WHERE email ~* '^Khocap[0-9]+[A-Z0-9]*@buyzo\\.com$'
    """))
