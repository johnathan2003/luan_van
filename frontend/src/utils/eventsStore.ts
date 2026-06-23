// Hệ thống "Sự kiện": tích xu, điểm danh, vòng quay, nhiệm vụ, dò số
// Toàn bộ lưu localStorage — demo/test, chưa có backend thực

// ── Helpers chung ──────────────────────────────────────────────────────────
function todayStr(): string {
  return new Date().toISOString().slice(0, 10) // YYYY-MM-DD
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

// đếm ngược thời gian tới 0h ngày mai (hiển thị "còn bao lâu")
export function msUntilMidnight(): number {
  const now = new Date()
  const tomorrow = new Date(now)
  tomorrow.setHours(24, 0, 0, 0)
  return tomorrow.getTime() - now.getTime()
}

// ── Xu (điểm/coin) ────────────────────────────────────────────────────────
const KEY_XU = 'buyzo_xu_v1'

export function getXu(): number {
  return readJSON<number>(KEY_XU, 0)
}

export function addXu(amount: number): number {
  const next = getXu() + amount
  writeJSON(KEY_XU, next)
  return next
}

// tru xu khi dung de thanh toan (1 xu = 1 dong) — khong cho am
export function spendXu(amount: number): number {
  const next = Math.max(0, getXu() - amount)
  writeJSON(KEY_XU, next)
  return next
}

// ── Voucher nhận từ sự kiện ──────────────────────────────────────────────
export interface EventVoucher {
  code: string
  label: string
  earnedAt: string
  used: boolean
}

const KEY_VOUCHERS = 'buyzo_event_vouchers_v1'

export function getEventVouchers(): EventVoucher[] {
  return readJSON<EventVoucher[]>(KEY_VOUCHERS, [])
}

export function addEventVoucher(label: string): EventVoucher {
  const v: EventVoucher = {
    code: 'EVT' + Math.random().toString(36).slice(2, 8).toUpperCase(),
    label,
    earnedAt: new Date().toISOString(),
    used: false,
  }
  const all = getEventVouchers()
  all.unshift(v)
  writeJSON(KEY_VOUCHERS, all)
  return v
}

// ── Quà tặng hậu mãi (sau khi đặt hàng thành công) ──────────────────────────
// Mỗi shop trong đơn có thể: tự tặng voucher nhỏ cho lần mua sau, sàn tặng
// voucher của sàn, hoặc không có gì — hoàn toàn ngẫu nhiên, mang tính bất ngờ.
export interface PostPurchaseGift {
  shopName: string
  type: 'shop_voucher' | 'platform_voucher' | 'none'
  voucher?: EventVoucher
}

const SHOP_GIFT_LABELS = [
  'Giảm 10% cho lần mua tiếp theo',
  'Giảm 20.000đ cho lần mua tiếp theo',
  'Miễn phí vận chuyển lần mua sau',
]

const PLATFORM_GIFT_LABELS = [
  'Voucher sàn giảm 10.000đ',
  'Voucher sàn giảm 5%',
  'Voucher sàn Freeship toàn sàn',
]

// goi 1 lan duy nhat ngay sau khi don hang dat thanh cong
export function grantPostPurchaseGifts(shopNames: string[]): PostPurchaseGift[] {
  return shopNames.map(shopName => {
    const roll = Math.random()
    if (roll < 0.35) {
      const label = SHOP_GIFT_LABELS[Math.floor(Math.random() * SHOP_GIFT_LABELS.length)]
      const voucher = addEventVoucher(`${label} — ${shopName}`)
      return { shopName, type: 'shop_voucher' as const, voucher }
    }
    if (roll < 0.55) {
      const label = PLATFORM_GIFT_LABELS[Math.floor(Math.random() * PLATFORM_GIFT_LABELS.length)]
      const voucher = addEventVoucher(label)
      return { shopName, type: 'platform_voucher' as const, voucher }
    }
    return { shopName, type: 'none' as const }
  })
}

// ── Điểm danh hàng ngày ───────────────────────────────────────────────────
export interface CheckinState {
  lastDate: string | null
  streak: number
  history: string[] // các ngày đã điểm danh
}

const KEY_CHECKIN = 'buyzo_checkin_v1'

// thưởng theo chu kỳ 7 ngày, ngày 7 thưởng đậm
export const CHECKIN_REWARDS = [10, 10, 15, 15, 20, 20, 50]

function getCheckinState(): CheckinState {
  return readJSON<CheckinState>(KEY_CHECKIN, { lastDate: null, streak: 0, history: [] })
}

export function getCheckinInfo() {
  const state = getCheckinState()
  const today = todayStr()
  const checkedToday = state.lastDate === today
  const dayInCycle = checkedToday
    ? ((state.streak - 1) % 7)
    : (state.streak % 7)
  return { ...state, checkedToday, dayInCycle, nextReward: CHECKIN_REWARDS[dayInCycle] }
}

export function doCheckin(): { reward: number; streak: number } | null {
  const state = getCheckinState()
  const today = todayStr()
  if (state.lastDate === today) return null // đã điểm danh hôm nay

  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const yStr = yesterday.toISOString().slice(0, 10)

  const streak = state.lastDate === yStr ? state.streak + 1 : 1
  const dayInCycle = (streak - 1) % 7
  const reward = CHECKIN_REWARDS[dayInCycle]

  const next: CheckinState = {
    lastDate: today,
    streak,
    history: [...state.history, today].slice(-30),
  }
  writeJSON(KEY_CHECKIN, next)
  addXu(reward)
  return { reward, streak }
}

// ── Nhiệm vụ nhận xu ──────────────────────────────────────────────────────
export interface MissionDef {
  key: string
  label: string
  target: number
  reward: number
  icon: string
}

export const MISSION_DEFS: MissionDef[] = [
  { key: 'view_products', label: 'Lướt xem 5 sản phẩm bất kỳ', target: 5, reward: 20, icon: '🛍️' },
  { key: 'view_shop', label: 'Xem trang của 1 cửa hàng', target: 1, reward: 15, icon: '🏪' },
  { key: 'view_products_10', label: 'Lướt xem 10 sản phẩm bất kỳ', target: 10, reward: 30, icon: '🔥' },
]

interface MissionDayData {
  date: string
  progress: Record<string, number>
  claimed: Record<string, boolean>
}

const KEY_MISSIONS = 'buyzo_missions_v1'

function getMissionDay(): MissionDayData {
  const data = readJSON<MissionDayData>(KEY_MISSIONS, { date: todayStr(), progress: {}, claimed: {} })
  if (data.date !== todayStr()) {
    return { date: todayStr(), progress: {}, claimed: {} }
  }
  return data
}

function saveMissionDay(data: MissionDayData) {
  writeJSON(KEY_MISSIONS, data)
}

// gọi khi user thực sự xem sản phẩm / shop (tích lũy tiến độ thật)
export function trackMissionEvent(eventKey: 'view_product' | 'view_shop') {
  const data = getMissionDay()
  if (eventKey === 'view_product') {
    data.progress['view_products'] = (data.progress['view_products'] || 0) + 1
    data.progress['view_products_10'] = (data.progress['view_products_10'] || 0) + 1
  } else if (eventKey === 'view_shop') {
    data.progress['view_shop'] = (data.progress['view_shop'] || 0) + 1
  }
  saveMissionDay(data)
}

export function getMissionsToday() {
  const data = getMissionDay()
  return MISSION_DEFS.map(def => {
    const progress = Math.min(data.progress[def.key] || 0, def.target)
    const claimed = !!data.claimed[def.key]
    return { ...def, progress, claimed, done: progress >= def.target }
  })
}

export function claimMission(key: string): number | null {
  const data = getMissionDay()
  const def = MISSION_DEFS.find(m => m.key === key)
  if (!def) return null
  const progress = data.progress[key] || 0
  if (progress < def.target || data.claimed[key]) return null
  data.claimed[key] = true
  saveMissionDay(data)
  addXu(def.reward)
  return def.reward
}

// ── Vòng quay may mắn ─────────────────────────────────────────────────────
export interface SpinReward {
  type: 'xu' | 'voucher' | 'none'
  label: string
  amount?: number
}

export const SPIN_REWARDS: SpinReward[] = [
  { type: 'xu', label: '10 xu', amount: 10 },
  { type: 'xu', label: '20 xu', amount: 20 },
  { type: 'xu', label: '50 xu', amount: 50 },
  { type: 'voucher', label: 'Voucher Freeship' },
  { type: 'voucher', label: 'Voucher giảm 10K' },
  { type: 'xu', label: '5 xu', amount: 5 },
  { type: 'none', label: 'Chúc bạn may mắn lần sau' },
  { type: 'xu', label: '100 xu', amount: 100 },
]

interface SpinState { lastSpinDate: string | null }
const KEY_SPIN = 'buyzo_spin_v1'

export function canSpinToday(): boolean {
  const state = readJSON<SpinState>(KEY_SPIN, { lastSpinDate: null })
  return state.lastSpinDate !== todayStr()
}

export function doSpin(): { index: number; reward: SpinReward } | null {
  if (!canSpinToday()) return null
  const index = Math.floor(Math.random() * SPIN_REWARDS.length)
  const reward = SPIN_REWARDS[index]
  writeJSON(KEY_SPIN, { lastSpinDate: todayStr() })
  if (reward.type === 'xu' && reward.amount) addXu(reward.amount)
  if (reward.type === 'voucher') addEventVoucher(reward.label)
  return { index, reward }
}

// ── Dò số (lottery 6 chữ số) ─────────────────────────────────────────────
// Số "sàn công bố" sinh ngẫu nhiên xác định theo ngày (cùng 1 số trong suốt ngày đó)
function seededRandom(seed: string): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i)
    h |= 0
  }
  return Math.abs(h)
}

