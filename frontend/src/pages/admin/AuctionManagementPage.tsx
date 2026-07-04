import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  BANNER_POSITIONS, BannerPositionKey, BannerAuctionSession,
  AuctionAdminSettings as BannerAdminSettings,
  getAllActiveSessions as getAllBannerSessions,
  getHistory as getBannerHistory,
  getAdminSettings as getBannerSettings,
  updateAdminSettings as updateBannerSettings,
  lockPosition, openAuction as openBannerAuction,
} from '../../utils/bannerAuctionStore'
import {
  FLASH_SLOTS, FlashSlotKey, FlashAuctionSession,
  AuctionAdminSettings as FlashAdminSettings,
  getAllActiveSessions as getAllFlashSessions,
  getHistory as getFlashHistory,
  getAdminSettings as getFlashSettings,
  updateAdminSettings as updateFlashSettings,
  lockSlot, openAuction as openFlashAuction,
} from '../../utils/flashSaleAuctionStore'

const C = {
  primary: '#16A34A', primaryLight: 'rgba(22,163,74,0.1)',
  orange: '#EA580C', orangeLight: 'rgba(234,88,12,0.1)',
  blue: '#2563EB', blueLight: 'rgba(37,99,235,0.1)',
  red: '#DC2626', redLight: 'rgba(220,38,38,0.1)',
  gray: 'var(--text-secondary)', border: 'var(--border-subtle)', cardBg: 'var(--bg-card)',
}

const cardStyle: React.CSSProperties = { background: C.cardBg, border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginBottom: 16 }
const btnStyle = (bg: string, color = 'white', small = false): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 8, padding: small ? '5px 12px' : '8px 16px', fontSize: small ? 12 : 13, fontWeight: 600, cursor: 'pointer',
})
const badge = (color: string, bg: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 999, fontSize: 11, fontWeight: 600, color, background: bg,
})

