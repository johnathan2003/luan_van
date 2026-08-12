import React, { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { toast } from 'react-toastify'
import type { RootState } from '../../store/store'
import {
  BANNER_POSITIONS, BannerAuctionSession, BannerBid, BannerPositionKey, BannerSubmission,
  BANNER_IMAGE_SPECS, ImageSpec,
  formatCountdown, getAllActiveSessions, getHistory, getMinNextBid,
  getShopCooldownRemaining, msUntilEnd,
  isAuctionLive, msUntilStart,
  placeBid, placeBuyNow, sweepExpiredWins, getPendingWinsForShop, payDeposit, payWin,
  cancelDeposit as cancelBannerDeposit,
  submitBanner, getSubmissionByHistoryId, getAllSubmissions as getAllBannerSubmissions, resubmitSubmission,
  getAdminSettings as getBannerAdminSettings,
  AuctionAdminSettings as BannerAdminSettings,
} from '../../utils/bannerAuctionStore'
import {
  BuyNowTransaction, BuyNowStatus, MAX_BUYNOW_REVISIONS,
  createBuyNowTransaction, getBuyNowTransactions, submitBuyNowBanner,
} from '../../utils/buyNowStore'
import {
  FLASH_SLOTS, FlashAuctionSession, FlashSlotKey, FlashSubmission,
  FLASH_IMAGE_SPEC,
  getAllActiveSessions as getAllFlashSessions, getHistory as getFlashHistory,
  getMinNextBid as getFlashMinNextBid, getShopCooldownRemaining as getFlashCooldown,
  msUntilEnd as flashMsUntilEnd,
  isAuctionLive as isFlashLive, msUntilStart as flashMsUntilStart,
  placeBid as placeFlashBid, sweepExpiredWins as sweepFlash,
  getPendingWinsForShop as getFlashPendingWins,
  payDeposit as payFlashDeposit, payWin as payFlashWin,
  cancelDeposit as cancelFlashDeposit,
  submitFlashProduct, getFlashSubmissionByHistoryId, getAllFlashSubmissions,
} from '../../utils/flashSaleAuctionStore'
import {
  getBannerDraft, saveBannerDraft, saveBannerDraftSafe,
  getFlashDraft, saveFlashDraft,
  FLASH_PRODUCT_MAX, FlashProductItem,
  getFlashProductList, saveFlashProduct, clearFlashProduct,
} from '../../utils/bannerDraftStore'
import { shopService } from '../../services/shopService'
import { getImageUrl } from '../../utils/helpers'
import {
  PoolSession as FlashPoolSession, PoolSettings as FlashPoolSettings,
  computeAllocation as computeFlashAlloc,
  getActiveSession as getFlashPoolSession,
  getSettings as getFlashPoolSettings,
  placeBid as placeFlashPoolBid,
  isAuctionLive as isFlashPoolLive,
  msUntilEnd as flashPoolMsEnd,
  msUntilStart as flashPoolMsStart,
} from '../../utils/flashSalePoolStore'
import {
  TOP_SLOTS, TopSlotKey, TopAuctionSession,
  AuctionAdminSettings as TopAdminSettings,
  getAllActiveSessions as getAllTopSessions,
  getHistory as getTopHistory,
  getAdminSettings as getTopAdminSettings,
  getMinNextBid as getTopMinNextBid,
  placeBid as placeTopBid,
  isAuctionLive as isTopLive,
  msUntilEnd as msUntilTopEnd,
  msUntilStart as msUntilTopStart,
} from '../../utils/topSlotAuctionStore'

// ── Helpers validate ảnh ──────────────────────────────────────────────────────
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
  } catch { /* chỉ check dung lượng nếu không đọc được */ }
  return { ok: true, dataUrl }
}

// ── Màu sắc ──────────────────────────────────────────────────────────────────
const C = {
  primary: '#16A34A', primaryLight: 'rgba(22,163,74,0.1)',
  orange: '#EA580C', orangeLight: 'rgba(234,88,12,0.1)',
  blue: '#2563EB', blueLight: 'rgba(37,99,235,0.1)',
  purple: '#7C3AED', purpleLight: 'rgba(124,58,237,0.1)',
  gray: 'var(--text-secondary)', border: 'var(--border-subtle)',
  cardBg: 'var(--bg-card)',
}

