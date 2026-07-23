# Kế hoạch: Infinite Scroll kiểu Facebook cho trang Home

**Ngày lập:** 2026-07-23  
**Trạng thái:** 🔄 Cập nhật kế hoạch (thêm hiệu ứng loop)  
**File liên quan:** `INTEGRATION_GAP_PLAN.md`

---

## 1. Vấn đề hiện tại

| # | Vấn đề | Mô tả |
|---|--------|-------|
| 1 | Pagination bấm nút | User phải bấm "← Trước / Sau →" để xem thêm SP, trải nghiệm kém |
| 2 | Khoảng trắng dưới cùng | Sau trang cuối có vùng trắng lớn do `paddingBottom: 56` |
| 3 | Features section bị đẩy | Khi load SP mới, section "Giao hàng / Thanh toán / Đổi trả / Hỗ trợ" bị đẩy xuống mãi |

---

## 2. Mục tiêu

- Bỏ hoàn toàn pagination (Trước / số trang / Sau)
- Khi user lướt xuống cuối danh sách SP → **tự động load thêm** (không cần thao tác)
- Khi hết SP → **quay lại đầu** và tiếp tục load (loop vô tận)
- Section "Giao hàng nhanh / Thanh toán / Đổi trả / Hỗ trợ" **không bị ảnh hưởng** bởi quá trình load
- Khi đổi bộ lọc (category / giá / sắp xếp) → **reset list** và bắt đầu lại từ đầu

---

## 3. Giải pháp kỹ thuật

### 3.1 Cơ chế: IntersectionObserver + Sentinel div

```
Danh sách sản phẩm
  [SP 1] [SP 2] [SP 3] [SP 4]
  [SP 5] [SP 6] [SP 7] [SP 8]
  [SP 9] [SP 10] [SP 11] [SP 12]
  <div ref={sentinelRef} style={{ height: 1px }} />   ← Trigger điểm
```

- `sentinelRef` là một div cao 1px đặt ngay dưới lưới SP
- `IntersectionObserver` theo dõi div này
- Khi div này vào viewport (user lướt đến cuối) → gọi `loadMore()`

### 3.2 Logic loadMore()

```
loadMore():
  if (đang fetch) → bỏ qua (guard)
  
  nextPage = (currentPage >= totalPages) ? 1 : currentPage + 1
  
  fetch API /products?page=nextPage&limit=12&...filters
  
  dispatch appendProducts(result)  // APPEND, không REPLACE
  cập nhật currentPage, totalPages
```

### 3.3 Loop vô tận + Hiệu ứng 1.5s khi hết SP

Khi `currentPage >= totalPages` (đã kéo hết toàn bộ SP), trước khi load lại từ đầu:

**Bước 1 — Hiển thị màn hình "đang tải lại"**
```
┌─────────────────────────────────────────┐
│  [SP cuối cùng]                         │
│                                         │
│  ────────────────────────────────────   │
│                                         │
│        ⟳  Đang tải thêm sản phẩm       │  ← hiệu ứng spinner/skeleton
│                                         │
└─────────────────────────────────────────┘
```

**Bước 2 — Đợi 1500ms** (`setTimeout 1500`)

**Bước 3 — Fetch page=1 và append vào list**

```
isLooping = (currentPage >= totalPages)

loadMore():
  if (isLooping):
    setLoopLoading(true)       // bật hiệu ứng đặc biệt
    await sleep(1500)          // đợi 1.5 giây
    setLoopLoading(false)
    fetch page=1 → appendProducts
  else:
    fetch page+1 → appendProducts   // load bình thường, không delay
```

**Phân biệt 2 loại loading:**

| Trạng thái | Khi nào | Hiển thị |
|-----------|---------|---------|
| `loadingMore` | Load trang tiếp theo (bình thường) | Spinner nhỏ + "Đang tải thêm…" |
| `loopLoading` | Hết SP, chuẩn bị loop lại | Skeleton cards đầy đủ + text "Đang làm mới…" trong 1.5s |

**Skeleton UI khi loop (loopLoading=true):**
```
[░░░░░░░] [░░░░░░░] [░░░░░░░] [░░░░░░░]   ← 4 card skeleton mờ
[░░░░░░░] [░░░░░░░] [░░░░░░░] [░░░░░░░]   ← 4 card skeleton mờ
[░░░░░░░] [░░░░░░░] [░░░░░░░] [░░░░░░░]   ← 4 card skeleton mờ
         ⟳  Đang làm mới danh sách…
```
→ Sau 1.5s skeleton biến mất, SP mới xuất hiện mượt mà

