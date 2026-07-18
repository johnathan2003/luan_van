// Đấu giá Flash Sale — Pool 100 slot
// 1 phiên duy nhất, shop đặt giá/slot + chọn số slot (1 → maxSlotsPerShop)
// Kết thúc: xếp theo giá/slot cao → thấp, phân slot tuần tự cho đến hết 100

import { addNotificationFor } from './notificationStore'

function readJSON<T>(key: string, fb: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb } catch { return fb }
}
function writeJSON(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface PoolBid {
  id: string
  shopName: string
  amountPerSlot: number   // giá đặt mỗi slot
  slotsRequested: number  // 1 → maxSlotsPerShop
  time: string
}

export interface SlotAllocation {
  rank: number
  shopName: string
  amountPerSlot: number
  slotsRequested: number
  slotsAssigned: number   // có thể nhỏ hơn requested nếu vừa đủ slot
  slotNumbers: number[]   // e.g. [1,2,3]
}

export interface PoolSession {
  id: string
  startedAt: string
  endsAt: string
  status: 'active' | 'ended'
  scheduledStartAt?: string
  description?: string
  totalSlots: number
  maxSlotsPerShop: number
  bids: PoolBid[]
  allocation?: SlotAllocation[]  // filled on end
}

export interface PoolSettings {
  totalSlots: number        // default 100
  maxSlotsPerShop: number   // default 5
  basePrice: number         // giá tối thiểu/slot
  biddingDurationMs: number
  displayDurationMs: number
  locked: boolean
}

interface StoreData {
  session: PoolSession | null
  history: PoolSession[]
  settings: PoolSettings
}

const KEY = 'buyzo_flash_pool_v1'
const WIN_NOTIFIED_KEY = 'buyzo_flash_pool_win_v1'

const DEFAULT_SETTINGS: PoolSettings = {
  totalSlots: 100,
  maxSlotsPerShop: 5,
  basePrice: 300_000,
  biddingDurationMs: 10 * 60 * 1000,
  displayDurationMs: 48 * 60 * 60 * 1000,
  locked: false,
}

function getStore(): StoreData {
  const d = readJSON<StoreData>(KEY, { session: null, history: [], settings: DEFAULT_SETTINGS })
  if (!d.settings) d.settings = { ...DEFAULT_SETTINGS }
  if (!d.history) d.history = []
  return d
}
function saveStore(d: StoreData) { writeJSON(KEY, d) }

// ── Core logic ───────────────────────────────────────────────────────────────

export function computeAllocation(bids: PoolBid[], totalSlots: number): SlotAllocation[] {
  const sorted = [...bids].sort((a, b) => b.amountPerSlot - a.amountPerSlot)
  const result: SlotAllocation[] = []
  let used = 0
  let rank = 1
  for (const bid of sorted) {
    if (used >= totalSlots) break
    const assign = Math.min(bid.slotsRequested, totalSlots - used)
    result.push({
      rank,
      shopName: bid.shopName,
      amountPerSlot: bid.amountPerSlot,
      slotsRequested: bid.slotsRequested,
      slotsAssigned: assign,
      slotNumbers: Array.from({ length: assign }, (_, i) => used + i + 1),
    })
    used += assign
    rank++
  }
  return result
}

export function getSlotsFilled(bids: PoolBid[]): number {
  return bids.reduce((s, b) => s + b.slotsRequested, 0)
}

function hasWinNotified(id: string): boolean {
  try { return (JSON.parse(localStorage.getItem(WIN_NOTIFIED_KEY) || '[]') as string[]).includes(id) } catch { return false }
}
function markWinNotified(id: string) {
  try {
    const arr = JSON.parse(localStorage.getItem(WIN_NOTIFIED_KEY) || '[]') as string[]
    if (!arr.includes(id)) { arr.push(id); localStorage.setItem(WIN_NOTIFIED_KEY, JSON.stringify(arr.slice(-100))) }
  } catch {}
}

function rollIfExpired(d: StoreData): void {
  const s = d.session
  if (!s || s.status !== 'active') return
  if (new Date(s.endsAt).getTime() > Date.now()) return
  const allocation = computeAllocation(s.bids, s.totalSlots)
  const ended: PoolSession = { ...s, status: 'ended', allocation }
  d.history.unshift(ended); d.history = d.history.slice(0, 30)
  d.session = null
  // Notify winners
  for (const a of allocation) {
    if (!hasWinNotified(s.id + '-' + a.shopName)) {
      markWinNotified(s.id + '-' + a.shopName)
      addNotificationFor('', 'shop', 0, {
        title: '⚡ Thắng đấu giá Flash Sale!',
        message: `Shop "${a.shopName}" được ${a.slotsAssigned} slot Flash Sale (${a.slotNumbers.map(n => '#' + n).join(', ')}).`,
        type: 'auction_win',
        action_url: '/shop/auction',
      })
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function getActiveSession(): PoolSession | null {
  const d = getStore(); rollIfExpired(d); saveStore(d); return d.session
}

export function getHistory(): PoolSession[] {
  const d = getStore(); return d.history
}

export function getSettings(): PoolSettings {
  return getStore().settings
}

export function updateSettings(patch: Partial<Omit<PoolSettings, 'locked'>>): void {
  const d = getStore(); d.settings = { ...d.settings, ...patch }; saveStore(d)
}

export function isAuctionLive(session: PoolSession): boolean {
  if (!session.scheduledStartAt) return true
  return Date.now() >= new Date(session.scheduledStartAt).getTime()
}
export function msUntilStart(session: PoolSession): number {
  if (!session.scheduledStartAt) return 0
  return Math.max(0, new Date(session.scheduledStartAt).getTime() - Date.now())
}
export function msUntilEnd(session: PoolSession): number {
  return Math.max(0, new Date(session.endsAt).getTime() - Date.now())
}

export function openAuction(opts?: { startDelayMinutes?: number; description?: string }): PoolSession {
  const d = getStore(); rollIfExpired(d)
  const now = Date.now()
  const delay = (opts?.startDelayMinutes ?? 0) * 60_000
  const session: PoolSession = {
    id: 'flash-pool-' + now,
    startedAt: new Date(now).toISOString(),
    endsAt: new Date(now + delay + d.settings.biddingDurationMs).toISOString(),
    scheduledStartAt: delay > 0 ? new Date(now + delay).toISOString() : undefined,
    description: opts?.description,
    status: 'active',
    totalSlots: d.settings.totalSlots,
    maxSlotsPerShop: d.settings.maxSlotsPerShop,
    bids: [],
  }
  d.session = session
  d.settings.locked = false
  saveStore(d)

  const delayMin = opts?.startDelayMinutes ?? 0
  const when = delayMin > 0
    ? `sau ${delayMin} phút`
    : 'ngay bây giờ'
  addNotificationFor('', 'shop', 0, {
    title: '⚡ Phiên đấu giá Flash Sale mới!',
    message: `${d.settings.totalSlots} slot Flash Sale mở đấu giá ${when}. Mỗi shop tối đa ${d.settings.maxSlotsPerShop} slot.${opts?.description ? '\n📋 ' + opts.description : ''}\nVào Đấu giá QC để tham gia!`,
    type: 'auction_open',
    action_url: '/shop/auction',
  })
  return session
}

export function lockAuction(): void {
  const d = getStore(); rollIfExpired(d)
  if (d.session) {
    const allocation = computeAllocation(d.session.bids, d.session.totalSlots)
    d.history.unshift({ ...d.session, status: 'ended', allocation })
    d.history = d.history.slice(0, 30)
    d.session = null
  }
  d.settings.locked = true
  saveStore(d)
}

export interface PlaceBidResult { ok: boolean; error?: string; session?: PoolSession }

export function placeBid(
  shopName: string,
  amountPerSlot: number,
  slotsRequested: number
): PlaceBidResult {
  const d = getStore(); rollIfExpired(d)
  if (!d.session || d.session.status !== 'active') return { ok: false, error: 'Chưa có phiên đấu giá nào đang mở.' }
  if (!isAuctionLive(d.session)) return { ok: false, error: 'Phiên chưa bắt đầu, vui lòng chờ.' }
  if (new Date(d.session.endsAt).getTime() <= Date.now()) return { ok: false, error: 'Phiên đấu giá đã kết thúc.' }
  if (slotsRequested < 1 || slotsRequested > d.session.maxSlotsPerShop) {
    return { ok: false, error: `Số slot phải từ 1 đến ${d.session.maxSlotsPerShop}.` }
  }
  if (amountPerSlot < d.settings.basePrice) {
    return { ok: false, error: `Giá/slot tối thiểu ${d.settings.basePrice.toLocaleString('vi-VN')}đ.` }
  }
  // If shop already bid, replace with new (must be higher per-slot)
  const existing = d.session.bids.findIndex(b => b.shopName === shopName)
  if (existing !== -1) {
    if (amountPerSlot <= d.session.bids[existing].amountPerSlot) {
      return { ok: false, error: `Giá mới phải cao hơn giá cũ (${d.session.bids[existing].amountPerSlot.toLocaleString('vi-VN')}đ/slot).` }
    }
    d.session.bids.splice(existing, 1)
  }
  const bid: PoolBid = {
    id: 'pb-' + Date.now(),
    shopName, amountPerSlot, slotsRequested,
    time: new Date().toISOString(),
  }
  d.session.bids.push(bid)
  saveStore(d)
  return { ok: true, session: d.session }
}
