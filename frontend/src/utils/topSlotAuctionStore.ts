// Hệ thống "Đấu giá Vị trí Top": Shop đấu giá để sản phẩm được hiển thị nổi bật
// tại 100 slot ưu tiên trên Trang chủ BuyZo.
// Toàn bộ lưu localStorage — demo/mock, chưa có backend thực.

import { addNotificationFor } from './notificationStore'

const TOP_WIN_NOTIFIED_KEY = 'buyzo_top_win_notified_v1'
function hasTopWinNotified(historyId: string): boolean {
  try { return (JSON.parse(localStorage.getItem(TOP_WIN_NOTIFIED_KEY) || '[]') as string[]).includes(historyId) } catch { return false }
}
function markTopWinNotified(historyId: string): void {
  try {
    const arr = JSON.parse(localStorage.getItem(TOP_WIN_NOTIFIED_KEY) || '[]') as string[]
    if (!arr.includes(historyId)) { arr.push(historyId); localStorage.setItem(TOP_WIN_NOTIFIED_KEY, JSON.stringify(arr.slice(-50))) }
  } catch {}
}

function readJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* ignore */ }
}

export type TopSlotKey =
  | 'top_1' | 'top_2' | 'top_3' | 'top_4' | 'top_5'
  | 'top_6' | 'top_7' | 'top_8'

export interface TopSlotDef { key: TopSlotKey; label: string; description: string; basePrice: number }

export const TOP_SLOTS: TopSlotDef[] = [
  { key: 'top_1',  label: 'Slot #1  — Vị trí đầu trang',     description: 'Vị trí #1 — nổi bật nhất, hiển thị ngay đầu mục sản phẩm trang chủ.', basePrice: 1_200_000 },
  { key: 'top_2',  label: 'Slot #2  — Vị trí đầu trang',     description: 'Vị trí #2 — ngay cạnh #1, thu hút lượt click cao.', basePrice: 1_000_000 },
  { key: 'top_3',  label: 'Slot #3  — Vị trí đầu trang',     description: 'Vị trí #3 — hàng đầu sản phẩm nổi bật.', basePrice: 900_000 },
  { key: 'top_4',  label: 'Slot #4  — Vị trí đầu trang',     description: 'Vị trí #4 — hàng đầu trang chủ, hiển thị không cần cuộn.', basePrice: 850_000 },
  { key: 'top_5',  label: 'Slot #5  — Vị trí đầu trang',     description: 'Vị trí #5 — hoàn thiện nhóm 5 slot đầu trang.', basePrice: 800_000 },
  { key: 'top_6',  label: 'Slot #6  — Vị trí hàng 2',        description: 'Vị trí #6 — mở đầu hàng thứ 2, vẫn rất nhiều lượt xem.', basePrice: 650_000 },
  { key: 'top_7',  label: 'Slot #7  — Vị trí hàng 2',        description: 'Vị trí #7 — hàng 2 trang chủ, hiệu quả quảng bá cao.', basePrice: 600_000 },
  { key: 'top_8',  label: 'Slot #8  — Vị trí hàng 2',        description: 'Vị trí #8 — hàng 2 trang chủ.', basePrice: 550_000 },
]

export const AUCTION_DURATION_MS = 5 * 60 * 1000
export const MIN_STEP = 2  // bội số của 2
export const TURN_COOLDOWN_MS = 10 * 1000
export const PAYMENT_WINDOW_MS = 60 * 60 * 1000
export const DEPOSIT_WINDOW_MS = 30 * 60 * 1000
export const DEPOSIT_RATE = 0.2

export interface TopBid {
  id: string; shopName: string; productName: string; productImage?: string; amount: number; time: string
}

export interface TopAuctionSession {
  id: string; slot: TopSlotKey; startedAt: string; endsAt: string; bids: TopBid[]
  paused?: boolean
  status: 'active' | 'ended'; winner?: TopBid
  scheduledStartAt?: string
  description?: string
  confirmation?: 'pending' | 'deposit_paid' | 'declined' | 'expired' | 'paid'
  depositDeadline?: string; depositAmount?: number
  paymentDeadline?: string; displayDurationMs?: number
  endPriceHits?: number      // số lần bid chạm endPrice (max 3 → kết thúc phiên)
}

