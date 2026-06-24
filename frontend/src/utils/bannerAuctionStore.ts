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
  basePrice: number // giá khởi điểm (đ/ngày)
  previewImage: string // ảnh minh hoạ vị trí banner thật trên Trang chủ
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

// ── Giả lập các shop khác đang gọi giá (demo "chạy chạy" cho sống động) ─────
const FAKE_SHOP_NAMES = [
  'TechWorld Store', 'FashionVN', 'BookStore360', 'Mẹ và Bé Xinh', 'Nhà Sạch Plus',
  'Đồ Gia Dụng An Phát', 'Giày Sneaker House', 'Mỹ Phẩm Hàn Việt', 'Thế Giới Phụ Kiện',
]
const FAKE_EMOJIS = ['🔥', '🎉', '🛍️', '⚡', '🎁', '👗', '📱', '🍱', '✨']

// gọi định kỳ từ UI (setInterval) để mô phỏng các shop khác liên tục đặt giá lên
export function injectFakeBid(position: BannerPositionKey): BannerBid | null {
  const data = getStore()
  const session = rollIfExpired(data, position)
  if (!session || new Date(session.endsAt).getTime() <= Date.now()) return null

  const basePrice = data.settings[position]?.basePrice ?? BANNER_POSITIONS.find(d => d.key === position)!.basePrice
  const highest = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
  const base = highest ? highest.amount : basePrice - MIN_STEP
  const bump = MIN_STEP + Math.floor(Math.random() * 4) * 25_000 // tăng ngẫu nhiên 1 chút mỗi lượt
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

// Thời hạn 1 phiên đấu giá — demo dùng 5 phút để thấy kết quả nhanh,
// thực tế nên là 24h/7 ngày.
export const AUCTION_DURATION_MS = 5 * 60 * 1000
export const MIN_STEP = 50_000 // mức tối thiểu phải vượt so với giá cao nhất hiện tại (chỉ dùng để tính gợi ý giá, không hiện cho shop)

// đấu giá theo lượt: 1 shop đặt giá xong phải chờ đủ thời gian này mới được đặt lượt tiếp theo
export const TURN_COOLDOWN_MS = 10 * 1000

export interface BannerBid {
  id: string
  shopName: string
  amount: number
  bannerImage?: string // emoji/màu minh hoạ banner shop định gắn vào
  time: string
}

// thời hạn thanh toán sau khi thắng đấu giá — quá hạn sẽ tự huỷ kết quả và mở lại phiên đấu giá
export const PAYMENT_WINDOW_MS = 60 * 60 * 1000

export interface BannerAuctionSession {
  id: string
  position: BannerPositionKey
  startedAt: string
  endsAt: string
  bids: BannerBid[]
  status: 'active' | 'ended'
  winner?: BannerBid
  confirmation?: 'pending' | 'confirmed' | 'declined' | 'expired' | 'paid' // shop thắng cần xác nhận điều khoản & thanh toán
  paymentDeadline?: string // hạn thanh toán (chỉ có khi confirmation === 'pending' hoặc 'confirmed')
  displayDurationMs?: number // số ngày/giờ banner sẽ được hiển thị sau khi thắng & thanh toán (do admin set tại thời điểm mở phiên)
}

// ── Cấu hình do Admin quản lý cho mỗi vị trí ─────────────────────────────────
export interface AuctionAdminSettings {
  basePrice: number // giá khởi điểm (đ)
  biddingDurationMs: number // phiên đấu giá kéo dài bao lâu thì tự kết thúc
  displayDurationMs: number // banner thắng sẽ được hiển thị trên Trang chủ bao lâu (sau khi thanh toán)
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

// ── Yêu cầu kích thước/định dạng ảnh banner cho từng vị trí ──────────────────
// (đo theo đúng khung hiển thị thật của từng vị trí trên Trang chủ — Home.tsx)
export interface ImageSpec {
  ratioLabel: string   // tỉ lệ khung hình gợi ý, hiển thị cho shop
  ratio: number        // width / height — dùng để validate ảnh upload
  tolerance: number     // sai số tỉ lệ cho phép (vd 0.12 = ±12%)
  recommendedW: number // kích thước khuyến nghị (px)
  recommendedH: number
  maxKB: number         // dung lượng tối đa (KB)
}

export const BANNER_IMAGE_SPECS: Record<BannerPositionKey, ImageSpec> = {
  home_slider: { ratioLabel: '8:3 (ngang dài)', ratio: 1280 / 480, tolerance: 0.1, recommendedW: 1280, recommendedH: 480, maxKB: 2048 },
  mall_ads_main: { ratioLabel: '9:4 (ngang)', ratio: 900 / 400, tolerance: 0.1, recommendedW: 900, recommendedH: 400, maxKB: 2048 },
  mall_ads_fixed: { ratioLabel: '1:1 (vuông)', ratio: 1, tolerance: 0.1, recommendedW: 400, recommendedH: 400, maxKB: 2048 },
}

// ── Bài đăng banner sau khi thắng & thanh toán đấu giá — chờ Admin duyệt ────
export interface BannerSubmission {
  id: string
  historyId: string // id của phiên đấu giá đã thắng & thanh toán (history entry)
  position: BannerPositionKey
  shopName: string
  title: string
  link?: string
  image: string // banner shop tự upload (base64) để admin duyệt
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
  return {
    id: position + '-' + now,
    position,
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + settings.biddingDurationMs).toISOString(),
    bids: [],
    status: 'active',
  }
}

function getStore(): StoreData {
  const data = readJSON<StoreData>(KEY, {
    sessions: {} as Record<BannerPositionKey, BannerAuctionSession>,
    history: [],
    settings: {} as Record<BannerPositionKey, AuctionAdminSettings>,
    submissions: [],
  })
  // dữ liệu cũ lưu trước khi có tính năng admin-settings/submissions sẽ thiếu các field này — bù lại để tránh lỗi undefined
  if (!data.sessions) data.sessions = {} as Record<BannerPositionKey, BannerAuctionSession>
  if (!data.history) data.history = []
  if (!data.settings) data.settings = {} as Record<BannerPositionKey, AuctionAdminSettings>
  if (!data.submissions) data.submissions = []
  let changed = false
  for (const def of BANNER_POSITIONS) {
    if (!data.settings[def.key]) {
      data.settings[def.key] = defaultSettings(def.basePrice)
      changed = true
    }
  }
  // đảm bảo mọi vị trí đều có 1 phiên (trừ khi admin đang khoá và chưa từng mở)
  for (const def of BANNER_POSITIONS) {
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

export function getAdminSettings(): Record<BannerPositionKey, AuctionAdminSettings> {
  return getStore().settings
}

// admin cập nhật giá khởi điểm / thời gian đấu giá / thời gian hiển thị cho 1 vị trí (áp dụng từ phiên kế tiếp)
export function updateAdminSettings(position: BannerPositionKey, patch: Partial<Omit<AuctionAdminSettings, 'locked'>>): void {
  const data = getStore()
  data.settings[position] = { ...data.settings[position], ...patch }
  saveStore(data)
}

// admin khoá vị trí: kết thúc ngay phiên đang mở (nếu có) và không tự mở phiên mới cho tới khi admin mở lại
export function lockPosition(position: BannerPositionKey): void {
  const data = getStore()
  const session = data.sessions[position]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: BannerAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[position].displayDurationMs,
    }
    data.history.unshift(ended)
    data.history = data.history.slice(0, 30)
  }
  data.settings[position] = { ...data.settings[position], locked: true }
  delete (data.sessions as any)[position]
  saveStore(data)
}

// admin mở phiên đấu giá mới cho vị trí (mở khoá nếu đang khoá, kết thúc phiên cũ nếu còn đang chạy)
export function openAuction(position: BannerPositionKey): BannerAuctionSession {
  const data = getStore()
  const session = data.sessions[position]
  if (session && session.status === 'active') {
    const winner = session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    const ended: BannerAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: data.settings[position].displayDurationMs,
    }
    data.history.unshift(ended)
    data.history = data.history.slice(0, 30)
  }
  data.settings[position] = { ...data.settings[position], locked: false }
  const fresh = newSession(position, data.settings[position])
  data.sessions[position] = fresh
  saveStore(data)
  return fresh
}

