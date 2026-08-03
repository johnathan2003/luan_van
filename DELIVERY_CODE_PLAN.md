# Kế hoạch hệ thống mã giao hàng & quy trình vận chuyển liên tỉnh

---

## 1. Tổng quan 2 loại mã

### Mã 1 — Mã đơn ship (Customer Delivery Code)

Gắn với từng đơn hàng cụ thể, theo suốt hành trình từ kho phường → shipper → khách hàng.

**Cấu trúc mã:** `SD-{YYYYMMDD}-{6 số ngẫu nhiên}`
Ví dụ: `SD-20260722-084512`

**Thông tin hiển thị trên phiếu giao:**
- Tên shop (người gửi)
- Họ tên người nhận
- Địa chỉ giao
- Tên hàng + số lượng
- SĐT: che 7 số đầu, hiện 4 số cuối — ví dụ `*******8901`
- Số tiền COD (hoặc `0₫ - đã TT online`)

---

### Mã 2 — Mã đơn liên tỉnh (Inter-Provincial Bundle Code)

Đóng gói nhiều mã đơn ship thành 1 kiện lớn vận chuyển giữa 2 thành phố.

**Cấu trúc mã:** `LT-{YYYYMMDD}-{tỉnh đi}-{tỉnh đến}-{4 số}`
Ví dụ: `LT-20260722-HN-HCM-0031`

**Thông tin gắn với mã liên tỉnh:**
- Kho xuất phát (Hub Hà Nội) + Kho đích (Hub TP.HCM)
- Danh sách mã đơn ship bên trong
- Tổng số kiện
- Tổng giá trị COD của cả bundle
- Thời gian xuất kho + nhân viên xác nhận
- Trạng thái: `pending → sealed → in_transit → arrived → distributed`

---

## 2. Quy tắc hiển thị SĐT

| Tình huống | Hiển thị | Ví dụ |
|---|---|---|
| Phiếu giao cho shipper | Che 7 số đầu | `*******8901` |
| Admin / quản lý kho | Hiện đầy đủ | `0901238901` |
| Khách hàng xem đơn của mình | Hiện đầy đủ | `0901238901` |
| API public (tra cứu đơn) | Che hết, chỉ xác nhận tồn tại | `Đơn hàng tồn tại ✓` |

Công thức che số: lấy 4 ký tự cuối, phần còn lại thay bằng `*`.

---

## 3. Quyền xem thông tin theo vai trò

| Thông tin | Shop | Kho (tất cả cấp) | Shipper | Khách hàng | Công khai |
|---|---|---|---|---|---|
| Tên shop | ✓ | ✓ | ✓ | ✓ | ✗ |
| Tên người nhận | ✓ | ✓ | ✓ | ✓ | ✗ |
| Địa chỉ giao | ✓ | ✓ | ✓ | ✓ | ✗ |
| SĐT đầy đủ | ✓ | ✓ | ✗ (che 7 số) | ✓ | ✗ |
| Số tiền COD | ✓ | ✓ | ✓ (tổng) | ✓ | ✗ |
| Vị trí hiện tại | ✓ | ✓ | ✓ | ✓ (tên kho) | ✓ (tên kho) |
| Breakdown hoa hồng | ✗ | ✗ | ✗ | ✗ | ✗ (Admin only) |

---

## 4. Quy trình đầy đủ: Đơn hàng Hà Nội → TP.HCM

---

### Giai đoạn 1 — Shop nhận đơn & đóng gói

Người mua đặt hàng trên hệ thống → đơn hàng xuất hiện trong dashboard của Shop.

Shop thấy đơn với trạng thái `Chờ xử lý`. Hệ thống **bắt buộc** Shop phải xác nhận đóng gói trước khi shipper đến lấy — không xác nhận thì shipper không được dispatch.

Khi Shop nhấn "Xác nhận đóng gói", hệ thống tự động:
- Sinh **Mã đơn ship** `SD-20260722-084512`
- Mở **form phiếu thông tin hàng** để Shop in ra dán lên kiện

**Nội dung phiếu thông tin hàng (bắt buộc in):**

```
┌─────────────────────────────────────────┐
│  BUYZO EXPRESS                          │
│  Mã đơn: SD-20260722-084512  [QR CODE] │
├─────────────────────────────────────────┤
│  NGƯỜI GỬI                             │
│  Shop: Thời Trang XYZ                  │
│  Địa chỉ lấy: 15 Cầu Giấy, Hà Nội    │
├─────────────────────────────────────────┤
│  NGƯỜI NHẬN                            │
│  Họ tên: Nguyễn Văn A                  │
│  Địa chỉ: 123 Lê Lợi, Q.1, TP.HCM    │
│  SĐT: *******8901                       │
├─────────────────────────────────────────┤
│  HÀNG HÓA                              │
│  Áo thun × 2, Quần jean × 1           │
├─────────────────────────────────────────┤
│  COD: 350.000₫  ← thu khi giao        │
└─────────────────────────────────────────┘
```

Nếu đã thanh toán online, ô COD in `ĐÃ THANH TOÁN ONLINE — KHÔNG THU TIỀN`.

---

### Giai đoạn 2 — Shipper khu vực lấy hàng từ Shop

Kho cấp 3 (khu vực Shop) phân công **shipper pickup** đến địa chỉ Shop lấy kiện.

