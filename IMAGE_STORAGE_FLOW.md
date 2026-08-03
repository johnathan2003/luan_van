# Quy trình lưu & phục vụ ảnh (Image Upload & Storage)

> Viết cho: đồng bộ hiểu biết giữa 2 phiên làm việc (2 máy) trên cùng project BuyZo.
> Cập nhật: 2026-08-02

---

## Tóm tắt nhanh (đọc trước)

- Ảnh **hiện đang lưu trên ổ đĩa local** của từng máy (`E:\luan_van\uploads\`), **KHÔNG phải Supabase Storage**, dù project có cấu hình sẵn Supabase.
- Thư mục `uploads/` bị **git-ignore** → ảnh không đi theo git, không tự đồng bộ giữa 2 máy.
- Vì vậy: máy A upload ảnh sản phẩm → ảnh chỉ nằm trên ổ máy A. Máy B (dù chung code, chung database) sẽ **404 khi hiển thị ảnh đó**, vì file vật lý không tồn tại trên máy B.
- Đây không phải bug — là hệ quả tất yếu của việc dùng local disk storage cho 1 project chạy trên nhiều máy. Cách sửa triệt để: xem mục **"Khuyến nghị"** ở cuối file.

---

## 1. Ảnh lưu ở đâu?

### Cấu hình (`backend/app/config.py`)
```python
UPLOAD_FOLDER: str = "uploads"
SUPABASE_URL: str = ""              # ← rỗng trong backend/.env hiện tại
SUPABASE_SERVICE_KEY: str = ""      # ← rỗng
SUPABASE_STORAGE_BUCKET: str = "uploads"
```

**Lưu ý quan trọng — dễ nhầm:** có 2 file `.env` khác nhau trong project:

| File | Ai đọc | Supabase credentials |
|---|---|---|
| `E:\luan_van\.env` (gốc) | docker-compose, Prisma, tooling Node | **CÓ điền** (SUPABASE_URL thật) |
| `E:\luan_van\backend\.env` | Backend FastAPI (Settings class) | **RỖNG** |

Backend chỉ đọc `backend/.env`. Vì SUPABASE_URL rỗng ở đó → hệ thống tự động rơi vào **chế độ lưu local disk**, bất kể file `.env` gốc có điền Supabase hay không.

### Docker mount
```yaml
# docker-compose.yml
backend:
  volumes:
    - ./uploads:/app/uploads   # bind mount — ảnh tồn tại NGOÀI container, trên ổ host
```
Container ghi vào `/app/uploads`, thực chất là ghi thẳng vào `E:\luan_van\uploads\` trên máy Windows đang chạy Docker đó.

### Code ghi file thực tế
`backend/app/utils/upload_service.py` — hàm `save_upload_file()`:
```python
if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_KEY:
    # nhánh Supabase Storage — HIỆN KHÔNG CHẠY vì .env rỗng
    ...
else:
    # nhánh local disk — ĐANG CHẠY THỰC TẾ
    folder = os.path.join(settings.UPLOAD_FOLDER, subfolder)
    os.makedirs(folder, exist_ok=True)
    file_path = os.path.join(folder, filename)
    async with aiofiles.open(file_path, "wb") as f:
        await f.write(content)
    return f"/uploads/{subfolder}/{filename}"
```
Tên file luôn được random hoá: `f"{uuid.uuid4().hex}.{ext}"` — không giữ tên gốc, không timestamp.

---

## 2. Các endpoint upload đang thực sự hoạt động

Toàn bộ backend chỉ có **2 endpoint** thật sự nhận file (`UploadFile`):

| Endpoint | File backend | Subfolder | Lưu vào DB |
|---|---|---|---|
| `POST /api/v1/products/upload-image` | `routes/products.py` | `uploads/products/` | Trả về `{"url": "/uploads/products/<uuid>.jpg"}` — frontend tự lưu url này vào `Product.image_urls`, banner, thư viện ảnh... |
| `POST /api/v1/users/me/avatar` | `routes/users.py` | `uploads/users/` | Ghi thẳng vào `User.avatar_url` |

Giới hạn: tối đa 10MB (`MAX_FILE_SIZE`), chỉ nhận `image/jpeg`, `image/png`, `image/webp`, `image/gif` (endpoint sản phẩm nhận thêm `application/pdf`).

### Các trường ảnh có TRONG SCHEMA nhưng CHƯA CÓ upload thật (cần lưu ý khi làm tiếp)
Những field này chỉ là chuỗi string trong JSON body, chưa có nút upload / endpoint xử lý file riêng:
- `ShopRegistration.cmnd_url / cmnd_back_url / business_reg_url` (đăng ký shop)
- `ShipperRegistration.license_url / registration_url / id_card_url` (CCCD, GPLX shipper)
- `Dispute.evidence_urls` (bằng chứng tranh chấp — hiện là text tự do)
- `Banner.image_url` (admin dán URL tay, thường lấy từ endpoint upload-image sản phẩm)

Thư mục `uploads/shops/`, `uploads/shippers/`, `uploads/docs/` đã được tạo sẵn (chỉ có `.gitkeep`) nhưng code chưa gọi tới — coi như đã "để dành chỗ" cho việc làm sau này.

---

## 3. Ảnh được phục vụ (serve) lại thế nào?

`backend/app/main.py`:
```python
if not settings.SUPABASE_URL:
    app.mount("/uploads", StaticFiles(directory=settings.UPLOAD_FOLDER), name="uploads")
```
→ File tại `uploads/products/abc.jpg` trên đĩa sẽ truy cập được qua `http://<backend-host>:8000/uploads/products/abc.jpg`. Không có kiểm tra quyền — ai có URL đều xem được.

## 4. Frontend ráp URL ảnh

`frontend/src/utils/helpers.ts`:
```ts
export const getImageUrl = (url?: string | null): string => {
  if (!url) return '/images/placeholder.png'
  if (url.startsWith('http')) return url          // URL tuyệt đối (vd Supabase, picsum) → giữ nguyên
  return `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}${url}`  // path tương đối → ghép domain backend
}
```
DB chỉ lưu path tương đối kiểu `/uploads/products/xxx.jpg`; frontend tự ghép `VITE_API_URL` (`http://localhost:8000` theo `.env.local`) vào trước để ra URL đầy đủ.

