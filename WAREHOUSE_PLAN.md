# Kế hoạch hệ thống kho 3 cấp — BuyZO

> Phạm vi MVP: **Hà Nội** và **TP. Hồ Chí Minh**
> Trạng thái: Lên kế hoạch — chưa triển khai

---

## 1. Tổng quan

BuyZO áp dụng mô hình kho phân cấp 3 tầng (hub-and-spoke) để xử lý đơn hàng nội thành và liên tỉnh. Mỗi cấp có vai trò rõ ràng và chỉ quản lý cấp ngay bên dưới mình.

```
Cấp 1 (Kho tổng)
    └─ Cấp 2 (Kho quận/huyện)
            └─ Cấp 3 (Kho phường/xã)
                    └─ Shipper
```

---

## 2. Quy mô triển khai

| Cấp | Đơn vị | Hà Nội | TP.HCM | Tổng |
|-----|--------|--------|--------|------|
| Cấp 1 | Kho tổng thành phố | 1 | 1 | **2** |
| Cấp 2 | Kho quận/huyện | 30 | 22 | **52** |
| Cấp 3 | Kho phường/xã | ~584 | ~320 | **~904** |
| — | Shipper | N/phường | N/phường | — |
| **Tổng kho** | | **~615** | **~343** | **~958** |

---

## 3. Chi tiết từng cấp

### 3.1 Cấp 1 — Kho tổng (City Hub)

**Vai trò:** Điểm tập kết trung tâm của toàn thành phố.

**Nhiệm vụ:**
- Nhận toàn bộ đơn hàng liên tỉnh từ nơi khác chuyển đến
- Gom đơn hàng liên tỉnh từ nội thành để vận chuyển đi
- Phân loại đơn nội thành theo quận → đẩy xuống kho cấp 2

**Vị trí đề xuất:**
| Thành phố | Vị trí | Lý do |
|-----------|--------|-------|
| Hà Nội | Huyện Đông Anh hoặc Gia Lâm | Gần sân bay Nội Bài, kết nối quốc lộ 1A, 2, 3 |
| TP.HCM | Huyện Bình Chánh hoặc Củ Chi | Gần sân bay Tân Sơn Nhất, kết nối cao tốc |

---

### 3.2 Cấp 2 — Kho phân phối (District Hub)

**Vai trò:** Trung chuyển giữa kho tổng và kho phường.

**Nhiệm vụ:**
- Nhận lô hàng từ kho tổng đã phân loại theo quận
- Chia nhỏ theo phường → đẩy xuống kho cấp 3
- Gom đơn hoàn trả từ cấp 3 → trả lên cấp 1
- Điều phối khi kho phường quá tải

#### Hà Nội — 30 kho cấp 2

**12 quận nội thành:**
Ba Đình · Hoàn Kiếm · Tây Hồ · Long Biên · Cầu Giấy · Đống Đa · Hai Bà Trưng · Hoàng Mai · Thanh Xuân · Nam Từ Liêm · Bắc Từ Liêm · Hà Đông

**1 thị xã:**
Sơn Tây

**17 huyện ngoại thành:**
Ba Vì · Chương Mỹ · Đan Phượng · Đông Anh · Gia Lâm · Hoài Đức · Mê Linh · Mỹ Đức · Phú Xuyên · Phúc Thọ · Quốc Oai · Sóc Sơn · Thạch Thất · Thanh Oai · Thanh Trì · Thường Tín · Ứng Hòa

#### TP. Hồ Chí Minh — 22 kho cấp 2

**16 quận nội thành:**
Quận 1 · Quận 3 · Quận 4 · Quận 5 · Quận 6 · Quận 7 · Quận 8 · Quận 10 · Quận 11 · Quận 12 · Bình Thạnh · Gò Vấp · Phú Nhuận · Tân Bình · Tân Phú · Bình Tân

**1 thành phố thuộc TP:**
TP. Thủ Đức *(hợp nhất Quận 2 + Quận 9 + Thủ Đức cũ, 2021)*

**5 huyện ngoại thành:**
Bình Chánh · Cần Giờ · Củ Chi · Hóc Môn · Nhà Bè

---

### 3.3 Cấp 3 — Kho giao hàng (Last-mile)

**Vai trò:** Điểm cuối trước khi hàng đến tay người dùng.

