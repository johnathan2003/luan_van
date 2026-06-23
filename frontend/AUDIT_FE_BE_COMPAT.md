# Rà soát tương thích Frontend ↔ Backend thật (BuyZo)

> Dựa trên đối chiếu code FE hiện tại với `FE_API_CHECKLIST.md` và `MERGE_GUIDE.md` do người dùng cung cấp.
> Đây là báo cáo rà soát — **chưa thực hiện sửa code nào**, chỉ liệt kê các điểm cần xử lý.

---

## 1. Nghiêm trọng — chặn luồng hoạt động chính khi đấu backend thật

1. **`CheckoutPage.tsx` chưa gọi API tạo đơn thật.**
   `handlePlaceOrder` hiện chỉ giả lập bằng `setTimeout(..., 1800)`, không hề gọi `orderService.create()` hay `POST /api/v1/orders`. Đặt hàng sẽ không lưu gì vào DB thật của backend.

2. **Bug unwrap response toàn cục.**
   Backend trả mọi response dạng `{ success, data, message }`. Axios wrap thêm 1 lớp `response.data`, nên dữ liệu thật nằm ở `res.data.data`. Các file dưới đây đang đọc `res.data` (thiếu 1 lớp), sẽ ra `undefined` khi đấu backend thật:
   - `authSlice.ts` — `login.fulfilled`, `register.fulfilled`, `checkAuth.fulfilled`, `updateProfile.fulfilled`
   - `cartSlice.ts` — `fetchCart.fulfilled`
   - `notificationSlice.ts` — `fetchNotifications.fulfilled`

3. **`cartSlice.ts` sai endpoint path.**
   - `fetchCart` → đang gọi `GET /api/v1/carts/me`, phải là `GET /api/v1/carts`
   - `clearCart` → đang gọi `DELETE /api/v1/carts/clear`, phải là `DELETE /api/v1/carts`

---

## 2. Code rác / song song (dead code) — đã xác nhận không được route

Kiểm tra `Router.tsx` xác nhận các trang `.jsx` cũ dưới đây **không xuất hiện trong route nào cả** (chỉ `pages/admin/AdminOverviewPage.tsx` là bản được dùng thật). Tức là đây là code chết, an toàn không ảnh hưởng người dùng hiện tại, nhưng nên dọn để tránh nhầm lẫn:

- `pages/buyer/*.jsx` (Cart, Checkout, Home, OrderDetail, OrderList, ProductDetail, Profile, TrackingPage)
- `pages/seller/*.jsx` (Dashboard, Inventory, Orders, ProductForm, Products)
- `pages/admin/Overview.jsx` (khác với `AdminOverviewPage.tsx` đang được route thật)
- `services/api/index.js` — file API cũ chứa `orderAPI`, `notificationAPI`, `adminAPI` với path/method sai (ví dụ `notificationAPI.markRead` dùng PATCH thay vì PUT, `adminAPI.overview()` gọi `/admin/overview` thay vì `/admin/dashboard`)
- `store/notificationStore.js` — một Zustand store cũ trùng chức năng với `notificationSlice.ts` (Redux), import `notificationAPI` cũ

Đáng chú ý: `pages/seller/Products.jsx` và `pages/admin/Overview.jsx` import `analyticsAPI` — **không tồn tại ở đâu trong codebase cả** — nếu lỡ bị gọi tới sẽ crash ngay lập tức.

---

## 3. Thiếu hẳn tính năng so với checklist

5. **Sổ địa chỉ (Address book) chưa tồn tại.** Không có `addressService.ts` nào trong code. Checkout hiện chỉ có form nhập địa chỉ tạm, không lưu qua `GET/POST/PUT /api/v1/users/me/addresses`.

6. **Chat chưa được xây dựng.** Không có `chatService.ts`, không có gọi `/conversations`, không có các socket event `join_conversation` / `send_message` / `new_message` / `mark_read` / `leave_conversation` ở đâu trong code.

7. **Thiếu lắng nghe socket `'order_update'`.** Checklist yêu cầu lắng nghe event này để cập nhật trạng thái đơn hàng real-time, hiện chưa có trong code.

---

## 4. Vấn đề nhỏ

8. **Notification demo (tính năng mới làm gần đây) thiếu role `'customer'`.**
   `NotificationRecipientType` trong `utils/notificationStore.ts` chỉ có `'user' | 'shop' | 'shipper' | 'admin'`. Backend thật trả `current_role: "customer"` cho khách hàng (không phải `"user"`), nên tài khoản customer thật sẽ không khớp với nhóm `'user'` trong hệ thống thông báo demo này. Chỉ ảnh hưởng phần demo/mock, không ảnh hưởng hệ thống thông báo thật (Redux + Socket.io).

9. **`adminService.unbanUser()` gọi route chưa xác nhận tồn tại trên backend.**
   Gọi `PUT /api/v1/admin/users/{id}/unban` — route này không nằm trong danh sách các route admin được checklist xác nhận. Cần backend xác minh trước khi dùng.

---

## Các phần đã đối chiếu và xác nhận ĐÚNG (không cần sửa)

- `authService.ts`, `authSlice.ts` (luồng login/register, trừ bug unwrap ở mục 2) — khớp checklist.
- `productService.ts`, `productSlice.ts` — đúng path `/products`, `/products/categories`.
- `orderService.ts` — đúng toàn bộ path (`/orders`, `/orders/me`, `/orders/{id}/...`).
- `shopService.ts`, `shipmentService.ts` — đúng toàn bộ path theo checklist.
- `adminService.ts` — đúng hết, trừ điểm 9 nêu trên.
- `Navbar.tsx` — đã dùng đúng `'customer'` khi so sánh role.
- `ProtectedRoute.tsx` — so sánh `role_name` trong mảng `roles[]`, không bị ảnh hưởng bởi vấn đề `current_role`.

---

*Báo cáo này chỉ mang tính rà soát — chưa có thay đổi code nào được áp dụng.*
