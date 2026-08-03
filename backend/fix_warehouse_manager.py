"""
Gán warehouse@example.com vào Kho HCM (warehouse_id=1).
Chạy: docker exec shopvn_backend python fix_warehouse_manager.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))
from app.database import SessionLocal
from sqlalchemy import text

EMAIL = "warehouse@example.com"

db = SessionLocal()
try:
    # Lấy user_id
    row = db.execute(text("SELECT user_id FROM users WHERE email = :e"), {"e": EMAIL}).fetchone()
    if not row:
        print(f"Không tìm thấy user {EMAIL}")
        sys.exit(1)
    user_id = row[0]
    print(f"User: {EMAIL}  (id={user_id})")

    # Đảm bảo kho HCM tồn tại
    wh = db.execute(text("SELECT warehouse_id, name FROM warehouses WHERE warehouse_id = 1")).fetchone()
    if not wh:
        db.execute(text("""
            INSERT INTO warehouses (warehouse_id, name, province, address, is_active)
            VALUES (1, 'Kho HCM', 'TP. Ho Chi Minh', '100 Nguyen Van Linh, Q7, HCM', true)
        """))
        print("Created Kho HCM (id=1)")
    else:
        print(f"Warehouse: {wh[1]} (id={wh[0]})")

    # Xóa/upsert bản ghi warehouse_managers
    db.execute(text("DELETE FROM warehouse_managers WHERE manager_id = :id"), {"id": user_id})
    db.execute(text("""
        INSERT INTO warehouse_managers (manager_id, warehouse_id)
        VALUES (:uid, 1)
    """), {"uid": user_id})
    print(f"Linked user {user_id} -> warehouse_id=1 (Kho HCM)")

    # Đảm bảo role warehouse_manager active
    db.execute(text("""
        UPDATE user_roles ur
        SET status = 'active'
        FROM roles r
        WHERE ur.role_id = r.role_id
          AND r.role_name = 'warehouse_manager'
          AND ur.user_id = :uid
    """), {"uid": user_id})
    print("Role warehouse_manager: active")

    db.commit()
    print("\nDone! Login at /warehouse")
    print(f"  Email   : {EMAIL}")
    print(f"  Password: Warehouse@123")

except Exception as e:
    db.rollback()
    print(f"ERROR: {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)
finally:
    db.close()
