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
// Dùng picsum.photos/seed/<từ-khoá>/400/400 — ảnh cố định theo seed, không cần
// chính xác tuyệt đối, chỉ cần trông đúng danh mục.

const SEED_IMAGES: Omit<ImageEntry, 'id' | 'addedAt'>[] = [
  // ── TechWorld (electronics) ─────────────────────────────────────────────────
  {
    source: 'seed', productName: 'Tai nghe Sony WH-1000XM5', shopName: 'TechWorld',
    label: 'Sony WH-1000XM5 chính diện',
    url: 'https://picsum.photos/seed/headphone-sony/400/400',
  },
  {
    source: 'seed', productName: 'Tai nghe Sony WH-1000XM5', shopName: 'TechWorld',
    label: 'Sony WH-1000XM5 nghiêng',
    url: 'https://picsum.photos/seed/headphone-side/400/400',
  },
  {
    source: 'seed', productName: 'Cap USB-C 100W', shopName: 'TechWorld',
    label: 'Cáp USB-C 100W',
    url: 'https://picsum.photos/seed/usbc-cable/400/400',
  },
  {
    source: 'seed', productName: 'Cap USB-C 100W', shopName: 'TechWorld',
    label: 'Cáp USB-C đầu nối',
    url: 'https://picsum.photos/seed/cable-connector/400/400',
  },
  {
    source: 'seed', productName: 'Chuot gaming Logitech G502', shopName: 'TechWorld',
    label: 'Logitech G502 chính diện',
    url: 'https://picsum.photos/seed/gaming-mouse/400/400',
  },
  {
    source: 'seed', productName: 'Chuot gaming Logitech G502', shopName: 'TechWorld',
    label: 'Logitech G502 góc nghiêng',
    url: 'https://picsum.photos/seed/mouse-rgb/400/400',
  },
  {
    source: 'seed', productName: 'Ban phim co Keychron K2', shopName: 'TechWorld',
    label: 'Keychron K2 toàn cảnh',
    url: 'https://picsum.photos/seed/mechanical-keyboard/400/400',
  },
  {
    source: 'seed', productName: 'Ban phim co Keychron K2', shopName: 'TechWorld',
    label: 'Keychron K2 close-up phím',
    url: 'https://picsum.photos/seed/keycap-closeup/400/400',
  },
  {
    source: 'seed', productName: 'Man hinh LG 27inch 4K', shopName: 'TechWorld',
    label: 'LG 27inch 4K chính diện',
    url: 'https://picsum.photos/seed/monitor-lg/400/400',
  },
  {
    source: 'seed', productName: 'Man hinh LG 27inch 4K', shopName: 'TechWorld',
    label: 'LG 27inch 4K setup desk',
    url: 'https://picsum.photos/seed/monitor-desk/400/400',
  },
  {
    source: 'seed', productName: 'Webcam Logitech C920', shopName: 'TechWorld',
    label: 'Logitech C920 webcam',
    url: 'https://picsum.photos/seed/webcam-logitech/400/400',
  },
  {
    source: 'seed', productName: 'Webcam Logitech C920', shopName: 'TechWorld',
    label: 'Logitech C920 gắn màn hình',
    url: 'https://picsum.photos/seed/webcam-mounted/400/400',
  },
  {
    source: 'seed', productName: 'Sac du phong 20000mAh', shopName: 'TechWorld',
    label: 'Pin dự phòng 20000mAh',
    url: 'https://picsum.photos/seed/powerbank/400/400',
  },
  {
    source: 'seed', productName: 'Sac du phong 20000mAh', shopName: 'TechWorld',
    label: 'Pin dự phòng đang sạc',
    url: 'https://picsum.photos/seed/powerbank-charging/400/400',
  },

  // ── Fashion Hub (fashion) ───────────────────────────────────────────────────
  {
    source: 'seed', productName: 'Ao thun Oversize Unisex', shopName: 'Fashion Hub',
    label: 'Áo thun oversize trắng',
    url: 'https://picsum.photos/seed/tshirt-oversize/400/400',
  },
  {
    source: 'seed', productName: 'Ao thun Oversize Unisex', shopName: 'Fashion Hub',
    label: 'Áo thun oversize đen',
    url: 'https://picsum.photos/seed/tshirt-black/400/400',
  },
  {
    source: 'seed', productName: 'Quan jeans skinny nam', shopName: 'Fashion Hub',
    label: 'Quần jeans skinny xanh',
    url: 'https://picsum.photos/seed/jeans-skinny/400/400',
  },
  {
    source: 'seed', productName: 'Quan jeans skinny nam', shopName: 'Fashion Hub',
    label: 'Quần jeans skinny đen',
    url: 'https://picsum.photos/seed/jeans-black/400/400',
  },
  {
    source: 'seed', productName: 'Dam midi hoa tiet nu', shopName: 'Fashion Hub',
    label: 'Đầm midi hoa tiết pastel',
    url: 'https://picsum.photos/seed/midi-dress-floral/400/400',
  },
  {
    source: 'seed', productName: 'Dam midi hoa tiet nu', shopName: 'Fashion Hub',
    label: 'Đầm midi hoa tiết navy',
    url: 'https://picsum.photos/seed/midi-dress-navy/400/400',
  },
  {
    source: 'seed', productName: 'Ao so mi lin trang nam', shopName: 'Fashion Hub',
    label: 'Áo sơ mi trắng công sở',
    url: 'https://picsum.photos/seed/white-shirt-office/400/400',
  },
  {
    source: 'seed', productName: 'Ao so mi lin trang nam', shopName: 'Fashion Hub',
    label: 'Áo sơ mi trắng slim fit',
    url: 'https://picsum.photos/seed/white-shirt-slim/400/400',
  },
  {
    source: 'seed', productName: 'Giáy sneaker trang basic', shopName: 'Fashion Hub',
    label: 'Sneaker trắng cổ thấp',
    url: 'https://picsum.photos/seed/white-sneaker/400/400',
  },
  {
    source: 'seed', productName: 'Giáy sneaker trang basic', shopName: 'Fashion Hub',
    label: 'Sneaker trắng on-foot',
    url: 'https://picsum.photos/seed/sneaker-onfoot/400/400',
  },
  {
    source: 'seed', productName: 'Tui tote vai canvas', shopName: 'Fashion Hub',
    label: 'Túi tote canvas tự nhiên',
    url: 'https://picsum.photos/seed/tote-canvas/400/400',
  },
  {
    source: 'seed', productName: 'Tui tote vai canvas', shopName: 'Fashion Hub',
    label: 'Túi tote canvas đeo vai',
    url: 'https://picsum.photos/seed/tote-bag-shoulder/400/400',
  },

  // ── Book Corner (books) ─────────────────────────────────────────────────────
  {
    source: 'seed', productName: 'Clean Code - Robert Martin', shopName: 'Book Corner',
    label: 'Bìa Clean Code',
    url: 'https://covers.openlibrary.org/b/id/8091016-L.jpg',
  },
  {
    source: 'seed', productName: 'Clean Code - Robert Martin', shopName: 'Book Corner',
    label: 'Nội dung Clean Code',
    url: 'https://picsum.photos/seed/book-code/400/400',
  },
  {
    source: 'seed', productName: 'Atomic Habits - James Clear', shopName: 'Book Corner',
    label: 'Bìa Atomic Habits',
    url: 'https://covers.openlibrary.org/b/id/10521270-L.jpg',
  },
  {
    source: 'seed', productName: 'Atomic Habits - James Clear', shopName: 'Book Corner',
    label: 'Atomic Habits gáy sách',
    url: 'https://picsum.photos/seed/atomic-habits/400/400',
  },
  {
    source: 'seed', productName: 'Dac Nhan Tam', shopName: 'Book Corner',
    label: 'Bìa Đắc Nhân Tâm',
    url: 'https://covers.openlibrary.org/b/id/7222246-L.jpg',
  },
  {
    source: 'seed', productName: 'Dac Nhan Tam', shopName: 'Book Corner',
    label: 'Đắc Nhân Tâm phiên bản mới',
    url: 'https://picsum.photos/seed/people-skills-book/400/400',
  },
  {
    source: 'seed', productName: 'The Psychology of Mởney', shopName: 'Book Corner',
    label: 'Bìa The Psychology of Mởney',
    url: 'https://covers.openlibrary.org/b/id/10710480-L.jpg',
  },
  {
    source: 'seed', productName: 'The Psychology of Mởney', shopName: 'Book Corner',
    label: 'Psychology of Mởney nội dung',
    url: 'https://picsum.photos/seed/money-psychology/400/400',
  },
  {
    source: 'seed', productName: 'Sapiens: Lược sử loài người', shopName: 'Book Corner',
    label: 'Bìa Sapiens',
    url: 'https://covers.openlibrary.org/b/id/8739161-L.jpg',
  },
  {
    source: 'seed', productName: 'Sapiens: Lược sử loài người', shopName: 'Book Corner',
    label: 'Sapiens bản tiếng Việt',
    url: 'https://picsum.photos/seed/sapiens-book/400/400',
  },
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
