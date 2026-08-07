# Kế hoạch: Admin phân quyền nhân viên, duyệt Shipper & phân quyền Kho

---

## Phần 1 — Phân quyền nhân viên

### 1.1 Các quyền nhân viên cần có

Thay vì 1 role `employee` làm tất cả, chia thành các **quyền cụ thể** mà admin có thể bật/tắt cho từng nhân viên:

| Quyền | Mã | Cho phép làm gì |
|---|---|---|
| Xác nhận đơn hàng | `order_confirm` | Duyệt/xác nhận đơn từ khách |
| Xử lý hoàn tiền | `refund_manage` | Tạo yêu cầu hoàn tiền |
| Quản lý sản phẩm | `product_manage` | Thêm/sửa/xóa sản phẩm toàn sàn |
| Xử lý khiếu nại | `dispute_manage` | Phán xử tranh chấp shop-khách |
| Xem báo cáo | `report_view` | Xem doanh thu, thống kê |
| Quản lý voucher | `voucher_manage` | Tạo/tắt voucher toàn sàn |
| Hỗ trợ shipper | `shipper_support` | Xem thông tin shipper, ghi chú |
| Duyệt shipper | `shipper_approve` | Chỉ employee có quyền này mới được duyệt |

### 1.2 Cấu trúc phân quyền

Mỗi nhân viên có 1 **bộ quyền riêng** (không phải 1 role cứng). Admin gán quyền từng người.

```
Admin
  └── Nhân viên A: order_confirm + dispute_manage + report_view
  └── Nhân viên B: product_manage + voucher_manage
  └── Nhân viên C: shipper_approve + shipper_support
```

Bảng DB: `employee_permissions(user_id, permission_code, granted_by, granted_at, is_active)`

### 1.3 Luồng Admin phân quyền

**Tạo nhân viên mới:** Admin tạo tài khoản → chọn bộ quyền bằng checkbox → hệ thống gửi email mật khẩu tạm thời.

**Chỉnh sửa quyền:** Admin tìm nhân viên → bật/tắt từng quyền → hiệu lực ngay lập tức.

**Tạm đình chỉ:** Trạng thái `suspended` → không đăng nhập được, giữ nguyên bộ quyền để khôi phục sau.

---

## Phần 2 — Duyệt đăng ký Shipper

### ⚠️ Ghi chú triển khai UI
> Giao diện duyệt shipper **KHÔNG tạo trang mới**.
> Tích hợp thẳng vào trang **Quản Lý Shipper** đang có trong admin sidebar
> (menu: Vận Hành → Quản Lý Shipper).
> Thêm 2 tab vào trang này:
> - **Tab "Danh sách Shipper"** — danh sách shipper hiện tại (đang có)
> - **Tab "Đơn đăng ký"** — danh sách đơn pending/approved/rejected + nút duyệt/từ chối

### 2.1 Luồng đăng ký từ phía người dùng

```
Người dùng đăng nhập → vào trang /shipper/register
  → Điền form: CCCD, GPLX, đăng ký xe, loại xe, biển số, loại shipper
  → Upload ảnh: CCCD 2 mặt, GPLX, đăng ký xe
  → Gửi đơn → trạng thái: "pending"
```

Người dùng thấy trạng thái đơn đăng ký trên trang cá nhân: Chờ duyệt / Đã duyệt / Bị từ chối + lý do.

### 2.2 Luồng Admin/Nhân viên duyệt

**Admin hoặc nhân viên có `shipper_approve`** vào **Tab "Đơn đăng ký"** trong trang Quản Lý Shipper.

Danh sách hiển thị các cột: Họ tên, SĐT, loại shipper, loại xe, biển số, ngày nộp, trạng thái, nút **Xem hồ sơ**.

**Chi tiết hồ sơ (mở modal):**
- Ảnh CCCD, GPLX, đăng ký xe (xem fullscreen)
- Thông tin loại shipper muốn đăng ký
- Lịch sử nếu đã từng bị từ chối
- Ô ghi chú nội bộ (chỉ admin/nhân viên thấy)
- Nút **Duyệt** và **Từ chối**

**Duyệt:** Xác nhận → hệ thống tạo bản ghi `shippers`, gán role `shipper`, gửi thông báo.

**Từ chối:** Bắt buộc nhập lý do (chọn gợi ý hoặc tự gõ) → gửi thông báo → người dùng được nộp lại.

Lý do từ chối gợi ý: Ảnh không rõ nét / Giấy tờ không hợp lệ / Thông tin không khớp / Xe không đủ điều kiện.

### 2.3 Trạng thái đơn shipper

```
pending → approved → (shipper hoạt động bình thường)
        → rejected → (người dùng chỉnh sửa) → pending (lần 2)
```

### 2.4 Thông tin thu thập khi đăng ký

| Trường | Bắt buộc | Ghi chú |
|---|---|---|
| CCCD / CMND | ✓ | Ảnh mặt trước + sau |
| Giấy phép lái xe | ✓ | Ảnh, hạng phù hợp với xe |
| Đăng ký xe | ✓ | Ảnh giấy đăng ký |
| Loại xe | ✓ | Xe máy / Ô tô / Xe tải |
| Biển số xe | ✓ | |
| Loại shipper | ✓ | Tự do / Khu vực / Liên tỉnh |
| Tỉnh/thành phụ trách | Nếu khu vực | Cho zone shipper |
| Kho tổng gắn với | Nếu liên tỉnh | Cho inter-province shipper |

