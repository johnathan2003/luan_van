# Kế hoạch: Cấu hình vận chuyển & Doanh thu 3 bên

---

## Hiện trạng hệ thống (đã đọc code)

### Cân nặng / kích thước — OrderManagement.tsx
```typescript
interface Dimensions { length: string; width: string; height: string; weight: string }
DEFAULT_DIMS = { length: '30', width: '20', height: '15', weight: '1.5' }

// Tính trong form xác nhận đóng gói:
const volume           = (l * w * h) / 1000              // đơn vị: dm³
const volumetricWeight = volume / 5                       // divisor cứng = 5
const chargeableWeight = Math.max(actualWeight, volumetricWeight)
```
→ **Divisor "5" đang hardcode** — cần đưa ra config.

---

### ShippingConfigPage.tsx — đã có 2 tab
| Tab | Nội dung |
|---|---|
| 🗺️ Vùng vận chuyển | Tên vùng, tỉnh áp dụng, phí cơ bản, phí/kg, thời gian (CRUD đầy đủ) |
| 📦 Phương thức VC | Tên, code, mô tả, bật/tắt |
| ❌ **Thiếu** | Tab cấu hình volumetric divisor + phí theo khối lượng kết hợp |

---

### Doanh thu — đang HARDCODE ở nhiều chỗ

**Backend** `app/routes/admin.py`:
```python
COMMISSION_RATE = 0.10      # → chỉ dùng để tính tổng commission trên chart
SHOP_RATE       = 0.70      # bình luận, chưa dùng thực
admin_fee   = rev * 0.15
shipper_fee = rev * 0.05
vat_fee     = rev * 0.10
shop_profit = rev * 0.70
```

**Frontend** `ShopRevenueDetailPage.tsx`:
```typescript
// Hardcode ở nhiều dòng:
profit    = total_revenue * 0.7
totalFees = total_revenue * 0.3
// Trong bảng giao dịch:
fee     = gross * 0.30
admin   = gross * 0.15
shipper = gross * 0.05
vat     = gross * 0.10
profit  = gross * 0.70
```

**Frontend** `FinancePage.tsx`:
```
"Admin nhận 25% (15% + VAT 10%) · Shipper 5% · Shop 70%"  ← hardcode string
```

---

## Phần 1 — Mở rộng Cấu hình vận chuyển

### 1.1 Thêm Tab 3: "⚖️ Phí theo kích thước"

**Vị trí:** `ShippingConfigPage.tsx` → thêm tab thứ 3 vào tabs hiện có.

**Logic chính:** Hệ thống có 5 bậc kích thước. Khi shop nhập dimensions, hệ thống tự xếp vào bậc phù hợp (nhỏ nhất mà gói hàng vừa), cộng phí bậc đó vào phí vận chuyển cơ bản.

**Bảng 5 bậc mặc định (admin có thể chỉnh):**

| Bậc | Kích thước tối đa (cm) | Cân tối đa | Phí thêm |
|---|---|---|---|
| 1 — Siêu nhỏ | 10 × 10 × 10 | 1 kg | 0₫ (free ship) |
| 2 — Nhỏ | 20 × 20 × 20 | 1 kg | +10,000₫ |
| 3 — Vừa | 30 × 30 × 30 | 1.5 kg | +25,000₫ |
| 4 — Lớn | 50 × 50 × 50 | 3.5 kg | +70,000₫ |
| 5 — Cồng kềnh | 100 × 100 × 100 | 5 kg | +120,000₫ |
| 6 — Quá khổ | Vượt bậc 5 | Không giới hạn | +200,000₫ |

