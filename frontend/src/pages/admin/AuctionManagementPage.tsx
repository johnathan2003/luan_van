/**
 * 🏆 Quản lý đấu giá vị trí Banner & Flash Sale (Admin)
 * Admin set giá khởi điểm, thời gian đấu giá, thời gian hiển thị banner thắng,
 * mở phiên đấu giá mới và khoá/mở từng vị trí. Toàn bộ là mock/demo — lưu localStorage.
 */
import React, { useEffect, useState } from 'react'
import {
  BANNER_POSITIONS, BannerPositionKey, AuctionAdminSettings as BannerAdminSettings, BannerAuctionSession,
  getAdminSettings as getBannerSettings, updateAdminSettings as updateBannerSettings,
  lockPosition as lockBannerPosition, openAuction as openBannerAuction,
  getAllActiveSessions as getAllBannerSessions, getHistory as getBannerHistory,
  msUntilEnd as msUntilBannerEnd, formatCountdown,
  getAllSubmissions as getAllBannerSubmissions, approveSubmission as approveBannerSubmission, rejectSubmission as rejectBannerSubmission,
  BannerSubmission,
} from '../../utils/bannerAuctionStore'
import {
  FLASH_SLOTS, FlashSlotKey, AuctionAdminSettings as FlashAdminSettings, FlashAuctionSession,
  getAdminSettings as getFlashSettings, updateAdminSettings as updateFlashSettings,
  lockPosition as lockFlashSlot, openAuction as openFlashAuction,
  getAllActiveSessions as getAllFlashSessions, getHistory as getFlashHistory,
  msUntilEnd as msUntilFlashEnd,
  getAllFlashSubmissions, approveFlashSubmission, rejectFlashSubmission,
  FlashSubmission,
} from '../../utils/flashSaleAuctionStore'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

type EditTarget = { kind: 'banner'; key: BannerPositionKey } | { kind: 'flash'; key: FlashSlotKey }

const msToMin = (ms: number) => Math.round(ms / 60_000)
const minToMs = (min: number) => Math.round(min) * 60_000
const msToDay = (ms: number) => +(ms / (24 * 60 * 60 * 1000)).toFixed(2)
const dayToMs = (day: number) => Math.round(day * 24 * 60 * 60 * 1000)

