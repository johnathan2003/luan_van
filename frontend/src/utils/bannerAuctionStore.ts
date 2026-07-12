// Hệ thống "Đấu giá vị trí banner": chỉ Shop được vào đặt giá để banner của mình
// xuất hiện ở các vị trí hot trên Trang chủ (banner slider đầu trang, banner BuyZo Mall...)
// Toàn bộ lưu localStorage — demo/mock, chưa có backend thực.

import { addNotificationFor } from './notificationStore'

// Dedup: tránh gửi thông báo thắng nhiều lần cho cùng 1 phiên
const WIN_NOTIFIED_KEY = 'buyzo_banner_win_notified_v1'
function hasWinNotified(historyId: string): boolean {
  try { return (JSON.parse(localStorage.getItem(WIN_NOTIFIED_KEY) || '[]') as string[]).includes(historyId) } catch { return false }
}
function markWinNotified(historyId: string): void {
  try {
    const arr = JSON.parse(localStorage.getItem(WIN_NOTIFIED_KEY) || '[]') as string[]
    if (!arr.includes(historyId)) { arr.push(historyId); localStorage.setItem(WIN_NOTIFIED_KEY, JSON.stringify(arr.slice(-50))) }
  } catch {}
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) {
    console.error('[bannerAuctionStore] localStorage write failed (quota?):', e)
    throw e  // re-throw so callers know save failed
  }
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
    label: 'Banner Quảng Cáo (Center)',
    description: 'Banner chạy lớn (7 phần) trong khu quảng cáo trung tâm trên Trang chủ.',
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

export const AUCTION_DURATION_MS = 5 * 60 * 1000
export const MIN_STEP = 50_000
export const TURN_COOLDOWN_MS = 10 * 1000
export const PAYMENT_WINDOW_MS = 60 * 60 * 1000
export const DEPOSIT_WINDOW_MS = 30 * 60 * 1000   // 30 phút đặt cọc
export const DEPOSIT_RATE = 0.2                    // 20%

export interface BannerBid {
  id: string
  shopName: string
  amount: number
  bannerImage?: string
  time: string
}

export interface BannerAuctionSession {
  id: string
  position: BannerPositionKey
  startedAt: string
  endsAt: string
  scheduledStartAt?: string  // nếu set → chờ đến thời điểm này mới mở đặt giá
  description?: string       // mô tả admin đặt khi mở phiên
  bids: BannerBid[]
  status: 'active' | 'ended'
  winner?: BannerBid
  confirmation?: 'pending' | 'deposit_paid' | 'declined' | 'expired' | 'paid'
  depositDeadline?: string   // hạn 30p đặt cọc
  depositAmount?: number     // 20% số tiền thắng
  paymentDeadline?: string   // hạn thanh toán đủ (sau khi cọc)
  displayDurationMs?: number
}

/** True khi phiên đã qua thời gian chờ và đang nhận đặt giá */
export function isAuctionLive(session: BannerAuctionSession): boolean {
  if (!session.scheduledStartAt) return true
  return Date.now() >= new Date(session.scheduledStartAt).getTime()
}
/** ms còn lại đến khi phiên bắt đầu (0 nếu đã live) */
export function msUntilStart(session: BannerAuctionSession): number {
  if (!session.scheduledStartAt) return 0
  return Math.max(0, new Date(session.scheduledStartAt).getTime() - Date.now())
}

export interface AuctionAdminSettings {
  basePrice: number
  biddingDurationMs: number
  displayDurationMs: number
  locked: boolean
}

export interface PlaceBidResult { ok: boolean; error?: string; session?: BannerAuctionSession }

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
  home_slider:    { ratioLabel: '8:1 (ngang rất dài)', ratio: 1280/160, tolerance: 0.2, recommendedW: 1280, recommendedH: 160, maxKB: 2048 },
  mall_ads_main:  { ratioLabel: '3:2 (ngang)',     ratio: 1536/1024, tolerance: 0.25, recommendedW: 1536, recommendedH: 1024, maxKB: 4096 },
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
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'
  rejectReason?: string
  createdAt: string
  approvedAt?: string       // ISO — thời điểm admin duyệt
  paymentDeadline?: string  // approvedAt + 30 phút — hạn thanh toán phần còn lại
}