> **Cách xếp bậc:** Mỗi thông số (dài/rộng/cao/cân) được xếp bậc độc lập → lấy **bậc cao nhất trong 4 thông số** làm bậc của đơn.  
>
> VD: Dài 8 cm · Rộng 8 cm · Cao 8 cm · Cân **3 kg**  
> → Dài/Rộng/Cao → bậc 1 · Cân 3 kg → bậc 4 (> 1.5 kg bậc 3, ≤ 3.5 kg bậc 4)  
> → **Lấy bậc cao nhất = bậc 4** · Phí: +70,000₫  
>
> VD 2: Dài **45** cm · Rộng 10 cm · Cao 10 cm · Cân 0.5 kg  
> → Dài 45 → bậc 4 · Rộng/Cao/Cân → bậc 1  
> → **Lấy bậc cao nhất = bậc 4** · Phí: +70,000₫

**Logic code:**
```typescript
// Tính bậc cho từng thông số riêng, lấy max
const tierForLength = tiers.findIndex(t => length <= t.max_length_cm)  // index bậc đầu tiên vừa
const tierForWidth  = tiers.findIndex(t => width  <= t.max_width_cm)
const tierForHeight = tiers.findIndex(t => height <= t.max_height_cm)
const tierForWeight = tiers.findIndex(t => weight <= t.max_weight_kg)
const assignedTier  = Math.max(tierForLength, tierForWidth, tierForHeight, tierForWeight)
// assignedTier === -1 (không vừa bậc nào) → bậc Quá khổ, phí 200,000₫
```

**Nội dung tab UI:**

```
┌──────────────────────────────────────────────────────────────┐
│  ⚖️ Phí theo kích thước & cân nặng                          │
│  Hệ thống tự xếp đơn vào bậc phù hợp khi shop đóng gói     │
├──────┬──────────────────────┬────────────┬───────────────────┤
│ Bậc  │ Kích thước tối đa    │ Cân tối đa │ Phí thêm          │
├──────┼──────────────────────┼────────────┼───────────────────┤
│  1   │ [10]×[10]×[10] cm    │ [1.0] kg   │ [0] ₫             │
│  2   │ [20]×[20]×[20] cm    │ [1.0] kg   │ [10000] ₫         │
│  3   │ [30]×[30]×[30] cm    │ [1.5] kg   │ [25000] ₫         │
│  4   │ [50]×[50]×[50] cm    │ [3.5] kg   │ [70000] ₫         │
│  5   │[100]×[100]×[100] cm  │ [5.0] kg   │ [120000] ₫        │
├──────┴──────────────────────┴────────────┴───────────────────┤
│  Hàng vượt bậc 5: phí cố định +200,000₫ (bậc "Quá khổ")    │
├──────────────────────────────────────────────────────────────┤
│  Preview: Dài [40] Rộng [25] Cao [20] Cân [0.8] kg          │
│  → Xếp vào: 📦 Bậc 4 (vì dài 40 > 30) · Phí thêm: +70,000₫│
├──────────────────────────────────────────────────────────────┤
│  [Khôi phục mặc định]              [💾 Lưu cấu hình]        │
└──────────────────────────────────────────────────────────────┘
```

**Preview live:** mỗi khi admin gõ dimensions vào ô Preview → hiển thị ngay bậc được xếp và phí tương ứng.

### 1.2 DB — Bảng `shipping_size_tiers`

```sql
CREATE TABLE shipping_size_tiers (
    tier_id        SERIAL PRIMARY KEY,
    tier_level     INTEGER NOT NULL UNIQUE,   -- 1..5, thứ tự ưu tiên
    label          VARCHAR(50),               -- "Siêu nhỏ", "Nhỏ", ...
    max_length_cm  INTEGER NOT NULL,
    max_width_cm   INTEGER NOT NULL,
    max_height_cm  INTEGER NOT NULL,
    max_weight_kg  NUMERIC(6,2) NOT NULL,
    extra_fee      INTEGER NOT NULL DEFAULT 0, -- VND, cộng thêm vào phí cơ bản
    updated_by     INTEGER REFERENCES users(user_id),
    updated_at     TIMESTAMP DEFAULT NOW()
);
-- Seed 5 rows mặc định khi migrate
-- Admin chỉnh sửa extra_fee và limits, KHÔNG thêm/xóa tier (số bậc cố định = 5)
```

