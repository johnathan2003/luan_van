// Lưu mẫu banner/flash sale mà shop chuẩn bị trước khi đấu giá
// Khi thắng + đặt cọc → mẫu này tự động gửi lên Admin duyệt
// FIX: mỗi shop (email) có vùng localStorage riêng biệt

import type { BannerPositionKey } from './bannerAuctionStore'
import type { FlashSlotKey } from './flashSaleAuctionStore'

let _email = ''
/** Gọi khi shop đăng nhập để scope draft theo đúng tài khoản */
export function setBannerDraftEmail(email: string) { _email = email }
const storeKey = () => _email ? `buyzo_banner_draft_v1_${_email}` : 'buyzo_banner_draft_v1'

export interface BannerDraft {
  position: BannerPositionKey
  shopName: string
  title: string
  link?: string
  image: string          // base64
  updatedAt: string
}

export interface FlashDraft {
  slot: FlashSlotKey
  shopName: string
  productName: string
  price: number
  productImage: string   // base64
  updatedAt: string
}

export const FLASH_PRODUCT_MAX = 20

/** Mỗi sản phẩm trong danh sách chuẩn bị Flash Sale (tối đa 20) */
export interface FlashProductItem {
  shopName: string
  productName: string
  price: number
  productImage: string  // path hoặc URL
  updatedAt: string
}

interface DraftStore {
  banners: Partial<Record<BannerPositionKey, BannerDraft>>
  flash:   Partial<Record<FlashSlotKey, FlashDraft>>
  flashProducts?: (FlashProductItem | null)[]
}

function read(): DraftStore {
  try {
    const raw = localStorage.getItem(storeKey())
    const d = raw ? JSON.parse(raw) : {}
    return { banners: d.banners ?? {}, flash: d.flash ?? {}, flashProducts: d.flashProducts ?? [] }
  } catch { return { banners: {}, flash: {}, flashProducts: [] } }
}
function write(d: DraftStore): boolean {
  try { localStorage.setItem(storeKey(), JSON.stringify(d)); return true } catch { return false }
}

/** Xóa toàn bộ base64 (data:image/...) khỏi drafts đã lưu — gọi 1 lần khi migrate sang path-based */
export function clearBase64Drafts(): void {
  try {
    for (const key of Object.keys(localStorage)) {
      if (!key.startsWith('buyzo_banner_draft_v1')) continue
      const raw = localStorage.getItem(key); if (!raw) continue
      const d: DraftStore = JSON.parse(raw)
      let changed = false
      for (const pos of Object.keys(d.banners ?? {}) as BannerPositionKey[]) {
        if (d.banners[pos]?.image?.startsWith('data:')) { delete d.banners[pos]; changed = true }
      }
      for (const slot of Object.keys(d.flash ?? {}) as FlashSlotKey[]) {
        if (d.flash[slot]?.productImage?.startsWith('data:')) { delete d.flash[slot]; changed = true }
      }
      if (changed) localStorage.setItem(key, JSON.stringify(d))
    }
  } catch {}
}

export function saveBannerDraftSafe(draft: BannerDraft): boolean {
  const d = read()
  d.banners[draft.position] = { ...draft, updatedAt: new Date().toISOString() }
  if (write(d)) return true
  // Thất bại → thử xóa draft cũ của các vị trí khác để giải phóng chỗ rồi retry
  for (const pos of Object.keys(d.banners) as (keyof typeof d.banners)[]) {
    if (pos !== draft.position) delete d.banners[pos]
  }
  for (const slot of Object.keys(d.flash) as (keyof typeof d.flash)[]) {
    delete d.flash[slot]
  }
  if (write(d)) return true
  // Vẫn thất bại → chỉ lưu draft này, bỏ ảnh cũ
  return write({ banners: { [draft.position]: { ...draft, updatedAt: new Date().toISOString() } } as any, flash: {} })
}

// ── Banner drafts ─────────────────────────────────────────────────────────────
export function getBannerDraft(position: BannerPositionKey, shopName: string): BannerDraft | null {
  const d = read()
  const draft = d.banners[position]
  return draft?.shopName === shopName ? draft : null
}

export function saveBannerDraft(draft: BannerDraft): void {
  const d = read()
  d.banners[draft.position] = { ...draft, updatedAt: new Date().toISOString() }
  write(d)
}

export function clearBannerDraft(position: BannerPositionKey, shopName: string): void {
  const d = read()
  if (d.banners[position]?.shopName === shopName) {
    delete d.banners[position]
    write(d)
  }
}

// ── Flash product list (tối đa 20 sản phẩm chuẩn bị cho đấu giá pool) ────────
export function getFlashProductList(shopName: string): (FlashProductItem | null)[] {
  const d = read()
  const stored = d.flashProducts ?? []
  const result: (FlashProductItem | null)[] = Array(FLASH_PRODUCT_MAX).fill(null)
  stored.forEach((item, i) => {
    if (i < FLASH_PRODUCT_MAX && item?.shopName === shopName) result[i] = item
  })
  return result
}

export function saveFlashProduct(shopName: string, index: number, product: { productName: string; price: number; productImage: string }): void {
  const d = read()
  if (!d.flashProducts) d.flashProducts = []
  while (d.flashProducts.length <= index) d.flashProducts.push(null)
  d.flashProducts[index] = { shopName, ...product, updatedAt: new Date().toISOString() }
  write(d)
}

export function clearFlashProduct(shopName: string, index: number): void {
  const d = read()
  if (d.flashProducts?.[index]?.shopName === shopName) {
    d.flashProducts[index] = null
    write(d)
  }
}

// ── Flash drafts (legacy — slot-based) ───────────────────────────────────────
export function getFlashDraft(slot: FlashSlotKey, shopName: string): FlashDraft | null {
  const d = read()
  const draft = d.flash[slot]
  return draft?.shopName === shopName ? draft : null
}

export function saveFlashDraft(draft: FlashDraft): void {
  const d = read()
  d.flash[draft.slot] = { ...draft, updatedAt: new Date().toISOString() }
  write(d)
}

export function clearFlashDraft(slot: FlashSlotKey, shopName: string): void {
  const d = read()
  if (d.flash[slot]?.shopName === shopName) {
    delete d.flash[slot]
    write(d)
  }
}
