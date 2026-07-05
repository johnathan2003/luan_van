/**
 * 🖼️ Banner Admin — Quản lý banner quảng cáo (thường + đấu giá)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import { addNotificationFor } from '../../utils/notificationStore'
import {
  BANNER_POSITIONS, BannerSubmission,
  getAllSubmissions as getAuctionBannerSubs,
  approveSubmission as approveAuctionBanner,
  rejectSubmission as rejectAuctionBanner,
  cancelSubmissionExpired,
  getHistory as getBannerHistory,
} from '../../utils/bannerAuctionStore'
import {
  FLASH_SLOTS, FlashSubmission,
  getAllFlashSubmissions,
  approveFlashSubmission,
  rejectFlashSubmission,
  cancelFlashSubmissionExpired,
  getHistory as getFlashHistory,
} from '../../utils/flashSaleAuctionStore'

// ── Reminder dedup (localStorage) ────────────────────────────────────────────
const REMINDER_KEY = 'buyzo_payment_reminders_v1'
function getSentReminders(): Record<string, number[]> {
  try { return JSON.parse(localStorage.getItem(REMINDER_KEY) || '{}') } catch { return {} }
}
function markReminderSent(subId: string, remainMin: number) {
  const data = getSentReminders()
  data[subId] = [...(data[subId] || []), remainMin]
  localStorage.setItem(REMINDER_KEY, JSON.stringify(data))
}
function hasReminderSent(subId: string, remainMin: number): boolean {
  return (getSentReminders()[subId] || []).includes(remainMin)
}
function formatMmSs(ms: number): string {
  if (ms <= 0) return '00:00'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

const C = {
  navy: '#1E3A8A', blue: '#2563EB', blueLight: 'rgba(37,99,235,0.1)',
  orange: '#EA580C', orangeLight: 'rgba(234,88,12,0.1)',
  light: '#DBEAFE', tint: '#EFF6FF',
  gray: '#64748B', border: 'var(--border-subtle)', cardBg: 'var(--bg-card)',
  success: '#16A34A', successLight: 'rgba(22,163,74,0.1)',
  warning: '#D97706', warningLight: '#FEF3C7',
  error: '#DC2626', errorLight: '#FEE2E2',
  purple: '#7C3AED', purpleLight: 'rgba(124,58,237,0.1)',
}

const REJECT_PRESETS = [
  'Nội dung và hình ảnh tình dục',
  'Thù ghét và quấy rối',
  'Bạo lực hoặc lạm dụng',
  'An toàn của trẻ em',
  'Thông tin sai lệch hoặc nội dung do AI tạo',
  'Tự tử và tự làm hại bản thân',
  'Nội dung định hướng thương hiệu không được tiết lộ',
  'Sản phẩm nhái và quyền sở hữu trí tuệ',
]

const btnStyle = (bg: string, color = 'white', small = false): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 8,
  padding: small ? '6px 14px' : '8px 18px', fontSize: small ? 12 : 13,
  fontWeight: 600, cursor: 'pointer',
})
const badge = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color, background: bg,
})

type RegularBanner = any
type AuctionSub = { kind: 'banner'; sub: BannerSubmission } | { kind: 'flash'; sub: FlashSubmission }

const BannerAdminPage: React.FC = () => {
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected'>('pending')

  // Regular banners (API)
  const [banners, setBanners] = useState<RegularBanner[]>([])
  const [loadingApi, setLoadingApi] = useState(true)

  // Auction submissions (localStorage)
  const [auctionSubs, setAuctionSubs] = useState<AuctionSub[]>([])
  const [bannerHistory, setBannerHistory] = useState<any[]>([])
  const [flashHistory, setFlashHistory] = useState<any[]>([])

  // Countdown: subId → remaining ms
  const [countdowns, setCountdowns] = useState<Record<string, number>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<{ kind: 'banner' | 'flash'; id: string } | null>(null)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [customReason, setCustomReason] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  const openRejectModal = (kind: 'banner' | 'flash', id: string) => {
    setRejectTarget({ kind, id })
    setSelectedReasons([])
    setCustomReason('')
    setShowCustom(false)
  }

  const toggleReason = (reason: string) => {
    setSelectedReasons(prev =>
      prev.includes(reason) ? prev.filter(r => r !== reason) : [...prev, reason]
    )
  }

  const loadApi = async () => {
    setLoadingApi(true)
    try {
      const res = await adminService.getBanners()
      setBanners(res.data?.banners ?? res.data ?? [])
    } catch {
      setBanners([])
    } finally {
      setLoadingApi(false)
    }
  }

  const loadAuction = useCallback(() => {
    const bannerSubs = getAuctionBannerSubs()
    const flashSubs = getAllFlashSubmissions()
    const combined: AuctionSub[] = [
      ...bannerSubs.map(s => ({ kind: 'banner' as const, sub: s })),
      ...flashSubs.map(s => ({ kind: 'flash' as const, sub: s })),
    ]
    setAuctionSubs(combined)
    setBannerHistory(getBannerHistory())
    setFlashHistory(getFlashHistory())
  }, [])

  useEffect(() => {
    loadApi()
    loadAuction()
  }, [loadAuction])

  // ── Countdown + reminder interval ──────────────────────────────────────────
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const allSubs: Array<{ kind: 'banner' | 'flash'; sub: BannerSubmission | FlashSubmission }> = [
        ...getAuctionBannerSubs().map(s => ({ kind: 'banner' as const, sub: s })),
        ...getAllFlashSubmissions().map(s => ({ kind: 'flash' as const, sub: s })),
      ]
      const next: Record<string, number> = {}
      let needReload = false

      allSubs.forEach(({ kind, sub }) => {
        if (sub.status !== 'approved') return
        // Auto-patch: nếu approved nhưng chưa có paymentDeadline (data cũ), gán mới
        if (!sub.paymentDeadline) {
          if (kind === 'banner') approveAuctionBanner(sub.id)
          else approveFlashSubmission(sub.id)
          needReload = true
          return // interval tick tiếp theo sẽ có deadline
        }
        // Kiểm tra đã thanh toán đủ chưa
        const remaining = new Date(sub.paymentDeadline).getTime() - Date.now()
        next[sub.id] = remaining

        const remainMin = Math.ceil(remaining / 60000)

        if (remaining <= 0) {
          // Hết giờ → auto cancel
          if (kind === 'banner') cancelSubmissionExpired(sub.id)
          else cancelFlashSubmissionExpired(sub.id)
          needReload = true
          // Thông báo hủy cho shop
          const name = (sub as BannerSubmission).title || (sub as FlashSubmission).productName
          addNotificationFor('', 'shop', 0, {
            title: '❌ Banner bị hủy do không thanh toán',
            message: `"${name}" đã bị hủy vì shop không thanh toán phần còn lại trong thời hạn 30 phút. Tiền cọc 20% sẽ không được hoàn trả.`,
            type: 'payment_expired',
            action_url: '/shop/auction',
          })
          return
        }

        // Nhắc nhở định kỳ: mỗi 10 phút 1 lần (còn 20 phút, còn 10 phút)
        const reminderMilestonesEvery10 = [20, 10]
        reminderMilestonesEvery10.forEach(m => {
          if (remainMin <= m && remainMin > m - 1 && !hasReminderSent(sub.id, m)) {
            markReminderSent(sub.id, m)
            const name = (sub as BannerSubmission).title || (sub as FlashSubmission).productName
            addNotificationFor('', 'shop', 0, {
              title: `⏰ Còn ${m} phút để thanh toán!`,
              message: `Banner "${name}" sẽ bị hủy nếu chưa thanh toán phần còn lại trong ${m} phút. Vào Giao dịch của tôi để thanh toán ngay.`,
              type: 'payment_reminder',
              action_url: '/shop/auction',
            })
          }
        })

        // Còn ≤ 5 phút → nhắc mỗi 1 phút
        if (remainMin <= 5 && remainMin > 0) {
          const key = remainMin // phút còn lại làm key dedup
          if (!hasReminderSent(sub.id, key)) {
            markReminderSent(sub.id, key)
            const name = (sub as BannerSubmission).title || (sub as FlashSubmission).productName
            addNotificationFor('', 'shop', 0, {
              title: `🚨 Khẩn cấp! Còn ${key} phút để thanh toán!`,
              message: `Chỉ còn ${key} phút — banner "${name}" sẽ bị hủy và mất cọc 20% nếu không thanh toán ngay!`,
              type: 'payment_reminder_urgent',
              action_url: '/shop/auction',
            })
          }
        }
      })

      setCountdowns(next)
      if (needReload) loadAuction()
    }, 1000)

    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [loadAuction])

  // ── Regular banner actions ──────────────────────────────────────────
  const approve = async (id: number) => {
    await adminService.updateBanner(id, { status: 'active' })
    setBanners(bs => bs.map(b => b.banner_id === id ? { ...b, status: 'active' } : b))
    toast.success('✅ Banner đã được duyệt!')
  }
  const rejectRegular = async (id: number) => {
    await adminService.updateBanner(id, { status: 'rejected' })
    setBanners(bs => bs.map(b => b.banner_id === id ? { ...b, status: 'rejected' } : b))
  }
  const remove = async (id: number) => {
    if (!window.confirm('Xóa banner này?')) return
    await adminService.deleteBanner(id)
    setBanners(bs => bs.filter(b => b.banner_id !== id))
  }
  const moveUp = async (id: number, idx: number) => {
    const activeList = banners.filter(b => b.status === 'active')
    if (idx <= 0) return
    const prev = activeList[idx - 1]
    await Promise.all([
      adminService.updateBanner(id, { display_order: prev.display_order }),
      adminService.updateBanner(prev.banner_id, { display_order: activeList[idx].display_order }),
    ])
    loadApi()
  }

  // ── Auction submission actions ──────────────────────────────────────
  const handleApprove = (kind: 'banner' | 'flash', id: string) => {
    // Lấy thông tin trước khi approve để gửi notification
    const found = auctionSubs.find(({ sub }) => sub.id === id)
    if (kind === 'banner') approveAuctionBanner(id)
    else approveFlashSubmission(id)
    loadAuction()
    toast.success('✅ Đã duyệt! Banner sẽ hiển thị sau khi thanh toán đủ.')
    // 🔔 Thông báo cho shop
    if (found) {
      const { sub } = found
      const isBanner = kind === 'banner'
      const posLabel = isBanner
        ? BANNER_POSITIONS.find(p => p.key === (sub as BannerSubmission).position)?.label
        : FLASH_SLOTS.find(s => s.key === (sub as FlashSubmission).slot)?.label
      addNotificationFor('', 'shop', 0, {
        title: '✅ Banner của bạn đã được duyệt!',
        message: `${isBanner ? 'Banner' : 'Sản phẩm Flash Sale'} "${isBanner ? (sub as BannerSubmission).title : (sub as FlashSubmission).productName}" (${posLabel}) đã được duyệt. Vui lòng hoàn tất thanh toán để hiển thị trên trang chủ.`,
        type: 'banner_approved',
        action_url: '/shop/auction',
      })
    }
    setTab('active')
  }

  const handleReject = () => {
    if (!rejectTarget) return
    const parts = [...selectedReasons]
    if (showCustom && customReason.trim()) parts.push(customReason.trim())
    const reason = parts.join(' · ')
    // Lấy thông tin trước khi reject để gửi notification
    const found = auctionSubs.find(({ sub }) => sub.id === rejectTarget.id)
    if (rejectTarget.kind === 'banner') rejectAuctionBanner(rejectTarget.id, reason || undefined)
    else rejectFlashSubmission(rejectTarget.id, reason || undefined)
    setRejectTarget(null)
    loadAuction()
    toast('❌ Đã từ chối.')
    // 🔔 Thông báo từ chối cho shop
    if (found) {
      const { kind, sub } = found
      const isBanner = kind === 'banner'
      const posLabel = isBanner
        ? BANNER_POSITIONS.find(p => p.key === (sub as BannerSubmission).position)?.label
        : FLASH_SLOTS.find(s => s.key === (sub as FlashSubmission).slot)?.label
      addNotificationFor('', 'shop', 0, {
        title: '❌ Banner của bạn bị từ chối',
        message: `${isBanner ? 'Banner' : 'Sản phẩm Flash Sale'} "${isBanner ? (sub as BannerSubmission).title : (sub as FlashSubmission).productName}" (${posLabel}) đã bị từ chối${reason ? ': ' + reason : ''}. Nhấn để xem chi tiết.`,
        type: 'banner_rejected',
        action_url: `/shop/auction?rejected_id=${sub.id}&rejected_kind=${kind}`,
      })
    }
  }

  // ── Counts ───────────────────────────────────────────────────────────
  const pendingCount  = banners.filter(b => b.status === 'pending').length  + auctionSubs.filter(({ sub }) => sub.status === 'pending').length
  const activeCount   = banners.filter(b => b.status === 'active').length   + auctionSubs.filter(({ sub }) => sub.status === 'approved').length
  const rejectedCount = banners.filter(b => b.status === 'rejected').length + auctionSubs.filter(({ sub }) => sub.status === 'rejected').length
  const counts = { pending: pendingCount, active: activeCount, rejected: rejectedCount }

  const regularByTab = banners.filter(b => b.status === tab)
  const auctionFiltered = tab === 'active'
    ? auctionSubs.filter(({ sub }) => sub.status === 'approved')
    : tab === 'rejected'
    ? auctionSubs.filter(({ sub }) => sub.status === 'rejected')
    : auctionSubs.filter(({ sub }) => sub.status === 'pending')

  const statusColor: Record<string, string> = { active: C.success, pending: C.warning, rejected: C.error }
  const statusLabel: Record<string, string>  = { active: 'Hiển thị', pending: 'Chờ duyệt', rejected: 'Từ chối' }

  // ── Auction card renderer ────────────────────────────────────────────
  const renderAuctionCard = ({ kind, sub }: AuctionSub) => {
    const image = (sub as any).image || (sub as any).productImage
    const isBanner = kind === 'banner'
    const posLabel = isBanner
      ? BANNER_POSITIONS.find(p => p.key === (sub as BannerSubmission).position)?.label
      : FLASH_SLOTS.find(s => s.key === (sub as FlashSubmission).slot)?.label
    const histEntry = isBanner
      ? bannerHistory.find(h => h.id === sub.historyId)
      : flashHistory.find(h => h.id === sub.historyId)
    const totalAmount   = histEntry?.winner?.amount ?? 0
    const depositAmount = histEntry?.depositAmount ?? Math.ceil(totalAmount * 0.2)
    const remaining     = totalAmount - depositAmount
    const isPaid        = histEntry?.confirmation === 'paid'
    const bannerLink    = isBanner ? (sub as BannerSubmission).link : undefined
    const rejectReason  = (sub as any).rejectReason as string | undefined

    return (
      <div key={sub.id} className="card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column', marginBottom: 0 }}>
        {/* Ảnh full-width */}
        {image ? (
          <div style={{ background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 160, maxHeight: 260, overflow: 'hidden' }}>
            <img src={image} alt="preview" style={{ width: '100%', maxHeight: 260, objectFit: isBanner ? 'cover' : 'contain', display: 'block' }} />
          </div>
        ) : (
          <div style={{ height: 100, background: 'rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>Không có ảnh</div>
        )}

        <div style={{ padding: '14px 16px', flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Badge + tên */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={badge(isBanner ? C.blue : C.orange, isBanner ? C.blueLight : C.orangeLight)}>
                {isBanner ? '🖼️ Banner' : '⚡ Flash Sale'}
              </span>
              <span style={{ fontSize: 11, color: C.gray }}>{posLabel}</span>
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 2 }}>
              {isBanner ? (sub as BannerSubmission).title : (sub as FlashSubmission).productName}
            </div>
            {bannerLink && <div style={{ fontSize: 11, color: C.blue, wordBreak: 'break-all' }}>🔗 {bannerLink}</div>}
            <div style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>
              Shop: <b>{sub.shopName}</b> · {new Date(sub.createdAt).toLocaleString('vi-VN')}
            </div>
          </div>

          {/* Thanh toán */}
          {totalAmount > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, background: isBanner ? C.blueLight : C.orangeLight, borderRadius: 8, padding: '10px 12px' }}>
              <div>
                <div style={{ fontSize: 10, color: C.gray, marginBottom: 2 }}>💰 Giá thắng</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: isBanner ? C.blue : C.orange }}>{totalAmount.toLocaleString('vi-VN')}đ</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.gray, marginBottom: 2 }}>✅ Đã cọc</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: C.success }}>{depositAmount.toLocaleString('vi-VN')}đ</div>
              </div>
              <div>
                <div style={{ fontSize: 10, color: C.gray, marginBottom: 2 }}>⏳ Còn lại</div>
                <div style={{ fontWeight: 700, fontSize: 13, color: isPaid ? C.success : C.warning }}>
                  {isPaid ? '✅ Đã TT đủ' : `${remaining.toLocaleString('vi-VN')}đ`}
                </div>
              </div>
            </div>
          )}

          {/* Trạng thái hiển thị + countdown (tab active) */}
          {sub.status === 'approved' && (() => {
            // Nếu chưa có deadline (data cũ) — đang tự patch, hiện loading
            if (!sub.paymentDeadline) {
              return (
                <div style={{ borderRadius: 8, padding: '10px 14px', background: C.warningLight, border: `1px solid ${C.warningLight}`, fontSize: 13, color: C.warning, fontWeight: 600 }}>
                  ⏳ Đang thiết lập thời hạn thanh toán...
                </div>
              )
            }
            const remMs = countdowns[sub.id] ?? (new Date(sub.paymentDeadline).getTime() - Date.now())
            const isUrgent = !isPaid && remMs > 0 && remMs <= 5 * 60 * 1000
            const totalMs = new Date(sub.paymentDeadline).getTime() - new Date(sub.approvedAt!).getTime()
            const pct = (!isPaid && remMs > 0)
              ? Math.max(0, Math.min(100, (remMs / totalMs) * 100))
              : null
            return (
              <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${isPaid ? 'rgba(22,163,74,0.25)' : isUrgent ? 'rgba(220,38,38,0.3)' : 'rgba(217,119,6,0.3)'}` }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 14px', fontSize: 13, fontWeight: 600,
                  background: isPaid ? C.successLight : isUrgent ? 'rgba(220,38,38,0.08)' : C.warningLight,
                  color: isPaid ? C.success : isUrgent ? '#DC2626' : C.warning,
                }}>
                  <span>
                    {isPaid ? '🟢 Đang hiển thị trên trang chủ'
                      : remMs > 0 ? `${isUrgent ? '🚨' : '⏳'} Chờ shop thanh toán — còn ${formatMmSs(remMs)}`
                      : '❌ Hết hạn thanh toán'}
                  </span>
                  {!isPaid && remMs > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 400, opacity: 0.75 }}>
                      Hạn: {new Date(sub.paymentDeadline).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  )}
                </div>
                {pct !== null && (
                  <div style={{ height: 5, background: 'rgba(0,0,0,0.07)' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: isUrgent ? '#DC2626' : C.warning, transition: 'width 1s linear', borderRadius: '0 3px 3px 0' }} />
                  </div>
                )}
              </div>
            )
          })()}

          {/* Lý do từ chối */}
          {sub.status === 'rejected' && (
            <div style={{ padding: '10px 14px', borderRadius: 8, background: C.errorLight, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: C.error }}>❌ Từ chối</span>
              {rejectReason && <span style={{ color: C.error, marginLeft: 6 }}>· {rejectReason}</span>}
            </div>
          )}

          {/* Nút hành động (chỉ pending) */}
          {sub.status === 'pending' && (
            <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
              <button style={{ ...btnStyle(C.successLight, C.success), flex: 1 }} onClick={() => handleApprove(kind, sub.id)}>✅ Duyệt</button>
              <button style={{ ...btnStyle(C.errorLight, C.error), flex: 1 }} onClick={() => openRejectModal(kind, sub.id)}>❌ Từ chối</button>
            </div>
          )}

          {/* Nút nhắc thủ công (tab active, chưa thanh toán, còn thời gian) */}
          {sub.status === 'approved' && !isPaid && sub.paymentDeadline && (countdowns[sub.id] ?? 1) > 0 && (
            <button
              style={{ ...btnStyle('rgba(37,99,235,0.1)', C.blue), width: '100%', marginTop: 4 }}
              onClick={() => {
                const name = (sub as BannerSubmission).title || (sub as FlashSubmission).productName
                const remMs = countdowns[sub.id] ?? (new Date(sub.paymentDeadline!).getTime() - Date.now())
                const remMin = Math.ceil(remMs / 60000)
                addNotificationFor('', 'shop', 0, {
                  title: `⏰ Nhắc nhở: Còn ${remMin} phút thanh toán!`,
                  message: `Admin nhắc: Banner "${name}" cần thanh toán phần còn lại trong ${remMin} phút. Truy cập Giao dịch của tôi để thanh toán ngay.`,
                  type: 'payment_reminder',
                  action_url: '/shop/auction',
                })
                toast.success('🔔 Đã gửi nhắc nhở tới shop!')
              }}>
              🔔 Nhắc thanh toán ngay
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🖼️ Quản lý Banner</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Duyệt banner thường và banner đấu giá từ cửa hàng</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {(['pending', 'active', 'rejected'] as const).map(s => (
          <div key={s} className="card" style={{
            padding: '14px 18px', borderLeft: `3px solid ${statusColor[s]}`,
            cursor: 'pointer', background: tab === s ? C.tint : C.cardBg,
          }} onClick={() => setTab(s)}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{statusLabel[s]}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: statusColor[s] }}>{counts[s]}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 8 }}>
        {(['pending', 'active', 'rejected'] as const).map(s => (
          <button key={s} onClick={() => setTab(s)} style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: tab === s ? statusColor[s] : C.tint, color: tab === s ? 'white' : C.gray,
          }}>{statusLabel[s]}</button>
        ))}
      </div>

      {/* ── Banner thường (API) ──────────────────────────────────────────── */}
      {!loadingApi && regularByTab.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1 }}>Banner thường</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {regularByTab.map((b, idx) => (
              <div key={b.banner_id} className="card" style={{ display: 'flex', gap: 20, padding: 18, alignItems: 'flex-start' }}>
                <div style={{
                  width: 280, height: 110, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                  background: `linear-gradient(135deg, ${b.color1 || C.light}, ${b.color2 || C.blue})`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {b.image_url
                    ? <img src={b.image_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <span style={{ fontSize: 48 }}>{b.emoji || '🖼️'}</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                    <span style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>{b.title}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: tab === 'active' ? C.successLight : tab === 'rejected' ? C.errorLight : C.warningLight, color: statusColor[b.status] }}>{statusLabel[b.status]}</span>
                    {tab === 'active' && <span style={{ fontSize: 11, background: C.light, color: C.blue, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Thứ tự #{b.display_order ?? idx + 1}</span>}
                  </div>
                  <p style={{ fontSize: 13, color: C.gray, marginBottom: 4 }}>Shop: <strong>{b.shop_name || '—'}</strong></p>
                  <p style={{ fontSize: 12, color: C.gray }}>Hiệu lực: {b.valid_from || '—'} → {b.valid_to || '—'}</p>
                  {b.link && <p style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>Link: <a href={b.link} style={{ color: C.blue }}>{b.link}</a></p>}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
                  {b.status === 'pending' && <>
                    <button onClick={() => approve(b.banner_id)} style={{ ...btnStyle(C.successLight, C.success, true) }}>✅ Duyệt</button>
                    <button onClick={() => rejectRegular(b.banner_id)} style={{ ...btnStyle(C.errorLight, C.error, true) }}>❌ Từ chối</button>
                  </>}
                  {b.status === 'active' && idx > 0 &&
                    <button onClick={() => moveUp(b.banner_id, idx)} style={{ ...btnStyle(C.tint, C.blue, true) }}>⬆️ Lên trên</button>
                  }
                  <button onClick={() => remove(b.banner_id)} style={{ ...btnStyle(C.errorLight, C.error, true) }}>🗑️ Xóa</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Banner đấu giá (localStorage) ───────────────────────────────── */}
      {auctionFiltered.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1 }}>🏆 Banner đấu giá</span>
            <div style={{ flex: 1, height: 1, background: C.border }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))', gap: 16 }}>
            {auctionFiltered.map(item => renderAuctionCard(item))}
          </div>
        </>
      )}

      {/* Empty state */}
      {regularByTab.length === 0 && auctionFiltered.length === 0 && !loadingApi && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>
          Không có banner nào ở trạng thái này
        </div>
      )}

      {/* ── Reject modal ─────────────────────────────────────────────────── */}
      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 28, width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 6, fontSize: 17, fontWeight: 800 }}>❌ Lý do từ chối</h3>
            <p style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Chọn một hoặc nhiều lý do. Lý do sẽ được gửi tới shop.</p>

            {/* Preset reasons */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
              {REJECT_PRESETS.map(reason => {
                const selected = selectedReasons.includes(reason)
                return (
                  <div key={reason}
                    onClick={() => toggleReason(reason)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                      borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                      border: `1.5px solid ${selected ? C.error : C.border}`,
                      background: selected ? C.errorLight : 'transparent',
                      transition: 'all 0.15s',
                    }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `2px solid ${selected ? C.error : C.border}`,
                      background: selected ? C.error : 'transparent',
                    }}>
                      {selected && <span style={{ color: 'white', fontSize: 11, fontWeight: 800 }}>✓</span>}
                    </div>
                    <span style={{ fontSize: 13, color: selected ? C.error : 'inherit', fontWeight: selected ? 600 : 400 }}>{reason}</span>
                  </div>
                )
              })}

              {/* Lý do khác */}
              <div
                onClick={() => setShowCustom(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px',
                  borderRadius: 8, cursor: 'pointer', userSelect: 'none',
                  border: `1.5px solid ${showCustom ? C.orange : C.border}`,
                  background: showCustom ? C.orangeLight : 'transparent',
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: 4, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: `2px solid ${showCustom ? C.orange : C.border}`,
                  background: showCustom ? C.orange : 'transparent',
                }}>
                  {showCustom && <span style={{ color: 'white', fontSize: 11, fontWeight: 800 }}>✓</span>}
                </div>
                <span style={{ fontSize: 13, color: showCustom ? C.orange : 'inherit', fontWeight: showCustom ? 600 : 400 }}>✏️ Lý do khác (nhập tay)</span>
              </div>
              {showCustom && (
                <textarea
                  autoFocus
                  value={customReason}
                  onChange={e => setCustomReason(e.target.value)}
                  placeholder="Mô tả lý do cụ thể..."
                  style={{
                    width: '100%', minHeight: 80, borderRadius: 8,
                    border: `1.5px solid ${C.orange}`, padding: '10px 12px',
                    fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
                    outline: 'none',
                  }}
                />
              )}
            </div>

            {/* Selected summary */}
            {(selectedReasons.length > 0 || (showCustom && customReason.trim())) && (
              <div style={{ marginBottom: 14, padding: '10px 14px', background: C.errorLight, borderRadius: 8, fontSize: 12, color: C.error }}>
                <b>Lý do đã chọn:</b> {[...selectedReasons, showCustom && customReason.trim() ? customReason.trim() : ''].filter(Boolean).join(' · ')}
              </div>
            )}

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnStyle('#f1f5f9', C.gray)} onClick={() => setRejectTarget(null)}>Huỷ</button>
              <button
                style={{ ...btnStyle(C.error), opacity: (selectedReasons.length === 0 && !customReason.trim()) ? 0.5 : 1 }}
                onClick={handleReject}
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default BannerAdminPage
