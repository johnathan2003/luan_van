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
  getBannerDraft, saveBannerDraft,
  getFlashDraft, saveFlashDraft,
} from '../../utils/bannerDraftStore'

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

  // ── State: tab ────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<'banner' | 'flash' | 'mytx' | 'prepare'>('banner')

  // ── State: banner position dropdown ───────────────────────────────────────
  const [bannerDropOpen, setBannerDropOpen] = useState(false)
  const bannerDropRef = useRef<HTMLDivElement>(null)

  // ── State: chuẩn bị mẫu ───────────────────────────────────────────────────
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

  useEffect(() => {
    refresh(); refreshFlash(); checkDrafts()
    const pollId = setInterval(() => { refresh(); refreshFlash() }, 2000)
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
                      <span>✅ Sau khi đặt cọc thành công, bạn cần thanh toán đủ 100% để đăng banner.</span>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <button style={{ ...btnStyle(C.orange), fontSize: 14, padding: '10px 24px' }}
                      onClick={() => {
                        const ok = kind === 'banner' ? payDeposit(w.id) : payFlashDeposit(w.id)
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
        {([['banner', '🖼️ Banner'], ['flash', '⚡ Flash Sale'], ['mytx', '📒 Giao dịch của tôi'], ['prepare', '⚙️ Chuẩn bị']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)} style={{ ...btnStyle(tab === t ? C.primary : 'transparent', tab === t ? 'white' : C.gray), border: `1px solid ${tab === t ? C.primary : C.border}`, position: 'relative' }}>
            {t === 'prepare' && (Object.values(bannerDraftsExist).some(Boolean) || Object.values(flashDraftsExist).some(Boolean)) && (
              <span style={{ position: 'absolute', top: -4, right: -4, width: 8, height: 8, borderRadius: '50%', background: C.primary, border: '2px solid var(--bg-card)' }} />
            )}
            {label}
          </button>
        ))}
      </div>

      {/* ── Banner tab ────────────────────────────────────────────────────── */}
      {tab === 'banner' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20, alignItems: 'start' }}>
          {/* ── Cột trái: chọn vị trí + đấu giá ── */}
          <div>
            {/* Custom position dropdown */}
            {(() => {
              const selected = BANNER_POSITIONS.find(p => p.key === selectedBannerPos)!
              return (
                <div ref={bannerDropRef} style={{ position: 'relative', marginBottom: 16 }}>
                  <div onClick={() => setBannerDropOpen(o => !o)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', border: `1.5px solid ${bannerDropOpen ? C.primary : C.border}`, borderRadius: 10, background: 'var(--bg-card)', cursor: 'pointer', userSelect: 'none' }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{selected.label}</div>
                      <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{selected.description.slice(0, 60)}…</div>
                    </div>
                    <span style={{ fontSize: 18, color: C.gray, marginLeft: 10, display: 'inline-block', transform: bannerDropOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}>⌄</span>
                  </div>
                  {bannerDropOpen && (
                    <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bg-card)', border: `1.5px solid ${C.border}`, borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 50, overflow: 'hidden' }}>
                      {BANNER_POSITIONS.map((p, i) => {
                        const isSel = p.key === selectedBannerPos
                        return (
                          <div key={p.key} onClick={() => { setSelectedBannerPos(p.key); setBannerDropOpen(false) }}
                            style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer', background: isSel ? C.primaryLight : 'transparent', borderTop: i > 0 ? `1px solid ${C.border}` : 'none' }}
                            onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = 'var(--bg-highlight)' }}
                            onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLDivElement).style.background = isSel ? C.primaryLight : 'transparent' }}
                          >
                            {p.previewImage && <img src={p.previewImage} alt="" style={{ width: 56, height: 36, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}`, flexShrink: 0 }} />}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: isSel ? C.primary : 'var(--text-primary)' }}>{p.label}</div>
                              <div style={{ fontSize: 11, color: C.gray, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.description}</div>
                            </div>
                            {isSel && <span style={{ color: C.primary, fontSize: 16, flexShrink: 0 }}>✓</span>}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })()}

            {currentBannerSession ? (
              <div style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <h3 style={{ margin: 0 }}>{bannerDef.label}</h3>
                    <p style={{ color: C.gray, fontSize: 12, margin: '4px 0 0' }}>{bannerDef.description}</p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    {isAuctionLive(currentBannerSession) ? (
                      <>
                        <div style={{ fontSize: 22, fontWeight: 700, color: '#DC2626' }}>⏱ {countdown[selectedBannerPos] || '–'}</div>
                        <div style={{ fontSize: 11, color: C.gray }}>còn lại</div>
                      </>
                    ) : (
                      <>
                        <div style={{ fontSize: 18, fontWeight: 700, color: '#D97706' }}>⏳ {formatCountdown(msUntilStart(currentBannerSession))}</div>
                        <div style={{ fontSize: 11, color: C.gray }}>đến khi bắt đầu</div>
                      </>
                    )}
                  </div>
                </div>

                {/* Banner chưa bắt đầu */}
                {!isAuctionLive(currentBannerSession) && (
                  <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid #FCD34D', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                    <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#92400E' }}>⏰ Phiên đấu giá sắp khai mạc!</p>
                    {currentBannerSession.description && (
                      <p style={{ margin: '0 0 6px', fontSize: 13, color: '#78350F', whiteSpace: 'pre-line' }}>📋 {currentBannerSession.description}</p>
                    )}
                    <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>
                      Khai mạc lúc: <b>{currentBannerSession.scheduledStartAt ? new Date(currentBannerSession.scheduledStartAt).toLocaleString('vi-VN') : '–'}</b>
                    </p>
                    <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B45309' }}>Bạn có thể xem thông tin phiên nhưng chưa thể đặt giá.</p>
                  </div>
                )}

                {/* Preview ảnh vị trí */}
                {bannerDef.previewImage && (
                  <div style={{ marginBottom: 16, borderRadius: 8, overflow: 'hidden', border: `1px solid ${C.border}` }}>
                    <img src={bannerDef.previewImage} alt={bannerDef.label}
                      style={{ width: '100%', maxHeight: 160, objectFit: 'cover', display: 'block' }} />
                  </div>
                )}

                {/* Top bids */}
                <div style={{ marginBottom: 16 }}>
                  <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Bảng đấu giá ({currentBannerSession.bids.length} lượt)</p>
                  <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                    {currentBannerSession.bids.slice(0, 20).map((bid, i) => (
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
                    {currentBannerSession.bids.length === 0 && <p style={{ padding: 14, color: C.gray, fontSize: 13 }}>Chưa có ai đặt giá — hãy là người đầu tiên!</p>}
                  </div>
                </div>

                {/* Bid form */}
                <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[0, 50_000, 100_000, 200_000, 500_000].map(extra => {
                    const val = minBannerBid + extra
                    return (
                      <button key={extra} onClick={() => setBidAmounts(p => ({ ...p, [selectedBannerPos]: String(val) }))}
                        style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}`, background: bidAmounts[selectedBannerPos] === String(val) ? C.primary : 'transparent', color: bidAmounts[selectedBannerPos] === String(val) ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                        {extra === 0 ? 'Tối thiểu' : `+${(extra / 1000).toFixed(0)}k`} ({val.toLocaleString('vi-VN')}đ)
                      </button>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <input
                    type="number" min={minBannerBid} step={50000}
                    placeholder={`Tối thiểu ${minBannerBid.toLocaleString('vi-VN')}đ`}
                    value={bidAmounts[selectedBannerPos] || ''}
                    onChange={e => setBidAmounts(p => ({ ...p, [selectedBannerPos]: e.target.value }))}
                    style={{ flex: 1, minWidth: 200, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }}
                  />
                  <button
                    style={btnStyle(!isAuctionLive(currentBannerSession) || bannerCooldown > 0 ? '#9CA3AF' : C.primary)}
                    disabled={!isAuctionLive(currentBannerSession) || bannerCooldown > 0}
                    onClick={handlePlaceBannerBid}>
                    {!isAuctionLive(currentBannerSession) ? '⏳ Chưa bắt đầu' : bannerCooldown > 0 ? `Chờ ${Math.ceil(bannerCooldown / 1000)}s` : '🏹 Đặt giá'}
                  </button>
                </div>
              </div>
            ) : (
              <div style={cardStyle}>
                <p style={{ color: C.gray }}>🔒 Vị trí này đang bị Admin tạm khoá hoặc chưa mở phiên đấu giá.</p>
              </div>
            )}
          </div>

          {/* ── Cột phải: lịch sử phiên ── */}
          <div>
            <h3 style={{ marginBottom: 12, fontSize: 14, fontWeight: 700 }}>📋 Lịch sử phiên banner</h3>
            {bannerHistory.length === 0
              ? <div style={{ ...cardStyle, padding: '12px 16px' }}><p style={{ color: C.gray, fontSize: 13 }}>Chưa có lịch sử.</p></div>
              : bannerHistory.slice(0, 10).map(h => {
                  const sub = getSubmissionByHistoryId(h.id)
                  return (
                    <div key={h.id} style={{ ...cardStyle, padding: '12px 14px', marginBottom: 10 }}>
                      {/* Banner image nếu có */}
                      {sub?.image && (
                        <img src={sub.image} alt="banner" style={{ width: '100%', height: 72, objectFit: 'cover', borderRadius: 6, marginBottom: 8, border: `1px solid ${C.border}` }} />
                      )}
                      <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                        {BANNER_POSITIONS.find(p => p.key === h.position)?.label}
                      </div>
                      <div style={{ fontSize: 11, color: C.gray, marginBottom: 6 }}>
                        {new Date(h.startedAt).toLocaleDateString('vi-VN')}
                      </div>
                      <span style={badgeStyle(
                        h.confirmation === 'paid' ? C.primary : h.confirmation === 'expired' || h.confirmation === 'declined' ? '#DC2626' : C.orange,
                        h.confirmation === 'paid' ? C.primaryLight : h.confirmation === 'expired' || h.confirmation === 'declined' ? 'rgba(220,38,38,0.1)' : C.orangeLight,
                      )}>
                        {h.winner ? `${h.winner.shopName} — ${h.winner.amount.toLocaleString('vi-VN')}đ` : 'Không có người thắng'}
                      </span>
                      {sub && sub.status !== 'rejected' && (
                        <div style={{ marginTop: 6 }}>
                          <span style={badgeStyle(sub.status === 'approved' ? C.primary : C.orange, sub.status === 'approved' ? C.primaryLight : C.orangeLight)}>
                            {sub.status === 'approved' ? '✅ Đã duyệt' : '⏳ Chờ duyệt'}
                          </span>
                        </div>
                      )}
                      {sub && sub.status === 'rejected' && (
                        <div style={{ marginTop: 6 }}>
                          <button
                            onClick={() => setRejectedModal({ kind: 'banner', sub })}
                            style={{ background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                            ❌ Bị từ chối — Xem chi tiết
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
            }
          </div>
        </div>
      )}

      {/* ── Flash tab ─────────────────────────────────────────────────────── */}
      {tab === 'flash' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {FLASH_SLOTS.map(s => (
              <button key={s.key} onClick={() => setSelectedFlashSlot(s.key)}
                style={{ ...btnStyle(selectedFlashSlot === s.key ? C.orange : 'transparent', selectedFlashSlot === s.key ? 'white' : C.gray), border: `1px solid ${selectedFlashSlot === s.key ? C.orange : C.border}`, fontSize: 12 }}>
                {s.label}
              </button>
            ))}
          </div>

          {currentFlashSession ? (
            <div style={cardStyle}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                <div>
                  <h3 style={{ margin: 0 }}>{flashSlotDef.label}</h3>
                  <p style={{ color: C.gray, fontSize: 12, margin: '4px 0 0' }}>{flashSlotDef.description}</p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {isFlashLive(currentFlashSession) ? (
                    <>
                      <div style={{ fontSize: 22, fontWeight: 700, color: '#DC2626' }}>⏱ {countdown[selectedFlashSlot] || '–'}</div>
                      <div style={{ fontSize: 11, color: C.gray }}>còn lại</div>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 18, fontWeight: 700, color: '#D97706' }}>⏳ {formatCountdown(flashMsUntilStart(currentFlashSession))}</div>
                      <div style={{ fontSize: 11, color: C.gray }}>đến khi bắt đầu</div>
                    </>
                  )}
                </div>
              </div>

              {/* Flash chưa bắt đầu */}
              {!isFlashLive(currentFlashSession) && (
                <div style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid #FCD34D', borderRadius: 10, padding: '16px 18px', marginBottom: 16 }}>
                  <p style={{ margin: '0 0 6px', fontWeight: 700, color: '#92400E' }}>⏰ Phiên đấu giá Flash Sale sắp khai mạc!</p>
                  {currentFlashSession.description && (
                    <p style={{ margin: '0 0 6px', fontSize: 13, color: '#78350F', whiteSpace: 'pre-line' }}>📋 {currentFlashSession.description}</p>
                  )}
                  <p style={{ margin: 0, fontSize: 12, color: '#92400E' }}>
                    Khai mạc lúc: <b>{currentFlashSession.scheduledStartAt ? new Date(currentFlashSession.scheduledStartAt).toLocaleString('vi-VN') : '–'}</b>
                  </p>
                  <p style={{ margin: '6px 0 0', fontSize: 12, color: '#B45309' }}>Bạn có thể xem thông tin nhưng chưa thể đặt giá.</p>
                </div>
              )}

              <div style={{ marginBottom: 16 }}>
                <p style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Bảng đấu giá ({currentFlashSession.bids.length} lượt)</p>
                <div style={{ maxHeight: 200, overflowY: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                  {currentFlashSession.bids.slice(0, 20).map((bid, i) => (
                    <div key={bid.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: i === 0 ? C.orangeLight : 'transparent' }}>
                      <span style={{ fontSize: 13, fontWeight: i === 0 ? 700 : 400 }}>
                        {i === 0 && '👑 '}{bid.shopName}
                        {bid.shopName === SHOP_NAME && <span style={{ ...badgeStyle(C.orange, C.orangeLight), marginLeft: 6 }}>Bạn</span>}
                        <span style={{ color: C.gray, marginLeft: 8, fontSize: 12 }}>{bid.productName}</span>
                      </span>
                      <span style={{ fontWeight: 700, color: i === 0 ? C.orange : 'inherit' }}>{bid.amount.toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                  {currentFlashSession.bids.length === 0 && <p style={{ padding: 14, color: C.gray, fontSize: 13 }}>Chưa có ai đặt giá — hãy là người đầu tiên!</p>}
                </div>
              </div>

              <div style={{ marginBottom: 8 }}>
                <input
                  placeholder="Tên sản phẩm Flash Sale"
                  value={flashBidProducts[selectedFlashSlot] || ''}
                  onChange={e => setFlashBidProducts(p => ({ ...p, [selectedFlashSlot]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
              <div style={{ marginBottom: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[0, 50_000, 100_000, 200_000, 500_000].map(extra => {
                  const val = minFlashBid + extra
                  return (
                    <button key={extra} onClick={() => setFlashBidAmounts(p => ({ ...p, [selectedFlashSlot]: String(val) }))}
                      style={{ padding: '4px 10px', fontSize: 12, borderRadius: 6, border: `1px solid ${C.border}`, background: flashBidAmounts[selectedFlashSlot] === String(val) ? C.orange : 'transparent', color: flashBidAmounts[selectedFlashSlot] === String(val) ? 'white' : C.gray, cursor: 'pointer', fontWeight: 600 }}>
                      {extra === 0 ? 'Tối thiểu' : `+${(extra / 1000).toFixed(0)}k`} ({val.toLocaleString('vi-VN')}đ)
                    </button>
                  )
                })}
              </div>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  type="number" min={minFlashBid} step={50000}
                  placeholder={`Tối thiểu ${minFlashBid.toLocaleString('vi-VN')}đ`}
                  value={flashBidAmounts[selectedFlashSlot] || ''}
                  onChange={e => setFlashBidAmounts(p => ({ ...p, [selectedFlashSlot]: e.target.value }))}
                  style={{ flex: 1, minWidth: 160, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14 }}
                />
                <button
                  style={btnStyle(!isFlashLive(currentFlashSession) || flashCooldown > 0 ? '#9CA3AF' : C.orange)}
                  disabled={!isFlashLive(currentFlashSession) || flashCooldown > 0}
                  onClick={handlePlaceFlashBid}>
                  {!isFlashLive(currentFlashSession) ? '⏳ Chưa bắt đầu' : flashCooldown > 0 ? `Chờ ${Math.ceil(flashCooldown / 1000)}s` : '⚡ Đặt giá'}
                </button>
              </div>
            </div>
          ) : (
            <div style={cardStyle}>
              <p style={{ color: C.gray }}>🔒 Vị trí này đang bị Admin tạm khoá hoặc chưa mở phiên đấu giá.</p>
            </div>
          )}
        </>
      )}

      {/* ── Tab: Giao dịch của tôi ───────────────────────────────────────── */}
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
          <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>
            Chuẩn bị mẫu banner / sản phẩm <b>trước khi đặt giá</b>. Khi bạn đặt cọc thành công, mẫu sẽ tự động gửi Admin duyệt.
          </p>

          {/* ── Banner mẫu ──────────────────────────── */}
          <div style={cardStyle}>
            <h3 style={{ marginBottom: 12, fontSize: 15, margin: '0 0 12px' }}>🖼️ Mẫu Banner quảng cáo</h3>

            {/* Chọn vị trí */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {BANNER_POSITIONS.map(p => (
                <button key={p.key} onClick={() => setPrepBannerPos(p.key)}
                  style={{ ...btnStyle(prepBannerPos === p.key ? C.primary : 'transparent', prepBannerPos === p.key ? 'white' : C.gray), border: `1px solid ${prepBannerPos === p.key ? C.primary : C.border}`, fontSize: 12 }}>
                  {bannerDraftsExist[p.key] ? '✅ ' : ''}{p.label}
                </button>
              ))}
            </div>

            {/* Form theo vị trí đang chọn */}
            {(() => {
              const posKey = prepBannerPos
              const spec = BANNER_IMAGE_SPECS[posKey]
              const form = prepBannerForms[posKey] ?? { title: '', link: '', image: '' }
              const imgErr = prepBannerImgErr[posKey] ?? ''
              const draft = getBannerDraft(posKey, SHOP_NAME)
              return (
                <div>
                  <p style={{ fontSize: 12, color: C.blue, background: C.blueLight, padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
                    📐 Tỉ lệ <b>{spec.ratioLabel}</b> — {spec.recommendedW}×{spec.recommendedH}px — tối đa {spec.maxKB.toLocaleString()}KB
                  </p>
                  {draft && (
                    <div style={{ background: C.primaryLight, border: `1px solid ${C.primary}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12 }}>
                      ✅ Mẫu hiện tại: <b>{draft.title}</b> — cập nhật {new Date(draft.updatedAt).toLocaleString('vi-VN')}
                      {draft.image && <img src={draft.image} alt="draft" style={{ display: 'block', marginTop: 8, maxWidth: '100%', maxHeight: 100, objectFit: 'cover', borderRadius: 6 }} />}
                    </div>
                  )}
                  <input placeholder="Tiêu đề banner *" value={form.title}
                    onChange={e => setPrepBannerForms(f => ({ ...f, [posKey]: { ...(f[posKey] ?? { title: '', link: '', image: '' }), title: e.target.value } }))}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }} />
                  <input placeholder="Đường dẫn khi click (tuỳ chọn)" value={form.link}
                    onChange={e => setPrepBannerForms(f => ({ ...f, [posKey]: { ...(f[posKey] ?? { title: '', link: '', image: '' }), link: e.target.value } }))}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }} />
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>Ảnh banner{draft ? ' (để trống = giữ ảnh cũ)' : ' *'}</label>
                    <input type="file" accept="image/*"
                      onChange={async e => {
                        const file = e.target.files?.[0]; if (!file) return
                        const res = await validateImageFile(file, spec)
                        if (!res.ok) { setPrepBannerImgErr(p => ({ ...p, [posKey]: res.error! })); return }
                        setPrepBannerImgErr(p => ({ ...p, [posKey]: '' }))
                        setPrepBannerForms(f => ({ ...f, [posKey]: { ...(f[posKey] ?? { title: '', link: '', image: '' }), image: res.dataUrl! } }))
                      }} />
                    {imgErr && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>{imgErr}</p>}
                    {form.image && !imgErr && <img src={form.image} alt="preview" style={{ marginTop: 8, maxWidth: '100%', maxHeight: 120, borderRadius: 8, border: `1px solid ${C.border}` }} />}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      disabled={!!prepBannerSaved[posKey]}
                      style={{ ...btnStyle(prepBannerSaved[posKey] ? '#9CA3AF' : C.primary), cursor: prepBannerSaved[posKey] ? 'not-allowed' : 'pointer', opacity: prepBannerSaved[posKey] ? 0.55 : 1 }}
                      onClick={() => {
                        if (!form.title.trim()) { toast.error('Vui lòng nhập tiêu đề banner'); return }
                        if (!form.image && !draft?.image) { toast.error('Vui lòng chọn ảnh banner'); return }
                        if (imgErr) { toast.error(imgErr); return }
                        saveBannerDraft({ position: posKey, shopName: SHOP_NAME, title: form.title.trim(), link: form.link.trim() || undefined, image: form.image || draft!.image, updatedAt: new Date().toISOString() })
                        setPrepBannerSaved(p => ({ ...p, [posKey]: true }))
                        checkDrafts()
                        toast.success('✅ Đã lưu mẫu banner!')
                      }}>
                      💾 Lưu mẫu banner
                    </button>
                    {prepBannerSaved[posKey] && (
                      <button style={{ ...btnStyle('transparent', C.primary), border: `1px solid ${C.primary}` }}
                        onClick={() => setPrepBannerSaved(p => ({ ...p, [posKey]: false }))}>
                        ✏️ Chỉnh sửa
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>

          {/* ── Flash Sale mẫu ──────────────────────── */}
          <div style={cardStyle}>
            <h3 style={{ margin: '0 0 12px', fontSize: 15 }}>⚡ Mẫu sản phẩm Flash Sale</h3>

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
              {FLASH_SLOTS.map(s => (
                <button key={s.key} onClick={() => setPrepFlashSlot(s.key)}
                  style={{ ...btnStyle(prepFlashSlot === s.key ? C.orange : 'transparent', prepFlashSlot === s.key ? 'white' : C.gray), border: `1px solid ${prepFlashSlot === s.key ? C.orange : C.border}`, fontSize: 12 }}>
                  {flashDraftsExist[s.key] ? '✅ ' : ''}{s.label}
                </button>
              ))}
            </div>

            {(() => {
              const slotKey = prepFlashSlot
              const form = prepFlashForms[slotKey] ?? { productName: '', price: '', image: '' }
              const imgErr = prepFlashImgErr[slotKey] ?? ''
              const draft = getFlashDraft(slotKey, SHOP_NAME)
              return (
                <div>
                  <p style={{ fontSize: 12, color: C.orange, background: C.orangeLight, padding: '8px 12px', borderRadius: 8, marginBottom: 12 }}>
                    📐 Tỉ lệ <b>{FLASH_IMAGE_SPEC.ratioLabel}</b> — {FLASH_IMAGE_SPEC.recommendedW}×{FLASH_IMAGE_SPEC.recommendedH}px — tối đa {FLASH_IMAGE_SPEC.maxKB.toLocaleString()}KB
                  </p>
                  {draft && (
                    <div style={{ background: C.orangeLight, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '10px 14px', marginBottom: 12, fontSize: 12 }}>
                      ✅ Mẫu hiện tại: <b>{draft.productName}</b> — {draft.price.toLocaleString('vi-VN')}đ
                      {draft.productImage && <img src={draft.productImage} alt="draft" style={{ display: 'block', marginTop: 8, maxWidth: 100, borderRadius: 6 }} />}
                    </div>
                  )}
                  <input placeholder="Tên sản phẩm Flash Sale *" value={form.productName}
                    onChange={e => setPrepFlashForms(f => ({ ...f, [slotKey]: { ...(f[slotKey] ?? { productName: '', price: '', image: '' }), productName: e.target.value } }))}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }} />
                  <input placeholder="Giá Flash Sale (đ) *" type="number" value={form.price}
                    onChange={e => setPrepFlashForms(f => ({ ...f, [slotKey]: { ...(f[slotKey] ?? { productName: '', price: '', image: '' }), price: e.target.value } }))}
                    style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }} />
                  <div style={{ marginBottom: 14 }}>
                    <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 6 }}>Ảnh sản phẩm{draft ? ' (để trống = giữ ảnh cũ)' : ' *'}</label>
                    <input type="file" accept="image/*"
                      onChange={async e => {
                        const file = e.target.files?.[0]; if (!file) return
                        const res = await validateImageFile(file, FLASH_IMAGE_SPEC)
                        if (!res.ok) { setPrepFlashImgErr(p => ({ ...p, [slotKey]: res.error! })); return }
                        setPrepFlashImgErr(p => ({ ...p, [slotKey]: '' }))
                        setPrepFlashForms(f => ({ ...f, [slotKey]: { ...(f[slotKey] ?? { productName: '', price: '', image: '' }), image: res.dataUrl! } }))
                      }} />
                    {imgErr && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>{imgErr}</p>}
                    {form.image && !imgErr && <img src={form.image} alt="preview" style={{ marginTop: 8, maxWidth: 120, borderRadius: 8, border: `1px solid ${C.border}` }} />}
                  </div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <button
                      disabled={!!prepFlashSaved[slotKey]}
                      style={{ ...btnStyle(prepFlashSaved[slotKey] ? '#9CA3AF' : C.orange), cursor: prepFlashSaved[slotKey] ? 'not-allowed' : 'pointer', opacity: prepFlashSaved[slotKey] ? 0.55 : 1 }}
                      onClick={() => {
                        const priceNum = Number(form.price)
                        if (!form.productName.trim()) { toast.error('Vui lòng nhập tên sản phẩm'); return }
                        if (!priceNum || priceNum <= 0) { toast.error('Vui lòng nhập giá hợp lệ'); return }
                        if (!form.image && !draft?.productImage) { toast.error('Vui lòng chọn ảnh sản phẩm'); return }
                        if (imgErr) { toast.error(imgErr); return }
                        saveFlashDraft({ slot: slotKey, shopName: SHOP_NAME, productName: form.productName.trim(), price: priceNum, productImage: form.image || draft!.productImage, updatedAt: new Date().toISOString() })
                        setPrepFlashSaved(p => ({ ...p, [slotKey]: true }))
                        checkDrafts()
                        toast.success('✅ Đã lưu mẫu sản phẩm Flash Sale!')
                      }}>
                      💾 Lưu mẫu sản phẩm
                    </button>
                    {prepFlashSaved[slotKey] && (
                      <button style={{ ...btnStyle('transparent', C.orange), border: `1px solid ${C.orange}` }}
                        onClick={() => setPrepFlashSaved(p => ({ ...p, [slotKey]: false }))}>
                        ✏️ Chỉnh sửa
                      </button>
                    )}
                  </div>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* ── Submit Modal ──────────────────────────────────────────────────── */}
      {submitTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: C.cardBg, borderRadius: 16, padding: 28, width: 480, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            {submitTarget.kind === 'banner' ? (
              <>
                <h3 style={{ marginBottom: 4 }}>📢 Đăng banner quảng cáo</h3>
                <p style={{ color: C.gray, fontSize: 12, marginBottom: 16 }}>Điền thông tin banner cho vị trí <b>{BANNER_POSITIONS.find(p => p.key === (submitTarget.session as BannerAuctionSession).position)?.label}</b></p>
                {(() => {
                  const spec = BANNER_IMAGE_SPECS[(submitTarget.session as BannerAuctionSession).position]
                  return <p style={{ fontSize: 12, color: C.blue, background: C.blueLight, padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>📐 Yêu cầu ảnh: tỉ lệ <b>{spec.ratioLabel}</b> — khuyến nghị {spec.recommendedW}×{spec.recommendedH}px — tối đa {spec.maxKB.toLocaleString()}KB</p>
                })()}
                <input placeholder="Tiêu đề banner *" value={bannerForm.title} onChange={e => setBannerForm(f => ({ ...f, title: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }} />
                <input placeholder="Đường dẫn khi click (tuỳ chọn)" value={bannerForm.link} onChange={e => setBannerForm(f => ({ ...f, link: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }} />
                <div style={{ marginBottom: 10 }}>
                  <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleBannerImageFile(e.target.files[0])} />
                  {bannerImgError && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>{bannerImgError}</p>}
                  {bannerForm.image && !bannerImgError && <img src={bannerForm.image} alt="preview" style={{ marginTop: 8, maxWidth: '100%', borderRadius: 8 }} />}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button style={btnStyle('#6B7280')} onClick={() => setSubmitTarget(null)}>Huỷ</button>
                  <button style={btnStyle(C.primary)} onClick={handleSubmitBanner}>Gửi duyệt</button>
                </div>
              </>
            ) : (
              <>
                <h3 style={{ marginBottom: 4 }}>📦 Đăng sản phẩm Flash Sale</h3>
                <p style={{ color: C.gray, fontSize: 12, marginBottom: 16 }}>Điền thông tin sản phẩm cho <b>{FLASH_SLOTS.find(s => s.key === (submitTarget.session as FlashAuctionSession).slot)?.label}</b></p>
                <p style={{ fontSize: 12, color: C.orange, background: C.orangeLight, padding: '8px 12px', borderRadius: 8, marginBottom: 14 }}>📐 Yêu cầu ảnh: tỉ lệ <b>{FLASH_IMAGE_SPEC.ratioLabel}</b> — khuyến nghị {FLASH_IMAGE_SPEC.recommendedW}×{FLASH_IMAGE_SPEC.recommendedH}px — tối đa {FLASH_IMAGE_SPEC.maxKB.toLocaleString()}KB</p>
                <input placeholder="Tên sản phẩm *" value={flashForm.productName} onChange={e => setFlashForm(f => ({ ...f, productName: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }} />
                <input placeholder="Giá bán Flash Sale (đ) *" type="number" value={flashForm.price} onChange={e => setFlashForm(f => ({ ...f, price: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, marginBottom: 10, boxSizing: 'border-box' }} />
                <div style={{ marginBottom: 10 }}>
                  <input type="file" accept="image/*" onChange={e => e.target.files?.[0] && handleFlashImageFile(e.target.files[0])} />
                  {flashImgError && <p style={{ color: '#DC2626', fontSize: 12, marginTop: 4 }}>{flashImgError}</p>}
                  {flashForm.image && !flashImgError && <img src={flashForm.image} alt="preview" style={{ marginTop: 8, maxWidth: 160, borderRadius: 8 }} />}
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                  <button style={btnStyle('#6B7280')} onClick={() => setSubmitTarget(null)}>Huỷ</button>
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

              {/* Header */}
              <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(220,38,38,0.06)' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: '#DC2626' }}>❌ Nội dung bị từ chối</div>
                  <div style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>{posLabel} · {new Date(sub.createdAt).toLocaleString('vi-VN')}</div>
                </div>
                <button onClick={() => setRejectedModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ overflowY: 'auto', flex: 1 }}>
                {/* Ảnh vi phạm */}
                {image ? (
                  <div style={{ background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 180, maxHeight: 280, overflow: 'hidden' }}>
                    <img src={image} alt="nội dung bị từ chối" style={{ width: '100%', maxHeight: 280, objectFit: isBanner ? 'cover' : 'contain', display: 'block' }} />
                               </div>
                ) : (
                  <div style={{ height: 120, background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray }}>Không có ảnh</div>
                )}

                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color: isBanner ? C.blue : C.orange, background: isBanner ? C.blueLight : C.orangeLight }}>
                      {isBanner ? '🖼️ Banner' : '⚡ Flash Sale'}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{title}</span>
                  </div>

                  {isBanner && bs.link && (
                    <div style={{ fontSize: 12, color: C.blue }}>🔗 {bs.link}</div>
                  )}
                  {!isBanner && (
                    <div style={{ fontSize: 13, color: C.gray }}>💰 Giá: <b style={{ color: C.orange }}>{Number(fs.price).toLocaleString('vi-VN')}đ</b></div>
                  )}

                  <div style={{ background: 'rgba(220,38,38,0.07)', border: '1.5px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '14px 16px' }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: '#DC2626', marginBottom: 8 }}>📋 Lý do từ chối</div>
                    {rejectReason ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {rejectReason.split(' · ').map((r, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 13 }}>
                            <span style={{ color: '#DC2626', flexShrink: 0, marginTop: 1 }}>•</span>
                            <span>{r}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, color: C.gray }}>Admin không ghi rõ lý do.</div>
                    )}
                  </div>

                  <div style={{ background: C.primaryLight, borderRadius: 8, padding: '10px 14px', fontSize: 12, color: C.primary }}>
                    💡 Vui lòng chỉnh sửa nội dung theo đúng chính sách, sau đó vào tab <b>⚙️ Chuẩn bị</b> để cập nhật mẫu và tham giá đấu giá lại.
                  </div>
                </div>
              </div>

              <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', color: C.gray }} onClick={() => setRejectedModal(null)}>Đóng</button>
                <button style={{ background: C.primary, color: 'white', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                  onClick={() => { setRejectedModal(null); setTab('prepare') }}>
                  ⚙️ Cập nhật mẫu
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
