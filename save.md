# So sánh & merge nhánh `main` (luan_van) và nhánh `front` (luan_van2)

Ngày kiểm tra: 2026-08-07
Repo: `github.com/johnathan2003/luan_van`

**Cập nhật: đã merge xong.** Commit merge: `f1e9a5d` ("Merge branch 'front' (fe80f8f) into main"),
nằm trên `main`, sau checkpoint `66058f0`. Toàn bộ nội dung bên dưới vẫn giữ lại làm hồ sơ đối
chiếu — phần "Việc cần làm tiếp" ở cuối file đã được cập nhật theo trạng thái mới.

Tóm tắt cách merge: dùng `git merge` thật (không copy tay) để tận dụng 3-way merge của git cho
phần không chồng lấn, rồi xử lý thủ công từng file có conflict thật. Trong 93 file khác nhau giữa
2 nhánh, chỉ 27 file thực sự conflict — 66 file còn lại git tự gộp đúng. Với 27 file conflict, đọc
kỹ cả 2 phía trước khi quyết định (không có file nào bị ghi đè mù quáng):

- 5 file backend Python + `warehouse_accounts.py`: giữ bản `main` vì có thêm tính năng thật
  (gán tài khoản có sẵn, tìm user, reset mật khẩu) mà front chưa có.
- `admin.py` (route shipper-registrations): lấy bản `front` vì đầy đủ field hơn.
- `shipment.py`: gộp — thêm cột `vehicle_photo_url` từ front (chưa có migration, xem mục 4 cũ).
- `202608020002_add_phone...py`: giữ bản no-op của main (front vẫn add_column trùng, sẽ lỗi khi chạy).
- `202608030001_add_status_to_shops.py` + `backup.dump`: xoá hẳn (giữ theo quyết định của main).
- `ApprovalPage.tsx`: gộp thật — sửa 1 bug thật của main (bấm duyệt shipper lại gọi nhầm API duyệt
  shop) bằng cách của front, đồng thời giữ tính năng xem ảnh sản phẩm/giấy phép của main + thêm
  doc CCCD từ front.
- `LoginForm.tsx`: gộp — giữ animation của main + thêm tooltip nút ẩn/hiện mật khẩu từ front.
- 19 file còn lại (Router, AdminLayout, các trang admin/hub/warehouse, services, utils...): giữ bản
  `main` — sau khi đọc kỹ, bản front ở các file này hoặc giống hệt (chỉ khác định dạng), hoặc là bản
  cũ hơn/thiếu tính năng so với main (ví dụ ShopManagementPage của front chỉ có nút `alert()` giả,
  main đã làm thật đình chỉ/kích hoạt/xoá shop).

Đã verify sau merge: toàn bộ file `.py` thay đổi compile sạch; chuỗi migration Alembic chỉ còn
đúng 1 head duy nhất (`202608040001`), không còn revision ID trùng.

- `main` (thư mục `luan_van`) — HEAD: `523aa52` ("Merge remote-tracking branch 'origin/front'")
- `front` (thư mục `luan_van2`) — HEAD: `fe80f8f` ("fix_banner_admin")
- Tổ tiên chung (merge-base): `e5ca631` ("giaodien2")

**Lưu ý quan trọng:** bản `origin/front` được cache sẵn trong repo `luan_van` đã cũ (dừng ở `e5ca631`), tức là commit đúng thời điểm 2 nhánh tách ra. Nhánh `front` thật trên GitHub đã đi tiếp 2 commit nữa (bao gồm 1 commit merge ngược `main` vào `front`). Vì vậy bảng so sánh dưới đây được lấy bằng cách fetch trực tiếp từ working copy `luan_van2` (đã có bản mới nhất) rồi chạy `git diff` — chính xác hơn nhiều so với so sánh 2 thư mục theo kiểu `diff -r` thông thường.

---

## 1. Đã xử lý: khôi phục file bị xoá nhầm trong working tree của `main`

