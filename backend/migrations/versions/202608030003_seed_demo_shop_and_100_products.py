"""Seed shop demo + 100 sản phẩm mẫu (bỏ qua duyệt admin)

Revision ID: 202608030003
Revises: 202608030002
Create Date: 2026-08-03

Tạo 1 tài khoản shop demo ("BuyZo Demo Store") + 20 danh mục sản phẩm (nếu
chưa có) + 100 sản phẩm trải đều qua các danh mục đó, để đa dạng hoá kho hàng.

Sản phẩm được insert thẳng với status = 'active' (bỏ qua bước "pending" chờ
admin duyệt và bước shop bấm "Đăng bán") nên sẽ hiện ngay trên trang chủ /
danh mục / tìm kiếm — vì GET /api/v1/products chỉ trả về Product.status ==
'active' (xem app/services/product_service.py::get_products).

An toàn khi chạy lại: bỏ qua nếu email shop demo / danh mục / sản phẩm
(theo tên + shop_id) đã tồn tại.
"""
import bcrypt
import sqlalchemy as sa
from alembic import op

revision = '202608030003'
down_revision = '202608030002'
branch_labels = None
depends_on = None


def _hash(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


DEMO_SHOP_EMAIL = "shopdemo@buyzo.com"
DEMO_SHOP_PASSWORD = "shopdemo"
DEMO_SHOP_NAME = "BuyZo Demo Store"

# 20 danh mục x 5 sản phẩm = 100 sản phẩm
CATALOG = [
    ("Điện thoại & Phụ kiện", [
        ("Điện thoại thông minh Galaxy A15 128GB", 4290000, 50),
        ("iPhone 13 Pro Max 256GB (Like New)", 18990000, 20),
        ("Ốp lưng silicon chống sốc đa năng", 89000, 300),
        ("Sạc nhanh 20W chuẩn Type-C", 199000, 250),
        ("Tai nghe không dây TWS Pro", 349000, 150),
    ]),
    ("Laptop & Máy tính", [
        ("Laptop văn phòng Core i5 8GB/256GB", 12490000, 30),
        ("Laptop gaming Ryzen 7 16GB/512GB RTX", 24990000, 15),
        ("Chuột không dây văn phòng êm ái", 129000, 200),
        ("Bàn phím cơ RGB chuyên game", 690000, 100),
        ("Ổ cứng SSD NVMe 512GB tốc độ cao", 890000, 120),
    ]),
    ("Thiết bị âm thanh", [
        ("Loa bluetooth di động chống nước", 450000, 80),
        ("Tai nghe chụp tai chống ồn chủ động", 1290000, 60),
        ("Micro thu âm livestream chuyên nghiệp", 590000, 70),
        ("Loa soundbar cho TV rạp hát tại nhà", 2190000, 25),
        ("Tai nghe nhét tai thể thao chống nước", 259000, 180),
    ]),
    ("Đồng hồ thông minh", [
        ("Đồng hồ thông minh đo nhịp tim, SpO2", 990000, 90),
        ("Vòng đeo tay thông minh theo dõi giấc ngủ", 450000, 130),
        ("Đồng hồ định vị trẻ em GPS 4G", 1190000, 40),
        ("Đồng hồ thể thao chống nước 50m", 690000, 75),
        ("Dây đeo thay thế đồng hồ thông minh silicon", 89000, 200),
    ]),
    ("Thời trang nam", [
        ("Áo thun nam cotton form rộng", 149000, 300),
        ("Quần jean nam slimfit co giãn", 359000, 220),
        ("Áo sơ mi nam công sở dài tay", 259000, 180),
        ("Quần short kaki nam basic", 199000, 250),
        ("Áo khoác gió nam 2 lớp chống nước", 389000, 130),
    ]),
    ("Thời trang nữ", [
        ("Váy liền công sở thanh lịch", 329000, 160),
        ("Áo kiểu nữ tay phồng cổ vuông", 219000, 200),
        ("Chân váy xếp ly midi", 189000, 190),
        ("Áo croptop nữ basic nhiều màu", 129000, 260),
        ("Set đồ nữ thể thao gym yoga", 349000, 140),
    ]),
    ("Giày dép nam nữ", [
        ("Giày sneaker unisex năng động", 459000, 170),
        ("Dép quai ngang nam nữ đế êm", 99000, 300),
        ("Giày thể thao chạy bộ nhẹ êm", 599000, 150),
        ("Giày cao gót nữ mũi nhọn", 379000, 90),
        ("Giày lười nam da công sở", 429000, 110),
    ]),
    ("Túi xách & Ví", [
        ("Túi xách nữ da PU thời trang", 389000, 140),
        ("Balo laptop chống nước đa năng", 349000, 180),
        ("Ví nam da bò thật cao cấp", 259000, 160),
        ("Túi đeo chéo unisex mini", 219000, 200),
        ("Vali kéo du lịch size 20 inch", 1290000, 40),
    ]),
    ("Đồng hồ & Trang sức", [
        ("Đồng hồ nam dây da cổ điển", 890000, 70),
        ("Đồng hồ nữ mặt tròn sang trọng", 750000, 80),
        ("Dây chuyền bạc 925 mặt trái tim", 459000, 100),
        ("Nhẫn đôi tình nhân titan chống oxi hoá", 199000, 220),
        ("Vòng tay phong thuỷ đá thạch anh", 289000, 150),
    ]),
    ("Mỹ phẩm & Làm đẹp", [
        ("Kem chống nắng SPF50+ PA++++", 259000, 250),
        ("Serum vitamin C sáng da", 329000, 200),
        ("Son kem lì lâu trôi", 149000, 300),
        ("Sữa rửa mặt dịu nhẹ cho da nhạy cảm", 189000, 260),
        ("Mặt nạ dưỡng ẩm collagen (hộp 10 miếng)", 159000, 220),
    ]),
    ("Gia dụng & Nhà bếp", [
        ("Nồi chiên không dầu 5L đa năng", 1290000, 60),
        ("Bộ nồi inox 5 đáy cao cấp", 990000, 50),
        ("Máy xay sinh tố công suất lớn", 590000, 90),
        ("Bình giữ nhiệt inox 500ml", 179000, 260),
        ("Bộ dao kéo nhà bếp 6 món", 259000, 150),
    ]),
    ("Nội thất & Trang trí", [
        ("Đèn led trang trí phòng ngủ đổi màu", 199000, 200),
        ("Kệ sách gỗ đa năng để bàn", 349000, 90),
        ("Thảm trải sàn phòng khách chống trượt", 459000, 70),
        ("Gối tựa lưng sofa êm ái", 129000, 200),
        ("Rèm cửa sổ chống nắng cách nhiệt", 389000, 80),
    ]),
    ("Điện tử & Điện lạnh", [
        ("Quạt điều hòa hơi nước mini", 890000, 60),
        ("Máy lọc không khí phòng ngủ", 1690000, 30),
        ("Nồi cơm điện tử 1.8L", 690000, 100),
        ("Bàn ủi hơi nước cầm tay", 359000, 140),
        ("Máy hút bụi cầm tay không dây", 990000, 70),
    ]),
    ("Mẹ & Bé", [
        ("Bỉm tã quần trẻ em size M (44 miếng)", 259000, 200),
        ("Sữa bột công thức cho bé 1-3 tuổi (900g)", 459000, 120),
        ("Xe đẩy em bé gấp gọn du lịch", 1890000, 25),
        ("Bình sữa chống sặc chống đầy hơi", 129000, 220),
        ("Đồ chơi phát triển trí tuệ cho bé", 189000, 180),
    ]),
    ("Thể thao & Du lịch", [
        ("Thảm tập yoga chống trượt 6mm", 259000, 160),
        ("Bình nước thể thao thể tích lớn", 99000, 300),
        ("Dây kháng lực tập gym đa năng", 149000, 220),
        ("Lều cắm trại 2 người chống nước", 890000, 40),
        ("Balo leo núi du lịch 40L", 590000, 70),
    ]),
    ("Sách & Văn phòng phẩm", [
        ("Sổ tay bìa da ghi chú A5", 89000, 250),
        ("Bộ bút bi cao cấp (hộp 10 cây)", 59000, 300),
        ("Sách kỹ năng sống bán chạy", 129000, 150),
        ("Balo học sinh chống gù chống nước", 359000, 100),
        ("Máy tính cầm tay khoa học", 259000, 90),
    ]),
    ("Thực phẩm & Đồ uống", [
        ("Combo trà sữa pha sẵn (hộp 10 gói)", 149000, 200),
        ("Cà phê rang xay nguyên chất 500g", 129000, 220),
        ("Hạt điều rang muối cao cấp 500g", 189000, 160),
        ("Mật ong rừng nguyên chất 500ml", 259000, 130),
        ("Ngũ cốc dinh dưỡng ăn kiêng 500g", 159000, 150),
    ]),
    ("Thú cưng", [
        ("Thức ăn hạt cho chó mèo 1kg", 99000, 250),
        ("Cát vệ sinh cho mèo khử mùi 5L", 129000, 200),
        ("Chuồng vận chuyển thú cưng du lịch", 359000, 60),
        ("Vòng cổ chống ve rận cho thú cưng", 89000, 180),
        ("Đồ chơi gặm nhấm cho thú cưng", 59000, 220),
    ]),
    ("Phụ kiện Ô tô - Xe máy", [
        ("Mũ bảo hiểm 3/4 đầu thời trang", 259000, 150),
        ("Camera hành trình ô tô Full HD", 890000, 60),
        ("Bao tay lái xe máy chống nước", 89000, 200),
        ("Giá đỡ điện thoại xe máy/ô tô", 79000, 260),
        ("Nước rửa xe bọt tuyết đậm đặc", 129000, 180),
    ]),
    ("Đồ chơi & Game", [
        ("Tay cầm chơi game không dây đa năng", 349000, 130),
        ("Xếp hình lego sáng tạo cho bé", 259000, 150),
        ("Robot điều khiển từ xa cho trẻ em", 459000, 90),
        ("Bộ đồ chơi nấu ăn cho bé gái", 199000, 140),
        ("Thẻ game nạp tiền điện tử (voucher)", 100000, 300),
    ]),
]


def upgrade():
    conn = op.get_bind()

    # 1) Tài khoản chủ shop demo (users.role = 'shop')
    row = conn.execute(sa.text("SELECT user_id FROM users WHERE email = :e"), {"e": DEMO_SHOP_EMAIL}).first()
    if row:
        shop_user_id = row[0]
    else:
        shop_user_id = conn.execute(sa.text("""
            INSERT INTO users (email, password_hash, full_name, phone, status)
            VALUES (:email, :pw, :name, '0900000000', 'active') RETURNING user_id
        """), {"email": DEMO_SHOP_EMAIL, "pw": _hash(DEMO_SHOP_PASSWORD), "name": DEMO_SHOP_NAME}).scalar()

    role_row = conn.execute(sa.text("SELECT role_id FROM roles WHERE role_name = 'shop'")).first()
    if role_row:
        role_id = role_row[0]
    else:
        role_id = conn.execute(sa.text("""
            INSERT INTO roles (role_name, description) VALUES ('shop', 'BuyZo — shop owner') RETURNING role_id
        """)).scalar()

    has_role = conn.execute(sa.text(
        "SELECT 1 FROM user_roles WHERE user_id = :uid AND role_id = :rid"
    ), {"uid": shop_user_id, "rid": role_id}).first()
    if not has_role:
        conn.execute(sa.text("""
            INSERT INTO user_roles (user_id, role_id, status, "current_role")
            VALUES (:uid, :rid, 'active', TRUE)
        """), {"uid": shop_user_id, "rid": role_id})

    # 2) Hồ sơ shop (shops.shop_id = users.user_id), duyệt sẵn (bỏ qua chờ admin)
    shop_row = conn.execute(sa.text("SELECT shop_id FROM shops WHERE shop_id = :sid"), {"sid": shop_user_id}).first()
    if not shop_row:
        conn.execute(sa.text("""
            INSERT INTO shops (shop_id, shop_name, description, address, phone, verification_status, verified_at)
            VALUES (:sid, :name, :desc, :addr, '0900000000', 'approved', now())
        """), {
            "sid": shop_user_id,
            "name": DEMO_SHOP_NAME,
            "desc": "Shop demo của hệ thống BuyZo — đa dạng mặt hàng để kho hàng phong phú.",
            "addr": "268 Lý Thường Kiệt, Phường 14, Quận 10, TP. Hồ Chí Minh",
        })

    # 3) Danh mục + sản phẩm
    for category_name, products in CATALOG:
        cat_row = conn.execute(sa.text(
            "SELECT category_id FROM product_categories WHERE category_name = :n"
        ), {"n": category_name}).first()
        if cat_row:
            category_id = cat_row[0]
        else:
            category_id = conn.execute(sa.text("""
                INSERT INTO product_categories (category_name) VALUES (:n) RETURNING category_id
            """), {"n": category_name}).scalar()

        for product_name, price, stock in products:
            exists = conn.execute(sa.text(
                "SELECT 1 FROM products WHERE shop_id = :sid AND product_name = :n"
            ), {"sid": shop_user_id, "n": product_name}).first()
            if exists:
                continue
            conn.execute(sa.text("""
                INSERT INTO products
                    (shop_id, category_id, product_name, description, price, stock_quantity,
                     status, rating, total_reviews, views_count, sales_count)
                VALUES
                    (:sid, :cid, :name, :desc, :price, :stock,
                     'active', 0, 0, 0, 0)
            """), {
                "sid": shop_user_id,
                "cid": category_id,
                "name": product_name,
                "desc": f"{product_name} — hàng có sẵn tại {DEMO_SHOP_NAME}, giao nhanh toàn quốc.",
                "price": price,
                "stock": stock,
            })


def downgrade():
    conn = op.get_bind()
    shop_row = conn.execute(sa.text("SELECT user_id FROM users WHERE email = :e"), {"e": DEMO_SHOP_EMAIL}).first()
    if not shop_row:
        return
    shop_user_id = shop_row[0]

    all_names = [p[0] for _, products in CATALOG for p in products]
    conn.execute(sa.text("""
        DELETE FROM products WHERE shop_id = :sid AND product_name = ANY(:names)
    """), {"sid": shop_user_id, "names": all_names})

    for category_name, _ in CATALOG:
        conn.execute(sa.text("""
            DELETE FROM product_categories
            WHERE category_name = :n
              AND NOT EXISTS (SELECT 1 FROM products WHERE category_id = product_categories.category_id)
        """), {"n": category_name})

    conn.execute(sa.text("DELETE FROM shops WHERE shop_id = :sid"), {"sid": shop_user_id})
    conn.execute(sa.text("DELETE FROM user_roles WHERE user_id = :sid"), {"sid": shop_user_id})
    conn.execute(sa.text("DELETE FROM users WHERE user_id = :sid"), {"sid": shop_user_id})