interface StoreData {
  sessions: Record<BannerPositionKey, BannerAuctionSession>
  history: BannerAuctionSession[]
  settings: Record<BannerPositionKey, AuctionAdminSettings>
  submissions: BannerSubmission[]
}

const KEY = 'buyzo_banner_auction_v1'

const FAKE_SHOP_NAMES = [
  'TechWorld Store', 'FashionVN', 'BookStore360', 'Mẹ và Bé Xinh', 'Nhà Sạch Plus',
  'Đồ Giá Dụng Ẩn Phát', 'Giày Sneaker House', 'Mỹ Phẩm Hàn Việt', 'Thế Giới Phụ Kiện',
]
const FAKE_EMOJIS = ['🔥', '🎉', '🛍️', '⚡', '🎁', '👗', '📱', '🍱', '✨']

function defaultSettings(basePrice: number): AuctionAdminSettings {
  return { basePrice, biddingDurationMs: AUCTION_DURATION_MS, displayDurationMs: 2 * 24 * 60 * 60 * 1000, locked: false }
}

function newSession(
  position: BannerPositionKey,
  settings: AuctionAdminSettings,
  opts?: { startDelayMinutes?: number; description?: string }
): BannerAuctionSession {
  const now = Date.now()
  const delayMs = (opts?.startDelayMinutes ?? 0) * 60000
  const scheduledStartAt = delayMs > 0 ? new Date(now + delayMs).toISOString() : undefined
  return {
    id: position + '-' + now, position,
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + delayMs + settings.biddingDurationMs).toISOString(),
    scheduledStartAt,
    description: opts?.description || undefined,
    bids: [], status: 'active',
  }
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
  if (changed) writeJSON(KEY, data)
  return data
}

function saveStore(data: StoreData) { writeJSON(KEY, data) }

function rollIfExpired(data: StoreData, position: BannerPositionKey): BannerAuctionSession | undefined {
  const session = data.sessions[position]
  if (session && new Date(session.endsAt).getTime() <= Date.now() && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const settings = data.settings[position]
    const ended: BannerAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      depositDeadline: winner ? new Date(Date.now() + DEPOSIT_WINDOW_MS).toISOString() : undefined,
      depositAmount: winner ? Math.ceil(winner.amount * DEPOSIT_RATE) : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: settings.displayDurationMs,
    }
    data.history.unshift(ended); data.history = data.history.slice(0, 30)
    // 🔔 Thông báo thắng đấu giá (gửi 1 lần duy nhất)
    if (winner && !hasWinNotified(ended.id)) {
      markWinNotified(ended.id)
      const posLabel = BANNER_POSITIONS.find(p => p.key === position)?.label ?? position
      addNotificationFor('', 'shop', 0, {
        title: '🏆 Bạn đã thắng đấu giá!',
        message: `Shop "${winner.shopName}" thắng vị trí "${posLabel}" với ${winner.amount.toLocaleString('vi-VN')}đ. Đặt cọc trong 30 phút để giữ vị trí.`,
        type: 'auction_win',
        action_url: '/shop/auction',
      })
    }
    // Sau khi hết phiên → luôn xoá, chờ Admin mở lại
    delete (data.sessions as any)[position]
  }
  return data.sessions[position]
}

// ── Public API ────────────────────────────────────────────────────────────────

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
  const data = getStore()
  const basePrice = data.settings[position]?.basePrice ?? BANNER_POSITIONS.find(d => d.key === position)!.basePrice
  const highest = getHighestBid(position)
  return (highest ? highest.amount : basePrice - MIN_STEP) + MIN_STEP
}

export function getShopCooldownRemaining(position: BannerPositionKey, shopName: string): number {
  const data = getStore(); const session = rollIfExpired(data, position); if (!session) return 0
  const lastByShop = session.bids.find(b => b.shopName === shopName); if (!lastByShop) return 0
  const elapsed = Date.now() - new Date(lastByShop.time).getTime()
  return Math.max(0, TURN_COOLDOWN_MS - elapsed)
}

