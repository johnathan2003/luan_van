# INTEGRATION_GAP_PLAN.md
> Rà soát toàn bộ codebase — phát hiện lỗ hổng liên kết giữa các module
> Ngày kiểm tra: 2026-07-23 | Không code, chỉ lập kế hoạch

---

## PHÂN LOẠI MỨC ĐỘ

| Ký hiệu | Ý nghĩa |
|---------|---------|
| 🔴 CRITICAL | App crash / logic sai hoàn toàn — người dùng không dùng được |
| 🟠 IMPORTANT | Tính năng không hoạt động đúng — dữ liệu sai |
| 🟡 MINOR | Thiếu thông tin / UX kém — không gây crash |

---

## 🔴 CRITICAL — Phải sửa trước khi test

---

### [C-1] `Shop.owner_id` không tồn tại trong model
**File lỗi:** `backend/app/routes/orders.py` lines 266, 428

**Vấn đề:**
Model `Shop` dùng `shop_id` làm primary key và nó chính là `user_id` của chủ shop (1-1 mapping). Không có cột `owner_id`.

Nhưng `orders.py` lại filter:
```python
Shop.filter(Shop.shop_id == order.shop_id, Shop.owner_id == current_user.user_id)
```
→ `Shop.owner_id` không tồn tại → `AttributeError` → server 500 khi:
- Shop xác nhận đóng gói (`confirm-packing`)
- Shop xem tracking đơn hàng

**Sửa đúng:**
```python
# SAI:
shop = db.query(Shop).filter(Shop.shop_id == order.shop_id, Shop.owner_id == current_user.user_id)
# ĐÚNG (shop_id = user_id của owner):
shop = db.query(Shop).filter(Shop.shop_id == order.shop_id, Shop.shop_id == current_user.user_id)
```

---

### [C-2] `Product.status == "active"` — không tìm được sản phẩm đã duyệt
**File lỗi:** `backend/app/services/order_service.py` line 26

**Vấn đề:**
Luồng duyệt sản phẩm:
1. Shop tạo sản phẩm → `status = "pending"`
2. Admin duyệt → `product.status = "approved"` (xem `product_service.py` line 134)
3. Khi đặt hàng, `create_order()` filter `Product.status == "active"` → **không tìm thấy sản phẩm "approved"** → 404

Ngoài ra, `get_products()` trong `product_service.py` filter `status == "active"` → shop và trang chủ cũng không thấy sản phẩm đã duyệt.

**Sửa:**
Đổi filter thành `Product.status.in_(["active", "approved"])` tại tất cả nơi cần hiển thị sản phẩm công khai.

---

### [C-3] Payout flow hoàn toàn không tồn tại
**Files lỗi:** `backend/app/services/shipment_service.py`, `backend/app/services/order_service.py`

**Vấn đề — chuỗi vòng tiền bị đứt hoàn toàn:**

Khi shipper giao hàng xong (`mark_delivered()`):
- Chỉ đổi `shipment.status = "delivered"` và `order.order_status = "delivered"`
- **KHÔNG tạo `ShipperTransaction`** → shipper không bao giờ có tiền trong tài khoản

Khi người dùng xác nhận đã nhận hàng (`confirm_received()`):
- Chỉ đổi `order.order_status = "completed"`
- **KHÔNG tạo `ShopWalletTransaction`** → tiền không vào ví shop
- **KHÔNG tạo `PlatformTransaction`** → admin không ghi nhận doanh thu

Kết quả: mọi trang tài chính (EarningsPage, WalletPage, FinancePage) đều hiển thị 0 đồng dù có hàng trăm đơn hoàn thành.

**Luồng cần thêm vào `confirm_received()`:**
```
order.final_price = X
→ shop_amount = X * shop_rate/100
→ shipper_amount = X * shipper_rate/100
→ admin_amount = X * admin_rate/100
→ vat_amount = X * vat_rate/100

→ INSERT ShopWalletTransaction(txn_type="order_revenue", amount=shop_amount)
→ UPDATE ShopWallet.balance += shop_amount
→ INSERT ShipperTransaction(type="delivery_fee", amount=shipper_amount)
→ INSERT PlatformTransaction(type="commission", amount=admin_amount)
```

