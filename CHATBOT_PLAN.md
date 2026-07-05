# Kế hoạch AI Chatbot — E-Commerce Platform

> Phase 1: Kế hoạch & Ràng buộc toàn vẹn  
> Phase 2: Hiện thực (tiếp theo)

**Quyết định đã chốt:**
- Input: Chat text cho tất cả roles (không có voice)
- LLM: Claude API (Anthropic) — dùng tool_use feature
- Widget: Floating chat bubble, dùng chung 1 component, tùy biến per-role
- Proactive alert: Qua notification system có sẵn (`apps/notifications`)
- Shipper: Web only — không có GPS native, dùng địa chỉ văn bản thay thế

---

## 1. Tổng quan kiến trúc

```
[Floating Chat Bubble — React Component]
     │   (shared, tùy biến per-role)
     ▼
POST /api/bot/query/   ← Bearer JWT
     │
     ▼
[Django Bot View]
  1. Verify JWT → extract user + role
  2. Build system prompt theo role (admin / buyer / shop / shipper)
  3. Gọi Claude API với tool_use
     │
     ├── tool: query_stats(period, metric)   → Analytics queries
     ├── tool: filter_list(entity, filters)  → DB queries scoped by role
     ├── tool: get_order_status(order_id)    → Order + Delivery
     ├── tool: update_delivery_status(...)   → Shipper write only
     └── tool: trigger_notification(...)     → apps/notifications
     │
  4. Claude nhận kết quả tool → sinh câu trả lời tiếng Việt tự nhiên
     │
     ▼
Response JSON { message, data?, type }
     │
     ▼
[Chat Bubble hiển thị: text / table card / list]
```

**Nguyên tắc chung:**
- Bot chỉ **đọc** dữ liệu + trigger notification — không tự ghi vào DB ngoài luồng nghiệp vụ bình thường
- Mỗi tool call đều được scope theo `request.user` → không thể truy cập dữ liệu của role/người khác
- Tất cả roles đều dùng **chat text** — không có voice

---

## 2. ADMIN BOT

### Capabilities

| Nhóm | Câu lệnh ví dụ | Dữ liệu trả về |
|---|---|---|
| Thống kê tổng quan | "Doanh thu tháng này?" | Tổng revenue, số đơn, user mới |
| Xếp hạng shop | "Top 5 shop bán chạy tuần này?" | Shop + doanh số + rating |
| Lọc danh sách | "Shop nào đang bị khiếu nại?" | Danh sách shop + dispute count |
| Người dùng | "Có bao nhiêu user đăng ký hôm nay?" | Count + breakdown by role |
| Sản phẩm | "Sản phẩm nào bị report nhiều nhất?" | Product + report count |
| Đơn hàng | "Đơn hàng đang chờ xử lý?" | Count + danh sách |
| Shipper | "Shipper nào có rating thấp nhất?" | ShipperProfile.rating |
| Tài chính | "Tổng phí giao hàng thu được tháng 6?" | Delivery.fee aggregate |

### Input
- **Chat text** (không có voice)

### Ràng buộc toàn vẹn

1. **Chỉ admin** mới gọi được Admin Bot endpoint (`role == "admin"` check bắt buộc)
2. Bot **không thực hiện** ban user, xoá shop, hay thay đổi trạng thái đơn hàng — chỉ xem
3. Dữ liệu trả về **ẩn PII** cụ thể: email/số điện thoại user bị mask (vd: `hie***@gmail.com`)
4. Kết quả lọc danh sách giới hạn **tối đa 100 bản ghi** mỗi response
5. Câu hỏi liên quan tài chính cần thêm **xác nhận 2 bước** trước khi export ra file

---

## 3. USER (BUYER) BOT

### Capabilities

| Nhóm | Câu ví dụ | Dữ liệu trả về |
|---|---|---|
| Gợi ý sản phẩm | "Tôi muốn mua tai nghe không dây dưới 500k" | Danh sách product filter theo giá + category |
| So sánh sản phẩm | "So sánh iPhone 15 và Samsung S24" | Bảng so sánh: giá, rating, variants, shop |
| Theo dõi đơn | "Đơn hàng của tôi đang ở đâu?" | Order status + delivery tracking |
| Lịch sử mua | "Tôi đã mua gì tháng trước?" | Order history của user đó |
| Voucher | "Tôi có voucher nào dùng được không?" | Danh sách voucher còn hạn |
| Đánh giá | "Sản phẩm này có tốt không?" | Tổng hợp reviews + rating |

### Input
- **Chat text**