const AuctionManagementPage: React.FC = () => {
  const [tab, setTab] = useState<'banner' | 'flash' | 'history'>('banner')

  // sessions
  const [bannerSessions, setBannerSessions] = useState<Partial<Record<BannerPositionKey, BannerAuctionSession>>>({})
  const [flashSessions, setFlashSessions] = useState<Partial<Record<FlashSlotKey, FlashAuctionSession>>>({})
  // history
  const [bannerHistory, setBannerHistory] = useState<BannerAuctionSession[]>([])
  const [flashHistory, setFlashHistory] = useState<FlashAuctionSession[]>([])
  // settings
  const [bannerSettings, setBannerSettingsState] = useState<Record<BannerPositionKey, BannerAdminSettings>>({} as any)
  const [flashSettings, setFlashSettingsState] = useState<Record<FlashSlotKey, FlashAdminSettings>>({} as any)

  const refresh = () => {
    setBannerSessions({ ...getAllBannerSessions() })
    setFlashSessions({ ...getAllFlashSessions() })
    setBannerHistory(getBannerHistory())
    setFlashHistory(getFlashHistory())
    setBannerSettingsState({ ...getBannerSettings() })
    setFlashSettingsState({ ...getFlashSettings() })
  }

  useEffect(() => { refresh() }, [])

  // stats
  const totalPositions = BANNER_POSITIONS.length + FLASH_SLOTS.length
  const lockedBanner = BANNER_POSITIONS.filter(p => !bannerSessions[p.key]).length
  const lockedFlash = FLASH_SLOTS.filter(s => !flashSessions[s.key]).length
  const locked = lockedBanner + lockedFlash
  const open = totalPositions - locked

  return (
    <div style={{ maxWidth: 960 }}>
      <h2 style={{ marginBottom: 4 }}>🏆 Quản lý đấu giá quảng cáo</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>Cấu hình và mở/khoá phiên đấu giá banner và Flash Sale. Duyệt nội dung tại trang Banner QC.</p>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Tổng vị trí', value: totalPositions, color: C.blue, bg: C.blueLight },
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
        {(['banner', 'flash', 'history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            style={{ ...btnStyle(tab === t ? C.primary : 'transparent', tab === t ? 'white' : C.gray), border: `1px solid ${tab === t ? C.primary : C.border}` }}>
            {t === 'banner' ? '🖼️ Banner' : t === 'flash' ? '⚡ Flash Sale' : '📋 Lịch sử'}
          </button>
        ))}
      </div>

      {/* ── Banner settings tab ─────────────────────────────────────────── */}
      {tab === 'banner' && (
        <>
          {BANNER_POSITIONS.map(p => {
            const s = bannerSettings[p.key]; if (!s) return null
            const isOpen = !!bannerSessions[p.key]
            const isLocked = !isOpen && !!s.locked
            const statusColor = isOpen ? C.primary : isLocked ? C.red : C.orange
            const statusBg = isOpen ? C.primaryLight : isLocked ? C.redLight : C.orangeLight
            const statusLabel = isOpen ? '🟢 Đang mở' : isLocked ? '🔴 Bị khoá' : '⏸ Chờ mở phiên mới'
            return (
              <div key={p.key} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{p.label}</h4>
                    <span style={badge(statusColor, statusBg)}>{statusLabel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isOpen
                      ? <button style={btnStyle(C.red, 'white', true)} onClick={() => { lockPosition(p.key); refresh(); toast('🔒 Đã khoá phiên.') }}>🔒 Khoá</button>
                      : <button style={btnStyle(C.primary, 'white', true)} onClick={() => { openBannerAuction(p.key); refresh(); toast.success('🟢 Đã mở phiên mới!') }}>🟢 Mở phiên mới</button>
                    }
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <label style={{ fontSize: 12, color: C.gray }}>
                    Giá khởi điểm (đ)
                    <input type="number" step={100000} defaultValue={s.basePrice}
                      onBlur={e => { updateBannerSettings(p.key, { basePrice: Number(e.target.value) }); refresh() }}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 12, color: C.gray }}>
                    Thời gian phiên (phút)
                    <input type="number" defaultValue={Math.round(s.biddingDurationMs / 60000)}
                      onBlur={e => { updateBannerSettings(p.key, { biddingDurationMs: Number(e.target.value) * 60000 }); refresh() }}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 12, color: C.gray }}>
                    Hiển thị sau thắng (giờ)
                    <input type="number" defaultValue={Math.round(s.displayDurationMs / 3600000)}
                      onBlur={e => { updateBannerSettings(p.key, { displayDurationMs: Number(e.target.value) * 3600000 }); refresh() }}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box' }} />
                  </label>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ── Flash settings tab ──────────────────────────────────────────── */}
      {tab === 'flash' && (
        <>
          {FLASH_SLOTS.map(sl => {
            const s = flashSettings[sl.key]; if (!s) return null
            const isOpen = !!flashSessions[sl.key]
            const isLocked = !isOpen && !!s.locked
            const statusColor = isOpen ? C.orange : isLocked ? C.red : C.gray
            const statusBg = isOpen ? C.orangeLight : isLocked ? C.redLight : 'rgba(156,163,175,0.12)'
            const statusLabel = isOpen ? '🟢 Đang mở' : isLocked ? '🔴 Bị khoá' : '⏸ Chờ mở phiên mới'
            return (
              <div key={sl.key} style={cardStyle}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <div>
                    <h4 style={{ margin: 0 }}>{sl.label}</h4>
                    <span style={badge(statusColor, statusBg)}>{statusLabel}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {isOpen
                      ? <button style={btnStyle(C.red, 'white', true)} onClick={() => { lockSlot(sl.key); refresh(); toast('🔒 Đã khoá phiên.') }}>🔒 Khoá</button>
                      : <button style={btnStyle(C.orange, 'white', true)} onClick={() => { openFlashAuction(sl.key); refresh(); toast.success('🟢 Đã mở phiên mới!') }}>🟢 Mở phiên mới</button>
                    }
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                  <label style={{ fontSize: 12, color: C.gray }}>
                    Giá khởi điểm (đ)
                    <input type="number" step={100000} defaultValue={s.basePrice}
                      onBlur={e => { updateFlashSettings(sl.key, { basePrice: Number(e.target.value) }); refresh() }}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 12, color: C.gray }}>
                    Thời gian phiên (phút)
                    <input type="number" defaultValue={Math.round(s.biddingDurationMs / 60000)}
                      onBlur={e => { updateFlashSettings(sl.key, { biddingDurationMs: Number(e.target.value) * 60000 }); refresh() }}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box' }} />
                  </label>
                  <label style={{ fontSize: 12, color: C.gray }}>
                    Hiển thị sau thắng (giờ)
                    <input type="number" defaultValue={Math.round(s.displayDurationMs / 3600000)}
                      onBlur={e => { updateFlashSettings(sl.key, { displayDurationMs: Number(e.target.value) * 3600000 }); refresh() }}
                      style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 10px', border: `1px solid ${C.border}`, borderRadius: 6, boxSizing: 'border-box' }} />
                  </label>
                </div>
              </div>
            )
          })}
        </>
      )}

      {/* ── History tab ─────────────────────────────────────────────────── */}
      {tab === 'history' && (
        <>
          {[...bannerHistory.map(h => ({ kind: 'banner' as const, h })), ...flashHistory.map(h => ({ kind: 'flash' as const, h }))]
            .sort((a, b) => b.h.startedAt.localeCompare(a.h.startedAt))
            .slice(0, 20)
            .map(({ kind, h }) => (
              <div key={h.id} style={{ ...cardStyle, padding: '12px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div style={{ fontSize: 13 }}>
                    <span style={badge(kind === 'banner' ? C.blue : C.orange, kind === 'banner' ? C.blueLight : C.orangeLight)}>{kind === 'banner' ? '🖼️' : '⚡'}</span>
                    {' '}<b>{kind === 'banner'
                      ? BANNER_POSITIONS.find(p => p.key === (h as BannerAuctionSession).position)?.label
                      : FLASH_SLOTS.find(s => s.key === (h as FlashAuctionSession).slot)?.label}</b>
                    <span style={{ color: C.gray, marginLeft: 10, fontSize: 12 }}>{new Date(h.startedAt).toLocaleString('vi-VN')}</span>
                  </div>
                  {h.winner ? (
                    <span style={badge(
                      h.confirmation === 'paid' ? C.primary : h.confirmation === 'expired' || h.confirmation === 'declined' ? C.red : C.orange,
                      h.confirmation === 'paid' ? C.primaryLight : h.confirmation === 'expired' || h.confirmation === 'declined' ? C.redLight : C.orangeLight,
                    )}>
                      {h.winner.shopName} — {h.winner.amount.toLocaleString('vi-VN')}đ ({h.confirmation ?? '–'})
                    </span>
                  ) : <span style={badge(C.gray, 'rgba(156,163,175,0.15)')}>Không có người thắng</span>}
                </div>
              </div>
            ))}
        </>
      )}

    </div>
  )
}

export default AuctionManagementPage