Tất cả tỷ lệ phải đọc từ `RevenueConfig` (đã có trong DB).

---

## 🟠 IMPORTANT — Sửa sau khi fix critical

---

### [I-1] `shipping_fee` / `extra_fee` không ảnh hưởng `final_price`
**Files:** `frontend/.../CheckoutPage.tsx`, `backend/.../order_service.py`, `backend/schemas/order.py`

**Vấn đề — 3 tầng đều bị đứt:**

**Tầng 1 — Frontend tính sai:**
`CheckoutPage.tsx` hardcode: `shipping = subtotal >= 500000 ? 0 : 30000`
Không liên quan đến `size_tier` hay `extra_fee` thực tế của kiện hàng.

**Tầng 2 — Backend không nhận:**
`OrderCreate` schema có field `shipping_fee` (Optional) nhưng `create_order()` không dùng:
```python
final_price = max(0.0, total_price - discount)  # shipping_fee bị bỏ qua
```

**Tầng 3 — extra_fee lưu sai chỗ:**
`confirm-packing` tính `extra_fee` và lưu vào `Shipment.extra_fee` nhưng không cộng vào `Order.final_price`. Người dùng thanh toán theo giá cũ, phí theo kích thước không được thu.

**Sửa:** `final_price = total_price - discount + shipping_fee` và `shipping_fee` được tính khi `confirm-packing` (sau khi biết kích thước) hoặc dùng giá cố định lúc checkout.

---

### [I-2] `confirm-packing` không nhận kích thước từ frontend
**Files:** `frontend/src/components/shop/OrderManagement.tsx`, `backend/app/routes/orders.py`

**Vấn đề:**
Backend `POST /{order_id}/confirm-packing` nhận `data: dict` gồm `length`, `width`, `height`, `weight` để tính `size_tier`.

Nhưng frontend gọi:
```ts
await orderService.confirmPacking(id)  // không truyền dimensions
```

→ Backend nhận `data = None` → `pkg_length = 0`, `pkg_weight = 0` → `size_tier = NULL`, `extra_fee = 0` mọi lúc.

**Sửa:** Thêm modal nhập kích thước vào `OrderManagement.tsx` trước khi gọi confirmPacking, truyền `{ length, width, height, weight }`.

---

### [I-3] `GET /orders/{order_id}` thiếu thông tin shipment quan trọng
**File:** `backend/app/routes/orders.py` line 135–142

**Vấn đề:**
Response `shipment` object chỉ trả về:
```json
{ "shipment_id", "status", "pickup_location", "delivery_location", "current_location", "shipper_id" }
```

Thiếu hoàn toàn:
- `delivery_code` — người dùng không biết mã để tra cứu
- `size_tier`, `extra_fee`, `pkg_length/width/height_cm`, `pkg_weight_kg`
- `logs` — lịch sử hành trình qua kho

**Sửa:** Bổ sung các fields trên vào response của `GET /{order_id}`.

---

### [I-4] `ShipperTransaction` không bao giờ được INSERT tự động
**File:** `backend/app/routes/shipments.py` (đọc), không có file nào ghi

**Vấn đề:**
`EarningsPage.tsx` và `WithdrawalPage.tsx` hiển thị balance từ `GET /api/v1/shipments/shipper/me/balance` → tính từ `ShipperTransaction`. Nhưng không có service nào INSERT vào bảng này khi shipper giao hàng xong. Table luôn rỗng → balance = 0.

**Sửa:** Sau `mark_delivered()`, INSERT `ShipperTransaction(type="delivery_fee", amount=X)`. (Liên quan đến [C-3])

---

### [I-5] `Shipment.current_warehouse_id` không được cập nhật khi hub scan
**File:** `backend/app/routes/warehouses.py`

**Vấn đề:**
Khi hub/district manager scan delivery_code để nhận hàng vào kho, backend chỉ cập nhật `shipment.status` nhưng không set `shipment.current_warehouse_id`. Tính năng "đơn hàng đang ở kho nào" luôn NULL. `TrackOrderPage` và `GET /{order_id}/tracking` không có dữ liệu kho.

