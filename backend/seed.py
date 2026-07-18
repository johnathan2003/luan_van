"""
seed.py -- Data mau de test local
Chay: python seed.py
Reset: python seed.py --reset
"""
import os, sys
from datetime import datetime, timedelta
from decimal import Decimal
from dotenv import load_dotenv

_cli_db_url = None
_reset_mode = "--reset" in sys.argv
if "--db" in sys.argv:
    idx = sys.argv.index("--db")
    if idx + 1 < len(sys.argv):
        _cli_db_url = sys.argv[idx + 1]

load_dotenv(override=False)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text, event
from sqlalchemy.orm import sessionmaker

from app.utils.security import hash_password
from app.utils.constants import DEFAULT_PERMISSIONS
from app.models.user import User, Role, UserRole, Permission, RolePermission
from app.models.shop import Shop, ShopEmployee, EmployeeRolePermission
from app.models.product import Product, ProductCategory
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.models.shipment import Shipment, Shipper, Warehouse, WarehouseManager
from app.models.wallet_auction import ShopWallet, ShopWalletTransaction, BannerSlot
from app.models.voucher import Voucher, VoucherCollection


def get_engine():
    url = _cli_db_url or os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    if not url:
        url = "mysql+pymysql://{}:{}@{}:{}/{}".format(
            os.getenv("DB_USER", "shopvn_user"),
            os.getenv("DB_PASSWORD", "shopvn_pass"),
            os.getenv("DB_HOST", "localhost"),
            os.getenv("DB_PORT", "3306"),
            os.getenv("DB_NAME", "ecommerce_db"),
        )
    url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    url = url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
    print(f"  Connect: {url.split('@')[-1]}")
    engine = create_engine(url, echo=False, pool_pre_ping=True)
    if "mysql" in url or "pymysql" in url:
        @event.listens_for(engine, "connect")
        def _fk_off(conn, _):
            cur = conn.cursor()
            try:
                cur.execute("SET FOREIGN_KEY_CHECKS=0")
            except Exception:
                pass
            cur.close()
    return engine


def upsert(db, Model, filter_kw, **kw):
    obj = db.query(Model).filter_by(**filter_kw).first()
    if not obj:
        obj = Model(**{**filter_kw, **kw})
        db.add(obj)
        db.flush()
        return obj, True
    return obj, False


def reset_tables(engine):
    tables = [
        "banner_bids", "banner_auctions", "banner_slots",
        "shop_wallet_transactions", "shop_wallet",
        "transfer_packages", "warehouse_transfers",
        "payments", "shipments", "order_items", "orders",
        "voucher_collections", "vouchers", "products", "product_categories",
        "employee_role_permissions", "shop_employees",
        "warehouse_managers", "warehouses",
        "shops", "shippers", "user_roles", "users", "roles",
    ]
    print("Reset old data...")
    with engine.connect() as conn:
        if "mysql" in str(engine.url):
            conn.execute(text("SET FOREIGN_KEY_CHECKS=0"))
        for t in tables:
            try:
                conn.execute(text(f"DELETE FROM {t}"))
            except Exception:
                pass
        if "mysql" in str(engine.url):
            conn.execute(text("SET FOREIGN_KEY_CHECKS=1"))
        conn.commit()