export function placeBid(position: BannerPositionKey, shopName: string, amount: number, bannerImage?: string): PlaceBidResult {
  const data = getStore(); const session = rollIfExpired(data, position)
  if (!session) return { ok: false, error: 'Vị trí này đang bị Admin tạm khoá, chưa thể đặt giá.' }
  const basePrice = data.settings[position]?.basePrice ?? BANNER_POSITIONS.find(d => d.key === position)!.basePrice
  const minNext = (session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)).amount : basePrice - MIN_STEP) + MIN_STEP
  if (!isAuctionLive(session)) return { ok: false, error: `⏳ Phiên chưa bắt đầu. Vui lòng chờ đến ${session.scheduledStartAt ? new Date(session.scheduledStartAt).toLocaleTimeString('vi-VN') : ''}` }
  if (new Date(session.endsAt).getTime() <= Date.now()) return { ok: false, error: 'Phiên đấu giá đã kết thúc, vui lòng đặt giá ở phiên mới.' }
  const lastByShop = session.bids.find(b => b.shopName === shopName)
  if (lastByShop) {
    const elapsed = Date.now() - new Date(lastByShop.time).getTime()
    if (elapsed < TURN_COOLDOWN_MS) {
      const remainingSec = Math.ceil((TURN_COOLDOWN_MS - elapsed) / 1000)
      return { ok: false, error: `Vui lòng chờ ${remainingSec}s nữa để đặt giá lượt tiếp theo.` }
    }
  }
  if (amount < minNext) return { ok: false, error: `Giá đặt phải tối thiểu ${minNext.toLocaleString('vi-VN')}đ` }
  const bid: BannerBid = { id: 'bid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6), shopName, amount, bannerImage, time: new Date().toISOString() }
  session.bids.unshift(bid); data.sessions[position] = session; saveStore(data)
  return { ok: true, session }
}

export function injectFakeBid(position: BannerPositionKey): BannerBid | null {
  const data = getStore(); const session = rollIfExpired(data, position)
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
  session.bids.unshift(bid); data.sessions[position] = session; saveStore(data)
  return bid
}

export function sweepExpiredWins(): BannerAuctionSession[] {
  const data = getStore(); const now = Date.now(); const justExpired: BannerAuctionSession[] = []
  data.history = data.history.map(h => {
    // Hết hạn đặt cọc 30p → huỷ thắng
    if (h.confirmation === 'pending' && h.depositDeadline && new Date(h.depositDeadline).getTime() <= now) {
      const updated: BannerAuctionSession = { ...h, confirmation: 'expired' }; justExpired.push(updated); return updated
    }
    // Hết hạn thanh toán đủ → huỷ
    if (h.confirmation === 'deposit_paid' && h.paymentDeadline && new Date(h.paymentDeadline).getTime() <= now) {
      const updated: BannerAuctionSession = { ...h, confirmation: 'expired' }; justExpired.push(updated); return updated
    }
    return h
  })
  if (justExpired.length) saveStore(data); return justExpired
}

export function getPendingWinsForShop(shopName: string): BannerAuctionSession[] {
  sweepExpiredWins(); const data = getStore()
  return data.history.filter(h =>
    h.winner?.shopName === shopName && h.confirmation === 'pending'
  )
}