---

## 5. Vì sao 2 máy dùng chung không thấy ảnh của nhau

```
Máy A: upload ảnh → lưu vào E:\luan_van\uploads\products\xxx.jpg (chỉ trên máy A)
                  → DB ghi: Product.image_urls = ["/uploads/products/xxx.jpg"]

Máy B: đọc cùng DB (nếu 2 máy trỏ chung 1 database) → thấy path "/uploads/products/xxx.jpg"
     → gọi http://localhost:8000/uploads/products/xxx.jpg trên MÁY B
     → backend máy B tìm trong uploads/ của MÁY B → KHÔNG CÓ file này → 404 → ảnh vỡ
```

Nguyên nhân gốc: `uploads/` bị `.gitignore` (`uploads/.gitignore` chỉ giữ lại `.gitkeep`, còn lại `*` bị bỏ qua) nên ảnh không bao giờ được commit/đồng bộ qua git. Đây là thư mục hoàn toàn cục bộ (local-only) của từng máy.

*(Trong repo hiện có file `uploads_backup.zip` ở gốc — có vẻ là cách đồng bộ thủ công đã dùng trước đây: zip thư mục uploads rồi gửi/copy qua máy kia.)*

---

## 6. Khuyến nghị hướng xử lý

| Hướng | Việc cần làm | Ưu điểm | Nhược điểm |
|---|---|---|---|
| **A. Bật Supabase Storage (khuyến nghị)** | Điền `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_STORAGE_BUCKET` thật vào **`backend/.env`** (không phải `.env` gốc) | Code đã viết sẵn đầy đủ trong `upload_service.py`, chỉ cần bật config. Ảnh lên cloud, máy nào cũng xem được ngay | Cần tạo bucket trên Supabase, set policy public-read |
| **B. Đồng bộ thủ công** | Zip/nén `uploads/` định kỳ, chuyển qua máy kia (giống `uploads_backup.zip` đã có) | Không cần đổi code | Dễ quên, dễ lệch dữ liệu, không realtime |
| **C. Volume/máy chủ dùng chung** | Đặt `uploads/` trên 1 máy chủ chung (NAS, VPS) và 2 máy cùng trỏ backend tới đó | Đơn giản về mặt logic | Cần hạ tầng mạng, không hợp dev local |

**Khuyến nghị: chọn hướng A** — hạ tầng đã sẵn sàng 90%, chỉ thiếu bước điền credentials + tạo bucket trên Supabase Dashboard.

---

## 7. Bảng file tham chiếu nhanh

| Việc | File |
|---|-
| Cấu hình storage | `backend/app/config.py` |
| Bật static serve / Supabase | `backend/app/main.py` |
| Logic lưu file thật | `backend/app/utils/upload_service.py` |
| Endpoint upload ảnh sản phẩm | `backend/app/routes/products.py` (~dòng 155) |
| Endpoint upload avatar | `backend/app/routes/users.py` (~dòng 61) |
| Field ảnh chưa có upload thật | `backend/app/schemas/user.py` (dòng 133–148) |
| Docker volume mount | `docker-compose.yml` |
| Env backend thực tế đọc | `backend/.env` |
| Ghép URL ảnh ở FE | `frontend/src/utils/helpers.ts` (`getImageUrl`) |
| Gọi upload từ FE | `frontend/src/services/productService.ts`, `frontend/src/services/userService.ts` |