export function isAuctionLive(session: TopAuctionSession): boolean {
  if (!session.scheduledStartAt) return true
  return Date.now() >= new Date(session.scheduledStartAt).getTime()
}
export function msUntilStart(session: TopAuctionSession): number {
  if (!session.scheduledStartAt) return 0
  return Math.max(0, new Date(session.scheduledStartAt).getTime() - Date.now())
}

export interface AuctionAdminSettings {
  slots: number           // Số slot top slot có thể thắng
  advancedEnabled: boolean // Bật/tắt Giá mua hết & Số slot
  basePrice: number       // Giá bắt đầu (giá đặt tối thiểu)
  endPrice?: number       // Giá kết thúc
  buyNowPrice?: number    // Giá mua hết
  biddingDurationMs: number
  displayDurationMs: number
  locked: boolean
}

export interface PlaceBidResult { ok: boolean; error?: string; session?: TopAuctionSession; endPriceHit?: number }

export interface ImageSpec {
  ratioLabel: string; ratio: number; tolerance: number; recommendedW: number; recommendedH: number; maxKB: number
}
export const TOP_IMAGE_SPEC: ImageSpec = {
  ratioLabel: '1:1 (vuông)', ratio: 1, tolerance: 0.12, recommendedW: 600, recommendedH: 600, maxKB: 2048,
}

export interface TopSubmission {
  id: string; historyId: string; slot: TopSlotKey; shopName: string
  productName: string; price: number; productImage?: string
  approvedAt?: string; paymentDeadline?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; rejectReason?: string; createdAt: string
}

interface StoreData {
  sessions: Record<TopSlotKey, TopAuctionSession>
  history: TopAuctionSession[]
  settings: Record<TopSlotKey, AuctionAdminSettings>
  submissions: TopSubmission[]
}

const KEY = 'buyzo_top_slot_auction_v1'

const FAKE_SHOP_NAMES = [
  'TechWorld Store', 'FashionVN', 'BookStore360', 'Mẹ và Bé Xinh', 'Nhà Sạch Plus',
  'Đồ Gia Dụng Ẩn Phát', 'Giày Sneaker House', 'Mỹ Phẩm Hàn Việt', 'Thế Giới Phụ Kiện',
]
const FAKE_PRODUCTS = ['Tai nghe Bluetooth', 'Kem dưỡng da Hàn', 'Giày thể thao', 'Bình giữ nhiệt', 'Đèn LED', 'Nồi chiên không dầu']

function defaultSettings(basePrice: number): AuctionAdminSettings {
  return { slots: 1, advancedEnabled: false, basePrice, biddingDurationMs: AUCTION_DURATION_MS, displayDurationMs: 24 * 60 * 60 * 1000, locked: false }
}