export function isLocked(position: BannerPositionKey): boolean {
  return !!getStore().settings[position]?.locked
}

// kiểm tra phiên đã hết giờ chưa, nếu hết thì chốt người thắng + mở phiên mới (trừ khi admin đang khoá vị trí)
function rollIfExpired(data: StoreData, position: BannerPositionKey): BannerAuctionSession | undefined {
  const session = data.sessions[position]
  if (session && new Date(session.endsAt).getTime() <= Date.now() && session.status === 'active') {
    const winner = session.bids.length
      ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a))
      : undefined
    const settings = data.settings[position]
    const ended: BannerAuctionSession = {
      ...session, status: 'ended', winner,
      confirmation: winner ? 'pending' : undefined,
      paymentDeadline: winner ? new Date(Date.now() + PAYMENT_WINDOW_MS).toISOString() : undefined,
      displayDurationMs: settings.displayDurationMs,
    }
    data.history.unshift(ended)
    data.history = data.history.slice(0, 30)
    if (settings.locked) {
      delete (data.sessions as any)[position]
    } else {
      data.sessions[position] = newSession(position, settings)
    }
  }
  return data.sessions[position]
}

export function getActiveSession(position: BannerPositionKey): BannerAuctionSession | undefined {
  const data = getStore()
  const session = rollIfExpired(data, position)
  saveStore(data)
  return session
}

