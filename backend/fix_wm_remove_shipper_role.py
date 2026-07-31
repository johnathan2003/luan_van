"""
Xóa role 'shipper' khỏi warehouse@example.com.
Warehouse manager KHÔNG phải shipper — chỉ giữ role warehouse_manager.
Chạy: docker exec shopvn_backend python fix_wm_remove_shipper_role.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import SessionLocal
from sqlalchemy import text

EMAIL = "warehouse@example.com"

db = SessionLocal()
try:
    row = db.execute(text("SELECT user_id FROM users WHERE email = :e"), {"e": EMAIL}).fetchone()
    if not row:
        print(f"Không tìm thấy {EMAIL}")
        sys.exit(1)
    user_id = row[0]
    print(f"User: {EMAIL}  (id={user_id})")

    # Xóa role shipper
    r = db.execute(text("""
        DELETE FROM user_roles
        WHERE user_id = :uid
          AND role_id = (SELECT role_id FROM roles WHERE role_name = 'shipper')
    """), {"uid": user_id})
    print(f"Removed shipper role ({r.rowcount} row)")

    # Không xóa shipper profile (FK constraint từ shipments), chỉ set offline
    db.execute(text("UPDATE shippers SET status = 'offline' WHERE shipper_id = :uid"), {"uid": user_id})
    print("Set shipper status -> offline (profile giữ lại vì có shipments tham chiếu)")

    # Xác nhận chỉ còn warehouse_manager
    roles = db.execute(text("""
        SELECT r.role_name FROM user_roles ur
        JOIN roles r ON ur.role_id = r.role_id
        WHERE ur.user_id = :uid AND ur.status = 'active'
    """), {"uid": user_id}).fetchall()
    print(f"Remaining roles: {[r[0] for r in roles]}")

    db.commit()
    print("\nDone! Login at /warehouse")

except Exception as e:
    db.rollback()
    print(f"ERROR: {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)
finally:
    db.close()
