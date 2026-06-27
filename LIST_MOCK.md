# Danh sách Mock Data còn tồn tại trong Frontend

> Cập nhật: 2026-06-24  
> Phân loại: 🔴 Cần thay thế ngay · 🟡 Cần thay khi có API · 🟢 Có thể giữ (fallback / config tĩnh)

---

## 1. SHIPPER — Toàn bộ module chưa nối API thật

Backend đã có các endpoint tại `/api/v1/shipments/shipper/me/*`, nhưng **tất cả trang shipper vẫn dùng mock**.

| File | Mock | Trạng thái |
|------|------|------------|
| `pages/shipper/ShipperOverviewPage.tsx` | `MOCK_INFO` (rating, total_deliveries), `MOCK_DELIVERIES` | 🔴 |
| `pages/shipper/DeliveryListPage.tsx` | `MOCK_DELIVERIES` (10 đơn giả) | 🔴 |
| `pages/shipper/EarningsPage.tsx` | `MOCK_MONTHLY` (thu nhập 6 tháng), `MOCK_TRANSACTIONS` | 🔴 |
| `pages/shipper/IncidentsPage.tsx` | `MOCK_INCIDENTS`, `MOCK_VIOLATIONS` | 🔴 |
| `pages/shipper/BenefitsPage.tsx` | `MOCK_LEVEL` (cấp bậc, rating, đơn đã giao), `MOCK_BONUSES`, `MOCK_WELFARE` | 🔴 |
| `pages/shipper/WithdrawalPage.tsx` | `MOCK_BALANCE` (số dư), `MOCK_HISTORY` (lịch sử rút), `MOCK_BANKS` (danh sách ngân hàng) | 🔴 |

**API backend cần nối:**
- `GET /api/v1/shipments/shipper/me/deliveries` → ShipperOverviewPage, DeliveryListPage
- `GET /api/v1/shipments/shipper/me/rating` → ShipperOverviewPage, BenefitsPage
- Cần thêm: `GET /api/v1/shipper/me/earnings`, `GET /api/v1/shipper/me/balance`, `GET /api/v1/shipper/me/incidents`

---

## 2. ADMIN — Nhiều trang dùng mock làm fallback

| File | Mock | Cách xử lý hiện tại |
|------|------|----------------------|
| `components/admin/UserManagement.tsx` | `MOCK_USERS` (14 users giả) | Fetch API → fallback về mock nếu lỗi |
| `pages/admin/ApprovalPage.tsx` | `MOCK_SHOP_REGS`, `MOCK_SHIPPER_REGS`, `MOCK_PENDING_PRODUCTS` | Fetch API → fallback về mock |
| `pages/admin/AuditLogsPage.tsx` | `MOCK_LOGS` (10 log giả) | Fetch API → fallback về mock |
| `pages/admin/DeletionApprovalPage.tsx` | `MOCK_REQUESTS` | Fetch API → fallback về mock |
| `pages/admin/ShopManagementPage.tsx` | `MOCK_SHOPS` (3 shop giả) | Fetch API → fallback về mock |
| `pages/admin/SystemEmployeePage.tsx` | `MOCK_EMPLOYEES` (2 nhân viên giả) | Fetch API → fallback về mock |
| `pages/admin/OrderAdminPage.tsx` | `MOCK_ORDERS` (8 đơn giả, định nghĩa ngay trong file) | 🔴 Không nối API, chỉ dùng mock |
| `pages/admin/BannerAdminPage.tsx` | `MOCK_BANNERS` (3 banner giả) | 🟡 Chưa có bảng banner trong DB |
| `pages/admin/FeedbackPage.tsx` | `MOCK_FEEDBACKS` (5 feedback giả) | 🟡 Chưa có model feedback |
| `pages/admin/FinancePage.tsx` | `MOCK_TXN` (giao dịch tài chính giả) | 🟡 Chưa có module tài chính |
| `pages/admin/ShippingConfigPage.tsx` | `MOCK_ZONES`, `MOCK_METHODS` (cấu hình vận chuyển) | 🟡 Chưa có API cấu hình ship |
| `pages/admin/VoucherAdminPage.tsx` | `MOCK_VOUCHERS` (4 voucher giả) | 🟡 Có API voucher nhưng chưa nối |

---

## 3. SHOP — Component nhân viên

| File | Mock | Ghi chú |
|------|------|---------|
| `components/shop/EmployeeManagement.tsx` | `MOCK_EMPLOYEES` (3 nhân viên giả) | Fetch API → fallback về mock. Cần nối `GET /api/v1/shop/employees` |

---

## 4. FILE CẦN XÓA / KHÔNG CÒN DÙNG

| File | Ghi chú |
|------|---------|
| `src/mocks/mockOrders.ts` | `MOCK_ORDERS` và `findMockOrder` — không còn được import ở đâu, có thể xóa |

---

## 5. ĐÃ XỬ LÝ (không còn mock)

| Trang | Trước | Sau |
|-------|-------|-----|
| `pages/Home.tsx` — FlashSaleSection | `FLASH_ITEMS` (8 sp giả) | Fetch `/api/v1/shop/public/featured/products` |
| `pages/Home.tsx` — BuyZoMallSection | `MALL_ITEMS` (6 sp giả), `BRANDS` (8 brand giả) | Fetch `/api/v1/shop/public/mall/products` |
| `components/common/SuggestedDealsSection.tsx` | `BRAND_DEALS`, `PLATFORM_DEALS` | Fetch `/api/v1/shop/public/featured/products` |
| `components/common/Navbar.tsx` — SuggestBox | `SUGGEST_PRODUCTS`, `SUGGEST_BRANDS`, `SUGGEST_SHOPS` | Fetch API thật + debounce 300ms |
| `pages/user/OrderHistoryPage.tsx` | `MOCK_ORDERS` fallback | Empty state khi không có dữ liệu |
| `pages/user/OrderDetailPage.tsx` | `isMockOrderId`, `findMockOrder` | Xóa hoàn toàn |
| `pages/user/MyDisputesPage.tsx` | Demo disputes fallback | Empty state |
| `pages/user/CheckoutPage.tsx` | `SUGGESTED_PRODUCTS` cuối trang | Ẩn section |

---

## Thứ tự ưu tiên xử lý tiếp

1. **🔴 Cao** — `pages/admin/OrderAdminPage.tsx`: nối `GET /api/v1/admin/orders` (endpoint đã tồn tại)
2. **🔴 Cao** — Toàn bộ module Shipper: nối API `/api/v1/shipments/shipper/me/*`; cần thêm endpoints earnings/balance/incidents
3. **🟡 Trung** — `components/shop/EmployeeManagement.tsx`: nối `GET /api/v1/shop/employees`
4. **🟡 Trung** — `pages/admin/VoucherAdminPage.tsx`: nối `GET /api/v1/admin/vouchers`
5. **🟢 Thấp** — Banner, Feedback, Finance, ShippingConfig: cần thiết kế model + API trước