**Nhiệm vụ:**
- Nhận kiện hàng từ kho quận theo địa chỉ phường
- Là nơi shipper lấy hàng mỗi ca
- Xử lý đơn giao thất bại / hoàn trả
- Lưu trữ tạm đơn chưa giao được

**Số lượng kho cấp 3 — Hà Nội (~584):**
| Khu vực | Số kho |
|---------|--------|
| 12 quận nội thành | ~183 phường |
| Thị xã Sơn Tây | 15 phường/xã |
| 17 huyện ngoại thành | ~386 xã/thị trấn |

**Số lượng kho cấp 3 — TP.HCM (~320):**
| Khu vực | Số kho |
|---------|--------|
| 16 quận nội thành | ~230 phường |
| TP. Thủ Đức | 34 phường |
| 5 huyện ngoại thành | ~56 xã/thị trấn |

---

### 3.4 Shipper — Người giao hàng

**Vai trò:** Nhận đơn từ kho phường, giao tận nhà người dùng.

**Quy tắc:**
- Mỗi kho cấp 3 có **ít nhất 1 shipper** trực thuộc
- Mỗi shipper **thuộc 1 kho phường cố định**
- Chỉ nhận đơn trong phường mình phụ trách
- Được quản lý trực tiếp bởi manager kho cấp 3

---

## 4. Luồng đơn hàng

### 4.1 Đơn hàng nội thành (cùng thành phố)

```
Shop xuất hàng
    → Kho phường người gửi (Cấp 3)
    → Kho quận người gửi (Cấp 2)
    → Kho tổng (Cấp 1)  ← phân loại theo quận đích
    → Kho quận người nhận (Cấp 2)
    → Kho phường người nhận (Cấp 3)
    → Shipper lấy hàng
    → Giao tận nhà
```

### 4.2 Đơn hàng liên tỉnh (HCM → HN)

```
Shop xuất hàng (TP.HCM)
    → Kho phường (Cấp 3 HCM)
    → Kho quận (Cấp 2 HCM)
    → Kho tổng HCM (Cấp 1)
        ↓ vận chuyển liên tỉnh (xe tải / máy bay)
    → Kho tổng HN (Cấp 1)
    → Kho quận người nhận (Cấp 2 HN)
    → Kho phường người nhận (Cấp 3 HN)
    → Shipper lấy hàng
    → Giao tận nhà
```

### 4.3 Đơn hàng hoàn trả

```
Người dùng từ chối nhận / shipper giao thất bại
    → Kho phường (Cấp 3) xác nhận hoàn
    → Kho quận (Cấp 2) gom hàng hoàn
    → Kho tổng (Cấp 1) xử lý hoàn liên tỉnh hoặc gửi về shop
```

---

## 5. Phân quyền quản lý

### 5.1 Vai trò (roles) cần thêm

| Role | Mô tả |
|------|-------|
| `warehouse_hub_manager` | Quản lý kho cấp 1 (city hub) |
| `warehouse_district_manager` | Quản lý kho cấp 2 (quận) |
| `warehouse_ward_manager` | Quản lý kho cấp 3 (phường) |
| `shipper` | Đã có sẵn trong hệ thống |

### 5.2 Quyền hạn theo cấp

#### Manager cấp 1

| Quyền | Chi tiết |
|-------|---------|
| ✅ Xem | Tất cả kho cấp 2 trong thành phố mình |
| ✅ Xem | Tất cả đơn liên tỉnh vào/ra |
| ✅ Xem | Báo cáo tổng hợp toàn thành phố |
| ✅ Làm | Tạo / vô hiệu hóa kho cấp 2 |
| ✅ Làm | Bổ nhiệm / xóa manager cấp 2 |
| ✅ Làm | Phân công lô hàng xuống kho quận |
| ✅ Làm | Gom đơn liên tỉnh → chuyển đi tỉnh khác |
| ❌ | Không xem kho của thành phố khác |
| ❌ | Không gán shipper trực tiếp |

#### Manager cấp 2

| Quyền | Chi tiết |
|-------|---------|
| ✅ Xem | Kho cấp 3 trong quận mình |
| ✅ Xem | Đơn hàng phân về từ kho tổng |
| ✅ Xem | Báo cáo theo từng phường |
| ✅ Làm | Tạo / vô hiệu hóa kho cấp 3 |
| ✅ Làm | Bổ nhiệm / xóa manager cấp 3 |
| ✅ Làm | Chia lô hàng xuống kho phường |
| ✅ Làm | Điều phối khi kho phường quá tải |
| ❌ | Không xem quận khác |
| ❌ | Không gán shipper trực tiếp |