**Sửa:** Khi warehouse scan → `shipment.current_warehouse_id = warehouse_id` của manager hiện tại.

---

### [I-6] `Shipment.src_warehouse_id` và `dest_warehouse_id` không được set
**File:** `backend/app/services/order_service.py` (create_order), `backend/app/routes/orders.py` (confirm-packing)

**Vấn đề:**
Khi tạo đơn hàng, `src_warehouse_id` (kho phường của shop) và `dest_warehouse_id` (kho phường của người nhận) không được xác định và set. Toàn bộ logic định tuyến liên tỉnh phụ thuộc vào 2 cột này nhưng chúng luôn NULL.

**Sửa:** Khi `confirm-packing`, lookup địa chỉ shop → tìm warehouse phường tương ứng → set `src_warehouse_id`. Lookup địa chỉ giao hàng → tìm warehouse phường → set `dest_warehouse_id`.

---

### [I-7] `ShopWallet` chỉ có flow deposit, không có flow nhận tiền từ đơn hàng
**File:** `backend/app/routes/wallet.py`

**Vấn đề:**
`wallet.py` chỉ có các endpoint: `deposit-request`, `approve-deposit`, `reject-deposit`. Không có endpoint hay service nào ghi nhận tiền từ đơn hàng hoàn thành vào ví shop. `WalletPage.tsx` hiển thị balance luôn = 0.

**Sửa:** Tạo `ShopWalletTransaction(txn_type="order_revenue")` trong `confirm_received()`. (Liên quan đến [C-3])

---

### [I-8] `PlatformTransaction` tồn tại trong model nhưng không bao giờ được ghi
**File:** `backend/app/models/admin_config.py`, `backend/app/routes/admin.py`

**Vấn đề:**
`FinancePage.tsx` hiển thị doanh thu platform. Backend (`admin.py` line ~1032) tính tổng từ `completed orders` theo `shop_rate` — chỉ là SELECT, không INSERT vào `PlatformTransaction`. Không có lịch sử giao dịch platform. Tab "Lịch sử giao dịch" luôn trống.

**Sửa:** INSERT `PlatformTransaction(type="commission")` trong `confirm_received()`. (Liên quan đến [C-3])

---

## 🟡 MINOR — Sửa sau cùng

---

### [M-1] `GET /orders/me` không trả về `delivery_code`
**File:** `backend/app/routes/orders.py` (get_my_orders)

`OrderHistoryPage.tsx` hiển thị danh sách đơn nhưng không có delivery_code để user copy-paste tra cứu.

---

### [M-2] Checkout: phí ship hardcode không liên kết với hệ thống kích thước
**File:** `frontend/src/pages/user/CheckoutPage.tsx` line 360

`shipping = subtotal >= 500000 ? 0 : 30000` — hardcode, không đọc từ `size_tier` hay API. Nên hiển thị "Phí ship tính sau khi đóng gói" thay vì con số sai.

---

### [M-3] `ProtectedRoute` role check bất đối xứng với tên role trong DB
**File:** `frontend/src/Router.tsx`

`requiredRole="warehouse_hub_manager|admin"` — cần verify tên trong bảng `roles` của DB khớp chính xác với string này. Nếu seed tạo `warehouse_chief` thay vì `warehouse_hub_manager` thì tất cả hub manager bị redirect về `/`.

---

### [M-4] `TransferPage.tsx` và `IncomingShipmentsPage.tsx` (warehouse cũ) không còn phù hợp với hệ thống kho 3 cấp mới
**Files:** `frontend/src/pages/warehouse/`

Các page cũ dùng role `warehouse_manager` (tổng hợp) đã bị thay bởi hub/district/ward. Các page warehouse cũ (`AllShipmentsPage`, `IncomingShipmentsPage`, `TransferPage`) vẫn tồn tại nhưng API backend của chúng có thể không còn đúng.

---

### [M-5] `EarningsPage.tsx` — monthly chart dùng đúng API nhưng data luôn rỗng
Liên quan đến [I-4] — khi fix ShipperTransaction tự động, page này sẽ tự có data.

---