function fmtMmSs(ms: number): string {
  if (ms <= 0) return '00:00'
  const m = Math.floor(ms / 60000); const s = Math.floor((ms % 60000) / 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

// ── Types ─────────────────────────────────────────────────────────────────────
type PendingWin =
  | { kind: 'banner'; session: BannerAuctionSession }
  | { kind: 'flash'; session: FlashAuctionSession }
  | { kind: 'banner-buynow'; txId: string; position: BannerPositionKey; label: string }

const SHOP_NAME = 'My Demo Shop' // mock — thực tế lấy từ auth store

const BannerAuctionPage: React.FC = () => {
  // ── State: banner ─────────────────────────────────────────────────────────
  const [bannerSessions, setBannerSessions] = useState<Partial<Record<BannerPositionKey, BannerAuctionSession>>>({})
  const [bannerHistory, setBannerHistory] = useState<BannerAuctionSession[]>([])
  const [selectedBannerPos, setSelectedBannerPos] = useState<BannerPositionKey>('home_slider')
  const [adminPreviews] = useState<Record<string, string>>(() => {
    const result: Record<string, string> = {}
    // Đọc riêng từng key (admin lưu admin_preview_<key>)
    ;[...BANNER_POSITIONS.map(p => p.key), ...TOP_SLOTS.map(s => s.key)].forEach(key => {
      try { const v = localStorage.getItem(`admin_preview_${key}`); if (v) result[key] = v } catch {}
    })
    // Backward compat: JSON cũ nếu có
    try {
      const old = JSON.parse(localStorage.getItem('admin_position_previews') || '{}')
      Object.keys(old).forEach(k => { if (!result[k]) result[k] = old[k] })
    } catch {}
    return result
  })
  const getPreview = (key: string, fallback?: string) => adminPreviews[key] || fallback || ''
  const [bidAmounts, setBidAmounts] = useState<Record<string, string>>({})
  const [countdown, setCountdown] = useState<Record<string, string>>({})

  // ── State: flash ──────────────────────────────────────────────────────────
  const [flashSessions, setFlashSessions] = useState<Partial<Record<FlashSlotKey, FlashAuctionSession>>>({})
  const [flashHistory, setFlashHistory] = useState<FlashAuctionSession[]>([])
  const [selectedFlashSlot, setSelectedFlashSlot] = useState<FlashSlotKey>('flash_slot_1')
  const [flashBidAmounts, setFlashBidAmounts] = useState<Record<string, string>>({})
  const [flashBidProducts, setFlashBidProducts] = useState<Record<string, string>>({})

  // ── State: pending wins ───────────────────────────────────────────────────
  const [pendingBannerWins, setPendingBannerWins] = useState<BannerAuctionSession[]>([])
  const [pendingFlashWins, setPendingFlashWins] = useState<FlashAuctionSession[]>([])

  // ── State: banner submissions (auction only) ─────────────────────────────
  const [bannerSubmissions, setBannerSubmissions] = useState<import('../../utils/bannerAuctionStore').BannerSubmission[]>(() => getAllBannerSubmissions())
  // ── State: buy-now transactions (hoàn toàn riêng biệt với đấu giá) ───────
  const [buyNowTxs, setBuyNowTxs] = useState<BuyNowTransaction[]>(() => getBuyNowTransactions(SHOP_NAME))

  // ── State: submit modal ───────────────────────────────────────────────────
  const [submitTarget, setSubmitTarget] = useState<PendingWin | null>(null)
  const [bannerForm, setBannerForm] = useState<{ title: string; link: string; image: string }>({ title: '', link: '', image: '' })
  const [bannerImgError, setBannerImgError] = useState('')
  const [flashForm, setFlashForm] = useState<{ productName: string; price: string; image: string }>({ productName: '', price: '', image: '' })
  const [flashImgError, setFlashImgError] = useState('')

  // ── State: Flash Sale pool ────────────────────────────────────────────────
  const [flashPoolSession, setFlashPoolSession] = useState<FlashPoolSession | null>(null)
  const [flashPoolSettings, setFlashPoolSettings] = useState<FlashPoolSettings>(() => getFlashPoolSettings())
  const [flashPoolBidAmount, setFlashPoolBidAmount] = useState('')
  const [flashPoolSlots, setFlashPoolSlots] = useState(1)

  // ── State: Vị trí Top (10 named slots) ───────────────────────────────────
  const [topSessions, setTopSessions] = useState<Partial<Record<TopSlotKey, TopAuctionSession>>>({})
  const [topHistory, setTopHistory] = useState<TopAuctionSession[]>([])
  const [topAdminSettings, setTopAdminSettings] = useState<Record<TopSlotKey, TopAdminSettings>>({} as any)
  const [selectedTopSlot, setSelectedTopSlot] = useState<TopSlotKey>('top_1')
  const [topBidAmounts, setTopBidAmounts] = useState<Record<string, string>>({})

  const [poolTick, setPoolTick] = useState(0)
  // Countdown độc lập cho "Thời gian chờ" bên phải mỗi banner card
  const waitCountdownRef = useRef<Record<string, { initMs: number; initAt: number }>>({})
  const getWaitMs = (sessionId: string, currentMsUntilStart: number): number => {
    if (!waitCountdownRef.current[sessionId]) {
      waitCountdownRef.current[sessionId] = { initMs: Math.floor(currentMsUntilStart / 2), initAt: Date.now() }
    }
    const { initMs, initAt } = waitCountdownRef.current[sessionId]
    return Math.max(0, initMs - (Date.now() - initAt))
  }

  // ── State: banner admin settings (buyNowPrice, slots, etc.) ──────────────
  const [bannerAdminSettings, setBannerAdminSettings] = useState<Record<BannerPositionKey, BannerAdminSettings>>({} as any)

  // ── Tiền đấu giá — đọc từ localStorage theo userId ───────────────────────
  const userId = useSelector((s: RootState) => s.auth.user?.user_id ?? 0)
  const navigate = useNavigate()
  const [walletReserved, setWalletReserved] = useState(0)
  useEffect(() => {
    if (!userId) return
    try {
      const d = JSON.parse(localStorage.getItem(`shop_wallet_v2_${userId}`) || 'null')
      setWalletReserved(d?.reserved ?? 0)
    } catch {}
  }, [userId])

  // ── Trừ Tiền đấu giá sau khi cọc / thanh toán đủ ────────────────────────
  const deductWallet = (amount: number, note: string) => {
    if (!amount || !userId) return
    try {
      // Cập nhật số dư
      const wKey = `shop_wallet_v2_${userId}`
      const d = JSON.parse(localStorage.getItem(wKey) || 'null') ?? { balance: 0, reserved: 0, available: 0 }
      const next = {
        ...d,
        balance:  Math.max(0, (d.balance  ?? 0) - amount),
        reserved: Math.max(0, (d.reserved ?? 0) - amount),
        // available không đổi — tiền đó đã bị khóa khi chuyển vào reserved
      }
      localStorage.setItem(wKey, JSON.stringify(next))
      setWalletReserved(next.reserved)

      // Ghi lịch sử giao dịch
      const tKey = `shop_wallet_txns_v2_${userId}`
      const txns = JSON.parse(localStorage.getItem(tKey) || '[]')
      const txn = { txn_id: Date.now(), amount, txn_type: 'charge', ref_type: 'auction', ref_id: null, note, created_at: new Date().toISOString() }
      localStorage.setItem(tKey, JSON.stringify([txn, ...txns]))
    } catch {}
  }

  // ── Toast khi bid chạm endPrice ──────────────────────────────────────────
  const toastBidResult = (hit: number | undefined, defaultMsg: string) => {
    if (hit !== undefined) {
      if (hit >= 3) toast.warning('🏁 Giá đạt ngưỡng kết thúc lần 3 — phiên đấu giá kết thúc!')
      else toast.info(`⏱ Giá đạt ngưỡng! Đồng hồ reset về 10 giây (${hit}/3 lần)`)
    } else {
      toast.success(defaultMsg)
    }
  }

  // ── Modal cảnh báo vượt tiền đấu giá ─────────────────────────────────────
  const [bidWarning, setBidWarning] = useState<{
    type: 'blocked' | 'over70'
    pendingBid?: () => void
  } | null>(null)
  const over70WarnedRef = useRef(false) // chỉ hiện 1 lần/session

  const checkAndBid = (amount: number, doBid: () => void) => {
    if (isBanned()) {
      toast.error('🚫 Tài khoản bị khóa đấu giá do vi phạm hủy cọc quá 2 lần!')
      return
    }
    if (walletReserved > 0 && amount > walletReserved) {
      setBidWarning({ type: 'blocked' }); return
    }
    if (!over70WarnedRef.current && walletReserved > 0 && amount > walletReserved * 0.7) {
      over70WarnedRef.current = true
      setBidWarning({ type: 'over70', pendingBid: doBid }); return
    }
    doBid()
  }

  // Helper: màu inline theo mức cảnh báo
  const bidWarnLevel = (amount: number) => {
    if (!amount || walletReserved <= 0) return null
    if (amount > walletReserved) return 'blocked'
    if (amount > walletReserved * 0.7) return 'over70'
    return null
  }

  // ── State: Deposit expired warning modal ─────────────────────────────────
  const [depositExpiredWarn, setDepositExpiredWarn] = useState<{ n: number; max: number } | null>(null)
  const prevPendingBannerRef = useRef<string[]>([])
  const MISSED_DEPOSIT_KEY = `buyzo_missed_deposit_${SHOP_NAME}`
  const getMissedCount = () => { try { return Number(localStorage.getItem(MISSED_DEPOSIT_KEY) || '0') } catch { return 0 } }
  const incMissedCount = () => { try { const n = getMissedCount() + 1; localStorage.setItem(MISSED_DEPOSIT_KEY, String(n)); return n } catch { return 1 } }

  // ── Vi phạm hủy cọc ──────────────────────────────────────────────────────
  const BAN_KEY = `shop_auction_ban_${userId}`
  const getViolations = () => { try { return Number(localStorage.getItem(BAN_KEY) || '0') } catch { return 0 } }
  const addViolation  = () => { const n = getViolations() + 1; try { localStorage.setItem(BAN_KEY, String(n)) } catch {}; return n }
  const isBanned      = () => getViolations() >= 3

  // ── State: Hủy cọc modal ─────────────────────────────────────────────────
  const [cancelDepositModal, setCancelDepositModal] = useState<{ id: string; kind: 'banner' | 'flash' } | null>(null)

  // ── State: Buy Now confirmation modal ─────────────────────────────────────
  const [buyNowConfirm, setBuyNowConfirm] = useState<{
    label: string
    price: number
    slots: number
    unitLabel?: string
    onConfirm: () => void
  } | null>(null)

  // ── State: tab ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'banner' | 'flash' | 'top' | 'mytx' | 'prepare'>('banner')

  // ── State: banner position dropdown ───────────────────────────────────────
  const [bannerDropOpen, setBannerDropOpen] = useState(false)
  const bannerDropRef = useRef<HTMLDivElement>(null)

  // ── State: chuẩn bị mẫu ───────────────────────────────────────────────────
  const [prepTab, setPrepTab] = useState<'banner' | 'flash' | 'top'>('banner')
  const [prepBannerPos, setPrepBannerPos] = useState<BannerPositionKey>('home_slider')
  const [highlightPrepPos, setHighlightPrepPos] = useState<string | null>(null)
  // historyId của các submission đã sửa xong, sẵn sàng nộp lại
  const [resubmitReadyIds, setResubmitReadyIds] = useState<Set<string>>(new Set())
  // txId của các buy-now đã sửa draft xong, sẵn sàng nộp lại
  const [bnResubmitReadyIds, setBnResubmitReadyIds] = useState<Set<string>>(new Set())
  const [prepFlashSlot, setPrepFlashSlot] = useState<FlashSlotKey>('flash_slot_1')
  const [prepBannerForms, setPrepBannerForms] = useState<Record<string, { title: string; link: string; image: string }>>({})
  const [prepFlashForms, setPrepFlashForms] = useState<Record<string, { productName: string; price: string; image: string }>>({})
  const [prepBannerImgErr, setPrepBannerImgErr] = useState<Record<string, string>>({})
  const [prepFlashImgErr, setPrepFlashImgErr] = useState<Record<string, string>>({})
  const [bannerDraftsExist, setBannerDraftsExist] = useState<Record<string, boolean>>({})
  const [flashDraftsExist, setFlashDraftsExist] = useState<Record<string, boolean>>({})
  const [prepBannerSaved, setPrepBannerSaved] = useState<Record<string, boolean>>({})
  const [prepFlashSaved, setPrepFlashSaved] = useState<Record<string, boolean>>({})
  // ── State: sản phẩm shop thật (từ API) dùng cho picker Flash Sale ────────
  const [shopProducts, setShopProducts] = useState<{ id: number; name: string; price: number; image: string }[]>([])
  useEffect(() => {
    shopService.getProducts().then((res: any) => {
      const raw: any[] = res?.data?.products || []
      const filtered = raw
        .filter((p: any) => p.status === 'active' || p.status === 'approved')
        .map((p: any) => ({
          id: p.product_id,
          name: p.product_name,
          price: Number(p.price) || 0,
          image: getImageUrl(p.image_urls?.[0]),
        }))
      setShopProducts(filtered)
    }).catch(() => { /* giữ rỗng nếu API lỗi */ })
  }, [])

  // ── State: danh sách 20 sản phẩm Flash Sale chuẩn bị ─────────────────────
  const [pickerOpenIdx, setPickerOpenIdx] = useState<number | null>(null)
  const [flashProductForms, setFlashProductForms] = useState<(Partial<{ productName: string; price: string; productImage: string }> | null)[]>(
    () => Array(FLASH_PRODUCT_MAX).fill(null)
  )
  const [flashProductPreviews, setFlashProductPreviews] = useState<(string | null)[]>(
    () => Array(FLASH_PRODUCT_MAX).fill(null)
  )
  const [flashProductSaved, setFlashProductSaved] = useState<boolean[]>(
    () => Array(FLASH_PRODUCT_MAX).fill(false)
  )

  // Preview tạm (objectURL) — chỉ để hiển thị, không lưu localStorage
  const [bannerPreview, setBannerPreview] = useState<Record<string, string>>({})
  const [prepBannerResolvedImgs, setPrepBannerResolvedImgs] = useState<Record<string, string>>({})
  const [flashPreview, setFlashPreview] = useState<Record<string, string>>({})
  // Ảnh resolved cho modal submit (khi dùng idb: ref từ draft)
  const [bannerModalResolvedImg, setBannerModalResolvedImg] = useState('')

  // ── State: payment countdown (ms còn lại đến paymentDeadline) ────────────
  const [payCountdowns, setPayCountdowns] = useState<Record<string, number>>({})
  const payIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // ── State: modal nội dung bị từ chối (từ thông báo) ──────────────────────
  const [rejectedModal, setRejectedModal] = useState<{
    kind: 'banner' | 'flash'
    sub: BannerSubmission | FlashSubmission
  } | null>(null)
  const location = useLocation()

  // Detect ?rejected_id=... từ notification click
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const rejId = params.get('rejected_id')
    const rejKind = params.get('rejected_kind') as 'banner' | 'flash' | null
    if (!rejId || !rejKind) return
    if (rejKind === 'banner') {
      const found = getAllBannerSubmissions().find(s => s.id === rejId)
      if (found) { setRejectedModal({ kind: 'banner', sub: found }); return }
    }
    if (rejKind === 'flash') {
      const found = getAllFlashSubmissions().find(s => s.id === rejId)
      if (found) { setRejectedModal({ kind: 'flash', sub: found }); return }
    }
  }, [location.search])

  // ── Countdown thanh toán phần còn lại (1 giây) ────────────────────────────
  useEffect(() => {
    if (payIntervalRef.current) clearInterval(payIntervalRef.current)
    payIntervalRef.current = setInterval(() => {
      const next: Record<string, number> = {}
      ;[...getAllBannerSubmissions(), ...getAllFlashSubmissions()].forEach(sub => {
        if (sub.status === 'approved' && sub.paymentDeadline) {
          next[sub.id] = Math.max(0, new Date(sub.paymentDeadline).getTime() - Date.now())
        }
      })
      setPayCountdowns(next)
    }, 1000)
    return () => { if (payIntervalRef.current) clearInterval(payIntervalRef.current) }
  }, [])

  // ── Refresh ───────────────────────────────────────────────────────────────
  // Resolve idb: image refs to data URLs for display whenever drafts change
  useEffect(() => {
    ;(async () => {
      const { resolveImageAsync } = await import('../../utils/imageDB')
      const resolved: Record<string, string> = {}
      for (const p of BANNER_POSITIONS) {
        const d = getBannerDraft(p.key, SHOP_NAME)
        if (d?.image) resolved[p.key] = await resolveImageAsync(d.image)
      }
      setPrepBannerResolvedImgs(resolved)
    })()
  }, [bannerDraftsExist])

  const checkDrafts = () => {
    const bEx: Record<string, boolean> = {}
    BANNER_POSITIONS.forEach(p => { bEx[p.key] = !!getBannerDraft(p.key, SHOP_NAME) })
    setBannerDraftsExist(bEx)

    // Load flash product list
    const fpList = getFlashProductList(SHOP_NAME)
    setFlashProductForms(fpList.map(item => item ? { productName: item.productName, price: String(item.price), productImage: item.productImage } : null))
    setFlashProductSaved(fpList.map(item => !!item))
    // Chỉ khởi tạo saved=true cho draft đã có sẵn (lần đầu load), không override khi user đang edit
    setPrepBannerSaved(prev => {
      const next = { ...prev }
      BANNER_POSITIONS.forEach(p => { if (bEx[p.key] && prev[p.key] === undefined) next[p.key] = true })
      return next
    })
    const fEx: Record<string, boolean> = {}
    FLASH_SLOTS.forEach(s => { fEx[s.key] = !!getFlashDraft(s.key, SHOP_NAME) })
    setFlashDraftsExist(fEx)
    setPrepFlashSaved(prev => {
      const next = { ...prev }
      FLASH_SLOTS.forEach(s => { if (fEx[s.key] && prev[s.key] === undefined) next[s.key] = true })
      return next
    })
  }

  const refresh = () => {
    sweepExpiredWins()
    setBannerSessions({ ...getAllActiveSessions() })
    const newHistory = getHistory()
    setBannerHistory(newHistory)
    const newPending = getPendingWinsForShop(SHOP_NAME)
    // Phát hiện win vừa hết hạn cọc
    const removedIds = prevPendingBannerRef.current.filter(id => !newPending.some(w => w.id === id))
    if (removedIds.length > 0) {
      const newlyExpired = removedIds.filter(id => newHistory.find(h => h.id === id)?.confirmation === 'expired')
      if (newlyExpired.length > 0) {
        const n = incMissedCount()
        setDepositExpiredWarn({ n, max: 2 })
      }
    }
    prevPendingBannerRef.current = newPending.map(w => w.id)
    setPendingBannerWins(newPending)
    setBannerAdminSettings({ ...getBannerAdminSettings() })
    setBannerSubmissions([...getAllBannerSubmissions()])
    setBuyNowTxs([...getBuyNowTransactions(SHOP_NAME)])
  }
  const refreshFlash = () => {
    sweepFlash()
    setFlashSessions({ ...getAllFlashSessions() })
    setFlashHistory(getFlashHistory())
    setPendingFlashWins(getFlashPendingWins(SHOP_NAME))
  }
  const refreshPools = () => {
    setFlashPoolSession(getFlashPoolSession())
    setFlashPoolSettings(getFlashPoolSettings())
    setTopSessions({ ...getAllTopSessions() })
    setTopHistory(getTopHistory())
    setTopAdminSettings({ ...getTopAdminSettings() })
    setPoolTick(t => t + 1)
  }

  useEffect(() => {
    refresh(); refreshFlash(); refreshPools(); checkDrafts()
    const pollId = setInterval(() => { refresh(); refreshFlash(); refreshPools() }, 2000)
    return () => clearInterval(pollId)
  }, [])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bannerDropRef.current && !bannerDropRef.current.contains(e.target as Node))
        setBannerDropOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // countdown timer
  useEffect(() => {
    const t = setInterval(() => {
      const next: Record<string, string> = {}
      BANNER_POSITIONS.forEach(p => {
        const s = bannerSessions[p.key]; if (s) next[p.key] = formatCountdown(msUntilEnd(s))
      })
      FLASH_SLOTS.forEach(sl => {
        const s = flashSessions[sl.key]; if (s) next[sl.key] = formatCountdown(flashMsUntilEnd(s))
      })
      setCountdown(next)
    }, 500)
    return () => clearInterval(t)
  }, [bannerSessions, flashSessions])

  // ── Helpers ───────────────────────────────────────────────────────────────

  /** Chuyển sang tab Chuẩn bị và scroll+highlight vị trí cần sửa */
  const goToPreparePos = (posKey: string) => {
    setTab('prepare')
    setPrepTab('banner')
    setHighlightPrepPos(posKey)
    setTimeout(() => {
      const el = document.getElementById('prep-pos-' + posKey)
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 120)
    // Không auto-clear — chỉ clear khi save hoặc rời tab
  }

  const openSubmitModal = (win: PendingWin) => {
    setSubmitTarget(win)
    setBannerImgError('')
    setFlashImgError('')
    setBannerModalResolvedImg('')

    if (win.kind === 'banner-buynow') {
      // Prefill từ transaction hiện tại (nếu đang sửa lại)
      const tx = buyNowTxs.find(t => t.id === win.txId)
      const draft = getBannerDraft(win.position, SHOP_NAME)
      const prefillImg = tx?.image || draft?.image || ''
      const prefillTitle = tx?.title || draft?.title || ''
      const prefillLink = tx?.link || draft?.link || ''
      if (prefillTitle || prefillImg) {
        setBannerForm({ title: prefillTitle, link: prefillLink, image: prefillImg })
        if (prefillImg) {
          import('../../utils/imageDB').then(({ resolveImageAsync }) => {
            resolveImageAsync(prefillImg).then(url => { if (url) setBannerModalResolvedImg(url) })
          })
        }
      } else {
        setBannerForm({ title: '', link: '', image: '' })
      }
      setFlashForm({ productName: '', price: '', image: '' })
      return
    }

    if (win.kind === 'banner') {
      const session = win.session as BannerAuctionSession
      const draft = getBannerDraft(session.position, SHOP_NAME)
      if (draft) {
        setBannerForm({ title: draft.title, link: draft.link ?? '', image: draft.image })
        // Resolve idb: ref để hiện preview ngay trong modal
        if (draft.image) {
          import('../../utils/imageDB').then(({ resolveImageAsync }) => {
            resolveImageAsync(draft.image).then(url => { if (url) setBannerModalResolvedImg(url) })
          })
        }
      } else {
        setBannerForm({ title: '', link: '', image: '' })
      }
      setFlashForm({ productName: '', price: '', image: '' })
    } else {
      setBannerForm({ title: '', link: '', image: '' })
      setFlashForm({ productName: win.session.winner?.productName ?? '', price: '', image: '' })
    }
  }

  const handleBannerImageFile = async (file: File) => {
    if (!submitTarget || (submitTarget.kind !== 'banner' && submitTarget.kind !== 'banner-buynow')) return
    const bannerPos = submitTarget.kind === 'banner-buynow' ? submitTarget.position : (submitTarget.session as BannerAuctionSession).position
    const spec = BANNER_IMAGE_SPECS[bannerPos]
    const result = await validateImageFile(file, spec)
    if (!result.ok) { setBannerImgError(result.error || 'Ảnh không hợp lệ.'); return }
    setBannerImgError('')
    setBannerModalResolvedImg('') // clear draft preview — dùng ảnh mới chọn
    setBannerForm(f => ({ ...f, image: result.dataUrl! }))
  }

  const handleFlashImageFile = async (file: File) => {
    const result = await validateImageFile(file, FLASH_IMAGE_SPEC)
    if (!result.ok) { setFlashImgError(result.error || 'Ảnh không hợp lệ.'); return }
    setFlashImgError(''); setFlashForm(f => ({ ...f, image: result.dataUrl! }))
  }

  const handleSubmitBanner = async () => {
    if (!submitTarget || (submitTarget.kind !== 'banner' && submitTarget.kind !== 'banner-buynow')) return
    if (!bannerForm.title.trim() || !bannerForm.image) { toast.error('Vui lòng nhập tiêu đề và chọn hình ảnh banner đúng yêu cầu.'); return }
    if (bannerImgError) { toast.error(bannerImgError); return }
    try {
      const { idbSave, isIDBRef } = await import('../../utils/imageDB')
      const imageRef = isIDBRef(bannerForm.image) ? bannerForm.image : await idbSave(bannerForm.image)
      if (submitTarget.kind === 'banner-buynow') {
        const ok = submitBuyNowBanner(submitTarget.txId, { title: bannerForm.title.trim(), link: bannerForm.link.trim() || undefined, image: imageRef })
        if (!ok) { toast.error('Không thể đăng banner — vui lòng thử lại.'); return }
        setBuyNowTxs([...getBuyNowTransactions(SHOP_NAME)])
      } else {
        const result = submitBanner(submitTarget.session.id, { title: bannerForm.title.trim(), link: bannerForm.link.trim() || undefined, image: imageRef })
        if (!result) { toast.error('Không thể đăng banner — vui lòng thử lại.'); return }
      }
      setBannerSubmissions([...getAllBannerSubmissions()])
      toast.success('📢 Đã gửi banner cho Admin duyệt!'); setSubmitTarget(null); refresh()
    } catch {
      toast.error('Lỗi lưu ảnh — vui lòng thử lại.')
    }
  }

  const handleSubmitFlash = async () => {
    if (!submitTarget || submitTarget.kind !== 'flash') return
    const priceNum = Number(flashForm.price.replace(/[^\d]/g, ''))
    if (!flashForm.productName.trim() || !priceNum || priceNum <= 0 || !flashForm.image) { toast.error('Vui lòng nhập đầy đủ tên sản phẩm, giá tiền và hình ảnh đúng yêu cầu.'); return }
    if (flashImgError) { toast.error(flashImgError); return }
    try {
      // Lưu ảnh vào IndexedDB (không bị giới hạn 5MB như localStorage)
      const { idbSave, isIDBRef } = await import('../../utils/imageDB')
      const imageRef = isIDBRef(flashForm.image) ? flashForm.image : await idbSave(flashForm.image)
      const result = submitFlashProduct(submitTarget.session.id, { productName: flashForm.productName.trim(), price: priceNum, productImage: imageRef })
      if (!result) { toast.error('Không thể đăng sản phẩm — vui lòng thử lại.'); return }
      toast.success('📦 Đã gửi sản phẩm cho Admin duyệt!'); setSubmitTarget(null); refreshFlash()
    } catch {
      toast.error('Lỗi lưu ảnh — vui lòng thử lại.')
    }
  }

  // ── Render helpers ────────────────────────────────────────────────────────
  const cardStyle: React.CSSProperties = { background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }
  const badgeStyle = (color: string, bg: string): React.CSSProperties => ({ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color, background: bg })
  const btnStyle = (bg: string, color = 'white'): React.CSSProperties => ({ background: bg, color, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' })

  // ── Banner tab ────────────────────────────────────────────────────────────
  const currentBannerSession = bannerSessions[selectedBannerPos]
  const bannerDef = BANNER_POSITIONS.find(p => p.key === selectedBannerPos)!
  const minBannerBid = getMinNextBid(selectedBannerPos)
  const bannerCooldown = getShopCooldownRemaining(selectedBannerPos, SHOP_NAME)

  const handlePlaceBannerBid = () => {
    const amount = parseInt((bidAmounts[selectedBannerPos] || '').replace(/[^\d]/g, ''))
    if (!amount) { toast.error('Vui lòng nhập số tiền đặt giá'); return }
    checkAndBid(amount, () => {
      const result = placeBid(selectedBannerPos, SHOP_NAME, amount)
      if (!result.ok) { toast.error(result.error || 'Không thể đặt giá'); return }
      toastBidResult(result.endPriceHit, '✅ Đặt giá thành công!'); setBidAmounts(p => ({ ...p, [selectedBannerPos]: '' })); refresh()
    })
  }

  // ── Flash tab ─────────────────────────────────────────────────────────────
  const currentFlashSession = flashSessions[selectedFlashSlot]
  const flashSlotDef = FLASH_SLOTS.find(s => s.key === selectedFlashSlot)!
  const minFlashBid = getFlashMinNextBid(selectedFlashSlot)
  const flashCooldown = getFlashCooldown(selectedFlashSlot, SHOP_NAME)

  const handlePlaceFlashBid = () => {
    const amount = parseInt((flashBidAmounts[selectedFlashSlot] || '').replace(/[^\d]/g, ''))
    const productName = (flashBidProducts[selectedFlashSlot] || '').trim()
    if (!productName) { toast.error('Vui lòng nhập tên sản phẩm'); return }
    if (!amount) { toast.error('Vui lòng nhập số tiền đặt giá'); return }
    checkAndBid(amount, () => {
      const result = placeFlashBid(selectedFlashSlot, SHOP_NAME, productName, amount)
      if (!result.ok) { toast.error(result.error || 'Không thể đặt giá'); return }
      toast.success('✅ Đặt giá thành công!'); setFlashBidAmounts(p => ({ ...p, [selectedFlashSlot]: '' })); refreshFlash()
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // Right sidebar data (computed inline)
  const rightTab = tab
  // Banner: dùng selectedBannerPos — người dùng click card nào thì panel theo card đó
  const rBannerSession = bannerSessions[selectedBannerPos]
  const rBannerLive = rBannerSession ? isAuctionLive(rBannerSession) : false
  const rBannerBs = bannerAdminSettings[selectedBannerPos]
  const rBannerDuration = rBannerSession ? (rBannerSession.scheduledStartAt
    ? new Date(rBannerSession.endsAt).getTime() - new Date(rBannerSession.scheduledStartAt).getTime()
    : new Date(rBannerSession.endsAt).getTime() - new Date(rBannerSession.startedAt).getTime()) : 0

  const rFlashLive = flashPoolSession ? isFlashPoolLive(flashPoolSession) : false
  const rFlashMsEnd = flashPoolSession ? flashPoolMsEnd(flashPoolSession) : 0
  const rFlashMsStart = flashPoolSession ? flashPoolMsStart(flashPoolSession) : 0

  const rTopSession = topSessions[selectedTopSlot] ?? null
  const rTopLive = rTopSession ? isTopLive(rTopSession) : false
  const rTopBs = topAdminSettings[selectedTopSlot]
  const rTopDuration = rTopSession ? (rTopSession.scheduledStartAt
    ? new Date(rTopSession.endsAt).getTime() - new Date(rTopSession.scheduledStartAt).getTime()
    : new Date(rTopSession.endsAt).getTime() - new Date(rTopSession.startedAt).getTime()) : 0
  const rTopSlotDef = TOP_SLOTS.find(s => s.key === selectedTopSlot) ?? TOP_SLOTS[0]

  const hasRightPanel =
    (rightTab === 'banner' && !!rBannerSession) ||
    (rightTab === 'flash' && !!flashPoolSession) ||
    (rightTab === 'top' && !!rTopSession)

  // ── Modal cảnh báo tiền đấu giá ───────────────────────────────────────────
  const walletWarningModal = bidWarning && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 380, width: '90%', boxShadow: '0 8px 32px rgba(0,0,0,0.18)' }}>
        {bidWarning.type === 'blocked' ? (
          <>
            <div style={{ fontSize: 32, marginBottom: 10, textAlign: 'center' }}>⛔</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#DC2626', marginBottom: 8, textAlign: 'center' }}>Không thể đặt cược</div>
            <div style={{ fontSize: 13, color: '#444', marginBottom: 20, textAlign: 'center', lineHeight: 1.6 }}>
              Số tiền đặt cược vượt quá <b>Tiền đấu giá</b> trong ví
              <br /><span style={{ color: '#7C3AED', fontWeight: 700 }}>({walletReserved.toLocaleString('vi-VN')}đ)</span>.
              <br />Vui lòng nạp thêm để tiếp tục.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setBidWarning(null)}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #DC2626', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                Đóng
              </button>
              <button onClick={() => { setBidWarning(null); navigate('/shop/wallet?tab=auction_fund') }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                🔒 Nạp tiền
              </button>
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 32, marginBottom: 10, textAlign: 'center' }}>⚠️</div>
            <div style={{ fontWeight: 800, fontSize: 16, color: '#D97706', marginBottom: 8, textAlign: 'center' }}>Số tiền đã vượt 70%</div>
            <div style={{ fontSize: 13, color: '#444', marginBottom: 20, textAlign: 'center', lineHeight: 1.6 }}>
              Số tiền đặt cược đã vượt <b>70%</b> Tiền đấu giá trong ví
              <br /><span style={{ color: '#7C3AED', fontWeight: 700 }}>({walletReserved.toLocaleString('vi-VN')}đ)</span>.
              <br />Bạn có muốn tiếp tục?
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => { bidWarning.pendingBid?.(); setBidWarning(null) }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #D97706', background: '#FFF7ED', color: '#D97706', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                Đã rõ
              </button>
              <button onClick={() => { setBidWarning(null); navigate('/shop/wallet?tab=auction_fund') }}
                style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#7C3AED', color: '#fff', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
                🔒 Nạp tiền
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )

  // ── Modal hủy cọc ─────────────────────────────────────────────────────────
  const cancelDepositModalJSX = cancelDepositModal && (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 28, maxWidth: 400, width: '92%', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 8 }}>🚫</div>
        <div style={{ fontWeight: 800, fontSize: 17, color: '#DC2626', textAlign: 'center', marginBottom: 12 }}>Hủy cọc đấu giá</div>
        <div style={{ fontSize: 13, color: '#444', lineHeight: 1.7, marginBottom: 14, textAlign: 'center' }}>
          Tiền cọc sẽ <b style={{ color: '#DC2626' }}>KHÔNG được hoàn trả</b> khi hủy cọc.
        </div>
        <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '12px 16px', fontSize: 13, lineHeight: 1.7, marginBottom: 20 }}>
          ⚠️ <b>Cảnh báo:</b> Vi phạm hủy cọc <b>trên 2 lần</b> sẽ bị <b>khóa vĩnh viễn</b> — không được tham gia đấu giá và không thể nạp <b>Tiền đấu giá</b>.<br />
          <span style={{ color: '#7C3AED', fontWeight: 700 }}>Vi phạm hiện tại: {getViolations()}/2</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setCancelDepositModal(null)}
            style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #16A34A', background: '#F0FDF4', color: '#16A34A', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            Giữ lại cọc
          </button>
          <button
            onClick={() => {
              const { id, kind } = cancelDepositModal
              const ok = kind === 'banner' ? cancelBannerDeposit(id) : cancelFlashDeposit(id)
              if (ok) {
                const newCount = addViolation()
                setCancelDepositModal(null)
                refresh(); refreshFlash()
                if (newCount >= 3) toast.error('🚫 Tài khoản bị khóa đấu giá do vi phạm hủy cọc quá 2 lần!')
                else toast.warning(`⚠️ Đã hủy cọc. Vi phạm ${newCount}/2 — còn ${2 - newCount} lần trước khi bị khóa.`)
              }
            }}
            style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #DC2626', background: '#FEF2F2', color: '#DC2626', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            Xác nhận hủy
          </button>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{ paddingBottom: 80 }}>
      {walletWarningModal}
      {cancelDepositModalJSX}
      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div>
      <h2 style={{ marginBottom: 4 }}>🏆 Đấu giá vị trí quảng cáo</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>Đặt giá để banner / sản phẩm của shop xuất hiện ở vị trí hot trên Trang chủ BuyZo.</p>

      {/* ── Thông báo thắng đấu giá / đặt cọc / buy-now vi phạm ─────────── */}
      {(pendingBannerWins.length > 0 || pendingFlashWins.length > 0 || buyNowTxs.some(t => t.status === 'awaiting_edit')) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24 }}>
          {[...pendingBannerWins.map(w => ({ kind: 'banner' as const, w })), ...pendingFlashWins.map(w => ({ kind: 'flash' as const, w }))].map(({ kind, w }) => {
            const sub = kind === 'banner' ? getSubmissionByHistoryId(w.id) : getFlashSubmissionByHistoryId(w.id)
            const posLabel = kind === 'banner'
              ? BANNER_POSITIONS.find(p => p.key === (w as BannerAuctionSession).position)?.label
              : FLASH_SLOTS.find(s => s.key === (w as FlashAuctionSession).slot)?.label
            const depositAmt = w.depositAmount ?? 0
            const depositDeadline = w.depositDeadline ? new Date(w.depositDeadline) : null
            const msLeft = Math.max(0, depositDeadline ? depositDeadline.getTime() - Date.now() : 0)
            const depositMmSs = (() => {
              const totalSec = Math.floor(msLeft / 1000)
              const mm = Math.floor(totalSec / 60).toString().padStart(2, '0')
              const ss = (totalSec % 60).toString().padStart(2, '0')
              return `${mm}:${ss}`
            })()
            const isDepositUrgent = msLeft > 0 && msLeft <= 5 * 60 * 1000 // đỏ khi còn < 5 phút

            if (w.confirmation === 'pending') {
              return (
                <div key={w.id} style={{ borderRadius: 14, padding: 20, background: isDepositUrgent ? 'linear-gradient(135deg,#FFF1F2,#FEE2E2)' : 'linear-gradient(135deg,#FFF7ED,#FEF3C7)', border: `2px solid ${isDepositUrgent ? '#DC2626' : C.orange}` }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 28 }}>{isDepositUrgent ? '🚨' : '🏆'}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: isDepositUrgent ? '#DC2626' : C.orange }}>Chúc mừng! Bạn đã thắng đấu giá</div>
                      <div style={{ fontSize: 13, color: C.gray }}>{kind === 'banner' ? '🖼️' : '⚡'} {posLabel} — Giá thắng: <b>{w.winner?.amount.toLocaleString('vi-VN')}đ</b></div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 26, fontWeight: 800, color: '#DC2626', fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>⏰ {depositMmSs}</div>
                      <div style={{ fontSize: 11, color: isDepositUrgent ? '#DC2626' : C.gray, fontWeight: isDepositUrgent ? 700 : 400 }}>{isDepositUrgent ? '⚠️ Sắp hết giờ!' : 'còn lại để đặt cọc'}</div>
                    </div>
                  </div>

                  {/* Điều kiện */}
                  <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: isDepositUrgent ? '#DC2626' : '#92400E' }}>📋 Điều kiện đặt cọc</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>💰 Số tiền cọc: <b style={{ color: C.orange }}>{depositAmt.toLocaleString('vi-VN')}đ</b> <span style={{ color: C.gray, fontSize: 12 }}>(20% giá thắng)</span></span>
                      <span>⏱ Hạn đặt cọc: <b>{depositDeadline?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</b> hôm nay</span>
                      <span style={{ color: '#DC2626' }}>⚠️ Hết giờ → <b>mất quyền thắng vĩnh viễn, không hoàn tiền cọc</b></span>
                      <span>✅ Sau khi đặt cọc: mẫu banner sẽ tự gửi Admin duyệt. Thanh toán đủ 100% để banner đi vào hoạt động.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...btnStyle(C.orange), fontSize: 14, padding: '10px 24px' }}
                      onClick={() => {
                        let ok: boolean
                        if (kind === 'banner') {
                          const bDraft = getBannerDraft((w as BannerAuctionSession).position, SHOP_NAME)
                          ok = payDeposit(w.id, bDraft ? { title: bDraft.title, link: bDraft.link, image: bDraft.image } : undefined)
                        } else {
                          ok = payFlashDeposit(w.id)
                        }
                        if (ok) {
                          deductWallet(depositAmt, `Đặt cọc đấu giá — ${kind === 'banner' ? 'Banner' : 'Flash Sale'}`)
                          refresh(); refreshFlash()
                          toast.success(`💰 Đặt cọc ${depositAmt.toLocaleString('vi-VN')}đ thành công! Vào tab Giao dịch để thanh toán phần còn lại.`)
                          setTab('mytx')
                        } else toast.error('Không thể đặt cọc, vui lòng thử lại.')
                      }}>
                      💰 Đặt cọc ngay ({depositAmt.toLocaleString('vi-VN')}đ)
                    </button>
                  </div>
                </div>
              )
            }

            if (w.confirmation === 'deposit_paid') {
              const subForPay = kind === 'banner' ? getSubmissionByHistoryId(w.id) : getFlashSubmissionByHistoryId(w.id)
              const payRemMs = subForPay?.paymentDeadline ? (payCountdowns[subForPay.id] ?? Math.max(0, new Date(subForPay.paymentDeadline).getTime() - Date.now())) : null
              const isUrgent = payRemMs !== null && payRemMs > 0 && payRemMs <= 5 * 60 * 1000
              const totalPayMs = subForPay?.paymentDeadline && subForPay?.approvedAt
                ? new Date(subForPay.paymentDeadline).getTime() - new Date(subForPay.approvedAt).getTime() : null
              const pct = payRemMs !== null && payRemMs > 0 && totalPayMs
                ? Math.max(0, Math.min(100, (payRemMs / totalPayMs) * 100)) : null

              return (
                <div key={w.id} style={{ borderRadius: 14, overflow: 'hidden', border: `2px solid ${isUrgent ? '#DC2626' : C.primary}`, display: 'flex', flexDirection: 'column' }}>
                  <div style={{ padding: 20, background: isUrgent ? 'rgba(220,38,38,0.06)' : C.primaryLight, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <span style={{ fontSize: 24 }}>✅</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 15, color: isUrgent ? '#DC2626' : C.primary }}>Đã đặt cọc — chờ thanh toán đủ</div>
                      <div style={{ fontSize: 13, color: C.gray }}>{posLabel} — Còn lại: <b>{((w.winner?.amount ?? 0) - depositAmt).toLocaleString('vi-VN')}đ</b></div>
                    </div>
                    {payRemMs !== null && payRemMs > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: 22, fontWeight: 800, color: isUrgent ? '#DC2626' : C.blue }}>
                          {isUrgent ? '🚨' : '⏳'} {fmtMmSs(payRemMs)}
                        </div>
                        <div style={{ fontSize: 11, color: C.gray }}>còn lại để thanh toán</div>
                      </div>
                    )}
                    {payRemMs !== null && payRemMs <= 0 && (
                      <div style={{ textAlign: 'right', color: '#DC2626', fontWeight: 700, fontSize: 13 }}>❌ Hết hạn</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {sub?.status === 'approved' && (
                      <button style={btnStyle(C.blue)}
                        onClick={() => {
                          const remaining = (w.winner?.amount ?? 0) - depositAmt
                          const ok = kind === 'banner' ? payWin(w.id) : payFlashWin(w.id)
                          if (ok) { deductWallet(remaining, `Thanh toán đủ đấu giá — ${kind === 'banner' ? 'Banner' : 'Flash Sale'}`); refresh(); refreshFlash(); toast.success('💳 Thanh toán đủ thành công!') }
                        }}>
                        💳 Thanh toán đủ ({((w.winner?.amount ?? 0) - depositAmt).toLocaleString('vi-VN')}đ)
                      </button>
                    )}
                    {!sub && (
                      <button style={btnStyle(C.purple)} onClick={() => openSubmitModal(kind === 'banner' ? { kind: 'banner', session: w as BannerAuctionSession } : { kind: 'flash', session: w as FlashAuctionSession })}>
                        {kind === 'banner' ? '📢 Đăng banner' : '📦 Đăng sản phẩm'}
                      </button>
                    )}
                    {sub && sub.status === 'approved' && (
                      <span style={badgeStyle(C.primary, C.primaryLight)}>✅ Đã duyệt</span>
                    )}
                    {sub && sub.status === 'pending' && (
                      <span style={badgeStyle(C.orange, C.orangeLight)}>⏳ Chờ duyệt</span>
                    )}
                    {sub && sub.status === 'awaiting_edit' && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#DC2626', background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 6, padding: '3px 10px', display: 'inline-block', alignSelf: 'flex-start' }}>
                          ⚠️ Cảnh báo vi phạm — lần {(sub as any).rejectCount ?? 0}/3
                        </div>
                        {(sub as any).rejectReason && (
                          <div style={{ fontSize: 12, color: '#5B21B6', background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.2)', borderRadius: 8, padding: '6px 10px' }}>
                            ❌ {(sub as any).rejectReason}
                          </div>
                        )}
                        <button
                          onClick={() => {
                            const posKey = (sub as any).position as string | undefined
                            if (posKey) goToPreparePos(posKey)
                          }}
                          style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer', alignSelf: 'flex-start' }}>
                          ✏️ Đợi sửa ({(sub as any).rejectCount ?? 0}/3) — Sửa ngay
                        </button>
                      </div>
                    )}
                    {sub && sub.status === 'rejected' && (
                      <button
                        onClick={() => setRejectedModal({ kind: kind as 'banner' | 'flash', sub })}
                        style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        ❌ Bị từ chối vĩnh viễn — Xem chi tiết
                      </button>
                    )}
                  </div>
                  </div>
                  {/* Progress bar đếm ngược */}
                  {pct !== null && (
                    <div style={{ height: 5, background: 'rgba(0,0,0,0.08)' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: isUrgent ? '#DC2626' : C.blue, transition: 'width 1s linear', borderRadius: '0 3px 3px 0' }} />
                    </div>
                  )}
                </div>
              )
            }

            return null
          })}
          {buyNowTxs.filter(t => t.status === 'awaiting_edit').map(tx => (
            <div key={tx.id} style={{ borderRadius: 14, overflow: 'hidden', border: '2px solid #7C3AED', display: 'flex', flexDirection: 'column' }}>
              <div style={{ padding: 20, background: 'rgba(124,58,237,0.06)', flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <span style={{ fontSize: 22 }}>⚠️</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: '#7C3AED' }}>Banner bị từ chối — cần chỉnh sửa</div>
                    <div style={{ fontSize: 13, color: C.gray }}>{tx.positionLabel} — lần {tx.rejectCount}/{MAX_BUYNOW_REVISIONS}</div>
                  </div>
                </div>
                {tx.rejectReason && (
                  <div style={{ fontSize: 13, color: '#5B21B6', background: 'rgba(124,58,237,0.07)', borderRadius: 8, padding: '8px 12px', marginBottom: 12 }}>
                    ❌ Lý do: {tx.rejectReason}
                  </div>
                )}
                <button
                  onClick={() => { if (!bnResubmitReadyIds.has(tx.id)) goToPreparePos(tx.position) }}
                  style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, padding: '4px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  {bnResubmitReadyIds.has(tx.id) ? '📤 Sẵn sàng nộp lại — vào Giao dịch' : `✏️ Đợi sửa (${tx.rejectCount}/${MAX_BUYNOW_REVISIONS}) — Sửa ngay`}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {([['banner', '🖼️ Banner'], ['flash', '⚡ Flash Sale'], ['top', '🏆 Vị trí Top'], ['mytx', '📒 Giao dịch của tôi'], ['prepare', '⚙️ Chuẩn bị']] as const).map(([t, label]) => (
          <button key={t} onClick={() => { setTab(t); if (t !== 'prepare') setHighlightPrepPos(null) }} style={{ ...btnStyle(tab === t ? (t === 'top' ? C.purple : C.primary) : 'transparent', tab === t ? 'white' : C.gray), border: `1px solid ${tab === t ? (t === 'top' ? C.purple : C.primary) : C.border}`, position: 'relative' }}>
            {t === 'prepare' && (Object.values(bannerDraftsExist).some(Boolean) || Object.values(flashDraftsExist).some(Boolean)) && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: C.primary, border: '2px solid var(--bg-card)' }} />
            )}
            {label}
          </button>
        ))}
      </div>

      {/* ── Flex row: tab content + right panel ─────────────────────────── */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
      <div style={{ flex: 1, minWidth: 0 }}>

      {/* ── Banner tab — hiển thị cả 3 vị trí ──────────────────────────── */}
      {tab === 'banner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {BANNER_POSITIONS.map(pos => {
            const session  = bannerSessions[pos.key]
            const minBid   = getMinNextBid(pos.key)
            const cooldown = getShopCooldownRemaining(pos.key, SHOP_NAME)
            const preview  = getPreview(pos.key, pos.previewImage)

            const isSelected = selectedBannerPos === pos.key
            const bs           = bannerAdminSettings[pos.key]
            const buyPrice     = bs?.buyNowPrice
            const buySlots     = bs?.slots ?? 1
            const live         = !!session && isAuctionLive(session)
            const purchases    = session?.buyNowPurchases ?? []
            const hasBoughtNow = purchases.some(p => p.shopName === SHOP_NAME)
            const slotsFull    = purchases.length >= buySlots
            return (
              <div key={pos.key}
                onClick={() => setSelectedBannerPos(pos.key)}
                style={{ ...cardStyle, cursor: 'pointer', border: isSelected ? `2px solid ${C.primary}` : `1px solid ${C.border}`, transition: 'border 0.15s', padding: 0, overflow: 'hidden', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'stretch' }}>

                  {/* ── Trái 7/10 ── */}
                  <div style={{ flex: 7, minWidth: 0, padding: 20 }}>
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                      <div>
                        <h3 style={{ margin: 0 }}>{pos.label}{isSelected && <span style={{ marginLeft: 8, fontSize: 11, color: C.primary, fontWeight: 600 }}>● đang xem</span>}</h3>
                        <p style={{ color: C.gray, fontSize: 12, margin: '4px 0 0' }}>{pos.description}</p>
                      </div>
                      {session && (
                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                          {live ? (
                            <>
                              <div style={{ fontSize: 20, fontWeight: 700, color: '#DC2626' }}>⏱ {countdown[pos.key] || '–'}</div>
                              <div style={{ fontSize: 11, color: C.gray }}>còn lại</div>
                            </>
                          ) : (
                            <>
                              <div style={{ fontSize: 16, fontWeight: 700, color: '#D97706' }}>⏳ {formatCountdown(msUntilStart(session))}</div>
                              <div style={{ fontSize: 11, color: C.gray }}>đến khi bắt đầu</div>
                            </>
                          )}
                        </div>
                      )}
                    </div>

                    {session ? (
                      <>
                        {!live && (
                          <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid #FCD34D', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                            <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#92400E' }}>⏰ Phiên đấu giá sắp khai mạc!</p>
                            {session.description && <p style={{ margin: '0 0 6px', fontSize: 13, color: '#78350F', whiteSpace: 'pre-line' }}>📋 {session.description}</p>}
                            <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>Khai mạc lúc: <b>{session.scheduledStartAt ? new Date(session.scheduledStartAt).toLocaleString('vi-VN') : '–'}</b></p>
                            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B45309' }}>Bạn có thể xem thông tin phiên nhưng chưa thể đặt giá.</p>
                          </div>
                        )}

                        {preview && (
                          <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                            <img src={preview} alt={pos.label} style={{ width: '100%', maxHeight: pos.key === 'home_slider' ? 200 : pos.key === 'mall_ads_main' ? 420 : 300, objectFit: 'contain', display: 'block', background: '#f3f4f6' }} />
                          </div>
                        )}

                        <div style={{ marginBottom: 16 }}>
                          <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Bảng đấu giá ({session.bids.length} lượt)</p>
                          <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                            {session.bids.slice(0, 20).map((bid, i) => (
                              <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: i === 0 ? C.primaryLight : 'transparent' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  {bid.bannerImage && <img src={bid.bannerImage} alt="" style={{ width: 36, height: 24, objectFit: 'cover', borderRadius: 4, border: `1px solid ${C.border}` }} />}
                                  <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400 }}>
                                    {i === 0 && '👑 '}{bid.shopName}
                                    {bid.shopName === SHOP_NAME && <span style={{ ...badgeStyle(C.primary, C.primaryLight), marginLeft: 6 }}>Bạn</span>}
                                  </span>
                                </div>
                                <span style={{ fontWeight: 700, color: i === 0 ? C.primary : 'inherit' }}>{bid.amount.toLocaleString('vi-VN')}đ</span>
                              </div>
                            ))}
                            {session.bids.length === 0 && <p style={{ padding: 14, color: C.gray, fontSize: 13 }}>Chưa có ai đặt giá — hãy là người đầu tiên!</p>}
                          </div>
                        </div>

                        {hasBoughtNow ? (
                          <div style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(22,163,74,0.08)', border: `1px solid ${C.primary}44`, fontSize: 13, color: C.primary, fontWeight: 600 }}>
                            ✅ Bạn đã mua hết vị trí này — không thể đặt giá thêm.
                          </div>
                        ) : (
                          <>
                            <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                              {(() => {
                                const raw = minBid / 10
                                const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))))
                                const niceStep = Math.round(raw / mag) * mag || mag
                                const firstVal = Math.ceil((minBid + 1) / niceStep) * niceStep
                                const presets = [minBid, firstVal, firstVal + niceStep, firstVal + 2 * niceStep, firstVal + 3 * niceStep, firstVal + 4 * niceStep]
                                return presets.map((val, i) => (
                                  <button key={i} onClick={e => { e.stopPropagation(); setBidAmounts(p => ({ ...p, [pos.key]: val.toLocaleString('vi-VN') })) }}
                                    style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}`, background: bidAmounts[pos.key] === val.toLocaleString('vi-VN') ? C.primary : 'transparent', color: bidAmounts[pos.key] === val.toLocaleString('vi-VN') ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                                    {i === 0 ? 'Tối thiểu' : val.toLocaleString('vi-VN')}đ
                                  </button>
                                ))
                              })()}
                            </div>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                              <div style={{ flex: 1, minWidth: 200 }}>
                                <input type="text"
                                  placeholder={`Tối thiểu ${minBid.toLocaleString('vi-VN')}đ`}
                                  value={bidAmounts[pos.key] || ''}
                                  onChange={e => {
                                    const raw = e.target.value.replace(/[^\d]/g, '')
                                    const num = Number(raw)
                                    setBidAmounts(p => ({ ...p, [pos.key]: raw ? num.toLocaleString('vi-VN') : '' }))
                                  }}
                                  onClick={e => e.stopPropagation()}
                                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${bidWarnLevel(parseInt((bidAmounts[pos.key]||'').replace(/[^\d]/g,''))) === 'blocked' ? '#DC2626' : bidWarnLevel(parseInt((bidAmounts[pos.key]||'').replace(/[^\d]/g,''))) === 'over70' ? '#D97706' : C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                                />
                                {(() => { const w = bidWarnLevel(parseInt((bidAmounts[pos.key]||'').replace(/[^\d]/g,''))); return w ? (
                                  <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600, color: w === 'blocked' ? '#DC2626' : '#D97706' }}>
                                    {w === 'blocked' ? '⛔ Vượt Tiền đấu giá!' : '⚠️ Vượt 70% Tiền đấu giá'}
                                  </div>
                                ) : null })()}
                              </div>
                              <button
                                style={btnStyle(!live || cooldown > 0 ? '#9CA3AF' : C.primary)}
                                disabled={!live || cooldown > 0}
                                onClick={e => {
                                  e.stopPropagation()
                                  const amount = parseInt((bidAmounts[pos.key] || '').replace(/[^\d]/g, ''))
                                  if (!amount) { toast.error('Vui lòng nhập số tiền đặt giá'); return }
                                  checkAndBid(amount, () => {
                                    const result = placeBid(pos.key, SHOP_NAME, amount)
                                    if (!result.ok) { toast.error(result.error || 'Không thể đặt giá'); return }
                                    toastBidResult(result.endPriceHit, '✅ Đặt giá thành công!'); setBidAmounts(p => ({ ...p, [pos.key]: '' })); refresh()
                                  })
                                }}>
                                {!live ? '⏳ Chưa bắt đầu' : cooldown > 0 ? `Chờ ${Math.ceil(cooldown / 1000)}s` : '🏹 Đặt giá'}
                              </button>
                            </div>
                          </>
                        )}
                      </>
                    ) : (
                      <p style={{ color: C.gray }}>🔒 Vị trí này đang bị Admin tạm khoá hoặc chưa mở phiên đấu giá.</p>
                    )}
                  </div>

                  {/* ── Phải 3/10 — Mua hết ── */}
                  {session && bs?.advancedEnabled && (
                    <div style={{ flex: 3, flexShrink: 0, borderLeft: '2px solid #FCA5A5', padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 10, background: 'linear-gradient(160deg, #fff5f5 0%, #fff 100%)' }}>
                      <h3 style={{ margin: 0, textAlign: 'center', color: '#DC2626' }}>{pos.label}</h3>
                      <div style={{ textAlign: 'center', fontSize: 10 }}>
                        <span style={{ color: live ? '#DC2626' : '#D97706', fontWeight: 600 }}>{live ? '🔥 Đang mở' : '⏳ Chờ bắt đầu'}</span>
                      </div>

                      <div style={{ borderTop: '1px solid #FCA5A5' }} />

                      {/* Thời gian chờ ÷ 2 */}
                      <div>
                        <div style={{ fontSize: 10, color: '#EF4444', marginBottom: 2 }}>⏳ Thời gian chờ</div>
                        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: 1, color: live ? '#9CA3AF' : '#D97706' }}>
                          {live ? '--:--' : formatCountdown(getWaitMs(session.id, msUntilStart(session)))}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #FCA5A5' }} />

                      {/* Giá + slot */}
                      <div>
                        <div style={{ fontSize: 10, color: '#EF4444', marginBottom: 4 }}>🛒 Giá mua hết</div>
                        <div style={{ fontSize: 22, fontWeight: 700, color: buyPrice ? '#DC2626' : C.gray, lineHeight: 1.2 }}>
                          {buyPrice ? buyPrice.toLocaleString('vi-VN') + 'đ' : '–'}
                        </div>
                      </div>

                      <div style={{ borderTop: '1px solid #FCA5A5' }} />

                      {/* Slot + Danh sách buyers */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <div style={{ fontSize: 24, fontWeight: 800, color: slotsFull ? '#DC2626' : '#F97316', textAlign: 'center' }}>
                          {purchases.length}/{buySlots} slot
                        </div>
                        {purchases.length === 0
                          ? <div style={{ fontSize: 12, color: '#FCA5A5' }}>Chưa có ai mua</div>
                          : purchases.map((p, i) => (
                            <div key={i} style={{ fontSize: 13, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5, color: p.shopName === SHOP_NAME ? '#DC2626' : '#D97706' }}>
                              <span>🛒</span>
                              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.shopName}</span>
                            </div>
                          ))
                        }
                      </div>
                      <button
                        disabled={!live || !buyPrice || hasBoughtNow || slotsFull}
                        onClick={e => {
                          e.stopPropagation()
                          if (!buyPrice) return
                          setBuyNowConfirm({ label: pos.label, price: buyPrice, slots: buySlots, onConfirm: () => { const r = placeBuyNow(pos.key, SHOP_NAME, buyPrice, buySlots); if (!r.ok) { toast.error(r.error || ''); return }; const draft = getBannerDraft(pos.key, SHOP_NAME); createBuyNowTransaction(pos.key, pos.label, SHOP_NAME, buyPrice, draft ? { title: draft.title, link: draft.link, image: draft.image } : undefined); refresh(); refreshFlash(); setBuyNowTxs([...getBuyNowTransactions(SHOP_NAME)]); toast.success('✅ Mua thành công! Banner đang chờ admin duyệt.'); setTab('mytx') } })
                        }}
                        style={{ width: '100%', padding: '8px 0', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 13, cursor: (live && buyPrice && !hasBoughtNow && !slotsFull) ? 'pointer' : 'not-allowed', background: hasBoughtNow ? '#FEE2E2' : slotsFull ? '#FEE2E2' : (live && buyPrice) ? 'linear-gradient(90deg,#EF4444,#F97316)' : '#D1D5DB', color: hasBoughtNow ? '#DC2626' : slotsFull ? '#DC2626' : (live && buyPrice) ? 'white' : '#9CA3AF', marginTop: 'auto' }}>
                        {hasBoughtNow ? '✅ Đã mua' : slotsFull ? '🚫 Hết slot' : '🔥 Mua ngay'}
                      </button>
                    </div>
                  )}

                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Flash Sale Pool tab ───────────────────────────────────────────── */}
      {tab === 'flash' && (() => {
        const s = flashPoolSession
        const live = s && isFlashPoolLive(s)
        const msEnd = s ? flashPoolMsEnd(s) : 0
        const msStart = s ? flashPoolMsStart(s) : 0
        const basePrice = flashPoolSettings.basePrice
        const maxSlots = s ? s.maxSlotsPerShop : flashPoolSettings.maxSlotsPerShop
        const totalSlots = s ? s.totalSlots : flashPoolSettings.totalSlots
        const allocation = s ? computeFlashAlloc(s.bids, s.totalSlots) : []
        const myAlloc = allocation.find(a => a.shopName === SHOP_NAME)
        const slotsFilled = s ? Math.min(s.bids.reduce((acc, b) => acc + b.slotsRequested, 0), s.totalSlots) : 0
        const myExistingBid = s?.bids.find(b => b.shopName === SHOP_NAME)

        const handleBid = () => {
          const amount = parseInt(flashPoolBidAmount.replace(/[^\d]/g, ''))
          if (!amount) { toast.error('Vui lòng nhập giá/slot'); return }
          const total = amount * flashPoolSlots
          checkAndBid(total, () => {
            const r = placeFlashPoolBid(SHOP_NAME, amount, flashPoolSlots)
            if (!r.ok) { toast.error(r.error || 'Không thể đặt giá'); return }
            toast.success(`✅ Đặt giá thành công! ${flashPoolSlots} slot × ${amount.toLocaleString('vi-VN')}đ/slot`)
            setFlashPoolBidAmount(''); refreshPools()
          })
        }

        return (
          <>
            <div style={{ background: C.orangeLight, border: `1px solid ${C.orange}44`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
              <b style={{ color: C.orange }}>⚡ Flash Sale Pool — {totalSlots} slot</b>
              <span style={{ color: C.gray, marginLeft: 8 }}>Đặt giá/slot, xếp cao → thấp, top {totalSlots} slot được chọn. Tối đa {maxSlots} slot/shop.</span>
            </div>

            {s ? (
              <div style={cardStyle}>
                {/* Header + countdown */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                  <div>
                    <h3 style={{ margin: 0, marginBottom: 4 }}>⚡ Flash Sale Trang chủ</h3>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {live
                        ? <span style={{ background: C.orangeLight, color: C.orange, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>🟢 Đang mở</span>
                        : <span style={{ background: 'rgba(251,191,36,0.15)', color: '#92400E', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>⏳ Sắp bắt đầu</span>
                      }
                      <span style={{ background: C.orangeLight, color: C.orange, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{slotsFilled}/{totalSlots} slot đã đặt</span>
                      {myAlloc && <span style={{ background: C.primaryLight, color: C.primary, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>✅ Bạn: {myAlloc.slotsAssigned} slot (#{myAlloc.rank})</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {live
                      ? <><div style={{ fontSize: 20, fontWeight: 700, color: '#DC2626' }}>⏱ {fmtMmSs(msEnd)}</div><div style={{ fontSize: 11, color: C.gray }}>còn lại</div></>
                      : <><div style={{ fontSize: 16, fontWeight: 700, color: '#D97706' }}>⏳ {fmtMmSs(msStart)}</div><div style={{ fontSize: 11, color: C.gray }}>đến khi bắt đầu</div></>
                    }
                  </div>
                </div>

                {(() => { try { return localStorage.getItem('admin_img_flash_pool') } catch { return '' } })() && (
                  <img src={(() => { try { return localStorage.getItem('admin_img_flash_pool') || '' } catch { return '' } })()} alt="Flash Sale"
                    style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 14, display: 'block', border: `1px solid ${C.border}` }} />
                )}
                {!live && s.scheduledStartAt && (
                  <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid #FCD34D', borderRadius: 10, padding: '12px 16px', marginBottom: 14 }}>
                    <p style={{ margin: '0 0 4px', fontWeight: 700, color: '#92400E' }}>⏰ Phiên Flash Sale sắp khai mạc!</p>
                    {s.description && <p style={{ margin: '0 0 4px', fontSize: 13, color: '#78350F' }}>📋 {s.description}</p>}
                    <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>Khai mạc lúc: <b>{new Date(s.scheduledStartAt).toLocaleString('vi-VN')}</b></p>
                  </div>
                )}

                {/* Bid form */}
                {live && (
                  <div style={{ background: 'rgba(234,88,12,0.04)', border: `1px solid ${C.orange}33`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: C.orange, marginBottom: 10 }}>
                      {myExistingBid ? `📝 Cập nhật giá (đang đặt ${myExistingBid.amountPerSlot.toLocaleString('vi-VN')}đ/slot × ${myExistingBid.slotsRequested} slot)` : '💰 Đặt giá Flash Sale'}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, width: '100%' }}>
                        {[0, 50_000, 100_000, 200_000, 500_000].map(extra => {
                          const val = basePrice + extra
                          const formatted = val.toLocaleString('vi-VN')
                          return (
                            <button key={extra} onClick={() => setFlashPoolBidAmount(formatted)}
                              style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${flashPoolBidAmount === formatted ? C.orange : C.border}`, background: flashPoolBidAmount === formatted ? C.orange : 'transparent', color: flashPoolBidAmount === formatted ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                              {extra === 0 ? 'Tối thiểu' : `+${(extra/1000).toFixed(0)}k`} ({val.toLocaleString('vi-VN')}đ)
                            </button>
                          )
                        })}
                      </div>
                      <label style={{ fontSize: 12, color: C.gray, flex: 1, minWidth: 160 }}>
                        Giá/slot (đ) — tối thiểu {basePrice.toLocaleString('vi-VN')}đ
                        <input type="text" value={flashPoolBidAmount}
                          onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setFlashPoolBidAmount(raw ? Number(raw).toLocaleString('vi-VN') : '') }}
                          placeholder={basePrice.toLocaleString('vi-VN')}
                          style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }} />
                      </label>
                      <label style={{ fontSize: 12, color: C.gray }}>
                        Số slot muốn đặt
                        <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                          {Array.from({ length: maxSlots }, (_, i) => i + 1).map(n => (
                            <button key={n} onClick={() => setFlashPoolSlots(n)}
                              style={{ width: 36, height: 36, borderRadius: 8, border: `1px solid ${flashPoolSlots === n ? C.orange : C.border}`, background: flashPoolSlots === n ? C.orange : 'transparent', color: flashPoolSlots === n ? 'white' : C.gray, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                              {n}
                            </button>
                          ))}
                        </div>
                      </label>
                      <button style={{ ...btnStyle(C.orange), padding: '9px 20px' }} onClick={handleBid}>
                        ⚡ {myExistingBid ? 'Cập nhật giá' : 'Đặt giá'}
                      </button>
                    </div>
                    {flashPoolBidAmount && (() => {
                      const total = (parseInt(flashPoolBidAmount.replace(/[^\d]/g,'')) || 0) * flashPoolSlots
                      const w = bidWarnLevel(total)
                      return (
                        <div style={{ marginTop: 8 }}>
                          <div style={{ fontSize: 12, color: C.orange }}>
                            Tổng ước tính: <b>{total.toLocaleString('vi-VN')}đ</b> cho {flashPoolSlots} slot
                          </div>
                          {w && (
                            <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600, color: w === 'blocked' ? '#DC2626' : '#D97706' }}>
                              {w === 'blocked' ? '⛔ Vượt Tiền đấu giá!' : '⚠️ Vượt 70% Tiền đấu giá'}
                            </div>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Leaderboard */}
                <div>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: C.orange }}>📊 Bảng xếp hạng — {s.bids.length} shop đặt giá</p>
                  <div style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                    {allocation.length === 0
                      ? <p style={{ padding: 14, color: C.gray, fontSize: 13, textAlign: 'center' }}>Chưa có ai đặt giá — hãy là người đầu tiên!</p>
                      : allocation.map(a => (
                        <div key={a.rank} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: a.shopName === SHOP_NAME ? C.orangeLight : a.rank === 1 ? 'rgba(234,88,12,0.04)' : 'transparent' }}>
                          <span style={{ fontSize: 13 }}>
                            {a.rank === 1 && '👑 '}
                            <b style={{ color: C.orange }}>#{a.rank}</b> {a.shopName}
                            {a.shopName === SHOP_NAME && <span style={{ background: C.orangeLight, color: C.orange, borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>Bạn</span>}
                          </span>
                          <span style={{ fontSize: 12, color: C.gray, textAlign: 'right' }}>
                            {a.amountPerSlot.toLocaleString('vi-VN')}đ/slot × {a.slotsAssigned} slot
                            <br />
                            <span style={{ color: C.orange, fontWeight: 700 }}>Slot {a.slotNumbers.slice(0, 3).map(n => `#${n}`).join(', ')}{a.slotNumbers.length > 3 ? '...' : ''}</span>
                          </span>
                        </div>
                      ))
                    }
                    {s.bids.reduce((acc, b) => acc + b.slotsRequested, 0) < s.totalSlots && (
                      <div style={{ padding: '8px 14px', fontSize: 12, color: C.gray, textAlign: 'center' }}>
                        Còn <b style={{ color: C.orange }}>{s.totalSlots - Math.min(s.bids.reduce((acc, b) => acc + b.slotsRequested, 0), s.totalSlots)}</b> slot trống
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div style={cardStyle}>
                <p style={{ color: C.gray }}>🔒 Admin chưa mở phiên đấu giá Flash Sale. Vui lòng quay lại sau.</p>
              </div>
            )}
          </>
        )
      })()}

      {/* ── Vị trí Top tab (10 named positions) ──────────────────────────── */}
      {tab === 'top' && (() => {
        const slotDef = TOP_SLOTS.find(s => s.key === selectedTopSlot) ?? TOP_SLOTS[0]
        const session = topSessions[selectedTopSlot] ?? null
        const settings = topAdminSettings[selectedTopSlot]
        const basePrice = settings?.basePrice ?? slotDef.basePrice
        const live = session ? isTopLive(session) : false
        const msEnd = session ? msUntilTopEnd(session) : 0
        const msStart = session ? msUntilTopStart(session) : 0
        const myBid = session?.bids.find(b => b.shopName === SHOP_NAME)
        const minNext = getTopMinNextBid(selectedTopSlot)
        const bidVal = topBidAmounts[selectedTopSlot] ?? ''
        const openSlots = TOP_SLOTS.filter(s => !!topSessions[s.key])

        const handleBid = () => {
          const amount = parseInt(bidVal.replace(/[^\d]/g, ''))
          if (!amount) { toast.error('Vui lòng nhập giá đấu'); return }
          checkAndBid(amount, () => {
            const r = placeTopBid(selectedTopSlot, SHOP_NAME, '(sản phẩm sẽ xác nhận sau)', amount)
            if (!r.ok) { toast.error(r.error || 'Không thể đặt giá'); return }
            toastBidResult(r.endPriceHit, `✅ Đặt giá thành công! ${amount.toLocaleString('vi-VN')}đ cho ${slotDef.label}`)
            setTopBidAmounts(prev => ({ ...prev, [selectedTopSlot]: '' }))
            refreshPools()
          })
        }

        return (
          <>
            <div style={{ background: C.purpleLight, border: `1px solid ${C.purple}44`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
              <b style={{ color: C.purple }}>🏆 Vị trí Top Trang chủ — 10 vị trí ưu tiên</b>
              <span style={{ color: C.gray, marginLeft: 8 }}>Chọn vị trí và đặt giá. Shop trả giá cao nhất thắng vị trí đó.</span>
            </div>

            {/* Slot grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8, marginBottom: 16 }}>
              {TOP_SLOTS.map(sl => {
                const isOpen = !!topSessions[sl.key]
                const isSel = sl.key === selectedTopSlot
                return (
                  <button key={sl.key} onClick={() => setSelectedTopSlot(sl.key)}
                    style={{ padding: '10px 8px', borderRadius: 10, border: `2px solid ${isSel ? C.purple : isOpen ? C.purple + '55' : C.border}`, background: isSel ? C.purple : isOpen ? C.purpleLight : C.cardBg, color: isSel ? 'white' : isOpen ? C.purple : C.gray, fontWeight: isSel ? 700 : 400, fontSize: 12, cursor: 'pointer', textAlign: 'center' }}>
                    <div style={{ fontSize: 14, marginBottom: 2 }}>{sl.label}</div>
                    <div style={{ fontSize: 10, opacity: 0.8 }}>{isOpen ? '🟢 Đang mở' : '⏸ Chưa mở'}</div>
                  </button>
                )
              })}
            </div>

            {/* Selected slot detail */}
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: '0 0 4px' }}>🏆 {slotDef.label}</h3>
                  <p style={{ margin: 0, fontSize: 12, color: C.gray }}>{slotDef.description}</p>
                </div>
                {session && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    {live
                      ? <><div style={{ fontSize: 20, fontWeight: 700, color: '#DC2626' }}>⏱ {fmtMmSs(msEnd)}</div><div style={{ fontSize: 11, color: C.gray }}>còn lại</div></>
                      : <><div style={{ fontSize: 16, fontWeight: 700, color: '#D97706' }}>⏳ {fmtMmSs(msStart)}</div><div style={{ fontSize: 11, color: C.gray }}>đến khi bắt đầu</div></>
                    }
                  </div>
                )}
              </div>

              {adminPreviews[selectedTopSlot] && (
                <img src={adminPreviews[selectedTopSlot]} alt={slotDef.label}
                  style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, marginBottom: 14, display: 'block', border: `1px solid ${C.border}` }} />
              )}
              {session ? (
                <>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {live
                      ? <span style={{ background: C.purpleLight, color: C.purple, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>🟢 Đang mở</span>
                      : <span style={{ background: 'rgba(251,191,36,0.15)', color: '#92400E', borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>⏳ Sắp bắt đầu</span>
                    }
                    <span style={{ background: C.purpleLight, color: C.purple, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>{session.bids.length} shop đặt giá</span>
                    {myBid && <span style={{ background: C.primaryLight, color: C.primary, borderRadius: 999, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>✅ Bạn đang đặt {myBid.amount.toLocaleString('vi-VN')}đ</span>}
                  </div>

                  {!live && session.scheduledStartAt && (
                    <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid #FCD34D', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
                      <p style={{ margin: 0, fontWeight: 700, color: '#92400E' }}>⏰ Khai mạc lúc: {new Date(session.scheduledStartAt).toLocaleString('vi-VN')}</p>
                      {session.description && <p style={{ margin: '4px 0 0', fontSize: 12, color: '#78350F' }}>📋 {session.description}</p>}
                    </div>
                  )}

                  {live && (
                    <div style={{ background: 'rgba(124,58,237,0.04)', border: `1px solid ${C.purple}33`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: C.purple, marginBottom: 10 }}>
                        {myBid ? `📝 Cập nhật giá (đang: ${myBid.amount.toLocaleString('vi-VN')}đ)` : '💰 Đặt giá'}
                      </div>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                        <label style={{ fontSize: 12, color: C.gray, flex: 1, minWidth: 180 }}>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8, width: '100%' }}>
                          {(() => {
                            const raw = minNext / 10
                            const mag = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1))))
                            const niceStep = Math.round(raw / mag) * mag || mag
                            const firstVal = Math.ceil((minNext + 1) / niceStep) * niceStep
                            const presets = [minNext, firstVal, firstVal + niceStep, firstVal + 2 * niceStep, firstVal + 3 * niceStep, firstVal + 4 * niceStep]
                            return presets.map((val, i) => {
                              const formatted = val.toLocaleString('vi-VN')
                              return (
                                <button key={i} onClick={() => setTopBidAmounts(prev => ({ ...prev, [selectedTopSlot]: formatted }))}
                                  style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${bidVal === formatted ? C.purple : C.border}`, background: bidVal === formatted ? C.purple : 'transparent', color: bidVal === formatted ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                                  {i === 0 ? 'Tối thiểu' : val.toLocaleString('vi-VN')}đ
                                </button>
                              )
                            })
                          })()}
                        </div>
                          Giá đặt (đ) — tối thiểu {minNext.toLocaleString('vi-VN')}đ
                          <input type="text" value={bidVal}
                            onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setTopBidAmounts(prev => ({ ...prev, [selectedTopSlot]: raw ? Number(raw).toLocaleString('vi-VN') : '' })) }}
                            placeholder={minNext.toLocaleString('vi-VN')}
                            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${bidWarnLevel(parseInt(bidVal.replace(/[^\d]/g,''))) === 'blocked' ? '#DC2626' : bidWarnLevel(parseInt(bidVal.replace(/[^\d]/g,''))) === 'over70' ? '#D97706' : C.border}`, borderRadius: 8, fontSize: 14 }} />
                          {(() => { const w = bidWarnLevel(parseInt(bidVal.replace(/[^\d]/g,''))); return w ? (
                            <div style={{ fontSize: 11, marginTop: 3, fontWeight: 600, color: w === 'blocked' ? '#DC2626' : '#D97706' }}>
                              {w === 'blocked' ? '⛔ Vượt Tiền đấu giá!' : '⚠️ Vượt 70% Tiền đấu giá'}
                            </div>
                          ) : null })()}
                        </label>
                        <button style={{ ...btnStyle(C.purple), padding: '9px 20px' }} onClick={handleBid}>
                          🏆 {myBid ? 'Cập nhật giá' : 'Đặt giá'}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Bids list */}
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: C.purple }}>📊 Danh sách đặt giá</p>
                    <div style={{ maxHeight: 240, overflowY: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                      {session.bids.length === 0
                        ? <p style={{ padding: 14, color: C.gray, fontSize: 13, textAlign: 'center' }}>Chưa có ai đặt giá — hãy là người đầu tiên!</p>
                        : [...session.bids].sort((a, b) => b.amount - a.amount).map((bid, i) => (
                          <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: bid.shopName === SHOP_NAME ? C.purpleLight : i === 0 ? 'rgba(124,58,237,0.04)' : 'transparent' }}>
                            <span style={{ fontSize: 13 }}>
                              {i === 0 && '👑 '}
                              <b style={{ color: C.purple }}>#{i + 1}</b> {bid.shopName}
                              {bid.shopName === SHOP_NAME && <span style={{ background: C.purpleLight, color: C.purple, borderRadius: 999, padding: '1px 8px', fontSize: 11, fontWeight: 700, marginLeft: 6 }}>Bạn</span>}
                            </span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? C.purple : undefined }}>{bid.amount.toLocaleString('vi-VN')}đ</span>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                </>
              ) : (
                <p style={{ color: C.gray, fontSize: 13 }}>🔒 Admin chưa mở phiên đấu giá cho vị trí này. Vui lòng quay lại sau.</p>
              )}
            </div>
          </>
        )
      })()}

      {tab === 'mytx' && (() => {
        // Một bảng duy nhất: gộp đấu giá + mua ngay
        type TxRow = {
          id: string; kind: 'banner' | 'flash' | 'buynow'; label: string
          startedAt: string; myBids: number; myTopBid: number
          isWinner: boolean; confirmation?: string; amount?: number
          depositAmount?: number; subStatus?: string; rejectCount?: number; subId?: string
          // Buy-now fields
          isBuyNow?: boolean; bnTxId?: string; bnPosition?: BannerPositionKey
        }
        const rows: TxRow[] = []

        // ── Buy-now transactions (từ store mới) ──────────────────────────────
        buyNowTxs.forEach(tx => {
          rows.push({
            id: 'bn-' + tx.id,
            kind: 'buynow',
            label: tx.positionLabel,
            startedAt: tx.purchasedAt,
            myBids: 0, myTopBid: 0,
            isWinner: true,
            confirmation: 'paid',
            amount: tx.price,
            isBuyNow: true,
            bnTxId: tx.id,
            bnPosition: tx.position,
            subStatus: tx.status,
            rejectCount: tx.rejectCount,
          })
        })

        // ── Banner bid-based rows ─────────────────────────────────────────────
        bannerHistory.forEach(h => {
          const myBids = h.bids.filter(b => b.shopName === SHOP_NAME)
          if (myBids.length === 0) return
          const myTopBid = Math.max(...myBids.map(b => b.amount))
          const isWinner = h.winner?.shopName === SHOP_NAME
          const sub = isWinner ? getSubmissionByHistoryId(h.id) : undefined
          rows.push({
            id: h.id, kind: 'banner',
            label: BANNER_POSITIONS.find(p => p.key === h.position)?.label ?? h.position,
            startedAt: h.startedAt, myBids: myBids.length, myTopBid,
            isWinner, confirmation: h.confirmation, amount: h.winner?.amount,
            depositAmount: h.depositAmount, subStatus: sub?.status,
            rejectCount: (sub as any)?.rejectCount, subId: sub?.id,
          })
        })

        // Flash history
        flashHistory.forEach(h => {
          const myBids = h.bids.filter(b => b.shopName === SHOP_NAME)
          if (myBids.length === 0) return
          const myTopBid = Math.max(...myBids.map(b => b.amount))
          const isWinner = h.winner?.shopName === SHOP_NAME
          const sub = isWinner ? getFlashSubmissionByHistoryId(h.id) : undefined
          rows.push({
            id: h.id, kind: 'flash',
            label: FLASH_SLOTS.find(s => s.key === h.slot)?.label ?? h.slot,
            startedAt: h.startedAt, myBids: myBids.length, myTopBid,
            isWinner, confirmation: h.confirmation, amount: h.winner?.amount,
            depositAmount: h.depositAmount, subStatus: sub?.status,
            rejectCount: (sub as any)?.rejectCount, subId: sub?.id,
          })
        })

        // (Buy-now không còn trong bảng đấu giá — xem bảng riêng bên dưới)

        rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt))

        const statusColor = (r: TxRow) => {
          if (r.isBuyNow) return { color: C.primary, bg: C.primaryLight, label: '✅ Đã thanh toán đủ' }
          if (!r.isWinner) return { color: C.gray, bg: 'rgba(156,163,175,0.12)', label: '❌ Thua' }
          if (r.confirmation === 'paid') return { color: C.primary, bg: C.primaryLight, label: '✅ Đã thanh toán đủ' }
          if (r.confirmation === 'expired' || r.confirmation === 'declined') return { color: '#DC2626', bg: 'rgba(220,38,38,0.1)', label: '⚠️ Hết hạn/Từ chối' }
          if (r.confirmation === 'deposit_paid') return { color: C.blue, bg: C.blueLight, label: '💰 Đã cọc — chờ TT đủ' }
          if ((r.confirmation as string) === 'deposit_cancelled') return { color: '#DC2626', bg: 'rgba(220,38,38,0.08)', label: '🚫 Đã hủy cọc' }
          return { color: C.orange, bg: C.orangeLight, label: '⏳ Chờ xác nhận' }
        }

        return (
          <div>
            {rows.length === 0
              ? <div style={cardStyle}><p style={{ color: C.gray }}>Bạn chưa tham giá phiên đấu giá nào.</p></div>
              : <>
                  {/* Summary */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
                    {[
                      { label: 'Tổng phiên tham giá', value: rows.length, color: C.blue, bg: C.blueLight },
                      { label: 'Số phiên thắng', value: rows.filter(r => r.isWinner).length, color: C.primary, bg: C.primaryLight },
                      { label: 'Tổng đã đặt giá', value: rows.reduce((s, r) => s + r.myBids, 0) + ' lượt', color: C.purple, bg: C.purpleLight },
                      { label: 'Tổng tiền thắng (đ)', value: rows.filter(r => r.isWinner && r.confirmation === 'paid').reduce((s, r) => s + (r.amount || 0), 0).toLocaleString('vi-VN'), color: C.orange, bg: C.orangeLight },
                    ].map(s => (
                      <div key={s.label} style={{ background: s.bg, border: `1px solid ${C.border}`, borderRadius: 10, padding: '14px 16px', textAlign: 'center' }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color: s.color }}>{s.value}</div>
                        <div style={{ fontSize: 11, color: s.color, marginTop: 2 }}>{s.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Table */}
                  <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', padding: '10px 14px', background: C.primaryLight, fontSize: 12, fontWeight: 700, color: C.primary, textAlign: 'center' }}>
                      <span>Vị trí / Loại</span><span>Ngày</span><span>Giá thắng</span><span>Lần sửa</span><span>Trạng thái</span><span>Hành động</span>
                    </div>
                    {rows.map((r, i) => {
                      const st = statusColor(r)
                      const remaining = (r.amount ?? 0) - (r.depositAmount ?? 0)
                      // Buy-now: badge theo trạng thái duyệt banner
                      const tx = r.isBuyNow ? buyNowTxs.find(t => t.id === r.bnTxId) : null
                      return (
                        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', padding: '10px 14px', borderTop: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)', alignItems: 'center', justifyItems: 'center', gap: 4, textAlign: 'center' }}>
                          <div style={{ fontSize: 13 }}>
                            {r.label}
                            {r.isBuyNow
                              ? <div style={{ fontSize: 10, color: '#DC2626', fontWeight: 600 }}>🛒 Mua ngay</div>
                              : <div style={{ fontSize: 10, color: C.blue, fontWeight: 600 }}>Đấu giá</div>
                            }
                          </div>
                          <span style={{ fontSize: 12, color: C.gray }}>{new Date(r.startedAt).toLocaleDateString('vi-VN')}</span>
                          <div style={{ fontSize: 12 }}>
                            {r.isBuyNow ? (
                              <span style={{ color: C.primary, fontWeight: 700 }}>✅ Đã thanh toán đủ</span>
                            ) : r.isWinner && r.confirmation === 'deposit_paid' ? (
                              <>
                                <div style={{ fontWeight: 600, color: C.blue }}>Cọc: {(r.depositAmount ?? 0).toLocaleString('vi-VN')}đ</div>
                                <div style={{ color: C.orange, fontSize: 11, fontWeight: 600 }}>Còn lại: {remaining.toLocaleString('vi-VN')}đ</div>
                              </>
                            ) : (
                              <div style={{ fontWeight: 600 }}>
                                {r.isWinner
                                  ? (r.amount ?? 0).toLocaleString('vi-VN') + 'đ'
                                  : r.myTopBid.toLocaleString('vi-VN') + 'đ'
                                }
                              </div>
                            )}
                          </div>
                          <span style={{ fontSize: 13 }}>
                            {r.isBuyNow
                              ? `${r.rejectCount ?? 0}/${MAX_BUYNOW_REVISIONS} lần`
                              : r.isWinner ? `${r.rejectCount ?? 0}/3 lần` : '—'
                            }
                          </span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {r.isBuyNow
                              ? <span style={badgeStyle(C.primary, C.primaryLight)}>✅ Đã thanh toán đủ</span>
                              : <span style={badgeStyle(st.color, st.bg)}>{st.label}</span>
                            }
                            {/* Countdown thanh toán đấu giá (không phải mua ngay) */}
                            {!r.isBuyNow && r.confirmation === 'deposit_paid' && (() => {
                              const sub = r.kind === 'banner'
                                ? getAllBannerSubmissions().find(s => s.historyId === r.id)
                                : getAllFlashSubmissions().find(s => s.historyId === r.id)

                              // Chưa có deadline → đang chờ admin duyệt banner
                              if (!sub?.paymentDeadline) {
                                return (
                                  <span style={{ fontSize: 10, color: C.gray, fontStyle: 'italic' }}>
                                    ⏱ Timer sau khi admin duyệt
                                  </span>
                                )
                              }

                              const remMs = payCountdowns[sub.id] ?? Math.max(0, new Date(sub.paymentDeadline).getTime() - Date.now())
                              const urgent = remMs > 0 && remMs <= 5 * 60 * 1000

                              if (remMs <= 0) return (
                                <span style={{ fontSize: 11, color: '#DC2626', fontWeight: 700 }}>❌ Hết hạn TT</span>
                              )
                              return (
                                <span style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 4,
                                  background: urgent ? 'rgba(220,38,38,0.12)' : 'rgba(37,99,235,0.1)',
                                  color: urgent ? '#DC2626' : C.blue,
                                  borderRadius: 6, padding: '3px 8px', fontSize: 12, fontWeight: 800,
                                  border: `1px solid ${urgent ? 'rgba(220,38,38,0.3)' : 'rgba(37,99,235,0.2)'}`,
                                }}>
                                  {urgent ? '🚨' : '⏳'} {fmtMmSs(remMs)}
                                </span>
                              )
                            })()}
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {/* ── Buy-now actions (từ store mới) ── */}
                            {r.isBuyNow && r.subStatus === 'pending_review' && (
                              <span style={{ fontSize: 12, color: C.blue, fontStyle: 'italic' }}>⏳ Chờ duyệt...</span>
                            )}
                            {r.isBuyNow && r.subStatus === 'approved' && (
                              <span style={{ fontSize: 12, color: C.primary }}>✅ Banner đang chạy</span>
                            )}
                            {r.isBuyNow && r.subStatus === 'awaiting_edit' && tx && !bnResubmitReadyIds.has(tx.id) && (
                              <button
                                onClick={() => goToPreparePos(tx.position)}
                                style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                ✏️ Đợi sửa ({r.rejectCount}/{MAX_BUYNOW_REVISIONS}) — Sửa ngay
                              </button>
                            )}
                            {r.isBuyNow && r.subStatus === 'awaiting_edit' && tx && bnResubmitReadyIds.has(tx.id) && (
                              <button
                                onClick={async () => {
                                  const draft = getBannerDraft(tx.position, SHOP_NAME)
                                  if (!draft?.image) { toast.error('Vui lòng lưu mẫu có ảnh trước.'); return }
                                  const { idbSave, isIDBRef } = await import('../../utils/imageDB')
                                  const imgRef = isIDBRef(draft.image) ? draft.image : await idbSave(draft.image)
                                  const ok = submitBuyNowBanner(tx.id, { title: draft.title, link: draft.link ?? undefined, image: imgRef })
                                  if (!ok) { toast.error('Không thể nộp lại — vui lòng thử lại.'); return }
                                  setBnResubmitReadyIds(prev => { const n = new Set(prev); n.delete(tx.id); return n })
                                  setBuyNowTxs([...getBuyNowTransactions(SHOP_NAME)])
                                  toast.success('📤 Đã nộp lại cho Admin duyệt!')
                                }}
                                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                📤 Nộp lại
                              </button>
                            )}
                            {r.isBuyNow && r.subStatus === 'rejected' && (
                              <span style={badgeStyle('#DC2626', 'rgba(220,38,38,0.1)')}>❌ Từ chối vĩnh viễn</span>
                            )}
                            {/* ── Auction bid-win actions ── */}
                            {!r.isBuyNow && r.confirmation === 'deposit_paid' && (
                              <button
                                onClick={() => setCancelDepositModal({ id: r.id, kind: r.kind as 'banner' | 'flash' })}
                                style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                🚫 Hủy cọc
                              </button>
                            )}
                            {!r.isBuyNow && r.confirmation === 'deposit_paid' && r.subStatus === 'approved' && (
                              <button style={{ ...btnStyle(C.blue), fontSize: 11, padding: '5px 10px' }}
                                onClick={() => {
                                  const ok = r.kind === 'banner' ? payWin(r.id) : payFlashWin(r.id)
                                  if (ok) { deductWallet(remaining, `Thanh toán đủ đấu giá — ${r.kind === 'banner' ? 'Banner' : 'Flash Sale'}`); refresh(); refreshFlash(); toast.success('💳 Thanh toán đủ thành công!') }
                                }}>
                                💳 TT đủ ({remaining.toLocaleString('vi-VN')}đ)
                              </button>
                            )}
                            {!r.isBuyNow && r.confirmation === 'deposit_paid' && !r.subStatus && (
                              <button style={{ ...btnStyle(C.purple), fontSize: 11, padding: '5px 10px' }}
                                onClick={() => {
                                  const session = [...bannerHistory, ...flashHistory].find(h => h.id === r.id)
                                  if (!session) return
                                  openSubmitModal(r.kind === 'banner'
                                    ? { kind: 'banner', session: session as BannerAuctionSession }
                                    : { kind: 'flash', session: session as FlashAuctionSession })
                                }}>
                                {r.kind === 'banner' ? '📢 Đăng banner' : '📦 Đăng SP'}
                              </button>
                            )}
                            {!r.isBuyNow && r.subStatus === 'approved' && <span style={badgeStyle(C.primary, C.primaryLight)}>✅ Đã duyệt</span>}
                            {!r.isBuyNow && r.subStatus === 'pending' && <span style={badgeStyle(C.orange, C.orangeLight)}>⏳ Chờ duyệt</span>}
                            {!r.isBuyNow && r.subStatus === 'awaiting_edit' && !resubmitReadyIds.has(r.id) && (
                              <button
                                onClick={() => {
                                  const sub = r.kind === 'banner' ? getSubmissionByHistoryId(r.id) : undefined
                                  const posKey = (sub as any)?.position as string | undefined
                                  if (posKey) goToPreparePos(posKey)
                                }}
                                style={{ background: 'rgba(124,58,237,0.1)', color: '#7C3AED', border: '1px solid rgba(124,58,237,0.3)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                ✏️ Đợi sửa ({r.rejectCount ?? 0}/3) — Sửa ngay
                              </button>
                            )}
                            {!r.isBuyNow && r.subStatus === 'awaiting_edit' && resubmitReadyIds.has(r.id) && (
                              <button
                                onClick={() => {
                                  const sub = r.kind === 'banner' ? getSubmissionByHistoryId(r.id) : undefined
                                  if (!sub) return
                                  resubmitSubmission(sub.id)
                                  setResubmitReadyIds(prev => { const n = new Set(prev); n.delete(r.id); return n })
                                  refresh()
                                  toast.success('📢 Đã nộp lại banner cho Admin duyệt!')
                                }}
                                style={{ background: 'rgba(22,163,74,0.1)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.3)', borderRadius: 8, padding: '3px 10px', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                                📤 Nộp lại
                              </button>
                            )}
                            {!r.isBuyNow && r.subStatus === 'rejected' && <span style={badgeStyle('#DC2626', 'rgba(220,38,38,0.1)')}>❌ Từ chối vĩnh viễn</span>}
                            {!r.isBuyNow && (r.confirmation as string) === 'deposit_cancelled' && (
                              <span style={badgeStyle('#DC2626', 'rgba(220,38,38,0.08)')}>🚫 Đã hủy cọc</span>
                            )}
                            {!r.isBuyNow && (!r.confirmation || (!['deposit_paid', 'deposit_cancelled'].includes(r.confirmation) && !r.subStatus)) ? <span style={{ color: C.gray, fontSize: 12 }}>–</span> : null}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </>
            }
          </div>
        )
      })()}

      {/* ── Tab: Chuẩn bị mẫu ───────────────────────────────────────────── */}
      {tab === 'prepare' && (
        <div>
          <p style={{ color: C.gray, fontSize: 13, marginBottom: 16 }}>
            Chuẩn bị mẫu <b>trước khi đặt giá</b>. Khi đặt cọc thành công, mẫu sẽ tự động gửi Admin duyệt.
          </p>

          {/* Sub-tabs */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
            {([
              ['banner', '🖼️ Banner'],
              ['flash',  '⚡ Flash Sale'],
              ['top',    '🏆 Vị trí Top'],
            ] as const).map(([t, label]) => (
              <button key={t} onClick={() => setPrepTab(t)}
                style={{ ...btnStyle(prepTab === t ? C.primary : 'transparent', prepTab === t ? 'white' : C.gray), border: `1px solid ${prepTab === t ? C.primary : C.border}`, fontSize: 13 }}>
                {label}
              </button>
            ))}
          </div>

          {/* ── Banner mẫu — hiện cả 3 vị trí cùng lúc ──────────────────── */}
          {prepTab === 'banner' && BANNER_POSITIONS.map(p => {
            const posKey = p.key
            const spec = BANNER_IMAGE_SPECS[posKey]
            const form = prepBannerForms[posKey] ?? { title: '', link: '', image: '' }
            const imgErr = prepBannerImgErr[posKey] ?? ''
            const draft = getBannerDraft(posKey, SHOP_NAME)
            const isHighlighted = highlightPrepPos === posKey
            return (
              <div key={posKey} id={'prep-pos-' + posKey} style={{ ...cardStyle, transition: 'box-shadow 0.3s, outline 0.3s', outline: isHighlighted ? '2.5px solid #7C3AED' : '2.5px solid transparent', boxShadow: isHighlighted ? '0 0 0 4px rgba(124,58,237,0.18)' : (cardStyle as any).boxShadow }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>
                  🖼️ {p.label}
                  {bannerDraftsExist[posKey] && <span style={{ marginLeft: 8, fontSize: 12, color: C.primary, fontWeight: 400 }}>✅ Đã có mẫu</span>}
                </h3>
                <p style={{ fontSize: 12, color: C.blue, background: C.blueLight, padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
                  📐 Tỉ lệ <b>{spec.ratioLabel}</b> — {spec.recommendedW}×{spec.recommendedH}px — tối đa {spec.maxKB.toLocaleString()}KB
                </p>
                {draft && (
                  <div style={{ background: C.primaryLight, border: `1px solid ${C.primary}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12 }}>
                    ✅ Mẫu hiện tại: <b>{draft.title}</b> — cập nhật {new Date(draft.updatedAt).toLocaleString('vi-VN')}
                    {(prepBannerResolvedImgs[posKey] || draft.image) && <img src={prepBannerResolvedImgs[posKey] || draft.image} alt="draft" style={{ display: 'block', marginTop: 8, maxWidth: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 6 }} />}
                  </div>
                )}
                {prepBannerSaved[posKey] ? (
                  /* ── Đã lưu: ẩn form, chỉ hiện nút Chỉnh sửa ── */
                  <button style={{ ...btnStyle('transparent', C.primary), border: `1px solid ${C.primary}` }}
                    onClick={() => {
                      if (draft) {
                        setPrepBannerForms(f => ({ ...f, [posKey]: { title: draft.title, link: draft.link ?? '', image: draft.image } }))
                        if (prepBannerResolvedImgs[posKey]) {
                          setBannerPreview(prev => ({ ...prev, [posKey]: prepBannerResolvedImgs[posKey] }))
                        }
                      }
                      setPrepBannerSaved(prev => ({ ...prev, [posKey]: false }))
                    }}>
                    ✏️ Chỉnh sửa
                  </button>
                ) : (
                  /* ── Chưa lưu / đang chỉnh sửa: hiện toàn bộ form ── */
                  <>
                    <input placeholder="Tiêu đề banner *" value={form.title}
                      onChange={e => {
                        setPrepBannerForms(f => ({ ...f, [posKey]: { ...(f[posKey] ?? { title: '', link: '', image: '' }), title: e.target.value } }))
                        setPrepBannerSaved(prev => ({ ...prev, [posKey]: false }))
                      }}
                      style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }} />
                    <div style={{ marginBottom: 10 }}>
                      <input placeholder="Đường dẫn khi click (tuỳ chọn)" value={form.link}
                        onChange={e => setPrepBannerForms(f => ({ ...f, [posKey]: { ...(f[posKey] ?? { title: '', link: '', image: '' }), link: e.target.value } }))}
                        style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, boxSizing: 'border-box', marginBottom: 6 }} />
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button"
                          onClick={() => setPrepBannerForms(f => ({ ...f, [posKey]: { ...(f[posKey] ?? { title: '', link: '', image: '' }), link: `/shops/${encodeURIComponent(SHOP_NAME)}` } }))}
                          style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.blue}`, background: C.blueLight, color: C.blue, cursor: 'pointer', fontWeight: 600 }}>
                          🏪 Gắn link trang cửa hàng của tôi
                        </button>
                        {form.link && (
                          <button type="button"
                            onClick={() => setPrepBannerForms(f => ({ ...f, [posKey]: { ...(f[posKey] ?? { title: '', link: '', image: '' }), link: '' } }))}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: `1px solid ${C.border}`, background: 'transparent', color: C.gray, cursor: 'pointer' }}>
                            ✕ Xoá link
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ marginBottom: 14 }}>
                      <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>
                        Ảnh banner{draft ? '' : ' *'}
                      </label>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                        <input type="file" accept="image/*" id={`banner-pick-${posKey}`} style={{ display: 'none' }}
                          onChange={async e => {
                            const file = e.target.files?.[0]; if (!file) return
                            const previewUrl = URL.createObjectURL(file)
                            setPrepBannerImgErr(prev => ({ ...prev, [posKey]: '' }))
                            setPrepBannerSaved(prev => ({ ...prev, [posKey]: false }))
                            setBannerPreview(prev => ({ ...prev, [posKey]: previewUrl }))
                            try {
                              const { idbSave } = await import('../../utils/imageDB')
                              const dataUrl = await new Promise<string>((res, rej) => {
                                const reader = new FileReader()
                                reader.onload = () => res(reader.result as string)
                                reader.onerror = rej
                                reader.readAsDataURL(file)
                              })
                              const imageRef = await idbSave(dataUrl)
                              setPrepBannerForms(f => ({ ...f, [posKey]: { ...(f[posKey] ?? { title: '', link: '', image: '' }), image: imageRef } }))
                            } catch {
                              toast.error('Không thể lưu ảnh, vui lòng thử lại')
                            }
                          }} />
                        <button type="button"
                          onClick={() => document.getElementById(`banner-pick-${posKey}`)?.click()}
                          style={{ padding: '7px 14px', background: C.blueLight, color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          📂 Chọn ảnh banner
                        </button>
                        {form.image && !form.image.startsWith('idb:') && <span style={{ fontSize: 12, color: C.gray }}>{form.image}</span>}
                        {form.image && form.image.startsWith('idb:') && <span style={{ fontSize: 12, color: C.primary }}>✅ Đã lưu ảnh</span>}
                      </div>
                      {imgErr && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>{imgErr}</p>}
                      {(bannerPreview[posKey] || prepBannerResolvedImgs[posKey] || form.image || draft?.image) && (
                        <img
                          src={bannerPreview[posKey] || prepBannerResolvedImgs[posKey] || form.image || draft?.image}
                          alt="preview"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; setPrepBannerImgErr(prev => ({ ...prev, [posKey]: '⚠️ Không tìm thấy file trong public/img/banner/ — kiểm tra lại tên.' })) }}
                          style={{ marginTop: 8, maxWidth: '100%', maxHeight: 140, borderRadius: 8, border: `1px solid ${C.border}`, display: 'block' }} />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        if (!form.title.trim()) { toast.error('Vui lòng nhập tiêu đề banner'); return }
                        if (!form.image && !draft?.image) { toast.error('Vui lòng chọn ảnh banner'); return }
                        if (imgErr && !imgErr.startsWith('⚠️')) { toast.error(imgErr); return }
                        saveBannerDraft({ position: posKey, shopName: SHOP_NAME, title: form.title.trim(), link: form.link.trim() || undefined, image: form.image || draft!.image, updatedAt: new Date().toISOString() })
                        setPrepBannerSaved(prev => ({ ...prev, [posKey]: true }))
                        checkDrafts()
                        // Nếu đến từ flow "Đợi sửa" → đánh dấu sẵn sàng nộp lại + về Giao dịch
                        if (highlightPrepPos === posKey) {
                          // Kiểm tra buy-now awaiting_edit trước
                          const bnAwaiting = buyNowTxs.find(
                            t => t.position === posKey && t.status === 'awaiting_edit' && t.shopName === SHOP_NAME
                          )
                          if (bnAwaiting) {
                            setBnResubmitReadyIds(prev => new Set([...prev, bnAwaiting.id]))
                            setHighlightPrepPos(null)
                            setTab('mytx')
                            toast.success(`✅ Đã lưu! Bấm "Nộp lại" trong Giao dịch để gửi admin duyệt.`)
                            return
                          }
                          // Kiểm tra auction awaiting_edit
                          const awaitingSub = getAllBannerSubmissions().find(
                            s => s.position === posKey && s.status === 'awaiting_edit' && s.shopName === SHOP_NAME
                          )
                          if (awaitingSub) {
                            setResubmitReadyIds(prev => new Set([...prev, awaitingSub.historyId]))
                            setHighlightPrepPos(null)
                            setTab('mytx')
                            toast.success(`✅ Đã lưu! Bấm "Nộp lại" trong Giao dịch để gửi admin duyệt.`)
                            return
                          }
                        }
                        toast.success(`✅ Đã lưu mẫu ${p.label}!`)
                      }}
                      style={btnStyle(C.primary)}>
                      💾 Lưu mẫu banner
                    </button>
                  </>
                )}
              </div>
            )
          })}

          {/* ── Flash Sale — danh sách 20 sản phẩm ──────────────────────── */}
          {prepTab === 'flash' && (() => {
            const maxSlots = flashPoolSettings.maxSlotsPerShop ?? 5
            const savedCount = flashProductSaved.filter(Boolean).length
            return (
              <div>
                {/* Info banner */}
                <div style={{ background: C.orangeLight, border: `1px solid ${C.orange}44`, borderRadius: 10, padding: '12px 16px', marginBottom: 16, fontSize: 13 }}>
                  <b style={{ color: C.orange }}>⚡ Danh sách sản phẩm Flash Sale — tối đa {FLASH_PRODUCT_MAX} sản phẩm</b>
                  <div style={{ color: C.gray, marginTop: 4 }}>
                    Admin đang cho phép tối đa <b style={{ color: C.orange }}>{maxSlots} slot/shop</b>. Khi thắng đấu giá, hệ thống sẽ lấy <b>{maxSlots} sản phẩm đầu tiên</b> trong danh sách này.
                  </div>
                  <div style={{ marginTop: 6, fontSize: 12 }}>
                    ✅ Đã chuẩn bị: <b style={{ color: C.orange }}>{savedCount}/{FLASH_PRODUCT_MAX}</b> sản phẩm
                    {savedCount >= maxSlots && <span style={{ color: C.primary, marginLeft: 8 }}>🎯 Đủ {maxSlots} slot!</span>}
                    {savedCount > 0 && savedCount < maxSlots && <span style={{ color: '#D97706', marginLeft: 8 }}>⚠️ Cần thêm {maxSlots - savedCount} nữa để đủ slot</span>}
                  </div>
                </div>

                {/* 20 product cards */}
                {Array.from({ length: FLASH_PRODUCT_MAX }, (_, idx) => {
                  const form = flashProductForms[idx] ?? {}
                  const preview = flashProductPreviews[idx]
                  const saved = flashProductSaved[idx]
                  const isActive = idx < maxSlots
                  return (
                    <div key={idx} style={{ ...cardStyle, border: `1px solid ${isActive ? C.orange + '88' : C.border}`, marginBottom: 12 }}>
                      {/* Header slot */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <span style={{ width: 28, height: 28, borderRadius: '50%', background: isActive ? C.orange : '#9CA3AF', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13, flexShrink: 0 }}>
                          {idx + 1}
                        </span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: isActive ? C.orange : C.gray }}>
                          {isActive ? `Sản phẩm ưu tiên #${idx + 1}` : `Sản phẩm dự phòng #${idx + 1}`}
                        </span>
                        {saved && <span style={{ marginLeft: 'auto', fontSize: 11, color: C.primary, fontWeight: 600 }}>✅ Đã lưu</span>}
                        {saved && (
                          <button type="button"
                            onClick={() => {
                              clearFlashProduct(SHOP_NAME, idx)
                              setFlashProductForms(prev => { const n = [...prev]; n[idx] = null; return n })
                              setFlashProductPreviews(prev => { const n = [...prev]; n[idx] = null; return n })
                              setFlashProductSaved(prev => { const n = [...prev]; n[idx] = false; return n })
                              setPickerOpenIdx(null)
                            }}
                            style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(220,38,38,0.3)', background: 'rgba(220,38,38,0.06)', color: '#DC2626', cursor: 'pointer' }}>
                            🗑 Xoá
                          </button>
                        )}
                      </div>

                      {/* Sản phẩm đã chọn */}
                      {form.productName ? (
                        <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                          <img src={form.productImage} alt={form.productName}
                            onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/80' }}
                            style={{ width: 80, height: 80, borderRadius: 10, objectFit: 'cover', border: `2px solid ${C.orange}44`, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700, fontSize: 14, color: '#1e293b', marginBottom: 4 }}>{form.productName}</div>
                            <div style={{ fontSize: 13, color: C.orange, fontWeight: 600, marginBottom: 8 }}>
                              {Number(form.price).toLocaleString('vi-VN')} đ
                            </div>
                            <div style={{ display: 'flex', gap: 8 }}>
                              {!saved && (
                                <button type="button"
                                  style={{ ...btnStyle(C.orange), fontSize: 12, padding: '6px 16px' }}
                                  onClick={() => {
                                    const productName = (form.productName ?? '').trim()
                                    const price = Number(String(form.price ?? '').replace(/[^\d]/g, ''))
                                    const productImage = form.productImage ?? ''
                                    if (!productName || !price || !productImage) { toast.error(`SP #${idx + 1}: Dữ liệu không hợp lệ`); return }
                                    saveFlashProduct(SHOP_NAME, idx, { productName, price, productImage })
                                    setFlashProductSaved(prev => { const n = [...prev]; n[idx] = true; return n })
                                    toast.success(`✅ Đã lưu sản phẩm #${idx + 1}!`)
                                  }}>
                                  💾 Lưu vào slot
                                </button>
                              )}
                              <button type="button"
                                style={{ fontSize: 12, padding: '6px 12px', background: 'transparent', color: C.gray, border: `1px solid ${C.border}`, borderRadius: 8, cursor: 'pointer' }}
                                onClick={() => {
                                  setFlashProductForms(prev => { const n = [...prev]; n[idx] = null; return n })
                                  setFlashProductSaved(prev => { const n = [...prev]; n[idx] = false; return n })
                                  setPickerOpenIdx(idx)
                                }}>
                                🔄 Đổi sản phẩm
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Chưa chọn sản phẩm → hiện nút + picker */
                        <div>
                          {pickerOpenIdx !== idx ? (
                            <button type="button"
                              onClick={() => setPickerOpenIdx(idx)}
                              style={{ width: '100%', padding: '12px', border: `2px dashed ${C.orange}66`, borderRadius: 10, background: `${C.orange}08`, color: C.orange, fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                              <span style={{ fontSize: 18 }}>🛍</span> Chọn sản phẩm từ shop
                            </button>
                          ) : (
                            /* Product picker grid */
                            <div style={{ border: `1px solid ${C.border}`, borderRadius: 10, overflow: 'hidden' }}>
                              <div style={{ background: '#f8fafc', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${C.border}` }}>
                                <span style={{ fontSize: 13, fontWeight: 700, color: '#1e293b' }}>🛍 Chọn sản phẩm đang bán ({shopProducts.length} sản phẩm)</span>
                                <button type="button" onClick={() => setPickerOpenIdx(null)}
                                  style={{ background: 'none', border: 'none', fontSize: 16, cursor: 'pointer', color: C.gray }}>✕</button>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, padding: 12 }}>
                                {shopProducts.length === 0 && (
                                  <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: 13 }}>
                                    Chưa có sản phẩm đang bán. Hãy thêm sản phẩm tại trang <b>Sản phẩm</b> trước.
                                  </div>
                                )}
                                {shopProducts.map(p => {
                                  const alreadyUsed = flashProductForms.some((f, fi) => fi !== idx && f?.productName === p.name)
                                  return (
                                    <div key={p.id}
                                      onClick={() => {
                                        if (alreadyUsed) { toast.warning('Sản phẩm này đã được thêm vào slot khác!'); return }
                                        setFlashProductForms(prev => { const n = [...prev]; n[idx] = { productName: p.name, price: String(p.price), productImage: p.image }; return n })
                                        setFlashProductSaved(prev => { const n = [...prev]; n[idx] = false; return n })
                                        setPickerOpenIdx(null)
                                      }}
                                      style={{ border: `1px solid ${alreadyUsed ? C.border : C.orange + '55'}`, borderRadius: 10, overflow: 'hidden', cursor: alreadyUsed ? 'not-allowed' : 'pointer', opacity: alreadyUsed ? 0.45 : 1, background: 'white', transition: 'box-shadow .15s' }}
                                      onMouseEnter={e => { if (!alreadyUsed) (e.currentTarget as HTMLDivElement).style.boxShadow = `0 4px 12px ${C.orange}33` }}
                                      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = 'none' }}>
                                      <img src={p.image} alt={p.name}
                                        onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/160' }}
                                        style={{ width: '100%', height: 110, objectFit: 'cover', display: 'block' }} />
                                      <div style={{ padding: '8px 10px' }}>
                                        <div style={{ fontSize: 12, fontWeight: 600, color: '#1e293b', lineHeight: 1.3, marginBottom: 4, overflow: 'hidden', maxHeight: '2.6em' }}>{p.name}</div>
                                        <div style={{ fontSize: 12, color: C.orange, fontWeight: 700 }}>{p.price.toLocaleString('vi-VN')} đ</div>
                                        {alreadyUsed && <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>Đã dùng</div>}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}

          {/* ── Vị trí Top mẫu ──────────────────────── */}
          {prepTab === 'top' && (
            <div style={cardStyle}>
              <h3 style={{ margin: '0 0 10px', fontSize: 15 }}>🏆 Mẫu Vị trí Top</h3>
              <p style={{ color: C.gray, fontSize: 13 }}>Tính năng chuẩn bị mẫu Vị trí Top sẽ được bổ sung sớm.</p>
            </div>
          )}
        </div>
      )}

      {rejectedModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setRejectedModal(null) }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, maxWidth: 500, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 4px', color: '#DC2626' }}>Nội dung bị từ chối</h3>
            <p style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>Admin đã từ chối. Vui lòng chỉnh sửa và gửi lại.</p>
            {rejectedModal.sub.rejectReason && (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13 }}>
                <b>Lý do:</b> {rejectedModal.sub.rejectReason}
              </div>
            )}
            {rejectedModal.kind === 'banner' && (
              <div style={{ fontSize: 13 }}>
                <div><b>Tiêu đề:</b> {(rejectedModal.sub as BannerSubmission).title}</div>
                {(rejectedModal.sub as BannerSubmission).image && (
                  <img src={(rejectedModal.sub as BannerSubmission).image} alt="banner" style={{ marginTop: 10, maxWidth: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />
                )}
              </div>
            )}
            {rejectedModal.kind === 'flash' && (
              <div style={{ fontSize: 13 }}>
                <div><b>Sản phẩm:</b> {(rejectedModal.sub as FlashSubmission).productName}</div>
                <div style={{ marginTop: 4 }}><b>Giá:</b> {(rejectedModal.sub as FlashSubmission).price.toLocaleString('vi-VN')}đ</div>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
              <button style={btnStyle(C.primary)} onClick={() => { setRejectedModal(null); setTab('prepare') }}>Chỉnh sửa ngay</button>
            </div>
          </div>
        </div>
      )}

      {submitTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setSubmitTarget(null) }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, maxWidth: 500, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            {(submitTarget.kind === 'banner' || submitTarget.kind === 'banner-buynow') ? (
              <>
                {/* Header — buy-now edit mode shows rejection context */}
                {submitTarget.kind === 'banner-buynow' && (() => {
                  const bnTx = buyNowTxs.find(t => t.id === submitTarget.txId)
                  const isEdit = bnTx?.status === 'awaiting_edit'
                  return (
                    <>
                      <h3 style={{ margin: '0 0 4px', color: isEdit ? '#7C3AED' : undefined }}>
                        {isEdit ? '✏️ Sửa lại banner' : '📢 Đăng banner quảng cáo'}
                      </h3>
                      <p style={{ fontSize: 13, color: C.gray, marginBottom: isEdit ? 8 : 16 }}>{submitTarget.label}</p>
                      {isEdit && (
                        <>
                          <div style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, padding: '8px 14px', marginBottom: 8, fontSize: 12, fontWeight: 700, color: '#DC2626' }}>
                            ⚠️ Cảnh báo vi phạm — lần {bnTx?.rejectCount}/{MAX_BUYNOW_REVISIONS}
                          </div>
                          {bnTx?.rejectReason ? (
                            <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
                              <div style={{ fontWeight: 700, color: '#7C3AED', marginBottom: 4 }}>❌ Nội dung vi phạm</div>
                              <div style={{ color: '#5B21B6' }}>{bnTx.rejectReason}</div>
                            </div>
                          ) : (
                            <div style={{ background: 'rgba(124,58,237,0.07)', border: '1px solid rgba(124,58,237,0.25)', borderRadius: 8, padding: '8px 14px', marginBottom: 14, fontSize: 12, color: '#7C3AED' }}>
                              ✏️ Admin yêu cầu chỉnh sửa — vui lòng cập nhật nội dung banner
                            </div>
                          )}
                        </>
                      )}
                    </>
                  )
                })()}
                {submitTarget.kind === 'banner' && (
                  <>
                    <h3 style={{ margin: '0 0 4px' }}>Đăng banner quảng cáo</h3>
                    <p style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>
                      {BANNER_POSITIONS.find(p => p.key === (submitTarget.session as BannerAuctionSession).position)?.label}
                    </p>
                  </>
                )}
                <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 10 }}>
                  Tiêu đề banner *
                  <input value={bannerForm.title} onChange={e => setBannerForm(f => ({ ...f, title: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, boxSizing: 'border-box' }} />
                </label>
                <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 10 }}>
                  Đường dẫn (tuỳ chọn)
                  <input value={bannerForm.link} onChange={e => setBannerForm(f => ({ ...f, link: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, boxSizing: 'border-box' }} />
                </label>
                <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>
                  Ảnh banner *
                  <input type="file" accept="image/*" style={{ display: 'block', marginTop: 4 }}
                    onChange={async e => { const f = e.target.files?.[0]; if (f) await handleBannerImageFile(f) }} />
                  {bannerImgError && <p style={{ color: '#DC2626', fontSize: 12, margin: '4px 0 0' }}>{bannerImgError}</p>}
                  {(bannerModalResolvedImg || (bannerForm.image && !bannerForm.image.startsWith('idb:'))) && !bannerImgError && (
                    <img src={bannerModalResolvedImg || bannerForm.image} alt="preview" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />
                  )}
                  {bannerForm.image && !bannerModalResolvedImg && bannerForm.image.startsWith('idb:') && !bannerImgError && (
                    <div style={{ marginTop: 8, padding: '8px 12px', background: 'rgba(22,163,74,0.1)', borderRadius: 8, fontSize: 12, color: '#16A34A' }}>✅ Đang dùng ảnh từ mẫu đã chuẩn bị</div>
                  )}
                </label>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button style={btnStyle('transparent', C.gray)} onClick={() => setSubmitTarget(null)}>Huỷ</button>
                  <button style={btnStyle(C.primary)} onClick={handleSubmitBanner}>Gửi duyệt</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ margin: '0 0 4px' }}>📦 Đăng sản phẩm Flash Sale</h3>
                <p style={{ color: C.gray, fontSize: 12, marginBottom: 16 }}>Điền thông tin sản phẩm cho <b>{FLASH_SLOTS.find(s => s.key === (submitTarget.session as FlashAuctionSession).slot)?.label}</b></p>
                <p style={{ fontSize: 12, color: C.orange, background: C.orangeLight, padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>📐 Yêu cầu ảnh: tỉ lệ <b>{FLASH_IMAGE_SPEC.ratioLabel}</b> — khuyến nghị {FLASH_IMAGE_SPEC.recommendedW}×{FLASH_IMAGE_SPEC.recommendedH}px — tối đa {FLASH_IMAGE_SPEC.maxKB.toLocaleString()}KB</p>
                <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 10 }}>
                  Tên sản phẩm *
                  <input value={flashForm.productName} onChange={e => setFlashForm(f => ({ ...f, productName: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, boxSizing: 'border-box' }} />
                </label>
                <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 10 }}>
                  Giá bán Flash Sale (đ) *
                  <input type="number" value={flashForm.price} onChange={e => setFlashForm(f => ({ ...f, price: e.target.value }))}
                    style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, boxSizing: 'border-box' }} />
                </label>
                <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>
                  Ảnh sản phẩm *
                  <input type="file" accept="image/*" style={{ display: 'block', marginTop: 4 }}
                    onChange={async e => { const f = e.target.files?.[0]; if (f) await handleFlashImageFile(f) }} />
                  {flashImgError && <p style={{ color: '#DC2626', fontSize: 12, margin: '4px 0 0' }}>{flashImgError}</p>}
                  {flashForm.image && !flashImgError && <img src={flashForm.image} alt="preview" style={{ marginTop: 8, maxWidth: 160, borderRadius: 8 }} />}
                </label>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
                  <button style={btnStyle('transparent', C.gray)} onClick={() => setSubmitTarget(null)}>Huỷ</button>
                  <button style={btnStyle(C.orange)} onClick={handleSubmitFlash}>Gửi duyệt</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Modal: nội dung bị từ chối ──────────────────────────────────── */}
      {rejectedModal && (() => {
        const { kind, sub } = rejectedModal
        const isBanner = kind === 'banner'
        const bs = sub as BannerSubmission
        const fs = sub as FlashSubmission
        const image = isBanner ? bs.image : fs.productImage
        const title = isBanner ? bs.title : fs.productName
        const posLabel = isBanner
          ? BANNER_POSITIONS.find(p => p.key === bs.position)?.label
          : FLASH_SLOTS.find(s => s.key === fs.slot)?.label
        const rejectReason = (sub as any).rejectReason as string | undefined

        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
            <div style={{ background: C.cardBg, borderRadius: 14, width: 540, maxWidth: '95vw', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: sub.status === 'awaiting_edit' ? 'rgba(124,58,237,0.06)' : 'rgba(220,38,38,0.06)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: sub.status === 'awaiting_edit' ? '#7C3AED' : '#DC2626' }}>
                    {sub.status === 'awaiting_edit' ? '✏️ Cần chỉnh sửa lại' : '❌ Bị từ chối vĩnh viễn'}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>
                    {posLabel} · {new Date(sub.createdAt).toLocaleString('vi-VN')}
                    {(sub as BannerSubmission).rejectCount != null && (
                      <span style={{ marginLeft: 8, fontWeight: 700, color: sub.status === 'rejected' ? '#DC2626' : '#7C3AED' }}>
                        · Từ chối {(sub as BannerSubmission).rejectCount}/3 lần
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={() => setRejectedModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>✕</button>
              </div>
              <div style={{ overflowY: 'auto', flex: 1 }}>
                {image ? (
                  <div style={{ background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, maxHeight: 280, overflow: 'hidden' }}>
                                        <img src={image} alt="noi dung bi tu choi" style={{ width: '100%', maxHeight: 280, objectFit: isBanner ? 'cover' : 'contain', display: 'block' }} />
                  </div>
                ) : (
                  <div style={{ height: 120, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray }}>Khong co anh</div>
                )}

                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: isBanner ? C.blue : C.orange, background: isBanner ? C.blueLight : C.orangeLight }}>
                      {isBanner ? 'Banner' : 'Flash Sale'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
                  </div>

                  {isBanner && bs.link && (
                    <div style={{ fontSize: 12, color: C.blue }}>Link: {bs.link}</div>
                  )}
                  {!isBanner && (
                    <div style={{ fontSize: 13, color: C.gray }}>Gia: <b style={{ color: C.orange }}>{Number(fs.price).toLocaleString('vi-VN')}d</b></div>
                  )}

                  <div style={{ background: 'rgba(220,38,38,0.07)', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#DC2626', marginBottom: 8 }}>Ly do tu choi</div>
                    {rejectReason ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {rejectReason.split(' - ').map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                            <span style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }}>-</span>
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: C.gray }}>Admin khong ghi ro ly do.</div>
                    )}
                  </div>

                  <div style={{ background: C.primaryLight, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.primary }}>
                    Vui long chinh sua noi dung theo dung chinh sach, sau do vao tab Chuan bi de cap nhat mau va tham gia dau gia lai.
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.gray }} onClick={() => setRejectedModal(null)}>Đóng</button>
                {sub.status === 'awaiting_edit' && (
                  <button
                    style={{ background: '#7C3AED', color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                    onClick={() => {
                      resubmitSubmission(sub.id)
                      setRejectedModal(null)
                      refresh()
                      toast.success('📢 Đã gửi lại banner cho Admin duyệt!')
                    }}>
                    📤 Gửi lại ngay
                  </button>
                )}
                <button style={{ background: C.primary, color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setRejectedModal(null); setTab('prepare') }}>
                  ✏️ Vào sửa mẫu
                </button>
              </div>
            </div>
          </div>
        )
      })()}

      </div>{/* end tab content */}

      </div>{/* end flex-row */}
      </div>{/* end main content */}

      {/* ── Cảnh cáo hết hạn đặt cọc ─────────────────────────────────────── */}
      {depositExpiredWarn && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 2100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          {depositExpiredWarn.n < depositExpiredWarn.max ? (
            /* ── Cảnh cáo lần 1 ── */
            <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '28px 28px 22px', maxWidth: 420, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.3)', border: '2px solid #DC2626' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <span style={{ fontSize: 36 }}>⚠️</span>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 17, color: '#DC2626' }}>Cảnh cáo vi phạm</div>
                  <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Bỏ lỡ thời hạn đặt cọc</div>
                </div>
                <div style={{ marginLeft: 'auto', textAlign: 'center', background: '#FEE2E2', borderRadius: 10, padding: '6px 14px' }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>{depositExpiredWarn.n}/{depositExpiredWarn.max}</div>
                  <div style={{ fontSize: 10, color: '#EF4444', fontWeight: 600 }}>lần cảnh cáo</div>
                </div>
              </div>
              <div style={{ background: '#FEF2F2', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 13, color: '#7F1D1D', display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span>🚫 Bạn đã không hoàn thành đặt cọc trong thời hạn quy định.</span>
                <span>📌 Kết quả thắng đấu giá đã bị <b>huỷ tự động</b>.</span>
                <span>⚠️ Nếu còn tái diễn, shop của bạn sẽ bị <b>ĐÌNH CHỈ</b>.</span>
              </div>
              <button onClick={() => setDepositExpiredWarn(null)}
                style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none', fontWeight: 700, fontSize: 14, cursor: 'pointer', background: '#DC2626', color: 'white' }}>
                Đã hiểu
              </button>
            </div>
          ) : (
            /* ── Đình chỉ lần 2 ── */
            <div style={{ background: '#1a0000', borderRadius: 16, padding: '32px 28px 24px', maxWidth: 420, width: '100%', boxShadow: '0 20px 80px rgba(220,38,38,0.5)', border: '2px solid #991B1B' }}>
              {/* Badge đình chỉ */}
              <div style={{ textAlign: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 52 }}>🔴</div>
                <div style={{ fontWeight: 900, fontSize: 22, color: '#EF4444', letterSpacing: 1, marginTop: 8 }}>SHOP BỊ ĐÌNH CHỈ</div>
                <div style={{ fontSize: 13, color: '#FCA5A5', marginTop: 4 }}>Vi phạm lần {depositExpiredWarn.n}/{depositExpiredWarn.max}</div>
              </div>

              <div style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid #7F1D1D', borderRadius: 10, padding: '14px 16px', marginBottom: 20, fontSize: 13, color: '#FCA5A5', display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span>🚫 Bạn đã <b style={{ color: '#EF4444' }}>2 lần</b> bỏ lỡ thời hạn đặt cọc sau khi thắng đấu giá.</span>
                <span>📌 Kết quả thắng đấu giá đã bị huỷ tự động.</span>
                <span style={{ color: '#EF4444', fontWeight: 700 }}>⛔ Shop của bạn đã bị <b>ĐÌNH CHỈ</b> khỏi hệ thống đấu giá quảng cáo.</span>
                <span>📞 Vui lòng liên hệ Admin để được hỗ trợ mở lại quyền đấu giá.</span>
              </div>

              <button onClick={() => setDepositExpiredWarn(null)}
                style={{ width: '100%', padding: '12px 0', borderRadius: 8, border: '1px solid #7F1D1D', fontWeight: 800, fontSize: 15, cursor: 'pointer', background: '#7F1D1D', color: '#FCA5A5', letterSpacing: 0.5 }}>
                Đã hiểu — Liên hệ Admin
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Mua ngay — confirmation modal ──────────────────────────────────── */}
      {buyNowConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => { if (e.target === e.currentTarget) setBuyNowConfirm(null) }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: '28px 28px 22px', maxWidth: 400, width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.25)' }}>
            <h3 style={{ margin: '0 0 6px', fontSize: 17 }}>🛒 Xác nhận mua ngay</h3>
            <p style={{ margin: '0 0 18px', fontSize: 13, color: C.gray }}>Bạn sẽ mua vị trí với mức giá cố định mà không cần chờ kết thúc phiên đấu giá.</p>
            <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: 10, padding: '14px 16px', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: C.gray }}>Vị trí</span>
                <span style={{ fontWeight: 600 }}>{buyNowConfirm.label}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: C.gray }}>Số slot</span>
                <span style={{ fontWeight: 600 }}>{buyNowConfirm.slots}</span>
              </div>
              {buyNowConfirm.unitLabel && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                  <span style={{ color: C.gray }}>Chi tiết</span>
                  <span style={{ color: C.gray }}>{buyNowConfirm.unitLabel}</span>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--border-subtle, #e5e7eb)', paddingTop: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 13, color: C.gray }}>Tổng thanh toán</span>
                <span style={{ fontSize: 18, fontWeight: 700, color: C.primary }}>{buyNowConfirm.price.toLocaleString('vi-VN')}đ</span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setBuyNowConfirm(null)}
                style={{ padding: '9px 20px', borderRadius: 8, border: '1px solid var(--border-subtle, #e5e7eb)', background: 'transparent', fontSize: 14, cursor: 'pointer', color: C.gray, fontWeight: 600 }}>
                Huỷ
              </button>
              <button
                onClick={() => { buyNowConfirm.onConfirm(); setBuyNowConfirm(null) }}
                style={{ padding: '9px 22px', borderRadius: 8, border: 'none', background: C.primary, color: 'white', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                ✅ Xác nhận mua
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default BannerAuctionPage