#### Manager cấp 3

| Quyền | Chi tiết |
|-------|---------|
| ✅ Xem | Đơn hàng trong phường mình |
| ✅ Xem | Danh sách shipper trực thuộc |
| ✅ Xem | Trạng thái giao hàng real-time |
| ✅ Xem | Báo cáo hiệu suất shipper |
| ✅ Làm | Gán đơn cho shipper |
| ✅ Làm | Thêm / xóa shipper khỏi phường |
| ✅ Làm | Xác nhận đơn đã nhận từ kho quận |
| ✅ Làm | Xử lý đơn giao thất bại / hoàn trả |
| ❌ | Không xem phường khác |
| ❌ | Không tạo kho mới |

#### Shipper

| Quyền | Chi tiết |
|-------|---------|
| ✅ Xem | Danh sách đơn được gán hôm nay |
| ✅ Xem | Lịch sử giao hàng bản thân |
| ✅ Xem | Thông tin đơn + địa chỉ người nhận |
| ✅ Làm | Xác nhận đã lấy hàng từ kho phường |
| ✅ Làm | Cập nhật trạng thái đơn (đang đi / đã giao / thất bại) |
| ✅ Làm | Báo cáo sự cố / không giao được |
| ❌ | Không xem đơn của shipper khác |
| ❌ | Không chỉnh sửa thông tin đơn hàng |

---

## 6. Thiết kế database

### 6.1 Bảng `warehouses` (mở rộng từ bảng hiện có)

```sql
ALTER TABLE warehouses ADD COLUMN level        TINYINT NOT NULL DEFAULT 2;  -- 1/2/3
ALTER TABLE warehouses ADD COLUMN parent_id    INT REFERENCES warehouses(warehouse_id);
ALTER TABLE warehouses ADD COLUMN city         VARCHAR(100);  -- 'hanoi' | 'hcmc'
ALTER TABLE warehouses ADD COLUMN district     VARCHAR(100);  -- tên quận/huyện
ALTER TABLE warehouses ADD COLUMN ward         VARCHAR(100);  -- tên phường/xã (chỉ cấp 3)
ALTER TABLE warehouses ADD COLUMN ward_code    VARCHAR(20);   -- mã ĐVHC chuẩn
```

**Ý nghĩa `parent_id`:**
- Kho cấp 1: `parent_id = NULL`
- Kho cấp 2: `parent_id` → kho cấp 1 của thành phố
- Kho cấp 3: `parent_id` → kho cấp 2 của quận

### 6.2 Bảng `warehouse_managers` (mới)

```sql
CREATE TABLE warehouse_managers (
    id              SERIAL PRIMARY KEY,
    warehouse_id    INT NOT NULL REFERENCES warehouses(warehouse_id),
    user_id         INT NOT NULL REFERENCES users(user_id),
    manager_level   TINYINT NOT NULL,  -- 1/2/3 (khớp với level kho)
    assigned_by     INT REFERENCES users(user_id),
    assigned_at     TIMESTAMP DEFAULT NOW(),
    is_active       BOOLEAN DEFAULT TRUE,
    UNIQUE (warehouse_id, user_id)
);
```

### 6.3 Bảng `warehouse_shippers` (mới)

```sql
CREATE TABLE warehouse_shippers (
    id              SERIAL PRIMARY KEY,
    warehouse_id    INT NOT NULL REFERENCES warehouses(warehouse_id),  -- phải là kho cấp 3
    shipper_id      INT NOT NULL REFERENCES users(user_id),
    assigned_by     INT REFERENCES users(user_id),
    assigned_at     TIMESTAMP DEFAULT NOW(),
    status          VARCHAR(20) DEFAULT 'active',  -- active / off_duty / suspended
    UNIQUE (warehouse_id, shipper_id)
);
```

### 6.4 Enum role mới trong `users`

```sql
-- Thêm vào ENUM role hiện có
ALTER TYPE user_role ADD VALUE 'warehouse_hub_manager';
ALTER TYPE user_role ADD VALUE 'warehouse_district_manager';
ALTER TYPE user_role ADD VALUE 'warehouse_ward_manager';
-- 'shipper' đã tồn tại
```

---

## 7. Seed data (script chạy 1 lần)

### Nguồn dữ liệu
Dùng API công khai **provinces.open-api.vn** (`depth=3`) để lấy danh sách quận/huyện/phường chuẩn thay vì nhập tay.

