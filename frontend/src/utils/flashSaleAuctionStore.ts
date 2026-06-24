// Hệ thống "Đấu giá vị trí Flash Sale": Shop dùng sản phẩm của mình để đấu giá
// giành 1 trong các vị trí hot trong khu FLASH SALE trên Trang chủ.
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

// ── Định nghĩa vị trí đấu giá trong khu Flash Sale ───────────────────────────
export type FlashSlotKey = 'flash_slot_1' | 'flash_slot_2' | 'flash_slot_3' | 'flash_slot_4'

export interface FlashSlotDef {
  key: FlashSlotKey
  label: string
  description: string
  basePrice: number // giá khởi điểm (đ/ngày)
}

export const FLASH_SLOTS: FlashSlotDef[] = [
  { key: 'flash_slot_1', label: 'Vị trí #1 — đầu khung Flash Sale', description: 'Vị trí đầu tiên, hiện ngay khi khách lướt tới khu Flash Sale.', basePrice: 600_000 },
  { key: 'flash_slot_2', label: 'Vị trí #2', description: 'Vị trí thứ 2 trong khu Flash Sale Trang chủ.', basePrice: 500_000 },
  { key: 'flash_slot_3', label: 'Vị trí #3', description: 'Vị trí thứ 3 trong khu Flash Sale Trang chủ.', basePrice: 500_000 },
  { key: 'flash_slot_4', label: 'Vị trí #4', description: 'Vị trí thứ 4 trong khu Flash Sale Trang chủ.', basePrice: 400_000 },
]

// ── Giả lập các shop khác đang gọi giá (demo "chạy chạy" cho sống động) ─────
const FAKE_SHOP_NAMES = [
  'TechWorld Store', 'FashionVN', 'BookStore360', 'Mẹ và Bé Xinh', 'Nhà Sạch Plus',
  'Đồ Gia Dụng An Phát', 'Giày Sneaker House', 'Mỹ Phẩm Hàn Việt', 'Thế Giới Phụ Kiện',
]
const FAKE_PRODUCT_NAMES = [
  'Tai nghe Bluetooth Pro Max', 'Áo thun cotton unisex', 'Nồi chiên không dầu 5L',
  'Kem chống nắng SPF50+', 'Bàn phím cơ RGB', 'Túi xách da PU cao cấp',
  'Sạc nhanh 65W 3 cổng', 'Máy xay sinh tố mini',
]

export const AUCTION_DURATION_MS = 5 * 60 * 1000
export const MIN_STEP = 50_000 // mức tối thiểu phải vượt so với giá cao nhất hiện tại (chỉ dùng để tính gợi ý giá, không hiện cho shop)

// đấu giá theo lượt: 1 shop đặt giá xong phải chờ đủ thời gian này mới được đặt lượt tiếp theo
export const TURN_COOLDOWN_MS = 10 * 1000

export interface FlashBid {
  id: string
  shopName: string
  productName: string
  productImage?: string
  amount: number
  time: string
}

// thời hạn thanh toán sau khi thắng đấu giá — quá hạn sẽ tự huỷ kết quả và mở lại phiên đấu giá
export const PAYMENT_WINDOW_MS = 60 * 60 * 1000

export interface FlashAuctionSession {
  id: string
  slot: FlashSlotKey
  startedAt: string
  endsAt: string
  bids: FlashBid[]
  status: 'active' | 'ended'
  winner?: FlashBid
  confirmation?: 'pending' | 'confirmed' | 'declined' | 'expired' | 'paid' // shop thắng cần xác nhận điều khoản & thanh toán
  paymentDeadline?: string // hạn thanh toán (chỉ có khi confirmation === 'pending' hoặc 'confirmed')
  displayDurationMs?: number // số ngày/giờ vị trí sẽ được hiển thị sau khi thắng & thanh toán (do admin set tại thời điểm mở phiên)
}

// ── Cấu hình do Admin quản lý cho mỗi vị trí ─────────────────────────────────
export interface AuctionAdminSettings {
  basePrice: number // giá khởi điểm (đ)
  biddingDurationMs: number // phiên đấu giá kéo dài bao lâu thì tự kết thúc
  displayDurationMs: number // vị trí thắng sẽ được hiển thị trên Trang chủ bao lâu (sau khi thanh toán)
  locked: boolean // admin khoá thủ công — không mở phiên đấu giá mới cho tới khi admin mở lại
}

function defaultSettings(basePrice: number): AuctionAdminSettings {
  return {
    basePrice,
    biddingDurationMs: AUCTION_DURATION_MS,
    displayDurationMs: 2 * 24 * 60 * 60 * 1000, // mặc định hiển thị 2 ngày
    locked: false,
  }
}