**Lưu ý thiết kế:** Số bậc cố định 5, admin chỉ chỉnh số liệu trong từng bậc — không cho tạo/xóa bậc để tránh phức tạp logic.

### 1.3 API

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/admin/shipping/size-tiers` | admin | Lấy 5 bậc hiện tại |
| PUT | `/api/v1/admin/shipping/size-tiers` | admin | Cập nhật toàn bộ 5 bậc (gửi array) |
| GET | `/api/v1/shipping/size-tiers` | public | Shop/frontend đọc để tính phí |

### 1.4 Tích hợp vào OrderManagement.tsx

Khi shop mở modal "Xác nhận đóng gói":
1. Fetch `/api/v1/shipping/size-tiers` (cache 5 phút)
2. Khi shop nhập/thay đổi dims → tự động tính bậc:
   ```typescript
   const tier = tiers.find(t =>
     l <= t.max_length_cm && w <= t.max_width_cm &&
     h <= t.max_height_cm && weight <= t.max_weight_kg
   )
   // tiers đã sắp xếp tier_level ASC (bậc nhỏ nhất trước)
   ```
3. Hiển thị badge bậc + phí thêm ngay dưới ô nhập
4. Nếu không vừa bậc nào → xếp bậc "Quá khổ", phí thêm 200,000₫, hiển thị cảnh báo vàng
5. `extra_fee` được ghi vào shipment khi confirm packing

---

## Phần 2 — Cấu hình doanh thu % (Tài chính)

### 2.1 Vị trí trong UI

**Trang:** `FinancePage.tsx` (admin sidebar → Tài chính)

Thêm **Tab 3 mới**: `⚙️ Cấu hình doanh thu`

```
Tabs hiện có:           [📈 Tổng quan]  [🏪 Doanh thu shop]
Sau khi thêm:  [📈 Tổng quan]  [🏪 Doanh thu shop]  [⚙️ Cấu hình doanh thu]
```

### 2.2 Giao diện Tab "Cấu hình doanh thu"

```
┌─────────────────────────────────────────────────────────────┐
│  ⚙️ Cấu hình phân chia doanh thu                           │
│  Áp dụng cho mọi đơn hàng mới từ thời điểm lưu            │
├────────────────────────┬────────────────────────────────────┤
│                        │  Trực quan (Pie chart)             │
│  Shop nhận             │                                    │
│  [  70  ] %            │         ████ Shop 70%              │
│                        │      ██ Admin 15%                  │
│  Admin nhận            │    ██ VAT 10%                      │
│  [  15  ] %            │  █ Shipper 5%                      │
│                        │                                    │
│  Shipper nhận          │  Tổng: 100% ✅                     │
│  [   5  ] %            │                                    │
│                        │  ⚠️ Thay đổi ảnh hưởng            │
│  VAT                   │     toàn bộ đơn hàng mới           │
│  [  10  ] %            │                                    │
│                        │                                    │
│  Tổng: 100% ✅         │                                    │
├────────────────────────┴────────────────────────────────────┤
│  Lịch sử thay đổi:                                         │
│  2026-07-22  Admin thay đổi: Shop 70% → 68%, Admin 15%→17% │
│  2026-05-10  Cài đặt ban đầu: 70/15/5/10                   │
├─────────────────────────────────────────────────────────────┤
│  [Hủy]                              [💾 Lưu cấu hình]      │
└─────────────────────────────────────────────────────────────┘
```

**Validate:**
- Tổng 4 giá trị = 100% (server validate lẫn client)
- Mỗi giá trị > 0 và < 100
- VAT không được thay đổi nếu có ràng buộc thuế (cảnh báo, không chặn)
- Confirm dialog: "Thay đổi này áp dụng cho đơn hàng mới. Đơn đã hoàn thành giữ nguyên phân chia cũ."

### 2.3 DB — Bảng `revenue_config`

```sql
CREATE TABLE revenue_config (
    config_id     SERIAL PRIMARY KEY,
    shop_rate     NUMERIC(5,2) NOT NULL DEFAULT 70.00,     -- %
    admin_rate    NUMERIC(5,2) NOT NULL DEFAULT 15.00,     -- %
    shipper_rate  NUMERIC(5,2) NOT NULL DEFAULT 5.00,      -- %
    vat_rate      NUMERIC(5,2) NOT NULL DEFAULT 10.00,     -- %
    is_active     BOOLEAN DEFAULT TRUE,
    changed_by    INTEGER REFERENCES users(user_id),
    changed_at    TIMESTAMP DEFAULT NOW(),
    note          TEXT
);
-- Mỗi lần thay đổi → INSERT row mới (is_active=TRUE) + set row cũ is_active=FALSE
-- → tự động có lịch sử thay đổi
```

### 2.4 API

| Method | Endpoint | Auth | Mô tả |
|---|---|---|---|
| GET | `/api/v1/admin/revenue-config` | admin | Lấy config hiện tại + lịch sử |
| PUT | `/api/v1/admin/revenue-config` | superadmin | Cập nhật (chỉ superadmin được đổi) |
| GET | `/api/v1/system/revenue-config` | public | Frontend shop/shipper đọc để hiển thị |

**Response GET:**
```json
{
  "current": {
    "shop_rate": 70.0,
    "admin_rate": 15.0,
    "shipper_rate": 5.0,
    "vat_rate": 10.0,
    "changed_at": "2026-07-22T10:00:00",
    "changed_by_name": "superadmin"
  },
  "history": [...]
}
```

### 2.5 Nơi cần cập nhật sau khi có bảng config

**Backend** `app/routes/admin.py` — bỏ hardcode:
```python
# TRƯỚC:
admin_fee   = rev * 0.15
shipper_fee = rev * 0.05
vat_fee     = rev * 0.10
shop_profit = rev * 0.70

