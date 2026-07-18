/**
 * imageLibraryStore.ts
 * ---------------------
 * Kho ảnh tập trung (localStorage).
 * Lưu TẤT CẢ ảnh dù thêm bằng URL hay upload file.
 * Mỗi ảnh có thể liên kết với 1 sản phẩm (productId + productName).
 *
 * Key: buyzo_image_library_v1
 */

export type ImageSource = 'url' | 'upload' | 'seed'

export interface ImageEntry {
  id: string           // uuid
  url: string          // URL cuối cùng (local /uploads/... hoặc external link)
  source: ImageSource  // cách thêm ảnh
  productId?: number   // ID sản phẩm liên kết (tuỳ chọn)
  productName?: string // tên sản phẩm (cache để hiển thị)
  shopName?: string    // tên shop
  label?: string       // alt text / nhãn
  addedAt: string      // ISO string
}

const KEY = 'buyzo_image_library_v1'

// ── Helpers ────────────────────────────────────────────────────────────────────

function readAll(): ImageEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as ImageEntry[]) : []
  } catch {
    return []
  }
}

function writeAll(entries: ImageEntry[]): void {
  localStorage.setItem(KEY, JSON.stringify(entries))
}

function uuid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2)
}

// ── Seed data — ảnh đại diện cho 18 sản phẩm trong seed.py ───────────────────
// Dùng placehold.co với text tên sản phẩm — nhìn rõ danh mục khi demo.
// Book Corner giữ openlibrary.org (bìa sách thật).

// Helper tạo URL placehold.co theo palette danh mục
function _ph(text: string, palette: [string, string]): string {
  return `https://placehold.co/400x400/${palette[0]}/${palette[1]}?text=${encodeURIComponent(text)}`
}
const BLUE  : [string, string] = ['dbeafe', '1d4ed8']  // điện tử
const PINK  : [string, string] = ['fce7f3', '9d174d']  // thời trang
const GREEN : [string, string] = ['dcfce7', '15803d']  // sách

