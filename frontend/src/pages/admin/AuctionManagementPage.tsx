import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import {
  BANNER_POSITIONS, BannerPositionKey, BannerAuctionSession,
  AuctionAdminSettings as BannerAdminSettings, BANNER_IMAGE_SPECS,
  getAllActiveSessions as getAllBannerSessions,
  getHistory as getBannerHistory,
  getAdminSettings as getBannerSettings,
  updateAdminSettings as updateBannerSettings,
  lockPosition, cancelAuction as cancelBannerAuction,
  freezeAuction as freezeBannerAuction, unfreezeAuction as unfreezeBannerAuction,
  openAuction as openBannerAuction,
} from '../../utils/bannerAuctionStore'
import {
  PoolSession as FlashPoolSession, PoolSettings as FlashPoolSettings,
  computeAllocation as computeFlashAllocation, getSlotsFilled as getFlashSlotsFilled,
  getActiveSession as getFlashPoolSession,
  getHistory as getFlashPoolHistory,
  getSettings as getFlashPoolSettings,
  updateSettings as updateFlashPoolSettings,
  openAuction as openFlashPoolAuction,
  lockAuction as lockFlashPoolAuction,
  cancelAuction as cancelFlashPoolAuction,
  freezeAuction as freezeFlashPoolAuction, unfreezeAuction as unfreezeFlashPoolAuction,
  isAuctionLive as isFlashLive,
  msUntilEnd as msFlashEnd,
} from '../../utils/flashSalePoolStore'
import {
  TOP_SLOTS, TopSlotKey, TopAuctionSession,
  AuctionAdminSettings as TopAdminSettings, TOP_IMAGE_SPEC,
  getAllActiveSessions as getAllTopSessions,
  getHistory as getTopHistory,
  getAdminSettings as getTopSettings,
  updateAdminSettings as updateTopSettings,
  lockSlot as lockTopSlot, cancelAuction as cancelTopAuction,
  freezeAuction as freezeTopAuction, unfreezeAuction as unfreezeTopAuction,
  openAuction as openTopAuction,
} from '../../utils/topSlotAuctionStore'

const C = {
  primary: '#16A34A', primaryLight: 'rgba(22,163,74,0.1)',
  orange: '#EA580C', orangeLight: 'rgba(234,88,12,0.1)',
  blue: '#2563EB', blueLight: 'rgba(37,99,235,0.1)',
  red: '#DC2626', redLight: 'rgba(220,38,38,0.1)',
  purple: '#7C3AED', purpleLight: 'rgba(124,58,237,0.1)',
  gray: 'var(--text-secondary)', border: 'var(--border-subtle)', cardBg: 'var(--bg-card)',
}

const cardStyle: React.CSSProperties = { background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }
const btnStyle = (bg: string, color = 'white', small = false): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 8, padding: small ? '5px 12px' : '8px 16px', fontSize: small ? 12 : 13, fontWeight: 600, cursor: 'pointer',
})
const badge = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color, background: bg,
})
const inputStyle: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box', background: '#fff', color: '#222' }

interface OpenModal { type: 'banner' | 'flash' | 'top'; key: string; label: string }