### [M-6] `OrderDetailPage.tsx` không hiển thị tiến trình kho (shipment logs)
`GET /orders/{order_id}/tracking` trả về logs nhưng `OrderDetailPage.tsx` không gọi endpoint này. User không biết đơn đang ở kho nào.

---

---

## VOUCHER SYSTEM — Lỗ hổng riêng biệt

---

### [V-1] 🔴 `Voucher.voucher_type` và `Voucher.used_count` không tồn tại trong model
**Files lỗi:** `backend/app/routes/admin.py` lines 825, 833, 1479, 1480, 1557

**Vấn đề:**
Model `Voucher` chỉ có `current_uses` (không phải `used_count`) và không có cột `voucher_type`.

Nhưng `admin.py` dùng cả hai:
```python
# Line 825 — filter theo voucher_type:
q.filter(Voucher.voucher_type == voucher_type)   # AttributeError

# Line 833 — trả về voucher_type:
"voucher_type": v.voucher_type                    # AttributeError

# Line 1479 — report dùng used_count:
.filter(Voucher.used_count > 0)                   # AttributeError
.order_by(Voucher.used_count.desc())              # AttributeError
```

→ `VoucherAdminPage` crash ngay khi load, `ReportsPage` tab voucher crash.

**Sửa:** Thêm cột `voucher_type` (VARCHAR: "platform"/"shop") vào model + migration, đổi `used_count` → `current_uses` trong admin.py.

---

### [V-2] 🔴 Admin `create_voucher` dùng sai tên fields — không tạo được voucher sàn
**File lỗi:** `backend/app/routes/admin.py` lines ~1550–1558

**Vấn đề:**
Admin tạo voucher sàn bằng:
```python
Voucher(
    usage_limit=...,        # ❌ model dùng max_uses
    start_date=...,         # ❌ model dùng valid_from
    end_date=...,           # ❌ model dùng valid_to
    is_active=True,         # ❌ model dùng status="active"
    voucher_type="platform" # ❌ cột không tồn tại
)
```
→ Admin tạo voucher sàn bị lỗi. Toàn bộ tính năng voucher platform không hoạt động.

**Sửa:** Đổi về đúng tên field của model (`max_uses`, `valid_from`, `valid_to`, `status="active"`). Thêm `voucher_type` sau khi fix [V-1].

---

### [V-3] 🟠 `current_uses` tăng ngay khi tạo đơn, không hoàn lại khi huỷ
**File lỗi:** `backend/app/services/order_service.py` line 57, `cancel_order()` line 214

**Vấn đề:**
```python
# Trong create_order() — tăng ngay khi tạo đơn:
voucher.current_uses += 1   # ← tăng dù đơn chưa được xác nhận/thanh toán

# Trong cancel_order() — không giảm lại:
order.order_status = "cancelled"   # ← voucher không được hoàn
```
→ User tạo đơn dùng voucher rồi hủy → voucher bị tiêu 1 lượt. Nếu `max_uses = 100`, chỉ cần 100 user tạo+hủy đơn là voucher hết hạn dù chưa ai mua thành công.

**Sửa:** Tăng `current_uses` khi đơn `delivered` hoặc `completed`. Khi `cancel_order()` nếu đơn đang dùng voucher → `voucher.current_uses -= 1`.

---

### [V-4] 🟠 Không validate voucher shop — dùng nhầm shop được
**File lỗi:** `backend/app/services/order_service.py` line 44–57

**Vấn đề:**
`create_order()` chỉ kiểm tra:
```python
Voucher.code == data.voucher_code,
Voucher.status == "active",
```
Không check voucher có phải của shop đang mua không. User có thể lấy mã voucher của shop A và dùng khi mua hàng shop B.

**Sửa:** Khi áp dụng voucher, nếu là shop voucher thì check `voucher.created_by == order.shop_id` (hoặc sau khi có cột `voucher_type`: nếu `voucher_type == "shop"` thì verify shop).

---

### [V-5] 🟠 Checkout chỉ gửi 1 voucher_code dù UI chọn platform + shop riêng
**File lỗi:** `frontend/src/pages/user/CheckoutPage.tsx` line 379–390

**Vấn đề:**
Frontend có 2 loại voucher độc lập:
- `platformVoucherId` — voucher sàn
- `shopVoucherIds[shopId]` — voucher riêng từng shop

