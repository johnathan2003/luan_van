# 📋 NOTE — Tính năng Đấu giá Banner & Flash Sale (BuyZo)

> **Ngày tạo:** 2026-07-03  
> **Mục đích:** Lưu toàn bộ code tính năng đấu giá vị trí banner & Flash Sale để tham khảo, không bị mất khi context bị xoá.

---

## 📁 Danh sách file liên quan

| File | Vai trò |
|------|---------|
| `frontend/src/utils/bannerAuctionStore.ts` | Store localStorage cho đấu giá banner |
| `frontend/src/utils/flashSaleAuctionStore.ts` | Store localStorage cho đấu giá Flash Sale |
| `frontend/src/pages/shop/BannerAuctionPage.tsx` | Trang Shop: đặt giá, xác nhận thắng, thanh toán, đăng bài |
| `frontend/src/pages/admin/AuctionManagementPage.tsx` | Trang Admin: cấu hình, khoá/mở phiên, duyệt nội dung |

---

## 🗺️ Luồng nghiệp vụ tổng quát

```
Shop đặt giá (real-time) 
  → Hết giờ: chốt người thắng 
  → Popup xác nhận điều khoản (1 giờ để thanh toán) 
  → Shop thanh toán 
  → Modal đăng banner/sản phẩm (nhập thông tin + upload ảnh validate) 
  → Admin duyệt ✅ / ❌ 
  → Hiển thị trên Trang chủ
```

---

## 📐 Thông số ảnh yêu cầu (lấy từ Home.tsx)

| Vị trí | Tỉ lệ | Khuyến nghị | Tối đa |
|--------|-------|-------------|--------|
| Banner đầu trang (home_slider) | 8:3 (ngang dài) | 1280×480px | 2048 KB |
| Banner Mall chính (mall_ads_main) | 9:4 (ngang) | 900×400px | 2048 KB |
| Banner Mall cố định (mall_ads_fixed) | 1:1 (vuông) | 400×400px | 2048 KB |
| Ảnh sản phẩm Flash Sale | 1:1 (vuông) | 600×600px | 2048 KB |

---

## 💾 CODE: bannerAuctionStore.ts