function genDigits(seed: string): string {
  const base = seededRandom(seed)
  let n = base
  let digits = ''
  for (let i = 0; i < 6; i++) {
    digits += (n % 10).toString()
    n = Math.floor(n / 7) + (n % 13) * 31 + i * 17
  }
  return digits
}

export function getOfficialNumberToday(): string {
  return genDigits('official-' + todayStr())
}

const KEY_TICKET = 'buyzo_lottery_ticket_v1'

export function getUserTicketToday(): string {
  const data = readJSON<{ date: string; ticket: string }>(KEY_TICKET, { date: '', ticket: '' })
  if (data.date === todayStr() && data.ticket) return data.ticket
  // sinh ticket ngau nhien, giu nguyen trong ngay tru khi nguoi dung tu doi
  const ticket = genDigits('user-' + todayStr() + '-' + Math.random())
  writeJSON(KEY_TICKET, { date: todayStr(), ticket })
  return ticket
}

// cho phep nguoi dung doi lai so ve ngau nhien (tuy y, bao nhieu lan cung duoc
// truoc khi ho bam "do so" — sau khi da do thi so se bi khoa lai cho ngay hom do)
export function rerollUserTicket(): string {
  const ticket = genDigits('user-' + todayStr() + '-' + Math.random() + '-' + Date.now())
  writeJSON(KEY_TICKET, { date: todayStr(), ticket })
  return ticket
}