# SAU:
cfg = get_active_revenue_config(db)
admin_fee   = rev * (cfg.admin_rate   / 100)
shipper_fee = rev * (cfg.shipper_rate / 100)
vat_fee     = rev * (cfg.vat_rate     / 100)
shop_profit = rev * (cfg.shop_rate    / 100)
```

**Frontend** `ShopRevenueDetailPage.tsx` — thay 0.70, 0.30, 0.15, 0.05, 0.10:
```typescript
// Đọc từ API khi mount:
const cfg = await API.get('/api/v1/system/revenue-config')
// Rồi tính:
profit  = gross * (cfg.shop_rate    / 100)
adminF  = gross * (cfg.admin_rate   / 100)
shipF   = gross * (cfg.shipper_rate / 100)
vatF    = gross * (cfg.vat_rate     / 100)
```

**Frontend** `FinancePage.tsx` — thay string hardcode:
```typescript
// TRƯỚC: "Admin nhận 25% (15% + VAT 10%) · Shipper 5% · Shop 70%"
// SAU: đọc cfg và hiển thị động
`Shop ${cfg.shop_rate}% · Admin ${cfg.admin_rate}% · Shipper ${cfg.shipper_rate}% · VAT ${cfg.vat_rate}%`
```

---

## Phần 3 — Hiển thị doanh thu theo bên

### 3.1 View Shop nhìn thấy (ShopRevenueDetailPage)
Đã có UI, chỉ cần bỏ hardcode → đọc `revenue_config`.

| Hiện tại | Cần sửa |
|---|---|
| `"70% doanh thu"` hardcode | `${cfg.shop_rate}% doanh thu` từ config |
| `gross * 0.70` hardcode | `gross * (cfg.shop_rate/100)` |
| `Admin: 15%`, `Shipper: 5%`, `VAT: 10%` | Đọc từ config |

### 3.2 View Shipper nhìn thấy (EarningsPage)
Hiện chỉ xem transaction amount, không thấy %. Có thể thêm:
- Thông tin nhỏ: "Bạn nhận X% phí giao hàng" → đọc từ config.
- Không cần thêm cột vì shipper chỉ nhận fixed amount, không tính % từ GMV.

### 3.3 View Admin nhìn thấy (FinancePage)
- Tab tổng quan: thay string hardcode bằng dynamic
- Tab mới: cấu hình %

---

## Phần 4 — Hiển thị kích thước & phí ship ở các màn hình

### 4.1 Shop — Form thêm sản phẩm (ProductManagement.tsx)

**Hiện có** (line 1590–1640):
- 4 ô nhập: Dài / Rộng / Cao (cm) / Cân nặng (kg)  
- Tính tự động: Thể tích dm³ · Cân thể tích kg · Cân tính phí kg  
- Divisor đang hardcode `/5000` (= cm³/kg, tương đương /5 khi đã đổi sang dm³)

**Cần thêm** ngay bên dưới phần tính toán tự động:
```
┌─────────────────────────────────────────────────────────────┐
│  📦 Thể tích: 9.0 dm³  ·  Cân thể tích: 1.80 kg           │
│  ⚖️ Cân tính phí: max(1.5, 1.80) = 1.80 kg                │
├─────────────────────────────────────────────────────────────┤
│  🚚 Bậc vận chuyển được xếp:                               │
│  ▶ Bậc 3 — Vừa (≤ 30×30×30 cm, ≤ 1.5 kg)  +25,000₫      │
│                                                             │
│  Bảng phí tham khảo:                                       │
│  Bậc 1 · Siêu nhỏ  (10×10×10, 1kg)    →  Miễn phí        │
│  Bậc 2 · Nhỏ       (20×20×20, 1kg)    →  +10,000₫        │
│  Bậc 3 · Vừa       (30×30×30, 1.5kg)  →  +25,000₫  ◀ bạn │
│  Bậc 4 · Lớn       (50×50×50, 3.5kg)  →  +70,000₫        │
│  Bậc 5 · Cồng kềnh (100×100×100, 5kg) →  +120,000₫       │
│  Bậc 6 · Quá khổ   (vượt bậc 5)       →  +200,000₫       │
└─────────────────────────────────────────────────────────────┘
```

Bảng phí fetch từ `/api/v1/shipping/size-tiers` một lần khi mở form, cache lại. Badge bậc highlight động theo kích thước shop đang nhập.

---

### 4.2 Shipper — Đơn giao hàng (DeliveryListPage.tsx)

**Hiện có** trong card mỗi đơn: đơn #, địa chỉ lấy/giao, người nhận, số điện thoại, số tiền COD.

**Cần thêm** một dòng compact bên dưới địa chỉ:

```
📦 30×20×15 cm · ⚖️ 1.5 kg · Bậc 3 · Phí ship: +25,000₫
```

Và trong **Navigation Mode** (màn hình full-screen bản đồ) — thêm vào phần thông tin đơn phía trên:

```
┌──────────────────────────────┐
│  Đơn #1234   💵 COD 450,000₫ │
│  📦 30×20×15 cm  ⚖️ 1.5 kg   │
│  Bậc 3 · Phí ship +25,000₫  │
└──────────────────────────────┘
```

Dữ liệu này lấy từ shipment record (backend cần lưu `pkg_length`, `pkg_width`, `pkg_height`, `pkg_weight`, `size_tier`, `extra_fee` vào bảng `shipments` khi confirm packing).

---

### 4.3 Kho tổng (cấp 1) — HubShipmentsPage.tsx

**Hiện có** bảng: Mã vận chuyển / Đơn # / Nguồn→Đích / Người nhận / Trị giá / Shipper / Trạng thái.

**Cần thêm** cột "Kích thước" sau cột "Trị giá":

```
| Kích thước         |
| 30×20×15 · 1.5kg  |
| Bậc 3 · +25,000₫  |
```

Tất cả kho tổng (hub manager tier=1) đều thấy cột này — họ cần biết để kiểm soát hàng quá khổ.

---

### 4.4 Backend — Bảng `shipments` cần thêm cột

Khi shop `confirm-packing`, hệ thống xếp bậc và lưu vào shipment:

```python
# Thêm vào bảng shipments (migration):
pkg_length_cm  NUMERIC(6,1)   -- Dài (cm)
pkg_width_cm   NUMERIC(6,1)   -- Rộng (cm)
pkg_height_cm  NUMERIC(6,1)   -- Cao (cm)
pkg_weight_kg  NUMERIC(6,2)   -- Cân thực (kg)
size_tier      SMALLINT        -- Bậc 1–6 (6 = quá khổ)
extra_fee      INTEGER         -- Phí thêm (VND) theo bậc
```

Logic trong `POST /{order_id}/confirm-packing` (routes/orders.py):
```python
dims = payload.dimensions   # từ shop gửi lên
tiers = db.query(ShippingSizeTier).order_by(ShippingSizeTier.tier_level).all()