**Ví dụ có 2 trang (24 SP):**
```
  Load 1: page=1 → SP 1-12   (bình thường)
  Load 2: page=2 → SP 13-24  (bình thường)
  ── Hết SP ──
  Hiệu ứng loopLoading (1.5s skeleton)
  Load 3: page=1 → SP 1-12   (loop)
  Load 4: page=2 → SP 13-24  (bình thường)
  ── Hết SP ──
  Hiệu ứng loopLoading (1.5s skeleton)
  ... vô tận
```

### 3.4 Reset khi đổi filter

```
handleFilterChange(key, value):
  dispatch(resetProducts())         // xóa trắng list
  currentPage  = 1
  totalPages   = 1
  fetch page=1 với filter mới
  → bắt đầu lại từ đầu
```

---

## 4. Files thay đổi

### 4.1 `frontend/src/store/slices/productSlice.ts`

**Thêm state:**
```typescript
loadingMore: boolean   // đang fetch thêm (khác với loading ban đầu)
```

**Thêm actions:**
| Action | Mô tả |
|--------|-------|
| `appendProducts(payload)` | Gộp SP mới vào cuối `state.products` (không replace) |
| `resetProducts()` | Xóa trắng `products`, reset `page=1`, `pages=0`, `total=0` |
| `setLoadingMore(bool)` | Bật/tắt trạng thái đang load thêm |

### 4.2 `frontend/src/components/product/ProductList.tsx`

**Thêm props:**
```typescript
loadingMore?: boolean    // load trang kế — spinner nhỏ cuối list
loopLoading?: boolean    // hết SP, chuẩn bị loop — skeleton 1.5s
```

**UI loadingMore (bình thường):**
```tsx
// Spinner nhỏ + text ở cuối danh sách
<div style={{ display:'flex', justifyContent:'center', gap:10, padding:'24px 0' }}>
  <Spinner />
  <span>Đang tải thêm sản phẩm…</span>
</div>
```

**UI loopLoading (hết SP — hiệu ứng 1.5s):**
```tsx
// 12 skeleton cards (3 hàng x 4 cột) với animation pulse
<div className="grid-4">
  {Array.from({ length: 12 }).map((_, i) => (
    <SkeletonCard key={i} />   // card mờ nhấp nháy
  ))}
</div>
<div style={{ textAlign:'center', padding:'16px 0' }}>
  <Spinner /> Đang làm mới danh sách…
</div>
```

**SkeletonCard** (animation CSS):
```css
@keyframes pulse {
  0%, 100% { opacity: 0.4 }
  50%       { opacity: 0.8 }
}
.skeleton { animation: pulse 1.2s ease-in-out infinite }
```

### 4.3 `frontend/src/pages/Home.tsx`

**Xóa:**
- Toàn bộ block pagination JSX (Trước / số trang / Sau)
- `page`, `pages` khỏi selector (không cần nữa)
- Effect `useEffect([filters])` → thay bằng `handleFilterChange`

**Thêm:**

*State/Ref:*
```typescript
const infinitePageRef   = useRef(1)     // trang hiện tại
const infinitePagesRef  = useRef(1)     // tổng trang
const isFetchingRef     = useRef(false) // guard chống gọi trùng
const sentinelRef       = useRef<HTMLDivElement>(null)
const [loopLoading, setLoopLoading] = useState(false)  // ← MỚI
```

*Helper:*
```typescript
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
```

*loadMore với hiệu ứng loop:*
```typescript
const loadMore = useCallback(async () => {
  if (isFetchingRef.current) return
  isFetchingRef.current = true

  const isLoop = infinitePageRef.current >= infinitePagesRef.current
  const nextPage = isLoop ? 1 : infinitePageRef.current + 1

  if (isLoop) {
    // Hiệu ứng 1.5s skeleton trước khi loop
    setLoopLoading(true)
    dispatch(setLoadingMore(false))
    await sleep(1500)            // ← CHỜ 1.5 GIÂY
    setLoopLoading(false)
  } else {
    dispatch(setLoadingMore(true))
  }

  // Fetch và append
  const res = await API.get(`/api/v1/products?page=${nextPage}&...`)
  dispatch(appendProducts(res.data))
  infinitePageRef.current  = res.data.page
  infinitePagesRef.current = res.data.pages
  dispatch(setLoadingMore(false))
  isFetchingRef.current = false
}, [dispatch, filters])
```