/** Shop đặt cọc 20% — tự động submit draft banner lên admin duyệt nếu có draft */
export function payDeposit(historyId: string, draft?: { title: string; link?: string; image: string }): boolean {
  const data = getStore(); const idx = data.history.findIndex(h => h.id === historyId); if (idx === -1) return false
  const h = data.history[idx]
  if (h.confirmation !== 'pending') return false
  data.history[idx] = { ...h, confirmation: 'deposit_paid' }
  saveStore(data)
  // 🔔 Thông báo cọc thành công
  if (h.winner) {
    const posLabel = BANNER_POSITIONS.find(p => p.key === h.position)?.label ?? h.position
    addNotificationFor('', 'shop', 0, {
      title: '✅ Đặt cọc thành công!',
      message: `Đã xác nhận cọc ${(h.depositAmount ?? 0).toLocaleString('vi-VN')}đ cho vị trí "${posLabel}". Banner của bạn sẽ được admin duyệt sớm.`,
      type: 'deposit_paid',
      action_url: '/shop/auction',
    })
  }
  // Auto-submit draft nếu được truyền vào và chưa có submission
  if (h.winner && draft?.title && draft?.image) {
    const existing = data.submissions ?? []
    const alreadyExists = existing.some(s => s.historyId === historyId)
    if (!alreadyExists) {
      const sub: BannerSubmission = {
        id: 'sub-' + Date.now(), historyId, position: h.position,
        shopName: h.winner.shopName, title: draft.title,
        link: draft.link, image: draft.image,
        status: 'pending', createdAt: new Date().toISOString(),
      }
      data.submissions = [sub, ...existing]
      saveStore(data)
    }
  }
  return true
}

/** Thanh toán phần còn lại (80%) */
export function payWin(historyId: string): boolean {
  const data = getStore(); const idx = data.history.findIndex(h => h.id === historyId); if (idx === -1) return false
  if (data.history[idx].confirmation !== 'deposit_paid') return false
  data.history[idx] = { ...data.history[idx], confirmation: 'paid' }; saveStore(data); return true
}

export function submitBanner(historyId: string, payload: { title: string; link?: string; image: string }): BannerSubmission | null {
  const data = getStore(); const h = data.history.find(x => x.id === historyId)
  if (!h || !['deposit_paid', 'paid'].includes(h.confirmation ?? '') || !h.winner) return null
  const existingIdx = data.submissions.findIndex(s => s.historyId === historyId)
  if (existingIdx !== -1 && data.submissions[existingIdx].status !== 'rejected') return null
  const submission: BannerSubmission = {
    id: existingIdx !== -1 ? data.submissions[existingIdx].id : 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    historyId, position: h.position, shopName: h.winner.shopName,
    title: payload.title, link: payload.link, image: payload.image,
    status: 'pending', createdAt: new Date().toISOString(),
  }
  if (existingIdx !== -1) data.submissions[existingIdx] = submission
  else data.submissions.unshift(submission)
  saveStore(data); return submission
}

export function getSubmissionByHistoryId(historyId: string): BannerSubmission | undefined {
  return getStore().submissions.find(s => s.historyId === historyId)
}
export function getAllSubmissions(): BannerSubmission[] { return getStore().submissions }

/** Seed 3 pending submissions (1 per position) — dùng để test admin UI */
export function seedTestPendingSubmissions(): void {
  const data = getStore()
  const testEntries: Array<{ position: BannerPositionKey; title: string; image: string }> = [
    { position: 'home_slider',   title: '[TEST] Banner Đầu Trang', image: 'https://placehold.co/1280x160/1E3A8A/white?text=Banner+Dau+Trang' },
    { position: 'mall_ads_main', title: '[TEST] Banner Quảng Cáo Center', image: 'https://placehold.co/1536x1024/7C3AED/white?text=Banner+Quang+Cao+Center' },
    { position: 'mall_ads_fixed',title: '[TEST] Banner BuyZo Mall Fixed', image: 'https://placehold.co/400x400/EA580C/white?text=Banner+Mall+Fixed' },
  ]
  for (const { position, title, image } of testEntries) {
    const exists = data.submissions.some(s => s.position === position && s.status === 'pending')
    if (exists) continue
    const fakeHistId = 'test-hist-' + position
    const sub: BannerSubmission = {
      id: 'test-sub-' + position + '-' + Date.now(),
      historyId: fakeHistId, position,
      shopName: 'Shop Demo', title,
      image, status: 'pending',
      createdAt: new Date().toISOString(),
    }
    data.submissions.unshift(sub)
  }
  saveStore(data)
}

const PAYMENT_WINDOW_FINAL_MS = 30 * 60 * 1000 // 30 phút thanh toán phần còn lại