Nhưng khi submit đơn:
```ts
const selectedVoucherCode =
  platformSelected?.code ??
  shopBests[0]?.voucher.code ??
  undefined
// → Chỉ 1 mã được gửi, ưu tiên platform. Shop voucher bị bỏ.
```

Và `OrderCreate` schema backend cũng chỉ có `voucher_code: Optional[str]` (1 mã).

→ Toàn bộ logic chọn voucher shop trong UI là vô nghĩa — không được áp dụng.

**Sửa:** Backend cần hỗ trợ `platform_voucher_code` + `shop_voucher_code` (2 mã), tính discount cộng dồn. Hoặc đơn giản hơn: chỉ cho 1 voucher tại 1 thời điểm và giải thích rõ trong UI.

---

### [V-6] 🟠 `valid_from` không được kiểm tra — voucher chưa hiệu lực vẫn dùng được
**Files lỗi:** `backend/app/services/order_service.py`, `backend/app/services/voucher_service.py`

**Vấn đề:**
```python
# voucher_service._active_vouchers():
return [v for v in q.all() if v.valid_to is None or v.valid_to >= now]
# ← không check valid_from

# create_order() — không check valid_from luôn
```
→ Voucher có `valid_from = 2027-01-01` vẫn được dùng ngay hôm nay.

**Sửa:** Thêm `(v.valid_from is None or v.valid_from <= now)` vào cả `_active_vouchers()` và `create_order()`.

---

### [V-7] 🟠 VoucherManagementPage (shop) thiếu update và delete
**Files:** `frontend/src/pages/shop/VoucherManagementPage.tsx`, `frontend/src/services/shopService.ts`

**Vấn đề:**
Shop tạo voucher xong không thể:
- Tắt/bật voucher (đổi status)
- Sửa thông tin
- Xóa voucher nhầm

`shopService` chỉ có `getVouchers()` và `createVoucher()`. Không có `updateVoucher()`, `deleteVoucher()`. Backend `GET /api/v1/shop/vouchers` và `POST /api/v1/shop/vouchers` tồn tại nhưng thiếu `PUT` và `DELETE`.

**Sửa:** Thêm `PUT /api/v1/shop/vouchers/{id}` và `DELETE /api/v1/shop/vouchers/{id}` ở backend + cập nhật UI.

---

### [V-8] 🟡 `create_voucher` trong shop_service lưu Numeric dưới dạng String
**File lỗi:** `backend/app/services/shop_service.py` line ~190

**Vấn đề:**
```python
voucher = Voucher(
    discount_value=str(data.discount_value),      # ← str, nhưng column là Numeric(10,2)
    min_order_value=str(data.min_order_value)...  # ← tương tự
)
```
SQLAlchemy có thể tự convert, nhưng nếu giá trị là `"None"` thì INSERT sẽ fail. Nên truyền thẳng `float` / `Decimal`.

---

### [V-9] 🟡 `isVoucherEligible()` ở checkout không check `valid_from` và `max_uses`
**File:** `frontend/src/pages/user/CheckoutPage.tsx` line 16–32

**Vấn đề:**
```ts
const isVoucherEligible = (v, subtotal) => {
  if (v.status !== 'active') return false
  if (v.valid_to && new Date(v.valid_to) < new Date()) return false
  // ← không check valid_from (chưa đến ngày)
  // ← không check max_uses hết (remaining = 0)
  ...
}
```
→ UI hiển thị voucher chưa hiệu lực hoặc đã hết lượt trong dropdown cho user chọn → họ chọn nhưng backend reject → UX tệ.

---

---

## PHẢN HỒI & KHIẾU NẠI — Lỗ hổng

---

### [F-1] 🔴 Không có endpoint cho user gửi feedback
**Vấn đề:**
- Backend chỉ có `GET /admin/feedbacks` và `PATCH /admin/feedbacks/{id}` — admin xem và xử lý
- **Không có `POST /feedback`** nào cho user gửi phản hồi
- Table `feedbacks` có sẵn trong DB, nhưng không có đường vào cho user
- `FeedbackPage.tsx` (admin) hoạt động nhưng luôn trống vì không ai gửi được