const AuctionManagementPage: React.FC = () => {
  const [bannerSettings, setBannerSettings] = useState<Record<BannerPositionKey, BannerAdminSettings>>({} as any)
  const [flashSettings, setFlashSettings] = useState<Record<FlashSlotKey, FlashAdminSettings>>({} as any)
  const [bannerSessions, setBannerSessions] = useState<Partial<Record<BannerPositionKey, BannerAuctionSession>>>({})
  const [flashSessions, setFlashSessions] = useState<Partial<Record<FlashSlotKey, FlashAuctionSession>>>({})
  const [now, setNow] = useState(Date.now())
  const [edit, setEdit] = useState<EditTarget | null>(null)
  const [form, setForm] = useState({ basePrice: 0, biddingMin: 0, displayDay: 0 })
  const [bannerSubmissions, setBannerSubmissions] = useState<BannerSubmission[]>([])
  const [flashSubmissions, setFlashSubmissions] = useState<FlashSubmission[]>([])
  const [rejectTarget, setRejectTarget] = useState<{ kind: 'banner' | 'flash'; id: string } | null>(null)
  const [rejectReason, setRejectReason] = useState('')

  const refresh = () => {
    setBannerSettings({ ...getBannerSettings() })
    setFlashSettings({ ...getFlashSettings() })
    setBannerSessions({ ...getAllBannerSessions() })
    setFlashSessions({ ...getAllFlashSessions() })
    setBannerSubmissions([...getAllBannerSubmissions()])
    setFlashSubmissions([...getAllFlashSubmissions()])
  }

  useEffect(() => {
    refresh()
    const t1 = setInterval(refresh, 2000)
    const t2 = setInterval(() => setNow(Date.now()), 1000)
    return () => { clearInterval(t1); clearInterval(t2) }
  }, [])

  const openEdit = (target: EditTarget) => {
    const s = target.kind === 'banner' ? bannerSettings[target.key] : flashSettings[target.key]
    if (!s) return
    setForm({ basePrice: s.basePrice, biddingMin: msToMin(s.biddingDurationMs), displayDay: msToDay(s.displayDurationMs) })
    setEdit(target)
  }

  const handleSaveEdit = () => {
    if (!edit) return
    const patch = { basePrice: Number(form.basePrice) || 0, biddingDurationMs: minToMs(Number(form.biddingMin) || 1), displayDurationMs: dayToMs(Number(form.displayDay) || 0.1) }
    if (edit.kind === 'banner') updateBannerSettings(edit.key, patch)
    else updateFlashSettings(edit.key, patch)
    setEdit(null)
    refresh()
  }

  const handleLock = (target: EditTarget) => {
    if (!window.confirm('Khoá vị trí này? Phiên đấu giá đang mở (nếu có) sẽ kết thúc ngay và không tự mở phiên mới cho tới khi bạn mở lại.')) return
    if (target.kind === 'banner') lockBannerPosition(target.key)
    else lockFlashSlot(target.key)
    refresh()
  }

  const handleOpen = (target: EditTarget) => {
    if (target.kind === 'banner') openBannerAuction(target.key)
    else openFlashAuction(target.key)
    refresh()
  }

  const handleApprove = (kind: 'banner' | 'flash', id: string) => {
    if (kind === 'banner') approveBannerSubmission(id)
    else approveFlashSubmission(id)
    refresh()
  }

  const handleRejectConfirm = () => {
    if (!rejectTarget) return
    if (rejectTarget.kind === 'banner') rejectBannerSubmission(rejectTarget.id, rejectReason.trim() || undefined)
    else rejectFlashSubmission(rejectTarget.id, rejectReason.trim() || undefined)
    setRejectTarget(null)
    setRejectReason('')
    refresh()
  }

  const pendingBannerSubs = bannerSubmissions.filter(s => s.status === 'pending')
  const pendingFlashSubs = flashSubmissions.filter(s => s.status === 'pending')
  const totalPendingReview = pendingBannerSubs.length + pendingFlashSubs.length

  const totalLocked = Object.values(bannerSettings).filter((s: any) => s?.locked).length + Object.values(flashSettings).filter((s: any) => s?.locked).length
  const totalOpen = Object.keys(bannerSessions).length + Object.keys(flashSessions).length
  const totalPositions = BANNER_POSITIONS.length + FLASH_SLOTS.length

  const renderRow = (
    label: string, settings: BannerAdminSettings | FlashAdminSettings | undefined,
    session: BannerAuctionSession | FlashAuctionSession | undefined, target: EditTarget,
  ) => {
    const remaining = session ? Math.max(0, (target.kind === 'banner' ? msUntilBannerEnd(session as BannerAuctionSession) : msUntilFlashEnd(session as FlashAuctionSession))) : 0
    const highest = session && session.bids.length ? session.bids.reduce((a, b) => (b.amount > a.amount ? b : a)) : undefined
    return (
      <tr key={target.key} style={{ borderBottom: `1px solid ${C.tint}` }}>
        <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.navy }}>{label}</td>
        <td style={{ padding: '12px 14px', fontSize: 13 }}>{(settings?.basePrice ?? 0).toLocaleString('vi-VN')}đ</td>
        <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>{msToMin(settings?.biddingDurationMs ?? 0)} phút</td>
        <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>{msToDay(settings?.displayDurationMs ?? 0)} ngày</td>
        <td style={{ padding: '12px 14px' }}>
          {settings?.locked ? (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#FEE2E2', color: C.error }}>🔒 Đã khoá</span>
          ) : session ? (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#DCFCE7', color: C.success }}>● Đang mở · còn {formatCountdown(remaining)}</span>
          ) : (
            <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#F1F5F9', color: C.gray }}>Chưa có phiên</span>
          )}
        </td>
        <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>
          {highest ? <span style={{ color: C.navy, fontWeight: 700 }}>{highest.amount.toLocaleString('vi-VN')}đ</span> : '—'}
        </td>
        <td style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => openEdit(target)} style={{ padding: '5px 10px', background: C.light, color: C.blue, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>⚙️ Cấu hình</button>
            {settings?.locked ? (
              <button onClick={() => handleOpen(target)} style={{ padding: '5px 10px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>▶️ Mở phiên</button>
            ) : (
              <button onClick={() => handleLock(target)} style={{ padding: '5px 10px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>🔒 Khoá</button>
            )}
          </div>
        </td>
      </tr>
    )
  }

  const bannerHistory = getBannerHistory()
  const flashHistory = getFlashHistory()
  const allHistory = [
    ...bannerHistory.map(h => ({ ...h, _type: 'banner' as const, _label: BANNER_POSITIONS.find(d => d.key === h.position)?.label ?? h.position })),
    ...flashHistory.map(h => ({ ...h, _type: 'flash' as const, _label: FLASH_SLOTS.find(d => d.key === h.slot)?.label ?? h.slot })),
  ].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()).slice(0, 20)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🏆 Quản lý đấu giá Banner & Flash Sale</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
          Set giá khởi điểm, thời gian đấu giá, thời gian hiển thị sau khi thắng, và khoá/mở từng vị trí.
        </p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        <div className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${C.blue}` }}>
          <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>Tổng số vị trí</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: C.blue }}>{totalPositions}</p>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${C.success}` }}>
          <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>Đang mở đấu giá</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: C.success }}>{totalOpen}</p>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${C.error}` }}>
          <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>Đang khoá</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: C.error }}>{totalLocked}</p>
        </div>
        <div className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${C.warning}` }}>
          <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>Chờ duyệt nội dung</p>
          <p style={{ fontSize: 26, fontWeight: 800, color: C.warning }}>{totalPendingReview}</p>
        </div>
      </div>

      {/* Chờ duyệt — banner/sản phẩm shop đã đăng sau khi thanh toán */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.tint}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>📝 Chờ duyệt nội dung đấu giá</h2>
          <p style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>Banner / sản phẩm shop đã đăng sau khi thanh toán thắng đấu giá — cần Admin duyệt trước khi hiển thị.</p>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Loại', 'Shop', 'Nội dung', 'Vị trí', 'Ngày đăng', 'Trạng thái', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[...bannerSubmissions.map(s => ({ ...s, _kind: 'banner' as const })), ...flashSubmissions.map(s => ({ ...s, _kind: 'flash' as const }))]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .length === 0 && (
              <tr><td colSpan={7} style={{ padding: 20, textAlign: 'center', fontSize: 13, color: C.gray }}>Chưa có nội dung nào được đăng.</td></tr>
            )}
            {[...bannerSubmissions.map(s => ({ ...s, _kind: 'banner' as const })), ...flashSubmissions.map(s => ({ ...s, _kind: 'flash' as const }))]
              .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
              .map(s => {
                const isBanner = s._kind === 'banner'
                const bs = s as BannerSubmission & { _kind: 'banner' }
                const fs = s as FlashSubmission & { _kind: 'flash' }
                const positionLabel = isBanner
                  ? BANNER_POSITIONS.find(d => d.key === bs.position)?.label ?? bs.position
                  : FLASH_SLOTS.find(d => d.key === fs.slot)?.label ?? fs.slot
                return (
                  <tr key={s.id} style={{ borderBottom: `1px solid ${C.tint}` }}>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>{isBanner ? '🖼️ Banner' : '⚡ Flash Sale'}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 600 }}>{s.shopName}</td>
                    <td style={{ padding: '12px 14px', fontSize: 13 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {isBanner ? (bs.image && <img src={bs.image} alt="" style={{ width: 44, height: 28, objectFit: 'cover', borderRadius: 4 }} />) : (fs.productImage && <img src={fs.productImage} alt="" style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 4 }} />)}
                        <div>
                          <div style={{ fontWeight: 600 }}>{isBanner ? bs.title : fs.productName}</div>
                          {isBanner && bs.link && <div style={{ fontSize: 11, color: C.gray }}>{bs.link}</div>}
                          {!isBanner && <div style={{ fontSize: 11, color: C.gray }}>{fs.price?.toLocaleString('vi-VN')}đ</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>{positionLabel}</td>
                    <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>{new Date(s.createdAt).toLocaleString('vi-VN')}</td>
                    <td style={{ padding: '12px 14px' }}>
                      {s.status === 'pending' && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#FEF3C7', color: C.warning }}>Chờ duyệt</span>}
                      {s.status === 'approved' && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#DCFCE7', color: C.success }}>Đã duyệt</span>}
                      {s.status === 'rejected' && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#FEE2E2', color: C.error }}>Đã từ chối</span>}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      {s.status === 'pending' && (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => handleApprove(s._kind, s.id)} style={{ padding: '5px 10px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>✅ Duyệt</button>
                          <button onClick={() => { setRejectTarget({ kind: s._kind, id: s.id }); setRejectReason('') }} style={{ padding: '5px 10px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>❌ Từ chối</button>
                        </div>
                      )}
                    </td>
                  </tr>
                )
              })}
          </tbody>
        </table>
      </div>

      {/* Banner positions */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.tint}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>🖼️ Vị trí đấu giá Banner</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Vị trí', 'Giá khởi điểm', 'Thời gian đấu giá', 'Thời gian hiển thị', 'Trạng thái', 'Đang dẫn đầu', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BANNER_POSITIONS.map(def => renderRow(def.label, bannerSettings[def.key], bannerSessions[def.key], { kind: 'banner', key: def.key }))}
          </tbody>
        </table>
      </div>

      {/* Flash sale slots */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.tint}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>⚡ Vị trí đấu giá Flash Sale</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Vị trí', 'Giá khởi điểm', 'Thời gian đấu giá', 'Thời gian hiển thị', 'Trạng thái', 'Đang dẫn đầu', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FLASH_SLOTS.map(def => renderRow(def.label, flashSettings[def.key], flashSessions[def.key], { kind: 'flash', key: def.key }))}
          </tbody>
        </table>
      </div>

      {/* History */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${C.tint}` }}>
          <h2 style={{ fontSize: 15, fontWeight: 800, color: C.navy }}>🕒 Lịch sử phiên đấu giá (toàn hệ thống — 20 phiên gần nhất)</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Vị trí', 'Bắt đầu', 'Kết thúc', 'Người thắng', 'Số tiền', 'Thanh toán'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allHistory.length === 0 && (
              <tr><td colSpan={6} style={{ padding: 20, textAlign: 'center', fontSize: 13, color: C.gray }}>Chưa có phiên đấu giá nào kết thúc.</td></tr>
            )}
            {allHistory.map(h => (
              <tr key={h.id} style={{ borderBottom: `1px solid ${C.tint}` }}>
                <td style={{ padding: '12px 14px', fontSize: 13 }}>{h._type === 'banner' ? '🖼️' : '⚡'} {h._label}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>{new Date(h.startedAt).toLocaleString('vi-VN')}</td>
                <td style={{ padding: '12px 14px', fontSize: 12, color: C.gray }}>{new Date(h.endsAt).toLocaleString('vi-VN')}</td>
                <td style={{ padding: '12px 14px', fontSize: 13 }}>{h.winner?.shopName ?? <span style={{ color: C.gray }}>Không có lượt đấu giá</span>}</td>
                <td style={{ padding: '12px 14px', fontSize: 13, fontWeight: 700, color: C.navy }}>{h.winner ? h.winner.amount.toLocaleString('vi-VN') + 'đ' : '—'}</td>
                <td style={{ padding: '12px 14px' }}>
                  {h.confirmation === 'paid' && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#DCFCE7', color: C.success }}>Đã thanh toán</span>}
                  {h.confirmation === 'confirmed' && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#FEF3C7', color: C.warning }}>Chờ thanh toán</span>}
                  {h.confirmation === 'pending' && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#FEF3C7', color: C.warning }}>Chờ xác nhận</span>}
                  {h.confirmation === 'declined' && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#F1F5F9', color: C.gray }}>Đã từ chối</span>}
                  {h.confirmation === 'expired' && <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: '#FEE2E2', color: C.error }}>Quá hạn</span>}
                  {!h.confirmation && '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Edit modal */}
      {edit && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setEdit(null)}>
          <div className="card" style={{ width: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>Cấu hình đấu giá</h2>
              <button onClick={() => setEdit(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Giá khởi điểm (đ)</label>
                <input type="number" value={form.basePrice} onChange={e => setForm(f => ({ ...f, basePrice: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Thời gian 1 phiên đấu giá (phút)</label>
                <input type="number" value={form.biddingMin} onChange={e => setForm(f => ({ ...f, biddingMin: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>Phiên đấu giá sẽ tự kết thúc sau khoảng thời gian này, áp dụng từ phiên kế tiếp.</p>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Thời gian hiển thị sau khi thắng (ngày)</label>
                <input type="number" step="0.5" value={form.displayDay} onChange={e => setForm(f => ({ ...f, displayDay: Number(e.target.value) }))}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>VD: 2 — banner/vị trí thắng sẽ được lên lịch hiển thị 2 ngày sau khi shop thanh toán.</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setEdit(null)} style={{ flex: 1, padding: '10px', background: C.tint, color: C.gray, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSaveEdit} style={{ flex: 2, padding: '10px', background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>Lưu cấu hình</button>
            </div>
          </div>
        </div>
      )}

      {/* Reject reason modal */}
      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setRejectTarget(null)}>
          <div className="card" style={{ width: 400, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 18 }}>
              <h2 style={{ fontSize: 17, fontWeight: 800, color: C.navy }}>Từ chối nội dung</h2>
              <button onClick={() => setRejectTarget(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Lý do từ chối (không bắt buộc)</label>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={3}
              placeholder="VD: Hình ảnh không đạt chuẩn, nội dung vi phạm chính sách..."
              style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', resize: 'vertical' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
              <button onClick={() => setRejectTarget(null)} style={{ flex: 1, padding: '10px', background: C.tint, color: C.gray, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleRejectConfirm} style={{ flex: 2, padding: '10px', background: C.error, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>Xác nhận từ chối</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AuctionManagementPage