export function approveSubmission(id: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  const approvedAt = new Date().toISOString()
  const paymentDeadline = new Date(Date.now() + PAYMENT_WINDOW_FINAL_MS).toISOString()
  data.submissions[idx] = { ...data.submissions[idx], status: 'approved', rejectReason: undefined, approvedAt, paymentDeadline }
  saveStore(data); return true
}
export function rejectSubmission(id: string, reason?: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'rejected', rejectReason: reason }; saveStore(data); return true
}
export function cancelSubmissionExpired(id: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'cancelled', rejectReason: 'Hết thời gián thanh toán phần còn lại' }
  saveStore(data); return true
}
// ── Image ref system: lưu ảnh lớn ở key riêng, tránh vượt quota ─────────────
const IMG_KEY_PREFIX = 'buyzo_img_'

/** Lưu ảnh vào key riêng, trả về ref string 'ref:<key>' */
export function saveImage(dataUrl: string): string {
  const key = IMG_KEY_PREFIX + Date.now() + '_' + Math.random().toString(36).slice(2, 6)
  // First try to free space by migrating old raw-embedded images
  migrateRawImages()
  localStorage.setItem(key, dataUrl) // throws if quota exceeded — caller handles
  return 'ref:' + key
}

/** Migrate ảnh raw base64 nhúng trong main store → key riêng (giải phóng quota) */
export function migrateRawImages(): void {
  try {
    const data = getStore()
    let changed = false
    for (const sub of data.submissions) {
      if (sub.image && sub.image.startsWith('data:')) {
        try {
          const key = IMG_KEY_PREFIX + sub.id
          localStorage.setItem(key, sub.image)
          sub.image = 'ref:' + key
          changed = true
        } catch { /* nếu vẫn fail thì bỏ qua */ }
      }
    }
    if (changed) saveStore(data)
  } catch { /* ignore */ }
}

/** Xóa key ảnh nếu là ref */
export function removeImage(imageOrRef: string): void {
  if (imageOrRef.startsWith('ref:')) localStorage.removeItem(imageOrRef.slice(4))
}

/** Trả về data URL thực — hỗ trợ cả ref lẫn raw data URL (backward compat) */
export function resolveImage(imageOrRef: string): string {
  if (imageOrRef.startsWith('ref:')) return localStorage.getItem(imageOrRef.slice(4)) ?? ''
  return imageOrRef
}

/** Dọn dẹp: xóa key ảnh của các submission không còn tồn tại */
export function cleanupOrphanImages(): number {
  const data = getStore()
  const activeRefs = new Set(data.submissions.map(s => s.image).filter(i => i.startsWith('ref:')).map(i => i.slice(4)))
  let count = 0
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i)
    if (key && key.startsWith(IMG_KEY_PREFIX) && !activeRefs.has(key)) {
      localStorage.removeItem(key)
      i--; count++
    }
  }
  return count
}

/** Admin tạo banner trực tiếp lên trang chủ (không qua đấu giá) */
export function adminCreateBanner(opts: {
  position: BannerPositionKey
  title: string
  image: string
  link?: string
  displayDurationMs?: number
}): void {
  const data = getStore()
  const now = new Date().toISOString()
  const fakeHistId = 'admin_' + Date.now()
  const fakeHistory: BannerAuctionSession = {
    id: fakeHistId,
    position: opts.position,
    startedAt: now,
    endedAt: now,
    bids: [],
    status: 'ended',
    confirmation: 'paid',
    displayDurationMs: opts.displayDurationMs ?? 7 * 24 * 60 * 60 * 1000,
  }
  data.history.unshift(fakeHistory)
  // Lưu ảnh vào key riêng để tránh làm store blob quá lớn
  const imageRef = saveImage(opts.image)
  const sub: BannerSubmission = {
    id: 'admin_sub_' + Date.now(),
    historyId: fakeHistId,
    position: opts.position,
    shopName: 'BuyZo Admin',
    title: opts.title,
    link: opts.link,
    image: imageRef,
    status: 'approved',
    createdAt: now,
    approvedAt: now,
    paymentDeadline: new Date(Date.now() + 999 * 24 * 60 * 60 * 1000).toISOString(),
  }
  data.submissions.unshift(sub)
  saveStore(data)
}