**Sửa:** Thêm `POST /api/v1/feedback` (public, không cần auth hoặc chỉ cần login) → INSERT vào bảng `feedbacks`.

---

### [F-2] 🔴 `MyDisputesPage` dùng localStorage — không kết nối backend
**File:** `frontend/src/pages/user/MyDisputesPage.tsx`, `frontend/src/utils/disputeStore.ts`

**Vấn đề:**
```ts
// disputeStore.ts — dòng đầu file:
// "Lưu khiếu nại (dispute/complaint) tạm ở localStorage - phục vụ demo/test, chưa có backend thực"
import { getDisputesByComplainant, getDisputesByTarget, seedUserDemoDisputesIfNeeded }
  from '../../utils/disputeStore'
```
Toàn bộ trang "Khiếu nại của tôi" dùng localStorage mock:
- User tạo dispute → chỉ lưu trong browser, refresh mất, admin không thấy
- `DisputeResolutionPage` (admin) đọc từ DB `Dispute` table → **0 dispute** vì không ai insert được

Backend `Dispute` model + `GET/PUT /admin/disputes` đã có sẵn nhưng **không có `POST /disputes` cho user**.

**Sửa:**
1. Tạo `POST /api/v1/orders/{order_id}/dispute` (user tạo khiếu nại về đơn hàng)
2. Tạo `GET /api/v1/disputes/me` (user xem khiếu nại của mình)
3. Thay `disputeStore` trong `MyDisputesPage` bằng API calls thật

---

### [F-3] 🟠 `User.is_active` không tồn tại trong model — system notification crash
**File:** `backend/app/routes/admin.py` — `_broadcast_system_notification()`

**Vấn đề:**
```python
users = q.filter(UserModel.is_active == True).all()  # AttributeError
```
Model `User` không có cột `is_active` — chỉ có `status = "active"|"inactive"|"banned"`.

→ Mỗi lần admin nhấn "Gửi thông báo hệ thống" → server 500.

**Sửa:** Đổi thành `UserModel.status == "active"`.

---

### [F-4] 🟠 Shipper `rating` không bao giờ được cập nhật
**Files:** `backend/app/services/shipment_service.py`, không có rating_service

**Vấn đề:**
- `Shipper.rating` lưu dưới dạng `String` ("0.00") — không phải Numeric
- Không có logic nào tính và cập nhật rating sau giao hàng (user chưa có endpoint đánh giá shipper)
- `total_deliveries` tăng trong `mark_delivered()` nhưng rating mãi là "0.00"

**Sửa:** Thêm `POST /api/v1/orders/{order_id}/rate-shipper` (sau `delivered`) → tính average rating → update `Shipper.rating`.

---

### [F-5] 🟠 `ShipperBonus` table rỗng — không có logic tự động tạo bonus
**Files:** `backend/app/routes/shipments.py` (đọc), không có gì ghi

**Vấn đề:**
`BenefitsPage.tsx` gọi `GET /shipper/me/bonuses` → SELECT từ `shipper_bonuses`. Table luôn rỗng vì không có service nào tự động INSERT bonus (ví dụ: "giao 50 đơn/tháng" hay "5 sao liên tiếp"). Admin cũng không có UI để tạo bonus thủ công.

**Sửa:** Thêm `POST /admin/shippers/{id}/bonus` để admin tạo bonus thủ công. Bonus tự động cần cron job (ngoài scope hiện tại).

---

### [F-6] 🟠 Admin không có UI quản lý incidents của shipper
**Vấn đề:**
- Shipper có thể tạo incident qua `POST /shipper/me/incidents` ✅
- Nhưng admin không có page nào xem danh sách incidents, không có endpoint `GET /admin/shipper-incidents`
- `ShipperManagementPage` không có tab incidents

**Sửa:** Thêm `GET /api/v1/admin/shipper-incidents` + tab "Sự cố" trong `ShipperManagementPage.tsx`.

---

## BÁO CÁO & HỆ THỐNG — Lỗ hổng

---

### [S-1] 🔴 `report_voucher_usage` dùng `Voucher.used_count` — crash
**File:** `backend/app/routes/admin.py` lines 1479–1480