```typescript
// Hệ thống "Đấu giá vị trí banner": chỉ Shop được vào đặt giá để banner của mình
// xuất hiện ở các vị trí hot trên Trang chủ (banner slider đầu trang, banner BuyZo Mall...)
// Toàn bộ lưu localStorage — demo/mock, chưa có backend thực.

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

// ── Định nghĩa vị trí đấu giá ────────────────────────────────────────────────
export type BannerPositionKey = 'home_slider' | 'mall_ads_main' | 'mall_ads_fixed'

export interface BannerPositionDef {
  key: BannerPositionKey
  label: string
  description: string
  basePrice: number
  previewImage: string
}

export const BANNER_POSITIONS: BannerPositionDef[] = [
  {
    key: 'home_slider',
    label: 'Banner đầu Trang chủ',
    description: 'Vị trí slider chạy tự động ngay đầu Trang chủ — vị trí hot nhất, mọi khách đều thấy ngay khi vào BuyZo.',
    basePrice: 2_000_000,
    previewImage: '/banner/1.png',
  },
  {
    key: 'mall_ads_main',
    label: 'Banner BuyZo Mall (khu chính)',
    description: 'Banner chạy lớn (7 phần) trong khu quảng cáo BuyZo Mall trên Trang chủ.',
    basePrice: 1_200_000,
    previewImage: encodeURI('/banner_thueQC/ChatGPT Image Jun 19, 2026, 01_09_11 PM.png'),
  },
  {
    key: 'mall_ads_fixed',
    label: 'Banner BuyZo Mall (khu cố định)',
    description: 'Banner cố định (3 phần) bên cạnh khu quảng cáo chạy của BuyZo Mall.',
    basePrice: 800_000,
    previewImage: '/banner/4.png',
  },
]

const FAKE_SHOP_NAMES = [
  'TechWorld Store', 'FashionVN', 'BookStore360', 'Mẹ và Bé Xinh', 'Nhà Sạch Plus',
  'Đồ Gia Dụng An Phát', 'Giày Sneaker House', 'Mỹ Phẩm Hàn Việt', 'Thế Giới Phụ Kiện',
]
const FAKE_EMOJIS = ['🔥', '🎉', '🛍️', '⚡', '🎁', '👗', '📱', '🍱', '✨']

export function injectFakeBid(position: BannerPositionKey): BannerBid | null {
  const data = getStore()
  const session = rollIfExpired(data, position)
  if (!session || new Date(session.endsAt).getTime() <= Date.now()) return null
  const basePrice = data.settings[position]?.basePrice ?? BANNER_POSITIONS.find(d => d.key === position)!.basePrice
  const highest = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
  const base = highest ? highest.amount : basePrice - MIN_STEP
  const bump = MIN_STEP + Math.floor(Math.random() * 4) * 25_000
  const amount = base + bump
  const bid: BannerBid = {
    id: 'fake-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    shopName: FAKE_SHOP_NAMES[Math.floor(Math.random() * FAKE_SHOP_NAMES.length)],
    amount,
    bannerImage: FAKE_EMOJIS[Math.floor(Math.random() * FAKE_EMOJIS.length)],
    time: new Date().toISOString(),
  }
  session.bids.unshift(bid)
  data.sessions[position] = session
  saveStore(data)
  return bid
}

export const AUCTION_DURATION_MS = 5 * 60 * 1000
export const MIN_STEP = 50_000
export const TURN_COOLDOWN_MS = 10 * 1000

export interface BannerBid {
  id: string
  shopName: string
  amount: number
  bannerImage?: string
  time: string
}

export const PAYMENT_WINDOW_MS = 60 * 60 * 1000

export interface BannerAuctionSession {
  id: string
  position: BannerPositionKey
  startedAt: string
  endsAt: string
  bids: BannerBid[]
  status: 'active' | 'ended'
  winner?: BannerBid
  confirmation?: 'pending' | 'confirmed' | 'declined' | 'expired' | 'paid'
  paymentDeadline?: string
  displayDurationMs?: number
}

export interface AuctionAdminSettings {
  basePrice: number
  biddingDurationMs: number
  displayDurationMs: number
  locked: boolean
}

function defaultSettings(basePrice: number): AuctionAdminSettings {
  return { basePrice, biddingDurationMs: AUCTION_DURATION_MS, displayDurationMs: 2 * 24 * 60 * 60 * 1000, locked: false }
}

// ── Yêu cầu kích thước/định dạng ảnh banner cho từng vị trí ──────────────────
export interface ImageSpec {
  ratioLabel: string
  ratio: number
  tolerance: number
  recommendedW: number
  recommendedH: number
  maxKB: number
}

export const BANNER_IMAGE_SPECS: Record<BannerPositionKey, ImageSpec> = {
  home_slider:    { ratioLabel: '8:3 (ngang dài)', ratio: 1280/480, tolerance: 0.1, recommendedW: 1280, recommendedH: 480, maxKB: 2048 },
  mall_ads_main:  { ratioLabel: '9:4 (ngang)',     ratio: 900/400,  tolerance: 0.1, recommendedW: 900,  recommendedH: 400, maxKB: 2048 },
  mall_ads_fixed: { ratioLabel: '1:1 (vuông)',     ratio: 1,        tolerance: 0.1, recommendedW: 400,  recommendedH: 400, maxKB: 2048 },
}

// ── BannerSubmission ──────────────────────────────────────────────────────────
export interface BannerSubmission {
  id: string
  historyId: string
  position: BannerPositionKey
  shopName: string
  title: string
  link?: string
  image: string
  status: 'pending' | 'approved' | 'rejected'
  rejectReason?: string
  createdAt: string
}

interface StoreData {
  sessions: Record<BannerPositionKey, BannerAuctionSession>
  history: BannerAuctionSession[]
  settings: Record<BannerPositionKey, AuctionAdminSettings>
  submissions: BannerSubmission[]
}

const KEY = 'buyzo_banner_auction_v1'

function newSession(position: BannerPositionKey, settings: AuctionAdminSettings): BannerAuctionSession {
  const now = Date.now()
  return { id: position + '-' + now, position, startedAt: new Date(now).toISOString(), endsAt: new Date(now + settings.biddingDurationMs).toISOString(), bids: [], status: 'active' }
}

function getStore(): StoreData {
  const data = readJSON<StoreData>(KEY, { sessions: {} as any, history: [], settings: {} as any, submissions: [] })
  if (!data.sessions) data.sessions = {} as any
  if (!data.history) data.history = []
  if (!data.settings) data.settings = {} as any
  if (!data.submissions) data.submissions = []
  let changed = false
  for (const def of BANNER_POSITIONS) {
    if (!data.settings[def.key]) { data.settings[def.key] = defaultSettings(def.basePrice); changed = true }
  }
  for (const def of BANNER_POSITIONS) {
    if (!data.sessions[def.key] && !data.settings[def.key].locked) { data.sessions[def.key] = newSession(def.key, data.settings[def.key]); changed = true }
  }
  if (changed) writeJSON(KEY, data)
  return data
}

function saveStore(data: StoreData) { writeJSON(KEY, data) }

export function getAdminSettings(): Record<BannerPositionKey, AuctionAdminSettings> { return getStore().settings }
export function updateAdminSettings(position: BannerPositionKey, patch: Partial<Omit<AuctionAdminSettings, 'locked'>>): void {
  const data = getStore(); data.settings[position] = { ...data.settings[position], ...patch }; saveStore(data)
}
export function lockPosition(position: BannerPositionKey): void {
  const data = getStore(); const session = data.sessions[position]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: BannerAuctionSession = { ...session, status: 'ended', winner, confirmation: winner ? 'pending' : undefined, paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined, displayDurationMs: data.settings[position].displayDurationMs }
    data.history.unshift(ended); data.history = data.history.slice(0, 30)
  }
  data.settings[position] = { ...data.settings[position], locked: true }; delete (data.sessions as any)[position]; saveStore(data)
}
export function openAuction(position: BannerPositionKey): BannerAuctionSession {
  const data = getStore(); const session = data.sessions[position]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: BannerAuctionSession = { ...session, status: 'ended', winner, confirmation: winner ? 'pending' : undefined, paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined, displayDurationMs: data.settings[position].displayDurationMs }
    data.history.unshift(ended); data.history = data.history.slice(0, 30)
  }
  data.settings[position] = { ...data.settings[position], locked: false }
  const fresh = newSession(position, data.settings[position]); data.sessions[position] = fresh; saveStore(data); return fresh
}
export function isLocked(position: BannerPositionKey): boolean { return !!getStore().settings[position]?.locked }

function rollIfExpired(data: StoreData, position: BannerPositionKey): BannerAuctionSession | undefined {
  const session = data.sessions[position]
  if (session && new Date(session.endsAt).getTime() <= Date.now() && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const settings = data.settings[position]
    const ended: BannerAuctionSession = { ...session, status: 'ended', winner, confirmation: winner ? 'pending' : undefined, paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined, displayDurationMs: settings.displayDurationMs }
    data.history.unshift(ended); data.history = data.history.slice(0, 30)
    if (settings.locked) delete (data.sessions as any)[position]
    else data.sessions[position] = newSession(position, settings)
  }
  return data.sessions[position]
}

export function getActiveSession(position: BannerPositionKey): BannerAuctionSession | undefined {
  const data = getStore(); const session = rollIfExpired(data, position); saveStore(data); return session
}
export function getAllActiveSessions(): Partial<Record<BannerPositionKey, BannerAuctionSession>> {
  const data = getStore(); for (const def of BANNER_POSITIONS) rollIfExpired(data, def.key); saveStore(data); return data.sessions
}
export function getHistory(position?: BannerPositionKey): BannerAuctionSession[] {
  const data = getStore(); return position ? data.history.filter(h => h.position === position) : data.history
}
export function getHighestBid(position: BannerPositionKey): BannerBid | undefined {
  const session = getActiveSession(position); if (!session || !session.bids.length) return undefined
  return session.bids.reduce((a, b) => (b.amount > a.amount ? b : a))
}
export function getMinNextBid(position: BannerPositionKey): number {
  const data = getStore(); const basePrice = data.settings[position]?.basePrice ?? BANNER_POSITIONS.find(d => d.key === position)!.basePrice
  const highest = getHighestBid(position); return (highest ? highest.amount : basePrice - MIN_STEP) + MIN_STEP
}

export interface PlaceBidResult { ok: boolean; error?: string; session?: BannerAuctionSession }

export function getShopCooldownRemaining(position: BannerPositionKey, shopName: string): number {
  const data = getStore(); const session = rollIfExpired(data, position); if (!session) return 0
  const lastByShop = session.bids.find(b => b.shopName === shopName); if (!lastByShop) return 0
  const elapsed = Date.now() - new Date(lastByShop.time).getTime(); return Math.max(0, TURN_COOLDOWN_MS - elapsed)
}

export function placeBid(position: BannerPositionKey, shopName: string, amount: number, bannerImage?: string): PlaceBidResult {
  const data = getStore(); const session = rollIfExpired(data, position)
  if (!session) return { ok: false, error: 'Vị trí này đang bị Admin tạm khoá, chưa thể đặt giá.' }
  const basePrice = data.settings[position]?.basePrice ?? BANNER_POSITIONS.find(d => d.key === position)!.basePrice
  const minNext = (session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)).amount : basePrice - MIN_STEP) + MIN_STEP
  if (new Date(session.endsAt).getTime() <= Date.now()) return { ok: false, error: 'Phiên đấu giá đã kết thúc, vui lòng đặt giá ở phiên mới.' }
  const lastByShop = session.bids.find(b => b.shopName === shopName)
  if (lastByShop) {
    const elapsed = Date.now() - new Date(lastByShop.time).getTime()
    if (elapsed < TURN_COOLDOWN_MS) { const remainingSec = Math.ceil((TURN_COOLDOWN_MS - elapsed) / 1000); return { ok: false, error: `Vui lòng chờ ${remainingSec}s nữa để đặt giá lượt tiếp theo.` } }
  }
  if (amount < minNext) return { ok: false, error: `Giá đặt phải tối thiểu ${minNext.toLocaleString('vi-VN')}đ` }
  const bid: BannerBid = { id: 'bid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), shopName, amount, bannerImage, time: new Date().toISOString() }
  session.bids.unshift(bid); data.sessions[position] = session; saveStore(data); return { ok: true, session }
}

export function sweepExpiredWins(): BannerAuctionSession[] {
  const data = getStore(); const now = Date.now(); const justExpired: BannerAuctionSession[] = []
  data.history = data.history.map(h => {
    if ((h.confirmation === 'pending' || h.confirmation === 'confirmed') && h.paymentDeadline && new Date(h.paymentDeadline).getTime() <= now) {
      const updated: BannerAuctionSession = { ...h, confirmation: 'expired' }; justExpired.push(updated); return updated
    }
    return h
  })
  if (justExpired.length) saveStore(data); return justExpired
}

export function payWin(historyId: string): boolean {
  const data = getStore(); const idx = data.history.findIndex(h => h.id === historyId); if (idx === -1) return false
  const h = data.history[idx]; if (h.confirmation !== 'confirmed') return false
  if (h.paymentDeadline && new Date(h.paymentDeadline).getTime() <= Date.now()) return false
  data.history[idx] = { ...h, confirmation: 'paid' }; saveStore(data); return true
}

export function submitBanner(historyId: string, payload: { title: string; link?: string; image: string }): BannerSubmission | null {
  const data = getStore(); const h = data.history.find(x => x.id === historyId)
  if (!h || h.confirmation !== 'paid' || !h.winner) return null
  const existingIdx = data.submissions.findIndex(s => s.historyId === historyId)
  if (existingIdx !== -1 && data.submissions[existingIdx].status !== 'rejected') return null
  const submission: BannerSubmission = {
    id: existingIdx !== -1 ? data.submissions[existingIdx].id : 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    historyId, position: h.position, shopName: h.winner.shopName,
    title: payload.title, link: payload.link, image: payload.image, status: 'pending', createdAt: new Date().toISOString(),
  }
  if (existingIdx !== -1) data.submissions[existingIdx] = submission
  else data.submissions.unshift(submission)
  saveStore(data); return submission
}

export function getSubmissionByHistoryId(historyId: string): BannerSubmission | undefined { return getStore().submissions.find(s => s.historyId === historyId) }
export function getAllSubmissions(): BannerSubmission[] { return getStore().submissions }
export function approveSubmission(id: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'approved', rejectReason: undefined }; saveStore(data); return true
}
export function rejectSubmission(id: string, reason?: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'rejected', rejectReason: reason }; saveStore(data); return true
}
export function getPendingWinsForShop(shopName: string): BannerAuctionSession[] {
  sweepExpiredWins(); const data = getStore()
  return data.history.filter(h => h.winner?.shopName === shopName && h.confirmation === 'pending')
}
export function confirmWin(historyId: string, accept: boolean): boolean {
  const data = getStore(); const idx = data.history.findIndex(h => h.id === historyId); if (idx === -1) return false
  data.history[idx] = { ...data.history[idx], confirmation: accept ? 'confirmed' : 'declined' }; saveStore(data); return true
}
export function msUntilEnd(session: BannerAuctionSession): number { return Math.max(0, new Date(session.endsAt).getTime() - Date.now()) }
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000); const m = Math.floor(totalSec / 60); const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
```

