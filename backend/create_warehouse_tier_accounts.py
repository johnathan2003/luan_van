"""
Tạo tài khoản test cho 3 cấp quản lý kho.
Chạy bằng lệnh:
    docker exec shopvn_backend python create_warehouse_tier_accounts.py
Hoặc nếu chạy local:
    python create_warehouse_tier_accounts.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.database import SessionLocal
from app.utils.security import hash_password
from sqlalchemy import text

ACCOUNTS = [
    {
        "email":    "hub@buyzo.vn",
        "password": "Hub@123456",
        "name":     "Trần Văn Hub",
        "phone":    "0901000001",
        "address":  "Kho Tổng HCM, Bình Chánh, TP.HCM",
        "role":     "employee",   # hub/district/ward giờ dùng chung role "employee" (khác Admin_emp)
        "desc":     "Quản lý kho tổng cấp 1",
        "url":      "/hub",
        "city":     "hcmc",
        "tier":     1,
    },
    {
        "email":    "district@buyzo.vn",
        "password": "District@123456",
        "name":     "Nguyễn Thị Quận",
        "phone":    "0901000002",
        "address":  "Kho Quận 1, TP.HCM",
        "role":     "employee",   # hub/district/ward giờ dùng chung role "employee" (khác Admin_emp)
        "desc":     "Quản lý kho quận cấp 2",
        "url":      "/district",
        "city":     "hcmc",
        "tier":     2,
        "district": "Quận 1",
    },
    {
        "email":    "ward@buyzo.vn",
        "password": "Ward@123456",
        "name":     "Lê Văn Phường",
        "phone":    "0901000003",
        "address":  "Kho Phường Bến Nghé, Quận 1, TP.HCM",
        "role":     "employee",   # hub/district/ward giờ dùng chung role "employee" (khác Admin_emp)
        "desc":     "Quản lý kho phường cấp 3",
        "url":      "/ward",
        "city":     "hcmc",
        "tier":     3,
        "district": "Quận 1",
        "ward":     "Phường Bến Nghé",
    },
]

db = SessionLocal()
results = []

try:
    # ── Đảm bảo các cột/bảng cần thiết đã tồn tại (chạy migration inline) ──
    print("⚙️  Kiểm tra schema...")
    db.execute(text("""
        ALTER TABLE warehouses
            ADD COLUMN IF NOT EXISTS tier  SMALLINT NOT NULL DEFAULT 3,
            ADD COLUMN IF NOT EXISTS city  VARCHAR(50),
            ADD COLUMN IF NOT EXISTS district VARCHAR(100),
            ADD COLUMN IF NOT EXISTS ward  VARCHAR(100),
            ADD COLUMN IF NOT EXISTS ward_code VARCHAR(20),
            ADD COLUMN IF NOT EXISTS parent_warehouse_id INTEGER REFERENCES warehouses(warehouse_id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS manager_id INTEGER REFERENCES users(user_id) ON DELETE SET NULL;
    """))
    db.execute(text("""
        CREATE TABLE IF NOT EXISTS warehouse_shippers (
            id           SERIAL PRIMARY KEY,
            warehouse_id INTEGER NOT NULL REFERENCES warehouses(warehouse_id) ON DELETE CASCADE,
            shipper_id   INTEGER NOT NULL REFERENCES shippers(shipper_id) ON DELETE CASCADE,
            assigned_by  INTEGER REFERENCES users(user_id) ON DELETE SET NULL,
            assigned_at  TIMESTAMP DEFAULT NOW(),
            status       VARCHAR(20) DEFAULT 'active',
            UNIQUE (warehouse_id, shipper_id)
        );
    """))
    # Seed kho tổng nếu chưa có
    db.execute(text("""
        INSERT INTO warehouses (name, province, address, tier, city, is_active)
        VALUES
            ('Kho Tổng Hà Nội',          'Hà Nội',           'Đông Anh, Hà Nội',              1, 'hanoi', TRUE),
            ('Kho Tổng TP. Hồ Chí Minh', 'TP. Hồ Chí Minh',  'Bình Chánh, TP. Hồ Chí Minh', 1, 'hcmc',  TRUE)
        ON CONFLICT DO NOTHING;
    """))
    db.commit()
    print("  ✓ Schema OK\n")

    for acc in ACCOUNTS:
        print(f"\n{'='*50}")
        print(f"▶ Tạo tài khoản: {acc['email']}")

        # 1. Tạo / lấy user
        row = db.execute(text("SELECT user_id FROM users WHERE email = :e"), {"e": acc["email"]}).fetchone()
        if row:
            user_id = row[0]
            print(f"  ✓ User đã tồn tại (id={user_id})")
        else:
            pw_hash = hash_password(acc["password"])
            row = db.execute(text("""
                INSERT INTO users (email, password_hash, full_name, phone, address, status)
                VALUES (:e, :pw, :name, :phone, :addr, 'active')
                RETURNING user_id
            """), {
                "e":     acc["email"],
                "pw":    pw_hash,
                "name":  acc["name"],
                "phone": acc["phone"],
                "addr":  acc["address"],
            }).fetchone()
            user_id = row[0]
            print(f"  ✓ Đã tạo user mới (id={user_id})")

        # 2. Đảm bảo role tồn tại
        role_row = db.execute(
            text("SELECT role_id FROM roles WHERE role_name = :r"),
            {"r": acc["role"]}
        ).fetchone()
        if not role_row:
            role_row = db.execute(text("""
                INSERT INTO roles (role_name, description)
                VALUES (:r, :d) RETURNING role_id
            """), {"r": acc["role"], "d": acc["desc"]}).fetchone()
            print(f"  ✓ Đã tạo role: {acc['role']}")
        role_id = role_row[0]

        # 3. Gán role cho user
        exists = db.execute(text(
            "SELECT 1 FROM user_roles WHERE user_id = :u AND role_id = :r"
        ), {"u": user_id, "r": role_id}).fetchone()
        if not exists:
            db.execute(text("""
                INSERT INTO user_roles (user_id, role_id, status, "current_role")
                VALUES (:u, :r, 'active', TRUE)
            """), {"u": user_id, "r": role_id})
            print(f"  ✓ Đã gán role: {acc['role']}")
        else:
            db.execute(text("""
                UPDATE user_roles SET status = 'active', "current_role" = TRUE
                WHERE user_id = :u AND role_id = :r
            """), {"u": user_id, "r": role_id})
            print(f"  ✓ Role đã tồn tại (đảm bảo active)")

        # 4. Tạo / lấy kho phù hợp với cấp và gán vào warehouse_managers
        wh_row = None
        if acc["tier"] == 1:
            wh_row = db.execute(text("""
                SELECT warehouse_id FROM warehouses
                WHERE city = :city AND tier = 1
                LIMIT 1
            """), {"city": acc["city"]}).fetchone()

        elif acc["tier"] == 2:
            district = acc.get("district")
            wh_row = db.execute(text("""
                SELECT warehouse_id FROM warehouses
                WHERE city = :city AND tier = 2 AND district = :d
                LIMIT 1
            """), {"city": acc["city"], "d": district}).fetchone()

            # Nếu kho cấp 2 chưa có thì tạo
            if not wh_row:
                hub_row = db.execute(text("""
                    SELECT warehouse_id FROM warehouses WHERE city = :city AND tier = 1 LIMIT 1
                """), {"city": acc["city"]}).fetchone()
                parent_id = hub_row[0] if hub_row else None
                wh_row = db.execute(text("""
                    INSERT INTO warehouses (name, province, city, district, tier, parent_warehouse_id, is_active)
                    VALUES (:name, 'TP. Hồ Chí Minh', :city, :district, 2, :parent, TRUE)
                    RETURNING warehouse_id
                """), {
                    "name":     f"Kho {district}",
                    "city":     acc["city"],
                    "district": district,
                    "parent":   parent_id,
                }).fetchone()
                print(f"  ✓ Đã tạo kho cấp 2: Kho {district}")

        elif acc["tier"] == 3:
            district = acc.get("district")
            ward     = acc.get("ward")

            # Lấy kho cấp 2 làm parent
            parent_row = db.execute(text("""
                SELECT warehouse_id FROM warehouses
                WHERE city = :city AND tier = 2 AND district = :d
                LIMIT 1
            """), {"city": acc["city"], "d": district}).fetchone()
            parent_id = parent_row[0] if parent_row else None

            wh_row = db.execute(text("""
                SELECT warehouse_id FROM warehouses
                WHERE city = :city AND tier = 3 AND ward = :w
                LIMIT 1
            """), {"city": acc["city"], "w": ward}).fetchone()

            if not wh_row:
                wh_row = db.execute(text("""
                    INSERT INTO warehouses (name, province, city, district, ward, tier, parent_warehouse_id, is_active)
                    VALUES (:name, 'TP. Hồ Chí Minh', :city, :district, :ward, 3, :parent, TRUE)
                    RETURNING warehouse_id
                """), {
                    "name":     f"Kho {ward}",
                    "city":     acc["city"],
                    "district": district,
                    "ward":     ward,
                    "parent":   parent_id,
                }).fetchone()
                print(f"  ✓ Đã tạo kho cấp 3: Kho {ward}")

        # 5. Gán manager vào kho
        if wh_row:
            wh_id = wh_row[0]
            mgr_row = db.execute(text(
                "SELECT manager_id FROM warehouse_managers WHERE manager_id = :u"
            ), {"u": user_id}).fetchone()
            if mgr_row:
                db.execute(text(
                    "UPDATE warehouse_managers SET warehouse_id = :w WHERE manager_id = :u"
                ), {"w": wh_id, "u": user_id})
                print(f"  ✓ Đã cập nhật gán kho (warehouse_id={wh_id})")
            else:
                db.execute(text("""
                    INSERT INTO warehouse_managers (manager_id, warehouse_id)
                    VALUES (:u, :w)
                """), {"u": user_id, "w": wh_id})
                print(f"  ✓ Đã gán kho (warehouse_id={wh_id})")
        else:
            print(f"  ⚠ Không tìm thấy kho tier={acc['tier']} — bỏ qua gán kho")

        db.commit()
        results.append({"email": acc["email"], "password": acc["password"], "url": acc["url"], "tier": acc["tier"]})

    # In tổng kết
    print(f"\n{'='*50}")
    print("✅ Tạo tài khoản thành công!\n")
    print(f"{'Cấp':<12} {'Email':<25} {'Mật khẩu':<20} {'URL đăng nhập'}")
    print("-" * 80)
    TIER_LEVEL = {1: "Kho tổng", 2: "Kho quận", 3: "Kho phường"}
    for r in results:
        level = TIER_LEVEL.get(r["tier"], "Kho")
        print(f"{level:<12} {r['email']:<25} {r['password']:<20} {r['url']}")

except Exception as e:
    db.rollback()
    print(f"\nERROR: {e}")
    import traceback; traceback.print_exc()
    sys.exit(1)
finally:
    db.close()