Working tree của `luan_van` có 21 file bị đánh dấu "deleted" (`git status`) dù các file này **vẫn tồn tại trong commit HEAD** — tức là bị xoá nhầm trong lúc thao tác merge/dọn dẹp trước đó, không phải chủ đích. Đã chạy `git checkout HEAD -- <file>` để khôi phục 20/21 file sau (an toàn tuyệt đối, không đổi nội dung, chỉ đưa file về đúng trạng thái đã commit):

```
ADMIN_PERMISSIONS_PLAN.md, CHATBOT_PLAN.md, Check_List.md, DELIVERY_CODE_PLAN.md,
DEPLOYMENT_PLAN.md, DEPLOYMENT_PLAN_V2.md, Frontend_Analysis.md, IMAGE_STORAGE_FLOW.md,
INFINITE_SCROLL_PLAN.md, INTEGRATION_GAP_PLAN.md, LIST_MOCK.md,
NOTE_DAU_GIA_BANNER_FLASH_SALE.md, PRE_DEPLOY_CHECKLIST.md, RUN_MIGRATION.md,
SETUP.md, SHIPPING_REVENUE_PLAN.md, WAREHOUSE_PLAN.md, fix_log.md, rule.md, tree.md
```

Trong 20 file trên, 7 file (`ADMIN_PERMISSIONS_PLAN.md`, `DELIVERY_CODE_PLAN.md`, `IMAGE_STORAGE_FLOW.md`, `INFINITE_SCROLL_PLAN.md`, `INTEGRATION_GAP_PLAN.md`, `SHIPPING_REVENUE_PLAN.md`, `WAREHOUSE_PLAN.md`) có nội dung **khác với bản trên `front`** (front có bản chỉnh sửa mới hơn) — cần tự xem lại nội dung để quyết định giữ bản nào hoặc gộp tay. 13 file còn lại giống hệt bản `front`, không cần làm gì thêm.

File thứ 21, `backend/migrations/versions/202608030001_add_status_to_shops.py`, **KHÔNG được khôi phục** — xem mục 4 bên dưới (đây là 1 bug, khôi phục lại sẽ tái tạo lỗi trùng revision ID).

---

## 2. File chỉ tồn tại ở một nhánh

### Chỉ có ở `main`, `front` không có (main "hơn" front — giữ nguyên, không cần làm gì)
- `backend/migrations/versions/202608030002_seed_warehouse_manager_accounts.py`
- `backend/migrations/versions/202608030003_seed_demo_shop_and_100_products.py`
- `backend/migrations/versions/202608030004_add_demo_product_images.py`
- Toàn bộ hệ thống Prisma/Node ở gốc repo: `package.json`, `package-lock.json`, `prisma/`, `prisma.config.ts`, `generated/`, `seed.ts`, `tsconfig.json`, `skills-lock.json` — front không có phần này.
- Thư mục `chatbot/` (module chatbot backend) và `frontend/src/services/chatbotApi.ts` — front chưa có tính năng chatbot này. **Xem mục 5, các file này hiện chưa được git add/commit ở main, cần commit sớm kẻo mất.**

### Chỉ có ở `front`, `main` không có
- `backup.dump` — chỉ là file dump DB nhị phân, `.gitignore` của `main` cố tình loại trừ `*.dump` (đúng thực hành), còn `.gitignore` của `front` thì không (xem mục 4). Không cần đồng bộ file này.

---

## 3. File tồn tại ở cả hai nhánh nhưng nội dung lệch nhau đáng kể (cần merge thủ công)

Đây là phần quan trọng nhất — 89 file cùng đường dẫn nhưng nội dung đã rẽ nhánh khá nhiều ở cả 2 phía (main có commit "WIP: Update admin routes, wallet, warehouse accounts..." trong khi front có "fix_banner_admin" + merge riêng của front). Không tự động ghi đè vì rủi ro làm mất việc của bên còn lại — liệt kê theo nhóm kèm số dòng thay đổi (từ `git diff --stat`) để ưu tiên review.