// ── Yêu cầu kích thước/định dạng ảnh sản phẩm Flash Sale ─────────────────────
// (đo theo đúng khung ảnh thẻ sản phẩm thật trong khu Flash Sale — Home.tsx)
export interface ImageSpec {
  ratioLabel: string
  ratio: number
  tolerance: number
  recommendedW: number
  recommendedH: number
  maxKB: number
}

export const FLASH_IMAGE_SPEC: ImageSpec = {
  ratioLabel: '1:1 (vuông)', ratio: 1, tolerance: 0.12, recommendedW: 600, recommendedH: 600, maxKB: 2048,
}

// ── Shop nộp sản phẩm sau khi thắng đấu giá & thanh toán — Admin duyệt ──────
export interface FlashSubmission {
  id: string
  historyId: string
  slot: FlashSlotKey
  shopName: string
  productName: string
  price: number
  productImage?: string
  status: 'pending' | 'approved' | 'rejected'
  rejectReason?: string
  createdAt: string
}

interface StoreData {
  sessions: Record<FlashSlotKey, FlashAuctionSession>
  history: FlashAuctionSession[]
  settings: Record<FlashSlotKey, AuctionAdminSettings>
  submissions: FlashSubmission[]
}

const KEY = 'buyzo_flash_auction_v1'

function newSession(slot: FlashSlotKey, settings: AuctionAdminSettings): FlashAuctionSession {
  const now = Date.now()
  return {
    id: slot + '-' + now,
    slot,
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + settings.biddingDurationMs).toISOString(),
    bids: [],
    status: 'active',
  }
}

function getStore(): StoreData {
  const data = readJSON<StoreData>(KEY, {
    sessions: {} as Record<FlashSlotKey, FlashAuctionSession>,
    history: [],
    settings: {} as Record<FlashSlotKey, AuctionAdminSettings>,
    submissions: [],
  })
  // dữ liệu cũ lưu trước khi có tính năng admin-settings sẽ thiếu các field này — bù lại để tránh lỗi undefined
  if (!data.sessions) data.sessions = {} as Record<FlashSlotKey, FlashAuctionSession>
  if (!data.history) data.history = []
  if (!data.settings) data.settings = {} as Record<FlashSlotKey, AuctionAdminSettings>
  if (!data.submissions) data.submissions = []
  let changed = false
  for (const def of FLASH_SLOTS) {
    if (!data.settings[def.key]) {
      data.settings[def.key] = defaultSettings(def.basePrice)
      changed = true
    }
  }
  for (const def of FLASH_SLOTS) {
    if (!data.sessions[def.key] && !data.settings[def.key].locked) {
      data.sessions[def.key] = newSession(def.key, data.settings[def.key])
      changed = true
    }
  }
  if (changed) writeJSON(KEY, data)
  return data
}

function saveStore(data: StoreData) {
  writeJSON(KEY, data)
}

export function getAdminSettings(): Record<FlashSlotKey, AuctionAdminSettings> {
  return getStore().settings
}

export function updateAdminSettings(slot: FlashSlotKey, patch: Partial<Omit<AuctionAdminSettings, 'locked'>>): void {
  const data = getStore()
  data.settings[slot] = { ...data.settings[slot], ...patch }
  saveStore(data)
}

export function lockPosition(slot: FlashSlotKey): void {
  const data = getStore()
  const session = data.sessions[slot]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: FlashAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[slot].displayDurationMs,
    }
    data.history.unshift(ended)
    data.history = data.history.slice(0, 30)
  }
  data.settings[slot] = { ...data.settings[slot], locked: true }
  delete (data.sessions as any)[slot]
  saveStore(data)
}

export function openAuction(slot: FlashSlotKey): FlashAuctionSession {
  const data = getStore()
  const session = data.sessions[slot]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: FlashAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[slot].displayDurationMs,
    }
    data.history.unshift(ended)
    data.history = data.history.slice(0, 30)
  }
  data.settings[slot] = { ...data.settings[slot], locked: false }
  const fresh = newSession(slot, data.settings[slot])
  data.sessions[slot] = fresh
  saveStore(data)
  return fresh
}

export function isLocked(slot: FlashSlotKey): boolean {
  return !!getStore().settings[slot]?.locked
}

function rollIfExpired(data: StoreData, slot: FlashSlotKey): FlashAuctionSession | undefined {
  const session = data.sessions[slot]
  if (session && new Date(session.endsAt).getTime() <= Date.now() && session.status === 'active') {
    const winner = session.bids.length
      ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a))
      : undefined
    const settings = data.settings[slot]
    const ended: FlashAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: settings.displayDurationMs,
    }
    data.history.unshift(ended)
    data.history = data.history.slice(0, 30)
    if (settings.locked) {
      delete (data.sessions as any)[slot]
    } else {
      data.sessions[slot] = newSession(slot, settings)
    }
  }
  return data.sessions[slot]
}

