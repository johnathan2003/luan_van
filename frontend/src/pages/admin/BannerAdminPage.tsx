/**
 * 🖼️ Banner Admin — Quản lý banner quảng cáo (thường + đấu giá)
 */
import React, { useState, useEffect, useCallback, useRef } from 'react'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import { addNotificationFor } from '../../utils/notificationStore'
import { idbDelete, resolveImageAsync, isIDBRef } from '../../utils/imageDB'
import {
  BANNER_POSITIONS, BannerPositionKey, BannerSubmission,
  getAllSubmissions as getAuctionBannerSubs,
  approveSubmission as approveAuctionBanner,
  rejectSubmission as rejectAuctionBanner,
  cancelSubmissionExpired,
  expireDisplaySubmission,
  adminCreateBanner,
  deleteSubmission as deleteBannerSub,
  updateSubmission as updateBannerSub,
  purgeAdminBanners,
  resolveImage,
  getHistory as getBannerHistory,
  seedTestPendingSubmissions,
} from '../../utils/bannerAuctionStore'
import {
  FLASH_SLOTS, FlashSubmission,
  getAllFlashSubmissions,
  approveFlashSubmission,
  rejectFlashSubmission,
  cancelFlashSubmissionExpired,
  expireFlashDisplaySubmission,
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
function formatDisplayTime(ms: number): string {
  if (ms <= 0) return 'Hết hạn'
  const d = Math.floor(ms / 86400000)
  const h = Math.floor((ms % 86400000) / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (d > 0) return `${d} ngày ${h} giờ ${m} phút`
  if (h > 0) return `${h} giờ ${m} phút`
  return `${m} phút`
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
  'Ẩn toàn của trẻ em',
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
  // Resolved image map: raw ref → actual data URL (for IDB refs)
  const [imageMap, setImageMap] = useState<Record<string, string>>({})

  // Countdown: subId → remaining ms
  const [countdowns, setCountdowns] = useState<Record<string, number>>({})
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Reject modal
  const [rejectTarget, setRejectTarget] = useState<{ kind: 'banner' | 'flash'; id: string } | null>(null)
  const [selectedReasons, setSelectedReasons] = useState<string[]>([])
  const [customReason, setCustomReason] = useState('')
  const [showCustom, setShowCustom] = useState(false)

  // Create banner modal (admin)
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const POSITION_OPTIONS: { key: BannerPositionKey; label: string; desc: string; spec: string }[] = [
    { key: 'home_slider',    label: '🖼️ Hero Slider (Hình 1)',      desc: 'Slider chính trên đầu trang chủ',        spec: '1280×160px — tỉ lệ 8:1 ngang dài' },
    { key: 'mall_ads_main',  label: '📢 Banner Center — Phần 7 (Hình 2)', desc: 'Khu quảng cáo lớn bên trái (7 phần)',    spec: '865×400px — tỉ lệ 2:1 ngang' },
    { key: 'mall_ads_fixed', label: '🏬 Banner Center — Phần 3 (Hình 3)', desc: 'Ảnh cố định bên phải khu Mall (3 phần)', spec: '371×400px — tỉ lệ vuông đứng' },
    { key: 'mall_banner',    label: '🏪 Banner Mall (Hình 4)',            desc: 'Banner dọc trong panel trái BuyZo Mall', spec: '480×640px — tỉ lệ 3:4 đứng' },
  ]
  const DURATION_OPTIONS = [
    { label: '1 ngày',   ms: 1  * 24 * 60 * 60 * 1000 },
    { label: '3 ngày',   ms: 3  * 24 * 60 * 60 * 1000 },
    { label: '7 ngày',   ms: 7  * 24 * 60 * 60 * 1000 },
    { label: '14 ngày',  ms: 14 * 24 * 60 * 60 * 1000 },
    { label: '30 ngày',  ms: 30 * 24 * 60 * 60 * 1000 },
    { label: 'Vĩnh viễn', ms: 999 * 24 * 60 * 60 * 1000 },
  ]
  // Multi-image create
  type CreateImage = { url: string; preview: string; title: string }
  const [createImages, setCreateImages] = useState<CreateImage[]>([])
  const [createShared, setCreateShared] = useState({
    link: '', position: 'home_slider' as BannerPositionKey, durationMs: 7 * 24 * 60 * 60 * 1000,
  })
  const patchShared = (patch: Partial<typeof createShared>) => setCreateShared(f => ({ ...f, ...patch }))
  // Custom delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<BannerSubmission | null>(null)

  // Edit banner modal (admin)
  const [showEdit, setShowEdit] = useState(false)
  const [editTarget, setEditTarget] = useState<BannerSubmission | null>(null)
  const [editForm, setEditForm] = useState({ title: '', image_url: '', link: '' })
  const patchEdit = (patch: Partial<typeof editForm>) => setEditForm(f => ({ ...f, ...patch }))
  const [editImageChanged, setEditImageChanged] = useState(false)
  const [editNewPath, setEditNewPath] = useState('')   // path lưu store khi đổi ảnh
  const openEdit = (sub: BannerSubmission) => {
    setEditTarget(sub)
    setEditImageChanged(false)
    setEditNewPath('')
    const resolved = imageMap[sub.image] ?? resolveImage(sub.image)
    setEditForm({ title: sub.title, image_url: resolved, link: sub.link ?? '' })
    if (!resolved) {
      resolveImageAsync(sub.image).then(url => { if (url) patchEdit({ image_url: url }) })
    }
    setShowEdit(true)
  }
  const handleEditImagePick = (file: File) => {
    readAsDataURL(file).then(dataUrl => {
      patchEdit({ image_url: dataUrl })
      setEditNewPath(dataUrl)  // lưu data URL để idbSave sau
    })
    setEditImageChanged(true)
  }
  const handleEditSave = async () => {
    if (!editTarget) return
    if (!editForm.title.trim()) { toast.error('Vui lòng nhập tiêu đề'); return }
    if (!editForm.image_url.trim()) { toast.error('Vui lòng chọn ảnh'); return }
    try {
      let imageRef = editTarget.image
      if (editImageChanged && editNewPath) {
        if (isIDBRef(editTarget.image)) await idbDelete(editTarget.image).catch(() => {})
        const { idbSave } = await import('../../utils/imageDB')
        imageRef = await idbSave(editNewPath)  // lưu vào IDB, giống handleCreate
      }
      updateBannerSub(editTarget.id, { title: editForm.title, image: imageRef, link: editForm.link || undefined })
      toast.success('✅ Đã cập nhật banner!')
      setShowEdit(false)
      setEditTarget(null)
      loadAuction()
    } catch {
      toast.error('Không thể cập nhật banner')
    }
  }
  const handleDelete = (sub: BannerSubmission) => setDeleteConfirm(sub)
  const confirmDelete = () => {
    if (!deleteConfirm) return
    idbDelete(deleteConfirm.image).catch(() => {}) // xóa ảnh IDB (best-effort)
    deleteBannerSub(deleteConfirm.id)
    setDeleteConfirm(null)
    toast.success('🗑️ Đã xóa banner!')
    loadAuction()
    setTimeout(loadAuction, 100)
  }

  const readAsDataURL = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload  = e => resolve(e.target?.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

  const handleCreateFilesPick = (files: FileList) => {
    const arr = Array.from(files)
    Promise.all(arr.map(f => readAsDataURL(f))).then(previews => {
      setCreateImages(prev => [
        ...prev,
        ...arr.map((f, i) => ({
          url:     previews[i],   // data URL thật — dùng làm cả lưu lẫn preview
          preview: previews[i],
          title:   f.name.replace(/\.[^.]+$/, ''),
        })),
      ])
    })
  }

  const handleCreate = async () => {
    if (createImages.length === 0) { toast.error('Vui lòng chọn ít nhất 1 ảnh'); return }
    const invalid = createImages.find(img => !img.title.trim())
    if (invalid) { toast.error('Vui lòng nhập tiêu đề cho tất cả ảnh'); return }
    setCreating(true)
    try {
      for (const img of createImages) {
        // Lưu ảnh vào IDB (không giới hạn quota như localStorage)
        const { idbSave } = await import('../../utils/imageDB')
        const imageRef = await idbSave(img.url)
        adminCreateBanner({
          position: createShared.position,
          title: img.title,
          image: imageRef,  // 'idb:img_xxx' — resolve được qua resolveImageAsync
          link: createShared.link || undefined,
          displayDurationMs: createShared.durationMs,
        })
      }
    } finally {
      setCreating(false)
    }
    toast.success(`✅ Đã đăng ${createImages.length} banner lên trang chủ!`)
    setShowCreate(false)
    setCreateImages([])
    setCreateShared({ link: '', position: 'home_slider', durationMs: 7 * 24 * 60 * 60 * 1000 })
    setTab('active')
    loadAuction()
  }

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
    const flashSubs  = getAllFlashSubmissions()
    const combined: AuctionSub[] = [
      ...bannerSubs.map(s => ({ kind: 'banner' as const, sub: s })),
      ...flashSubs.map(s => ({ kind: 'flash' as const, sub: s })),
    ]
    setAuctionSubs(combined)
    setBannerHistory(getBannerHistory())
    setFlashHistory(getFlashHistory())
    // Resolve IDB image refs async
    const refs = combined
      .map(({ sub }) => (sub as any).image || (sub as any).productImage || '')
      .filter(r => r.startsWith('idb:') || r.startsWith('ref:'))
    if (refs.length > 0) {
      Promise.all(refs.map(r => resolveImageAsync(r).then(url => ({ r, url }))))
        .then(entries => {
          const m: Record<string, string> = {}
          entries.forEach(({ r, url }) => { m[r] = url })
          setImageMap(prev => ({ ...prev, ...m }))
        })
        .catch(() => {})
    }
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

      // Đọc history để kiểm tra trạng thái thanh toán & displayDuration
      const bHistory = getBannerHistory()
      const fHistory = getFlashHistory()

      allSubs.forEach(({ kind, sub }) => {
        if (sub.status !== 'approved') return
        // Auto-patch: nếu approved nhưng chưa có paymentDeadline (data cũ), gán mới
        if (!sub.paymentDeadline) {
          if (kind === 'banner') approveAuctionBanner(sub.id)
          else approveFlashSubmission(sub.id)
          needReload = true
          return // interval tick tiếp theo sẽ có deadline
        }

        // Kiểm tra đã thanh toán đủ chưa (tránh cancel nhầm khi đã paid)
        const histEntry = kind === 'banner'
          ? bHistory.find(h => h.id === sub.historyId)
          : fHistory.find(h => h.id === sub.historyId)
        const isPaid = histEntry?.confirmation === 'paid'

        // Countdown hiển thị banner (cho paid subs)
        if (isPaid && sub.approvedAt) {
          const displayMs = histEntry?.displayDurationMs ?? 2 * 24 * 60 * 60 * 1000
          const displayRemMs = Math.max(0, new Date(sub.approvedAt).getTime() + displayMs - Date.now())
          next['disp_' + sub.id] = displayRemMs

          // Hết thời gian hiển thị → tự xoá khỏi store + trang chủ
          if (displayRemMs <= 0) {
            if (kind === 'banner') expireDisplaySubmission(sub.id)
            else expireFlashDisplaySubmission(sub.id)
            needReload = true
            const name = (sub as BannerSubmission).title || (sub as FlashSubmission).productName
            addNotificationFor('', 'shop', 0, {
              title: '📴 Banner đã hết thời gian hiển thị',
              message: `Banner "${name}" đã kết thúc thời gian hiển thị và được gỡ khỏi trang chủ tự động.`,
              type: 'info',
              action_url: '/shop/auction',
            })
          }
        }

        // Kiểm tra đã thanh toán đủ chưa
        const remaining = new Date(sub.paymentDeadline).getTime() - Date.now()
        next[sub.id] = remaining

        const remainMin = Math.ceil(remaining / 60000)

        if (remaining <= 0 && !isPaid) {
          // Hết giờ → auto cancel (chỉ khi chưa thanh toán)
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
    const rawImageRef = (sub as any).image || (sub as any).productImage || ''
    // IDB refs phải chờ async resolve vào imageMap — không dùng chuỗi 'idb:...' làm src
    const image = rawImageRef.startsWith('idb:')
      ? (imageMap[rawImageRef] || '')
      : (imageMap[rawImageRef] ?? resolveImage(rawImageRef))
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
          <div style={{ background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center', maxHeight: 200, overflow: 'hidden' }}>
            <img src={image} alt="preview" style={{ width: '100%', height: 'auto', maxHeight: 200, objectFit: 'cover', display: 'block' }} />
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

            // Display countdown (chỉ khi đã paid)
            const displayDurationMs = histEntry?.displayDurationMs ?? 2 * 24 * 60 * 60 * 1000
            const displayRemMs = isPaid && sub.approvedAt
              ? (countdowns['disp_' + sub.id] ?? Math.max(0, new Date(sub.approvedAt).getTime() + displayDurationMs - Date.now()))
              : null
            const displayEndAt = isPaid && sub.approvedAt
              ? new Date(new Date(sub.approvedAt).getTime() + displayDurationMs)
              : null
            const dispPct = displayRemMs !== null && displayDurationMs > 0
              ? Math.max(0, Math.min(100, (displayRemMs / displayDurationMs) * 100))
              : null
            const dispExpired = displayRemMs !== null && displayRemMs <= 0

            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Trạng thái thanh toán / chờ TT */}
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

                {/* Bộ đếm thời gian hiển thị (chỉ khi đã paid) */}
                {isPaid && displayRemMs !== null && (
                  <div style={{ borderRadius: 8, overflow: 'hidden', border: `1px solid ${dispExpired ? 'rgba(220,38,38,0.25)' : dispPct! < 20 ? 'rgba(220,38,38,0.25)' : 'rgba(22,163,74,0.2)'}` }}>
                    <div style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '8px 14px', fontSize: 12,
                      background: dispExpired ? 'rgba(220,38,38,0.07)' : dispPct! < 20 ? 'rgba(220,38,38,0.05)' : 'rgba(22,163,74,0.06)',
                    }}>
                      <span style={{ fontWeight: 700, color: dispExpired ? '#DC2626' : dispPct! < 20 ? '#DC2626' : C.success }}>
                        {dispExpired ? '🔴 Hết thời hạn hiển thị' : `🕐 Còn ${formatDisplayTime(displayRemMs)} hiển thị`}
                      </span>
                      {displayEndAt && !dispExpired && (
                        <span style={{ fontSize: 11, color: C.gray }}>
                          Hết hạn: {displayEndAt.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    {dispPct !== null && (
                      <div style={{ height: 4, background: 'rgba(0,0,0,0.06)' }}>
                        <div style={{
                          height: '100%',
                          width: `${dispPct}%`,
                          background: dispPct < 20 ? '#DC2626' : dispPct < 50 ? C.warning : C.success,
                          transition: 'width 1s linear',
                          borderRadius: '0 3px 3px 0',
                        }} />
                      </div>
                    )}
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

          {/* Nút Sửa / Xóa — chỉ banner do admin tạo */}
          {sub.status === 'approved' && sub.shopName === 'BuyZo Admin' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                style={{ ...btnStyle(C.blueLight, C.blue), flex: 1 }}
                onClick={() => openEdit(sub as BannerSubmission)}
              >✏️ Chỉnh sửa</button>
              <button
                style={{ ...btnStyle(C.errorLight, C.error), flex: 1 }}
                onClick={() => handleDelete(sub as BannerSubmission)}
              >🗑️ Xóa</button>
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🖼️ Quản lý Banner</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Duyệt banner thường và banner đấu giá từ cửa hàng</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'pending' && (
            <button
              onClick={() => { seedTestPendingSubmissions(); loadAuction(); toast.success('✅ Đã tạo 3 submission test!') }}
              style={{ ...btnStyle(C.purpleLight, C.purple, true), marginTop: 4 }}
            >🧪 Tạo dữ liệu test</button>
          )}
          {tab === 'active' && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => {
                  if (!window.confirm('Xóa hết tất cả banner do admin tạo?')) return
                  const n = purgeAdminBanners()
                  toast.success(`🗑️ Đã xóa ${n} banner admin cũ!`)
                  loadAuction()
                }}
                style={{ ...btnStyle(C.errorLight, C.error, true), marginTop: 4 }}
              >🗑️ Xóa hết banner admin cũ</button>
              <button
                onClick={() => setShowCreate(true)}
                style={{ ...btnStyle(C.success, 'white', true), marginTop: 4 }}
              >➕ Tạo banner admin</button>
            </div>
          )}
        </div>
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
      {tab === 'pending' ? (() => {
        const pendingBanner = (pos: string) => auctionFiltered.filter(({ kind, sub }) => kind === 'banner' && (sub as BannerSubmission).position === pos)
        const pendingFlash  = auctionFiltered.filter(({ kind }) => kind === 'flash')
        const sections: { icon: string; label: string; items: AuctionSub[] }[] = [
          { icon: '🖼️', label: 'Banner đầu Trang chủ',          items: pendingBanner('home_slider')   },
          { icon: '📢', label: 'Banner Quảng Cáo (Center)',      items: pendingBanner('mall_ads_main')  },
          { icon: '🏬', label: 'Banner Center (cố định)',         items: pendingBanner('mall_ads_fixed') },
          { icon: '🏪', label: 'Banner Mall (Hình 4)',            items: pendingBanner('mall_banner')    },
          { icon: '⚡', label: 'Flash Sale',                     items: pendingFlash                    },
        ]
        return (
          <>
            {sections.map(({ icon, label, items }) => (
              <div key={label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1 }}>{icon} {label}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 999, background: items.length > 0 ? C.warningLight : C.tint, color: items.length > 0 ? C.warning : C.gray }}>{items.length}</span>
                  <div style={{ flex: 1, height: 1, background: C.border }} />
                </div>
                {items.length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {items.map(item => renderAuctionCard(item))}
                    </div>
                  : <div style={{ padding: '14px 18px', borderRadius: 10, background: C.tint, color: C.gray, fontSize: 13, textAlign: 'center', marginBottom: 4 }}>
                      Không có banner chờ duyệt
                    </div>
                }
              </div>
            ))}
          </>
        )
      })() : (
        auctionFiltered.length > 0 && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1 }}>🏆 Banner đấu giá</span>
              <div style={{ flex: 1, height: 1, background: C.border }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {auctionFiltered.map(item => renderAuctionCard(item))}
            </div>
          </>
        )
      )}

      {/* Empty state — only for active/rejected tabs */}
      {tab !== 'pending' && regularByTab.length === 0 && auctionFiltered.length === 0 && !loadingApi && (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>
          Không có banner nào ở trạng thái này
        </div>
      )}

      {/* ── Create banner modal (admin) ──────────────────────────────────── */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 28, width: 580, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 4, fontSize: 17, fontWeight: 800, color: C.navy }}>➕ Tạo banner admin</h3>
            <p style={{ fontSize: 12, color: C.gray, marginBottom: 20 }}>Banner hiển thị ngay trên trang chủ — không cần duyệt. Chọn nhiều ảnh cùng lúc để tạo nhanh nhiều banner.</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Chọn vị trí */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 8 }}>Vị trí hiển thị *</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {POSITION_OPTIONS.map(opt => (
                    <div key={opt.key} onClick={() => patchShared({ position: opt.key })}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10,
                        border: `2px solid ${createShared.position === opt.key ? C.blue : C.border}`,
                        background: createShared.position === opt.key ? C.blueLight : 'transparent',
                        cursor: 'pointer', transition: 'all 0.15s',
                      }}>
                      <div style={{ fontSize: 20, lineHeight: 1 }}>{opt.label.split(' ')[0]}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: createShared.position === opt.key ? C.blue : 'var(--text-primary)' }}>{opt.label.slice(3)}</div>
                        <div style={{ fontSize: 11, color: C.gray }}>{opt.desc} · <span style={{ fontStyle: 'italic' }}>{opt.spec}</span></div>
                      </div>
                      {createShared.position === opt.key && <div style={{ marginLeft: 'auto', color: C.blue, fontWeight: 800 }}>✓</div>}
                    </div>
                  ))}
                </div>
              </div>

              {/* Chọn nhiều ảnh */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.gray }}>
                    Hình ảnh * {createImages.length > 0 && <span style={{ color: C.blue }}>({createImages.length} ảnh)</span>}
                  </span>
                  {createImages.length > 0 && (
                    <label htmlFor="banner-admin-file-input"
                      style={{ ...btnStyle(C.blueLight, C.blue, true), display: 'inline-block', cursor: 'pointer' }}>+ Thêm ảnh</label>
                  )}
                </div>

                <input
                  id="banner-admin-file-input"
                  type="file" accept="image/*" multiple
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files?.length) {
                      handleCreateFilesPick(e.target.files)
                      e.target.value = ''
                    }
                  }}
                />

                {createImages.length === 0 ? (
                  <label htmlFor="banner-admin-file-input" style={{
                    border: `2px dashed ${C.border}`, borderRadius: 10, padding: '32px 20px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                    cursor: 'pointer', background: C.tint,
                  }}>
                    <span style={{ fontSize: 36 }}>📁</span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: C.blue }}>Bấm để chọn ảnh (chọn nhiều cùng lúc)</span>
                    <span style={{ fontSize: 11, color: C.gray }}>
                      {POSITION_OPTIONS.find(p => p.key === createShared.position)?.spec}
                    </span>
                  </label>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {createImages.map((img, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 12, padding: 10, borderRadius: 10, border: `1px solid ${C.border}`, background: C.tint, alignItems: 'flex-start' }}>
                        <div style={{ width: 80, height: 56, flexShrink: 0, borderRadius: 6, overflow: 'hidden', background: '#0a0a0a' }}>
                          <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 11, color: C.gray, marginBottom: 3 }}>Tiêu đề banner #{idx + 1}</div>
                          <input
                            value={img.title}
                            onChange={e => {
                              const next = [...createImages]
                              next[idx] = { ...next[idx], title: e.target.value }
                              setCreateImages(next)
                            }}
                            placeholder="Nhập tiêu đề..."
                            style={{ width: '100%', padding: '6px 8px', border: `1px solid ${C.border}`, borderRadius: 6, fontSize: 13, boxSizing: 'border-box' }}
                          />
                        </div>
                        <button onClick={() => setCreateImages(prev => prev.filter((_, i) => i !== idx))}
                          style={{ ...btnStyle(C.errorLight, C.error, true), flexShrink: 0, marginTop: 18 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Link */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.gray }}>Link đích (khi click — áp dụng cho tất cả)</label>
                <input value={createShared.link} onChange={e => patchShared({ link: e.target.value })}
                  placeholder="https://... hoặc /products"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8, boxSizing: 'border-box', fontSize: 13 }} />
              </div>

              {/* Thời gian hiển thị */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 8 }}>Thời gian hiển thị</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {DURATION_OPTIONS.map(opt => (
                    <button key={opt.ms} onClick={() => patchShared({ durationMs: opt.ms })}
                      style={{
                        padding: '6px 14px', borderRadius: 8, border: `2px solid ${createShared.durationMs === opt.ms ? C.blue : C.border}`,
                        background: createShared.durationMs === opt.ms ? C.blueLight : 'transparent',
                        color: createShared.durationMs === opt.ms ? C.blue : C.gray,
                        fontWeight: 600, fontSize: 12, cursor: 'pointer',
                      }}>{opt.label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowCreate(false); setCreateImages([]) }} style={{ ...btnStyle('var(--bg-card)', C.gray), border: `1px solid ${C.border}` }}>Huỷ</button>
              <button onClick={handleCreate} disabled={creating || createImages.length === 0}
                style={{ ...btnStyle(C.success), opacity: (creating || createImages.length === 0) ? 0.6 : 1 }}>
                {creating ? 'Đang tạo...' : `✅ Tạo ${createImages.length > 1 ? createImages.length + ' banner' : 'banner'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete confirm modal ─────────────────────────────────────────── */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 28, width: 400, maxWidth: '92vw' }}>
            <div style={{ fontSize: 36, textAlign: 'center', marginBottom: 12 }}>🗑️</div>
            <h3 style={{ fontSize: 16, fontWeight: 800, textAlign: 'center', marginBottom: 8 }}>Xác nhận xóa banner</h3>
            <p style={{ fontSize: 13, color: C.gray, textAlign: 'center', marginBottom: 6 }}>
              Bạn chắc muốn xóa banner
            </p>
            <p style={{ fontSize: 14, fontWeight: 700, textAlign: 'center', color: C.error, marginBottom: 20 }}>
              "{deleteConfirm.title}"
            </p>
            <p style={{ fontSize: 12, color: C.gray, textAlign: 'center', marginBottom: 24 }}>
              Banner sẽ biến mất khỏi trang chủ ngay lập tức và không thể khôi phục.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setDeleteConfirm(null)}
                style={{ ...btnStyle('var(--bg-card)', C.gray), flex: 1, border: `1px solid ${C.border}` }}>Huỷ</button>
              <button onClick={confirmDelete}
                style={{ ...btnStyle(C.error), flex: 1 }}>🗑️ Xóa banner</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit banner modal (admin) ────────────────────────────────────── */}
      {showEdit && editTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 28, width: 540, maxWidth: '95vw', maxHeight: '92vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 4, fontSize: 17, fontWeight: 800, color: C.navy }}>✏️ Chỉnh sửa banner</h3>
            <p style={{ fontSize: 12, color: C.gray, marginBottom: 20 }}>
              Vị trí: <strong>{POSITION_OPTIONS.find(p => p.key === editTarget.position)?.label}</strong>
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.gray }}>Tiêu đề *</label>
                <input
                  value={editForm.title}
                  onChange={e => patchEdit({ title: e.target.value })}
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8, boxSizing: 'border-box', fontSize: 13 }}
                />
              </div>

              <div>
                <span style={{ fontSize: 12, fontWeight: 700, color: C.gray, display: 'block', marginBottom: 6 }}>Hình ảnh *</span>
                <input
                  id="banner-edit-file-input"
                  type="file" accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { handleEditImagePick(f); e.target.value = '' } }}
                />
                {editForm.image_url ? (
                  <label htmlFor="banner-edit-file-input" style={{ display: 'block', position: 'relative', borderRadius: 10, overflow: 'hidden', background: '#0a0a0a', cursor: 'pointer' }}>
                    <img src={editForm.image_url} alt="preview"
                      style={{ width: '100%', maxHeight: 200, objectFit: editTarget.position === 'mall_ads_fixed' ? 'contain' : 'cover', display: 'block' }} />
                    <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ color: 'white', fontWeight: 700, fontSize: 13 }}>🖼️ Bấm để đổi ảnh</span>
                    </div>
                  </label>
                ) : (
                  <label htmlFor="banner-edit-file-input"
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, border: `2px dashed ${C.border}`, borderRadius: 10, padding: '32px 20px', cursor: 'pointer', background: C.tint }}>
                    <span style={{ fontSize: 32 }}>📁</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: C.blue }}>Bấm để chọn ảnh</span>
                  </label>
                )}
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 700, color: C.gray }}>Link đích (khi click)</label>
                <input
                  value={editForm.link}
                  onChange={e => patchEdit({ link: e.target.value })}
                  placeholder="https://... hoặc /products"
                  style={{ display: 'block', width: '100%', marginTop: 4, padding: '8px 10px', border: `1px solid ${C.border}`, borderRadius: 8, boxSizing: 'border-box', fontSize: 13 }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 24, justifyContent: 'flex-end' }}>
              <button onClick={() => { setShowEdit(false); setEditTarget(null) }} style={{ ...btnStyle('var(--bg-card)', C.gray), border: `1px solid ${C.border}` }}>Huỷ</button>
              <button onClick={handleEditSave} style={btnStyle(C.blue)}>💾 Lưu thay đổi</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject modal ─────────────────────────────────────────────────── */}
      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999 }}>
          <div style={{ background: C.cardBg, borderRadius: 14, padding: 28, width: 520, maxWidth: '95vw', maxHeight: '90vh', overflowY: 'auto' }}>
            <h3 style={{ marginBottom: 6, fontSize: 17, fontWeight: 800 }}>❌ Lý do từ chối</h3>
            <p style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>Chọn một hoặc nhiều lý do. Lý do sẽ được gửi tới shop.</p>

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