export interface LotteryResult {
  ticket: string
  official: string
  matches: number
  rewardLabel: string
}

interface LotteryState { lastPlayDate: string | null; lastResult?: LotteryResult }
const KEY_LOTTERY = 'buyzo_lottery_v1'

export function canPlayLotteryToday(): boolean {
  const state = readJSON<LotteryState>(KEY_LOTTERY, { lastPlayDate: null })
  return state.lastPlayDate !== todayStr()
}

export function getLastLotteryResult(): LotteryResult | undefined {
  const state = readJSON<LotteryState>(KEY_LOTTERY, { lastPlayDate: null })
  return state.lastPlayDate === todayStr() ? state.lastResult : undefined
}

function rewardForMatches(matches: number): { xu: number; voucher?: string } {
  if (matches >= 6) return { xu: 500, voucher: 'Voucher JACKPOT - Giảm 50%' }
  if (matches === 5) return { xu: 200, voucher: 'Voucher giảm 30K' }
  if (matches === 4) return { xu: 100 }
  if (matches === 3) return { xu: 50 }
  return { xu: 0 }
}

export function playLottery(): LotteryResult | null {
  if (!canPlayLotteryToday()) return null
  const ticket = getUserTicketToday()
  const official = getOfficialNumberToday()
  let matches = 0
  for (let i = 0; i < 6; i++) {
    if (ticket[i] === official[i]) matches++
  }
  const r = rewardForMatches(matches)
  if (r.xu > 0) addXu(r.xu)
  if (r.voucher) addEventVoucher(r.voucher)

  const rewardLabel = r.xu > 0
    ? `Trúng ${matches}/6 số — nhận ${r.xu} xu${r.voucher ? ' + ' + r.voucher : ''}`
    : `Trúng ${matches}/6 số — chưa đủ điều kiện nhận thưởng`

  const result: LotteryResult = { ticket, official, matches, rewardLabel }
  writeJSON(KEY_LOTTERY, { lastPlayDate: todayStr(), lastResult: result })
  return result
}
