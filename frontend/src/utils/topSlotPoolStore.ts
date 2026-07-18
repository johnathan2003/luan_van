// Đấu giá Vị trí Top — Pool 100 slot vị trí trang chủ
// 1 phiên duy nhất, shop đặt giá/slot + chọn số slot (1 → maxSlotsPerShop)
// Kết thúc: xếp theo giá/slot cao → thấp, phân slot tuần tự

import { addNotificationFor } from './notificationStore'

function readJSON<T>(key: string, fb: T): T {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fb } catch { return fb }
}
function writeJSON(key: string, v: unknown) {
  try { localStorage.setItem(key, JSON.stringify(v)) } catch {}
}

// ── Types ────────────────────────────────────────────────────────────────────

export interface TopPoolBid {
  id: string
  shopName: string
  amountPerSlot: number
  slotsRequested: number
  time: string
}

export interface TopSlotAllocation {
  rank: number
  shopName: string
  amountPerSlot: number
  slotsRequested: number
  slotsAssigned: number
  slotNumbers: number[]
}

export interface TopPoolSession {
  id: string
  startedAt: string
  endsAt: string
  status: 'active' | 'ended'
  scheduledStartAt?: string
  description?: string
  totalSlots: number
  maxSlotsPerShop: number
  bids: TopPoolBid[]
  allocation?: TopSlotAllocation[]
}

export interface TopPoolSettings {
  totalSlots: number
  maxSlotsPerShop: number
  basePrice: number
  biddingDurationMs: number
  displayDurationMs: number
  locked: boolean
}

interface StoreData {
  session: TopPoolSession | null
  history: TopPoolSession[]
  settings: TopPoolSettings
}

const KEY = 'buyzo_top_pool_v1'
const WIN_NOTIFIED_KEY = 'buyzo_top_pool_win_v1'

const DEFAULT_SETTINGS: TopPoolSettings = {
  totalSlots: 100,
  maxSlotsPerShop: 5,
  basePrice: 450_000,
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

// ── Core logic ────────────────────────────────────────────────────────────────

export function computeTopAllocation(bids: TopPoolBid[], totalSlots: number): TopSlotAllocation[] {
  const sorted = [...bids].sort((a, b) => b.amountPerSlot - a.amountPerSlot)
  const result: TopSlotAllocation[] = []
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

export function getTopSlotsFilled(bids: TopPoolBid[]): number {
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
  const allocation = computeTopAllocation(s.bids, s.totalSlots)
  const ended: TopPoolSession = { ...s, status: 'ended', allocation }
  d.history.unshift(ended); d.history = d.history.slice(0, 30)
  d.session = null
  for (const a of allocation) {
    if (!hasWinNotified(s.id + '-' + a.shopName)) {
      markWinNotified(s.id + '-' + a.shopName)
      addNotificationFor('', 'shop', 0, {
        title: '🏆 Thắng đấu giá Vị trí Top!',
        message: `Shop "${a.shopName}" được ${a.slotsAssigned} vị trí Top trang chủ (${a.slotNumbers.map(n => '#' + n).join(', ')}).`,
        type: 'auction_win',
        action_url: '/shop/auction',
      })
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────────

export function getTopActiveSession(): TopPoolSession | null {
  const d = getStore(); rollIfExpired(d); saveStore(d); return d.session
}

export function getTopHistory(): TopPoolSession[] {
  return getStore().history
}

export function getTopSettings(): TopPoolSettings {
  return getStore().settings
}

export function updateTopSettings(patch: Partial<Omit<TopPoolSettings, 'locked'>>): void {
  const d = getStore(); d.settings = { ...d.settings, ...patch }; saveStore(d)
}

export function isTopLive(session: TopPoolSession): boolean {
  if (!session.scheduledStartAt) return true
  return Date.now() >= new Date(session.scheduledStartAt).getTime()
}
export function msUntilTopStart(session: TopPoolSession): number {
  if (!session.scheduledStartAt) return 0
  return Math.max(0, new Date(session.scheduledStartAt).getTime() - Date.now())
}
export function msUntilTopEnd(session: TopPoolSession): number {
  return Math.max(0, new Date(session.endsAt).getTime() - Date.now())
}

export function openTopAuction(opts?: { startDelayMinutes?: number; description?: string }): TopPoolSession {
  const d = getStore(); rollIfExpired(d)
  const now = Date.now()
  const delay = (opts?.startDelayMinutes ?? 0) * 60_000
  const session: TopPoolSession = {
    id: 'top-pool-' + now,
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
  const when = delayMin > 0 ? `sau ${delayMin} phút` : 'ngay bây giờ'
  addNotificationFor('', 'shop', 0, {
    title: '🏆 Phiên đấu giá Vị trí Top mới!',
    message: `${d.settings.totalSlots} slot Vị trí Top trang chủ mở đấu giá ${when}. Mỗi shop tối đa ${d.settings.maxSlotsPerShop} slot.${opts?.description ? '\n📋 ' + opts.description : ''}\nVào Đấu giá QC để tham gia!`,
    type: 'auction_open',
    action_url: '/shop/auction',
  })
  return session
}

export function lockTopAuction(): void {
  const d = getStore(); rollIfExpired(d)
  if (d.session) {
    const allocation = computeTopAllocation(d.session.bids, d.session.totalSlots)
    d.history.unshift({ ...d.session, status: 'ended', allocation })
    d.history = d.history.slice(0, 30)
    d.session = null
  }
  d.settings.locked = true
  saveStore(d)
}

export interface PlaceTopBidResult { ok: boolean; error?: string; session?: TopPoolSession }

export function placeTopBid(
  shopName: string,
  amountPerSlot: number,
  slotsRequested: number
): PlaceTopBidResult {
  const d = getStore(); rollIfExpired(d)
  if (!d.session || d.session.status !== 'active') return { ok: false, error: 'Chưa có phiên đấu giá nào đang mở.' }
  if (!isTopLive(d.session)) return { ok: false, error: 'Phiên chưa bắt đầu, vui lòng chờ.' }
  if (new Date(d.session.endsAt).getTime() <= Date.now()) return { ok: false, error: 'Phiên đấu giá đã kết thúc.' }
  if (slotsRequested < 1 || slotsRequested > d.session.maxSlotsPerShop) {
    return { ok: false, error: `Số slot phải từ 1 đến ${d.session.maxSlotsPerShop}.` }
  }
  if (amountPerSlot < d.settings.basePrice) {
    return { ok: false, error: `Giá/slot tối thiểu ${d.settings.basePrice.toLocaleString('vi-VN')}đ.` }
  }
  const existing = d.session.bids.findIndex(b => b.shopName === shopName)
  if (existing !== -1) {
    if (amountPerSlot <= d.session.bids[existing].amountPerSlot) {
      return { ok: false, error: `Giá mới phải cao hơn giá cũ (${d.session.bids[existing].amountPerSlot.toLocaleString('vi-VN')}đ/slot).` }
    }
    d.session.bids.splice(existing, 1)
  }
  const bid: TopPoolBid = {
    id: 'tpb-' + Date.now(),
    shopName, amountPerSlot, slotsRequested,
    time: new Date().toISOString(),
  }
  d.session.bids.push(bid)
  saveStore(d)
  return { ok: true, session: d.session }
}
