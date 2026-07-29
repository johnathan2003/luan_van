# Fix Log — Frontend Cleanup

> Ngày: 2026-07-16
> Người thực hiện: Claude (Cowork mode)

---

## ✅ Đã sửa: Image links → picsum.photos/seed

### 1. `frontend/src/utils/helpers.ts`
- **Trước:** `/images/placeholder.png` (local path không tồn tại)
- **Sau:** `https://picsum.photos/seed/placeholder-product/400/400`
- **Lý do:** `getImageUrl()` được gọi ở mọi nơi, fix 1 chỗ này ảnh hưởng toàn bộ app

### 2. `frontend/src/pages/user/ProductDetailPage.tsx` (2 chỗ)
- Line 278: `|| '/images/placeholder.png'` → bỏ fallback vì `getImageUrl()` đã xử lý
- Line 402: `['/images/placeholder.png']` → `['https://picsum.photos/seed/placeholder-product/400/400']`

### 3. `frontend/src/pages/shop/BannerAuctionPage.tsx` (2 chỗ)
- `via.placeholder.com/80` → `https://picsum.photos/seed/product-thumb/80/80`
- `via.placeholder.com/160` → `https://picsum.photos/seed/product-thumb/160/160`

### 4. `frontend/src/components/shop/ProductManagement.tsx` (9 URLs)
- 8 Unsplash URLs trong `MOCK_PRODUCTS` array → picsum.photos/seed với slug theo tên sản phẩm
- 1 Unsplash URL trong `rejectionStore.save()` → picsum.photos/seed/ipad-pro-m2/400/400

### 5. `frontend/src/pages/Home.tsx` (8 URLs)
- 8 Unsplash URLs trong `MALL_MOCK` (logo brand: LOreal, Unilever, Samsung...) → picsum.photos/seed/brand-{name}/200/200

---

## ✅ Đã sửa: Tiếng Việt thiếu dấu trong UI

### `frontend/src/pages/user/CheckoutPage.tsx`
| Trước | Sau |
|---|---|
| `Du kien giao hàng` | `Dự kiến giao hàng` |
| `3 - 5 ngay lam viec` | `3 - 5 ngày làm việc` |
| `Theo doi don hang` | `Theo dõi đơn hàng` |
| `Tiep tuc mua sắm` | `Tiếp tục mua sắm` |
| `Qua tang hau mai` | `Quà tặng hậu mãi` |
| `Qua tang tu shop: ${g.shopName}` | `Quà tặng từ shop: ${g.shopName}` |
| `💳 Phuong thuc thanh toan` | `💳 Phương thức thanh toán` |
| `Quận / Hủyện` *(typo)* | `Quận / Huyện` |

### `frontend/src/pages/ShopProfilePage.tsx`
| Trước | Sau |
|---|---|
| `&#10003; Chinh thuc` | `&#10003; Chính thức` |
| `✏️ Che do chinh sua` | `✏️ Chế độ chỉnh sửa` |
| `Da ban {sales_count}` | `Đã bán {sales_count}` |

### `frontend/src/pages/shop/BannerAuctionPage.tsx`
| Trước | Sau |
|---|---|
| `Admin khong ghi ro ly do.` | `Admin không ghi rõ lý do.` |
| `Vui long chinh sua noi dung theo dung chinh sach...` | `Vui lòng chỉnh sửa nội dung theo đúng chính sách...` |
| `Dong` (button) | `Đóng` |

---

## ✅ Đã sửa: Backend seed.py

### Bug nghiêm trọng: `book_products` tuple structure sai
- **Trước:** `_imgs()` nằm **ngoài** tuple → `book_products` có 10 elements xen kẽ (5 tuples 7 phần tử + 5 lists), unpack `for pname, price, cost, stock, sold, rat, desc, imgs` **crash**
- **Sau:** `_imgs()` đúng vị trí **trong** tuple → 5 tuples 8 phần tử

### Mô tả sản phẩm không dấu → có dấu
- `"Thiet bi dien tu chinh hang"` → `"Thiết bị điện tử chính hãng"`
- `"Shop da nang cua Hoang Van An"` → `"Shop đa năng của Hoàng Văn An"`
- Tất cả mô tả sách trong `book_products` được viết lại đầy đủ dấu

---

## ⚠️ Cần mình xem xét / định hướng tiếp

### 1. Ảnh placeholder không đúng nội dung sản phẩm
`picsum.photos/seed/<slug>` trả về ảnh **ngẫu nhiên** (phong cảnh, đồ vật...) không liên quan đến sản phẩm (điện thoại, giày...). Các ảnh này chỉ dùng khi sản phẩm chưa có ảnh thật.

**Gợi ý:** Khi demo, nên upload ảnh thật qua form thêm sản phẩm. Hoặc nếu muốn seed có ảnh "trông đúng loại", cần dùng ảnh từ CDN khác (placehold.co cho phép text overlay).

### 2. `Home.tsx` — Brand logos vẫn là picsum random
Các logo thương hiệu (LOreal, Samsung, CeraVe...) trong mục "BuyZo Mall" hiện dùng ảnh ngẫu nhiên từ picsum. Trông không chuyên nghiệp khi demo.

**Gợi ý:** Thay bằng logo thật từ Wikipedia/Wikimedia (public domain) hoặc dùng placehold.co với text tên brand.

### 3. `ProductManagement.tsx` — MOCK_PRODUCTS hardcode
Component `ProductManagement` vẫn dùng hardcoded mock data khi chưa kết nối backend. Khi backend hoạt động, mock data này sẽ không hiển thị nữa vì component fetch từ API.

**Không cần sửa** trừ khi muốn demo offline.

### 4. Các comment trong code còn không dấu
Rất nhiều comment trong TSX/TS viết không dấu (ví dụ: `// cac doi tuong co the khieu nai...`, `// so xu da thuc su tru...`). Đây là comment của lập trình viên, **không hiển thị cho người dùng**, nên tôi bỏ qua.

**Gợi ý:** Nếu muốn codebase nhất quán, có thể dùng script sed/replace hàng loạt, nhưng cần cẩn thận vì có thể break code.

### 5. `seed.py` — Employee positions vẫn không dấu
Các `position` của nhân viên: `"Nhan vien xu ly don hang"`, `"Nhan vien xu ly phan hoi khach"`, `"Nhan vien tu van truc tuyen"` — đây là dữ liệu lưu trong DB, sẽ hiển thị trong trang quản lý nhân viên.

**Cần sửa thêm** nếu muốn hiển thị đúng:
```python
"Nhân viên xử lý đơn hàng"
"Nhân viên xử lý phản hồi khách"
"Nhân viên tư vấn trực tuyến"
```

### 6. `seed.py` — Tên nhân viên không dấu
`"Nguyen Thi Don Hang"`, `"Le Van Phan Hoi"`, `"Pham Thi Tu Van"` — tên mock không cần dấu là chấp nhận được nhưng nhìn lạ trong UI.

---

## 📋 Tóm tắt số lượng fix

| Loại | Số lượng file | Số lượng chỗ fix |
|---|---|---|
| Image links → picsum seed | 5 files | 22 URLs |
| Tiếng Việt thiếu dấu (UI) | 3 files | 12 chỗ |
| Seed bug (crash khi chạy) | 1 file | 1 bug nghiêm trọng |
| Seed text có dấu | 1 file | 7 chuỗi |
| **Tổng** | **6 files** | **42 chỗ** |