---

## 💾 CODE: flashSaleAuctionStore.ts

```typescript
// Hệ thống "Đấu giá vị trí Flash Sale": Shop dùng sản phẩm của mình để đấu giá
// giành 1 trong các vị trí hot trong khu FLASH SALE trên Trang chủ.
// Toàn bộ lưu localStorage — demo/mock, chưa có backend thực.

function readJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export type FlashSlotKey = 'flash_slot_1' | 'flash_slot_2' | 'flash_slot_3' | 'flash_slot_4'

export interface FlashSlotDef { key: FlashSlotKey; label: string; description: string; basePrice: number }

export const FLASH_SLOTS: FlashSlotDef[] = [
  { key: 'flash_slot_1', label: 'Vị trí #1 — đầu khung Flash Sale', description: 'Vị trí đầu tiên, hiện ngay khi khách lướt tới khu Flash Sale.', basePrice: 600_000 },
  { key: 'flash_slot_2', label: 'Vị trí #2', description: 'Vị trí thứ 2 trong khu Flash Sale Trang chủ.', basePrice: 500_000 },
  { key: 'flash_slot_3', label: 'Vị trí #3', description: 'Vị trí thứ 3 trong khu Flash Sale Trang chủ.', basePrice: 500_000 },
  { key: 'flash_slot_4', label: 'Vị trí #4', description: 'Vị trí thứ 4 trong khu Flash Sale Trang chủ.', basePrice: 400_000 },
]

export const AUCTION_DURATION_MS = 5 * 60 * 1000
export const MIN_STEP = 50_000
export const TURN_COOLDOWN_MS = 10 * 1000
export const PAYMENT_WINDOW_MS = 60 * 60 * 1000

export interface FlashBid { id: string; shopName: string; productName: string; productImage?: string; amount: number; time: string }
export interface FlashAuctionSession {
  id: string; slot: FlashSlotKey; startedAt: string; endsAt: string; bids: FlashBid[]
  status: 'active' | 'ended'; winner?: FlashBid
  confirmation?: 'pending' | 'confirmed' | 'declined' | 'expired' | 'paid'
  paymentDeadline?: string; displayDurationMs?: number
}
export interface AuctionAdminSettings { basePrice: number; biddingDurationMs: number; displayDurationMs: number; locked: boolean }

// ── Spec ảnh sản phẩm Flash Sale ─────────────────────────────────────────────
export interface ImageSpec { ratioLabel: string; ratio: number; tolerance: number; recommendedW: number; recommendedH: number; maxKB: number }
export const FLASH_IMAGE_SPEC: ImageSpec = {
  ratioLabel: '1:1 (vuông)', ratio: 1, tolerance: 0.12, recommendedW: 600, recommendedH: 600, maxKB: 2048,
}

// ── FlashSubmission ───────────────────────────────────────────────────────────
export interface FlashSubmission {
  id: string; historyId: string; slot: FlashSlotKey; shopName: string
  productName: string; price: number; productImage?: string
  status: 'pending' | 'approved' | 'rejected'; rejectReason?: string; createdAt: string
}

// ... (các hàm getStore, saveStore, rollIfExpired, placeBid, payWin, confirmWin, sweepExpiredWins
//     getPendingWinsForShop, getAllActiveSessions, getHistory, getHighestBid, getMinNextBid,
//     getShopCooldownRemaining, openAuction, lockPosition, updateAdminSettings, getAdminSettings,
//     injectFakeBid, msUntilEnd, formatCountdown — cấu trúc tương tự bannerAuctionStore.ts)

export function submitFlashProduct(historyId: string, payload: { productName: string; price: number; productImage: string }): FlashSubmission | null {
  const data = getStore(); const h = data.history.find(x => x.id === historyId)
  if (!h || h.confirmation !== 'paid' || !h.winner) return null
  if (!payload.productName.trim() || !payload.price || payload.price <= 0 || !payload.productImage) return null
  const existingIdx = data.submissions.findIndex(s => s.historyId === historyId)
  if (existingIdx !== -1 && data.submissions[existingIdx].status !== 'rejected') return null
  const submission: FlashSubmission = {
    id: existingIdx !== -1 ? data.submissions[existingIdx].id : 'fsub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    historyId, slot: h.slot, shopName: h.winner.shopName,
    productName: payload.productName.trim(), price: payload.price, productImage: payload.productImage,
    status: 'pending', createdAt: new Date().toISOString(),
  }
  if (existingIdx !== -1) data.submissions[existingIdx] = submission
  else data.submissions.unshift(submission)
  saveStore(data); return submission
}

export function getFlashSubmissionByHistoryId(historyId: string): FlashSubmission | undefined { return getStore().submissions.find(s => s.historyId === historyId) }
export function getAllFlashSubmissions(): FlashSubmission[] { return getStore().submissions }
export function approveFlashSubmission(id: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'approved', rejectReason: undefined }; saveStore(data); return true
}
export function rejectFlashSubmission(id: string, reason?: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'rejected', rejectReason: reason }; saveStore(data); return true
}
```