export function getAllActiveSessions(): Partial<Record<BannerPositionKey, BannerAuctionSession>> {
  const data = getStore()
  for (const def of BANNER_POSITIONS) rollIfExpired(data, def.key)
  saveStore(data)
  return data.sessions
}

export function getHistory(position?: BannerPositionKey): BannerAuctionSession[] {
  const data = getStore()
  return position ? data.history.filter(h => h.position === position) : data.history
}

export function getHighestBid(position: BannerPositionKey): BannerBid | undefined {
  const session = getActiveSession(position)
  if (!session || !session.bids.length) return undefined
  return session.bids.reduce((a, b) => (b.amount > a.amount ? b : a))
}

export function getMinNextBid(position: BannerPositionKey): number {
  const data = getStore()
  const basePrice = data.settings[position]?.basePrice ?? BANNER_POSITIONS.find(d => d.key === position)!.basePrice
  const highest = getHighestBid(position)
  return (highest ? highest.amount : basePrice - MIN_STEP) + MIN_STEP
}

export interface PlaceBidResult {
  ok: boolean
  error?: string
  session?: BannerAuctionSession
}

// thời điểm (ms) shop này được phép đặt giá lượt tiếp theo trong phiên hiện tại; 0 nếu đặt được ngay
export function getShopCooldownRemaining(position: BannerPositionKey, shopName: string): number {
  const data = getStore()
  const session = rollIfExpired(data, position)
  if (!session) return 0
  const lastByShop = session.bids.find(b => b.shopName === shopName) // bids mới nhất nằm ở đầu (unshift)
  if (!lastByShop) return 0
  const elapsed = Date.now() - new Date(lastByShop.time).getTime()
  return Math.max(0, TURN_COOLDOWN_MS - elapsed)
}