```
GET https://provinces.open-api.vn/api/?depth=3
```

### Thứ tự seed

```
1. Tạo kho cấp 1 (2 bản ghi: HN + HCM)
2. Gọi API → lấy danh sách quận/huyện HN (30) và HCM (22)
3. Tạo kho cấp 2 (52 bản ghi), parent_id → kho cấp 1 tương ứng
4. Gọi API → lấy danh sách phường/xã của từng quận
5. Tạo kho cấp 3 (~904 bản ghi), parent_id → kho cấp 2 tương ứng
6. Mặc định is_active = FALSE (admin bật từng kho sau)
```

---

## 8. API endpoints cần xây dựng

### Backend

| Method | Endpoint | Mô tả | Role |
|--------|----------|-------|------|
| GET | `/warehouses/tree` | Lấy cây kho (cấp 1 → 2 → 3) | admin, hub_manager |
| GET | `/warehouses/{id}/children` | Kho con trực tiếp | manager cấp trên |
| POST | `/warehouses` | Tạo kho mới | admin, hub/district manager |
| PUT | `/warehouses/{id}` | Sửa thông tin kho | manager cấp trên |
| POST | `/warehouses/{id}/managers` | Bổ nhiệm manager | manager cấp trên |
| DELETE | `/warehouses/{id}/managers/{user_id}` | Xóa manager | manager cấp trên |
| GET | `/warehouses/{id}/shippers` | Danh sách shipper của kho phường | ward manager |
| POST | `/warehouses/{id}/shippers` | Thêm shipper vào kho phường | ward manager |
| DELETE | `/warehouses/{id}/shippers/{shipper_id}` | Xóa shipper | ward manager |
| POST | `/warehouses/{id}/assign-shipment` | Gán lô hàng xuống kho con | manager cấp trên |

### Frontend (trang cần tạo)

| Trang | Role xem | Mô tả |
|-------|----------|-------|
| `/hub/dashboard` | hub_manager | Tổng quan toàn thành phố |
| `/hub/warehouses` | hub_manager | Danh sách + quản lý kho cấp 2 |
| `/district/dashboard` | district_manager | Tổng quan quận |
| `/district/warehouses` | district_manager | Danh sách + quản lý kho cấp 3 |
| `/ward/dashboard` | ward_manager | Tổng quan phường |
| `/ward/shippers` | ward_manager | Quản lý shipper |
| `/ward/orders` | ward_manager | Đơn hàng cần giao trong phường |

---

## 9. Thứ tự triển khai

```
Giai đoạn 1 — Database & Seed
    [x] Migration: thêm cột level, parent_id, ward vào warehouses
    [x] Migration: tạo bảng warehouse_managers
    [x] Migration: tạo bảng warehouse_shippers
    [x] Migration: thêm 3 role mới vào enum users
    [x] Script seed: 2 kho cấp 1
    [x] Script seed: 52 kho cấp 2 (từ API)
    [x] Script seed: ~904 kho cấp 3 (từ API)

Giai đoạn 2 — Backend API
    [ ] Middleware phân quyền theo cấp kho
    [ ] CRUD warehouses (có kiểm tra level + parent)
    [ ] API quản lý managers
    [ ] API quản lý shippers
    [ ] API assign shipment

Giai đoạn 3 — Frontend
    [ ] Trang hub manager
    [ ] Trang district manager
    [ ] Trang ward manager
    [ ] Cập nhật trang shipper (lấy đơn từ kho phường)

Giai đoạn 4 — Tích hợp luồng đơn hàng
    [ ] Khi tạo đơn → tự động gán kho cấp 3 theo địa chỉ người gửi
    [ ] Logic phân loại theo quận tại kho cấp 1
    [ ] Cập nhật trạng thái đơn khi qua từng cấp kho
```

---

## 10. Câu hỏi mở (cần quyết định)

- [ ] Kho cấp 3 ở huyện ngoại thành (Ba Vì, Cần Giờ...) có cần không hay bỏ qua?
- [ ] 1 kho cấp 2 có thể do nhiều manager cùng quản lý không?
- [ ] Shipper có thể phục vụ nhiều phường (linh hoạt) hay cố định 1 phường?
- [ ] Khi mở rộng ra 61 tỉnh còn lại, cấp 3 có cần thiết không hay chỉ cần 2 cấp?