### Backend – routes (10 file)
| File | Số dòng lệch |
|---|---|
| backend/app/main.py | 536 |
| backend/app/routes/warehouses.py | 2476 |
| backend/app/routes/warehouse_accounts.py | 1191 |
| backend/app/routes/disputes.py | 228 |
| backend/app/routes/config_public.py | 122 |
| backend/app/routes/feedback.py | 94 |
| backend/app/routes/wallet.py | 66 |
| backend/app/routes/admin.py | 50 |
| backend/app/routes/bot.py | 22 |
| backend/app/routes/products.py | 2 |

### Backend – services & models (4 file)
| File | Số dòng lệch |
|---|---|
| backend/app/services/payout_service.py | 234 |
| backend/app/services/bot_service.py | 215 |
| backend/app/services/bot_tools.py | 24 |
| backend/app/models/shipment.py | 8 |

### Backend – script & migrations (9 file, chưa tính bug ở mục 4)
| File | Số dòng lệch |
|---|---|
| backend/create_warehouse_tier_accounts.py | 510 |
| backend/migrations/versions/202507210001_warehouse_3tier_city_shippers.py | 332 |
| backend/migrations/versions/202607220001_delivery_codes_bundles_logs.py | 186 |
| backend/migrations/versions/202607220001_shipping_size_tiers_revenue_config.py | 188 |
| backend/migrations/versions/202608030001_seed_q8_ward_warehouses.py | 106 |
| backend/migrations/versions/202507230001_add_voucher_type_shop_id.py | 96 |
| backend/migrations/versions/202608020001_add_price_images_to_shop_registration.py | 58 |
| backend/migrations/versions/202607300001_merge_heads.py | 50 |
| backend/migrations/versions/202608020002_add_phone_to_shop_registration.py | 44 |

### Frontend – trang quản trị Admin (12 file)
| File | Số dòng lệch |
|---|---|
| frontend/src/pages/admin/WarehouseHierarchyPage.tsx | 1540 |
| frontend/src/pages/admin/ShipperManagementPage.tsx | 1244 |
| frontend/src/pages/admin/WarehouseAccountTreePage.tsx | 1097 |
| frontend/src/pages/admin/SystemEmployeePage.tsx | 726 |
| frontend/src/pages/admin/AuctionManagementPage.tsx | 393 |
| frontend/src/pages/admin/ShopManagementPage.tsx | 200 |
| frontend/src/pages/admin/ApprovalPage.tsx | 147 |
| frontend/src/pages/admin/AdminWalletPage.tsx | 21 |
| frontend/src/pages/admin/BannerAdminPage.tsx | 10 |
| frontend/src/pages/admin/AdminOverviewPage.tsx | 4 |
| frontend/src/pages/admin/BannerAuctionRealPage.tsx | 4 |
| frontend/src/pages/admin/ImageLibraryPage.tsx | 4 |

### Frontend – Hub / District / Ward / Warehouse manager (14 file — mảng phân quyền kho vận rẽ nhánh nhiều nhất)
| File | Số dòng lệch |
|---|---|
| frontend/src/pages/hub/HubBundlesPage.tsx | 634 |
| frontend/src/pages/hub/HubAccountsPage.tsx | 624 |
| frontend/src/pages/warehouse/WarehouseAccountsPage.tsx | 913 |
| frontend/src/pages/ward/WardShippersPage.tsx | 400 |
| frontend/src/pages/district/DistrictWardsPage.tsx | 354 |
| frontend/src/pages/hub/HubManagerLayout.tsx | 326 |
| frontend/src/pages/ward/WardOrdersPage.tsx | 328 |
| frontend/src/pages/hub/HubShipmentsPage.tsx | 288 |
| frontend/src/pages/district/DistrictManagerLayout.tsx | 286 |
| frontend/src/pages/ward/WardManagerLayout.tsx | 286 |
| frontend/src/pages/hub/HubDistrictsPage.tsx | 290 |
| frontend/src/pages/district/DistrictShipmentsPage.tsx | 230 |
| frontend/src/pages/ward/WardDashboardPage.tsx | 216 |
| frontend/src/pages/district/DistrictDashboardPage.tsx | 188 |
| frontend/src/pages/hub/HubDashboardPage.tsx | 200 |