function fmtMs(ms: number) {
  const s = Math.ceil(ms / 1000)
  if (s <= 0) return '00:00'
  const m = Math.floor(s / 60), ss = s % 60
  if (m >= 60) { const h = Math.floor(m / 60); return `${h}g ${m % 60}p` }
  return `${m.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
}

const PoolCard: React.FC<{
  color: string; colorLight: string; label: string; emoji: string;
  imgStorageKey: string;
  session: FlashPoolSession | null;
  settings: FlashPoolSettings;
  onUpdateSettings: (patch: Partial<FlashPoolSettings>) => void;
  onOpen: () => void;
  onCancel: () => void;
  onFreeze: () => void;
  onUnfreeze: () => void;
  onLock: () => void;
  computeAlloc: (bids: any[], total: number) => any[];
  getSlotsFilled: (bids: any[]) => number;
  tick: number;
}> = ({ color, colorLight, label, emoji, imgStorageKey, session, settings, onUpdateSettings, onOpen, onCancel, onFreeze, onUnfreeze, onLock, computeAlloc, getSlotsFilled, tick }) => {
  const [imgUrl, setImgUrl] = React.useState<string>(() => {
    try { return localStorage.getItem(imgStorageKey) || '' } catch { return '' }
  })
  const [isEditing, setIsEditing] = React.useState(false)
  const handleImgUpload = (file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target?.result as string
      setImgUrl(url)
      try { localStorage.setItem(imgStorageKey, url) } catch {}
    }
    reader.readAsDataURL(file)
  }
  const removeImg = () => {
    setImgUrl('')
    try { localStorage.removeItem(imgStorageKey) } catch {}
  }

  const isLive = session && (session.scheduledStartAt ? Date.now() >= new Date(session.scheduledStartAt).getTime() : true)
  const remaining = session ? Math.max(0, new Date(session.endsAt).getTime() - Date.now()) : 0
  const slotsFilled = session ? Math.min(getSlotsFilled(session.bids), session.totalSlots) : 0
  const allocation = session ? computeAlloc(session.bids, session.totalSlots) : []

  const statusColor = session ? (isLive ? color : C.orange) : (settings.locked ? C.red : C.gray)
  const statusBg = session ? (isLive ? colorLight : C.orangeLight) : (settings.locked ? C.redLight : 'rgba(156,163,175,0.12)')
  const statusLabel = session
    ? (isLive ? `🟢 Đang mở (còn ${fmtMs(remaining)})` : `⏳ Sắp bắt đầu`)
    : (settings.locked ? '🔴 Bị khoá' : '⏸ Chờ mở phiên mới')

  return (
    <div style={cardStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <div>
          <h4 style={{ margin: 0, marginBottom: 6 }}>{emoji} {label}</h4>
          <span style={badge(statusColor, statusBg)}>{statusLabel}</span>
          {session && (
            <span style={{ ...badge(color, colorLight), marginLeft: 6 }}>
              {slotsFilled}/{session.totalSlots} slot đã đặt
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {!session && !settings.locked && (isEditing
            ? <button onClick={() => { setIsEditing(false); toast.success('Đã lưu') }} style={btnStyle(color, 'white', true)}>💾 Lưu</button>
            : <button onClick={() => setIsEditing(true)} style={{ background: 'transparent', color, border: `1px solid ${color}`, borderRadius: 8, padding: '5px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>✏️ Chỉnh sửa</button>
          )}
          {session
            ? <>
                <button style={btnStyle(C.red, 'white', true)} onClick={onCancel}>🗑️ Huỷ phiên</button>
                {session.paused
                  ? <button style={btnStyle(color, 'white', true)} onClick={onUnfreeze}>▶️ Mở</button>
                  : <button style={btnStyle(C.orange, 'white', true)} onClick={onFreeze}>⏸ Khoá</button>
                }
              </>
            : <button disabled={isEditing} style={{ ...btnStyle(color, 'white', true), opacity: isEditing ? 0.4 : 1, cursor: isEditing ? 'not-allowed' : 'pointer' }} onClick={onOpen}>🟢 Mở phiên mới</button>
          }
        </div>
      </div>

      {/* Image — always visible, upload controls only when editing */}
      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: `${color}08`, border: `1px solid ${color}30`, borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
        <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
          {imgUrl
            ? <img src={imgUrl} alt="preview" style={{ width: 90, height: 60, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}`, display: 'block', cursor: 'zoom-in' }} />
            : <div style={{ width: 90, height: 60, borderRadius: 6, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.gray, textAlign: 'center' }}>Chưa có ảnh</div>
          }
          {isEditing && (<>
            <label style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color, background: colorLight, border: `1px solid ${color}44`, borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' }}>
              📷 {imgUrl ? 'Đổi ảnh' : 'Tải ảnh lên'}
              <input type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files?.[0]; if (f) handleImgUpload(f) }} />
            </label>
            {imgUrl && (
              <button onClick={removeImg} style={{ fontSize: 10, color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕ Xoá ảnh</button>
            )}
          </>)}
        </div>
        <div style={{ fontSize: 12, color: C.gray, paddingTop: 4 }}>
          <div style={{ fontWeight: 700, color, marginBottom: 4 }}>🖼️ Ảnh đại diện phiên</div>
          <div>Ảnh hiển thị cho shop khi xem thông tin phiên đấu giá.</div>
          <div style={{ marginTop: 4 }}>Đề xuất: <b>tỉ lệ 16:9</b>, tối thiểu 800×450px, tối đa 2 MB.</div>
        </div>
      </div>

      {/* Settings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 0.6fr 0.6fr 0.6fr 0.55fr 0.55fr', gap: 10, marginBottom: session ? 16 : 0 }}>
        <label style={{ fontSize: 12, color: C.gray }}>
          Số slot tổng
          <input type="number" step={10} defaultValue={settings.totalSlots}
            disabled={!isEditing}
            onBlur={e => onUpdateSettings({ totalSlots: Number(e.target.value) })}
            style={inputStyle} />
        </label>
        <label style={{ fontSize: 12, color: C.gray }}>
          Tối đa slot/shop
          <input type="number" step={1} min={1} max={100} defaultValue={settings.maxSlotsPerShop}
            disabled={!isEditing}
            onBlur={e => onUpdateSettings({ maxSlotsPerShop: Number(e.target.value) })}
            style={inputStyle} />
        </label>
        <label style={{ fontSize: 11, color: C.gray }}>
          💰 Giá bắt đầu (đ)
          <input key={`bp-${settings.basePrice}`} type="text" defaultValue={settings.basePrice.toLocaleString('vi-VN')}
            disabled={!isEditing}
            onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
            onBlur={e => onUpdateSettings({ basePrice: Number(e.target.value.replace(/[^\d]/g, '')) })}
            style={inputStyle} />
        </label>
        <label style={{ fontSize: 11, color: C.gray }}>
          🏁 Giá kết thúc (đ) <span style={{ color: '#7C3AED', fontWeight: 600, fontSize: 10 }}>— trừ Tiền đấu giá shop</span>
          <input key={`ep-${settings.endPrice}`} type="text" defaultValue={(settings.endPrice ?? 0).toLocaleString('vi-VN')}
            disabled={!isEditing}
            onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
            onBlur={e => {
              const val = Number(e.target.value.replace(/[^\d]/g, ''))
              if (val && val < settings.basePrice) {
                toast.error('Giá kết thúc không được nhỏ hơn giá bắt đầu')
                const fallback = settings.basePrice * 5
                e.target.value = fallback.toLocaleString('vi-VN')
                onUpdateSettings({ endPrice: fallback })
                return
              }
              onUpdateSettings({ endPrice: val || undefined })
            }}
            style={inputStyle} />
        </label>
        <label style={{ fontSize: 11, color: C.gray }}>
          ⚡ Giá mua hết (đ)
          <input key={`bn-${settings.buyNowPrice}`} type="text" defaultValue={(settings.buyNowPrice ?? 0).toLocaleString('vi-VN')}
            disabled={!isEditing}
            onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
            onBlur={e => onUpdateSettings({ buyNowPrice: Number(e.target.value.replace(/[^\d]/g, '')) || undefined })}
            style={inputStyle} />
        </label>
        <label style={{ fontSize: 11, color: C.gray }}>
          Thời gian phiên (phút)
          <input type="number" defaultValue={Math.round(settings.biddingDurationMs / 60000)}
            disabled={!isEditing}
            onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
            onBlur={e => onUpdateSettings({ biddingDurationMs: Number(e.target.value) * 60000 })}
            style={{ ...inputStyle, fontSize: 12 }} />
        </label>
        <label style={{ fontSize: 11, color: C.gray }}>
          Hiển thị sau thắng (giờ)
          <input type="number" defaultValue={Math.round(settings.displayDurationMs / 3600000)}
            disabled={!isEditing}
            onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
            onBlur={e => onUpdateSettings({ displayDurationMs: Number(e.target.value) * 3600000 })}
            style={{ ...inputStyle, fontSize: 12 }} />
        </label>
      </div>

      {/* Live leaderboard */}
      {session && allocation.length > 0 && (
        <div style={{ background: colorLight, border: `1px solid ${color}33`, borderRadius: 8, padding: '10px 14px' }}>
          <div style={{ fontWeight: 700, fontSize: 12, color, marginBottom: 8 }}>📊 Bảng xếp hạng giá hiện tại ({session.bids.length} shop đặt giá)</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {allocation.slice(0, 10).map(a => (
              <div key={a.rank} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, padding: '3px 0', borderBottom: `1px solid ${color}20` }}>
                <span><b style={{ color }}>#{a.rank}</b> {a.shopName}</span>
                <span style={{ color: C.gray }}>{a.amountPerSlot.toLocaleString('vi-VN')}đ/slot × <b>{a.slotsAssigned}</b> = Slot {a.slotNumbers.slice(0,3).map((n: number) => `#${n}`).join(', ')}{a.slotNumbers.length > 3 ? '...' : ''}</span>
              </div>
            ))}
            {allocation.length > 10 && <div style={{ fontSize: 11, color: C.gray, textAlign: 'center', paddingTop: 4 }}>... và {allocation.length - 10} shop khác</div>}
          </div>
        </div>
      )}
      {session && session.bids.length === 0 && (
        <div style={{ textAlign: 'center', color: C.gray, fontSize: 13, padding: '12px 0' }}>Chưa có shop nào đặt giá.</div>
      )}
    </div>
  )
}

