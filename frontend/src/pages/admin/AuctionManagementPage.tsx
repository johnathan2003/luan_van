import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import {
  BANNER_POSITIONS, BannerPositionKey, BannerAuctionSession,
  AuctionAdminSettings as BannerAdminSettings, BANNER_IMAGE_SPECS,
  getAllActiveSessions as getAllBannerSessions,
  getHistory as getBannerHistory,
  getAdminSettings as getBannerSettings,
  updateAdminSettings as updateBannerSettings,
  lockPosition, openAuction as openBannerAuction,
} from '../../utils/bannerAuctionStore'
import {
  FLASH_SLOTS, FlashSlotKey, FlashAuctionSession,
  AuctionAdminSettings as FlashAdminSettings, FLASH_IMAGE_SPEC,
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

interface OpenModal { type: 'banner' | 'flash'; key: string; label: string }

const AuctionManagementPage: React.FC = () => {
  const [tab, setTab] = useState<'banner' | 'flash' | 'history'>('banner')
  const [openModal, setOpenModal] = useState<OpenModal | null>(null)
  const [startDelay, setStartDelay] = useState(0)
  const [auctionDesc, setAuctionDesc] = useState('')
  const [imgSpecKey, setImgSpecKey] = useState<string | null>(null)
  const [customPreviews, setCustomPreviews] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('admin_position_previews') || '{}') } catch { return {} }
  })

  const handlePreviewUpload = (posKey: string, file: File) => {
    const reader = new FileReader()
    reader.onload = e => {
      const url = e.target?.result as string
      const next = { ...customPreviews, [posKey]: url }
      setCustomPreviews(next)
      localStorage.setItem('admin_position_previews', JSON.stringify(next))
    }
    reader.readAsDataURL(file)
  }

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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      title="Xem yêu cầu hình ảnh"
                      onClick={() => setImgSpecKey(imgSpecKey === p.key ? null : p.key)}
                      style={{ background: imgSpecKey === p.key ? C.blue : 'transparent', color: imgSpecKey === p.key ? 'white' : C.blue, border: `1px solid ${C.blue}`, borderRadius: 8, padding: '5px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      🖼️ Ảnh
                    </button>
                    {isOpen
                      ? <button style={btnStyle(C.red, 'white', true)} onClick={() => { lockPosition(p.key); refresh(); toast('🔒 Đã khoá phiên.') }}>🔒 Khoá</button>
                      : <button style={btnStyle(C.primary, 'white', true)} onClick={() => { setStartDelay(0); setAuctionDesc(''); setOpenModal({ type: 'banner', key: p.key, label: p.label }) }}>🟢 Mở phiên mới</button>
                    }
                  </div>
                </div>

                {/* ── Image spec panel ── */}
                {imgSpecKey === p.key && (() => {
                  const spec = BANNER_IMAGE_SPECS[p.key]
                  const displayImg = customPreviews[p.key] || p.previewImage
                  return (
                    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: 'rgba(37,99,235,0.06)', border: `1px solid rgba(37,99,235,0.2)`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                      {/* Preview image + upload */}
                      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                        <div style={{ position: 'relative', width: 140, height: 80 }}>
                          {displayImg
                            ? <img src={displayImg} alt={p.label} style={{ width: 140, height: 80, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}`, display: 'block' }} />
                            : <div style={{ width: 140, height: 80, borderRadius: 6, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.gray }}>Chưa có ảnh</div>
                          }
                        </div>
                        <label style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.blue, background: 'rgba(37,99,235,0.1)', border: `1px solid rgba(37,99,235,0.3)`, borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                          📷 Đổi ảnh
                          <input type="file" accept="image/*" style={{ display: 'none' }}
                            onChange={e => { const f = e.target.files?.[0]; if (f) handlePreviewUpload(p.key, f) }} />
                        </label>
                        {customPreviews[p.key] && (
                          <button onClick={() => {
                            const next = { ...customPreviews }; delete next[p.key]
                            setCustomPreviews(next); localStorage.setItem('admin_position_previews', JSON.stringify(next))
                          }} style={{ fontSize: 10, color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                            ✕ Xoá ảnh tuỳ chỉnh
                          </button>
                        )}
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
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <button
                      title="Xem yêu cầu hình ảnh"
                      onClick={() => setImgSpecKey(imgSpecKey === sl.key ? null : sl.key)}
                      style={{ background: imgSpecKey === sl.key ? C.orange : 'transparent', color: imgSpecKey === sl.key ? 'white' : C.orange, border: `1px solid ${C.orange}`, borderRadius: 8, padding: '5px 10px', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>
                      🖼️ Ảnh
                    </button>
                    {isOpen
                      ? <button style={btnStyle(C.red, 'white', true)} onClick={() => { lockSlot(sl.key); refresh(); toast('🔒 Đã khoá phiên.') }}>🔒 Khoá</button>
                      : <button style={btnStyle(C.orange, 'white', true)} onClick={() => { setStartDelay(0); setAuctionDesc(''); setOpenModal({ type: 'flash', key: sl.key, label: sl.label }) }}>🟢 Mở phiên mới</button>
                    }
                  </div>
                </div>

                {/* ── Image spec panel ── */}
                {imgSpecKey === sl.key && (
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start', background: 'rgba(234,88,12,0.06)', border: `1px solid rgba(234,88,12,0.2)`, borderRadius: 10, padding: '14px 16px', marginBottom: 16 }}>
                    {/* Preview image + upload */}
                    <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
                      <div style={{ width: 80, height: 80 }}>
                        {customPreviews[sl.key]
                          ? <img src={customPreviews[sl.key]} alt={sl.label} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 6, border: `1px solid ${C.border}`, display: 'block' }} />
                          : <div style={{ width: 80, height: 80, borderRadius: 6, border: `2px dashed ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, color: C.gray, textAlign: 'center' }}>Chưa có ảnh</div>
                        }
                      </div>
                      <label style={{ cursor: 'pointer', fontSize: 11, fontWeight: 600, color: C.orange, background: 'rgba(234,88,12,0.1)', border: `1px solid rgba(234,88,12,0.3)`, borderRadius: 6, padding: '3px 10px', whiteSpace: 'nowrap' }}>
                        📷 Đổi ảnh
                        <input type="file" accept="image/*" style={{ display: 'none' }}
                          onChange={e => { const f = e.target.files?.[0]; if (f) handlePreviewUpload(sl.key, f) }} />
                      </label>
                      {customPreviews[sl.key] && (
                        <button onClick={() => {
                          const next = { ...customPreviews }; delete next[sl.key]
                          setCustomPreviews(next); localStorage.setItem('admin_position_previews', JSON.stringify(next))
                        }} style={{ fontSize: 10, color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                          ✕ Xoá ảnh
                        </button>
                      )}
                    </div>
                    <div style={{ fontSize: 13 }}>
                      <div style={{ fontWeight: 700, color: C.orange, marginBottom: 8 }}>📐 Yêu cầu hình ảnh Flash Sale — {sl.label}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 20px', color: 'var(--text-primary)' }}>
                        <span>📏 Tỉ lệ: <b>{FLASH_IMAGE_SPEC.ratioLabel}</b></span>
                        <span>📦 Kích thước: <b>{FLASH_IMAGE_SPEC.recommendedW} × {FLASH_IMAGE_SPEC.recommendedH}px</b></span>
                        <span>💾 Tối đa: <b>{FLASH_IMAGE_SPEC.maxKB >= 1024 ? `${(FLASH_IMAGE_SPEC.maxKB/1024).toFixed(0)} MB` : `${FLASH_IMAGE_SPEC.maxKB} KB`}</b></span>
                      </div>
                      <div style={{ marginTop: 8, fontSize: 12, color: C.gray }}>
                        Ảnh sản phẩm Flash Sale cần đúng tỉ lệ ± {Math.round(FLASH_IMAGE_SPEC.tolerance * 100)}%. Khuyến nghị nền trắng/sáng, không watermark.
                      </div>
                    </div>
                  </div>
                )}

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
                    <span style={{ color: C.gray, marginLeft: 10, fontSize: 12 }}>{new Date(h.startedAt).toLocaleString("vi-VN")}</span>
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

      {/* ── Modal Mở phiên mới ────────────────────────────── */}
      {openModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={e => { if (e.target === e.currentTarget) setOpenModal(null) }}>
          <div style={{ background: "var(--bg-card)", borderRadius: 16, padding: 28, width: 460, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <h3 style={{ margin: "0 0 4px" }}>🟢 Mở phiên đấu giá mới</h3>
            <p style={{ fontSize: 13, color: C.gray, marginBottom: 20 }}>{openModal.label}</p>
            <label style={{ fontSize: 13, color: C.gray, display: "block", marginBottom: 16 }}>
              ⏱ Bắt đầu sau bao nhiêu phút? <span style={{ color: C.orange }}>(0 = ngay lập tức)</span>
              <input type="number" min={0} max={1440} value={startDelay}
                onChange={e => setStartDelay(Math.max(0, Number(e.target.value)))}
                style={{ display: "block", width: "100%", marginTop: 6, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 14, boxSizing: "border-box" }} />
              {startDelay > 0 && (
                <span style={{ fontSize: 12, color: C.blue, marginTop: 4, display: "block" }}>
                  ⏰ Khai mạc lúc: {new Date(Date.now() + startDelay * 60000).toLocaleString('vi-VN')}
                </span>
              )}
            </label>
            <label style={{ fontSize: 13, color: C.gray, display: "block", marginBottom: 20 }}>
              📋 Mô tả phiên đấu giá <span style={{ color: C.gray }}>(được hiển thị cho shop)</span>
              <textarea value={auctionDesc} onChange={e => setAuctionDesc(e.target.value)}
                rows={3} placeholder="VD: Ưu tiên shop bán điện tử, không dùng hình generic..."
                style={{ display: "block", width: "100%", marginTop: 6, padding: "8px 12px", border: `1px solid ${C.border}`, borderRadius: 8, fontSize: 13, resize: "vertical", boxSizing: "border-box" }} />
            </label>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={btnStyle('transparent', C.gray)} onClick={() => setOpenModal(null)}>Huỷ</button>
              <button style={btnStyle(openModal.type === "banner" ? C.primary : C.orange)} onClick={() => {
                const opts = { startDelayMinutes: startDelay, description: auctionDesc.trim() || undefined }
                if (openModal.type === "banner") { openBannerAuction(openModal.key as BannerPositionKey, opts) }
                else { openFlashAuction(openModal.key as FlashSlotKey, opts) }
                refresh(); setOpenModal(null)
                toast.success(`🟢 Đã mở phiên! ${startDelay > 0 ? `Bắt đầu sau ${startDelay} phút.` : ""} Thông báo đã gởi đến tất cả shop.`)
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