### 2.5 Phân biệt ai được duyệt

| Người duyệt | Điều kiện |
|---|---|
| Admin / Superadmin | Duyệt tất cả |
| Nhân viên | Chỉ khi có quyền `shipper_approve` |
| Hub Manager | Không được duyệt — chỉ gán shipper vào kho sau khi đã được admin duyệt |

---

## Phần 3 — Phân quyền Kho (Warehouse Permissions)

### 3.1 Tổng quan 3 cấp quyền kho

| Role | Cấp kho | Phạm vi |
|---|---|---|
| `warehouse_hub_manager` | Cấp 1 — Kho tổng | Toàn bộ kho quận + đơn liên tỉnh trong thành phố |
| `warehouse_district_manager` | Cấp 2 — Kho quận | Các kho phường trực thuộc quận đó |
| `warehouse_ward_manager` | Cấp 3 — Kho phường | Shipper + đơn trong phường đó |

Mỗi người chỉ được gán **1 kho duy nhất** và chỉ thấy dữ liệu trong phạm vi kho đó.

### 3.2 Điều kiện gán quyền kho

Người được gán phải có tài khoản trong hệ thống. Admin gán đồng thời:
- Role warehouse tương ứng
- Kho cụ thể (bảng `warehouse_managers`: `manager_id` ↔ `warehouse_id`)

Một kho chỉ có **1 manager chính** tại một thời điểm. Gán người mới → người cũ bị gỡ liên kết kho (không mất role).

### 3.3 Luồng Admin phân quyền kho

**Bước 1 — Chọn kho:**
Admin vào **Phân Cấp Kho** trong admin sidebar → chọn tab HN / HCM → xem cây kho 3 cấp.

```
Kho Tổng Hà Nội (cấp 1)      ← Manager: [Trống] hoặc [Nguyễn A]
  ├── Kho Hoàn Kiếm (cấp 2)   ← Manager: [Trống ⚠️]
  │     ├── Kho P. Hàng Bài   ← Manager: [Lê B]
  │     └── Kho P. Tràng Tiền ← Manager: [Trống ⚠️]
  └── Kho Đống Đa (cấp 2)     ← Manager: [Trần C]
```

Mỗi dòng hiển thị: tên kho, manager hiện tại (hoặc "⚠️ Chưa có manager"), nút **Gán manager**.

**Bước 2 — Gán manager:**
Nhấn "Gán manager" → popup tìm kiếm user theo tên/email → chọn → xác nhận.

Hệ thống tự động gán role phù hợp với tier kho + ghi vào `warehouse_managers` + notify người được gán.

**Bước 3 — Gỡ manager:**
Nhấn "Gỡ manager" → xác nhận → xóa liên kết kho + thu hồi role warehouse (giữ lại role `user` gốc).

### 3.4 Trang Phân Cấp Kho (Admin sidebar → Phân Cấp Kho)

**Tab 1 — Cây kho:** Toàn bộ cây tier 1 → 2 → 3, lọc theo thành phố, highlight đỏ kho chưa có manager.

**Tab 2 — Danh sách manager:** Bảng tất cả người đang có quyền kho: tên, email, role kho, kho đang quản lý, ngày gán, nút Gỡ quyền.

**Tab 3 — Kho chưa có manager:** Danh sách kho `active` nhưng chưa gán người — để admin ưu tiên lấp đầy.

### 3.5 Ràng buộc quan trọng

Kho cấp 2 chỉ gán manager được khi kho cấp 1 cha đã có manager. Tương tự cấp 3 cần cấp 2 có manager. Đây là điều kiện cứng đảm bảo chuỗi chỉ huy thông suốt.

Một user không quản lý 2 kho cùng lúc. Muốn chuyển người → gỡ kho cũ trước.

Hub Manager không tự gán manager cấp dưới — đó là quyền riêng của Admin.

### 3.6 Thống kê nhanh cho Admin

Trên trang Phân Cấp Kho, admin thấy ngay: tổng số kho (active/inactive), số kho chưa có manager (cảnh báo), phân bổ HN vs HCM.

---

## Tổng hợp bảng DB cần thêm/sửa

| Bảng | Thay đổi |
|---|---|
| `employee_permissions` | **Mới**: `user_id`, `permission_code`, `granted_by`, `is_active` |
| `shipper_registrations` | Thêm: `reviewed_note`, `resubmit_count` |
| `warehouse_managers` | Thêm: `granted_by`, `note` |
| `warehouses` | Đã có — cần đảm bảo `manager_id` nhất quán |

---

## Thứ tự ưu tiên triển khai

**Giai đoạn 1 — Phân quyền kho:** Hệ thống 3 cấp kho đang chạy nhưng admin chưa có UI gán manager. Trang "Phân Cấp Kho" đã có trong sidebar, cần xây nội dung bên trong.

**Giai đoạn 2 — Duyệt shipper:** Luồng đăng ký đã có, chỉ thiếu tab duyệt trong trang Quản Lý Shipper (đã có sẵn trong sidebar).

**Giai đoạn 3 — Phân quyền nhân viên:** Nhân viên đang dùng role cứng, cần tách ra quyền chi tiết.
