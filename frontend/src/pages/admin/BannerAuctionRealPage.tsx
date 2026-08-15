/**
 * BannerAuctionRealPage.tsx — Admin quản lý banner slots + phiên đấu giá thật
 * -----------------------------------------------------------------------------
 * Kết nối API thật /api/v1/banners/  (không dùng localStorage mock)
 *
 * GET  /api/v1/banners/slots
 * POST /api/v1/banners/slots
 * PUT  /api/v1/banners/slots/{id}
 * GET  /api/v1/banners/admin/auctions
 * POST /api/v1/banners/auctions         — mở phiên mới
 * POST /api/v1/banners/auctions/{id}/end — kết thúc sớm
 * GET  /api/v1/banners/auctions/{id}    — chi tiết + bids
 */
import React, { useEffect, useState, useCallback } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'

// ── Types ─────────────────────────────────────────────────────────────────────
interface BannerSlot {
  slot_id: number
  name: string
  position: string
  width: number | null
  height: number | null
  base_price: number
  duration_days: number
  is_active: boolean
  current_auction_id: number | null
}
interface Auction {
  auction_id: number
  slot_id: number
  slot_name: string | null
  slot_position: string | null
  start_time: string
  end_time: string
  status: string
  start_price: number
  current_price: number
  end_price: number | null
  win_type: 'buyout' | 'bid' | null
  winner_shop_id: number | null
  winner_shop: string | null
  bid_count: number | null
  banner_image_url?: string | null
  banner_title?: string | null
  banner_status?: string | null
  banner_reject_reason?: string | null
  submission_attempts?: number
}
interface AuctionDetail extends Auction {
  bids: { bid_id: number; shop_name: string; amount: number; status: string; created_at: string }[]
}

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  purple:   '#7C3AED',  purpleBg: 'rgba(124,58,237,0.08)',
  green:    '#16A34A',  greenBg:  'rgba(22,163,74,0.08)',
  orange:   '#EA580C',  orangeBg: 'rgba(234,88,12,0.08)',
  red:      '#DC2626',  redBg:    'rgba(220,38,38,0.08)',
  blue:     '#2563EB',  blueBg:   'rgba(37,99,235,0.08)',
  gray:     'var(--text-secondary)',
  border:   'var(--border-subtle)',
  card:     'var(--bg-card)',
}
const btn = (bg: string, color = 'white', extra?: React.CSSProperties): React.CSSProperties => ({
  background: bg, color, border: 'none', borderRadius: 7,
  padding: '7px 14px', fontSize: 12, fontWeight: 600, cursor: 'pointer', ...extra,
})
function fmt(n: number) { return n.toLocaleString('vi-VN') + 'đ' }
function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}
const STATUS_META: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: '🟢 Đang mở',   color: C.green,  bg: C.greenBg  },
  upcoming:  { label: '⏳ Sắp mở',    color: C.orange, bg: C.orangeBg },
  ended:     { label: '⏹ Đã kết thúc', color: C.gray,  bg: 'rgba(0,0,0,0.05)' },
  cancelled: { label: '❌ Huỷ',        color: C.red,   bg: C.redBg    },
}