export function placeBid(position: BannerPositionKey, shopName: string, amount: number, bannerImage?: string): PlaceBidResult {
  const data = getStore()
  const session = rollIfExpired(data, position)
  if (!session) {
    return { ok: false, error: 'Vị trí này đang bị Admin tạm khoá, chưa thể đặt giá.' }
  }
  const basePrice = data.settings[position]?.basePrice ?? BANNER_POSITIONS.find(d => d.key === position)!.basePrice
  const minNext = (session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)).amount : basePrice - MIN_STEP) + MIN_STEP

  if (new Date(session.endsAt).getTime() <= Date.now()) {
    return { ok: false, error: 'Phiên đấu giá đã kết thúc, vui lòng đặt giá ở phiên mới.' }
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

  const bid: BannerBid = {
    id: 'bid-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    shopName,
    amount,
    bannerImage,
    time: new Date().toISOString(),
  }
  session.bids.unshift(bid)
  data.sessions[position] = session
  saveStore(data)
  return { ok: true, session }
}

// quét toàn bộ lịch sử: phiên nào đang "chờ xác nhận" hoặc "đã xác nhận nhưng chưa thanh toán"
// mà quá hạn thanh toán thì tự động huỷ kết quả (expired) — vị trí đã được mở phiên đấu giá mới ngay khi phiên cũ kết thúc
export function sweepExpiredWins(): BannerAuctionSession[] {
  const data = getStore()
  const now = Date.now()
  const justExpired: BannerAuctionSession[] = []
  data.history = data.history.map(h => {
    if ((h.confirmation === 'pending' || h.confirmation === 'confirmed') && h.paymentDeadline && new Date(h.paymentDeadline).getTime() <= now) {
      const updated: BannerAuctionSession = { ...h, confirmation: 'expired' }
      justExpired.push(updated)
      return updated
    }
    return h
  })
  if (justExpired.length) saveStore(data)
  return justExpired
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

// shop đăng banner thật (tiêu đề, link, ảnh) sau khi đã thanh toán xong — tạo bài chờ Admin duyệt
// cho phép đăng lại (resubmit) nếu bài trước đó bị admin từ chối
export function submitBanner(historyId: string, payload: { title: string; link?: string; image: string }): BannerSubmission | null {
  const data = getStore()
  const h = data.history.find(x => x.id === historyId)
  if (!h || h.confirmation !== 'paid' || !h.winner) return null
  const existingIdx = data.submissions.findIndex(s => s.historyId === historyId)
  if (existingIdx !== -1 && data.submissions[existingIdx].status !== 'rejected') return null // đã đăng & đang chờ/đã duyệt rồi
  const submission: BannerSubmission = {
    id: existingIdx !== -1 ? data.submissions[existingIdx].id : 'sub-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6),
    historyId, position: h.position, shopName: h.winner.shopName,
    title: payload.title, link: payload.link, image: payload.image,
    status: 'pending', createdAt: new Date().toISOString(),
  }
  if (existingIdx !== -1) data.submissions[existingIdx] = submission
  else data.submissions.unshift(submission)
  saveStore(data)
  return submission
}

export function getSubmissionByHistoryId(historyId: string): BannerSubmission | undefined {
  return getStore().submissions.find(s => s.historyId === historyId)
}

export function getAllSubmissions(): BannerSubmission[] {
  return getStore().submissions
}

export function approveSubmission(id: string): boolean {
  const data = getStore()
  const idx = data.submissions.findIndex(s => s.id === id)
  if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'approved', rejectReason: undefined }
  saveStore(data)
  return true
}

export function rejectSubmission(id: string, reason?: string): boolean {
  const data = getStore()
  const idx = data.submissions.findIndex(s => s.id === id)
  if (idx === -1) return false
  data.submissions[idx] = { ...data.submissions[idx], status: 'rejected', rejectReason: reason }
  saveStore(data)
  return true
}

// các phiên mà shop này đã thắng nhưng chưa xác nhận điều khoản (đã tự huỷ những phiên quá hạn)
export function getPendingWinsForShop(shopName: string): BannerAuctionSession[] {
  sweepExpiredWins()
  const data = getStore()
  return data.history.filter(h => h.winner?.shopName === shopName && h.confirmation === 'pending')
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

export function msUntilEnd(session: BannerAuctionSession): number {
  return Math.max(0, new Date(session.endsAt).getTime() - Date.now())
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