const AuctionManagementPage: React.FC = () => {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'banner' | 'flash' | 'top' | 'history'>('banner')
  const [openModal, setOpenModal] = useState<OpenModal | null>(null)
  const [startDelay, setStartDelay] = useState(0)
  const [auctionDesc, setAuctionDesc] = useState('')
  const [imageModal, setImageModal] = useState<string | null>(null)
  const [imgSpecKey, setImgSpecKey] = useState<string | null>(null)
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null)
  const [customPreviews, setCustomPreviews] = useState<Record<string, string>>(() => {
    // Đọc riêng từng key thay vì 1 JSON chung → tránh vượt quota 5MB
    const result: Record<string, string> = {}
    try {
      // Backward compat: đọc JSON cũ nếu có
      const old = localStorage.getItem('admin_position_previews')
      if (old) { Object.assign(result, JSON.parse(old)) }
    } catch {}
    BANNER_POSITIONS.forEach(p => {
      try {
        const v = localStorage.getItem(`admin_preview_${p.key}`)
        if (v) result[p.key] = v
      } catch {}
    })
    return result
  })
  const [tick, setTick] = useState(0)

  const handlePreviewUpload = (posKey: string, file: File) => {
    const path = `/img/banner_admin/${file.name}`
    setCustomPreviews(prev => ({ ...prev, [posKey]: path }))
    try { localStorage.setItem(`admin_preview_${posKey}`, path) } catch {}
  }

  // Banner state
  const [bannerSessions, setBannerSessions] = useState<Partial<Record<BannerPositionKey, BannerAuctionSession>>>({})
  const [bannerHistory, setBannerHistory] = useState<BannerAuctionSession[]>([])
  const [bannerSettings, setBannerSettingsState] = useState<Record<BannerPositionKey, BannerAdminSettings>>({} as any)

  // Flash Sale pool state
  const [flashSession, setFlashSession] = useState<FlashPoolSession | null>(null)
  const [flashHistory, setFlashHistory] = useState<FlashPoolSession[]>([])
  const [flashSettings, setFlashSettings] = useState<FlashPoolSettings>({ totalSlots: 100, maxSlotsPerShop: 5, basePrice: 300000, biddingDurationMs: 600000, displayDurationMs: 172800000, locked: false })

  // Top slot state (10 named positions)
  const [topSessions, setTopSessions] = useState<Partial<Record<TopSlotKey, TopAuctionSession>>>({})
  const [topHistory, setTopHistory] = useState<TopAuctionSession[]>([])
  const [topSettings, setTopSettings] = useState<Record<TopSlotKey, TopAdminSettings>>({} as any)

  const refresh = () => {
    setBannerSessions({ ...getAllBannerSessions() })
    setBannerHistory(getBannerHistory())
    setBannerSettingsState({ ...getBannerSettings() })
    setFlashSession(getFlashPoolSession())
    setFlashHistory(getFlashPoolHistory())
    setFlashSettings({ ...getFlashPoolSettings() })
    setTopSessions({ ...getAllTopSessions() })
    setTopHistory(getTopHistory())
    setTopSettings({ ...getTopSettings() })
    setTick(t => t + 1)
  }

  useEffect(() => { refresh() }, [])
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  const lockedBanner = BANNER_POSITIONS.filter(p => !bannerSessions[p.key]).length
  const openTopCount = Object.keys(topSessions).length
  const open = Object.keys(bannerSessions).length + (flashSession ? 1 : 0) + openTopCount
  const locked = lockedBanner + (flashSession ? 0 : 1) + (TOP_SLOTS.length - openTopCount)

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ marginBottom: 4 }}>🏆 Quản lý đấu giá quảng cáo</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>Cấu hình và mở/khoá phiên đấu giá banner, Flash Sale (100 slot) và Vị trí Top (100 slot).</p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Loại phiên', value: BANNER_POSITIONS.length + 2, color: C.blue, bg: C.blueLight },
          { label: 'Đang mở', value: open, color: C.primary, bg: C.primaryLight },
          { label: 'Đang khoá', value: locked, color: C.red, bg: C.redLight },
        ].map(s => (
          <div key={s.label} style={{ ...cardStyle, marginBottom: 0, textAlign: 'center', background: s.bg }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 12, color: s.color }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {(['banner', 'flash', 'top', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...btnStyle(tab === t ? (t === 'top' ? C.purple : t === 'flash' ? C.orange : C.primary) : 'transparent', tab === t ? 'white' : C.gray), border: `1px solid ${tab === t ? (t === 'top' ? C.purple : t === 'flash' ? C.orange : C.primary) : C.border}` }}>
            {t === 'banner' ? '🖼️ Banner' : t === 'flash' ? '⚡ Flash Sale' : t === 'top' ? '🏆 Vị trí Top' : '📋 Lịch sử'}
          </button>
        ))}
      </div>

      {/* ── Banner tab ────────────────────────────────────────────────────── */}
      {tab === 'banner' && (
        <>
          {BANNER_POSITIONS.map(p => {
            const s = bannerSettings[p.key]; if (!s) return null
            const isOpen = !!bannerSessions[p.key]
            const isFrozen = !!bannerSessions[p.key]?.paused
            const isLocked = !isOpen && !!s.locked
            const statusColor = isOpen ? (isFrozen ? C.orange : C.primary) : isLocked ? C.red : C.gray
            const statusBg = isOpen ? (isFrozen ? C.orangeLight : C.primaryLight) : isLocked ? C.redLight : 'rgba(156,163,175,0.12)'
            const statusLabel = isOpen ? (isFrozen ? '⏸ Đang đóng băng' : '🟢 Đang mở') : isLocked ? '🔴 Bị khoá' : '⏸ Chờ mở phiên mới'
            return (
              <div key={p.key} style={cardStyle}>
                {(() => { const isEditing = editingKey === p.key; return (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{p.label}</h4>
                    <span style={badge(statusColor, statusBg)}>{statusLabel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {!isOpen && !isLocked && (isEditing
                      ? <button onClick={() => { setEditingKey(null); toast.success('Đã lưu') }} style={btnStyle(C.primary, 'white', true)}>💾 Lưu</button>
                      : <button onClick={() => setEditingKey(p.key)} style={{ background: 'transparent', color: C.blue, border: `1px solid ${C.blue}`, borderRadius: 8, padding: '5px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>✏️ Chỉnh sửa</button>
                    )}
                    <button
                      title="Xem yêu cầu hình ảnh"
                      onClick={() => setImgSpecKey(imgSpecKey === p.key ? null : p.key)}
                      style={{ background: imgSpecKey === p.key ? C.blue : 'transparent', color: imgSpecKey === p.key ? 'white' : C.blue, border: `1px solid ${C.blue}`, borderRadius: 8, padding: '5px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      🖼️ Ảnh
                    </button>
                    {isOpen
                      ? <>
                          <button style={btnStyle(C.red, 'white', true)} onClick={() => setConfirmDialog({ message: 'Huỷ phiên đấu giá? Toàn bộ dữ liệu phiên sẽ bị xoá, không ghi nhận lịch sử.', onConfirm: () => { cancelBannerAuction(p.key); refresh(); toast('🗑️ Đã huỷ phiên.') } })}>🗑️ Huỷ phiên</button>
                          {isFrozen
                            ? <button style={btnStyle(C.primary, 'white', true)} onClick={() => { unfreezeBannerAuction(p.key); refresh(); toast('▶️ Đã mở lại phiên.') }}>▶️ Mở</button>
                            : <button style={btnStyle(C.orange, 'white', true)} onClick={() => { freezeBannerAuction(p.key); refresh(); toast('⏸ Đã đóng băng phiên.') }}>⏸ Khoá</button>
                          }
                        </>
                      : <button disabled={isEditing} style={{ ...btnStyle(C.primary, 'white', true), opacity: isEditing ? 0.4 : 1, cursor: isEditing ? 'not-allowed' : 'pointer' }} onClick={() => { setStartDelay(0); setAuctionDesc(''); setOpenModal({ type: 'banner', key: p.key, label: p.label }) }}>🟢 Mở phiên mới</button>
                    }
                  </div>
                </div>

                {imgSpecKey === p.key && (() => {
                  const spec = BANNER_IMAGE_SPECS[p.key]
                  const displayImg = customPreviews[p.key] || p.previewImage
                  return (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: 'rgba(37,99,235,0.06)', border: `1px solid rgba(37,99,235,0.2)`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                        <div style={{ position: 'relative', width: 140, height: 80 }}>
                          {displayImg
                            ? <img src={displayImg} alt={p.label} onClick={() => setImageModal(displayImg)}
                                style={{ width: 140, height: 80, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}`, display: 'block', cursor: 'zoom-in' }} />
                            : <div style={{ width: 140, height: 80, borderRadius: 6, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.gray }}>Chưa có ảnh</div>
                          }
                        </div>
                        {isEditing && (<>
                          <label style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.blue, background: 'rgba(37,99,235,0.1)', border: `1px solid rgba(37,99,235,0.3)`, borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                            📷 Đổi ảnh
                            <input type="file" accept="image/*" style={{ display: 'none' }}
                              onChange={e => { const f = e.target.files?.[0]; if (f) handlePreviewUpload(p.key, f) }} />
                          </label>
                          {customPreviews[p.key] && (
                            <button onClick={() => {
                              setCustomPreviews(prev => { const next = { ...prev }; delete next[p.key]; return next })
                              try { localStorage.removeItem(`admin_preview_${p.key}`) } catch {}
                            }} style={{ fontSize: 10, color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                              ✕ Xoá ảnh tuỳ chỉnh
                            </button>
                          )}
                        </>)}
                      </div>
                      <div style={{ fontSize: 13 }}>
                        <div style={{ fontWeight: 700, color: C.blue, marginBottom: 8 }}>📐 Yêu cầu hình ảnh — {p.label}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', color: 'var(--text-primary)' }}>
                          <span>📏 Tỉ lệ: <b>{spec.ratioLabel}</b></span>
                          <span>📦 Kích thước: <b>{spec.recommendedW} × {spec.recommendedH}px</b></span>
                          <span>💾 Tối đa: <b>{spec.maxKB >= 1024 ? `${(spec.maxKB/1024).toFixed(0)} MB` : `${spec.maxKB} KB`}</b></span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: C.gray }}>
                          Shop cần upload ảnh đúng tỉ lệ ± {Math.round(spec.tolerance * 100)}%. Ảnh sai kích thước sẽ bị từ chối.
                        </div>
                      </div>
                    </div>
                  )
                })()}

                {/* Row 1: các field chính */}
                <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 0.6fr 0.55fr 0.55fr', gap: 8, marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: C.gray }}>
                    💰 Giá bắt đầu (đ)
                    <input key={`bp-${s.basePrice}`} type="text" defaultValue={s.basePrice.toLocaleString('vi-VN')}
                      disabled={!isEditing}
                      onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                      onBlur={e => { updateBannerSettings(p.key, { basePrice: Number(e.target.value.replace(/[^\d]/g, '')) }); refresh() }}
                      style={inputStyle} />
                  </label>
                  <label style={{ fontSize: 11, color: C.gray }}>
                    🏁 Giá kết thúc (đ) <span style={{ color: '#7C3AED', fontWeight: 600, fontSize: 10 }}>— trừ Tiền đấu giá shop</span>
                    <input key={`ep-${s.endPrice}`} type="text" defaultValue={(s.endPrice ?? 0).toLocaleString('vi-VN')}
                      disabled={!isEditing}
                      onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                      onBlur={e => {
                        const val = Number(e.target.value.replace(/[^\d]/g, ''))
                        if (val && val < s.basePrice) {
                          toast.error('Giá kết thúc không được nhỏ hơn giá bắt đầu')
                          const fallback = s.basePrice * 5
                          e.target.value = fallback.toLocaleString('vi-VN')
                          updateBannerSettings(p.key, { endPrice: fallback }); refresh()
                          return
                        }
                        updateBannerSettings(p.key, { endPrice: val || undefined }); refresh()
                      }}
                      style={inputStyle} />
                  </label>
                  <label style={{ fontSize: 11, color: C.gray }}>
                    Thời gian phiên (phút)
                    <input type="number" defaultValue={Math.round(s.biddingDurationMs / 60000)}
                      disabled={!isEditing}
                      onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                      onBlur={e => { updateBannerSettings(p.key, { biddingDurationMs: Number(e.target.value) * 60000 }); refresh() }}
                      style={inputStyle} />
                  </label>
                  <label style={{ fontSize: 11, color: C.gray }}>
                    Hiển thị sau thắng (giờ)
                    <input type="number" defaultValue={Math.round(s.displayDurationMs / 3600000)}
                      disabled={!isEditing}
                      onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                      onBlur={e => { updateBannerSettings(p.key, { displayDurationMs: Number(e.target.value) * 3600000 }); refresh() }}
                      style={inputStyle} />
                  </label>
                </div>

                {/* Toggle + 2 input nâng cao */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: s.advancedEnabled ? 8 : 0 }}>
                  <div onClick={() => { if (!isEditing) return; updateBannerSettings(p.key, { advancedEnabled: !(s.advancedEnabled ?? false) }); refresh() }}
                    style={{ width: 34, height: 18, borderRadius: 9, background: s.advancedEnabled ? '#22c55e' : '#ccc', position: 'relative', cursor: isEditing ? 'pointer' : 'default', transition: 'background 0.2s', flexShrink: 0, opacity: isEditing ? 1 : 0.6 }}>
                    <div style={{ position: 'absolute', top: 2, left: s.advancedEnabled ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px #0003' }} />
                  </div>
                  <span style={{ fontSize: 11, color: C.gray }}>⚡ Giá mua hết &amp; Số slot</span>
                </div>
                {s.advancedEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 0.4fr', gap: 8 }}>
                    <label style={{ fontSize: 11, color: C.gray }}>
                      ⚡ Giá mua hết (đ)
                      <input key={`bn-${s.buyNowPrice}`} type="text" defaultValue={(s.buyNowPrice ?? 0).toLocaleString('vi-VN')}
                        disabled={!isEditing}
                        onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                        onBlur={e => { updateBannerSettings(p.key, { buyNowPrice: Number(e.target.value.replace(/[^\d]/g, '')) || undefined }); refresh() }}
                        style={inputStyle} />
                    </label>
                    <label style={{ fontSize: 11, color: C.gray }}>
                      🎰 Số slot
                      <select value={s.slots ?? 1} disabled={!isEditing}
                        onChange={e => { updateBannerSettings(p.key, { slots: Number(e.target.value) }); refresh() }}
                        style={{ ...inputStyle, cursor: isEditing ? 'pointer' : 'default' }}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                </>)})()}
              </div>
            )
          })}
        </>
      )}

      {/* ── Flash Sale tab ────────────────────────────────────────────────── */}
      {tab === 'flash' && (
        <>
          <div style={{ background: C.orangeLight, border: `1px solid ${C.orange}44`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
            <b style={{ color: C.orange }}>⚡ Đấu giá Flash Sale — Pool {flashSettings.totalSlots} slot</b>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>Shop đặt giá/slot, xếp từ cao → thấp, phân slot tuần tự cho đến khi đủ {flashSettings.totalSlots}. Mỗi shop tối đa {flashSettings.maxSlotsPerShop} slot.</span>
          </div>
          <PoolCard
            color={C.orange} colorLight={C.orangeLight}
            label="Flash Sale Trang chủ" emoji="⚡"
            imgStorageKey="admin_img_flash_pool"
            session={flashSession}
            settings={flashSettings}
            onUpdateSettings={p => { updateFlashPoolSettings(p); refresh() }}
            onOpen={() => { setStartDelay(0); setAuctionDesc(''); setOpenModal({ type: 'flash', key: '', label: `Flash Sale — ${flashSettings.totalSlots} slot` }) }}
            onCancel={() => setConfirmDialog({ message: 'Huỷ phiên Flash Sale? Toàn bộ dữ liệu phiên sẽ bị xoá, không ghi nhận lịch sử.', onConfirm: () => { cancelFlashPoolAuction(); refresh(); toast('🗑️ Đã huỷ phiên Flash Sale.') } })}
            onFreeze={() => { freezeFlashPoolAuction(); refresh(); toast('⏸ Đã đóng băng phiên Flash Sale.') }}
            onUnfreeze={() => { unfreezeFlashPoolAuction(); refresh(); toast('▶️ Đã mở lại phiên Flash Sale.') }}
            onLock={() => { lockFlashPoolAuction(); refresh(); toast('🔒 Đã khoá phiên Flash Sale.') }}
            computeAlloc={computeFlashAllocation}
            getSlotsFilled={getFlashSlotsFilled}
            tick={tick}
          />
        </>
      )}

      {/* ── Vị trí Top tab ───────────────────────────────────────────────── */}
      {tab === 'top' && (
        <>
          <div style={{ background: C.purpleLight, border: `1px solid ${C.purple}44`, borderRadius: 10, padding: '10px 16px', marginBottom: 16, fontSize: 13 }}>
            <b style={{ color: C.purple }}>🏆 Đấu giá Vị trí Top — 10 vị trí ưu tiên trang chủ</b>
            <span style={{ color: 'var(--text-secondary)', marginLeft: 8 }}>Mỗi slot là một vị trí cụ thể. Shop đặt giá cao nhất để hiện thị sản phẩm tại vị trí đó.</span>
          </div>
          {TOP_SLOTS.map(sl => {
            const s = topSettings[sl.key]; if (!s) return null
            const isOpen = !!topSessions[sl.key]
            const isFrozen = !!topSessions[sl.key]?.paused
            const isLocked = !isOpen && !!s.locked
            const statusColor = isOpen ? (isFrozen ? C.orange : C.purple) : isLocked ? C.red : C.gray
            const statusBg = isOpen ? (isFrozen ? C.orangeLight : C.purpleLight) : isLocked ? C.redLight : 'rgba(156,163,175,0.12)'
            const statusLabel = isOpen ? (isFrozen ? '⏸ Đang đóng băng' : '🟢 Đang mở') : isLocked ? '🔴 Bị khoá' : '⏸ Chờ mở phiên mới'
            return (
              <div key={sl.key} style={cardStyle}>
                {(() => { const isEditing = editingKey === sl.key; return (<>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{sl.label}</h4>
                    <span style={badge(statusColor, statusBg)}>{statusLabel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {!isOpen && !isLocked && (isEditing
                      ? <button onClick={() => { setEditingKey(null); toast.success('Đã lưu') }} style={btnStyle(C.purple, 'white', true)}>💾 Lưu</button>
                      : <button onClick={() => setEditingKey(sl.key)} style={{ background: 'transparent', color: C.purple, border: `1px solid ${C.purple}`, borderRadius: 8, padding: '5px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>✏️ Chỉnh sửa</button>
                    )}
                    {isOpen
                      ? <>
                          <button style={btnStyle(C.red, 'white', true)} onClick={() => setConfirmDialog({ message: 'Huỷ phiên đấu giá? Toàn bộ dữ liệu phiên sẽ bị xoá, không ghi nhận lịch sử.', onConfirm: () => { cancelTopAuction(sl.key); refresh(); toast('🗑️ Đã huỷ phiên.') } })}>🗑️ Huỷ phiên</button>
                          {isFrozen
                            ? <button style={btnStyle(C.purple, 'white', true)} onClick={() => { unfreezeTopAuction(sl.key); refresh(); toast('▶️ Đã mở lại phiên.') }}>▶️ Mở</button>
                            : <button style={btnStyle(C.orange, 'white', true)} onClick={() => { freezeTopAuction(sl.key); refresh(); toast('⏸ Đã đóng băng phiên.') }}>⏸ Khoá</button>
                          }
                        </>
                      : <button disabled={isEditing} style={{ ...btnStyle(C.purple, 'white', true), opacity: isEditing ? 0.4 : 1, cursor: isEditing ? 'not-allowed' : 'pointer' }} onClick={() => { setStartDelay(0); setAuctionDesc(''); setOpenModal({ type: 'top', key: sl.key, label: sl.label }) }}>🟢 Mở phiên mới</button>
                    }
                  </div>
                </div>

                {/* Image — always visible, upload controls only when editing */}
                <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.18)', borderRadius: 10, padding: '12px 14px', marginBottom: 14 }}>
                  <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 5, alignItems: 'center' }}>
                    {customPreviews[sl.key]
                      ? <img src={customPreviews[sl.key]} alt={sl.label} onClick={() => setImageModal(customPreviews[sl.key])}
                          style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}`, display: 'block', cursor: 'zoom-in' }} />
                      : <div style={{ width: 80, height: 80, borderRadius: 6, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.gray, textAlign: 'center' }}>Chưa có ảnh</div>
                    }
                    {isEditing && (<>
                      <label style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.purple, background: C.purpleLight, border: '1px solid rgba(124,58,237,0.3)', borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                        📷 {customPreviews[sl.key] ? 'Đổi ảnh' : 'Tải lên'}
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handlePreviewUpload(sl.key, f) }} />
                      </label>
                      {customPreviews[sl.key] && (
                        <button onClick={() => {
                          setCustomPreviews(prev => { const next = { ...prev }; delete next[sl.key]; return next })
                          try { localStorage.removeItem(`admin_preview_${sl.key}`) } catch {}
                        }} style={{ fontSize: 10, color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          ✕ Xoá ảnh
                        </button>
                      )}
                    </>)}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray, paddingTop: 4 }}>
                    <div style={{ fontWeight: 700, color: C.purple, marginBottom: 4 }}>🖼️ Ảnh đại diện vị trí</div>
                    <div style={{ marginBottom: 6 }}>Ảnh minh hoạ vị trí này cho shop thấy khi đặt giá.</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                      <span>📏 Tỉ lệ: <b>{TOP_IMAGE_SPEC.ratioLabel}</b></span>
                      <span>📦 <b>{TOP_IMAGE_SPEC.recommendedW}×{TOP_IMAGE_SPEC.recommendedH}px</b></span>
                      <span>💾 Tối đa: <b>{TOP_IMAGE_SPEC.maxKB >= 1024 ? `${(TOP_IMAGE_SPEC.maxKB / 1024).toFixed(0)} MB` : `${TOP_IMAGE_SPEC.maxKB} KB`}</b></span>
                    </div>
                  </div>
                </div>

                {/* Row 1: các field chính */}
                <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 0.6fr 0.55fr 0.55fr', gap: 8, marginBottom: 8 }}>
                  <label style={{ fontSize: 11, color: C.gray }}>
                    💰 Giá bắt đầu (đ)
                    <input key={`bp-${s.basePrice}`} type="text" defaultValue={s.basePrice.toLocaleString('vi-VN')}
                      disabled={!isEditing}
                      onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                      onBlur={e => { updateTopSettings(sl.key, { basePrice: Number(e.target.value.replace(/[^\d]/g, '')) }); refresh() }}
                      style={inputStyle} />
                  </label>
                  <label style={{ fontSize: 11, color: C.gray }}>
                    🏁 Giá kết thúc (đ) <span style={{ color: '#7C3AED', fontWeight: 600, fontSize: 10 }}>— trừ Tiền đấu giá shop</span>
                    <input key={`ep-${s.endPrice}`} type="text" defaultValue={(s.endPrice ?? 0).toLocaleString('vi-VN')}
                      disabled={!isEditing}
                      onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                      onBlur={e => {
                        const val = Number(e.target.value.replace(/[^\d]/g, ''))
                        if (val && val < s.basePrice) {
                          toast.error('Giá kết thúc không được nhỏ hơn giá bắt đầu')
                          const fallback = s.basePrice * 5
                          e.target.value = fallback.toLocaleString('vi-VN')
                          updateTopSettings(sl.key, { endPrice: fallback }); refresh()
                          return
                        }
                        updateTopSettings(sl.key, { endPrice: val || undefined }); refresh()
                      }}
                      style={inputStyle} />
                  </label>
                  <label style={{ fontSize: 11, color: C.gray }}>
                    Thời gian phiên (phút)
                    <input type="number" defaultValue={Math.round(s.biddingDurationMs / 60000)}
                      disabled={!isEditing}
                      onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                      onBlur={e => { updateTopSettings(sl.key, { biddingDurationMs: Number(e.target.value) * 60000 }); refresh() }}
                      style={inputStyle} />
                  </label>
                  <label style={{ fontSize: 11, color: C.gray }}>
                    Hiển thị sau thắng (giờ)
                    <input type="number" defaultValue={Math.round(s.displayDurationMs / 3600000)}
                      disabled={!isEditing}
                      onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                      onBlur={e => { updateTopSettings(sl.key, { displayDurationMs: Number(e.target.value) * 3600000 }); refresh() }}
                      style={inputStyle} />
                  </label>
                </div>

                {/* Toggle + 2 input nâng cao */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: s.advancedEnabled ? 8 : 0 }}>
                  <div onClick={() => { if (!isEditing) return; updateTopSettings(sl.key, { advancedEnabled: !(s.advancedEnabled ?? false) }); refresh() }}
                    style={{ width: 34, height: 18, borderRadius: 9, background: s.advancedEnabled ? '#22c55e' : '#ccc', position: 'relative', cursor: isEditing ? 'pointer' : 'default', transition: 'background 0.2s', flexShrink: 0, opacity: isEditing ? 1 : 0.6 }}>
                    <div style={{ position: 'absolute', top: 2, left: s.advancedEnabled ? 16 : 2, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px #0003' }} />
                  </div>
                  <span style={{ fontSize: 11, color: C.gray }}>⚡ Giá mua hết &amp; Số slot</span>
                </div>
                {s.advancedEnabled && (
                  <div style={{ display: 'grid', gridTemplateColumns: '0.6fr 0.4fr', gap: 8 }}>
                    <label style={{ fontSize: 11, color: C.gray }}>
                      ⚡ Giá mua hết (đ)
                      <input key={`bn-${s.buyNowPrice}`} type="text" defaultValue={(s.buyNowPrice ?? 0).toLocaleString('vi-VN')}
                        disabled={!isEditing}
                        onInput={e => { const raw = e.currentTarget.value.replace(/[^\d]/g, ''); e.currentTarget.value = raw ? Number(raw).toLocaleString('vi-VN') : '' }}
                        onBlur={e => { updateTopSettings(sl.key, { buyNowPrice: Number(e.target.value.replace(/[^\d]/g, '')) || undefined }); refresh() }}
                        style={inputStyle} />
                    </label>
                    <label style={{ fontSize: 11, color: C.gray }}>
                      🎰 Số slot
                      <select value={s.slots ?? 1} disabled={!isEditing}
                        onChange={e => { updateTopSettings(sl.key, { slots: Number(e.target.value) }); refresh() }}
                        style={{ ...inputStyle, cursor: isEditing ? 'pointer' : 'default' }}>
                        {[1,2,3,4,5,6,7,8,9,10].map(n => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </label>
                  </div>
                )}
                </>)})()}
              </div>
            )
          })}
        </>
      )}

      {/* ── History tab ───────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <>
          {[
            ...bannerHistory.map(h => ({ kind: 'banner' as const, id: h.id, startedAt: h.startedAt, data: h })),
            ...flashHistory.map(h => ({ kind: 'flash' as const, id: h.id, startedAt: h.startedAt, data: h })),
            ...topHistory.map(h => ({ kind: 'top' as const, id: h.id, startedAt: h.startedAt, data: h })),
          ]
            .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
            .slice(0, 30)
            .map(({ kind, id, startedAt, data }) => {
              const color = kind === 'banner' ? C.blue : kind === 'top' ? C.purple : C.orange
              const bg = kind === 'banner' ? C.blueLight : kind === 'top' ? C.purpleLight : C.orangeLight
              const emoji = kind === 'banner' ? '🖼️' : kind === 'top' ? '🏆' : '⚡'
              const isFlashPool = kind === 'flash'
              const flashData = data as FlashPoolSession
              const singleData = data as BannerAuctionSession | TopAuctionSession
              const slotsFilled = isFlashPool ? Math.min(flashData.bids.reduce((s: number, b: any) => s + b.slotsRequested, 0), flashData.totalSlots) : 0
              const winnersCount = isFlashPool ? (flashData.allocation?.length ?? 0) : 0
              const singleWinner = !isFlashPool ? singleData.winner : undefined
              const singleConf = !isFlashPool ? singleData.confirmation : undefined
              const labelText = kind === 'banner'
                ? BANNER_POSITIONS.find(p => p.key === (singleData as BannerAuctionSession).position)?.label ?? 'Banner'
                : kind === 'top'
                  ? TOP_SLOTS.find(s => s.key === (singleData as TopAuctionSession).slot)?.label ?? 'Vị trí Top'
                  : 'Flash Sale'
              return (
                <div key={id} style={{ ...cardStyle, padding: '12px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                    <div style={{ fontSize: 13 }}>
                      <span style={badge(color, bg)}>{emoji}</span>
                      {' '}<b>{labelText}</b>
                      <span style={{ color: C.gray, marginLeft: 10, fontSize: 12 }}>{new Date(startedAt).toLocaleString('vi-VN')}</span>
                    </div>
                    {isFlashPool ? (
                      <span style={badge(color, bg)}>
                        {winnersCount} shop thắng · {slotsFilled} slot đã phân
                      </span>
                    ) : singleWinner ? (
                      <span style={badge(
                        singleConf === 'paid' ? C.primary : singleConf === 'expired' || singleConf === 'declined' ? C.red : C.orange,
                        singleConf === 'paid' ? C.primaryLight : singleConf === 'expired' || singleConf === 'declined' ? C.redLight : C.orangeLight,
                      )}>
                        {(singleWinner as any).shopName} — {(singleWinner as any).amount.toLocaleString('vi-VN')}đ ({singleConf ?? '–'})
                      </span>
                    ) : <span style={badge(C.gray, 'rgba(156,163,175,0.15)')}>Không có người thắng</span>}
                  </div>
                </div>
              )
            })}
          {bannerHistory.length === 0 && flashHistory.length === 0 && topHistory.length === 0 && (
            <div style={{ textAlign: 'center', color: C.gray, padding: 40 }}>Chưa có lịch sử phiên nào.</div>
          )}
        </>
      )}

      {/* ── Confirm dialog ────────────────────── */}
      {confirmDialog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 14, padding: '28px 32px', maxWidth: 380, width: '90vw', boxShadow: '0 8px 40px rgba(0,0,0,0.25)' }}>
            <div style={{ fontSize: 15, color: '#111', marginBottom: 20, lineHeight: 1.6 }}>{confirmDialog.message}</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDialog(null)}
                style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #d1d5db', background: '#f9fafb', color: '#374151', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Huỷ
              </button>
              <button onClick={() => { confirmDialog.onConfirm(); setConfirmDialog(null) }}
                style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: C.red, color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 }}>
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Lightbox ảnh ──────────────────────── */}
      {imageModal && (
        <div onClick={() => setImageModal(null)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'zoom-out' }}>
          <img src={imageModal} alt="preview" style={{ maxWidth: '90vw', maxHeight: '85vh', borderRadius: 10, boxShadow: '0 8px 40px rgba(0,0,0,0.5)', display: 'block' }} />
        </div>
      )}

      {/* ── Modal Mở phiên mới ─────────────────── */}
      {openModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setOpenModal(null) }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 16, padding: 28, width: 460, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <h3 style={{ margin: '0 0 4px' }}>🟢 Mở phiên đấu giá mới</h3>
            <p style={{ fontSize: 13, color: C.gray, marginBottom: 20 }}>{openModal.label}</p>
            <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 16 }}>
              ⏱ Bắt đầu sau bao nhiêu phút? <span style={{ color: C.orange }}>(0 = ngay lập tức)</span>
              <input type="number" min={0} max={1440} value={startDelay}
                onChange={e => setStartDelay(Math.max(0, Number(e.target.value)))}
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }} />
              {startDelay > 0 && (
                <span style={{ fontSize: 12, color: C.blue, marginTop: 4, display: 'block' }}>
                  ⏰ Khai mạc lúc: {new Date(Date.now() + startDelay * 60000).toLocaleString('vi-VN')}
                </span>
              )}
            </label>
            <label style={{ fontSize: 13, color: C.gray, display: 'block', marginBottom: 20 }}>
              📋 Mô tả phiên đấu giá <span style={{ color: C.gray }}>(hiển thị cho shop)</span>
              <textarea value={auctionDesc} onChange={e => setAuctionDesc(e.target.value)}
                rows={3} placeholder="VD: Ưu tiên shop bán điện tử, không dùng hình generic..."
                style={{ display: 'block', width: '100%', marginTop: 6, padding: '8px 12px', border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box' }} />
            </label>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button style={btnStyle(C.gray, 'white')} onClick={() => setOpenModal(null)}>Huỷ</button>
              <button style={btnStyle(C.primary)} onClick={() => {
                if (!openModal) return
                const opts = { startDelayMinutes: startDelay, description: auctionDesc || undefined }
                if (openModal.type === 'banner') {
                  openBannerAuction(openModal.key as BannerPositionKey, opts)
                  toast.success('Đã mở phiên đấu giá banner!')
                } else if (openModal.type === 'flash') {
                  openFlashPoolAuction(opts)
                  toast.success('Đã mở phiên Flash Sale!')
                } else {
                  openTopAuction(openModal.key as TopSlotKey, opts)
                  toast.success('Đã mở phiên Vị trí Top!')
                }
                refresh(); setOpenModal(null)
                toast.success(`🟢 Đã mở phiên! ${startDelay > 0 ? `Bắt đầu sau ${startDelay} phút.` : ''} Thông báo đã gởi đến tất cả shop.`)
              }}>
                ✅ Xác nhận mở phiên
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuctionManagementPage
