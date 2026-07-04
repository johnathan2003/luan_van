// Lưu mẫu banner/flash sale mà shop chuẩn bị trước khi đấu giá
// Khi thắng + đặt cọc → mẫu này tự động gửi lên Admin duyệt

import type { BannerPositionKey } from './bannerAuctionStore'
import type { FlashSlotKey } from './flashSaleAuctionStore'

const KEY = 'buyzo_banner_draft_v1'

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

interface DraftStore {
  banners: Partial<Record<BannerPositionKey, BannerDraft>>
  flash:   Partial<Record<FlashSlotKey, FlashDraft>>
}

function read(): DraftStore {
  try {
    const raw = localStorage.getItem(KEY)
    const d = raw ? JSON.parse(raw) : {}
    return { banners: d.banners ?? {}, flash: d.flash ?? {} }
  } catch { return { banners: {}, flash: {} } }
}
function write(d: DraftStore) {
  try { localStorage.setItem(KEY, JSON.stringify(d)) } catch {}
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

// ── Flash drafts ──────────────────────────────────────────────────────────────
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
