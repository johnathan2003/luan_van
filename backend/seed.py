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
from app.models.user import User, Role, UserRole
from app.models.shop import Shop, ShopEmployee, EmployeeRolePermission
from app.models.product import Product, ProductCategory
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.models.shipment import Shipment, Shipper
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
        for name in ("admin", "shop", "shipper", "customer", "employee"):
            upsert(db, Role, {"role_name": name})
        db.commit()
        roles = {r.role_name: r for r in db.query(Role).all()}

        # USERS
        users_data = [
            ("admin@example.com",     "Admin@123", "Admin User",     "0901111111", "15 Le Loi, Q1, HCM",    "admin"),
            ("owner@example.com",     "Shop@123",  "Tran Van Minh",  "0902222221", "42 Nguyen Hue, Q1, HCM", "shop"),
            ("shipper1@example.com",  "Ship@123",  "Vo Van Toc",     "0904444441", "11 Truong Chinh, HCM",   "shipper"),
            ("customer1@example.com", "User@123",  "Hoang Van An",   "0905555551", "99 CMT8, Q3, HCM",       "customer"),
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
        customer = users["customer"]

        for u, role_name in [
            (admin, "admin"), (owner, "shop"),
            (shipper, "shipper"), (customer, "customer"),
        ]:
            upsert(db, UserRole,
                {"user_id": u.user_id, "role_id": roles[role_name].role_id},
                current_role=True, assigned_by=admin.user_id, status="active")

        # customer1 có đủ 5 quyền để test toàn bộ hệ thống
        for rn in ("admin", "shop", "shipper", "customer", "employee"):
            upsert(db, UserRole,
                {"user_id": customer.user_id, "role_id": roles[rn].role_id},
                current_role=(rn == "customer"), assigned_by=admin.user_id, status="active")
        db.commit()

        # CATEGORIES
        for cat_name in ("Dien tu", "Thoi trang", "Sach"):
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
        for cat_name in ("My pham", "Gia dung", "The thao", "Do choi"):
            upsert(db, ProductCategory, {"category_name": cat_name})
        db.commit()
        cats = {c.category_name: c for c in db.query(ProductCategory).all()}

        # PRODUCTS — TechWorld Store (Dien tu)
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
                category_id=cats["Dien tu"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=20))
            prods.append(p)

        # PRODUCTS — Fashion Hub (Thoi trang)
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
                category_id=cats["Thoi trang"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=15))
            prods.append(p)

        # PRODUCTS — Book Corner (Sach + khac)
        book_products = [
            ("Clean Code - Robert Martin",     Decimal("320000"), Decimal("180000"),  40,  156, 4.9, "Sach lap trinh kinh dien ve viet code sach, de bao tri va mo rong."),
            ("Atomic Habits - James Clear",    Decimal("198000"), Decimal("100000"),  80,  890, 4.8, "Phuong phap xay dung thoi quen tot, loai bo thoi quen xau hieu qua."),
            ("Dac Nhan Tam",                   Decimal("88000"),  Decimal("40000"),  200, 1250, 4.7, "Sach ky nang giao tiep ban chay nhat moi thoi cua Dale Carnegie."),
            ("The Psychology of Money",        Decimal("175000"), Decimal("90000"),   60,  340, 4.8, "Cach suy nghi ve tien bac va dau tu duoi goc nhin tam ly hoc."),
            ("Sapiens: Luoc su loai nguoi",    Decimal("185000"), Decimal("95000"),   70,  520, 4.6, "Hanh trinh 70000 nam cua loai nguoi tu thoi do da den ky nguyen so."),
        ]
        for pname, price, cost, stock, sold, rat, desc in book_products:
            p, _ = upsert(db, Product,
                {"shop_id": shop3.shop_id, "product_name": pname},
                category_id=cats["Sach"].category_id,
                price=price, cost=cost, stock_quantity=stock,
                sales_count=sold, rating=str(rat), total_reviews=int(sold // 4),
                description=desc, status="active", approved_at=now - timedelta(days=10))
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

        print("\nShop employees (/shop/*):")
        for email, pw, name, position, perms in emp_users:
            print(f"  {email:<32} / {pw:<12} | {name} -- {position}")
            print(f"    Perms: {', '.join(perms)}")

        print("\nShippers (/shipper):")
        print(f"  {'shipper1@example.com':<32} / {'Ship@123':<12} | Vo Van Toc          | active  / available   | 4.8* | 312")
        for email, pw, name, u_status, s_status, rating, total_del, ban_reason in extra_shipper_data:
            flag = " [BANNED]" if u_status == "banned" else ""
            print(f"  {email:<32} / {pw:<12} | {name:<22}| {u_status:<8} / {s_status:<12} | {rating}* | {total_del}{flag}")
            if ban_reason:
                print(f"    Reason: {ban_reason}")
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
