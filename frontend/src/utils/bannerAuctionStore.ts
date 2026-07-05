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
  bids: BannerBid[]
  status: 'active' | 'ended'
  winner?: BannerBid
  confirmation?: 'pending' | 'deposit_paid' | 'declined' | 'expired' | 'paid'
  depositDeadline?: string   // hạn 30p đặt cọc
  depositAmount?: number     // 20% số tiền thắng
  paymentDeadline?: string   // hạn thanh toán đủ (sau khi cọc)
  displayDurationMs?: number
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
  'Đồ Gia Dụng An Phát', 'Giày Sneaker House', 'Mỹ Phẩm Hàn Việt', 'Thế Giới Phụ Kiện',
]
const FAKE_EMOJIS = ['🔥', '🎉', '🛍️', '⚡', '🎁', '👗', '📱', '🍱', '✨']

function defaultSettings(basePrice: number): AuctionAdminSettings {
  return { basePrice, biddingDurationMs: AUCTION_DURATION_MS, displayDurationMs: 2 * 24 * 60 * 60 * 1000, locked: false }
}

function newSession(position: BannerPositionKey, settings: AuctionAdminSettings): BannerAuctionSession {
  const now = Date.now()
  return {
    id: position + '-' + now, position,
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + settings.biddingDurationMs).toISOString(),
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
  // Kiểm tra shop đã chuẩn bị mẫu banner chưa
  try {
    const KEY_DRAFT = 'buyzo_banner_draft_v1'
    const raw = localStorage.getItem(KEY_DRAFT)
    const drafts = raw ? JSON.parse(raw) : {}
    const draft = drafts?.banners?.[position]
    if (!draft || draft.shopName !== shopName) {
      return { ok: false, error: '⚠️ Bạn chưa chuẩn bị mẫu banner cho vị trí này. Vào tab ⚙️ Chuẩn bị để upload trước khi đặt giá.' }
    }
  } catch {}
  const data = getStore(); const session = rollIfExpired(data, position)
  if (!session) return { ok: false, error: 'Vị trí này đang bị Admin tạm khoá, chưa thể đặt giá.' }
  const basePrice = data.settings[position]?.basePrice ?? BANNER_POSITIONS.find(d => d.key === position)!.basePrice
  const minNext = (session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)).amount : basePrice - MIN_STEP) + MIN_STEP
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

/** Shop đặt cọc 20% — tự động submit draft banner lên admin duyệt */
export function payDeposit(historyId: string): boolean {
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
  // Auto-submit draft nếu chưa có submission
  if (h.winner) {
    try {
      const KEY_DRAFT = 'buyzo_banner_draft_v1'
      const raw = localStorage.getItem(KEY_DRAFT)
      const drafts = raw ? JSON.parse(raw) : {}
      const draft = drafts?.banners?.[h.position]
      if (draft && draft.shopName === h.winner.shopName) {
        // Tạo submission từ draft
        const existing = data.submissions ?? []
        const alreadyExists = existing.some(s => s.historyId === historyId)
        if (!alreadyExists) {
          const sub: BannerSubmission = {
            id: 'sub-' + Date.now(), historyId, position: h.position,
            shopName: h.winner.shopName, title: draft.title,
            link: draft.link, image: draft.image,
            status: 'pending', createdAt: new Date().toISOString(),
          }
          data.submissions = [...existing, sub]
          saveStore(data)
        }
      }
    } catch {}
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
  if (!h || h.confirmation !== 'paid' || !h.winner) return null
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
  data.submissions[idx] = { ...data.submissions[idx], status: 'cancelled', rejectReason: 'Hết thời gian thanh toán phần còn lại' }
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

export function openAuction(position: BannerPositionKey): BannerAuctionSession {
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
  const fresh = newSession(position, data.settings[position])
  data.sessions[position] = fresh; saveStore(data); return fresh
}

export function isLocked(position: BannerPositionKey): boolean { return !!getStore().settings[position]?.locked }

export function msUntilEnd(session: BannerAuctionSession): number {
  return Math.max(0, new Date(session.endsAt).getTime() - Date.now())
}
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000); const m = Math.floor(totalSec / 60); const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