---

## 💾 CODE: BannerAuctionPage.tsx (Shop)

> File đầy đủ tại: `frontend/src/pages/shop/BannerAuctionPage.tsx`  
> Dưới đây là các phần quan trọng nhất:

### Helpers validate ảnh
```typescript
function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function getImageDims(dataUrl: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = reject
    img.src = dataUrl
  })
}

async function validateImageFile(file: File, spec: ImageSpec): Promise<{ ok: boolean; error?: string; dataUrl?: string }> {
  const sizeKB = file.size / 1024
  if (sizeKB > spec.maxKB) return { ok: false, error: `Ảnh quá lớn (${Math.round(sizeKB).toLocaleString('vi-VN')}KB) — tối đa ${spec.maxKB.toLocaleString('vi-VN')}KB.` }
  const dataUrl = await readFileAsDataUrl(file)
  try {
    const { w, h } = await getImageDims(dataUrl)
    const ratio = w / h; const diff = Math.abs(ratio - spec.ratio) / spec.ratio
    if (diff > spec.tolerance) return { ok: false, error: `Tỉ lệ ảnh chưa đúng (${w}×${h}px) — yêu cầu tỉ lệ ${spec.ratioLabel} (≈${spec.recommendedW}×${spec.recommendedH}px).` }
  } catch { /* ignore, chỉ check dung lượng */ }
  return { ok: true, dataUrl }
}
```