# Xếp bậc theo max của từng thông số
tier_l = next((t for t in tiers if dims.length <= t.max_length_cm), None)
tier_w = next((t for t in tiers if dims.width  <= t.max_width_cm),  None)
tier_h = next((t for t in tiers if dims.height <= t.max_height_cm), None)
tier_k = next((t for t in tiers if dims.weight <= t.max_weight_kg), None)

candidates = [t for t in [tier_l, tier_w, tier_h, tier_k] if t]
assigned = max(candidates, key=lambda t: t.tier_level) if candidates else None
size_tier = assigned.tier_level if assigned else 6   # 6 = quá khổ
extra_fee = assigned.extra_fee if assigned else 200000
```

---

## Thứ tự triển khai

| Bước | Việc | File |
|---|---|---|
| 1 | Migration: tạo `shipping_size_tiers` (5 rows seed) + `revenue_config` + thêm cột pkg_* vào shipments | migrations/new_file.py |
| 2 | Backend model + route GET/PUT `size-tiers` + `revenue-config` | models/admin_config.py + routes/admin.py |
| 3 | Cập nhật confirm-packing: nhận dims từ shop, xếp bậc, lưu pkg_* + extra_fee vào shipment | routes/orders.py |
| 4 | Cập nhật admin.py bỏ hardcode 0.15/0.05/0.10/0.70 → đọc revenue_config | routes/admin.py |
| 5 | Frontend: Tab 3 "Phí theo kích thước" trong ShippingConfigPage | ShippingConfigPage.tsx |
| 6 | Frontend: Tab 3 "Cấu hình doanh thu" trong FinancePage | FinancePage.tsx |
| 7 | Frontend: ProductManagement thêm bảng giá ship + badge bậc live | ProductManagement.tsx |
| 8 | Frontend: DeliveryListPage thêm dòng kích thước + bậc vào card đơn | DeliveryListPage.tsx |
| 9 | Frontend: HubShipmentsPage thêm cột kích thước | HubShipmentsPage.tsx |
| 10 | Frontend: Bỏ hardcode % trong ShopRevenueDetailPage + FinancePage | ShopRevenueDetailPage.tsx, FinancePage.tsx |

---

## Tổng hợp bảng DB cần thêm/sửa

| Bảng | Thay đổi |
|---|---|
| `shipping_size_tiers` | **Mới** — 5 bậc kích thước, admin chỉnh extra_fee + limits |
| `revenue_config` | **Mới** — % chia shop/admin/shipper/VAT, multi-row lưu lịch sử |
| `shipments` | **Thêm cột** — pkg_length/width/height/weight, size_tier, extra_fee |