export function getActiveSession(slot: FlashSlotKey): FlashAuctionSession | undefined {
  const data = getStore()
  const session = rollIfExpired(data, slot)
  saveStore(data)
  return session
}

export function getAllActiveSessions(): Partial<Record<FlashSlotKey, FlashAuctionSession>> {
  const data = getStore()
  for (const def of FLASH_SLOTS) rollIfExpired(data, def.key)
  saveStore(data)
  return data.sessions
}

export function getHistory(slot?: FlashSlotKey): FlashAuctionSession[] {
  const data = getStore()
  return slot ? data.history.filter(h => h.slot === slot) : data.history
}

export function getHighestBid(slot: FlashSlotKey): FlashBid | undefined {
  const session = getActiveSession(slot)
  if (!session || !session.bids.length) return undefined
  return session.bids.reduce((a, b) => (b.amount > a.amount ? b : a))
}

export function getMinNextBid(slot: FlashSlotKey): number {
  const data = getStore()
  const basePrice = data.settings[slot]?.basePrice ?? FLASH_SLOTS.find(d => d.key === slot)!.basePrice
  const highest = getHighestBid(slot)
  return (highest ? highest.amount : basePrice - MIN_STEP) + MIN_STEP
}

export interface PlaceFlashBidResult {
  ok: boolean
  error?: string
  session?: FlashAuctionSession
}

// thời điểm (ms) shop này được phép đặt giá lượt tiếp theo trong phiên hiện tại; 0 nếu đặt được ngay
export function getShopCooldownRemaining(slot: FlashSlotKey, shopName: string): number {
  const data = getStore()
  const session = rollIfExpired(data, slot)
  if (!session) return 0
  const lastByShop = session.bids.find(b => b.shopName === shopName) // bids mới nhất nằm ở đầu (unshift)
  if (!lastByShop) return 0
  const elapsed = Date.now() - new Date(lastByShop.time).getTime()
  return Math.max(0, TURN_COOLDOWN_MS - elapsed)
}

export function placeBid(slot: FlashSlotKey, shopName: string, productName: string, amount: number, productImage?: string): PlaceFlashBidResult {
  const data = getStore()
  const session = rollIfExpired(data, slot)
  if (!session) {
    return { ok: false, error: 'Vị trí này đang bị Admin tạm khoá, chưa thể đặt giá.' }
  }
  const basePrice = data.settings[slot]?.basePrice ?? FLASH_SLOTS.find(d => d.key === slot)!.basePrice
  const minNext = (session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)).amount : basePrice - MIN_STEP) + MIN_STEP

  if (new Date(session.endsAt).getTime() <= Date.now()) {
    return { ok: false, error: 'Phiên đấu giá đã kết thúc, vui lòng đặt giá ở phiên mới.' }
  }
  if (!productName) {
    return { ok: false, error: 'Vui lòng chọn sản phẩm muốn đấu giá.' }
  }
  // đấu giá theo lượt: shop phải chờ đủ TURN_COOLDOWN_MS kể từ lượt đặt giá trước của chính mình
  const lastByShop = session.bids.find(b => b.shopName === shopName)
  if (lastByShop) {
    const elapsed = Date.now() - new Date(lastByShop.time).getTime()
    if (elapsed < TURN_COOLDOWN_MS) {
      const remainingSec = Math.ceil((TURN_COOLDOWN_MS - elapsed) / 1000)
      return { ok: false, error: `Vui lòng chờ ${remainingSec}s nữa để đặt giá lượt tiếp theo.` }
    }
  }
  if (amount < minNext) {
    return { ok: false, error: `Giá đặt phải tối thiểu ${minNext.toLocaleString('vi-VN')}đ` }
  }

  const bid: FlashBid = {
    id: 'bid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    shopName,
    productName,
    productImage,
    amount,
    time: new Date().toISOString(),
  }
  session.bids.unshift(bid)
  data.sessions[slot] = session
  saveStore(data)
  return { ok: true, session }
}

// gọi định kỳ từ UI (setInterval) để mô phỏng các shop khác liên tục đặt giá lên
export function injectFakeBid(slot: FlashSlotKey): FlashBid | null {
  const data = getStore()
  const session = rollIfExpired(data, slot)
  if (!session || new Date(session.endsAt).getTime() <= Date.now()) return null

  const basePrice = data.settings[slot]?.basePrice ?? FLASH_SLOTS.find(d => d.key === slot)!.basePrice
  const highest = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
  const base = highest ? highest.amount : basePrice - MIN_STEP
  const bump = MIN_STEP + Math.floor(Math.random() * 4) * 25_000
  const amount = base + bump

  const bid: FlashBid = {
    id: 'fake-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    shopName: FAKE_SHOP_NAMES[Math.floor(Math.random() * FAKE_SHOP_NAMES.length)],
    productName: FAKE_PRODUCT_NAMES[Math.floor(Math.random() * FAKE_PRODUCT_NAMES.length)],
    amount,
    time: new Date().toISOString(),
  }
  session.bids.unshift(bid)
  data.sessions[slot] = session
  saveStore(data)
  return bid
}