/** Xóa toàn bộ banner do admin tạo (shopName === 'BuyZo Admin') */
export function purgeAdminBanners(): number {
  const data = getStore()
  const toDelete = data.submissions.filter(s => s.shopName === 'BuyZo Admin')
  toDelete.forEach(s => removeImage(s.image))
  const histIds = new Set(toDelete.map(s => s.historyId))
  data.submissions = data.submissions.filter(s => s.shopName !== 'BuyZo Admin')
  data.history = data.history.filter(h => !histIds.has(h.id))
  saveStore(data)
  return toDelete.length
}

export function deleteSubmission(id: string): boolean {
  const data = getStore()
  const idx = data.submissions.findIndex(s => s.id === id)
  if (idx === -1) return false
  removeImage(data.submissions[idx].image) // xóa key ảnh riêng nếu có
  data.submissions.splice(idx, 1)
  saveStore(data)
  return true
}

export function updateSubmission(id: string, patch: Partial<Pick<BannerSubmission, 'title' | 'image' | 'link'>>): boolean {
  const data = getStore()
  const idx = data.submissions.findIndex(s => s.id === id)
  if (idx === -1) return false
  if (patch.image) {
    removeImage(data.submissions[idx].image) // xóa ảnh cũ
    patch.image = saveImage(patch.image)     // lưu ảnh mới vào key riêng
  }
  data.submissions[idx] = { ...data.submissions[idx], ...patch }
  saveStore(data)
  return true
}

export function expireDisplaySubmission(id: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  if (data.submissions[idx].status !== 'approved') return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'cancelled', rejectReason: 'Hết thời gian hiển thị' }
  saveStore(data); return true
}

export function getAdminSettings(): Record<BannerPositionKey, AuctionAdminSettings> { return getStore().settings }
export function updateAdminSettings(position: BannerPositionKey, patch: Partial<Omit<AuctionAdminSettings, 'locked'>>): void {
  const data = getStore(); data.settings[position] = { ...data.settings[position], ...patch }; saveStore(data)
}

export function lockPosition(position: BannerPositionKey): void {
  const data = getStore(); const session = data.sessions[position]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: BannerAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[position].displayDurationMs,
    }
    data.history.unshift(ended); data.history = data.history.slice(0, 30)
  }
  data.settings[position] = { ...data.settings[position], locked: true }
  delete (data.sessions as any)[position]; saveStore(data)
}

export function openAuction(
  position: BannerPositionKey,
  opts?: { startDelayMinutes?: number; description?: string }
): BannerAuctionSession {
   const data = getStore(); const session = data.sessions[position]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: BannerAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[position].displayDurationMs,
    }
    data.history.unshift(ended); data.history = data.history.slice(0, 30)
  }
  data.settings[position] = { ...data.settings[position], locked: false }
  const fresh = newSession(position, data.settings[position], opts)
  data.sessions[position] = fresh; saveStore(data)

  // 📢 Broadcast thông báo đến tất cả shop
  const posLabel = BANNER_POSITIONS.find(p => p.key === position)?.label ?? position
  const delayMin = opts?.startDelayMinutes ?? 0
  const startTimeStr = delayMin > 0
    ? `sau ${delayMin} phút (${new Date(Date.now() + delayMin * 60000).toLocaleTimeString('vi-VN')})`
    : 'ngay bây giờ'
  addNotificationFor('', 'shop', 0, {
    title: '⚡ Phiên đấu giá mới sắp mở!',
    message: `Vị trí "${posLabel}" mở đấu giá ${startTimeStr}.${opts?.description ? '\n📋 ' + opts.description : ''}\nVào trang Đấu giá để tham gia!`,
    type: 'auction_open',
    action_url: '/shop/auction',
  })

  return fresh
}

export function isLocked(position: BannerPositionKey): boolean { return !!getStore().settings[position]?.locked }

export function msUntilEnd(session: BannerAuctionSession): number {
  return Math.max(0, new Date(session.endsAt).getTime() - Date.now())
}
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000); const m = Math.floor(totalSec / 60); const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