### State quan trọng
```typescript
const [submitTarget, setSubmitTarget] = useState<PendingWin | null>(null)
const [bannerForm, setBannerForm] = useState<{ title: string; link: string; image: string }>({ title: '', link: '', image: '' })
const [bannerImgError, setBannerImgError] = useState('')
const [flashForm, setFlashForm] = useState<{ productName: string; price: string; image: string }>({ productName: '', price: '', image: '' })
const [flashImgError, setFlashImgError] = useState('')
```

### Handlers submit
```typescript
const handleBannerImageFile = async (file: File) => {
  if (!submitTarget) return
  const position = (submitTarget.session as BannerAuctionSession).position
  const spec = BANNER_IMAGE_SPECS[position]
  const result = await validateImageFile(file, spec)
  if (!result.ok) { setBannerImgError(result.error || 'Ảnh không hợp lệ.'); return }
  setBannerImgError(''); setBannerForm(f => ({ ...f, image: result.dataUrl! }))
}

const handleFlashImageFile = async (file: File) => {
  const result = await validateImageFile(file, FLASH_IMAGE_SPEC)
  if (!result.ok) { setFlashImgError(result.error || 'Ảnh không hợp lệ.'); return }
  setFlashImgError(''); setFlashForm(f => ({ ...f, image: result.dataUrl! }))
}

const handleSubmitBanner = () => {
  if (!submitTarget) return
  if (!bannerForm.title.trim() || !bannerForm.image) { toast.error('Vui lòng nhập tiêu đề và chọn hình ảnh banner đúng yêu cầu.'); return }
  if (bannerImgError) { toast.error(bannerImgError); return }
  const result = submitBanner(submitTarget.session.id, { title: bannerForm.title.trim(), link: bannerForm.link.trim() || undefined, image: bannerForm.image })
  if (!result) { toast.error('Không thể đăng banner — vui lòng thử lại.'); return }
  toast.success('📢 Đã gửi banner cho Admin duyệt!'); setSubmitTarget(null); refresh()
}

const handleSubmitFlash = () => {
  if (!submitTarget) return
  const priceNum = Number(flashForm.price.replace(/[^\d]/g, ''))
  if (!flashForm.productName.trim() || !priceNum || priceNum <= 0 || !flashForm.image) { toast.error('Vui lòng nhập đầy đủ tên sản phẩm, giá tiền và hình ảnh đúng yêu cầu.'); return }
  if (flashImgError) { toast.error(flashImgError); return }
  const result = submitFlashProduct(submitTarget.session.id, { productName: flashForm.productName.trim(), price: priceNum, productImage: flashForm.image })
  if (!result) { toast.error('Không thể đăng sản phẩm — vui lòng thử lại.'); return }
  toast.success('📦 Đã gửi sản phẩm cho Admin duyệt!'); setSubmitTarget(null); refreshFlash()
}
```