// quét toàn bộ lịch sử: phiên nào đang "chờ xác nhận" hoặc "đã xác nhận nhưng chưa thanh toán"
// mà quá hạn thanh toán thì tự động huỷ kết quả (expired) — vị trí đã được mở phiên đấu giá mới ngay khi phiên cũ kết thúc
export function sweepExpiredWins(): FlashAuctionSession[] {
  const data = getStore()
  const now = Date.now()
  const justExpired: FlashAuctionSession[] = []
  data.history = data.history.map(h => {
    if ((h.confirmation === 'pending' || h.confirmation === 'confirmed') && h.paymentDeadline && new Date(h.paymentDeadline).getTime() <= now) {
      const updated: FlashAuctionSession = { ...h, confirmation: 'expired' }
      justExpired.push(updated)
      return updated
    }
    return h
  })
  if (justExpired.length) saveStore(data)
  return justExpired
}

// các phiên mà shop này đã thắng nhưng chưa xác nhận điều khoản (đã tự huỷ những phiên quá hạn)
export function getPendingWinsForShop(shopName: string): FlashAuctionSession[] {
  sweepExpiredWins()
  const data = getStore()
  return data.history.filter(h => h.winner?.shopName === shopName && h.confirmation === 'pending')
}

// shop thanh toán số tiền thắng đấu giá (chỉ hợp lệ khi đã xác nhận điều khoản và chưa quá hạn)
export function payWin(historyId: string): boolean {
  const data = getStore()
  const idx = data.history.findIndex(h => h.id === historyId)
  if (idx === -1) return false
  const h = data.history[idx]
  if (h.confirmation !== 'confirmed') return false
  if (h.paymentDeadline && new Date(h.paymentDeadline).getTime() <= Date.now()) return false
  data.history[idx] = { ...h, confirmation: 'paid' }
  saveStore(data)
  return true
}

// shop nộp sản phẩm sau khi thanh toán thành công — bắt buộc nhập tên sp, giá tiền, hình ảnh đúng chuẩn
export function submitFlashProduct(historyId: string, payload: { productName: string; price: number; productImage: string }): FlashSubmission | null {
  const data = getStore()
  const h = data.history.find(x => x.id === historyId)
  if (!h || h.confirmation !== 'paid' || !h.winner) return null
  if (!payload.productName.trim() || !payload.price || payload.price <= 0 || !payload.productImage) return null
  const existingIdx = data.submissions.findIndex(s => s.historyId === historyId)
  if (existingIdx !== -1 && data.submissions[existingIdx].status !== 'rejected') return null
  const submission: FlashSubmission = {
    id: existingIdx !== -1 ? data.submissions[existingIdx].id : 'fsub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    historyId,
    slot: h.slot,
    shopName: h.winner.shopName,
    productName: payload.productName.trim(),
    price: payload.price,
    productImage: payload.productImage,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
  if (existingIdx !== -1) data.submissions[existingIdx] = submission
  else data.submissions.unshift(submission)
  saveStore(data)
  return submission
}

export function getFlashSubmissionByHistoryId(historyId: string): FlashSubmission | undefined {
  return getStore().submissions.find(s => s.historyId === historyId)
}

export function getAllFlashSubmissions(): FlashSubmission[] {
  return getStore().submissions
}

export function approveFlashSubmission(id: string): boolean {
  const data = getStore()
  const idx = data.submissions.findIndex(s => s.id === id)
  if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'approved', rejectReason: undefined }
  saveStore(data)
  return true
}

export function rejectFlashSubmission(id: string, reason?: string): boolean {
  const data = getStore()
  const idx = data.submissions.findIndex(s => s.id === id)
  if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'rejected', rejectReason: reason }
  saveStore(data)
  return true
}

// shop xác nhận (hoặc từ chối) phiên đã thắng
export function confirmWin(historyId: string, accept: boolean): boolean {
  const data = getStore()
  const idx = data.history.findIndex(h => h.id === historyId)
  if (idx === -1) return false
  data.history[idx] = { ...data.history[idx], confirmation: accept ? 'confirmed' : 'declined' }
  saveStore(data)
  return true
}

export function msUntilEnd(session: FlashAuctionSession): number {
  return Math.max(0, new Date(session.endsAt).getTime() - Date.now())
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