### Frontend – core / layout / component dùng chung (10 file)
| File | Số dòng lệch |
|---|---|
| super/frontend/pages/SystemDocsPage.tsx | 2414 |
| super/frontend/pages/ERDPage.tsx | 1112 |
| frontend/src/components/common/ChatbotWidget.tsx | 942 |
| frontend/src/components/shop/OrderManagement.tsx | 890 |
| super/backend/routes/db_viewer.py | 484 |
| frontend/src/pages/shop/ShopRevenueDetailPage.tsx | 620 |
| frontend/src/Router.tsx | 560 |
| frontend/src/layouts/AdminLayout.tsx | 369 |
| frontend/src/pages/TrackOrderPage.tsx | 434 |
| frontend/src/components/auth/LoginForm.tsx | 273 |

### Frontend – services / utils / styles (10 file)
| File | Số dòng lệch |
|---|---|
| frontend/src/services/adminService.ts | 173 |
| frontend/src/utils/bannerAuctionStore.ts | 27 |
| frontend/src/utils/topSlotAuctionStore.ts | 30 |
| frontend/src/utils/flashSalePoolStore.ts | 23 |
| frontend/src/utils/productBundleStore.ts | 16 |
| frontend/src/styles/index.css | 33 |
| frontend/src/components/product/ProductList.tsx | 202 |
| frontend/src/components/shop/ProductManagement.tsx | 7 |
| frontend/src/pages/user/ProductDetailPage.tsx | 66 |
| frontend/src/pages/user/MyDisputesPage.tsx | 2 |

### Còn lại: docs & cấu hình lệch nội dung
- 7 file kế hoạch `.md` đã nêu ở mục 1 (ADMIN_PERMISSIONS_PLAN, DELIVERY_CODE_PLAN, IMAGE_STORAGE_FLOW, INFINITE_SCROLL_PLAN, INTEGRATION_GAP_PLAN, SHIPPING_REVENUE_PLAN, WAREHOUSE_PLAN)
- `erd_diagrams.puml` (810 dòng), `db_export.bat`, `db_import.bat`, `manage_volumes.sh`, `note_loi.log`, `frontend/.env.example`, `frontend/src/pages/Home.tsx`, `frontend/src/pages/ProfilePage.tsx`, `frontend/src/pages/shop/BannerAuctionPage.tsx`, `frontend/src/pages/shop/VoucherManagementPage.tsx`, `uploads/.gitignore`, `docker-compose.yml` (đã trùng khớp trở lại sau khi front tự merge, không cần đụng vào)

---

## 4. Bug phát hiện: trùng Revision ID migration (tồn tại ở CẢ HAI nhánh)

Cả `main` và `front` đều có **2 file migration khác nhau nhưng cùng khai báo `revision = '202608030001'`**:
- `202608030001_add_status_to_shops.py` (down_revision = `202608020002`)
- `202608030001_seed_q8_ward_warehouses.py` (down_revision = `202607300001`)

Đây là lỗi thật sự (Alembic sẽ báo lỗi "multiple heads" hoặc chọn nhầm file khi chạy migrate). Working tree hiện tại của `main` **đã tự sửa** bằng cách:
1. Đổi `add_status_to_shops` sang revision mới `202608030005` (file `202608030005_add_status_to_shops.py`, chưa commit)
2. Thêm migration gộp nhánh `202608030006_merge_heads_shops_status_and_demo_seed.py` (down_revision = `202608030005`, `202608030004`)
3. Thêm tiếp `202608040001_backfill_approved_products_to_active.py` trên đầu

