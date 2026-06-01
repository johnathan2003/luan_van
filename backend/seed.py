"""
seed.py — Tạo dữ liệu mẫu cho database (thay thế seed.ts)
Chạy: python seed.py
"""
import os
import sys
from datetime import datetime, date
from decimal import Decimal

from dotenv import load_dotenv

# Load .env trước khi import app
load_dotenv()

# Đảm bảo DIRECT_URL được ưu tiên cho seed (bypass pgbouncer)
direct_url = os.getenv("DIRECT_URL")
if direct_url:
    os.environ["DATABASE_URL_OVERRIDE"] = direct_url

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from passlib.context import CryptContext

from app.models.user import User, Role, UserRole, Permission, RolePermission
from app.models.shop import Shop, ShopRegistration
from app.models.product import Product, ProductCategory, ProductVariant, ProductReview
from app.models.order import Order, OrderItem
from app.models.payment import Payment
from app.models.shipment import Shipment, Shipper
from app.models.notification import Notification
from app.models.voucher import Voucher

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def get_engine():
    url = os.getenv("DIRECT_URL") or os.getenv("DATABASE_URL")
    # Đảm bảo dùng psycopg2 driver
    if url and url.startswith("postgresql://"):
        url = url.replace("postgresql://", "postgresql+psycopg2://", 1)
    if url and "pgbouncer=true" in url:
        # Xóa pgbouncer param cho direct connection
        url = url.replace("?pgbouncer=true", "").replace("&pgbouncer=true", "")
    return create_engine(url, echo=False)