Đã ghi ở [V-1]. `Voucher.used_count` không tồn tại → `ReportsPage` crash khi load tab voucher.

---

### [S-2] 🔴 `GROUP BY alias` không hoạt động với PostgreSQL
**File:** `backend/app/routes/admin.py` lines 999, 1000, 1365–1366, 1377–1378

**Vấn đề:**
```python
db.query(..., extract("year", ...).label("year"), extract("month", ...).label("month"))
  .group_by("year", "month")   # ← PostgreSQL không hỗ trợ GROUP BY alias string
  .order_by("year", "month")   # ← tương tự
```
SQLite chấp nhận, **PostgreSQL raise `ProgrammingError: column "year" does not exist`**.

Ảnh hưởng: `report_user_growth`, `report_order_status` (dùng finance dashboard), và `GET /admin/finance` (line 993) đều dùng pattern này → crash trên Supabase/PostgreSQL.

**Sửa:** Đổi thành `.group_by(extract("year", ...), extract("month", ...))` hoặc dùng `text("1, 2")`.

---

### [S-3] 🟠 `AuditLogsPage` luôn trống — không có gì INSERT vào `admin_logs`
**Files:** `backend/app/routes/admin.py` line 701–705, `frontend/.../AuditLogsPage.tsx`

**Vấn đề:**
- `GET /admin/logs` SELECT từ `admin_logs` table ✅
- Nhưng không có middleware hay decorator nào INSERT vào `admin_logs` khi admin thực hiện action
- `EmployeeActivityLog` cũng rỗng tương tự — không có service log action employee
- → `AuditLogsPage` luôn hiển thị "Không có log"

**Sửa:** Thêm helper `log_admin_action(db, admin_id, action, target_type, target_id)` gọi sau mỗi action quan trọng (ban user, approve shop, reject product...).

---

### [S-4] 🟠 `ProductReview` — model tồn tại nhưng không có endpoint CRUD
**File:** `backend/app/models/product.py` — class `ProductReview`

**Vấn đề:**
- Model `ProductReview` có sẵn (rating, content, verified, helpful)
- `products.py` route trả về `rating`, `total_reviews` từ sản phẩm
- Nhưng **không có endpoint** `POST /products/{id}/review` hay `GET /products/{id}/reviews`
- `Product.rating` và `total_reviews` không bao giờ được cập nhật vì không có review nào được tạo
- Hiển thị rating "0.00" cho tất cả sản phẩm mãi mãi

**Sửa:** Thêm `POST /api/v1/products/{id}/review` (chỉ user đã mua), `GET /api/v1/products/{id}/reviews`, cập nhật `Product.rating = avg` và `total_reviews = count` sau mỗi review mới.

---

### [S-5] 🟡 Reports thiếu nhiều loại báo cáo quan trọng
**File:** `frontend/src/pages/admin/ReportsPage.tsx`

Backend chỉ có 4 reports: `user-growth`, `top-products`, `order-status`, `voucher-usage`.

Thiếu các report quan trọng đã được đề cập trong luận văn:
- Revenue by shop (doanh thu theo cửa hàng)
- Shipper performance (số đơn, rating, vi phạm)
- Warehouse throughput (số đơn qua kho theo ngày)
- Dispute/refund rate

---

### [S-6] 🟡 System logs chỉ ghi ra console, không ghi vào DB
**File:** `backend/app/models/logs.py` — class `SystemLog`

`SystemLog` table tồn tại nhưng `logging.getLogger(__name__)` chỉ log ra file/console. Không có handler nào INSERT vào bảng `system_logs`. Admin không xem được system logs từ UI.

---

## THỨ TỰ SỬA ĐỀ XUẤT