const SEED_IMAGES: Omit<ImageEntry, 'id' | 'addedAt'>[] = [
  // ── TechWorld (electronics) ─────────────────────────────────────────────────
  { source: 'seed', productName: 'Tai nghe Sony WH-1000XM5', shopName: 'TechWorld',
    label: 'Sony WH-1000XM5 chính diện', url: _ph('Sony WH-1000XM5', BLUE) },
  { source: 'seed', productName: 'Tai nghe Sony WH-1000XM5', shopName: 'TechWorld',
    label: 'Sony WH-1000XM5 nghiêng', url: _ph('WH-1000XM5 Side', BLUE) },
  { source: 'seed', productName: 'Cáp USB-C 100W', shopName: 'TechWorld',
    label: 'Cáp USB-C 100W', url: _ph('USB-C 100W', BLUE) },
  { source: 'seed', productName: 'Cáp USB-C 100W', shopName: 'TechWorld',
    label: 'Cáp USB-C đầu nối', url: _ph('USB-C Connector', BLUE) },
  { source: 'seed', productName: 'Chuột gaming Logitech G502', shopName: 'TechWorld',
    label: 'Logitech G502 chính diện', url: _ph('Logitech G502', BLUE) },
  { source: 'seed', productName: 'Chuột gaming Logitech G502', shopName: 'TechWorld',
    label: 'Logitech G502 RGB', url: _ph('G502 RGB', BLUE) },
  { source: 'seed', productName: 'Bàn phím cơ Keychron K2', shopName: 'TechWorld',
    label: 'Keychron K2 toàn cảnh', url: _ph('Keychron K2', BLUE) },
  { source: 'seed', productName: 'Bàn phím cơ Keychron K2', shopName: 'TechWorld',
    label: 'Keychron K2 close-up', url: _ph('K2 Keycap', BLUE) },
  { source: 'seed', productName: 'Màn hình LG 27inch 4K', shopName: 'TechWorld',
    label: 'LG 27inch 4K chính diện', url: _ph('LG 27" 4K', BLUE) },
  { source: 'seed', productName: 'Màn hình LG 27inch 4K', shopName: 'TechWorld',
    label: 'LG 27inch 4K setup desk', url: _ph('LG Monitor Desk', BLUE) },
  { source: 'seed', productName: 'Webcam Logitech C920', shopName: 'TechWorld',
    label: 'Logitech C920 webcam', url: _ph('Logitech C920', BLUE) },
  { source: 'seed', productName: 'Webcam Logitech C920', shopName: 'TechWorld',
    label: 'Logitech C920 gắn màn hình', url: _ph('C920 Mounted', BLUE) },
  { source: 'seed', productName: 'Sạc dự phòng 20000mAh', shopName: 'TechWorld',
    label: 'Pin dự phòng 20000mAh', url: _ph('Powerbank 20000', BLUE) },
  { source: 'seed', productName: 'Sạc dự phòng 20000mAh', shopName: 'TechWorld',
    label: 'Pin dự phòng đang sạc', url: _ph('Powerbank Charging', BLUE) },

  // ── Fashion Hub (fashion) ───────────────────────────────────────────────────
  { source: 'seed', productName: 'Áo thun Oversize Unisex', shopName: 'Fashion Hub',
    label: 'Áo thun oversize trắng', url: _ph('Oversize Tshirt', PINK) },
  { source: 'seed', productName: 'Áo thun Oversize Unisex', shopName: 'Fashion Hub',
    label: 'Áo thun oversize đen', url: _ph('Oversize Black', PINK) },
  { source: 'seed', productName: 'Quần jeans skinny nam', shopName: 'Fashion Hub',
    label: 'Quần jeans skinny xanh', url: _ph('Skinny Jeans', PINK) },
  { source: 'seed', productName: 'Quần jeans skinny nam', shopName: 'Fashion Hub',
    label: 'Quần jeans skinny đen', url: _ph('Jeans Black', PINK) },
  { source: 'seed', productName: 'Đầm midi hoa tiết nữ', shopName: 'Fashion Hub',
    label: 'Đầm midi hoa tiết pastel', url: _ph('Midi Dress Floral', PINK) },
  { source: 'seed', productName: 'Đầm midi hoa tiết nữ', shopName: 'Fashion Hub',
    label: 'Đầm midi hoa tiết navy', url: _ph('Midi Dress Navy', PINK) },
  { source: 'seed', productName: 'Áo sơ mi linen trắng nam', shopName: 'Fashion Hub',
    label: 'Áo sơ mi trắng công sở', url: _ph('White Linen Shirt', PINK) },
  { source: 'seed', productName: 'Áo sơ mi linen trắng nam', shopName: 'Fashion Hub',
    label: 'Áo sơ mi trắng slim fit', url: _ph('Slim Fit Shirt', PINK) },
  { source: 'seed', productName: 'Giày sneaker trắng basic', shopName: 'Fashion Hub',
    label: 'Sneaker trắng cổ thấp', url: _ph('White Sneaker', PINK) },
  { source: 'seed', productName: 'Giày sneaker trắng basic', shopName: 'Fashion Hub',
    label: 'Sneaker trắng on-foot', url: _ph('Sneaker On Foot', PINK) },
  { source: 'seed', productName: 'Túi tote vải canvas', shopName: 'Fashion Hub',
    label: 'Túi tote canvas tự nhiên', url: _ph('Canvas Tote', PINK) },
  { source: 'seed', productName: 'Túi tote vải canvas', shopName: 'Fashion Hub',
    label: 'Túi tote canvas đeo vai', url: _ph('Tote Bag Shoulder', PINK) },

  // ── Book Corner (books) — giữ bìa thật từ OpenLibrary ───────────────────────
  { source: 'seed', productName: 'Clean Code - Robert Martin', shopName: 'Book Corner',
    label: 'Bìa Clean Code', url: 'https://covers.openlibrary.org/b/id/8091016-L.jpg' },
  { source: 'seed', productName: 'Clean Code - Robert Martin', shopName: 'Book Corner',
    label: 'Nội dung Clean Code', url: _ph('Clean Code', GREEN) },
  { source: 'seed', productName: 'Atomic Habits - James Clear', shopName: 'Book Corner',
    label: 'Bìa Atomic Habits', url: 'https://covers.openlibrary.org/b/id/10521270-L.jpg' },
  { source: 'seed', productName: 'Atomic Habits - James Clear', shopName: 'Book Corner',
    label: 'Atomic Habits gáy sách', url: _ph('Atomic Habits', GREEN) },
  { source: 'seed', productName: 'Đắc Nhân Tâm', shopName: 'Book Corner',
    label: 'Bìa Đắc Nhân Tâm', url: 'https://covers.openlibrary.org/b/id/7222246-L.jpg' },
  { source: 'seed', productName: 'Đắc Nhân Tâm', shopName: 'Book Corner',
    label: 'Đắc Nhân Tâm phiên bản mới', url: _ph('Dac Nhan Tam', GREEN) },
  { source: 'seed', productName: 'The Psychology of Money', shopName: 'Book Corner',
    label: 'Bìa The Psychology of Money', url: 'https://covers.openlibrary.org/b/id/10710480-L.jpg' },
  { source: 'seed', productName: 'The Psychology of Money', shopName: 'Book Corner',
    label: 'Psychology of Money nội dung', url: _ph('Psychology of Money', GREEN) },
  { source: 'seed', productName: 'Sapiens: Lược sử loài người', shopName: 'Book Corner',
    label: 'Bìa Sapiens', url: 'https://covers.openlibrary.org/b/id/8739161-L.jpg' },
  { source: 'seed', productName: 'Sapiens: Lược sử loài người', shopName: 'Book Corner',
    label: 'Sapiens bản tiếng Việt', url: _ph('Sapiens', GREEN) },
]

