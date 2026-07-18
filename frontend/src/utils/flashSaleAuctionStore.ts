// Hệ thống "Đấu giá vị trí Flash Sale": Shop dùng sản phẩm của mình để đấu giá
// giành 1 trong các vị trí hot trong khu FLASH SALE trên Trang chủ.
// Toàn bộ lưu localStorage — demo/mock, chưa có backend thực.

import { addNotificationFor } from './notificationStore'

const FLASH_WIN_NOTIFIED_KEY = 'buyzo_flash_win_notified_v1'
function hasFlashWinNotified(historyId: string): boolean {
  try { return (JSON.parse(localStorage.getItem(FLASH_WIN_NOTIFIED_KEY) || '[]') as string[]).includes(historyId) } catch { return false }
}
function markFlashWinNotified(historyId: string): void {
  try {
    const arr = JSON.parse(localStorage.getItem(FLASH_WIN_NOTIFIED_KEY) || '[]') as string[]
    if (!arr.includes(historyId)) { arr.push(historyId); localStorage.setItem(FLASH_WIN_NOTIFIED_KEY, JSON.stringify(arr.slice(-50))) }
  } catch {}
}

function readJSON<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback } catch { return fallback }
}
function writeJSON(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch (e) {
    console.error('[flashSaleAuctionStore] localStorage write failed (quota?):', e)
    throw e
  }
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
export const DEPOSIT_WINDOW_MS = 30 * 60 * 1000
export const DEPOSIT_RATE = 0.2

export interface FlashBid {
  id: string; shopName: string; productName: string; productImage?: string; amount: number; time: string
}

export interface FlashAuctionSession {
  id: string; slot: FlashSlotKey; startedAt: string; endsAt: string; bids: FlashBid[]
  status: 'active' | 'ended'; winner?: FlashBid
  scheduledStartAt?: string  // chờ đến thời điểm này mới mở đặt giá
  description?: string       // mô tả admin
  confirmation?: 'pending' | 'deposit_paid' | 'declined' | 'expired' | 'paid'
  depositDeadline?: string; depositAmount?: number
  paymentDeadline?: string; displayDurationMs?: number
}

export function isAuctionLive(session: FlashAuctionSession): boolean {
  if (!session.scheduledStartAt) return true
  return Date.now() >= new Date(session.scheduledStartAt).getTime()
}
export function msUntilStart(session: FlashAuctionSession): number {
  if (!session.scheduledStartAt) return 0
  return Math.max(0, new Date(session.scheduledStartAt).getTime() - Date.now())
}

export interface AuctionAdminSettings {
  basePrice: number; biddingDurationMs: number; displayDurationMs: number; locked: boolean
}

export interface PlaceBidResult { ok: boolean; error?: string; session?: FlashAuctionSession }

// ── Spec ảnh sản phẩm Flash Sale ─────────────────────────────────────────────
export interface ImageSpec {
  ratioLabel: string; ratio: number; tolerance: number; recommendedW: number; recommendedH: number; maxKB: number
}
export const FLASH_IMAGE_SPEC: ImageSpec = {
  ratioLabel: '1:1 (vuông)', ratio: 1, tolerance: 0.12, recommendedW: 600, recommendedH: 600, maxKB: 2048,
}

// ── FlashSubmission ───────────────────────────────────────────────────────────
export interface FlashSubmission {
  id: string; historyId: string; slot: FlashSlotKey; shopName: string
  productName: string; price: number; productImage?: string
  approvedAt?: string; paymentDeadline?: string
  status: 'pending' | 'approved' | 'rejected' | 'cancelled'; rejectReason?: string; createdAt: string
}

interface StoreData {
  sessions: Record<FlashSlotKey, FlashAuctionSession>
  history: FlashAuctionSession[]
  settings: Record<FlashSlotKey, AuctionAdminSettings>
  submissions: FlashSubmission[]
}

const KEY = 'buyzo_flash_auction_v1'

const FAKE_SHOP_NAMES = [
  'TechWorld Store', 'FashionVN', 'BookStore360', 'Mẹ và Bé Xinh', 'Nhà Sạch Plus',
  'Đồ Giá Dụng Ẩn Phát', 'Giày Sneaker House', 'Mỹ Phẩm Hàn Việt', 'Thế Giới Phụ Kiện',
]
const FAKE_PRODUCTS = ['Tai nghe Bluetooth', 'Kem dưỡng da Hàn', 'Giày thể thao', 'Bình giữ nhiệt', 'Đèn LED', 'Nồi chiên không dầu']

function defaultSettings(basePrice: number): AuctionAdminSettings {
  return { basePrice, biddingDurationMs: AUCTION_DURATION_MS, displayDurationMs: 6 * 60 * 60 * 1000, locked: false }
}

function newSession(
  slot: FlashSlotKey,
  settings: AuctionAdminSettings,
  opts?: { startDelayMinutes?: number; description?: string }
): FlashAuctionSession {
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
  for (const def of FLASH_SLOTS) {
    if (!data.settings[def.key]) { data.settings[def.key] = defaultSettings(def.basePrice); changed = true }
  }
  if (changed) writeJSON(KEY, data)
  return data
}

function saveStore(data: StoreData) { writeJSON(KEY, data) }

function rollIfExpired(data: StoreData, slot: FlashSlotKey): FlashAuctionSession | undefined {
  const session = data.sessions[slot]
  if (session && new Date(session.endsAt).getTime() <= Date.now() && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const settings = data.settings[slot]
    const ended: FlashAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      depositDeadline: winner ? new Date(Date.now() + DEPOSIT_WINDOW_MS).toISOString() : undefined,
      depositAmount: winner ? Math.ceil(winner.amount * DEPOSIT_RATE) : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: settings.displayDurationMs,
    }
    data.history.unshift(ended); data.history = data.history.slice(0, 30)
    // 🔔 Thông báo thắng đấu giá Flash Sale (gửi 1 lần duy nhất)
    if (winner && !hasFlashWinNotified(ended.id)) {
      markFlashWinNotified(ended.id)
      const slotLabel = FLASH_SLOTS.find(s => s.key === slot)?.label ?? slot
      addNotificationFor('', 'shop', 0, {
        title: '⚡ Bạn đã thắng đấu giá Flash Sale!',
        message: `Shop "${winner.shopName}" thắng "${slotLabel}" với ${winner.amount.toLocaleString('vi-VN')}đ. Đặt cọc trong 30 phút để giữ vị trí.`,
        type: 'auction_win',
        action_url: '/shop/auction',
      })
    }
    // Sau khi hết phiên → luôn xoá, chờ Admin mở lại
    delete (data.sessions as any)[slot]
  }
  return data.sessions[slot]
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getActiveSession(slot: FlashSlotKey): FlashAuctionSession | undefined {
  const data = getStore(); const session = rollIfExpired(data, slot); saveStore(data); return session
}

export function getAllActiveSessions(): Partial<Record<FlashSlotKey, FlashAuctionSession>> {
  const data = getStore(); for (const def of FLASH_SLOTS) rollIfExpired(data, def.key); saveStore(data); return data.sessions
}

export function getHistory(slot?: FlashSlotKey): FlashAuctionSession[] {
  const data = getStore(); return slot ? data.history.filter(h => h.slot === slot) : data.history
}

export function getHighestBid(slot: FlashSlotKey): FlashBid | undefined {
  const session = getActiveSession(slot); if (!session || !session.bids.length) return undefined
  return session.bids.reduce((a, b) => (b.amount > a.amount ? b : a))
}

export function getMinNextBid(slot: FlashSlotKey): number {
  const data = getStore()
  const basePrice = data.settings[slot]?.basePrice ?? FLASH_SLOTS.find(d => d.key === slot)!.basePrice
  const highest = getHighestBid(slot)
  return (highest ? highest.amount : basePrice - MIN_STEP) + MIN_STEP
}

export function getShopCooldownRemaining(slot: FlashSlotKey, shopName: string): number {
  const data = getStore(); const session = rollIfExpired(data, slot); if (!session) return 0
  const lastByShop = session.bids.find(b => b.shopName === shopName); if (!lastByShop) return 0
  const elapsed = Date.now() - new Date(lastByShop.time).getTime()
  return Math.max(0, TURN_COOLDOWN_MS - elapsed)
}

export function placeBid(slot: FlashSlotKey, shopName: string, productName: string, amount: number, productImage?: string): PlaceBidResult {
  const data = getStore(); const session = rollIfExpired(data, slot)
  if (!session) return { ok: false, error: 'Vị trí này đang bị Admin tạm khoá, chưa thể đặt giá.' }
  const basePrice = data.settings[slot]?.basePrice ?? FLASH_SLOTS.find(d => d.key === slot)!.basePrice
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
  const bid: FlashBid = {
    id: 'bid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    shopName, productName, productImage, amount, time: new Date().toISOString(),
  }
  session.bids.unshift(bid); data.sessions[slot] = session; saveStore(data)
  return { ok: true, session }
}

export function injectFakeBid(slot: FlashSlotKey): FlashBid | null {
  const data = getStore(); const session = rollIfExpired(data, slot)
  if (!session || new Date(session.endsAt).getTime() <= Date.now()) return null
  const basePrice = data.settings[slot]?.basePrice ?? FLASH_SLOTS.find(d => d.key === slot)!.basePrice
  const highest = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
  const base = highest ? highest.amount : basePrice - MIN_STEP
  const bump = MIN_STEP + Math.floor(Math.random() * 4) * 25_000
  const amount = base + bump
  const bid: FlashBid = {
    id: 'fake-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    shopName: FAKE_SHOP_NAMES[Math.floor(Math.random() * FAKE_SHOP_NAMES.length)],
    productName: FAKE_PRODUCTS[Math.floor(Math.random() * FAKE_PRODUCTS.length)],
    amount, time: new Date().toISOString(),
  }
  session.bids.unshift(bid); data.sessions[slot] = session; saveStore(data)
  return bid
}

export function sweepExpiredWins(): FlashAuctionSession[] {
  const data = getStore(); const now = Date.now(); const justExpired: FlashAuctionSession[] = []
  data.history = data.history.map(h => {
    if (h.confirmation === 'pending' && h.depositDeadline && new Date(h.depositDeadline).getTime() <= now) {
      const updated: FlashAuctionSession = { ...h, confirmation: 'expired' }; justExpired.push(updated); return updated
    }
    if (h.confirmation === 'deposit_paid' && h.paymentDeadline && new Date(h.paymentDeadline).getTime() <= now) {
      const updated: FlashAuctionSession = { ...h, confirmation: 'expired' }; justExpired.push(updated); return updated
    }
    return h
  })
  if (justExpired.length) saveStore(data); return justExpired
}

export function getPendingWinsForShop(shopName: string): FlashAuctionSession[] {
  sweepExpiredWins(); const data = getStore()
  return data.history.filter(h =>
    h.winner?.shopName === shopName && h.confirmation === 'pending'
  )
}

export function payDeposit(historyId: string): boolean {
  const data = getStore(); const idx = data.history.findIndex(h => h.id === historyId); if (idx === -1) return false
  const h = data.history[idx]; if (h.confirmation !== 'pending') return false
  data.history[idx] = { ...h, confirmation: 'deposit_paid' }; saveStore(data)
  // 🔔 Thông báo cọc thành công
  if (h.winner) {
    const slotLabel = FLASH_SLOTS.find(s => s.key === h.slot)?.label ?? h.slot
    addNotificationFor('', 'shop', 0, {
      title: '✅ Đặt cọc Flash Sale thành công!',
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

export function submitFlashProduct(historyId: string, payload: { productName: string; price: number; productImage: string }): FlashSubmission | null {
  const data = getStore(); const h = data.history.find(x => x.id === historyId)
  if (!h || !['deposit_paid', 'paid'].includes(h.confirmation ?? '') || !h.winner) return null
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

export function getFlashSubmissionByHistoryId(historyId: string): FlashSubmission | undefined {
  return getStore().submissions.find(s => s.historyId === historyId)
}
export function getAllFlashSubmissions(): FlashSubmission[] { return getStore().submissions }

const FLASH_PAYMENT_WINDOW_MS = 30 * 60 * 1000

export function approveFlashSubmission(id: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  const approvedAt = new Date().toISOString()
  const paymentDeadline = new Date(Date.now() + FLASH_PAYMENT_WINDOW_MS).toISOString()
  data.submissions[idx] = { ...data.submissions[idx], status: 'approved', rejectReason: undefined, approvedAt, paymentDeadline }
  saveStore(data); return true
}
export function rejectFlashSubmission(id: string, reason?: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'rejected', rejectReason: reason }; saveStore(data); return true
}
export function cancelFlashSubmissionExpired(id: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'cancelled', rejectReason: 'Hết thời gián thanh toán phần còn lại' }
  saveStore(data); return true
}
export function expireFlashDisplaySubmission(id: string): boolean {
  const data = getStore(); const idx = data.submissions.findIndex(s => s.id === id); if (idx === -1) return false
  if (data.submissions[idx].status !== 'approved') return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'cancelled', rejectReason: 'Hết thời gian hiển thị' }
  saveStore(data); return true
}

export function getAdminSettings(): Record<FlashSlotKey, AuctionAdminSettings> { return getStore().settings }
export function updateAdminSettings(slot: FlashSlotKey, patch: Partial<Omit<AuctionAdminSettings, 'locked'>>): void {
  const data = getStore(); data.settings[slot] = { ...data.settings[slot], ...patch }; saveStore(data)
}

export function lockSlot(slot: FlashSlotKey): void {
  const data = getStore(); const session = data.sessions[slot]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: FlashAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      depositDeadline: winner ? new Date(Date.now() + DEPOSIT_WINDOW_MS).toISOString() : undefined,
      depositAmount: winner ? Math.ceil(winner.amount * DEPOSIT_RATE) : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[slot].displayDurationMs,
    }
    data.history.unshift(ended); data.history = data.history.slice(0, 30)
  }
  data.settings[slot] = { ...data.settings[slot], locked: true }
  delete (data.sessions as any)[slot]; saveStore(data)
}

export function openAuction(
  slot: FlashSlotKey,
  opts?: { startDelayMinutes?: number; description?: string }
): FlashAuctionSession {
  const data = getStore(); const session = data.sessions[slot]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: FlashAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      depositDeadline: winner ? new Date(Date.now() + DEPOSIT_WINDOW_MS).toISOString() : undefined,
      depositAmount: winner ? Math.ceil(winner.amount * DEPOSIT_RATE) : undefined,
       paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[slot].displayDurationMs,
    }
    data.history.unshift(ended); data.history = data.history.slice(0, 30)
  }
  data.settings[slot] = { ...data.settings[slot], locked: false }
  const fresh = newSession(slot, data.settings[slot], opts)
  data.sessions[slot] = fresh; saveStore(data)

  // 📢 Broadcast thông báo đến tất cả shop
  const slotLabel = FLASH_SLOTS.find(s => s.key === slot)?.label ?? slot
  const delayMin = opts?.startDelayMinutes ?? 0
  const startTimeStr = delayMin > 0
    ? `sau ${delayMin} phút (${new Date(Date.now() + delayMin * 60000).toLocaleTimeString('vi-VN')})`
    : 'ngay bây giờ'
  addNotificationFor('', 'shop', 0, {
    title: '⚡ Phiên đấu giá Flash Sale mới!',
    message: `"${slotLabel}" mở đấu giá ${startTimeStr}.${opts?.description ? '\n📋 ' + opts.description : ''}\nVào trang Đấu giá để tham gia!`,
    type: 'auction_open',
    action_url: '/shop/auction',
  })

  return fresh
}

export function isLocked(slot: FlashSlotKey): boolean { return !!getStore().settings[slot]?.locked }

export function msUntilEnd(session: FlashAuctionSession): number {
  return Math.max(0, new Date(session.endsAt).getTime() - Date.now())
}
export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000); const m = Math.floor(totalSec / 60); const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