```
SPRINT 1 — Unblock cơ bản (fix crash)
├── [C-1]  Fix Shop.owner_id → shop_id                          (5 phút, 2 dòng)
├── [C-2]  Fix Product.status "active" → include "approved"     (10 phút, 3 chỗ)
├── [V-1]  Thêm cột voucher_type vào Voucher model + migration  (30 phút)
├── [V-2]  Fix admin create_voucher dùng sai field names        (10 phút)

SPRINT 2 — Voucher logic
├── [V-3]  Hoàn lại current_uses khi cancel_order               (15 phút)
├── [V-4]  Validate voucher shop đúng shop                      (10 phút)
├── [V-6]  Thêm valid_from check trong create_order + service   (10 phút)
├── [V-9]  Fix isVoucherEligible() ở frontend                   (10 phút)
├── [V-7]  Thêm PUT/DELETE /shop/vouchers/{id}                  (30 phút)
├── [V-5]  Quyết định: 1 voucher hay 2 voucher đồng thời        (thiết kế trước)

SPRINT 3 — Payout flow (core business logic)
├── [C-3] + [I-4] + [I-7] + [I-8]
│   Tạo service payout_service.py: sau confirm_received()
│   → ShipperTransaction + ShopWalletTransaction + PlatformTransaction
│   → Đọc rates từ RevenueConfig

SPRINT 4 — Shipping fee & dimensions
├── [I-1] + [I-2] Thêm modal nhập kích thước vào OrderManagement
│   → Truyền dimensions lên confirm-packing
│   → Backend cập nhật Order.final_price += extra_fee sau packing
├── [I-3] Bổ sung delivery_code + pkg_* vào GET /orders/{id}

SPRINT 5 — Warehouse tracking
├── [I-5] Cập nhật current_warehouse_id khi hub scan
├── [I-6] Set src/dest warehouse_id khi confirm-packing
├── [M-6] Hiển thị shipment logs trong OrderDetailPage

SPRINT 6 — Feedback & Dispute (user-facing)
├── [F-2]  Tạo POST /disputes + GET /disputes/me                 (45 phút)
│          Thay disputeStore.ts bằng API call trong MyDisputesPage
├── [F-1]  Tạo POST /feedback                                    (15 phút)
├── [F-3]  Fix User.is_active → User.status == "active"          (5 phút, 1 dòng)
│          (system notification không crash nữa)

SPRINT 7 — Reviews & Shipper quality
├── [S-4]  Tạo POST/GET /products/{id}/review                    (60 phút)
│          Cập nhật Product.rating + total_reviews sau review
├── [F-4]  Tạo POST /orders/{id}/rate-shipper                    (30 phút)
│          Tính avg và update Shipper.rating
├── [F-5]  Tạo POST /admin/shippers/{id}/bonus                   (20 phút)
├── [F-6]  Tạo GET /admin/shipper-incidents + tab trong UI        (45 phút)

SPRINT 8 — Reports fix & Audit logs
├── [S-2]  Fix GROUP BY alias → GROUP BY expression              (15 phút, 6 dòng)
│          Unblock toàn bộ admin reports tab
├── [S-3]  Thêm helper log_admin_action() vào các route quan trọng (60 phút)
├── [S-6]  SQLAlchemy log handler → INSERT vào system_logs       (optional)

SPRINT 9 — Polish
├── [M-1] Thêm delivery_code vào GET /orders/me
├── [M-2] Checkout: thay phí ship hardcode bằng text "tính sau"
├── [M-3] Verify role names trong DB
├── [M-4] Đánh dấu / ẩn warehouse pages cũ nếu không còn dùng
├── [V-8] Fix discount_value lưu String → Numeric
├── [S-5] Bổ sung thêm report types (shipper perf, revenue per shop)
```

---

## TÓM TẮT SỐ LƯỢNG

| Loại | Số lỗi | Ảnh hưởng |
|------|--------|-----------|
| 🔴 Critical | 8 | App crash / luồng tiền + voucher + reports broken |
| 🟠 Important | 19 | Tính năng chính không hoạt động đúng |
| 🟡 Minor | 11 | UX/data thiếu |
| **Tổng** | **38** | |

**Top 3 nghiêm trọng nhất:**
1. **[C-3] Payout flow** — toàn bộ hệ thống ví (shop wallet, shipper earnings, platform revenue) là vỏ rỗng
2. **[F-2] Dispute dùng localStorage** — user tạo khiếu nại nhưng admin không bao giờ nhận được
3. **[S-2] GROUP BY alias** — toàn bộ admin reports crash trên PostgreSQL/Supabase