def seed():
    engine = get_engine()
    Session = sessionmaker(bind=engine)
    db = Session()

    print("🌱 Bắt đầu seed dữ liệu...\n")

    try:
        # ================================================================
        # 1. ROLES
        # ================================================================
        print("📝 Tạo Roles...")
        roles_data = [
            {"role_name": "ADMIN",      "description": "Administrator"},
            {"role_name": "SHOP_OWNER", "description": "Shop Owner"},
            {"role_name": "EMPLOYEE",   "description": "Shop Employee"},
            {"role_name": "SHIPPER",    "description": "Shipper"},
            {"role_name": "CUSTOMER",   "description": "Regular Customer"},
        ]
        roles = {}
        for r in roles_data:
            existing = db.query(Role).filter_by(role_name=r["role_name"]).first()
            if not existing:
                obj = Role(**r)
                db.add(obj)
                db.flush()
                roles[r["role_name"]] = obj
            else:
                roles[r["role_name"]] = existing
        db.commit()
        print(f"  ✅ {len(roles_data)} roles")

        # ================================================================
        # 2. PERMISSIONS
        # ================================================================
        print("🔐 Tạo Permissions...")
        perms_data = [
            {"permission_code": "CREATE_PRODUCT", "description": "Create product",  "category": "PRODUCT"},
            {"permission_code": "EDIT_PRODUCT",   "description": "Edit product",    "category": "PRODUCT"},
            {"permission_code": "DELETE_PRODUCT", "description": "Delete product",  "category": "PRODUCT"},
            {"permission_code": "VIEW_ORDERS",    "description": "View orders",     "category": "ORDER"},
            {"permission_code": "MANAGE_USERS",   "description": "Manage users",    "category": "USER"},
            {"permission_code": "MANAGE_SHOPS",   "description": "Manage shops",    "category": "SHOP"},
            {"permission_code": "MANAGE_PAYMENTS","description": "Manage payments", "category": "PAYMENT"},
            {"permission_code": "VIEW_ANALYTICS", "description": "View analytics",  "category": "ANALYTICS"},
        ]
        for p in perms_data:
            if not db.query(Permission).filter_by(permission_code=p["permission_code"]).first():
                db.add(Permission(**p))
        db.commit()
        print(f"  ✅ {len(perms_data)} permissions")

        # ================================================================
        # 3. USERS
        # ================================================================
        print("👥 Tạo Users...")
        users_data = [
            {"email": "admin@example.com",     "password": "Admin@123",    "full_name": "Admin User",    "phone": "0123456789", "address": "123 Admin Street"},
            {"email": "owner1@shop.com",        "password": "Owner@123",    "full_name": "Shop Owner 1",  "phone": "0987654321", "address": "456 Shop Street"},
            {"email": "owner2@shop.com",        "password": "Owner@123",    "full_name": "Shop Owner 2",  "phone": "0912345678", "address": "789 Shop Avenue"},
            {"email": "shipper1@example.com",   "password": "Shipper@123",  "full_name": "Shipper 1",     "phone": "0901234567", "address": "101 Shipper Lane"},
            {"email": "customer1@example.com",  "password": "Customer@123", "full_name": "Customer 1",   "phone": "0945678901", "address": "202 Customer Road"},
            {"email": "customer2@example.com",  "password": "Customer@123", "full_name": "Customer 2",   "phone": "0956789012", "address": "303 Customer Ave"},
        ]
        users = {}
        for u in users_data:
            existing = db.query(User).filter_by(email=u["email"]).first()
            if not existing:
                obj = User(
                    email=u["email"],
                    password_hash=pwd_context.hash(u["password"]),
                    full_name=u["full_name"],
                    phone=u["phone"],
                    address=u["address"],
                    status="active",
                )
                db.add(obj)
                db.flush()
                users[u["email"]] = obj
            else:
                users[u["email"]] = existing
        db.commit()
        print(f"  ✅ {len(users_data)} users")
        print(f"  📋 Tài khoản test:")
        for u in users_data:
            print(f"     {u['email']} / {u['password']}")

        admin   = users["admin@example.com"]
        owner1  = users["owner1@shop.com"]
        owner2  = users["owner2@shop.com"]
        shipper = users["shipper1@example.com"]
        cust1   = users["customer1@example.com"]

        # ================================================================
        # 4. USER ROLES
        # ================================================================
        print("🎭 Gán User Roles...")
        role_map = [
            (admin,   "ADMIN"),
            (owner1,  "SHOP_OWNER"),
            (owner2,  "SHOP_OWNER"),
            (shipper, "SHIPPER"),
            (cust1,   "CUSTOMER"),
            (users["customer2@example.com"], "CUSTOMER"),
        ]
        for user_obj, role_name in role_map:
            role_obj = roles[role_name]
            exists = db.query(UserRole).filter_by(user_id=user_obj.user_id, role_id=role_obj.role_id).first()
            if not exists:
                db.add(UserRole(
                    user_id=user_obj.user_id,
                    role_id=role_obj.role_id,
                    current_role=True,
                    assigned_by=admin.user_id,
                    status="active",
                ))
        db.commit()
        print(f"  ✅ {len(role_map)} user roles")

        # ================================================================
        # 5. PRODUCT CATEGORIES
        # ================================================================
        print("📂 Tạo Product Categories...")
        cats_data = [
            {"category_name": "Điện tử",        "description": "Thiết bị điện tử"},
            {"category_name": "Thời trang",      "description": "Quần áo, phụ kiện"},
            {"category_name": "Sách",            "description": "Sách và tài liệu"},
            {"category_name": "Nhà & Vườn",      "description": "Đồ dùng nhà cửa"},
            {"category_name": "Thể thao",        "description": "Dụng cụ thể thao"},
            {"category_name": "Mỹ phẩm",         "description": "Làm đẹp, chăm sóc"},
            {"category_name": "Thực phẩm",       "description": "Thực phẩm, đồ uống"},
        ]
        cats = {}
        for c in cats_data:
            existing = db.query(ProductCategory).filter_by(category_name=c["category_name"]).first()
            if not existing:
                obj = ProductCategory(**c)
                db.add(obj)
                db.flush()
                cats[c["category_name"]] = obj
            else:
                cats[c["category_name"]] = existing
        db.commit()
        print(f"  ✅ {len(cats_data)} categories")

        # ================================================================
        # 6. SHOPS
        # ================================================================
        print("🏪 Tạo Shops...")
        shops_data = [
            {
                "shop_id": owner1.user_id,
                "shop_name": "TechWorld Shop",
                "description": "Chuyên thiết bị điện tử, phụ kiện công nghệ",
                "address": "456 Shop Street, Q1, TP.HCM",
                "phone": "0987654321",
                "rating": Decimal("4.5"),
                "total_followers": 1500,
                "total_orders": 250,
                "verification_status": "approved",
            },
            {
                "shop_id": owner2.user_id,
                "shop_name": "Fashion Hub",
                "description": "Thời trang nam nữ, phong cách hiện đại",
                "address": "789 Shop Avenue, Q3, TP.HCM",
                "phone": "0912345678",
                "rating": Decimal("4.2"),
                "total_followers": 800,
                "total_orders": 150,
                "verification_status": "approved",
            },
        ]
        shops = {}
        for s in shops_data:
            existing = db.query(Shop).filter_by(shop_id=s["shop_id"]).first()
            if not existing:
                obj = Shop(**s)
                db.add(obj)
                db.flush()
                shops[s["shop_name"]] = obj
            else:
                shops[s["shop_name"]] = existing
        db.commit()
        print(f"  ✅ {len(shops_data)} shops")

        shop1 = shops["TechWorld Shop"]
        shop2 = shops["Fashion Hub"]

        # ================================================================
        # 7. PRODUCTS
        # ================================================================
        print("🛍️ Tạo Products...")
        elec = cats["Điện tử"]
        fashion = cats["Thời trang"]
        products_data = [
            {"shop_id": shop1.shop_id, "category_id": elec.category_id,    "product_name": "Tai nghe không dây",   "description": "Tai nghe Bluetooth chất lượng cao",  "price": Decimal("1500000"), "cost": Decimal("800000"),  "stock_quantity": 50,  "status": "active"},
            {"shop_id": shop1.shop_id, "category_id": elec.category_id,    "product_name": "Cáp USB-C",            "description": "Cáp sạc USB-C bền, nhanh",           "price": Decimal("150000"),  "cost": Decimal("50000"),   "stock_quantity": 200, "status": "active"},
            {"shop_id": shop1.shop_id, "category_id": elec.category_id,    "product_name": "Ốp lưng điện thoại",  "description": "Ốp lưng bảo vệ toàn diện",          "price": Decimal("200000"),  "cost": Decimal("80000"),   "stock_quantity": 150, "status": "active"},
            {"shop_id": shop1.shop_id, "category_id": elec.category_id,    "product_name": "Bàn phím cơ",         "description": "Bàn phím cơ gaming RGB",             "price": Decimal("2500000"), "cost": Decimal("1500000"), "stock_quantity": 30,  "status": "active"},
            {"shop_id": shop2.shop_id, "category_id": fashion.category_id, "product_name": "Áo thun cotton",      "description": "Áo thun cotton thoải mái",           "price": Decimal("250000"),  "cost": Decimal("100000"),  "stock_quantity": 100, "status": "active"},
            {"shop_id": shop2.shop_id, "category_id": fashion.category_id, "product_name": "Quần jeans",          "description": "Quần jeans xanh classic",            "price": Decimal("500000"),  "cost": Decimal("250000"),  "stock_quantity": 75,  "status": "active"},
            {"shop_id": shop2.shop_id, "category_id": fashion.category_id, "product_name": "Váy hoa nhí",         "description": "Váy hoa mùa hè nhẹ nhàng",          "price": Decimal("350000"),  "cost": Decimal("150000"),  "stock_quantity": 60,  "status": "active"},
            {"shop_id": shop2.shop_id, "category_id": fashion.category_id, "product_name": "Áo khoác dù",         "description": "Áo khoác gió chống nước",            "price": Decimal("750000"),  "cost": Decimal("400000"),  "stock_quantity": 40,  "status": "active"},
        ]
        products = []
        for p in products_data:
            existing = db.query(Product).filter_by(
                shop_id=p["shop_id"], product_name=p["product_name"]
            ).first()
            if not existing:
                obj = Product(**p)
                db.add(obj)
                db.flush()
                products.append(obj)
            else:
                products.append(existing)
        db.commit()
        print(f"  ✅ {len(products_data)} products")

        # ================================================================
        # 8. VOUCHERS
        # ================================================================
        print("🎟️ Tạo Vouchers...")
        vouchers_data = [
            {"code": "SUMMER2024", "discount_type": "percentage", "discount_value": Decimal("20"), "max_uses": 100, "status": "active",   "created_by": admin.user_id},
            {"code": "FLASH50K",   "discount_type": "fixed",      "discount_value": Decimal("50000"),  "max_uses": 50,  "status": "active",   "created_by": admin.user_id},
            {"code": "WELCOME10",  "discount_type": "percentage", "discount_value": Decimal("10"), "max_uses": 1000,"status": "active",   "created_by": admin.user_id},
            {"code": "VIP100K",    "discount_type": "fixed",      "discount_value": Decimal("100000"), "max_uses": 75,  "status": "active",   "created_by": admin.user_id},
            {"code": "NEWYEAR30",  "discount_type": "percentage", "discount_value": Decimal("30"), "max_uses": 200, "status": "inactive", "created_by": admin.user_id},
        ]
        for v in vouchers_data:
            if not db.query(Voucher).filter_by(code=v["code"]).first():
                db.add(Voucher(**v))
        db.commit()
        print(f"  ✅ {len(vouchers_data)} vouchers")

        # ================================================================
        # 9. ORDERS
        # ================================================================
        print("📦 Tạo Orders...")
        ts = int(datetime.now().timestamp())
        orders_data = [
            {"shop_id": shop1.shop_id, "user_id": cust1.user_id, "order_number": f"ORD-{ts}-001", "total_price": Decimal("1500000"), "discount_amount": Decimal("0"),      "final_price": Decimal("1500000"), "shipping_fee": Decimal("30000"), "shipping_address": "202 Customer Road, Q1, TP.HCM", "payment_method": "momo",        "order_status": "delivered"},
            {"shop_id": shop1.shop_id, "user_id": cust1.user_id, "order_number": f"ORD-{ts}-002", "total_price": Decimal("350000"),  "discount_amount": Decimal("35000"),  "final_price": Decimal("315000"),  "shipping_fee": Decimal("25000"), "shipping_address": "202 Customer Road, Q1, TP.HCM", "payment_method": "cod",         "order_status": "pending"},
            {"shop_id": shop2.shop_id, "user_id": cust1.user_id, "order_number": f"ORD-{ts}-003", "total_price": Decimal("750000"),  "discount_amount": Decimal("0"),      "final_price": Decimal("750000"),  "shipping_fee": Decimal("30000"), "shipping_address": "202 Customer Road, Q1, TP.HCM", "payment_method": "credit_card", "order_status": "shipped"},
            {"shop_id": shop2.shop_id, "user_id": cust1.user_id, "order_number": f"ORD-{ts}-004", "total_price": Decimal("250000"),  "discount_amount": Decimal("25000"),  "final_price": Decimal("225000"),  "shipping_fee": Decimal("20000"), "shipping_address": "202 Customer Road, Q1, TP.HCM", "payment_method": "momo",        "order_status": "delivered"},
            {"shop_id": shop1.shop_id, "user_id": cust1.user_id, "order_number": f"ORD-{ts}-005", "total_price": Decimal("200000"),  "discount_amount": Decimal("0"),      "final_price": Decimal("200000"),  "shipping_fee": Decimal("20000"), "shipping_address": "202 Customer Road, Q1, TP.HCM", "payment_method": "cod",         "order_status": "confirmed"},
        ]
        orders = []
        for o in orders_data:
            if not db.query(Order).filter_by(order_number=o["order_number"]).first():
                obj = Order(**o)
                db.add(obj)
                db.flush()
                orders.append(obj)
        db.commit()
        print(f"  ✅ {len(orders)} orders")

        # ================================================================
        # 10. ORDER ITEMS
        # ================================================================
        print("🎁 Tạo Order Items...")
        item_count = 0
        for i, order in enumerate(orders):
            p1 = products[i % len(products)]
            p2 = products[(i + 1) % len(products)]
            items = [
                OrderItem(order_id=order.order_id, product_id=p1.product_id, quantity=1, price_at_order=p1.price),
                OrderItem(order_id=order.order_id, product_id=p2.product_id, quantity=2, price_at_order=p2.price),
            ]
            db.add_all(items)
            item_count += len(items)
        db.commit()
        print(f"  ✅ {item_count} order items")

        # ================================================================
        # 11. SHIPPER PROFILE
        # ================================================================
        print("🚚 Tạo Shipper Profile...")
        if not db.query(Shipper).filter_by(shipper_id=shipper.user_id).first():
            db.add(Shipper(
                shipper_id=shipper.user_id,
                vehicle_type="Xe máy",
                rating=Decimal("4.7"),
                total_deliveries=45,
                status="available",
            ))
            db.commit()
        print("  ✅ Shipper profile")

        # ================================================================
        # 12. PRODUCT REVIEWS
        # ================================================================
        print("⭐ Tạo Product Reviews...")
        reviews_data = [
            {"product_id": products[0].product_id, "user_id": cust1.user_id, "rating": 5, "title": "Sản phẩm tuyệt vời!", "content": "Rất hài lòng, chất lượng tốt, giao hàng nhanh.", "verified": True},
            {"product_id": products[1].product_id, "user_id": cust1.user_id, "rating": 4, "title": "Dùng tốt",             "content": "Cáp sạc nhanh, bền, đúng mô tả.",              "verified": True},
            {"product_id": products[4].product_id, "user_id": cust1.user_id, "rating": 5, "title": "Vải mềm mại",         "content": "Áo mặc thoải mái, form đẹp.",                   "verified": True},
            {"product_id": products[5].product_id, "user_id": cust1.user_id, "rating": 4, "title": "Chất lượng ổn",       "content": "Quần đẹp, vải chắc, giá hợp lý.",              "verified": True},
        ]
        for r in reviews_data:
            if not db.query(ProductReview).filter_by(product_id=r["product_id"], user_id=r["user_id"]).first():
                db.add(ProductReview(**r))
        db.commit()
        print(f"  ✅ {len(reviews_data)} reviews")

        # ================================================================
        # 13. NOTIFICATIONS
        # ================================================================
        print("🔔 Tạo Notifications...")
        notifs_data = [
            {"user_id": cust1.user_id,   "title": "Đơn hàng đã xác nhận",  "message": "Đơn hàng của bạn đã được xác nhận.",    "type": "ORDER"},
            {"user_id": owner1.user_id,  "title": "Đơn hàng mới",          "message": "Bạn có một đơn hàng mới.",               "type": "ORDER"},
            {"user_id": cust1.user_id,   "title": "Cập nhật vận chuyển",   "message": "Đơn hàng đang trên đường giao.",         "type": "SHIPMENT"},
            {"user_id": shipper.user_id, "title": "Chuyến giao hàng mới",  "message": "Bạn được phân công giao hàng mới.",      "type": "DELIVERY"},
            {"user_id": cust1.user_id,   "title": "Thanh toán thành công", "message": "Thanh toán đã được xử lý thành công.",   "type": "PAYMENT"},
        ]
        for n in notifs_data:
            db.add(Notification(**n))
        db.commit()
        print(f"  ✅ {len(notifs_data)} notifications")

        # ================================================================
        # SUMMARY
        # ================================================================
        print("\n✨ ========================================")
        print("✨ Seed dữ liệu hoàn tất!")
        print("✨ ========================================\n")
        print("📊 TỔNG KẾT:")
        print(f"  • Roles:         5")
        print(f"  • Permissions:   {len(perms_data)}")
        print(f"  • Users:         {len(users_data)}")
        print(f"  • Shops:         {len(shops_data)}")
        print(f"  • Categories:    {len(cats_data)}")
        print(f"  • Products:      {len(products_data)}")
        print(f"  • Vouchers:      {len(vouchers_data)}")
        print(f"  • Orders:        {len(orders)}")
        print(f"  • Order Items:   {item_count}")
        print(f"  • Reviews:       {len(reviews_data)}")
        print(f"  • Notifications: {len(notifs_data)}")
        print("\n✅ Sẵn sàng để test API!\n")
        print("🔑 Tài khoản test:")
        print("  admin@example.com    / Admin@123    (ADMIN)")
        print("  owner1@shop.com      / Owner@123    (SHOP_OWNER)")
        print("  owner2@shop.com      / Owner@123    (SHOP_OWNER)")
        print("  shipper1@example.com / Shipper@123  (SHIPPER)")
        print("  customer1@example.com/ Customer@123 (CUSTOMER)")

    except Exception as e:
        db.rollback()
        print(f"\n❌ Lỗi khi seed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    seed()
