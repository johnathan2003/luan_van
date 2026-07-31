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
from app.models.shop import (Shop, ShopEmployee, EmployeeRolePermission,
                             SystemEmployee, SystemEmployeePermission)
from app.models.product import Product, ProductCategory
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.models.shipment import (Shipment, Shipper, ShipperRegistration,
                                 WarehouseManager, WarehouseShipper, Warehouse)
from app.models.voucher import Voucher, VoucherCollection
from app.models.admin_config import RevenueConfig


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
        "payments", "shipments", "order_items", "orders",
        "voucher_collections", "vouchers", "products", "product_categories",
        "employee_role_permissions", "shop_employees",
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
        for name in ("admin", "superadmin", "shop", "shipper", "user", "employee", "warehouse_manager"):
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
            description="Thiet bi dien tu chinh hang",
            address="42 Nguyen Hue, Q1, TP.HCM",
            phone="0902222221",
            rating="4.8",
            verification_status="approved",
            verified_at=now - timedelta(days=30))

        # Shop cho customer1 (để test vai trò shop)
        upsert(db, Shop, {"shop_id": customer.user_id},
            shop_name="Hoang An Shop",
            description="Shop da nang cua Hoang Van An",
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
                "Nguyen Thi Don Hang", "0906000001",
                "Nhan vien xu ly don hang",
                ["order:read", "order:confirm", "order:cancel"],
            ),
            (
                "emp_feedback@example.com", "Emp@123",
                "Le Van Phan Hoi", "0906000002",
                "Nhan vien xu ly phan hoi khach",
                ["message:read", "message:send", "order:read"],
            ),
            (
                "emp_chat@example.com", "Emp@123",
                "Pham Thi Tu Van", "0906000003",
                "Nhan vien tu van truc tuyen",
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

        # THEM 2 SHOP PHU + OWNER
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

        # THEM CATEGORIES
        for cat_name in ("Mỹ phẩm", "Gia dụng", "Thể thao", "Đồ chơi"):
            upsert(db, ProductCategory, {"category_name": cat_name})
        db.commit()
        cats = {c.category_name: c for c in db.query(ProductCategory).all()}

        # PRODUCTS — TechWorld Store (Điện tử)
        tech_products = [
            ("Tai nghe Sony WH-1000XM5",  Decimal("8900000"), Decimal("6500000"), 25,  230, 4.9, "Chong on chu dong, pin 30h, ket noi Bluetooth 5.2. Am thanh Hi-Res."),
            ("Cap USB-C 100W",             Decimal("150000"),  Decimal("50000"),  200,  890, 4.6, "Sac nhanh 100W, ho tro PD 3.0, dai 1.5m, boc nylon ben."),
            ("Chuot gaming Logitech G502", Decimal("1350000"), Decimal("900000"),  40,  175, 4.8, "DPI 25600, 11 nut lap trinh, trong luong tuy chinh, RGB."),
            ("Ban phim co Keychron K2",    Decimal("1890000"), Decimal("1200000"), 30,   88, 4.7, "Switch Gateron Brown, ket noi Bluetooth + USB-C, layout 75%."),
            ("Man hinh LG 27inch 4K",      Decimal("9500000"), Decimal("7000000"), 12,   42, 4.8, "IPS 4K 144Hz, HDR600, USB-C 90W, thiet ke mong, vien khung nho."),
            ("Webcam Logitech C920",       Decimal("1290000"), Decimal("850000"),  35,  120, 4.5, "Full HD 1080p 30fps, micro kep, tuong thich moi nen tang."),
            ("Sac du phong 20000mAh",      Decimal("450000"),  Decimal("200000"), 120,  560, 4.4, "Sac nhanh 22.5W, 3 cong ra, LED bao pin, nho gon mang di."),
        ]
        prods = []
        for pname, price, cost, stock, sold, rat, desc in tech_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop.shop_id, "product_name": pname},
                category_id=cats["Điện tử"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=20))
            prods.append(p)

        # PRODUCTS — Fashion Hub (Thời trang)
        fashion_products = [
            ("Ao thun Oversize Unisex",    Decimal("280000"),  Decimal("110000"), 150,  780, 4.6, "Vai cotton 100%, form rong thoai mai, nhieu mau sac, size S-3XL."),
            ("Quan jeans skinny nam",      Decimal("450000"),  Decimal("200000"),  80,  345, 4.5, "Denim cao cap, co gian 4 chieu, wash nhe, form om vua."),
            ("Dam midi hoa tiet nu",       Decimal("380000"),  Decimal("150000"),  60,  210, 4.7, "Vai chiffon mem, in hoa 3D, dai midi, phu hop di choi di lam."),
            ("Ao so mi lin trang nam",     Decimal("320000"),  Decimal("130000"),  90,  430, 4.4, "Lin khong nhan, slim fit, co button-down, phu hop cong so."),
            ("Giay sneaker trang basic",   Decimal("750000"),  Decimal("380000"),  50,  198, 4.6, "De EVA chong trot, chat lieu mesh thoang khi, phong cach toi gian."),
            ("Tui tote vai canvas",        Decimal("180000"),  Decimal("70000"),  200,  670, 4.3, "Vai canvas day, qua in sac net, quy deo vai, dung tich lon."),
        ]
        for pname, price, cost, stock, sold, rat, desc in fashion_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop2.shop_id, "product_name": pname},
                category_id=cats["Thời trang"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=15))
            prods.append(p)

        # PRODUCTS — Book Corner (Sách + khác)
        book_products = [
            ("Clean Code - Robert Martin",     Decimal("320000"), Decimal("180000"),  40,  156, 4.9, "Sách lập trình kinh điển về viết code sạch, dễ bảo trì và mở rộng."),
            ("Atomic Habits - James Clear",    Decimal("198000"), Decimal("100000"),  80,  890, 4.8, "Phuong phap xay dung thoi quen tot, loai bo thoi quen xau hieu qua."),
            ("Dac Nhan Tam",                   Decimal("88000"),  Decimal("40000"),  200, 1250, 4.7, "Sách kỹ năng giao tiếp bán chạy nhất mọi thời của Dale Carnegie."),
            ("The Psychology of Money",        Decimal("175000"), Decimal("90000"),   60,  340, 4.8, "Cach suy nghi ve tien bac va dau tu duoi goc nhin tam ly hoc."),
            ("Sapiens: Luoc su loai nguoi",    Decimal("185000"), Decimal("95000"),   70,  520, 4.6, "Hanh trinh 70000 nam cua loai nguoi tu thoi do da den ky nguyen so."),
        ]
        for pname, price, cost, stock, sold, rat, desc in book_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop3.shop_id, "product_name": pname},
                category_id=cats["Sách"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=10))
            prods.append(p)
        db.commit()

        # ═══════════════════════════════════════════════════════════════════════
        # SHOP MỚI + SẢN PHẨM ĐA DẠNG
        # 5 shop phủ: Mỹ phẩm, Thể thao, Đồ chơi, Gia dụng, Thực phẩm
        # ═══════════════════════════════════════════════════════════════════════
        new_owners_data = [
            ("owner4@example.com", "Shop@123", "Nguyen Thi Bich",  "0902222224", "Beauty & Glow",    "55 Hoang Dieu, Q4, TP.HCM",       "4.8"),
            ("owner5@example.com", "Shop@123", "Tran Van Manh",    "0902222225", "Sport Zone VN",    "77 Vo Van Tan, Q3, TP.HCM",       "4.7"),
            ("owner6@example.com", "Shop@123", "Le Thi Hong",      "0902222226", "Toy Kingdom VN",   "33 Dien Bien Phu, Binh Duong",    "4.6"),
            ("owner7@example.com", "Shop@123", "Pham Minh Duc",    "0902222227", "Kitchen & Home",   "10 Bach Dang, Q.Tan Binh, HCM",   "4.5"),
            ("owner8@example.com", "Shop@123", "Vo Thi Lan Anh",   "0902222228", "Fresh Market VN",  "200 Ly Thuong Kiet, Q10, HCM",    "4.4"),
        ]
        new_shops = []
        for email, pw, name, phone, sname, addr, rating_val in new_owners_data:
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password(pw),
                full_name=name, phone=phone, address=addr, status="active")
            upsert(db, UserRole,
                {"user_id": u.user_id, "role_id": roles["shop"].role_id},
                current_role=True, assigned_by=admin.user_id, status="active")
            s, _ = upsert(db, Shop, {"shop_id": u.user_id},
                shop_name=sname,
                description=f"{sname} - uy tin, hang chinh hang, giao nhanh toan quoc",
                address=addr, phone=phone, rating=rating_val,
                verification_status="approved",
                verified_at=now - timedelta(days=20))
            new_shops.append(s)
        db.commit()
        shop4, shop5, shop6, shop7, shop8 = new_shops

        # Bổ sung categories mới chưa có
        for cat_name in ("Thực phẩm & Đồ uống", "Sức khỏe & Làm đẹp", "Văn phòng phẩm"):
            upsert(db, ProductCategory, {"category_name": cat_name})
        db.commit()
        cats = {c.category_name: c for c in db.query(ProductCategory).all()}

        # ── MỸ PHẨM — Beauty & Glow (shop4) ─────────────────────────────────
        beauty_products = [
            ("Son moi 3CE Velvet Lip Tint",          Decimal("320000"),  Decimal("150000"),   80,  650, 4.8, "Li min, khong kho moi, giu mau 8h, 20 tone mau da dang de lua chon."),
            ("Kem chong nang Anessa SPF50+ 60ml",    Decimal("520000"),  Decimal("280000"),   60,  890, 4.9, "SPF50+ PA++++, khang nuoc, duong am, khong de lai vet trang tren da."),
            ("Serum Vitamin C 20% The Ordinary",     Decimal("380000"),  Decimal("190000"),   90,  420, 4.7, "Lam sang da, mo tham, chong oxy hoa, 30ml dung duoc khoang 2 thang."),
            ("Nuoc tay trang Bioderma 500ml",        Decimal("295000"),  Decimal("140000"),  100,  760, 4.8, "Da nhay cam, tay sach makeup, khong can nuoc, khong rat mat."),
            ("Kem duong am Cetaphil 250g",           Decimal("280000"),  Decimal("130000"),  120,  540, 4.6, "Diu nhe, khong mui, tham nhanh, dung cho toan than va mat."),
            ("Mat na dat set Innisfree 100ml",       Decimal("195000"),  Decimal("90000"),   150,  380, 4.5, "Hut sach ba nhon, thu nho lo chan long, dung 2-3 lan moi tuan."),
            ("Xit khoang Evian 150ml",               Decimal("145000"),  Decimal("60000"),   200,  920, 4.4, "Cap am tuc thi, lam min lop trang diem, dung duoc quanh mat."),
            ("Mascara Maybelline Hyper Curl",        Decimal("179000"),  Decimal("80000"),   140,  630, 4.5, "Lam cong mi, day mi, khong lem, cong thuc chong tham nuoc tot."),
            ("Phan phu Innisfree No-Sebum",          Decimal("199000"),  Decimal("95000"),   110,  480, 4.6, "Kiem soat bong nhon suot 8h, min nhu nhung, khong tac lo chan long."),
            ("Dau duong toc Moroccanoil 100ml",      Decimal("480000"),  Decimal("250000"),   50,  210, 4.8, "Phuc hoi toc hu ton, giam gay rung, mui huong dac trung thu hut."),
            ("Tay te bao chet BHA 4% CosRX",         Decimal("310000"),  Decimal("140000"),   80,  340, 4.7, "BHA 4%, lam sach sau lo chan long, tri mun dau den hieu qua."),
            ("Kem mat retinol 0.1% CeraVe",          Decimal("390000"),  Decimal("180000"),   60,  290, 4.6, "Giam quang tham, nhan mat, chua ceramide, dung duoc moi loai da."),
        ]
        for pname, price, cost, stock, sold, rat, desc in beauty_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop4.shop_id, "product_name": pname},
                category_id=cats["Mỹ phẩm"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=18))
            prods.append(p)

        # ── THỂ THAO — Sport Zone VN (shop5) ─────────────────────────────────
        sport_products = [
            ("Ta tay 5kg (doi) trang cao su",        Decimal("380000"),  Decimal("180000"),   60,  210, 4.7, "Cao su boc ngoai, tay cam chong tron, khong gi, dung cho gym tai nha."),
            ("Tham yoga TPE 6mm hai lop",            Decimal("350000"),  Decimal("160000"),   80,  460, 4.8, "Chong tron, chong am, nhe chi 1.5kg, kem day buoc va tui deo."),
            ("Day nhay thep toc do",                 Decimal("185000"),  Decimal("80000"),   150,  890, 4.6, "Day thep boc nhua, cuoi bi vong 360, dieu chinh do dai de dang."),
            ("Binh nuoc the thao Hydra 1L",          Decimal("220000"),  Decimal("95000"),   200,  670, 4.5, "Tritan khong BPA, nap lat day mot tay, danh dau vach chia ml."),
            ("Ao thun the thao Dry-Fit nam",         Decimal("180000"),  Decimal("75000"),   300, 1250, 4.4, "Vai thoat am nhanh, chong tia UV, form slim fit, 8 mau lua chon."),
            ("Giay chay bo Asics Gel-Nimbus 25",     Decimal("2850000"), Decimal("1600000"),  30,   88, 4.9, "Dem GEL tien tien, thoang khi FlyteFoam, ben bi 800km su dung."),
            ("Gang tay boxing PU 10oz",              Decimal("420000"),  Decimal("190000"),   70,  190, 4.6, "Da PU tong hop, lot vai tham mo hoi, dem long ban tay day."),
            ("Day khang luc 5 muc (bo 5 chiec)",    Decimal("285000"),  Decimal("120000"),  120,  560, 4.7, "Latex tu nhien, 5 muc luc 5-40kg, kem tui vai va huong dan bai tap."),
            ("Con lan massage co bap xop EVA",       Decimal("195000"),  Decimal("80000"),   180,  780, 4.5, "Be mat gai xoa bop, EVA cung loi trong, khong bien dang sau dung lau."),
            ("Xe dap tap the duc mini tai nha",      Decimal("3200000"), Decimal("1800000"),  12,   45, 4.7, "8 muc khang luc, man LCD, chuyen dong im lang, gap gon de cat giu."),
            ("Ao khoac chay bo windbreaker",         Decimal("480000"),  Decimal("220000"),   60,  220, 4.6, "Chan gio, nhe chi 180g, gap gon vao tui, phan quang an toan ban dem."),
            ("Bag cap tui the thao 30L",             Decimal("450000"),  Decimal("200000"),   90,  380, 4.5, "Nylon 600D chong nuoc, ngan giay rieng, dai deo co dem, 8 mau."),
        ]
        for pname, price, cost, stock, sold, rat, desc in sport_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop5.shop_id, "product_name": pname},
                category_id=cats["Thể thao"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=12))
            prods.append(p)

        # ── ĐỒ CHƠI — Toy Kingdom VN (shop6) ─────────────────────────────────
        toy_products = [
            ("LEGO Classic 11021 – 90 Years of Play", Decimal("1250000"), Decimal("700000"),  25,   88, 4.9, "Hop gach sang tao 1100 mieng, xay 9 mo hinh kinh dien, 4+ tuoi."),
            ("Xe dieu khien tu xa Drift King RC",     Decimal("680000"),  Decimal("320000"),  40,  195, 4.6, "Toc do 20km/h, drift 4 banh, pin sac USB 600mAh, tam kiem soat 30m."),
            ("Bup be Barbie Extra Fancy set",         Decimal("450000"),  Decimal("210000"),  60,  310, 4.7, "Kem 15 phu kien, toc co the tao kieu, khop linh hoat, 3+ tuoi."),
            ("Xep hinh 1000 mieng Ban do VN",         Decimal("185000"),  Decimal("80000"),  100,  430, 4.5, "Kich thuoc 50x70cm, in sac net, do khop chinh xac, hop cung dung."),
            ("Robot bien hinh Optimus Prime 30cm",    Decimal("890000"),  Decimal("420000"),  30,  120, 4.8, "Bien hinh xe tai/robot, 15 khop, den LED mat, am thanh phat, 6+ tuoi."),
            ("Dat nan Play-Doh 24 mau",               Decimal("295000"),  Decimal("130000"), 150,  870, 4.6, "Khong doc hai, khong bam tay, mem deo, co the tai su dung, 2+ tuoi."),
            ("Bo lap rap mo hinh xe dua 1:24",        Decimal("320000"),  Decimal("150000"),  55,  180, 4.5, "280 chi tiet kim loai, can tua vit, mau sac chuan ty le, 8+ tuoi."),
            ("Sung ban bong bong tu dong",            Decimal("185000"),  Decimal("75000"),  200, 1200, 4.4, "Pin AA, ban 500 bong/phut, bao gom 3 lo nuoc bong bong, 3+ tuoi."),
            ("Bo xay dung tu tinh Mag-Block 60 mong", Decimal("560000"), Decimal("270000"),  40,  160, 4.8, "Nam cham du manh, canh nhua an toan, xay mo hinh 3D, 3+ tuoi."),
            ("O to do choi chay da kim loai 1:18",   Decimal("145000"),  Decimal("60000"),  300, 1560, 4.5, "Hop kim nhom, cua mo duoc, banh cao su, son phu bong, 3+ tuoi."),
            ("Bo nau an do choi 25 mon nhua ABS",    Decimal("280000"),  Decimal("120000"),  80,  490, 4.6, "Nhua ABS an toan, day du noi/chao/muong/dia, mau pastel de thuong."),
            ("May bay dieu khien 4 canh Drone mini", Decimal("750000"),  Decimal("380000"),  35,  145, 4.5, "Kich thuoc 14cm, cam bien giua, pin 15 phut bay, toc do 3 muc."),
        ]
        for pname, price, cost, stock, sold, rat, desc in toy_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop6.shop_id, "product_name": pname},
                category_id=cats["Đồ chơi"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=14))
            prods.append(p)

        # ── GIA DỤNG — Kitchen & Home (shop7) ────────────────────────────────
        kitchen_products = [
            ("Noi chien khong dau Philips 4.1L",     Decimal("2890000"), Decimal("1700000"), 20,   95, 4.8, "Cong nghe Rapid Air, hen gio 60 phut, dieu chinh nhiet 80-200 do C."),
            ("May xay sinh to BlendJet 2 cam tay",   Decimal("850000"),  Decimal("450000"),  50,  280, 4.7, "600ml, USB-C sac lai, 22000 vong/phut, dung duoc ngay ca ngoai troi."),
            ("Bo dao lam bep 5 mon thep khong gi",   Decimal("680000"),  Decimal("320000"),  40,  175, 4.6, "Thep Duc 420J2, can go ergonomic, kem gia dung tu tinh, sac ben."),
            ("Chao chong dinh Tefal Expertise 28cm", Decimal("780000"),  Decimal("390000"),  35,  210, 4.8, "Lop phu Titanium Excellence, khong PFOA, dung duoc bep tu."),
            ("May ep cham Hurom HP Alpha",           Decimal("6500000"), Decimal("3800000"), 10,   42, 4.9, "40 vong/phut, giu enzyme, ep duoc rau la xanh, am thanh duoi 40dB."),
            ("Am dun nuoc dien Supor 1.7L giu nhiet", Decimal("420000"), Decimal("200000"),  80,  560, 4.5, "Inox 304 ben trong, giu nhiet 6h, khoa an toan, tu ngat khi soi."),
            ("Bo hop dung thuc pham thuy tinh 5 cai", Decimal("380000"), Decimal("180000"), 100,  670, 4.6, "Thuy tinh borosilicate, nap kin chiu nhiet, xep chong gon gang."),
            ("May loc khong khi Xiaomi Air Purifier 4", Decimal("2250000"), Decimal("1300000"), 25, 115, 4.8, "Loc bui PM2.5 99.97%, phu song 28m2, ket noi app, tieng on 25dB."),
            ("Noi com dien cao tan Tiger JKT-S 1.0L", Decimal("1890000"), Decimal("1100000"), 30,  98, 4.7, "IH cao tan, 7 che do nau, hen gio 24h, giu am ca ngay tiet kiem."),
            ("May danh trung cam tay 5 toc do",      Decimal("295000"),  Decimal("130000"), 120,  490, 4.4, "300W, que danh inox, nut bat nha nhanh, motor yen tinh it on."),
            ("Thot go teak 40x30cm day 3cm",         Decimal("380000"),  Decimal("180000"),  60,  240, 4.6, "Go teak tu nhien khang khuan, khong moc, co ranh hung nuoc thit."),
            ("Can dien tu nha bep 5kg/1g",           Decimal("149000"),  Decimal("60000"),  200, 1100, 4.5, "LCD ro, tinh ca can bi/tare, 5 don vi do, pin 2 AAA kem theo."),
        ]
        for pname, price, cost, stock, sold, rat, desc in kitchen_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop7.shop_id, "product_name": pname},
                category_id=cats["Gia dụng"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=16))
            prods.append(p)

        # ── THỰC PHẨM — Fresh Market VN (shop8) ──────────────────────────────
        food_cat = cats["Thực phẩm & Đồ uống"]
        food_products = [
            ("Ca phe rang xay Highlands 200g",        Decimal("98000"),  Decimal("45000"),  500, 2800, 4.7, "Blend Robusta-Arabica dac trung, rang vua, xay tho, pha phin hoac may."),
            ("Tra oolong Tu Quy tui loc 50 tui",      Decimal("85000"),  Decimal("38000"),  400, 1950, 4.6, "Tra Dai Loan oolong, huong thom tu nhien, khong duong, moi tui 2g."),
            ("Mat ong rung Tay Nguyen nguyen chat",   Decimal("280000"), Decimal("130000"), 120,  680, 4.8, "100% nguyen chat, kiem dinh ATTP, mau ho phai, do Brix 80+."),
            ("Hat dieu rang muoi W240 500g",          Decimal("195000"), Decimal("88000"),  150,  920, 4.7, "Co W240 deu hat, rang muoi vua, dong tui hut chan khong, gion thom."),
            ("Nuoc mam Phu Quoc 43 do dam 500ml",    Decimal("75000"),  Decimal("32000"),  300, 2200, 4.9, "Ca com Phu Quoc u 3 nam, 43 do N, mau canh gian, mui thom dac trung."),
            ("Banh gao Han Quoc Orion 230g",          Decimal("55000"),  Decimal("22000"),  600, 3800, 4.5, "Man vua, gion tan, 3 mui vi: goc/muc/tao bien, dong goi kin bao quan."),
            ("Yen mach can dep Quaker 1kg",           Decimal("128000"), Decimal("55000"),  250, 1400, 4.6, "Hat nguyen, khong them duong, giau beta-glucan, nau 3 phut la xong."),
            ("Sua hanh nhan Califia Farms 946ml",     Decimal("185000"), Decimal("85000"),  180,  780, 4.7, "Khong duong, khong lactose, 45 hat hanh nhan moi ly, giau canxi D."),
            ("Dau o liu extra virgin Filippo Berio",  Decimal("285000"), Decimal("135000"), 100,  490, 4.8, "Ep lanh lan dau, do axit <0.5%, chai thuy tinh 500ml, nhap tu Y."),
            ("Hat macadamia Madam Nut rang muoi 500g", Decimal("289000"), Decimal("140000"), 130,  670, 4.7, "Uc nhap khau, rang gion, tach san, tui zip tai dong, giu duoc 6 thang."),
            ("Granola hat trai cay An Vat VN 400g",   Decimal("148000"), Decimal("65000"),  200, 1100, 4.6, "Yen mach nuong mat ong, 12 loai hat-trai cay, khong chat bao quan."),
            ("Com nam rong bien Han 6 goi",           Decimal("65000"),  Decimal("25000"),  400, 2600, 4.4, "Moi goi 42g, com nam nho gon, 3 vi: goc/kim chi/wasabi the thao."),
        ]
        for pname, price, cost, stock, sold, rat, desc in food_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop8.shop_id, "product_name": pname},
                category_id=food_cat.category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=8))
            prods.append(p)

        # ── BỔ SUNG THÊM VÀO SHOP CŨ ─────────────────────────────────────────
        # TechWorld Store — thêm phụ kiện điện tử hot
        more_tech = [
            ("O cap dien thong minh WiFi Gosund",    Decimal("280000"),  Decimal("120000"),  80,  340, 4.6, "Dieu khien qua app, hen gio, theo doi dien nang, tuong thich Google/Alexa."),
            ("Den LED RGB Govee Ambient 3m",         Decimal("350000"),  Decimal("150000"),  60,  280, 4.5, "16 trieu mau, dieu khien app/giong noi, bam dinh tot, USB-A 5V."),
            ("Hub USB-C 7-in-1 Anker 552",          Decimal("680000"),  Decimal("320000"),  45,  190, 4.8, "USB-A x3, HDMI 4K, SD/microSD, PD 100W, nhom nguyen khoi ben dep."),
            ("Tai nghe TWS JBL Tune 230NC",         Decimal("1290000"), Decimal("700000"),  35,  115, 4.7, "ANC chu dong, bass JBL, 40h pin tong, sac nhanh 10 phut=1h nghe."),
            ("Ban phim khong day Logitech MX Keys", Decimal("2150000"), Decimal("1200000"), 20,   65, 4.9, "Backlit thong minh, ket noi 3 thiet bi, pin 10 ngay, typing em."),
            ("Man hinh cong Samsung 27inch FHD",    Decimal("5800000"), Decimal("3500000"), 10,   35, 4.8, "VA 144Hz 1ms, HDR10, FreeSync, USB hub, co loa tich hop 5W."),
            ("Loa Bluetooth JBL Flip 6",            Decimal("2350000"), Decimal("1350000"), 25,   98, 4.9, "IP67 chong nuoc, 12h pin, PartyBoost 2 loa, bass manh me sac net."),
            ("Camera IP Xiaomi C400 4MP WiFi",      Decimal("650000"),  Decimal("300000"),  50,  210, 4.7, "4MP Full Color Night, xoay 360, AI phat hien nguoi, luu the nho."),
        ]
        for pname, price, cost, stock, sold, rat, desc in more_tech:
            p, _ = upsert(db, Product,
                {"shop_id": shop.shop_id, "product_name": pname},
                category_id=cats["Điện tử"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=25))
            prods.append(p)

        # Fashion Hub — thêm phụ kiện & giày dép
        more_fashion = [
            ("Mu bucket tai beo unisex cotton",      Decimal("120000"),  Decimal("45000"),  300, 1580, 4.4, "Vai cotton canvas, 2 lop, 6 mau, gap gon bo tui, size free."),
            ("Kinh mat chong UV400 aviator",         Decimal("250000"),  Decimal("100000"), 150,  680, 4.6, "Gong kim loai, trong phan cuc, kem hop + khan lau, unisex."),
            ("Day nit da bo tu dong 3.5cm",          Decimal("350000"),  Decimal("150000"),  80,  290, 4.5, "Da bo that, khoa tu dong hop kim kem, khac logo tinh te sang trong."),
            ("Tui deo cheo mini canvas 3 ngan",     Decimal("280000"),  Decimal("110000"), 120,  870, 4.6, "Vai canvas day, day deo dieu chinh, 3 ngan zip, 4 mau trendy."),
            ("Ao hoodie ni bong form rong unisex",  Decimal("420000"),  Decimal("185000"), 100,  560, 4.7, "Ni bong 330g, co mu va tui kangaroo, giu am tot, size S-2XL."),
            ("Dep slides nhua EVA thoai mai",       Decimal("180000"),  Decimal("70000"),  200,  980, 4.3, "De EVA mem, quy dep dieu chinh, khong mui, chong trot, 6 mau."),
            ("Tat cotton khang khuan 5 doi",        Decimal("95000"),   Decimal("38000"),  400, 2200, 4.4, "Cotton 80%, khang khuan, khong len long, coc chuyen biet, co S-L."),
        ]
        for pname, price, cost, stock, sold, rat, desc in more_fashion:
            p, _ = upsert(db, Product,
                {"shop_id": shop2.shop_id, "product_name": pname},
                category_id=cats["Thời trang"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=11))
            prods.append(p)

        # Book Corner — thêm sách + văn phòng phẩm
        more_books = [
            ("Thinking Fast and Slow - Kahneman",    Decimal("189000"),  Decimal("95000"),   60,  310, 4.8, "He thong tu duy 1 va 2, ly giai cac quyet dinh bat hop ly cua con nguoi."),
            ("Zero to One - Peter Thiel",            Decimal("175000"),  Decimal("88000"),   70,  280, 4.7, "Cam nang startup tu nguoi sang lap PayPal, lam sao xay dung dieu moi."),
            ("Rich Dad Poor Dad - Kiyosaki",         Decimal("118000"),  Decimal("52000"),  150,  980, 4.6, "Bai hoc tai chinh tu hai nguoi cha, tu duy cua nguoi giau so voi ngheo."),
            ("Bo but mau Stabilo 36 mau",            Decimal("285000"),  Decimal("120000"), 100,  560, 4.7, "But mau nuoc, ngan hon hop nhom, ngoi be khong bai mau, khong doc hai."),
            ("So tay Leuchtturm1917 A5 dotted",     Decimal("320000"),  Decimal("140000"),  80,  340, 4.6, "240 trang, danh so trang, muc luc, bia cung, giay 80g khong thau muc."),
            ("But bi Pilot G2 07 hop 12 cai",       Decimal("145000"),  Decimal("58000"),  250,  890, 4.8, "Mut gel, net su 0.7mm, sua duoc bang tay, troi bit 400m, mau den."),
        ]
        for pname, price, cost, stock, sold, rat, desc in more_books:
            p, _ = upsert(db, Product,
                {"shop_id": shop3.shop_id, "product_name": pname},
                category_id=cats["Sách"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=9))
            prods.append(p)

        db.commit()
        print(f"  → Tong san pham: {len(prods)} san pham tu 8 shop")

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

        # ── SHIPPER REGISTRATIONS ────────────────────────────────────────────
        reg_data = [
            ("reg_pending1@test.com", "Le Van Nhanh",     "0911000001", "Xe may",   "59-A1 11111", "zone",           "Hồ Chí Minh", "pending",  None,                      None),
            ("reg_pending2@test.com", "Nguyen Thi Hanh",  "0911000002", "Xe may",   "51-B2 22222", "inter_province", "Hà Nội",       "pending",  None,                      None),
            ("reg_pending3@test.com", "Tran Van Chay",    "0911000003", "O to tai", "51-C3 33333", "inter_province", "Hà Nội",       "pending",  None,                      None),
            ("reg_pending4@test.com", "Pham Minh Kiet",   "0911000004", "Xe may",   "59-D4 44444", "zone",           "Hồ Chí Minh", "pending",  None,                      None),
            ("reg_pending5@test.com", "Vo Thi Bay",       "0911000005", "Xe dap",   "N/A",         "zone",           "Hồ Chí Minh", "pending",  None,                      None),
            ("reg_approved1@test.com","Bui Van Duyet",    "0911000006", "Xe may",   "59-E5 55555", "zone",           "Hồ Chí Minh", "approved", None,                      now - timedelta(days=3)),
            ("reg_approved2@test.com","Hoang Thi Chap",   "0911000007", "O to tai", "51-F6 66666", "inter_province", "Hà Nội",       "approved", None,                      now - timedelta(days=7)),
            ("reg_reject1@test.com",  "Nguyen Van Loi",   "0911000008", "Xe may",   "59-G7 77777", "zone",           "Hồ Chí Minh", "rejected", "Ảnh CCCD không rõ nét",   now - timedelta(days=2)),
            ("reg_reject2@test.com",  "Tran Thi Gian",    "0911000009", "Xe may",   "N/A",         "zone",           "Hồ Chí Minh", "rejected", "Giấy tờ không hợp lệ",    now - timedelta(days=5)),
        ]
        conn = db.connection()
        for email, name, phone, vehicle, plate, stype, zone, status, reject_reason, reviewed_at in reg_data:
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password("Test@1234"),
                full_name=name, phone=phone, status="active")
            db.flush()
            exists = conn.execute(text(
                "SELECT 1 FROM shipper_registrations WHERE user_id = :uid"
            ), {"uid": u.user_id}).first()
            if not exists:
                conn.execute(text("""
                    INSERT INTO shipper_registrations
                        (user_id, vehicle_type, license_plate, shipper_type, zone_province,
                         license_url, registration_url, id_card_url,
                         status, rejection_reason, reviewed_by, reviewed_at, created_at)
                    VALUES
                        (:uid, :vehicle, :plate, :stype, :zone,
                         'https://placehold.co/600x400?text=Bang+lai+xe',
                         'https://placehold.co/600x400?text=Dang+ky+xe',
                         'https://placehold.co/600x400?text=CCCD',
                         :status, :reason, :reviewed_by, :reviewed_at, :created_at)
                """), {
                    "uid": u.user_id, "vehicle": vehicle, "plate": plate,
                    "stype": stype, "zone": zone, "status": status,
                    "reason": reject_reason,
                    "reviewed_by": admin.user_id if reviewed_at else None,
                    "reviewed_at": reviewed_at,
                    "created_at": now - timedelta(days=7),
                })
            if status == "approved":
                upsert(db, UserRole,
                    {"user_id": u.user_id, "role_id": roles["shipper"].role_id},
                    current_role=True, assigned_by=admin.user_id, status="active")
                conn.execute(text("""
                    INSERT INTO shippers (shipper_id, vehicle_type, license_plate, shipper_type,
                                         zone_province, status, rating, total_deliveries, verified_at)
                    VALUES (:sid, :vehicle, :plate, :stype, :zone, 'available', '5.0', 0, :verified_at)
                    ON CONFLICT (shipper_id) DO NOTHING
                """), {
                    "sid": u.user_id, "vehicle": vehicle, "plate": plate,
                    "stype": stype, "zone": zone, "verified_at": reviewed_at,
                })
        db.commit()

        # ── SYSTEM EMPLOYEES ─────────────────────────────────────────────────
        PERM_META = {
            "order_confirm":   "admin", "refund_manage":  "admin",
            "product_manage":  "admin", "dispute_manage": "admin",
            "report_view":     "admin", "voucher_manage": "admin",
            "shipper_support": "admin", "shipper_approve":"admin",
        }
        sys_emp_data = [
            ("sysemp1@test.com", "Nguyen Van Duyet",    ["order_confirm", "refund_manage", "dispute_manage"]),
            ("sysemp2@test.com", "Tran Thi San Pham",   ["product_manage", "report_view", "voucher_manage"]),
            ("sysemp3@test.com", "Le Van Shipper",      ["shipper_support", "shipper_approve"]),
            ("sysemp4@test.com", "Pham Thi Toan Quyen", list(PERM_META.keys())),
            ("sysemp5@test.com", "Vo Van Bao Cao",      ["report_view"]),
        ]
        for email, name, perm_list in sys_emp_data:
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password("Test@1234"),
                full_name=name, status="active")
            db.flush()
            emp = db.query(SystemEmployee).filter_by(user_id=u.user_id).first()
            if not emp:
                emp = SystemEmployee(user_id=u.user_id, emp_name=name,
                    role_name="system_employee", status="active", created_by=admin.user_id)
                db.add(emp)
                db.flush()
                for pcode in perm_list:
                    db.add(SystemEmployeePermission(
                        emp_id=emp.emp_id, permission_code=pcode,
                        scope=PERM_META[pcode], granted_by=admin.user_id))
        db.commit()

        # ── WAREHOUSE MANAGERS ───────────────────────────────────────────────
        TIER_ROLES = {1: "warehouse_hub_manager", 2: "warehouse_district_manager", 3: "warehouse_ward_manager"}
        for rname in TIER_ROLES.values():
            upsert(db, Role, {"role_name": rname})
        db.commit()
        roles = {r.role_name: r for r in db.query(Role).all()}

        warehouses_by_tier: dict[int, list] = {1: [], 2: [], 3: []}
        for w in db.query(Warehouse).filter_by(is_active=True).all():
            if w.tier in warehouses_by_tier:
                warehouses_by_tier[w.tier].append(w)

        wm_accounts = [
            ("wm_hub1@test.com",  "Tran Van Hub HCM",  1),
            ("wm_hub2@test.com",  "Nguyen Thi Hub HN", 1),
            ("wm_dist1@test.com", "Le Van Quan 1",     2),
            ("wm_dist2@test.com", "Pham Van Binh Thu", 2),
            ("wm_dist3@test.com", "Vo Thi Tan Binh",   2),
            ("wm_ward1@test.com", "Bui Van Phuong 1",  3),
            ("wm_ward2@test.com", "Hoang Thi P.2",     3),
            ("wm_ward3@test.com", "Dao Van Phuong 3",  3),
            ("wm_ward4@test.com", "Ly Thi P.4",        3),
        ]
        tier_idx: dict[int, int] = {1: 0, 2: 0, 3: 0}
        for i, (email, name, tier) in enumerate(wm_accounts):
            tier_whs = warehouses_by_tier.get(tier, [])
            idx = tier_idx[tier]
            if idx >= len(tier_whs):
                continue
            wh = tier_whs[idx]
            tier_idx[tier] += 1
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password("Test@1234"),
                full_name=name, status="active", phone=f"0913{i:06d}")
            db.flush()
            rname = TIER_ROLES[tier]
            upsert(db, UserRole,
                {"user_id": u.user_id, "role_id": roles[rname].role_id},
                current_role=True, assigned_by=admin.user_id, status="active")
            upsert(db, Shipper, {"shipper_id": u.user_id},
                vehicle_type="truck_large", license_plate=f"51-WM-{i+10:04d}",
                status="available", rating="5.0", total_deliveries=0)
            upsert(db, WarehouseManager, {"manager_id": u.user_id},
                warehouse_id=wh.warehouse_id)
        db.commit()

        # ── WAREHOUSE SHIPPERS (username = password) ─────────────────────────
        # Shipper gắn với từng cấp kho; password = phần trước @ của email
        hub_shipper_accounts = [
            ("hubhcm@kho.test",    "Nguyen Van Xe HCM",       "truck_large", "51-TL-0001"),
            ("hubhn@kho.test",     "Tran Van Xe HN",           "truck_large", "29-TL-0001"),
        ]
        dist_shipper_accounts = [
            ("distship1@kho.test", "Le Van Phat Quan 1",       "van",         "51-VN-0001"),
            ("distship2@kho.test", "Pham Thi Phat Quan 3",     "van",         "51-VN-0002"),
            ("distship3@kho.test", "Vo Van Phat Binh Tan",     "van",         "51-VN-0003"),
        ]
        ward_shipper_accounts = [
            ("wardship1@kho.test", "Bui Van Nhanh Phuong 1",  "motorbike",   "51-WR-0001"),
            ("wardship2@kho.test", "Hoang Thi Nhanh Phuong 2","motorbike",   "51-WR-0002"),
            ("wardship3@kho.test", "Dao Van Nhanh Phuong 3",  "motorbike",   "51-WR-0003"),
            ("wardship4@kho.test", "Ly Thi Nhanh Phuong 4",   "motorbike",   "51-WR-0004"),
        ]

        shipper_role = roles.get("shipper")
        wh_ctr = 0
        for tier, accs in [(1, hub_shipper_accounts),
                           (2, dist_shipper_accounts),
                           (3, ward_shipper_accounts)]:
            tier_whs = warehouses_by_tier.get(tier, [])
            for i, (email, name, vtype, plate) in enumerate(accs):
                pw = email.split("@")[0]          # username = password
                u, _ = upsert(db, User, {"email": email},
                    password_hash=hash_password(pw),
                    full_name=name, status="active",
                    phone=f"0919{wh_ctr:06d}")
                db.flush()
                if shipper_role:
                    upsert(db, UserRole,
                        {"user_id": u.user_id, "role_id": shipper_role.role_id},
                        current_role=True, assigned_by=admin.user_id, status="active")
                upsert(db, Shipper, {"shipper_id": u.user_id},
                    vehicle_type=vtype, license_plate=plate,
                    status="available", rating="4.5", total_deliveries=0)
                if tier_whs:
                    wh = tier_whs[i % len(tier_whs)]
                    upsert(db, WarehouseShipper,
                        {"warehouse_id": wh.warehouse_id, "shipper_id": u.user_id},
                        assigned_by=admin.user_id, status="active")
                wh_ctr += 1
        db.commit()

        # Nhân viên kho (staff) — tài khoản thường, không phải shipper
        staff_kho_accounts = [
            ("nvkhohcm@kho.test", "Nguyen Thi Nhan Vien HCM",   1),
            ("nvkhohn@kho.test",  "Tran Van Nhan Vien HN",       1),
            ("nvdist1@kho.test",  "Le Thi Nhan Vien Quan",       2),
            ("nvward1@kho.test",  "Pham Van Nhan Vien Phuong",   3),
        ]
        user_role_obj = roles.get("user")
        for i, (email, name, _tier) in enumerate(staff_kho_accounts):
            pw = email.split("@")[0]
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password(pw),
                full_name=name, status="active",
                phone=f"0921{i:06d}")
            db.flush()
            if user_role_obj:
                upsert(db, UserRole,
                    {"user_id": u.user_id, "role_id": user_role_obj.role_id},
                    current_role=True, assigned_by=admin.user_id, status="active")
        db.commit()

        # ── WAREHOUSE ADMIN SUB-ACCOUNTS (multi-level created_by chain) ─────────
        #
        # Cây uỷ quyền (khác shop — shop flat 1 cấp, kho N cấp):
        #   admin (root)
        #     └─ adminkho@kho.test      [NV quản lý mảng kho]   created_by=admin
        #           ├─ adminkhohub@kho.test   [cấp 1 hub]        created_by=adminkho
        #           ├─ adminkhodist@kho.test  [cấp 2 district]   created_by=adminkho
        #           └─ adminkhoward@kho.test  [cấp 3 ward/leaf]  created_by=adminkho
        #
        # Admin thấy toàn bộ cây; adminkho thấy cây con của mình.
        # Tất cả: username = password (dễ nhớ)
        WH_PERM_META = {
            "warehouse_create_hub":      "admin",
            "warehouse_create_district": "admin",
            "warehouse_create_ward":     "admin",
        }

        def _make_wh_emp(email, name, perm_list, created_by_id, granted_by_id):
            pw = email.split("@")[0]
            u, _ = upsert(db, User, {"email": email},
                password_hash=hash_password(pw),
                full_name=name, status="active")
            db.flush()
            emp = db.query(SystemEmployee).filter_by(user_id=u.user_id).first()
            if not emp:
                emp = SystemEmployee(user_id=u.user_id, emp_name=name,
                    role_name="warehouse_admin", status="active",
                    created_by=created_by_id)
                db.add(emp)
                db.flush()
                for pcode in perm_list:
                    db.add(SystemEmployeePermission(
                        emp_id=emp.emp_id, permission_code=pcode,
                        scope=WH_PERM_META[pcode], granted_by=granted_by_id))
            return u

        # Pass 1: NV quản lý mảng kho — do admin tạo
        adminkho_user = _make_wh_emp(
            "adminkho@kho.test", "NV Quan Ly Mang Kho",
            ["warehouse_create_hub", "warehouse_create_district", "warehouse_create_ward"],
            created_by_id=admin.user_id, granted_by_id=admin.user_id,
        )
        db.flush()

        # Pass 2: Cấp dưới — do adminkho tạo (created_by = adminkho, KHÔNG phải admin)
        _make_wh_emp(
            "adminkhohub@kho.test", "Quan Ly Kho Cap 1 Hub",
            ["warehouse_create_hub", "warehouse_create_district", "warehouse_create_ward"],
            created_by_id=adminkho_user.user_id, granted_by_id=adminkho_user.user_id,
        )
        _make_wh_emp(
            "adminkhodist@kho.test", "Quan Ly Kho Cap 2 District",
            ["warehouse_create_district", "warehouse_create_ward"],
            created_by_id=adminkho_user.user_id, granted_by_id=adminkho_user.user_id,
        )
        _make_wh_emp(
            "adminkhoward@kho.test", "Quan Ly Kho Cap 3 Ward",
            [],  # leaf — không tạo thêm
            created_by_id=adminkho_user.user_id, granted_by_id=adminkho_user.user_id,
        )
        db.commit()

        # ── SHIPMENTS VỚI PKG DIMENSIONS ─────────────────────────────────────
        # (length, width, height, weight_kg, tier, extra_fee)
        pkg_samples = [
            (15.0, 10.0,  8.0,   0.5,  1,      0),
            (18.0, 12.0,  9.0,   0.8,  1,      0),
            (30.0, 22.0, 18.0,   2.0,  2,  15000),
            (33.0, 24.0, 19.0,   2.8,  2,  15000),
            (45.0, 35.0, 28.0,   5.5,  3,  25000),
            (48.0, 38.0, 29.0,   6.8,  3,  25000),
            (65.0, 50.0, 40.0,  12.0,  4,  50000),
            (68.0, 52.0, 43.0,  14.5,  4,  50000),
            (90.0, 75.0, 55.0,  25.0,  5, 100000),
            (95.0, 78.0, 58.0,  28.0,  5, 100000),
            (110.0,90.0, 70.0,  35.0,  6, 200000),
        ]
        for i, s in enumerate(db.query(Shipment).all()):
            if s.size_tier is None:
                l, w, h, k, t, f = pkg_samples[i % len(pkg_samples)]
                s.pkg_length_cm = l; s.pkg_width_cm = w
                s.pkg_height_cm = h; s.pkg_weight_kg = k
                s.size_tier = t;     s.extra_fee = f
        db.commit()

        # ── REVENUE CONFIG HISTORY ───────────────────────────────────────────
        for shop_r, admin_r, ship_r, vat_r, note, days_ago in [
            (Decimal("65"), Decimal("20"), Decimal("5"), Decimal("10"), "Cấu hình khi ra mắt",            90),
            (Decimal("68"), Decimal("17"), Decimal("5"), Decimal("10"), "Tăng tỷ lệ shop để thu hút merchant", 60),
            (Decimal("70"), Decimal("15"), Decimal("5"), Decimal("10"), "Điều chỉnh về mức ổn định",      30),
        ]:
            if not db.query(RevenueConfig).filter_by(shop_rate=shop_r, admin_rate=admin_r, is_active=False).first():
                db.add(RevenueConfig(
                    shop_rate=shop_r, admin_rate=admin_r,
                    shipper_rate=ship_r, vat_rate=vat_r,
                    is_active=False, changed_by=admin.user_id,
                    changed_at=now - timedelta(days=days_ago), note=note))
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

        print("\nWarehouse Manager (/warehouse):")
        print("  warehouse@example.com            / Warehouse@123  [warehouse_manager]")

        print("\nĐơn đăng ký shipper (Test@1234):")
        print("  reg_pending1-5@test.com    → pending  (5 đơn)")
        print("  reg_approved1-2@test.com   → approved (2 đơn)")
        print("  reg_reject1-2@test.com     → rejected (2 đơn)")

        print("\nNhân viên hệ thống (Test@1234):")
        print("  sysemp1@test.com  → order_confirm, refund_manage, dispute_manage")
        print("  sysemp2@test.com  → product_manage, report_view, voucher_manage")
        print("  sysemp3@test.com  → shipper_support, shipper_approve")
        print("  sysemp4@test.com  → ALL 8 quyền")
        print("  sysemp5@test.com  → report_view")

        print("\nQuản lý kho (Test@1234):")
        print("  wm_hub1-2@test.com   → Hub manager (tier 1)")
        print("  wm_dist1-3@test.com  → District manager (tier 2)")
        print("  wm_ward1-4@test.com  → Ward manager (tier 3)")

        print("\nShipper kho (username = password):")
        print("  Kho tổng (tier 1 — xe tải):")
        print("    hubhcm@kho.test    / hubhcm")
        print("    hubhn@kho.test     / hubhn")
        print("  Kho quận (tier 2 — van):")
        print("    distship1@kho.test / distship1")
        print("    distship2@kho.test / distship2")
        print("    distship3@kho.test / distship3")
        print("  Kho phường (tier 3 — xe máy):")
        print("    wardship1@kho.test / wardship1")
        print("    wardship2@kho.test / wardship2")
        print("    wardship3@kho.test / wardship3")
        print("    wardship4@kho.test / wardship4")

        print("\nNhân viên kho (username = password):")
        print("  nvkhohcm@kho.test  / nvkhohcm  | Nhân viên kho tổng HCM")
        print("  nvkhohn@kho.test   / nvkhohn   | Nhân viên kho tổng HN")
        print("  nvdist1@kho.test   / nvdist1   | Nhân viên kho quận")
        print("  nvward1@kho.test   / nvward1   | Nhân viên kho phường")

        print("\nAdmin phụ trách kho (do admin tạo, username = password):")
        print("  adminkho@kho.test     / adminkho     → quyền TẤT CẢ 3 cấp")
        print("  adminkhohub@kho.test  / adminkhohub  → chỉ tạo tài khoản tier 1 (hub)")
        print("  adminkhodist@kho.test / adminkhodist → chỉ tạo tài khoản tier 2 (district)")
        print("  adminkhoward@kho.test / adminkhoward → chỉ tạo tài khoản tier 3 (ward)")

        print("\nShop moi (Shop@123):")
        for email, pw, name, phone, sname, addr, _ in new_owners_data:
            print(f"  {email:<32} / {pw:<12} | {sname} — {addr}")

        print("\nShipments: đã seed kích thước bậc 1–6 cho tất cả đơn vận chuyển")
        print("Revenue config: 3 bản ghi lịch sử thay đổi tỷ lệ")
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
