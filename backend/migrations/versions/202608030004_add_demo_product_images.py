"""Gắn ảnh placeholder cho 100 sản phẩm demo (shop BuyZo Demo Store)

Revision ID: 202608030004
Revises: 202608030003
Create Date: 2026-08-03

Sinh sẵn 1 ảnh placeholder (dịch vụ placehold.co — ổn định, không cần API key,
không phụ thuộc kho ảnh ngoài có thể bị đổi/xoá) cho từng sản phẩm trong
CATALOG của migration 202608030003, mỗi danh mục 1 màu nền riêng để dễ phân
biệt. Đây là ảnh tạm để hiển thị ngay; shop có thể vào trang quản lý sản phẩm
và thay bằng ảnh thật bất cứ lúc nào.
"""
import json
from urllib.parse import quote

import sqlalchemy as sa
from alembic import op

revision = '202608030004'
down_revision = '202608030003'
branch_labels = None
depends_on = None

DEMO_SHOP_EMAIL = "shopdemo@buyzo.com"

# (tên danh mục, màu nền hex) — trùng thứ tự với CATALOG trong 202608030003
CATALOG = [
    ("Điện thoại & Phụ kiện", "2563EB", [
        "Điện thoại thông minh Galaxy A15 128GB",
        "iPhone 13 Pro Max 256GB (Like New)",
        "Ốp lưng silicon chống sốc đa năng",
        "Sạc nhanh 20W chuẩn Type-C",
        "Tai nghe không dây TWS Pro",
    ]),
    ("Laptop & Máy tính", "1D4ED8", [
        "Laptop văn phòng Core i5 8GB/256GB",
        "Laptop gaming Ryzen 7 16GB/512GB RTX",
        "Chuột không dây văn phòng êm ái",
        "Bàn phím cơ RGB chuyên game",
        "Ổ cứng SSD NVMe 512GB tốc độ cao",
    ]),
    ("Thiết bị âm thanh", "7C3AED", [
        "Loa bluetooth di động chống nước",
        "Tai nghe chụp tai chống ồn chủ động",
        "Micro thu âm livestream chuyên nghiệp",
        "Loa soundbar cho TV rạp hát tại nhà",
        "Tai nghe nhét tai thể thao chống nước",
    ]),
    ("Đồng hồ thông minh", "6D28D9", [
        "Đồng hồ thông minh đo nhịp tim, SpO2",
        "Vòng đeo tay thông minh theo dõi giấc ngủ",
        "Đồng hồ định vị trẻ em GPS 4G",
        "Đồng hồ thể thao chống nước 50m",
        "Dây đeo thay thế đồng hồ thông minh silicon",
    ]),
    ("Thời trang nam", "0F766E", [
        "Áo thun nam cotton form rộng",
        "Quần jean nam slimfit co giãn",
        "Áo sơ mi nam công sở dài tay",
        "Quần short kaki nam basic",
        "Áo khoác gió nam 2 lớp chống nước",
    ]),
    ("Thời trang nữ", "DB2777", [
        "Váy liền công sở thanh lịch",
        "Áo kiểu nữ tay phồng cổ vuông",
        "Chân váy xếp ly midi",
        "Áo croptop nữ basic nhiều màu",
        "Set đồ nữ thể thao gym yoga",
    ]),
    ("Giày dép nam nữ", "B45309", [
        "Giày sneaker unisex năng động",
        "Dép quai ngang nam nữ đế êm",
        "Giày thể thao chạy bộ nhẹ êm",
        "Giày cao gót nữ mũi nhọn",
        "Giày lười nam da công sở",
    ]),
    ("Túi xách & Ví", "92400E", [
        "Túi xách nữ da PU thời trang",
        "Balo laptop chống nước đa năng",
        "Ví nam da bò thật cao cấp",
        "Túi đeo chéo unisex mini",
        "Vali kéo du lịch size 20 inch",
    ]),
    ("Đồng hồ & Trang sức", "A16207", [
        "Đồng hồ nam dây da cổ điển",
        "Đồng hồ nữ mặt tròn sang trọng",
        "Dây chuyền bạc 925 mặt trái tim",
        "Nhẫn đôi tình nhân titan chống oxi hoá",
        "Vòng tay phong thuỷ đá thạch anh",
    ]),
    ("Mỹ phẩm & Làm đẹp", "E11D48", [
        "Kem chống nắng SPF50+ PA++++",
        "Serum vitamin C sáng da",
        "Son kem lì lâu trôi",
        "Sữa rửa mặt dịu nhẹ cho da nhạy cảm",
        "Mặt nạ dưỡng ẩm collagen (hộp 10 miếng)",
    ]),
    ("Gia dụng & Nhà bếp", "C2410C", [
        "Nồi chiên không dầu 5L đa năng",
        "Bộ nồi inox 5 đáy cao cấp",
        "Máy xay sinh tố công suất lớn",
        "Bình giữ nhiệt inox 500ml",
        "Bộ dao kéo nhà bếp 6 món",
    ]),
    ("Nội thất & Trang trí", "854D0E", [
        "Đèn led trang trí phòng ngủ đổi màu",
        "Kệ sách gỗ đa năng để bàn",
        "Thảm trải sàn phòng khách chống trượt",
        "Gối tựa lưng sofa êm ái",
        "Rèm cửa sổ chống nắng cách nhiệt",
    ]),
    ("Điện tử & Điện lạnh", "0369A1", [
        "Quạt điều hòa hơi nước mini",
        "Máy lọc không khí phòng ngủ",
        "Nồi cơm điện tử 1.8L",
        "Bàn ủi hơi nước cầm tay",
        "Máy hút bụi cầm tay không dây",
    ]),
    ("Mẹ & Bé", "0891B2", [
        "Bỉm tã quần trẻ em size M (44 miếng)",
        "Sữa bột công thức cho bé 1-3 tuổi (900g)",
        "Xe đẩy em bé gấp gọn du lịch",
        "Bình sữa chống sặc chống đầy hơi",
        "Đồ chơi phát triển trí tuệ cho bé",
    ]),
    ("Thể thao & Du lịch", "15803D", [
        "Thảm tập yoga chống trượt 6mm",
        "Bình nước thể thao thể tích lớn",
        "Dây kháng lực tập gym đa năng",
        "Lều cắm trại 2 người chống nước",
        "Balo leo núi du lịch 40L",
    ]),
    ("Sách & Văn phòng phẩm", "4D7C0F", [
        "Sổ tay bìa da ghi chú A5",
        "Bộ bút bi cao cấp (hộp 10 cây)",
        "Sách kỹ năng sống bán chạy",
        "Balo học sinh chống gù chống nước",
        "Máy tính cầm tay khoa học",
    ]),
    ("Thực phẩm & Đồ uống", "B91C1C", [
        "Combo trà sữa pha sẵn (hộp 10 gói)",
        "Cà phê rang xay nguyên chất 500g",
        "Hạt điều rang muối cao cấp 500g",
        "Mật ong rừng nguyên chất 500ml",
        "Ngũ cốc dinh dưỡng ăn kiêng 500g",
    ]),
    ("Thú cưng", "A21CAF", [
        "Thức ăn hạt cho chó mèo 1kg",
        "Cát vệ sinh cho mèo khử mùi 5L",
        "Chuồng vận chuyển thú cưng du lịch",
        "Vòng cổ chống ve rận cho thú cưng",
        "Đồ chơi gặm nhấm cho thú cưng",
    ]),
    ("Phụ kiện Ô tô - Xe máy", "334155", [
        "Mũ bảo hiểm 3/4 đầu thời trang",
        "Camera hành trình ô tô Full HD",
        "Bao tay lái xe máy chống nước",
        "Giá đỡ điện thoại xe máy/ô tô",
        "Nước rửa xe bọt tuyết đậm đặc",
    ]),
    ("Đồ chơi & Game", "9333EA", [
        "Tay cầm chơi game không dây đa năng",
        "Xếp hình lego sáng tạo cho bé",
        "Robot điều khiển từ xa cho trẻ em",
        "Bộ đồ chơi nấu ăn cho bé gái",
        "Thẻ game nạp tiền điện tử (voucher)",
    ]),
]


def _image_url(color: str, label: str) -> str:
    text = quote(label)
    return f"https://placehold.co/600x600/{color}/FFFFFF?text={text}&font=roboto"


def upgrade():
    conn = op.get_bind()
    shop_row = conn.execute(sa.text("SELECT user_id FROM users WHERE email = :e"), {"e": DEMO_SHOP_EMAIL}).first()
    if not shop_row:
        return
    shop_user_id = shop_row[0]

    for category_name, color, product_names in CATALOG:
        for name in product_names:
            url = _image_url(color, name)
            conn.execute(sa.text("""
                UPDATE products SET image_urls = CAST(:urls AS JSON)
                WHERE shop_id = :sid AND product_name = :name
            """), {"urls": json.dumps([url]), "sid": shop_user_id, "name": name})


def downgrade():
    conn = op.get_bind()
    shop_row = conn.execute(sa.text("SELECT user_id FROM users WHERE email = :e"), {"e": DEMO_SHOP_EMAIL}).first()
    if not shop_row:
        return
    shop_user_id = shop_row[0]
    conn.execute(sa.text("UPDATE products SET image_urls = NULL WHERE shop_id = :sid"), {"sid": shop_user_id})