Shipper scan mã QR trên phiếu → hệ thống cập nhật trạng thái đơn: `assigned_pickup`.

Shipper mang kiện về **Kho cấp 3** (kho phường khu vực Hà Nội).
Scan lần nữa khi nhập kho → trạng thái: `at_ward_warehouse`.

---

### Giai đoạn 3 — Leo thang qua 3 cấp kho tại Hà Nội

```
Kho phường (cấp 3)
      ↓  gom đơn, vận chuyển nội bộ
Kho quận (cấp 2)
      ↓  gom đơn từ các phường, vận chuyển lên
Kho tổng Hà Nội (cấp 1)
```

Mỗi lần chuyển tay giữa các kho đều scan mã SD để log vị trí.
Trạng thái lần lượt: `at_district_warehouse` → `at_hub_hanoi`.

---

### Giai đoạn 4 — Kho tổng Hà Nội tạo mã liên tỉnh

Hub manager Hà Nội gom toàn bộ đơn đi TP.HCM → tạo **Mã đơn liên tỉnh**:
`LT-20260722-HN-HCM-0031`

Mã liên tỉnh chứa:
- Danh sách tất cả mã SD bên trong
- Tổng số kiện
- Tổng giá trị COD của cả bundle
- Kho xuất (Hub HN) + Kho đích (Hub HCM)

Sau khi **seal** (niêm phong), không thêm/bớt đơn được nữa. Toàn bộ kiện lên xe vận chuyển liên tỉnh.

Trạng thái mã LT: `sealed → in_transit`
Trạng thái các mã SD bên trong: `in_transit_interprovincial`

---

### Giai đoạn 5 — Vận chuyển liên tỉnh

Xe chở kiện `LT-20260722-HN-HCM-0031` từ Hà Nội vào TP.HCM.

Khi xe đến **Kho tổng TP.HCM**, hub manager scan mã LT → xác nhận nhận hàng.

Hệ thống tự động:
- Cập nhật trạng thái mã LT: `arrived`
- Cập nhật toàn bộ mã SD bên trong: `at_hub_hcmc`

---

### Giai đoạn 6 — Phân phối xuống tại TP.HCM

```
Kho tổng TP.HCM (cấp 1)
      ↓  phân loại theo quận
Kho quận đích (cấp 2)
      ↓  phân loại theo phường
Kho phường đích (cấp 3)
      ↓  gán shipper giao
Shipper → Người nhận
```

Mỗi bước scan mã SD, trạng thái cập nhật:
`at_district_hcmc` → `at_ward_hcmc` → `out_for_delivery` → `delivered`

---

### Giai đoạn 7 — Giao hàng cho người nhận

Shipper cầm phiếu (in sẵn từ Giai đoạn 1) đến giao. Người nhận xác nhận nhận hàng, shipper thu COD nếu có.

Scan mã SD lần cuối → trạng thái: `delivered`.

Hệ thống kích hoạt phân chia hoa hồng: Shop 70% / Admin 15% / Shipper 5% / VAT 10%.

---

## 5. Bảng trạng thái xuyên suốt hành trình

| Trạng thái | Ý nghĩa |
|---|---|
| `pending` | Shop chưa xác nhận đóng gói |
| `packed` | Shop đã in phiếu, chờ shipper lấy |
| `assigned_pickup` | Shipper đang đến lấy tại shop |
| `at_ward_warehouse` | Đang ở kho phường HN |
| `at_district_warehouse` | Đang ở kho quận HN |
| `at_hub_hanoi` | Đang ở kho tổng HN |
| `in_transit_interprovincial` | Đang trên xe liên tỉnh |
| `at_hub_hcmc` | Đến kho tổng HCM |
| `at_district_hcmc` | Đang ở kho quận HCM |
| `at_ward_hcmc` | Đang ở kho phường HCM |
| `out_for_delivery` | Shipper đang đi giao |
| `delivered` | Giao thành công |
| `failed` | Giao thất bại → xử lý lại |

---

## 6. Các điểm lưu ý khi triển khai

**Tính duy nhất của mã:** Cả 2 loại mã phải unique tuyệt đối trong DB, dùng cột `UNIQUE` + retry nếu trùng.

**Scan QR tại kho:** Mỗi lần kiện hàng chuyển tay đều scan mã SD để cập nhật `current_warehouse_id` và log lịch sử vị trí.

**Đóng gói mã liên tỉnh:** Hub manager là người duy nhất có quyền tạo mã LT và thêm mã SD vào bundle. Sau khi seal, không thể thêm/bớt đơn nữa.

**Đối soát COD:** Quản lý kho phường thấy tổng COD theo ngày của từng shipper để đối soát cuối ca. Shipper chỉ thấy tổng số tiền cần thu, không thấy breakdown hoa hồng.

**Tra cứu công khai:** Khách hàng nhập mã SD trên website → thấy trạng thái đơn + tên kho hiện tại, không thấy thông tin shipper hay SĐT đầy đủ.

**Shop bắt buộc in phiếu:** Hệ thống không cho phép shipper pickup nếu Shop chưa xác nhận đóng gói và in phiếu. Đây là điều kiện cứng để đảm bảo thông tin đơn hàng luôn có trên kiện vật lý.