---

## 💾 CODE: AuctionManagementPage.tsx (Admin)

> File đầy đủ tại: `frontend/src/pages/admin/AuctionManagementPage.tsx`

### Tính năng chính
- **4 stat card:** Tổng vị trí / Đang mở / Đang khoá / Chờ duyệt nội dung
- **Bảng "Chờ duyệt nội dung đấu giá":** kết hợp banner + flash sale submissions, sắp xếp theo ngày đăng mới nhất, có ảnh preview thumbnail, tên/giá sp, nút ✅ Duyệt / ❌ Từ chối + modal nhập lý do từ chối
- **Bảng cấu hình Banner** (3 vị trí): giá khởi điểm, thời gian phiên, thời gian hiển thị, khoá/mở
- **Bảng cấu hình Flash Sale** (4 slot): tương tự
- **Lịch sử phiên** (20 phiên gần nhất): banner + flash gộp chung, sắp xếp ngược thời gian

### Handlers admin
```typescript
const handleApprove = (kind: 'banner' | 'flash', id: string) => {
  if (kind === 'banner') approveBannerSubmission(id)
  else approveFlashSubmission(id)
  refresh()
}

const handleRejectConfirm = () => {
  if (!rejectTarget) return
  if (rejectTarget.kind === 'banner') rejectBannerSubmission(rejectTarget.id, rejectReason.trim() || undefined)
  else rejectFlashSubmission(rejectTarget.id, rejectReason.trim() || undefined)
  setRejectTarget(null); setRejectReason(''); refresh()
}
```

---

## 🔑 Key localStorage

| Key | Nội dung |
|-----|----------|
| `buyzo_banner_auction_v1` | sessions, history, settings, submissions (banner) |
| `buyzo_flash_auction_v1` | sessions, history, settings, submissions (flash sale) |

---

## ⚠️ Lưu ý khi phát triển tiếp

1. **Tất cả là mock/localStorage** — khi chuyển sang backend thật cần thay toàn bộ store functions bằng API calls.
2. **Ảnh lưu dưới dạng base64** — nếu có nhiều shop thì localStorage sẽ đầy nhanh; cần đổi sang Supabase Storage.
3. **AUCTION_DURATION_MS = 5 phút** (demo) — thực tế nên là 24h hoặc 7 ngày.
4. **Validate ảnh client-side** — server cũng cần validate lại khi có backend thật.
5. **Fake bids inject mỗi 3.5s** — chỉ để demo, xoá đi khi deploy thật.