def seed():
    engine = get_engine()
    db = sessionmaker(bind=engine)()
    if _reset_mode:
        reset_tables(engine)

    print("Seeding...\n")
    now = datetime.now()

    try:
        # ROLES
        for name in ("admin", "superadmin", "shop", "shipper", "user", "employee", "warehouse_manager", "warehouse_chief"):
            upsert(db, Role, {"role_name": name})
        db.commit()
        roles = {r.role_name: r for r in db.query(Role).all()}

        # PERMISSIONS
        for pcode, category, desc in DEFAULT_PERMISSIONS:
            upsert(db, Permission, {"permission_code": pcode},
                category=category, description=desc)
        db.commit()
        perms = {p.permission_code: p for p in db.query(Permission).all()}

        # ROLE-PERMISSIONS
        # superadmin: toàn quyền — không bị ghi log
        for perm in perms.values():
            upsert(db, RolePermission,
                {"role_id": roles["superadmin"].role_id, "permission_id": perm.permission_id})

        # admin: quyền quản trị (được ghi log)
        for pcode in [
            "user:manage", "user:ban", "dispute:resolve",
            "product:approve", "product:read",
            "order:read", "shipment:read", "shipment:assign",
            "payment:process", "message:read",
        ]:
            if pcode in perms:
                upsert(db, RolePermission,
                    {"role_id": roles["admin"].role_id, "permission_id": perms[pcode].permission_id})

        # shop role
        for pcode in [
            "product:create", "product:read", "product:update", "product:delete",
            "order:read", "order:confirm", "order:cancel", "order:update",
            "shop:manage", "shop:analytics", "shop:employees",
            "message:read", "message:send",
        ]:
            if pcode in perms:
                upsert(db, RolePermission,
                    {"role_id": roles["shop"].role_id, "permission_id": perms[pcode].permission_id})

        # shipper role
        for pcode in ["shipment:read", "order:read", "message:read", "message:send"]:
            if pcode in perms:
                upsert(db, RolePermission,
                    {"role_id": roles["shipper"].role_id, "permission_id": perms[pcode].permission_id})

        # user (customer) role
        for pcode in ["order:create", "order:cancel", "message:read", "message:send", "payment:process"]:
            if pcode in perms:
                upsert(db, RolePermission,
                    {"role_id": roles["user"].role_id, "permission_id": perms[pcode].permission_id})

        db.commit()

        # USERS — tài khoản đầy đủ (email thật)
        users_data = [
            ("admin@example.com",     "Admin@123", "Admin Example",  "0901111112", "15 Le Loi, Q1, HCM",    "admin"),
            ("owner@example.com",     "Shop@123",  "Tran Van Minh",  "0902222221", "42 Nguyen Hue, Q1, HCM", "shop"),
            ("shipper1@example.com",  "Ship@123",  "Vo Van Toc",     "0904444441", "11 Truong Chinh, HCM",   "shipper"),
            ("customer1@example.com", "User@123",  "Hoang Van An",   "0905555551", "99 CMT8, Q3, HCM",       "user"),
        ]
        users = {}
        for email, pw, name, phone, addr, role_name in users_data:
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password(pw),
                full_name=name, phone=phone, address=addr, status="active")
            users[role_name] = u
        db.commit()

        admin    = users["admin"]
        owner    = users["shop"]
        shipper  = users["shipper"]
        customer = users["user"]

        for u, role_name in [
            (admin, "admin"), (owner, "shop"),
            (shipper, "shipper"), (customer, "user"),
        ]:
            upsert(db, UserRole,
                {"user_id": u.user_id, "role_id": roles[role_name].role_id},
                current_role=True, assigned_by=admin.user_id, status="active")

        # customer1 có đủ 5 quyền để test toàn bộ hệ thống (cả 5 vai trò)
        for rn in ("admin", "shop", "shipper", "user", "employee"):
            upsert(db, UserRole,
                {"user_id": customer.user_id, "role_id": roles[rn].role_id},
                current_role=(rn == "user"), assigned_by=admin.user_id, status="active")
        db.commit()

        # ── Tài khoản test nhanh (username đơn giản) ─────────────────────────
        # Super account: password_hash = sentinel — không thể đăng nhập qua /auth/login
        # → Chỉ đăng nhập được qua /super/auth/login (so sánh plaintext từ env)
        simple_accounts = [
            ("admin", hash_password("admin"), "Admin",       "admin"),
            ("super", "!SUPER_NO_BCRYPT!",    "Super Admin", "superadmin"),   # plaintext sentinel
            ("shop",  hash_password("shop"),  "Shop Test",   "shop"),
            ("user1", hash_password("user1"), "User Test",   "user"),
        ]
        simple_users: dict[str, User] = {}
        for s_email, s_pw_hash, s_name, s_role in simple_accounts:
            su, _ = upsert(db, User, {"email": s_email},
                password_hash=s_pw_hash,
                full_name=s_name, status="active")
            if roles.get(s_role):
                upsert(db, UserRole,
                    {"user_id": su.user_id, "role_id": roles[s_role].role_id},
                    current_role=True, assigned_by=admin.user_id, status="active")
            simple_users[s_role] = su
        db.commit()

        # Shop record cho tài khoản test shop/shop
        # (shop_id = user_id, bắt buộc để tạo sản phẩm qua /api/v1/products)
        shop_test_user = simple_users.get("shop")
        if shop_test_user:
            upsert(db, Shop, {"shop_id": shop_test_user.user_id},
                shop_name="Shop Test Store",
                description="Cửa hàng test cho tài khoản shop/shop",
                address="1 Test Street, TP.HCM",
                phone="0900000000",
                rating="5.0",
                verification_status="approved",
                verified_at=now)
        db.commit()

        # CATEGORIES
        for cat_name in ("Điện tử", "Thời trang", "Sách"):
            upsert(db, ProductCategory, {"category_name": cat_name})
        db.commit()
        cats = {c.category_name: c for c in db.query(ProductCategory).all()}

        # SHOP
        shop, _ = upsert(db, Shop, {"shop_id": owner.user_id},
            shop_name="TechWorld Store",
            description="Thiết bị điện tử chính hãng",
            address="42 Nguyen Hue, Q1, TP.HCM",
            phone="0902222221",
            rating="4.8",
            verification_status="approved",
            verified_at=now - timedelta(days=30))

        # Shop cho customer1 (để test vai trò shop)
        upsert(db, Shop, {"shop_id": customer.user_id},
            shop_name="Hoang An Shop",
            description="Shop đa năng của Hoàng Văn An",
            address="99 CMT8, Q3, TP.HCM",
            phone="0905555551",
            rating="4.5",
            verification_status="approved",
            verified_at=now - timedelta(days=10))
        db.commit()

        # SHOP EMPLOYEES
        shop_emp_data = [
            (
                "emp_orders@example.com", "Emp@123",
                "Nguyễn Thị Đơn Hàng", "0906000001",
                "Nhân viên xử lý đơn hàng",
                ["order:read", "order:confirm", "order:cancel"],
            ),
            (
                "emp_feedback@example.com", "Emp@123",
                "Lê Văn Phản Hồi", "0906000002",
                "Nhân viên xử lý phản hồi khách",
                ["message:read", "message:send", "order:read"],
            ),
            (
                "emp_chat@example.com", "Emp@123",
                "Phạm Thị Tư Vấn", "0906000003",
                "Nhân viên tư vấn trực tuyến",
                ["message:read", "message:send"],
            ),
        ]
        emp_users = []
        for email, pw, name, phone, position, perms in shop_emp_data:
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password(pw),
                full_name=name, phone=phone,
                address="TechWorld Store, 42 Nguyen Hue, Q1, TP.HCM",
                status="active")
            upsert(db, UserRole,
                {"user_id": u.user_id, "role_id": roles["shop"].role_id},
                current_role=True, assigned_by=admin.user_id, status="active")
            emp, _ = upsert(db, ShopEmployee,
                {"user_id": u.user_id, "shop_id": shop.shop_id},
                employee_name=name, position=position, status="active",
                hired_date=now.date(), created_by=owner.user_id)
            db.flush()
            for perm_code in perms:
                upsert(db, EmployeeRolePermission,
                    {"employee_id": emp.employee_id, "permission_code": perm_code},
                    granted_by=owner.user_id)
            emp_users.append((email, pw, name, position, perms))
        db.commit()

        # SHIPPER PROFILE (main shipper1)
        upsert(db, Shipper, {"shipper_id": shipper.user_id},
            vehicle_type="Xe may", license_plate="59-B1 12345",
            status="available", rating="4.8", total_deliveries=312)

        # Shipper profile cho customer1 (để test vai trò shipper)
        upsert(db, Shipper, {"shipper_id": customer.user_id},
            vehicle_type="Xe may", license_plate="51-A1 88888",
            status="available", rating="5.0", total_deliveries=0,
            verified_at=now)
        db.commit()

        # EXTRA SHIPPERS with various statuses
        extra_shippers = [
            ("shipper_busy@example.com",    "Ship@123", "Nguyen Van Ban",  "0907000001", "Xe may",    "51-C1 23456", "on_delivery", "4.6", 87,   "active", None),
            ("shipper_offline@example.com", "Ship@123", "Tran Thi Nghi",   "0907000002", "Xe dap",    "N/A",         "offline",     "4.2", 23,   "active", None),
            ("shipper_new@example.com",     "Ship@123", "Le Van Moi",      "0907000003", "Xe may",    "59-F1 99887", "available",   "5.0", 5,    "active", None),
            ("shipper_veteran@example.com", "Ship@123", "Pham Thi Ky Cuu", "0907000004", "O to",      "51-A1 55555", "available",   "4.9", 1250, "active", None),
            ("shipper_banned@example.com",  "Ship@123", "Vu Van Vi Pham",  "0907000005", "Xe may",    "59-K9 00001", "offline",     "1.8", 34,   "banned", "Giao hang gia, lua dao KH, bi khieu nai 5 lan"),
        ]
        extra_shipper_data = []
        for email, pw, name, phone, vehicle, plate, s_status, rating, total_del, u_status, ban_reason in extra_shippers:
            u, created = upsert(db, User, {"email": email},
                password_hash=hash_password(pw),
                full_name=name, phone=phone,
                address="TP.HCM", status=u_status)
            if not created:
                u.status = u_status
            upsert(db, UserRole,
                {"user_id": u.user_id, "role_id": roles["shipper"].role_id},
                current_role=True, assigned_by=admin.user_id, status="active")
            upsert(db, Shipper,
                {"shipper_id": u.user_id},
                vehicle_type=vehicle,
                license_plate=plate,
                status=s_status,
                rating=rating,
                total_deliveries=total_del,
                verified_at=now - timedelta(days=total_del // 10 + 1))
            extra_shipper_data.append(
                (email, pw, name, u_status, s_status, rating, total_del, ban_reason))
        db.commit()

        # WAREHOUSE MANAGER ACCOUNT
        wm_user, _ = upsert(db, User, {"email": "warehouse@example.com"},
            password_hash=hash_password("Warehouse@123"),
            full_name="Nguyen Van Kho", phone="0908000001",
            address="Kho tong HCM, 100 Nguyen Van Linh, Q7", status="active")
        # Gán role shipper (bắt buộc phải là shipper trước)
        upsert(db, UserRole,
            {"user_id": wm_user.user_id, "role_id": roles["shipper"].role_id},
            current_role=False, assigned_by=admin.user_id, status="active")
        # Gán role warehouse_manager
        upsert(db, UserRole,
            {"user_id": wm_user.user_id, "role_id": roles["warehouse_manager"].role_id},
            current_role=True, assigned_by=admin.user_id, status="active")
        # Tạo shipper profile
        upsert(db, Shipper, {"shipper_id": wm_user.user_id},
            user_id=wm_user.user_id,
            vehicle_type="truck_large", license_plate="51-WM-0001",
            status="available", rating=4.9, total_deliveries=500)
        db.commit()

        # ── WAREHOUSE CHIEF ───────────────────────────────────────────────────
        chief_user, _ = upsert(db, User, {"email": "chief@example.com"},
            password_hash=hash_password("Chief@123"),
            full_name="Trần Tổng Quản Lý", phone="0908000000",
            address="Tổng kho quốc gia, TP.HCM", status="active")
        upsert(db, UserRole,
            {"user_id": chief_user.user_id, "role_id": roles["warehouse_chief"].role_id},
            current_role=True, assigned_by=admin.user_id, status="active")
        db.commit()

        # ── WAREHOUSE HIERARCHY (2 tier1 + 4 tier2 + 8 tier3 = 14 kho) ─────
        # Tier 1 — Kho liên vùng
        wh_t1_hcm, _ = upsert(db, Warehouse, {"name": "Kho Liên vùng Miền Nam"},
            province="TP. Hồ Chí Minh", district="Bình Thạnh",
            address="123 Điện Biên Phủ, Q.Bình Thạnh, TP.HCM",
            tier=1, lat=10.8037, lng=106.7119)
        wh_t1_hn, _  = upsert(db, Warehouse, {"name": "Kho Liên vùng Miền Bắc"},
            province="Hà Nội", district="Hoàng Mai",
            address="45 Giải Phóng, Hoàng Mai, Hà Nội",
            tier=1, lat=20.9983, lng=105.8440)
        db.flush()

        # Tier 2 — Kho phân phối
        wh_t2_data = [
            ("Kho Phân phối Quận 1",   "TP. Hồ Chí Minh", "Quận 1",   "1 Lê Duẩn, Q.1, TP.HCM",          wh_t1_hcm.warehouse_id, 10.7769, 106.7009),
            ("Kho Phân phối Quận 7",   "TP. Hồ Chí Minh", "Quận 7",   "100 Nguyễn Lương Bằng, Q.7, HCM", wh_t1_hcm.warehouse_id, 10.7376, 106.7219),
            ("Kho Phân phối Hoàng Mai","Hà Nội",           "Hoàng Mai","88 Trần Điền, Hoàng Mai, Hà Nội",  wh_t1_hn.warehouse_id,  20.9831, 105.8561),
            ("Kho Phân phối Cầu Giấy", "Hà Nội",           "Cầu Giấy", "32 Xuân Thủy, Cầu Giấy, Hà Nội",  wh_t1_hn.warehouse_id,  21.0275, 105.7946),
        ]
        wh_t2_list = []
        for wname, prov, dist, addr, parent_id, lat, lng in wh_t2_data:
            w, _ = upsert(db, Warehouse, {"name": wname},
                province=prov, district=dist, address=addr,
                tier=2, parent_warehouse_id=parent_id, lat=lat, lng=lng)
            wh_t2_list.append(w)
        db.flush()
        wh_t2_q1, wh_t2_q7, wh_t2_hm, wh_t2_cg = wh_t2_list

        # Tier 3 — Kho tập kết (2 dưới mỗi tier2)
        wh_t3_data = [
            ("Kho Tập kết Bến Nghé",     "TP. Hồ Chí Minh", "Quận 1",   "Bến Nghé",    "5 Tôn Đức Thắng, Q.1",        wh_t2_q1.warehouse_id, 10.7731, 106.7056),
            ("Kho Tập kết Cầu Ông Lãnh", "TP. Hồ Chí Minh", "Quận 1",   "Cầu Ông Lãnh","12 Võ Văn Kiệt, Q.1",         wh_t2_q1.warehouse_id, 10.7583, 106.6994),
            ("Kho Tập kết Phú Mỹ Hưng",  "TP. Hồ Chí Minh", "Quận 7",   "Phú Mỹ Hưng", "68 Nguyễn Đức Cảnh, Q.7",    wh_t2_q7.warehouse_id, 10.7277, 106.7196),
            ("Kho Tập kết Tân Thuận",     "TP. Hồ Chí Minh", "Quận 7",   "Tân Thuận",   "20 Huỳnh Tấn Phát, Q.7",     wh_t2_q7.warehouse_id, 10.7234, 106.7101),
            ("Kho Tập kết Hoàng Văn Thụ","Hà Nội",           "Hoàng Mai","Hoàng Văn Thụ","3 Hoàng Văn Thụ, Hoàng Mai", wh_t2_hm.warehouse_id, 20.9867, 105.8598),
            ("Kho Tập kết Vĩnh Hưng",    "Hà Nội",           "Hoàng Mai","Vĩnh Hưng",   "15 Vĩnh Hưng, Hoàng Mai",    wh_t2_hm.warehouse_id, 20.9779, 105.8521),
            ("Kho Tập kết Quan Hoa",      "Hà Nội",           "Cầu Giấy", "Quan Hoa",    "9 Quan Hoa, Cầu Giấy",       wh_t2_cg.warehouse_id, 21.0312, 105.7923),
            ("Kho Tập kết Nghĩa Tân",     "Hà Nội",           "Cầu Giấy", "Nghĩa Tân",   "22 Nghĩa Tân, Cầu Giấy",    wh_t2_cg.warehouse_id, 21.0395, 105.7867),
        ]
        wh_t3_list = []
        for wname, prov, dist, ward, addr, parent_id, lat, lng in wh_t3_data:
            w, _ = upsert(db, Warehouse, {"name": wname},
                province=prov, district=dist, ward=ward, address=addr,
                tier=3, parent_warehouse_id=parent_id, lat=lat, lng=lng)
            wh_t3_list.append(w)
        db.flush()

        # ── TẠO ACCOUNTS CHO MANAGERS (2 tier1 + 4 tier2 + 8 tier3) ─────────
        wm_accounts = [
            # (email,                  pw,              full_name,                  phone,        warehouse, role)
            ("wm_t1_hcm@example.com",  "Wm123456",  "Nguyễn Văn Kho Nam",       "0909000001", wh_t1_hcm,  "warehouse_manager"),
            ("wm_t1_hn@example.com",   "Wm123456",  "Trần Thị Kho Bắc",         "0909000002", wh_t1_hn,   "warehouse_manager"),
            ("wm_t2_q1@example.com",   "Wm123456",  "Lê Phân Phối Quận 1",      "0909000003", wh_t2_q1,   "warehouse_manager"),
            ("wm_t2_q7@example.com",   "Wm123456",  "Phạm Phân Phối Quận 7",    "0909000004", wh_t2_q7,   "warehouse_manager"),
            ("wm_t2_hm@example.com",   "Wm123456",  "Vũ Phân Phối Hoàng Mai",   "0909000005", wh_t2_hm,   "warehouse_manager"),
            ("wm_t2_cg@example.com",   "Wm123456",  "Đỗ Phân Phối Cầu Giấy",   "0909000006", wh_t2_cg,   "warehouse_manager"),
            ("wm_t3_bn@example.com",   "Wm123456",  "Hoàng Tập Kết Bến Nghé",   "0909000007", wh_t3_list[0], "warehouse_manager"),
            ("wm_t3_col@example.com",  "Wm123456",  "Bùi Tập Kết Cầu Ông Lãnh","0909000008", wh_t3_list[1], "warehouse_manager"),
            ("wm_t3_pmh@example.com",  "Wm123456",  "Dương Tập Kết Phú Mỹ Hưng","0909000009", wh_t3_list[2], "warehouse_manager"),
            ("wm_t3_tt@example.com",   "Wm123456",  "Đinh Tập Kết Tân Thuận",  "0909000010", wh_t3_list[3], "warehouse_manager"),
            ("wm_t3_hvt@example.com",  "Wm123456",  "Cao Tập Kết Hoàng Văn Thụ","0909000011", wh_t3_list[4], "warehouse_manager"),
            ("wm_t3_vh@example.com",   "Wm123456",  "Lý Tập Kết Vĩnh Hưng",    "0909000012", wh_t3_list[5], "warehouse_manager"),
            ("wm_t3_qh@example.com",   "Wm123456",  "Mai Tập Kết Quan Hoa",     "0909000013", wh_t3_list[6], "warehouse_manager"),
            ("wm_t3_nt@example.com",   "Wm123456",  "Ngô Tập Kết Nghĩa Tân",   "0909000014", wh_t3_list[7], "warehouse_manager"),
        ]
        for email, pw, name, phone, wh_obj, role_name in wm_accounts:
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password(pw),
                full_name=name, phone=phone, status="active")
            upsert(db, UserRole,
                {"user_id": u.user_id, "role_id": roles[role_name].role_id},
                current_role=True, assigned_by=admin.user_id, status="active")
            upsert(db, WarehouseManager,
                {"manager_id": u.user_id},
                warehouse_id=wh_obj.warehouse_id)
            # cập nhật manager_id trên warehouse
            wh_obj.manager_id = u.user_id
        db.commit()

        # ── THEM 2 SHOP PHU + OWNER
        extra_owners = [
            ("owner2@example.com", "Shop@123", "Nguyen Thi Lan",  "0902222222", "Fashion Hub", "123 Le Van Sy, Q3, HCM", "4.7"),
            ("owner3@example.com", "Shop@123", "Pham Van Bookman","0902222223", "Book Corner",  "88 Dinh Tien Hoang, Q1, HCM", "4.5"),
        ]
        extra_shops = []
        for email, pw, name, phone, sname, addr, rating_val in extra_owners:
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password(pw),
                full_name=name, phone=phone, address=addr, status="active")
            upsert(db, UserRole,
                {"user_id": u.user_id, "role_id": roles["shop"].role_id},
                current_role=True, assigned_by=admin.user_id, status="active")
            s, _ = upsert(db, Shop, {"shop_id": u.user_id},
                shop_name=sname, description=f"Shop {sname}",
                address=addr, phone=phone, rating=rating_val,
                verification_status="approved", verified_at=now - timedelta(days=15))
            extra_shops.append(s)
        db.commit()
        shop2, shop3 = extra_shops[0], extra_shops[1]

        # ── SHOP WALLETS (mock balance cho demo) ─────────────────────────────
        wallet_data = [
            (shop.shop_id,  Decimal("5000000"),  Decimal("0")),    # TechWorld
            (shop2.shop_id, Decimal("3000000"),  Decimal("0")),    # Fashion Hub
            (shop3.shop_id, Decimal("1500000"),  Decimal("0")),    # Book Corner
        ]
        if shop_test_user:
            wallet_data.append((shop_test_user.user_id, Decimal("2000000"), Decimal("0")))
        for s_id, bal, res in wallet_data:
            w, created = upsert(db, ShopWallet, {"shop_id": s_id},
                balance=bal, reserved=res)
            if created:
                db.add(ShopWalletTransaction(
                    wallet_id=w.wallet_id, shop_id=s_id,
                    amount=bal, txn_type="deposit", ref_type="mock_deposit",
                    note="Số dư khởi tạo (mock)",
                ))
        db.commit()

        # THEM CATEGORIES
        for cat_name in ("Mỹ phẩm", "Gia dụng", "Thể thao", "Đồ chơi"):
            upsert(db, ProductCategory, {"category_name": cat_name})
        db.commit()
        cats = {c.category_name: c for c in db.query(ProductCategory).all()}


        _PALETTES = [
            ("dbeafe", "1d4ed8"), ("fce7f3", "9d174d"), ("dcfce7", "15803d"),
            ("fef9c3", "854d0e"), ("ede9fe", "6d28d9"), ("ffedd5", "c2410c"),
        ]

        def _imgs(label: str, n: int = 3) -> list:
            """placehold.co với text tên sản phẩm — dễ nhận diện khi demo."""
            text = label.replace(" ", "+").replace("/", "+")
            return [
                f"https://placehold.co/400x400/{_PALETTES[i % len(_PALETTES)][0]}/{_PALETTES[i % len(_PALETTES)][1]}?text={text}"
                for i in range(n)
            ]

        # PRODUCTS — TechWorld Store (Dien tu)

        tech_products = [
            ("Tai nghe Sony WH-1000XM5",  Decimal("8900000"), Decimal("6500000"), 25,  230, 4.9, "Chong on chu dong, pin 30h, ket noi Bluetooth 5.2. Am thanh Hi-Res.",  _imgs("sony-wh1000xm5")),
            ("Cap USB-C 100W",             Decimal("150000"),  Decimal("50000"),  200,  890, 4.6, "Sac nhanh 100W, ho tro PD 3.0, dai 1.5m, boc nylon ben.",             _imgs("usbc-cable-100w")),
            ("Chuot gaming Logitech G502", Decimal("1350000"), Decimal("900000"),  40,  175, 4.8, "DPI 25600, 11 nut lap trinh, trong luong tuy chinh, RGB.",            _imgs("logitech-g502")),
            ("Ban phim co Keychron K2",    Decimal("1890000"), Decimal("1200000"), 30,   88, 4.7, "Switch Gateron Brown, ket noi Bluetooth + USB-C, layout 75%.",        _imgs("keychron-k2")),
            ("Man hinh LG 27inch 4K",      Decimal("9500000"), Decimal("7000000"), 12,   42, 4.8, "IPS 4K 144Hz, HDR600, USB-C 90W, thiet ke mong, vien khung nho.",   _imgs("lg-monitor-27-4k")),
            ("Webcam Logitech C920",       Decimal("1290000"), Decimal("850000"),  35,  120, 4.5, "Full HD 1080p 30fps, micro kep, tuong thich moi nen tang.",           _imgs("logitech-c920")),
            ("Sac du phong 20000mAh",      Decimal("450000"),  Decimal("200000"), 120,  560, 4.4, "Sac nhanh 22.5W, 3 cong ra, LED bao pin, nho gon mang di.",          _imgs("powerbank-20000")),
        ]
        prods = []
        for pname, price, cost, stock, sold, rat, desc, imgs in tech_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop.shop_id, "product_name": pname},
                category_id=cats["Điện tử"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, image_urls=imgs,
                status="active", approved_at=now - timedelta(days=20))
            prods.append(p)

        # PRODUCTS — Fashion Hub (Thời trang)
        fashion_products = [
            ("Ao thun Oversize Unisex",    Decimal("280000"),  Decimal("110000"), 150,  780, 4.6, "Vai cotton 100%, form rong thoai mai, nhieu mau sac, size S-3XL.", _imgs("oversize-tshirt")),
            ("Quan jeans skinny nam",      Decimal("450000"),  Decimal("200000"),  80,  345, 4.5, "Denim cao cap, co gian 4 chieu, wash nhe, form om vua.",          _imgs("skinny-jeans")),
            ("Dam midi hoa tiet nu",       Decimal("380000"),  Decimal("150000"),  60,  210, 4.7, "Vai chiffon mem, in hoa 3D, dai midi, phu hop di choi di lam.",   _imgs("midi-floral-dress")),
            ("Ao so mi lin trang nam",     Decimal("320000"),  Decimal("130000"),  90,  430, 4.4, "Lin khong nhan, slim fit, co button-down, phu hop cong so.",      _imgs("white-linen-shirt")),
            ("Giay sneaker trang basic",   Decimal("750000"),  Decimal("380000"),  50,  198, 4.6, "De EVA chong trot, chat lieu mesh thoang khi, phong cach toi gian.", _imgs("white-sneaker")),
            ("Tui tote vai canvas",        Decimal("180000"),  Decimal("70000"),  200,  670, 4.3, "Vai canvas day, qua in sac net, quy deo vai, dung tich lon.",     _imgs("canvas-tote-bag")),
        ]
        for pname, price, cost, stock, sold, rat, desc, imgs in fashion_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop2.shop_id, "product_name": pname},
                category_id=cats["Thời trang"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, image_urls=imgs,
                status="active", approved_at=now - timedelta(days=15))
            prods.append(p)

        # PRODUCTS — Book Corner (Sách + khác)
        book_products = [
            ("Clean Code - Robert Martin",     Decimal("320000"), Decimal("180000"),  40,  156, 4.9, "Sách lập trình kinh điển về viết code sạch, dễ bảo trì và mở rộng.",      _imgs("book-clean-code")),
            ("Atomic Habits - James Clear",    Decimal("198000"), Decimal("100000"),  80,  890, 4.8, "Phương pháp xây dựng thói quen tốt, loại bỏ thói quen xấu hiệu quả.",    _imgs("book-atomic-habits")),
            ("Đắc Nhân Tâm",                   Decimal("88000"),  Decimal("40000"),  200, 1250, 4.7, "Sách kỹ năng giao tiếp bán chạy nhất mọi thời của Dale Carnegie.",         _imgs("book-dac-nhan-tam")),
            ("The Psychology of Money",        Decimal("175000"), Decimal("90000"),   60,  340, 4.8, "Cách suy nghĩ về tiền bạc và đầu tư dưới góc nhìn tâm lý học.",          _imgs("book-psych-money")),
            ("Sapiens: Lược sử loài người",    Decimal("185000"), Decimal("95000"),   70,  520, 4.6, "Hành trình 70.000 năm của loài người từ thời đồ đá đến kỷ nguyên số.",   _imgs("book-sapiens")),
        ]
        for pname, price, cost, stock, sold, rat, desc, imgs in book_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop3.shop_id, "product_name": pname},
                category_id=cats["Sách"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, image_urls=imgs,
                status="active", approved_at=now - timedelta(days=10))
            prods.append(p)
        db.commit()

        # VOUCHER -- sàn (admin) + cửa hàng (shop owners)
        voucher, _ = upsert(db, Voucher, {"code": "WELCOME10"},
            discount_type="percentage", discount_value=Decimal("10"),
            max_uses=1000, current_uses=0, status="active",
            valid_from=now - timedelta(days=1),
            valid_to=now + timedelta(days=30),
            created_by=admin.user_id)

        platform_vouchers_data = [
            ("SAN50K",   "fixed",      Decimal("50000"),  Decimal("500000"), Decimal("50000"),  500, 120, "active"),
            ("SANFREESHIP", "fixed",   Decimal("30000"),  Decimal("0"),      Decimal("30000"),  None, 0,  "active"),
            ("SAN15PT",  "percentage", Decimal("15"),     Decimal("300000"), Decimal("100000"), 200, 50, "active"),
            ("SANHETHAN", "fixed",     Decimal("20000"),  Decimal("0"),      Decimal("20000"),  100, 100, "expired"),
        ]
        for code, dtype, dval, minv, maxd, maxu, curu, status in platform_vouchers_data:
            vfrom = now - timedelta(days=5) if status == "active" else now - timedelta(days=40)
            vto = now + timedelta(days=20) if status == "active" else now - timedelta(days=10)
            upsert(db, Voucher, {"code": code},
                discount_type=dtype, discount_value=dval,
                min_order_value=minv, max_discount=maxd,
                max_uses=maxu, current_uses=curu, status=status,
                valid_from=vfrom, valid_to=vto,
                created_by=admin.user_id)

        shop_vouchers_data = [
            (shop,  "TECH10",   "percentage", Decimal("10"), Decimal("200000"), Decimal("100000"), 100, 12, "active"),
            (shop,  "TECHFREESHIP", "fixed",  Decimal("25000"), Decimal("0"),   Decimal("25000"),  50,  5,  "active"),
            (shop2, "FASHION20", "percentage", Decimal("20"), Decimal("150000"), Decimal("80000"), 80,  30, "active"),
            (shop3, "BOOK10K",  "fixed",     Decimal("10000"), Decimal("100000"), Decimal("10000"), 150, 40, "active"),
        ]
        for shop_obj, code, dtype, dval, minv, maxd, maxu, curu, status in shop_vouchers_data:
            upsert(db, Voucher, {"code": code},
                discount_type=dtype, discount_value=dval,
                min_order_value=minv, max_discount=maxd,
                max_uses=maxu, current_uses=curu, status=status,
                valid_from=now - timedelta(days=3),
                valid_to=now + timedelta(days=25),
                created_by=shop_obj.shop_id)
        db.commit()

        # VOUCHER COLLECTIONS -- customer1 đã thu thập 1 số voucher
        collected_codes = ["WELCOME10", "SAN50K", "TECH10"]
        for code in collected_codes:
            v = db.query(Voucher).filter_by(code=code).first()
            if v:
                upsert(db, VoucherCollection,
                    {"user_id": customer.user_id, "voucher_id": v.voucher_id},
                    collected_at=now - timedelta(days=2))
        db.commit()

        # ORDERS + ITEMS + PAYMENT + SHIPMENT
        ts = int(now.timestamp())
        orders_data = [
            (f"ORD-{ts}-001", [(0, 1), (1, 2)], Decimal("9200000"), Decimal("0"),     Decimal("9200000"), Decimal("30000"), "momo",         "delivered", "paid",   False),
            (f"ORD-{ts}-002", [(2, 2)],          Decimal("560000"),  Decimal("56000"), Decimal("504000"),  Decimal("25000"), "cod",          "pending",   "unpaid", True),
            (f"ORD-{ts}-003", [(3, 1)],          Decimal("320000"),  Decimal("0"),     Decimal("320000"),  Decimal("20000"), "bank_transfer", "shipped",  "paid",   False),
        ]

        for ord_num, items, total, disc, final, fee, method, ord_status, pay_status, use_vc in orders_data:
            if db.query(Order).filter_by(order_number=ord_num).first():
                continue
            o = Order(
                order_number=ord_num,
                user_id=customer.user_id,
                shop_id=shop.shop_id,
                total_price=total, discount_amount=disc,
                final_price=final, shipping_fee=fee,
                payment_method=method, payment_status=pay_status,
                order_status=ord_status,
                shipping_address=customer.address,
                recipient_name=customer.full_name,
                recipient_phone=customer.phone,
                voucher_id=voucher.voucher_id if use_vc else None,
                voucher_code="WELCOME10" if use_vc else None,
            )
            db.add(o)
            db.flush()

            for idx, qty in items:
                db.add(OrderItem(
                    order_id=o.order_id,
                    product_id=prods[idx].product_id,
                    quantity=qty,
                    price_at_order=prods[idx].price,
                    product_name=prods[idx].product_name,
                ))

            if pay_status != "unpaid":
                db.add(Payment(
                    order_id=o.order_id, amount=final,
                    method=method, status=pay_status,
                    trans_id=f"TXN-{ord_num}"))

            if ord_status in ("shipped", "delivered"):
                db.add(Shipment(
                    order_id=o.order_id,
                    shipper_id=shipper.user_id,
                    pickup_location=shop.address,
                    delivery_location=customer.address,
                    status="delivered" if ord_status == "delivered" else "in_transit",
                    pickup_time=now - timedelta(hours=6),
                    delivery_time=now - timedelta(hours=2) if ord_status == "delivered" else None,
                ))

        db.commit()

        # SUMMARY
        print("SEED DONE!\n")
        print("Core accounts:")
        for email, pw, _, _, _, role in users_data:
            print(f"  {email:<32} / {pw:<12} [{role}]")

        print("\nSimple test accounts:")
        print("  admin                            / admin        [admin]")
        print("  super                            / super        [superadmin]")
        print("  shop                             / shop         [shop]")
        print("  user1                            / user1        [customer]")

        print("\nShop employees (/shop/*):")
        for email, pw, name, position, perms in emp_users:
            print(f"  {email:<32} / {pw:<12} | {name} -- {position}")
            print(f"    Perms: {', '.join(perms)}")

        print("\nShippers (/shipper):")
        print("  shipper1@example.com             / Ship@123     | Vo Van Toc | available | 4.8* | 312")
        for email, pw, name, u_status, s_status, rating, total_del, ban_reason in extra_shipper_data:
            flag = " [BANNED]" if u_status == "banned" else ""
            print(f"  {email:<32} / {pw:<12} | {name:<22}| {u_status:<8} / {s_status:<12} | {rating}* | {total_del}{flag}")
            if ban_reason:
                print(f"    Reason: {ban_reason}")

        print("\nWarehouse Chief:")
        print("  chief@example.com                / Chief@123      [warehouse_chief]")
        print("\nWarehouse Managers (password: Wm123456) [warehouse_manager]:")
        print("  Tier 1: wm_t1_hcm@example.com  | wm_t1_hn@example.com")
        print("  Tier 2: wm_t2_q1  wm_t2_q7  wm_t2_hm  wm_t2_cg  @example.com")
        print("  Tier 3: wm_t3_bn  wm_t3_col  wm_t3_pmh  wm_t3_tt  @example.com")
        print("          wm_t3_hvt  wm_t3_vh  wm_t3_qh  wm_t3_nt  @example.com")
        print("\nShop Wallets seeded:")
        print("  TechWorld 5,000,000đ | Fashion Hub 3,000,000đ | Book Corner 1,500,000đ")
        print()

    except Exception:
        db.rollback()
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
