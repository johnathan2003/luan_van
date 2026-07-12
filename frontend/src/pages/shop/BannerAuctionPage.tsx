import React, { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  BANNER_POSITIONS, BannerAuctionSession, BannerBid, BannerPositionKey, BannerSubmission,
  BANNER_IMAGE_SPECS, ImageSpec,
  formatCountdown, getAllActiveSessions, getHistory, getMinNextBid,
  getShopCooldownRemaining, msUntilEnd,
  isAuctionLive, msUntilStart,
  placeBid, sweepExpiredWins, getPendingWinsForShop, payDeposit, payWin,
  submitBanner, getSubmissionByHistoryId, getAllSubmissions as getAllBannerSubmissions,
} from '../../utils/bannerAuctionStore'
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
type PendingWin = { kind: 'banner'; session: BannerAuctionSession } | { kind: 'flash'; session: FlashAuctionSession }

const SHOP_NAME = 'My Demo Shop' // mock — thực tế lấy từ auth store

const BannerAuctionPage: React.FC = () => {
  // ── State: banner ─────────────────────────────────────────────────────────
  const [bannerSessions, setBannerSessions] = useState<Partial<Record<BannerPositionKey, BannerAuctionSession>>>({})
  const [bannerHistory, setBannerHistory] = useState<BannerAuctionSession[]>([])
  const [selectedBannerPos, setSelectedBannerPos] = useState<BannerPositionKey>('home_slider')
  const [adminPreviews] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('admin_position_previews') || '{}') } catch { return {} }
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

  // ── State: tab ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'banner' | 'flash' | 'top' | 'mytx' | 'prepare'>('banner')

  // ── State: banner position dropdown ───────────────────────────────────────
  const [bannerDropOpen, setBannerDropOpen] = useState(false)
  const bannerDropRef = useRef<HTMLDivElement>(null)

  // ── State: chuẩn bị mẫu ───────────────────────────────────────────────────
  const [prepTab, setPrepTab] = useState<'banner' | 'flash' | 'top'>('banner')
  const [prepBannerPos, setPrepBannerPos] = useState<BannerPositionKey>('home_slider')
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
  const [flashPreview, setFlashPreview] = useState<Record<string, string>>({})

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
    setBannerHistory(getHistory())
    setPendingBannerWins(getPendingWinsForShop(SHOP_NAME))
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
  const openSubmitModal = (win: PendingWin) => {
    setSubmitTarget(win)
    setBannerForm({ title: '', link: '', image: '' })
    setBannerImgError('')
    if (win.kind === 'flash') {
      setFlashForm({ productName: win.session.winner?.productName ?? '', price: '', image: '' })
    } else {
      setFlashForm({ productName: '', price: '', image: '' })
    }
    setFlashImgError('')
  }

  const handleBannerImageFile = async (file: File) => {
    if (!submitTarget || submitTarget.kind !== 'banner') return
    const spec = BANNER_IMAGE_SPECS[(submitTarget.session as BannerAuctionSession).position]
    const result = await validateImageFile(file, spec)
    if (!result.ok) { setBannerImgError(result.error || 'Ảnh không hợp lệ.'); return }
    setBannerImgError(''); setBannerForm(f => ({ ...f, image: result.dataUrl! }))
  }

  const handleFlashImageFile = async (file: File) => {
    const result = await validateImageFile(file, FLASH_IMAGE_SPEC)
    if (!result.ok) { setFlashImgError(result.error || 'Ảnh không hợp lệ.'); return }
    setFlashImgError(''); setFlashForm(f => ({ ...f, image: result.dataUrl! }))
  }

  const handleSubmitBanner = () => {
    if (!submitTarget || submitTarget.kind !== 'banner') return
    if (!bannerForm.title.trim() || !bannerForm.image) { toast.error('Vui lòng nhập tiêu đề và chọn hình ảnh banner đúng yêu cầu.'); return }
    if (bannerImgError) { toast.error(bannerImgError); return }
    const result = submitBanner(submitTarget.session.id, { title: bannerForm.title.trim(), link: bannerForm.link.trim() || undefined, image: bannerForm.image })
    if (!result) { toast.error('Không thể đăng banner — vui lòng thử lại.'); return }
    toast.success('📢 Đã gửi banner cho Admin duyệt!'); setSubmitTarget(null); refresh()
  }

  const handleSubmitFlash = () => {
    if (!submitTarget || submitTarget.kind !== 'flash') return
    const priceNum = Number(flashForm.price.replace(/[^\d]/g, ''))
    if (!flashForm.productName.trim() || !priceNum || priceNum <= 0 || !flashForm.image) { toast.error('Vui lòng nhập đầy đủ tên sản phẩm, giá tiền và hình ảnh đúng yêu cầu.'); return }
    if (flashImgError) { toast.error(flashImgError); return }
    const result = submitFlashProduct(submitTarget.session.id, { productName: flashForm.productName.trim(), price: priceNum, productImage: flashForm.image })
    if (!result) { toast.error('Không thể đăng sản phẩm — vui lòng thử lại.'); return }
    toast.success('📦 Đã gửi sản phẩm cho Admin duyệt!'); setSubmitTarget(null); refreshFlash()
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
    const result = placeBid(selectedBannerPos, SHOP_NAME, amount)
    if (!result.ok) { toast.error(result.error || 'Không thể đặt giá'); return }
    toast.success('✅ Đặt giá thành công!'); setBidAmounts(p => ({ ...p, [selectedBannerPos]: '' })); refresh()
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
    const result = placeFlashBid(selectedFlashSlot, SHOP_NAME, productName, amount)
    if (!result.ok) { toast.error(result.error || 'Không thể đặt giá'); return }
    toast.success('✅ Đặt giá thành công!'); setFlashBidAmounts(p => ({ ...p, [selectedFlashSlot]: '' })); refreshFlash()
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ marginBottom: 4 }}>🏆 Đấu giá vị trí quảng cáo</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>Đặt giá để banner / sản phẩm của shop xuất hiện ở vị trí hot trên Trang chủ BuyZo.</p>

      {/* ── Thông báo thắng đấu giá / đặt cọc ──────────────────────────── */}
      {(pendingBannerWins.length > 0 || pendingFlashWins.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          {[...pendingBannerWins.map(w => ({ kind: 'banner' as const, w })), ...pendingFlashWins.map(w => ({ kind: 'flash' as const, w }))].map(({ kind, w }) => {
            const sub = kind === 'banner' ? getSubmissionByHistoryId(w.id) : getFlashSubmissionByHistoryId(w.id)
            const posLabel = kind === 'banner'
              ? BANNER_POSITIONS.find(p => p.key === (w as BannerAuctionSession).position)?.label
              : FLASH_SLOTS.find(s => s.key === (w as FlashAuctionSession).slot)?.label
            const depositAmt = w.depositAmount ?? 0
            const depositDeadline = w.depositDeadline ? new Date(w.depositDeadline) : null
            const msLeft = depositDeadline ? depositDeadline.getTime() - Date.now() : 0
            const minLeft = Math.max(0, Math.ceil(msLeft / 60000))

            if (w.confirmation === 'pending') {
              return (
                <div key={w.id} style={{ borderRadius: 14, padding: 20, marginBottom: 12, background: 'linear-gradient(135deg,#FFF7ED,#FEF3C7)', border: `2px solid ${C.orange}` }}>
                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <span style={{ fontSize: 28 }}>🏆</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 16, color: C.orange }}>Chúc mừng! Bạn đã thắng đấu giá</div>
                      <div style={{ fontSize: 13, color: C.gray }}>{kind === 'banner' ? '🖼️' : '⚡'} {posLabel} — Giá thắng: <b>{w.winner?.amount.toLocaleString('vi-VN')}đ</b></div>
                    </div>
                    <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                      <div style={{ fontSize: 22, fontWeight: 800, color: '#DC2626' }}>⏰ {minLeft} phút</div>
                      <div style={{ fontSize: 11, color: C.gray }}>còn lại để đặt cọc</div>
                    </div>
                  </div>

                  {/* Điều kiện */}
                  <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 10, padding: '12px 16px', marginBottom: 14, fontSize: 13 }}>
                    <div style={{ fontWeight: 700, marginBottom: 8, color: '#92400E' }}>📋 Điều kiện đặt cọc</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span>💰 Số tiền cọc: <b style={{ color: C.orange }}>{depositAmt.toLocaleString('vi-VN')}đ</b> <span style={{ color: C.gray, fontSize: 12 }}>(20% giá thắng)</span></span>
                      <span>⏱ Hạn đặt cọc: <b>{depositDeadline?.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</b> hôm nay</span>
                      <span style={{ color: '#DC2626' }}>⚠️ Không đặt cọc trong {minLeft} phút → <b>kết quả thắng bị huỷ tự động</b></span>
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
                <div key={w.id} style={{ borderRadius: 14, overflow: 'hidden', marginBottom: 12, border: `2px solid ${isUrgent ? '#DC2626' : C.primary}` }}>
                  <div style={{ padding: 20, background: isUrgent ? 'rgba(220,38,38,0.06)' : C.primaryLight }}>
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
                    <button style={btnStyle(C.blue)}
                      onClick={() => {
                        const ok = kind === 'banner' ? payWin(w.id) : payFlashWin(w.id)
                        if (ok) { refresh(); refreshFlash(); toast.success('💳 Thanh toán đủ thành công!') }
                      }}>
                      💳 Thanh toán đủ ({((w.winner?.amount ?? 0) - depositAmt).toLocaleString('vi-VN')}đ)
                    </button>
                    {!sub && (
                      <button style={btnStyle(C.purple)} onClick={() => openSubmitModal(kind === 'banner' ? { kind: 'banner', session: w as BannerAuctionSession } : { kind: 'flash', session: w as FlashAuctionSession })}>
                        {kind === 'banner' ? '📢 Đăng banner' : '📦 Đăng sản phẩm'}
                      </button>
                    )}
                    {sub && sub.status !== 'rejected' && (
                      <span style={badgeStyle(sub.status === 'approved' ? C.primary : C.orange, sub.status === 'approved' ? C.primaryLight : C.orangeLight)}>
                        {sub.status === 'approved' ? '✅ Đã duyệt' : '⏳ Chờ duyệt'}
                      </span>
                    )}
                    {sub && sub.status === 'rejected' && (
                      <button
                        onClick={() => setRejectedModal({ kind: kind as 'banner' | 'flash', sub })}
                        style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        ❌ Bị từ chối — Xem chi tiết
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
        </div>
      )}

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {([['banner', '🖼️ Banner'], ['flash', '⚡ Flash Sale'], ['top', '🏆 Vị trí Top'], ['mytx', '📒 Giao dịch của tôi'], ['prepare', '⚙️ Chuẩn bị']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...btnStyle(tab === t ? (t === 'top' ? C.purple : C.primary) : 'transparent', tab === t ? 'white' : C.gray), border: `1px solid ${tab === t ? (t === 'top' ? C.purple : C.primary) : C.border}`, position: 'relative' }}>
            {t === 'prepare' && (Object.values(bannerDraftsExist).some(Boolean) || Object.values(flashDraftsExist).some(Boolean)) && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: C.primary, border: '2px solid var(--bg-card)' }} />
            )}
            {label}
          </button>
        ))}
      </div>

      {/* ── Banner tab — hiển thị cả 3 vị trí ──────────────────────────── */}
      {tab === 'banner' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {BANNER_POSITIONS.map(pos => {
            const session  = bannerSessions[pos.key]
            const minBid   = getMinNextBid(pos.key)
            const cooldown = getShopCooldownRemaining(pos.key, SHOP_NAME)
            const preview  = getPreview(pos.key, pos.previewImage)

            return (
              <div key={pos.key} style={cardStyle}>
                {/* Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{pos.label}</h3>
                    <p style={{ color: C.gray, fontSize: 12, margin: '4px 0 0' }}>{pos.description}</p>
                  </div>
                  {session && (
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      {isAuctionLive(session) ? (
                        <>
                          <div style={{ fontSize: 22, fontWeight: 700, color: '#DC2626' }}>⏱ {countdown[pos.key] || '–'}</div>
                          <div style={{ fontSize: 11, color: C.gray }}>còn lại</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 18, fontWeight: 700, color: '#D97706' }}>⏳ {formatCountdown(msUntilStart(session))}</div>
                          <div style={{ fontSize: 11, color: C.gray }}>đến khi bắt đầu</div>
                        </>
                      )}
                    </div>
                  )}
                </div>

                {session ? (
                  <>
                    {!isAuctionLive(session) && (
                      <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid #FCD34D', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                        <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#92400E' }}>⏰ Phiên đấu giá sắp khai mạc!</p>
                        {session.description && <p style={{ margin: '0 0 6px', fontSize: 13, color: '#78350F', whiteSpace: 'pre-line' }}>📋 {session.description}</p>}
                        <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>Khai mạc lúc: <b>{session.scheduledStartAt ? new Date(session.scheduledStartAt).toLocaleString('vi-VN') : '–'}</b></p>
                        <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B45309' }}>Bạn có thể xem thông tin phiên nhưng chưa thể đặt giá.</p>
                      </div>
                    )}

                    {preview && (
                      <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                        <img src={preview} alt={pos.label} style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
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

                    <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {[0, 50_000, 100_000, 200_000, 500_000].map(extra => {
                        const val = minBid + extra
                        return (
                          <button key={extra} onClick={() => setBidAmounts(p => ({ ...p, [pos.key]: String(val) }))}
                            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}`, background: bidAmounts[pos.key] === String(val) ? C.primary : 'transparent', color: bidAmounts[pos.key] === String(val) ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                            {extra === 0 ? 'Tối thiểu' : `+${(extra / 1000).toFixed(0)}k`} ({val.toLocaleString('vi-VN')}đ)
                          </button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                      <input type="text"
                        placeholder={`Tối thiểu ${minBid.toLocaleString('vi-VN')}đ`}
                        value={bidAmounts[pos.key] || ''}
                        onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setBidAmounts(p => ({ ...p, [pos.key]: raw ? Number(raw).toLocaleString('vi-VN') : '' })) }}
                        style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }}
                      />
                      <button
                        style={btnStyle(!isAuctionLive(session) || cooldown > 0 ? '#9CA3AF' : C.primary)}
                        disabled={!isAuctionLive(session) || cooldown > 0}
                        onClick={() => {
                          const amount = parseInt((bidAmounts[pos.key] || '').replace(/[^\d]/g, ''))
                          if (!amount) { toast.error('Vui lòng nhập số tiền đặt giá'); return }
                          const result = placeBid(pos.key, SHOP_NAME, amount)
                          if (!result.ok) { toast.error(result.error || 'Không thể đặt giá'); return }
                          toast.success('✅ Đặt giá thành công!'); setBidAmounts(p => ({ ...p, [pos.key]: '' })); refresh()
                        }}>
                        {!isAuctionLive(session) ? '⏳ Chưa bắt đầu' : cooldown > 0 ? `Chờ ${Math.ceil(cooldown / 1000)}s` : '🏹 Đặt giá'}
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={{ color: C.gray }}>🔒 Vị trí này đang bị Admin tạm khoá hoặc chưa mở phiên đấu giá.</p>
                )}
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
          const r = placeFlashPoolBid(SHOP_NAME, amount, flashPoolSlots)
          if (!r.ok) { toast.error(r.error || 'Không thể đặt giá'); return }
          toast.success(`✅ Đặt giá thành công! ${flashPoolSlots} slot × ${amount.toLocaleString('vi-VN')}đ/slot`)
          setFlashPoolBidAmount(''); refreshPools()
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
                      ? <><div style={{ fontSize: 22, fontWeight: 700, color: '#DC2626' }}>⏱ {fmtMmSs(msEnd)}</div><div style={{ fontSize: 11, color: C.gray }}>còn lại</div></>
                      : <><div style={{ fontSize: 18, fontWeight: 700, color: '#D97706' }}>⏳ {fmtMmSs(msStart)}</div><div style={{ fontSize: 11, color: C.gray }}>đến khi bắt đầu</div></>
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
                    {flashPoolBidAmount && (
                      <div style={{ marginTop: 8, fontSize: 12, color: C.orange }}>
                        Tổng ước tính: <b>{((parseInt(flashPoolBidAmount) || 0) * flashPoolSlots).toLocaleString('vi-VN')}đ</b> cho {flashPoolSlots} slot
                      </div>
                    )}
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
          const r = placeTopBid(selectedTopSlot, SHOP_NAME, '(sản phẩm sẽ xác nhận sau)', amount)
          if (!r.ok) { toast.error(r.error || 'Không thể đặt giá'); return }
          toast.success(`✅ Đặt giá thành công! ${amount.toLocaleString('vi-VN')}đ cho ${slotDef.label}`)
          setTopBidAmounts(prev => ({ ...prev, [selectedTopSlot]: '' }))
          refreshPools()
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
                      ? <><div style={{ fontSize: 22, fontWeight: 700, color: '#DC2626' }}>⏱ {fmtMmSs(msEnd)}</div><div style={{ fontSize: 11, color: C.gray }}>còn lại</div></>
                      : <><div style={{ fontSize: 18, fontWeight: 700, color: '#D97706' }}>⏳ {fmtMmSs(msStart)}</div><div style={{ fontSize: 11, color: C.gray }}>đến khi bắt đầu</div></>
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
                          {[0, 50_000, 100_000, 200_000, 500_000].map(extra => {
                            const val = minNext + extra
                            const formatted = val.toLocaleString('vi-VN')
                            return (
                              <button key={extra} onClick={() => setTopBidAmounts(prev => ({ ...prev, [selectedTopSlot]: formatted }))}
                                style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${bidVal === formatted ? C.purple : C.border}`, background: bidVal === formatted ? C.purple : 'transparent', color: bidVal === formatted ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                                {extra === 0 ? 'Tối thiểu' : `+${(extra/1000).toFixed(0)}k`} ({val.toLocaleString('vi-VN')}đ)
                              </button>
                            )
                          })}
                        </div>
                          Giá đặt (đ) — tối thiểu {minNext.toLocaleString('vi-VN')}đ
                          <input type="text" value={bidVal}
                            onChange={e => { const raw = e.target.value.replace(/[^\d]/g, ''); setTopBidAmounts(prev => ({ ...prev, [selectedTopSlot]: raw ? Number(raw).toLocaleString('vi-VN') : '' })) }}
                            placeholder={minNext.toLocaleString('vi-VN')}
                            style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }} />
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
        // Gom tất cả phiên banner + flash mà shop có tham gia đặt giá
        type TxRow = {
          id: string; kind: 'banner' | 'flash'; label: string
          startedAt: string; myBids: number; myTopBid: number
          isWinner: boolean; confirmation?: string; amount?: number
          depositAmount?: number; subStatus?: string
        }
        const rows: TxRow[] = []

        // Banner history
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
          })
        })

        rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt))

        const statusColor = (r: TxRow) => {
          if (!r.isWinner) return { color: C.gray, bg: 'rgba(156,163,175,0.12)', label: '❌ Thua' }
          if (r.confirmation === 'paid') return { color: C.primary, bg: C.primaryLight, label: '✅ Đã thanh toán đủ' }
          if (r.confirmation === 'expired' || r.confirmation === 'declined') return { color: '#DC2626', bg: 'rgba(220,38,38,0.1)', label: '⚠️ Hết hạn/Từ chối' }
          if (r.confirmation === 'deposit_paid') return { color: C.blue, bg: C.blueLight, label: '💰 Đã cọc — chờ TT đủ' }
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
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 85px 120px 80px 160px 160px', padding: '10px 14px', background: C.primaryLight, fontSize: 12, fontWeight: 700, color: C.primary }}>
                      <span>Vị trí / Loại</span><span>Ngày</span><span>Giá thắng</span><span>Lượt bid</span><span>Trạng thái</span><span>Hành động</span>
                    </div>
                    {rows.map((r, i) => {
                      const st = statusColor(r)
                      const remaining = (r.amount ?? 0) - (r.depositAmount ?? 0)
                      return (
                        <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 85px 120px 80px 160px 160px', padding: '10px 14px', borderTop: `1px solid ${C.border}`, background: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)', alignItems: 'center', gap: 4 }}>
                          <span style={{ fontSize: 13 }}>
                            <span style={badgeStyle(r.kind === 'banner' ? C.blue : C.orange, r.kind === 'banner' ? C.blueLight : C.orangeLight)}>{r.kind === 'banner' ? '🖼️' : '⚡'}</span>
                            {' '}{r.label}
                          </span>
                          <span style={{ fontSize: 12, color: C.gray }}>{new Date(r.startedAt).toLocaleDateString('vi-VN')}</span>
                          <div style={{ fontSize: 12 }}>
                            <div style={{ fontWeight: 600 }}>{r.isWinner ? (r.amount ?? 0).toLocaleString('vi-VN') + 'đ' : r.myTopBid.toLocaleString('vi-VN') + 'đ'}</div>
                            {r.depositAmount && r.confirmation === 'deposit_paid' && (
                              <div style={{ color: C.gray, fontSize: 11 }}>Cọc: {r.depositAmount.toLocaleString('vi-VN')}đ · Còn: {remaining.toLocaleString('vi-VN')}đ</div>
                            )}
                          </div>
                          <span style={{ fontSize: 13 }}>{r.myBids} lượt</span>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <span style={badgeStyle(st.color, st.bg)}>{st.label}</span>
                            {/* Countdown thanh toán — hiện khi có paymentDeadline */}
                            {r.confirmation === 'deposit_paid' && (() => {
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
                            {r.confirmation === 'deposit_paid' && (
                              <button style={{ ...btnStyle(C.blue), fontSize: 11, padding: '5px 10px' }}
                                onClick={() => {
                                  const ok = r.kind === 'banner' ? payWin(r.id) : payFlashWin(r.id)
                                  if (ok) { refresh(); refreshFlash(); toast.success('💳 Thanh toán đủ thành công!') }
                                }}>
                                💳 TT đủ ({remaining.toLocaleString('vi-VN')}đ)
                              </button>
                            )}
                            {r.confirmation === 'deposit_paid' && !r.subStatus && (
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
                            {r.subStatus === 'approved' && <span style={badgeStyle(C.primary, C.primaryLight)}>✅ Đã duyệt</span>}
                            {r.subStatus === 'pending' && <span style={badgeStyle(C.orange, C.orangeLight)}>⏳ Chờ duyệt</span>}
                            {r.subStatus === 'rejected' && <span style={badgeStyle('#DC2626', 'rgba(220,38,38,0.1)')}>❌ Từ chối</span>}
                            {!r.confirmation || (!['deposit_paid'].includes(r.confirmation) && !r.subStatus) ? <span style={{ color: C.gray, fontSize: 12 }}>–</span> : null}
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
            return (
              <div key={posKey} style={cardStyle}>
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
                    {draft.image && <img src={draft.image} alt="draft" style={{ display: 'block', marginTop: 8, maxWidth: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 6 }} />}
                  </div>
                )}
                {prepBannerSaved[posKey] ? (
                  /* ── Đã lưu: ẩn form, chỉ hiện nút Chỉnh sửa ── */
                  <button style={{ ...btnStyle('transparent', C.primary), border: `1px solid ${C.primary}` }}
                    onClick={() => setPrepBannerSaved(prev => ({ ...prev, [posKey]: false }))}>
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
                          onChange={e => {
                            const file = e.target.files?.[0]; if (!file) return
                            const path = `/img/banner/${file.name}`
                            const previewUrl = URL.createObjectURL(file)
                            setPrepBannerImgErr(prev => ({ ...prev, [posKey]: '' }))
                            setPrepBannerSaved(prev => ({ ...prev, [posKey]: false }))
                            setPrepBannerForms(f => ({ ...f, [posKey]: { ...(f[posKey] ?? { title: '', link: '', image: '' }), image: path } }))
                            setBannerPreview(prev => ({ ...prev, [posKey]: previewUrl }))
                          }} />
                        <button type="button"
                          onClick={() => document.getElementById(`banner-pick-${posKey}`)?.click()}
                          style={{ padding: '7px 14px', background: C.blueLight, color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                          📂 Chọn file từ /img/banner/
                        </button>
                        {form.image && <span style={{ fontSize: 12, color: C.gray }}>{form.image}</span>}
                      </div>
                      <p style={{ fontSize: 11, color: C.gray, marginBottom: 6 }}>
                        💡 Trước khi chọn, hãy copy ảnh vào thư mục <code>public/img/banner/</code>
                      </p>
                      {imgErr && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>{imgErr}</p>}
                      {(bannerPreview[posKey] || form.image || draft?.image) && (
                        <img
                          src={bannerPreview[posKey] || form.image || draft?.image}
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
            {submitTarget.kind === 'banner' ? (
              <>
                <h3 style={{ margin: '0 0 4px' }}>Đăng banner quảng cáo</h3>
                <p style={{ fontSize: 13, color: C.gray, marginBottom: 16 }}>
                  {BANNER_POSITIONS.find(p => p.key === (submitTarget.session as BannerAuctionSession).position)?.label}
                </p>
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
                  {bannerForm.image && !bannerImgError && <img src={bannerForm.image} alt="preview" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 120, objectFit: 'cover', borderRadius: 8 }} />}
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
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(220,38,38,0.06)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#DC2626' }}>❌ Nội dung bị từ chối</div>
                  <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{posLabel} · {new Date(sub.createdAt).toLocaleString('vi-VN')}</div>
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
                <button style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.gray }} onClick={() => setRejectedModal(null)}>Dong</button>
                <button style={{ background: C.primary, color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setRejectedModal(null); setTab('prepare') }}>
         Cập nhật mẫu
                </button>
              </div>
            </div>
          </div>
        )
      })()} 

    </div>
  )
}

export default BannerAuctionPage