→ **Đã cố tình KHÔNG khôi phục** file `202608030001_add_status_to_shops.py` cũ, và trong lúc merge cũng xoá hẳn bản của front (front bị bug y hệt). ĐÃ COMMIT trong checkpoint `66058f0` — không còn là việc tồn đọng.

---

## 5. Việc đã commit (trước là rủi ro, giờ đã xử lý)

Các mục sau trước đây chỉ tồn tại trong working tree, chưa từng `git add`/commit — **giờ đã nằm
trong checkpoint `66058f0`**, không còn rủi ro mất:
- `chatbot/` — cả thư mục module chatbot
- `frontend/src/services/chatbotApi.ts`
- `backend/migrations/versions/202608030005_add_status_to_shops.py`
- `backend/migrations/versions/202608030006_merge_heads_shops_status_and_demo_seed.py`
- `backend/migrations/versions/202608040001_backfill_approved_products_to_active.py`

44 file "modified" WIP trước đó (mục 3) cũng đã nằm trong checkpoint này.

---

## 6. File/thư mục rác nên dọn (không phải là "thiếu", mà là thừa/không nên có)

| File | Ở nhánh | Ghi chú |
|---|---|---|
| `backend/app/services/__test_delete_probe__.py.stale` | main | File test tạm, tên gợi ý đây là file dò lỗi, không phải code thật — nên xoá |
| `backend/package.json.bak_prisma` | main | File backup, nên xoá hoặc thêm vào `.gitignore` |
| `frontend/vite.config.ts.timestamp-*.mjs` (13 file) | front | File cache tự sinh của Vite, không nên được commit — nên thêm `*.timestamp-*.mjs` vào `.gitignore` của front |
| `backup.dump` | front | Front đang commit cả file dump DB nhị phân (main đã loại trừ đúng trong `.gitignore`, front thì chưa — xem mục 4/`.gitignore` diff) |
| `.git/*.lock`, `.git/*.stale.*` trong `luan_van/.git` | main | Rác còn sót từ lần merge bị crash trước đó (đã dọn 2 file lock đang chặn thao tác git lần này; còn ~11 file `.stale.*` khác không ảnh hưởng, có thể xoá thủ công khi rảnh) |

---

## Tóm tắt việc cần làm tiếp (sau khi đã merge xong)

1. **Test lại toàn bộ app** — merge đã xử lý xong về mặt code (git log: `f1e9a5d` trên `main`),
   nhưng chưa chạy thử thực tế. Ưu tiên test: luồng duyệt shop/shipper (vừa sửa bug gọi nhầm API ở
   `ApprovalPage.tsx`), toàn bộ khu vực quản lý tài khoản kho (Hub/District/Ward/Warehouse — nơi
   lệch nhiều nhất), và chatbot (vừa tách service riêng, cần `docker-compose` chạy cả 2 service).
2. **Thêm migration cho cột `vehicle_photo_url`** (mục 3) — model đã có cột này (gộp từ front) nhưng
   chưa migration nào tạo cột thật trong DB. Cần thêm 1 migration mới nối sau `202608040001`.
3. Chạy `alembic upgrade head` (hoặc ít nhất `alembic heads`) để xác nhận chuỗi migration hoạt động
   thật trên DB, không chỉ đúng trên giấy.
4. Xoá các file rác ở mục 6 (đặc biệt `__test_delete_probe__.py.stale`).
5. `git push` lên `origin/main` khi đã test ổn — hiện `main` đang vượt `origin/main` 4 commit
   (mới chỉ nằm ở máy local).
6. Có thể xoá nhánh `front` trên GitHub sau khi xác nhận merge ổn — front không còn nội dung nào mà
   main chưa có (đã kiểm chứng ở mục 2).