// ── Slot form modal ───────────────────────────────────────────────────────────
const SlotModal: React.FC<{
  slot?: BannerSlot | null
  onClose: () => void
  onSaved: () => void
}> = ({ slot, onClose, onSaved }) => {
  const [name,          setName]         = useState(slot?.name || '')
  const [position,      setPosition]     = useState(slot?.position || 'top')
  const [basePrice,     setBasePrice]    = useState(String(slot?.base_price ?? ''))
  const [durationDays,  setDurationDays] = useState(String(slot?.duration_days ?? '7'))
  const [width,         setWidth]        = useState(String(slot?.width ?? ''))
  const [height,        setHeight]       = useState(String(slot?.height ?? ''))
  const [isActive,      setIsActive]     = useState(slot?.is_active ?? true)
  const [saving, setSaving] = useState(false)

  const save = async () => {
    if (!name.trim()) { toast.error('Nhập tên slot'); return }
    setSaving(true)
    const payload = {
      name: name.trim(), position, base_price: Number(basePrice) || 0,
      duration_days: Number(durationDays) || 7,
      width: Number(width) || null, height: Number(height) || null, is_active: isActive,
    }
    try {
      if (slot) {
        await API.put(`/api/v1/banners/slots/${slot.slot_id}`, payload)
        toast.success('✅ Đã cập nhật slot')
      } else {
        await API.post('/api/v1/banners/slots', payload)
        toast.success('✅ Đã tạo slot mới')
      }
      onSaved(); onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi lưu slot')
    } finally { setSaving(false) }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: '#222' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, maxWidth: 480, width: '90%' }}>
        <h3 style={{ margin: '0 0 20px' }}>{slot ? '✏️ Sửa Slot Banner' : '➕ Tạo Slot Banner Mới'}</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Tên slot *</label>
            <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="VD: Banner Trang chủ - Top" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Vị trí</label>
            <select style={inputStyle} value={position} onChange={e => setPosition(e.target.value)}>
              {['top', 'middle', 'sidebar', 'category', 'footer'].map(p => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Giá sàn (đ)</label>
            <input style={inputStyle} type="number" value={basePrice} onChange={e => setBasePrice(e.target.value)} placeholder="100000" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Thời hạn hiển thị (ngày)</label>
            <input style={inputStyle} type="number" value={durationDays} onChange={e => setDurationDays(e.target.value)} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Rộng (px)</label>
            <input style={inputStyle} type="number" value={width} onChange={e => setWidth(e.target.value)} placeholder="1200" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Cao (px)</label>
            <input style={inputStyle} type="number" value={height} onChange={e => setHeight(e.target.value)} placeholder="300" />
          </div>
        </div>

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, marginBottom: 20, cursor: 'pointer' }}>
          <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} />
          Kích hoạt slot
        </label>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('transparent', C.gray)}>Hủy</button>
          <button onClick={save} disabled={saving} style={btn(saving ? '#9CA3AF' : C.purple)}>{saving ? 'Đang lưu...' : '💾 Lưu'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Open auction modal ────────────────────────────────────────────────────────
const OpenAuctionModal: React.FC<{
  slots: BannerSlot[]
  onClose: () => void
  onOpened: () => void
}> = ({ slots, onClose, onOpened }) => {
  const [slotId,       setSlotId]       = useState(slots[0]?.slot_id ?? 0)
  const [startPrice,   setStartPrice]   = useState('')
  const [endPrice,     setEndPrice]     = useState('')
  const [durationHours, setDurationHours] = useState('24')
  const [opening, setOpening] = useState(false)

  const open = async () => {
    if (!slotId) { toast.error('Chọn slot'); return }
    if (!endPrice || Number(endPrice) <= 0) { toast.error('Nhập endPrice — mọi phiên banner đều bắt buộc có mua đứt'); return }
    setOpening(true)
    try {
      const slot = slots.find(s => s.slot_id === Number(slotId))
      await API.post('/api/v1/banners/auctions', {
        slot_id: Number(slotId),
        start_price: Number(startPrice) || (slot?.base_price ?? 0),
        end_price: Number(endPrice),
        duration_hours: Number(durationHours) || 24,
      })
      toast.success('✅ Đã mở phiên đấu giá!')
      onOpened(); onClose()
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi mở phiên')
    } finally { setOpening(false) }
  }

  const inputStyle: React.CSSProperties = { width: '100%', padding: '8px 11px', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, boxSizing: 'border-box', background: '#fff', color: '#222' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
      <div style={{ background: 'white', borderRadius: 14, padding: 28, maxWidth: 400, width: '90%' }}>
        <h3 style={{ margin: '0 0 20px' }}>🚀 Mở phiên đấu giá</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 20 }}>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Banner slot *</label>
            <select style={inputStyle} value={slotId} onChange={e => setSlotId(Number(e.target.value))}>
              {slots.filter(s => s.is_active).map(s => <option key={s.slot_id} value={s.slot_id}>{s.name} ({s.position})</option>)}
            </select>
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Giá khởi điểm (đ) — để trống dùng giá sàn slot</label>
            <input style={inputStyle} type="number" value={startPrice} onChange={e => setStartPrice(e.target.value)} placeholder={String(slots.find(s => s.slot_id === Number(slotId))?.base_price ?? '')} />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>endPrice — giá mua đứt (*)</label>
            <input style={inputStyle} type="number" value={endPrice} onChange={e => setEndPrice(e.target.value)} placeholder="VD: 5000000" />
          </div>
          <div>
            <label style={{ fontSize: 12, color: C.gray, display: 'block', marginBottom: 4 }}>Thời gian phiên (giờ)</label>
            <div style={{ display: 'flex', gap: 5 }}>
              {['1', '6', '12', '24', '48'].map(h => (
                <button key={h} onClick={() => setDurationHours(h)}
                  style={{ ...btn(durationHours === h ? C.purple : 'transparent', durationHours === h ? 'white' : C.gray), border: `1px solid ${durationHours === h ? C.purple : C.border}`, padding: '5px 12px' }}>
                  {h}h
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={btn('transparent', C.gray)}>Hủy</button>
          <button onClick={open} disabled={opening} style={btn(opening ? '#9CA3AF' : C.green)}>{opening ? 'Đang mở...' : '🚀 Mở phiên'}</button>
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
const MAX_BANNER_BUYOUT_SUBMISSIONS = 10

// ── Tab: Duyệt nội dung banner ────────────────────────────────────────────────
const ReviewTab: React.FC = () => {
  const [pending, setPending] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    API.get('/api/v1/banners/admin/pending-review').then(r => setPending(r.data.pending || [])).finally(() => setLoading(false))
  }, [])
  useEffect(() => { load() }, [load])

  const handleApprove = async (a: Auction) => {
    setBusy(a.auction_id)
    try {
      const r = await API.post(`/api/v1/banners/auctions/${a.auction_id}/approve`)
      toast.success(r.data.message || 'Đã duyệt')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Lỗi') } finally { setBusy(null) }
  }
  const handleReject = async (a: Auction) => {
    const reason = window.prompt('Lý do từ chối:') || undefined
    setBusy(a.auction_id)
    try {
      const r = await API.post(`/api/v1/banners/auctions/${a.auction_id}/reject`, { reason })
      toast.success(r.data.message || 'Đã từ chối')
      load()
    } catch (e: any) { toast.error(e?.response?.data?.detail || 'Lỗi') } finally { setBusy(null) }
  }

  if (loading) return <p style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Đang tải...</p>
  if (pending.length === 0) return <p style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Không có nội dung nào đang chờ duyệt.</p>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pending.map(a => (
        <div key={a.auction_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {a.banner_image_url && <img src={a.banner_image_url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>{a.slot_name} (phiên #{a.auction_id})</p>
            <p style={{ margin: '0 0 4px', color: C.gray, fontSize: 12 }}>Người thắng: {a.winner_shop || '—'} · Tiêu đề: {a.banner_title || '—'}</p>
            <p style={{ margin: 0, color: C.orange, fontSize: 11 }}>
              {a.win_type === 'buyout'
                ? `Mua đứt — đã nộp ${a.submission_attempts ?? 0}/${MAX_BANNER_BUYOUT_SUBMISSIONS} lần, hạn 6h tính từ lúc thanh toán. Từ chối lần thứ ${MAX_BANNER_BUYOUT_SUBMISSIONS} sẽ huỷ vị trí luôn.`
                : 'Hạn phản hồi trong 6 giờ kể từ lúc nộp.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => handleApprove(a)} disabled={busy === a.auction_id} style={btn(C.green, 'white', { opacity: busy === a.auction_id ? 0.6 : 1 })}>✅ Duyệt</button>
            <button onClick={() => handleReject(a)} disabled={busy === a.auction_id} style={btn(C.red, 'white', { opacity: busy === a.auction_id ? 0.6 : 1 })}>❌ Từ chối</button>
          </div>
        </div>
      ))}
    </div>
  )
}

const BannerAuctionRealPage: React.FC = () => {
  const [tab, setTab] = useState<'slots' | 'auctions' | 'review'>('auctions')
  const [slots,    setSlots]    = useState<BannerSlot[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [auctionFilter, setAuctionFilter] = useState('all')
  const [loading,  setLoading]  = useState(false)
  const [detail,   setDetail]   = useState<AuctionDetail | null>(null)
  const [slotModal,    setSlotModal]    = useState<BannerSlot | null | 'new'>('new' as any)
  const [showSlotModal, setShowSlotModal] = useState(false)
  const [showOpenModal, setShowOpenModal] = useState(false)
  const [editSlot, setEditSlot] = useState<BannerSlot | null>(null)
  const [ending, setEnding] = useState<number | null>(null)

  const loadSlots = useCallback(async () => {
    try {
      const r = await API.get('/api/v1/banners/slots')
      setSlots(r.data.slots)
    } catch { /* ignore */ }
  }, [])

  const loadAuctions = useCallback(async () => {
    setLoading(true)
    try {
      const r = await API.get('/api/v1/banners/admin/auctions', { params: { status: auctionFilter, limit: 30 } })
      setAuctions(r.data.auctions)
    } catch { /* ignore */ }
    finally { setLoading(false) }
  }, [auctionFilter])

  useEffect(() => { loadSlots(); loadAuctions() }, [])
  useEffect(() => { loadAuctions() }, [auctionFilter])

  const endAuction = async (id: number) => {
    if (!window.confirm('Kết thúc phiên này ngay?')) return
    setEnding(id)
    try {
      await API.post(`/api/v1/banners/auctions/${id}/end`)
      toast.success('Phiên đã kết thúc — winner đã được charge')
      loadAuctions()
      if (detail?.auction_id === id) setDetail(null)
    } catch (e: any) {
      toast.error(e?.response?.data?.detail || 'Lỗi kết thúc phiên')
    } finally { setEnding(null) }
  }

  const loadDetail = async (id: number) => {
    try {
      const r = await API.get(`/api/v1/banners/auctions/${id}`)
      setDetail(r.data)
    } catch { toast.error('Không tải được chi tiết phiên') }
  }

  const tabBtn = (t: 'slots' | 'auctions' | 'review'): React.CSSProperties => ({
    padding: '8px 18px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', background: tab === t ? C.purple : 'transparent', color: tab === t ? 'white' : C.gray,
  })

  return (
    <div style={{ maxWidth: 1000 }}>
      <h2 style={{ marginBottom: 4 }}>🎯 Quản lý Đấu giá Banner (API Thật)</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 20 }}>Quản lý slot banner và mở phiên đấu giá kết nối backend thật.</p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={tabBtn('auctions')} onClick={() => setTab('auctions')}>📋 Phiên đấu giá</button>
        <button style={tabBtn('review')} onClick={() => setTab('review')}>✅ Duyệt nội dung</button>
        <button style={tabBtn('slots')} onClick={() => setTab('slots')}>🗂️ Banner Slots</button>
      </div>

      {/* ── REVIEW TAB ───────────────────────────────────────────────────────── */}
      {tab === 'review' && <ReviewTab />}

      {/* ── AUCTIONS TAB ─────────────────────────────────────────────────────── */}
      {tab === 'auctions' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            {['all','active','upcoming','ended'].map(f => (
              <button key={f} onClick={() => setAuctionFilter(f)}
                style={{ ...btn(auctionFilter === f ? C.purple : 'transparent', auctionFilter === f ? 'white' : C.gray), border: `1px solid ${auctionFilter === f ? C.purple : C.border}` }}>
                {f === 'all' ? '📋 Tất cả' : (STATUS_META[f]?.label ?? f)}
              </button>
            ))}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <button onClick={loadAuctions} style={btn(C.blue)}>🔄</button>
              <button onClick={() => setShowOpenModal(true)} style={btn(C.green)}>🚀 Mở phiên mới</button>
            </div>
          </div>

          {loading ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Đang tải...</p>
          ) : auctions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12 }}>
              <p style={{ color: C.gray }}>Chưa có phiên đấu giá nào.</p>
              <button onClick={() => setShowOpenModal(true)} style={{ ...btn(C.purple), marginTop: 10 }}>🚀 Mở phiên đầu tiên</button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {auctions.map(a => {
                const meta = STATUS_META[a.status] ?? STATUS_META['ended']
                const isActive = a.status === 'active'
                return (
                  <div key={a.auction_id} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
                        <b style={{ fontSize: 14 }}>{a.slot_name || `Slot #${a.slot_id}`}</b>
                        <span style={{ background: meta.bg, color: meta.color, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{meta.label}</span>
                        <span style={{ background: C.purpleBg, color: C.purple, borderRadius: 999, padding: '2px 8px', fontSize: 11 }}>{a.slot_position}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: C.gray, flexWrap: 'wrap' }}>
                        <span>Giá: <b style={{ color: C.purple }}>{fmt(a.current_price)}</b></span>
                        {a.end_price != null && <span>endPrice: <b>{fmt(a.end_price)}</b></span>}
                        {a.win_type && <span>Thắng: <b>{a.win_type === 'buyout' ? 'Mua đứt' : 'Đấu giá'}</b></span>}
                        {a.winner_shop && <span>Winner: <b>{a.winner_shop}</b></span>}
                        <span>Kết thúc: {fmtDate(a.end_time)}</span>
                        <span>{a.bid_count ?? 0} bid</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      <button onClick={() => loadDetail(a.auction_id)} style={btn(C.blueBg, C.blue)}>Chi tiết</button>
                      {isActive && (
                        <button onClick={() => endAuction(a.auction_id)} disabled={ending === a.auction_id}
                          style={btn(ending === a.auction_id ? '#9CA3AF' : C.redBg, C.red)}>
                          {ending === a.auction_id ? '...' : 'Kết thúc'}
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Detail panel */}
          {detail && (
            <div style={{ marginTop: 16, background: C.card, border: `2px solid ${C.purple}`, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
                <h3 style={{ margin: 0 }}>📊 Chi tiết phiên #{detail.auction_id} — {detail.slot_name}</h3>
                <button onClick={() => setDetail(null)} style={btn('transparent', C.gray)}>✕</button>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  ['Trạng thái', STATUS_META[detail.status]?.label ?? detail.status],
                  ['Giá hiện tại', fmt(detail.current_price)],
                  ['Người thắng', detail.winner_shop ?? '—'],
                  ['Bắt đầu', fmtDate(detail.start_time)],
                  ['Kết thúc', fmtDate(detail.end_time)],
                  ['Tổng bid', String(detail.bids?.length ?? 0)],
                ].map(([k, v]) => (
                  <div key={k} style={{ background: C.purpleBg, borderRadius: 8, padding: '10px 14px' }}>
                    <div style={{ fontSize: 11, color: C.gray, marginBottom: 2 }}>{k}</div>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{v}</div>
                  </div>
                ))}
              </div>
              <div style={{ maxHeight: 280, overflowY: 'auto', borderRadius: 8, border: `1px solid ${C.border}` }}>
                {(detail.bids ?? []).length === 0 ? (
                  <p style={{ padding: 16, color: C.gray, textAlign: 'center' }}>Chưa có bid nào.</p>
                ) : (
                  detail.bids.map((b, i) => (
                    <div key={b.bid_id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 14px', borderBottom: `1px solid ${C.border}`, background: i === 0 ? C.purpleBg : 'transparent' }}>
                      <span style={{ fontSize: 13 }}>
                        {i === 0 && '👑 '}{b.shop_name}
                        <span style={{ fontSize: 11, color: C.gray, marginLeft: 6 }}>({b.status})</span>
                      </span>
                      <b style={{ color: i === 0 ? C.purple : undefined }}>{fmt(b.amount)}</b>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── SLOTS TAB ────────────────────────────────────────────────────────── */}
      {tab === 'slots' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14, gap: 8 }}>
            <button onClick={loadSlots} style={btn(C.blue)}>🔄</button>
            <button onClick={() => { setEditSlot(null); setShowSlotModal(true) }} style={btn(C.purple)}>➕ Thêm slot mới</button>
          </div>

          {slots.length === 0 ? (
            <p style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Chưa có slot nào.</p>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px,1fr))', gap: 12 }}>
              {slots.map(s => (
                <div key={s.slot_id} style={{ background: C.card, border: `1px solid ${s.is_active ? C.border : C.redBg}`, borderRadius: 12, padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{s.name}</div>
                      <span style={{ background: C.purpleBg, color: C.purple, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>{s.position}</span>
                      {!s.is_active && <span style={{ background: C.redBg, color: C.red, borderRadius: 999, padding: '2px 8px', fontSize: 11, fontWeight: 600, marginLeft: 4 }}>Tắt</span>}
                    </div>
                    <button onClick={() => { setEditSlot(s); setShowSlotModal(true) }} style={btn(C.purpleBg, C.purple)}>✏️</button>
                  </div>
                  <div style={{ fontSize: 12, color: C.gray, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span>Giá sàn: <b style={{ color: C.green }}>{fmt(s.base_price)}</b></span>
                    <span>Thời hạn hiển thị: <b>{s.duration_days} ngày</b></span>
                    {s.width && s.height && <span>Kích thước: <b>{s.width} × {s.height} px</b></span>}
                    {s.current_auction_id && <span style={{ color: C.orange }}>🔥 Phiên #{s.current_auction_id} đang active</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {showSlotModal && (
        <SlotModal
          slot={editSlot}
          onClose={() => setShowSlotModal(false)}
          onSaved={loadSlots}
        />
      )}
      {showOpenModal && (
        <OpenAuctionModal
          slots={slots}
          onClose={() => setShowOpenModal(false)}
          onOpened={loadAuctions}
        />
      )}
    </div>
  )
}

export default BannerAuctionRealPage
