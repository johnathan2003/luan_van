"""Tạo tài khoản Warehouse Manager — chạy 1 lần via: docker exec shopvn_backend python create_warehouse_user.py"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.utils.security import hash_password
from sqlalchemy import text

EMAIL    = "warehouse@example.com"
PASSWORD = "Warehouse@123"
NAME     = "Nguyen Van Kho"
PHONE    = "0908000001"
ADDRESS  = "Kho tong HCM, 100 Nguyen Van Linh, Q7"

db = SessionLocal()
try:
    # 1. Tạo / lấy user
    row = db.execute(text("SELECT user_id FROM users WHERE email = :e"), {"e": EMAIL}).fetchone()
    if row:
        user_id = row[0]
        print(f"User already exists: {EMAIL}  (id={user_id})")
    else:
        pw_hash = hash_password(PASSWORD)
        row = db.execute(text("""
            INSERT INTO users (email, password_hash, full_name, phone, address, status)
            VALUES (:e, :pw, :name, :phone, :addr, 'active')
            RETURNING user_id
        """), {"e": EMAIL, "pw": pw_hash, "name": NAME, "phone": PHONE, "addr": ADDRESS}).fetchone()
        user_id = row[0]
        print(f"Created user: {EMAIL}  (id={user_id})")

    # 2. Đảm bảo role warehouse_manager tồn tại
    wm = db.execute(text("SELECT role_id FROM roles WHERE role_name = 'warehouse_manager'")).fetchone()
    if not wm:
        wm = db.execute(text("""
            INSERT INTO roles (role_name, description) VALUES ('warehouse_manager', 'Quan ly kho trung chuyen')
            RETURNING role_id
        """)).fetchone()
        print("Created role: warehouse_manager")
    wm_role_id = wm[0]

    shipper_role = db.execute(text("SELECT role_id FROM roles WHERE role_name = 'shipper'")).fetchone()

    # 3. Gán role shipper
    if shipper_role:
        s_role_id = shipper_role[0]
        exists = db.execute(text(
            "SELECT 1 FROM user_roles WHERE user_id = :u AND role_id = :r"
        ), {"u": user_id, "r": s_role_id}).fetchone()
        if not exists:
            db.execute(text("""
                INSERT INTO user_roles (user_id, role_id, status) VALUES (:u, :r, 'active')
            """), {"u": user_id, "r": s_role_id})
            print("Assigned role: shipper")

    # 4. Gán role warehouse_manager
    exists = db.execute(text(
        "SELECT 1 FROM user_roles WHERE user_id = :u AND role_id = :r"
    ), {"u": user_id, "r": wm_role_id}).fetchone()
    if not exists:
        db.execute(text("""
            INSERT INTO user_roles (user_id, role_id, status) VALUES (:u, :r, 'active')
        """), {"u": user_id, "r": wm_role_id})
        print("Assigned role: warehouse_manager")
    else:
        db.execute(text(
            "UPDATE user_roles SET status = 'active' WHERE user_id = :u AND role_id = :r"
        ), {"u": user_id, "r": wm_role_id})
        print("Role warehouse_manager already present, ensured active")

    # 5. Tạo shipper profile
    exists = db.execute(text("SELECT 1 FROM shippers WHERE shipper_id = :id"), {"id": user_id}).fetchone()
    if not exists:
        db.execute(text("""
            INSERT INTO shippers (shipper_id, vehicle_type, license_plate, status)
            VALUES (:id, 'truck_large', '51-WM-0001', 'available')
        """), {"id": user_id})
        print("Created shipper profile")
    else:
        print("Shipper profile already exists")

    db.commit()
    print("\nDone! Login with:")
    print(f"  Email   : {EMAIL}")
    print(f"  Password: {PASSWORD}")
    print(f"  URL     : /warehouse")

except Exception as e:
    db.rollback()
    print(f"ERROR: {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)
finally:
    db.close()