function newSession(
  slot: TopSlotKey,
  settings: AuctionAdminSettings,
  opts?: { startDelayMinutes?: number; description?: string }
): TopAuctionSession {
  const now = Date.now()
  const delayMs = (opts?.startDelayMinutes ?? 0) * 60000
  const scheduledStartAt = delayMs > 0 ? new Date(now + delayMs).toISOString() : undefined
  return {
    id: slot + '-' + now, slot,
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
  for (const def of TOP_SLOTS) {
    if (!data.settings[def.key]) { data.settings[def.key] = defaultSettings(def.basePrice); changed = true }
  }
  if (changed) writeJSON(KEY, data)
  return data
}

function saveStore(data: StoreData) { writeJSON(KEY, data) }

function rollIfExpired(data: StoreData, slot: TopSlotKey): TopAuctionSession | undefined {
  const session = data.sessions[slot]
  if (session && new Date(session.endsAt).getTime() <= Date.now() && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const settings = data.settings[slot]
    const ended: TopAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      depositDeadline: winner ? new Date(Date.now() + DEPOSIT_WINDOW_MS).toISOString() : undefined,
      depositAmount: winner ? Math.ceil(winner.amount * DEPOSIT_RATE) : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: settings.displayDurationMs,
    }
    data.history.unshift(ended); data.history = data.history.slice(0, 60)
    if (winner && !hasTopWinNotified(ended.id)) {
      markTopWinNotified(ended.id)
      const slotLabel = TOP_SLOTS.find(s => s.key === slot)?.label ?? slot
      addNotificationFor('', 'shop', 0, {
        title: '🏆 Bạn đã thắng đấu giá Vị trí Top!',
        message: `Shop "${winner.shopName}" thắng "${slotLabel}" với ${winner.amount.toLocaleString('vi-VN')}đ. Đặt cọc trong 30 phút để giữ vị trí.`,
        type: 'auction_win',
        action_url: '/shop/auction',
      })
    }
    delete (data.sessions as any)[slot]
  }
  return data.sessions[slot]
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getActiveSession(slot: TopSlotKey): TopAuctionSession | undefined {
  const data = getStore(); const session = rollIfExpired(data, slot); saveStore(data); return session
}

export function getAllActiveSessions(): Partial<Record<TopSlotKey, TopAuctionSession>> {
  const data = getStore(); for (const def of TOP_SLOTS) rollIfExpired(data, def.key); saveStore(data); return data.sessions
}

export function getHistory(slot?: TopSlotKey): TopAuctionSession[] {
  const data = getStore(); return slot ? data.history.filter(h => h.slot === slot) : data.history
}

export function getMinNextBid(slot: TopSlotKey): number {
  const data = getStore()
  const basePrice = data.settings[slot]?.basePrice ?? TOP_SLOTS.find(d => d.key === slot)!.basePrice
  const session = getActiveSession(slot)
  const highest = session?.bids.reduce((a, b) => (b.amount > a.amount ? b : a), session.bids[0])
  return (highest ? highest.amount : basePrice) + 2
}

export function getShopCooldownRemaining(slot: TopSlotKey, shopName: string): number {
  const data = getStore(); const session = rollIfExpired(data, slot); if (!session) return 0
  const lastByShop = session.bids.find(b => b.shopName === shopName); if (!lastByShop) return 0
  const elapsed = Date.now() - new Date(lastByShop.time).getTime()
  return Math.max(0, TURN_COOLDOWN_MS - elapsed)
}

export function placeBid(slot: TopSlotKey, shopName: string, productName: string, amount: number, productImage?: string): PlaceBidResult {
  const data = getStore(); const session = rollIfExpired(data, slot)
  if (!session) return { ok: false, error: 'Vị trí này đang bị Admin tạm khoá, chưa thể đặt giá.' }
  if (session.paused) return { ok: false, error: 'Phiên đấu giá đang bị tạm dừng bởi Admin.' }
  const basePrice = data.settings[slot]?.basePrice ?? TOP_SLOTS.find(d => d.key === slot)!.basePrice
  const highestAmt = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)).amount : basePrice
  const minNext = highestAmt + 2
  if (new Date(session.endsAt).getTime() <= Date.now()) return { ok: false, error: 'Phiên đấu giá đã kết thúc, vui lòng đặt giá ở phiên mới.' }
  const lastByShop = session.bids.find(b => b.shopName === shopName)
  if (lastByShop) {
    const elapsed = Date.now() - new Date(lastByShop.time).getTime()
    if (elapsed < TURN_COOLDOWN_MS) {
      const remainingSec = Math.ceil((TURN_COOLDOWN_MS - elapsed) / 1000)
      return { ok: false, error: `Vui lòng chờ ${remainingSec}s nữa để đặt giá lượt tiếp theo.` }
    }
  }
  if (amount < minNext) return { ok: false, error: `Giá đặt tối thiểu ${minNext.toLocaleString('vi-VN')}đ.` }
  if ((amount - highestAmt) % 2 !== 0) return { ok: false, error: 'Giá đặt phải là bội số của 2đ.' }
  const bid: TopBid = {
    id: 'bid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    shopName, productName, productImage, amount, time: new Date().toISOString(),
  }
  session.bids.unshift(bid)

  // ── endPrice: restart về 10s, tối đa 3 lần rồi kết thúc ─────────────────
  const endPrice = data.settings[slot]?.endPrice
  if (endPrice && amount >= endPrice) {
    const hits = (session.endPriceHits ?? 0) + 1
    session.endPriceHits = hits
    if (hits >= 3) {
      session.endsAt = new Date(Date.now() - 1).toISOString() // kết thúc ngay
    } else {
      session.endsAt = new Date(Date.now() + 10_000).toISOString() // restart 10s
    }
  }

  data.sessions[slot] = session; saveStore(data)
  return { ok: true, session, endPriceHit: endPrice && amount >= endPrice ? session.endPriceHits : undefined }
}