// ── Init: chỉ seed 1 lần nếu chưa có dữ liệu ─────────────────────────────────

function ensureSeed(): void {
  const existing = readAll()
  const hasSeed = existing.some(e => e.source === 'seed')
  if (hasSeed) return

  const now = new Date().toISOString()
  const seeded: ImageEntry[] = SEED_IMAGES.map((img, i) => ({
    ...img,
    id: `seed-${i}-${Date.now()}`,
    addedAt: now,
  }))
  // Giữ lại entries không phải seed (URL/upload đã thêm thủ công)
  writeAll([...seeded, ...existing.filter(e => e.source !== 'seed')])
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Lấy toàn bộ ảnh. Tự động seed nếu chưa có. */
export function getAllImages(): ImageEntry[] {
  ensureSeed()
  return readAll()
}

/** Lấy ảnh theo tên sản phẩm (khớp gần đúng, không phân biệt hoa thường). */
export function getImagesByProductName(productName: string): ImageEntry[] {
  return getAllImages().filter(
    e => e.productName?.toLowerCase().includes(productName.toLowerCase())
  )
}

/** Lấy ảnh theo productId (đã gán). */
export function getImagesByProductId(productId: number): ImageEntry[] {
  return getAllImages().filter(e => e.productId === productId)
}

/** Thêm ảnh bằng URL bên ngoài. */
export function addImageByUrl(params: {
  url: string
  productName?: string
  productId?: number
  shopName?: string
  label?: string
}): ImageEntry {
  const entry: ImageEntry = {
    id: uuid(),
    source: 'url',
    url: params.url,
    productName: params.productName,
    productId: params.productId,
    shopName: params.shopName,
    label: params.label || '',
    addedAt: new Date().toISOString(),
  }
  const all = getAllImages()
  writeAll([...all, entry])
  return entry
}

/** Thêm ảnh đã upload (URL là path backend trả về, vd /uploads/products/xxx.jpg). */
export function addImageByUpload(params: {
  url: string          // URL từ backend upload response
  productName?: string
  productId?: number
  shopName?: string
  label?: string
}): ImageEntry {
  const entry: ImageEntry = {
    id: uuid(),
    source: 'upload',
    url: params.url,
    productName: params.productName,
    productId: params.productId,
    shopName: params.shopName,
    label: params.label || '',
    addedAt: new Date().toISOString(),
  }
  const all = getAllImages()
  writeAll([...all, entry])
  return entry
}

/** Gán / cập nhật thông tin sản phẩm cho một ảnh. */
export function linkImageToProduct(
  imageId: string,
  productId: number,
  productName: string,
  shopName?: string
): void {
  const all = readAll()
  const idx = all.findIndex(e => e.id === imageId)
  if (idx === -1) return
  all[idx] = { ...all[idx], productId, productName, shopName }
  writeAll(all)
}

/** Xoá ảnh khỏi thư viện. */
export function removeImage(imageId: string): void {
  writeAll(readAll().filter(e => e.id !== imageId))
}

/** Reset seed (dùng khi muốn làm mới). */
export function resetSeedImages(): void {
  const nonSeed = readAll().filter(e => e.source !== 'seed')
  writeAll(nonSeed)
  ensureSeed()
}

/** Thống kê nhanh. */
export function getLibraryStats() {
  const all = getAllImages()
  const bySource = { url: 0, upload: 0, seed: 0 }
  const productNames = new Set<string>()
  for (const e of all) {
    bySource[e.source]++
    if (e.productName) productNames.add(e.productName)
  }
  return {
    total: all.length,
    byUrl: bySource.url,
    byUpload: bySource.upload,
    bySeed: bySource.seed,
    linkedProducts: productNames.size,
  }
}