*IntersectionObserver:*
```typescript
useEffect(() => {
  const observer = new IntersectionObserver(
    entries => { if (entries[0].isIntersecting) loadMore() },
    { threshold: 0.1 }
  )
  observer.observe(sentinelRef.current!)
  return () => observer.disconnect()
}, [loadMore])
```

**Dời:** Section "Giao hàng / Thanh toán / Đổi trả / Hỗ trợ" lên **TRƯỚC** product list

**Layout trước:**
```
BuyZo Mall
─────────────────────────────
[SP grid + filter]
[← Trước] [1] [2] [Sau →]
─────────────────────────────
🚚 Giao hàng  🔒 Thanh toán  🔄 Đổi trả  🎧 Hỗ trợ    ← bị đẩy xuống mãi
Footer
```

**Layout sau:**
```
BuyZo Mall
─────────────────────────────
🚚 Giao hàng  🔒 Thanh toán  🔄 Đổi trả  🎧 Hỗ trợ    ← cố định ở đây
─────────────────────────────
[SP grid + filter]            ← load vô tận xuống dưới
[SP grid]
[SP grid]
...
Footer
```

---

## 5. Luồng hoạt động đầy đủ

```
1. Trang load
   → fetch page=1, limit=12, sort=popular
   → hiển thị 12 SP đầu tiên
   → sentinelRef ở cuối (có thể đã visible nếu màn hình lớn)

2. User lướt xuống
   → sentinelRef vào viewport
   → IntersectionObserver trigger
   → loadMore() gọi API page=2
   → appendProducts → list có 24 SP
   → loadingMore=false, spinner biến mất

3. User lướt thêm
   → loadMore() → page >= totalPages → nextPage=1
   → fetch page=1 lại
   → appendProducts → list có 36 SP (12 SP đầu lặp lại)
   → ... vô tận

4. User đổi category
   → resetProducts() → list = []
   → fetch page=1 với category mới
   → hiển thị 12 SP đầu của category đó
   → IntersectionObserver tiếp tục hoạt động bình thường
```

---

## 6. Edge cases xử lý

| Tình huống | Xử lý |
|-----------|-------|
| Fetch quá nhanh (sentinel luôn visible) | `isFetchingRef` guard — bỏ qua nếu đang fetch |
| SP = 0 (filter quá chặt) | `ProductList` hiển thị "Không có sản phẩm nào" |
| API lỗi trong lúc loop | `setLoopLoading(false)`, `isFetchingRef=false`, observer thử lại lần sau |
| User đổi filter trong 1.5s skeleton | `resetProducts()` xóa list, `setLoopLoading(false)`, fetch mới thay thế |
| 1 trang duy nhất | Loop ngay từ lần 2 — hiệu ứng 1.5s xuất hiện sớm hơn |
| Màn hình lớn (sentinel visible ngay) | Load lần 1 xong → sentinel vẫn visible → load lần 2 ngay (không loop nên không có delay) |

---

## 7. Checklist triển khai

### Đã làm (lần 1 — chưa có hiệu ứng loop)
- [x] `productSlice.ts` — thêm `appendProducts`, `resetProducts`, `setLoadingMore`, `loadingMore`
- [x] `ProductList.tsx` — thêm prop `loadingMore`, spinner cuối list
- [x] `Home.tsx` — xóa pagination JSX
- [x] `Home.tsx` — thêm `sentinelRef` + `IntersectionObserver`
- [x] `Home.tsx` — thêm `loadMore()` với loop logic
- [x] `Home.tsx` — `handleFilterChange` reset list trước khi fetch
- [x] `Home.tsx` — dời Features section lên trên product list
- [x] `Home.tsx` — xóa `paddingBottom: 56`

### Hiệu ứng 1.5s khi loop ✅ Hoàn thành
- [x] `productSlice.ts` — thêm state `loopLoading: boolean` + action `setLoopLoading`
- [x] `ProductList.tsx` — thêm prop `loopLoading`, skeleton 12 cards + `@keyframes skeletonPulse`
- [x] `Home.tsx` — `sleep(1500)` trong `loadMore()` khi `isLoop=true`, bật `setLoopLoading(true)`
- [x] `Home.tsx` — truyền `loopLoading` xuống `ProductList`
- [x] CSS — `@keyframes skeletonPulse` inline trong `ProductList.tsx`