export function sweepExpiredWins(): TopAuctionSession[] {
  const data = getStore(); const now = Date.now(); const justExpired: TopAuctionSession[] = []
  data.history = data.history.map(h => {
    if (h.confirmation === 'pending' && h.depositDeadline && new Date(h.depositDeadline).getTime() <= now) {
      const updated: TopAuctionSession = { ...h, confirmation: 'expired' }; justExpired.push(updated); return updated
    }
    if (h.confirmation === 'deposit_paid' && h.paymentDeadline && new Date(h.paymentDeadline).getTime() <= now) {
      const updated: TopAuctionSession = { ...h, confirmation: 'expired' }; justExpired.push(updated); return updated
    }
    return h
  })
  if (justExpired.length) saveStore(data); return justExpired
}

export function getPendingWinsForShop(shopName: string): TopAuctionSession[] {
  sweepExpiredWins(); const data = getStore()
  return data.history.filter(h => h.winner?.shopName === shopName && h.confirmation === 'pending')
}

export function payDeposit(historyId: string): boolean {
  const data = getStore(); const idx = data.history.findIndex(h => h.id === historyId); if (idx === -1) return false
  const h = data.history[idx]; if (h.confirmation !== 'pending') return false
  data.history[idx] = { ...h, confirmation: 'deposit_paid' }; saveStore(data)
  if (h.winner) {
    const slotLabel = TOP_SLOTS.find(s => s.key === h.slot)?.label ?? h.slot
    addNotificationFor('', 'shop', 0, {
      title: '✅ Đặt cọc Vị trí Top thành công!',
      message: `Đã xác nhận cọc ${(h.depositAmount ?? 0).toLocaleString('vi-VN')}đ cho "${slotLabel}". Sản phẩm của bạn sẽ được admin duyệt sớm.`,
      type: 'deposit_paid',
      action_url: '/shop/auction',
    })
  }
  return true
}

export function payWin(historyId: string): boolean {
  const data = getStore(); const idx = data.history.findIndex(h => h.id === historyId); if (idx === -1) return false
  const h = data.history[idx]; if (h.confirmation !== 'deposit_paid') return false
  data.history[idx] = { ...h, confirmation: 'paid' }; saveStore(data); return true
}

export function submitTopProduct(historyId: string, payload: { productName: string; price: number; productImage: string }): TopSubmission | null {
  const data = getStore(); const h = data.history.find(x => x.id === historyId)
  if (!h || h.confirmation !== 'paid' || !h.winner) return null
  if (!payload.productName.trim() || !payload.price || payload.price <= 0 || !payload.productImage) return null
  const existingIdx = data.submissions.findIndex(s => s.historyId === historyId)
  if (existingIdx !== -1 && data.submissions[existingIdx].status !== 'rejected') return null
  const submission: TopSubmission = {
    id: existingIdx !== -1 ? data.submissions[existingIdx].id : 'tsub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    historyId, slot: h.slot, shopName: h.winner.shopName,
    productName: payload.productName.trim(), price: payload.price, productImage: payload.productImage,
    status: 'pending', createdAt: new Date().toISOString(),
  }
  if (existingIdx !== -1) data.submissions[existingIdx] = submission
  else data.submissions.unshift(submission)
  saveStore(data); return submission
}