### Ràng buộc toàn vẹn

1. Query sản phẩm chỉ trả về **sản phẩm đang active** (`is_active=True`, stock > 0)
2. **So sánh**: chỉ so sánh được 2–3 sản phẩm mỗi lần, phải cùng category lớn
3. Thông tin đơn hàng: chỉ xem đơn của **chính user đó** (`order.user_id == request.user.id`)
4. Bot **không được** expose thông tin shop nội bộ (margin, cost giá)
5. Kết quả gợi ý **không ưu tiên shop trả tiền quảng cáo** — sort theo rating + sales thực
6. Rate limit: **20 queries/phút** mỗi user, tránh spam

---

## 4. SHOP (SELLER) BOT

### Capabilities

| Nhóm | Câu ví dụ | Dữ liệu trả về |
|---|---|---|
| Sản phẩm trending | "Khách đang xem nhiều sản phẩm nào nhất?" | Product view count rank |
| Cảnh báo tồn kho | "Sản phẩm nào sắp hết hàng?" | Product list: stock ≤ threshold |
| Báo cáo doanh thu | "Doanh thu tuần này so với tuần trước?" | Revenue chart (current vs previous) |
| Sản phẩm bán chạy | "Top sản phẩm bán chạy tháng này?" | OrderItem aggregation |
| Đơn hàng | "Đang có bao nhiêu đơn chờ xác nhận?" | Order count by status |
| Khách hàng | "Khách nào mua nhiều nhất shop tôi?" | Top buyers (ẩn email) |
| Nhân viên | "Nhân viên nào xử lý nhiều đơn nhất?" | Employee performance |

### Cảnh báo tự động (proactive)
- Đi qua **`apps/notifications`** có sẵn (không tạo hệ thống mới)
- Stock ≤ threshold → tạo Notification record + hiển thị trong bubble
- Đơn hàng pending > 2h → nhắc shop xác nhận
- Có dispute mới → alert ngay

### Ràng buộc toàn vẹn

1. **Scoped hoàn toàn theo shop**: mọi query đều `WHERE shop.owner = request.user` — không thể xem dữ liệu shop khác
2. Thông tin khách hàng trả về chỉ là **aggregated** (tổng số đơn, tổng chi tiêu) — không lộ tên/SĐT/địa chỉ cụ thể
3. **Ngưỡng cảnh báo tồn kho** do shop tự cấu hình (default: 10), lưu vào Shop model (cần thêm field `low_stock_threshold`)
4. Báo cáo tài chính chỉ trả về doanh thu sau khi trừ phí platform — không lộ cơ cấu phí nội bộ
5. So sánh với đối thủ: bot **không cung cấp** dữ liệu doanh thu cụ thể của shop khác

---

## 5. SHIPPER BOT

### Capabilities

| Nhóm | Câu ví dụ | Dữ liệu trả về |
|---|---|---|
| Danh sách đơn | "Hôm nay tôi có bao nhiêu đơn?" | Delivery list của shipper đó |
| Ưu tiên giao | "Đơn nào tôi nên giao trước?" | Sort theo `assigned_at` (cũ nhất trước) + quận/huyện gom cụm |
| Thu nhập | "Hôm nay tôi kiếm được bao nhiêu?" | `shipper_earn` tổng hôm nay |
| Tổng kết tuần | "Thu nhập tuần này?" | `ShipperProfile.total_earned` breakdown 7 ngày |
| Hiệu suất | "Rating của tôi đang là bao nhiêu?" | `ShipperProfile.rating` + so với trung bình hệ thống |
| Đơn thất bại | "Báo đơn giao thất bại vì khách không nhận" | Trigger cập nhật `Delivery.status = FAILED` + note |
| Trạng thái | "Tôi nghỉ 30 phút" | Cập nhật `ShipperProfile.status = OFFLINE` |
| Lộ trình | "Đường đến địa chỉ tiếp theo?" | Trả địa chỉ text + link Google Maps `?q=<địa chỉ>` |

> **Lưu ý Web-only:** Không dùng GPS tự động — "ưu tiên giao" dựa vào địa chỉ text (quận/huyện) thay vì tọa độ. `current_lat/lng` bỏ qua ở phase này.

### Ràng buộc toàn vẹn

1. Chỉ xem **đơn được assign cho mình** (`Delivery.shipper = request.user`)
2. **Cập nhật trạng thái** là hành động write duy nhất bot được phép — và chỉ theo chiều hợp lệ:
   - `assigned → picking_up → picked_up → in_transit → delivered/failed`
   - Không thể nhảy ngược (đã `delivered` không thể về `in_transit`)