export function getTopSubmissionByHistoryId(historyId: string): TopSubmission | undefined {
  return getStore().submissions.find(s => s.historyId === historyId)
}
export function getAllTopSubmissions(): TopSubmission[] { return getStore().submissions }

const TOP_PAYMENT_WINDOW_MS = 30 * 60 * 1000

export function approveTopSubmission(id: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  const approvedAt = new Date().toISOString()
  const paymentDeadline = new Date(Date.now() + TOP_PAYMENT_WINDOW_MS).toISOString()
  data.submissions[idx] = { ...data.submissions[idx], status: 'approved', rejectReason: undefined, approvedAt, paymentDeadline }
  saveStore(data); return true
}
export function rejectTopSubmission(id: string, reason?: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'rejected', rejectReason: reason }; saveStore(data); return true
}

export function getAdminSettings(): Record<TopSlotKey, AuctionAdminSettings> { return getStore().settings }
export function updateAdminSettings(slot: TopSlotKey, patch: Partial<Omit<AuctionAdminSettings, 'locked'>>): void {
  const data = getStore(); data.settings[slot] = { ...data.settings[slot], ...patch }; saveStore(data)
}

export function freezeAuction(slot: TopSlotKey): void {
  const data = getStore()
  if (data.sessions[slot]) { data.sessions[slot] = { ...data.sessions[slot]!, paused: true }; saveStore(data) }
}

export function unfreezeAuction(slot: TopSlotKey): void {
  const data = getStore()
  if (data.sessions[slot]) { data.sessions[slot] = { ...data.sessions[slot]!, paused: false }; saveStore(data) }
}

export function cancelAuction(slot: TopSlotKey): void {
  const data = getStore()
  delete (data.sessions as any)[slot]
  data.settings[slot] = { ...data.settings[slot], locked: false }
  saveStore(data)
}

export function lockSlot(slot: TopSlotKey): void {
  const data = getStore(); const session = data.sessions[slot]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: TopAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      depositDeadline: winner ? new Date(Date.now() + DEPOSIT_WINDOW_MS).toISOString() : undefined,
      depositAmount: winner ? Math.ceil(winner.amount * DEPOSIT_RATE) : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[slot].displayDurationMs,
    }
    data.history.unshift(ended); data.history = data.history.slice(0, 60)
  }
  data.settings[slot] = { ...data.settings[slot], locked: true }
  delete (data.sessions as any)[slot]; saveStore(data)
}

export function openAuction(
  slot: TopSlotKey,
  opts?: { startDelayMinutes?: number; description?: string }
): TopAuctionSession {
  const data = getStore(); const session = data.sessions[slot]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: TopAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      depositDeadline: winner ? new Date(Date.now() + DEPOSIT_WINDOW_MS).toISOString() : undefined,
      depositAmount: winner ? Math.ceil(winner.amount * DEPOSIT_RATE) : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[slot].displayDurationMs,
    }
    data.history.unshift(ended); data.history = data.history.slice(0, 60)
  }
  data.settings[slot] = { ...data.settings[slot], locked: false }
  const fresh = newSession(slot, data.settings[slot], opts)
  data.sessions[slot] = fresh; saveStore(data)

  const slotLabel = TOP_SLOTS.find(s => s.key === slot)?.label ?? slot
  const delayMin = opts?.startDelayMinutes ?? 0
  const startTimeStr = delayMin > 0
    ? `sau ${delayMin} phút (${new Date(Date.now() + delayMin * 60000).toLocaleTimeString('vi-VN')})`
    : 'ngay bây giờ'
  addNotificationFor('', 'shop', 0, {
    title: '🏆 Phiên đấu giá Vị trí Top mới!',
    message: `"${slotLabel}" mở đấu giá ${startTimeStr}.${opts?.description ? '\n📋 ' + opts.description : ''}\nVào trang Đấu giá để tham gia!`,
    type: 'auction_open',
    action_url: '/shop/auction',
  })

  return fresh
}

export function msUntilEnd(session: TopAuctionSession): number {
  return Math.max(0, new Date(session.endsAt).getTime() - Date.now())
}