3. Báo cáo thu nhập chỉ của **chính shipper đó** — không xem của người khác
4. Khi báo đơn thất bại: bắt buộc kèm **lý do** (không có ở nhà, địa chỉ sai, v.v.) → lưu vào `Delivery.note`
5. Link Google Maps dùng địa chỉ text, không yêu cầu quyền GPS browser

---

## 6. Ràng buộc toàn vẹn CHUNG

### Xác thực & Phân quyền
```
Mọi request đến Bot API:
  1. Verify JWT token
  2. Extract user.role
  3. Route đến đúng bot handler
  4. Mọi DB query trong handler đều có scope filter
```

### Data Isolation (không thể bypass)
| Role | Scope filter bắt buộc |
|---|---|
| admin | Không có filter (full access) |
| buyer | `user_id = request.user.id` |
| shop | `shop.owner_id = request.user.id` |
| shipper | `delivery.shipper_id = request.user.id` |

### Rate Limiting
| Role | Giới hạn |
|---|---|
| Admin | 60 queries/phút |
| User | 20 queries/phút |
| Shop | 30 queries/phút |
| Shipper | 30 queries/phút |

### Nguyên tắc Read-Only
- Bot **chỉ được phép write** trong 2 trường hợp ngoại lệ:
  1. Shipper cập nhật trạng thái giao hàng (nghiệp vụ bắt buộc)
  2. Shipper đổi `status` online/offline
- Mọi hành động write khác phải đi qua UI bình thường

### Logging & Audit
- Mọi bot query được log: `user_id`, `role`, `intent`, `timestamp`
- Admin queries tài chính yêu cầu log chi tiết hơn
- Không log nội dung chat (privacy) — chỉ log intent đã classify

---

## 7. Tech Stack đã chốt

| Thành phần | Quyết định | Ghi chú |
|---|---|---|
| LLM | **Claude API** (Anthropic) | Dùng `tool_use` để gọi backend functions |
| Claude model | `claude-haiku-4-5` hoặc `claude-sonnet-4-6` | Haiku nhanh + rẻ hơn cho queries đơn giản |
| Input | Chat text (tất cả roles) | Không có voice |
| Intent routing | Claude `tool_use` | Không cần train model riêng |
| Bot API | Django view `/api/bot/query/` | Tích hợp backend hiện có |
| Proactive alerts | `apps/notifications` có sẵn | Không tạo hệ thống mới |
| Frontend widget | **Floating chat bubble** — 1 React component | Hiển thị/ẩn per-role, vị trí fixed bottom-right |

### Luồng gọi Claude tool_use
```python
# Backend gọi Claude với tools được define sẵn per-role
response = anthropic.messages.create(
    model="claude-haiku-4-5-20251001",
    tools=get_tools_for_role(user.role),   # filter tools theo role
    messages=[
        {"role": "user", "content": user_message}
    ],
    system=get_system_prompt(user.role)    # system prompt tiếng Việt
)
# Claude trả về tool_use block → backend execute → trả kết quả lại Claude → final answer
```

---

## 8. Những field cần thêm vào DB (Phase 2)

| Model | Field cần thêm | Lý do |
|---|---|---|
| `Shop` | `low_stock_threshold` (IntegerField, default=10) | Ngưỡng cảnh báo tồn kho |
| `Product` | `view_count` (IntegerField, default=0) | Bot tracking trending |
| `BotQueryLog` | model mới: `user, role, intent, timestamp` | Audit logging |
| `ShipperProfile` | `shift_start` (DateTimeField, nullable) | Tính thu nhập theo ca |

---

## 9. Checklist trước Phase 2

### Đã chốt ✅
- [x] Input: Chat text cho tất cả roles
- [x] LLM: Claude API
- [x] Widget: Floating chat bubble
- [x] Proactive alert: qua `apps/notifications`
- [x] Shipper: Web only, không dùng GPS

### Còn cần làm trước khi code
- [ ] Thêm `ANTHROPIC_API_KEY` vào `.env` / Render secret
- [ ] Chốt model: `claude-haiku-4-5` (nhanh) hay `claude-sonnet-4-6` (thông minh hơn)?
- [ ] Bubble hiển thị với **tất cả** roles hay chỉ một số? (Employee có không?)
- [ ] System prompt: Claude trả lời **tiếng Việt** hay để user chọn ngôn ngữ?
- [ ] Lịch sử chat: lưu DB hay chỉ giữ trong session (mất khi đóng tab)?
