/**
 * SlotAuctionAdminPage.tsx — Admin vận hành đấu giá vị trí Flash Sale / Top sản phẩm
 * ---------------------------------------------------------------------------
 * Admin (không phải super) là người tạo/sửa slot, mở/kết thúc phiên, duyệt
 * nội dung shop nộp, gỡ khoá vi phạm — super chỉ xem (super/frontend/pages/
 * SuperSlotAuctions.tsx là bản chỉ đọc).
 *
 * GET/POST/PUT /api/v1/slots/{family}[...]  (require_admin_or_superadmin)
 */
import React, { useCallback, useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'

type Family = 'flash' | 'top'
const FAMILY_LABEL: Record<Family, string> = { flash: '⚡ Flash Sale', top: '🚀 Top sản phẩm' }

interface Slot {
  slot_id: number; name: string; base_price: number; is_active: boolean
  image_width: number | null; image_height: number | null; image_format: string | null
  content_rules: string | null; current_auction_id: number | null
}
interface Auction {
  auction_id: number; slot_id: number; slot_name: string | null
  start_time: string; end_time: string; status: string
  start_price: number; current_price: number; end_price: number | null
  winner_shop_id: number | null; winner_shop: string | null; win_type: string | null
  submission_status: string | null; submission_image_url: string | null
  submission_title: string | null; reject_reason: string | null
  activates_at: string | null; family?: Family
  submission_attempts?: number
}
interface Violation { shop_id: number; shop_name: string | null; violation_count: number; banned: boolean; updated_at: string | null }

const C = {
  navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF',
  gray: 'var(--text-secondary)', border: 'var(--border-subtle)', card: 'var(--bg-card)',
  success: '#16A34A', warning: '#D97706', error: '#DC2626', purple: '#7C3AED',
}

const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN') + 'đ'
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

const btn = (color: string, disabled?: boolean): React.CSSProperties => ({
  padding: '7px 14px', borderRadius: 7, border: 'none', fontSize: 12, fontWeight: 700,
  background: disabled ? '#E5E7EB' : color, color: disabled ? '#9CA3AF' : '#fff',
  cursor: disabled ? 'not-allowed' : 'pointer',
})
const inputStyle: React.CSSProperties = { padding: '8px 11px', background: '#fff', border: `1px solid ${C.border}`, borderRadius: 7, fontSize: 13, outline: 'none' }
const STATUS_COLOR: Record<string, string> = { upcoming: C.warning, active: C.success, ended: C.gray, live: C.blue, forfeited: C.error }

const SlotAuctionAdminPage: React.FC = () => {
  const [family, setFamily] = useState<Family>('flash')
  const [tab, setTab] = useState<'slots' | 'auctions' | 'review' | 'violations'>('slots')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h2 style={{ margin: 0 }}>🏆 Đấu giá vị trí Flash Sale / Top sản phẩm</h2>
        <p style={{ color: C.gray, fontSize: 13, marginTop: 4 }}>
          Quản lý slot, mở phiên đấu giá, duyệt nội dung shop nộp sau khi thắng, theo dõi vi phạm thanh toán.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(['flash', 'top'] as Family[]).map(f => (
          <button key={f} onClick={() => setFamily(f)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${family === f ? C.navy : C.border}`, background: family === f ? C.navy : 'transparent', color: family === f ? '#fff' : C.gray, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {FAMILY_LABEL[f]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${C.border}` }}>
        {[
          { k: 'slots', l: '⚙️ Slot' },
          { k: 'auctions', l: '📅 Phiên đấu giá' },
          { k: 'review', l: '✅ Duyệt nội dung' },
          { k: 'violations', l: '⚠️ Vi phạm' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: tab === t.k ? `2px solid ${C.navy}` : '2px solid transparent', color: tab === t.k ? undefined : C.gray, fontWeight: tab === t.k ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'slots' && <SlotsTab family={family} />}
      {tab === 'auctions' && <AuctionsTab family={family} />}
      {tab === 'review' && <ReviewTab />}
      {tab === 'violations' && <ViolationsTab />}
    </div>
  )
}

// ── Tab: Slot CRUD ────────────────────────────────────────────────────────────
const SlotsTab: React.FC<{ family: Family }> = ({ family }) => {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: '', base_price: '', image_width: '', image_height: '', image_format: '', content_rules: '' })

  const load = useCallback(() => {
    setLoading(true)
    API.get(`/api/v1/slots/${family}`).then(r => setSlots(r.data.slots || [])).finally(() => setLoading(false))
  }, [family])

  useEffect(() => { load() }, [load])

  const handleCreate = async () => {
    if (!form.name.trim()) { toast.error('Nhập tên slot'); return }
    setSaving(true)
    try {
      await API.post(`/api/v1/slots/${family}`, {
        name: form.name, base_price: Number(form.base_price) || 0,
        image_width: form.image_width ? Number(form.image_width) : null,
        image_height: form.image_height ? Number(form.image_height) : null,
        image_format: form.image_format || null,
        content_rules: form.content_rules || null,
      })
      toast.success('✅ Đã tạo slot')
      setForm({ name: '', base_price: '', image_width: '', image_height: '', image_format: '', content_rules: '' })
      setFormOpen(false)
      load()
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi khi tạo slot') } finally { setSaving(false) }
  }

  const toggleActive = async (s: Slot) => {
    try { await API.put(`/api/v1/slots/${family}/${s.slot_id}`, { is_active: !s.is_active }); load() }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div><button onClick={() => setFormOpen(o => !o)} style={btn(C.navy)}>{formOpen ? '✕ Đóng' : '+ Tạo slot mới'}</button></div>

      {formOpen && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder="Tên slot (vd: Flash Sale #1)" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 200 }} />
            <input placeholder="Giá sàn (đ)" value={form.base_price} onChange={e => setForm({ ...form, base_price: e.target.value.replace(/[^\d]/g, '') })} style={{ ...inputStyle, width: 140 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder="Rộng ảnh (px)" value={form.image_width} onChange={e => setForm({ ...form, image_width: e.target.value.replace(/[^\d]/g, '') })} style={{ ...inputStyle, width: 120 }} />
            <input placeholder="Cao ảnh (px)" value={form.image_height} onChange={e => setForm({ ...form, image_height: e.target.value.replace(/[^\d]/g, '') })} style={{ ...inputStyle, width: 120 }} />
            <input placeholder="Định dạng (jpg,png,webp)" value={form.image_format} onChange={e => setForm({ ...form, image_format: e.target.value })} style={{ ...inputStyle, width: 200 }} />
          </div>
          <textarea placeholder="Quy định nội dung (cấm gì, yêu cầu gì...)" value={form.content_rules} onChange={e => setForm({ ...form, content_rules: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={handleCreate} disabled={saving} style={{ ...btn(C.success, saving), alignSelf: 'flex-start' }}>{saving ? '⏳...' : '✅ Tạo slot'}</button>
        </div>
      )}

      {loading ? <div style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Đang tải...</div> : slots.length === 0 ? (
        <div style={{ color: C.gray, textAlign: 'center', padding: 30, background: C.card, borderRadius: 12, border: `1px solid ${C.border}` }}>Chưa có slot nào.</div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'rgba(0,0,0,0.02)' }}>{['ID', 'Tên', 'Giá sàn', 'Kích thước', 'Trạng thái', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: C.gray, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {slots.map(s => (
                <tr key={s.slot_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 14px', color: C.gray }}>#{s.slot_id}</td>
                  <td style={{ padding: '8px 14px', fontWeight: 600 }}>{s.name}</td>
                  <td style={{ padding: '8px 14px', color: C.purple }}>{fmt(s.base_price)}</td>
                  <td style={{ padding: '8px 14px', color: C.gray }}>{s.image_width && s.image_height ? `${s.image_width}×${s.image_height}` : '—'}</td>
                  <td style={{ padding: '8px 14px' }}><span style={{ color: s.is_active ? C.success : C.gray, fontWeight: 700 }}>{s.is_active ? '🟢 Hoạt động' : '⚪ Tắt'}</span></td>
                  <td style={{ padding: '8px 14px' }}><button onClick={() => toggleActive(s)} style={btn(s.is_active ? C.error : C.success)}>{s.is_active ? 'Tắt' : 'Bật'}</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Phiên đấu giá ────────────────────────────────────────────────────────
const AuctionsTab: React.FC<{ family: Family }> = ({ family }) => {
  const [slots, setSlots] = useState<Slot[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ slot_id: '', start_time: '', duration_hours: '24', start_price: '', end_price: '', display_duration_days: '2', content_rules: '' })

  const load = useCallback(() => {
    setLoading(true)
    Promise.all([
      API.get(`/api/v1/slots/${family}`),
      API.get(`/api/v1/slots/${family}/auctions`, { params: status ? { status } : {} }),
    ]).then(([s, a]) => { setSlots(s.data.slots || []); setAuctions(a.data.auctions || []) }).finally(() => setLoading(false))
  }, [family, status])

  useEffect(() => { load() }, [load])

  const minStart = (() => new Date(Date.now() + 24 * 3600_000).toISOString().slice(0, 16))()

  const handleCreate = async () => {
    if (!form.slot_id) { toast.error('Chọn slot'); return }
    if (!form.start_time) { toast.error('Chọn thời gian bắt đầu'); return }
    if (family === 'flash' && !form.end_price) { toast.error('Nhập endPrice'); return }
    setSaving(true)
    try {
      const r = await API.post(`/api/v1/slots/${family}/auctions`, {
        slot_id: Number(form.slot_id),
        start_time: form.start_time,
        duration_hours: Number(form.duration_hours) || 24,
        start_price: form.start_price ? Number(form.start_price) : undefined,
        end_price: family === 'flash' ? Number(form.end_price) : undefined,
        display_duration_days: Number(form.display_duration_days) || 2,
        content_rules: form.content_rules || undefined,
      })
      toast.success(`✅ Đã mở phiên — đã gửi thông báo tới ${r.data.notified_shops ?? 0} shop.`)
      setFormOpen(false)
      setForm({ slot_id: '', start_time: '', duration_hours: '24', start_price: '', end_price: '', display_duration_days: '2', content_rules: '' })
      load()
    } catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi khi mở phiên') } finally { setSaving(false) }
  }

  const handleEnd = async (a: Auction) => {
    if (!confirm(`Kết thúc sớm phiên #${a.auction_id}?`)) return
    try { await API.post(`/api/v1/slots/${family}/auctions/${a.auction_id}/end`); load() }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={() => setFormOpen(o => !o)} style={btn(C.navy)}>{formOpen ? '✕ Đóng' : '+ Mở phiên đấu giá'}</button>
        <select value={status} onChange={e => setStatus(e.target.value)} style={{ ...inputStyle, width: 160 }}>
          <option value="">Tất cả trạng thái</option>
          <option value="upcoming">Sắp mở</option>
          <option value="active">Đang diễn ra</option>
          <option value="ended">Đã kết thúc</option>
          <option value="live">Đã lên hệ thống</option>
          <option value="forfeited">Bị huỷ</option>
        </select>
      </div>

      {formOpen && (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ margin: 0, color: C.warning, fontSize: 12, fontWeight: 600 }}>⚠️ Thời gian bắt đầu phải cách hiện tại ít nhất 1 ngày. Mở phiên sẽ tự gửi thông báo cho toàn bộ shop.</p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <select value={form.slot_id} onChange={e => setForm({ ...form, slot_id: e.target.value })} style={{ ...inputStyle, flex: 1, minWidth: 180 }}>
              <option value="">— Chọn slot —</option>
              {slots.map(s => <option key={s.slot_id} value={s.slot_id}>{s.name}</option>)}
            </select>
            <input type="datetime-local" min={minStart} value={form.start_time} onChange={e => setForm({ ...form, start_time: e.target.value })} style={{ ...inputStyle, width: 200 }} />
            <input placeholder="Số giờ diễn ra" value={form.duration_hours} onChange={e => setForm({ ...form, duration_hours: e.target.value.replace(/[^\d]/g, '') })} style={{ ...inputStyle, width: 130 }} />
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <input placeholder="Giá khởi điểm (để trống = giá sàn slot)" value={form.start_price} onChange={e => setForm({ ...form, start_price: e.target.value.replace(/[^\d]/g, '') })} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
            {family === 'flash' && (
              <input placeholder="endPrice — giá mua đứt (*)" value={form.end_price} onChange={e => setForm({ ...form, end_price: e.target.value.replace(/[^\d]/g, '') })} style={{ ...inputStyle, flex: 1, minWidth: 180 }} />
            )}
            <input placeholder="Số ngày hiển thị sau khi live" value={form.display_duration_days} onChange={e => setForm({ ...form, display_duration_days: e.target.value.replace(/[^\d]/g, '') })} style={{ ...inputStyle, width: 200 }} />
          </div>
          <textarea placeholder="Quy định nội dung riêng cho phiên này (để trống = dùng quy định của slot)" value={form.content_rules} onChange={e => setForm({ ...form, content_rules: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'vertical' }} />
          <button onClick={handleCreate} disabled={saving} style={{ ...btn(C.success, saving), alignSelf: 'flex-start' }}>{saving ? '⏳...' : '🚀 Mở phiên + Gửi thông báo'}</button>
        </div>
      )}

      {loading ? <div style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Đang tải...</div> : auctions.length === 0 ? (
        <div style={{ color: C.gray, textAlign: 'center', padding: 30, background: C.card, borderRadius: 12, border: `1px solid ${C.border}` }}>Không có phiên nào.</div>
      ) : (
        <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ background: 'rgba(0,0,0,0.02)' }}>{['ID', 'Slot', 'Thời gian', 'Giá hiện tại', 'Trạng thái', 'Người thắng', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: C.gray, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
            <tbody>
              {auctions.map(a => (
                <tr key={a.auction_id} style={{ borderBottom: `1px solid ${C.border}` }}>
                  <td style={{ padding: '8px 14px', color: C.gray }}>#{a.auction_id}</td>
                  <td style={{ padding: '8px 14px', fontWeight: 600 }}>{a.slot_name}</td>
                  <td style={{ padding: '8px 14px', color: C.gray, fontSize: 12 }}>{fmtDate(a.start_time)} → {fmtDate(a.end_time)}</td>
                  <td style={{ padding: '8px 14px', color: C.purple, fontWeight: 700 }}>{fmt(a.current_price)}</td>
                  <td style={{ padding: '8px 14px' }}><span style={{ color: STATUS_COLOR[a.status] || C.gray, fontWeight: 700 }}>{a.status}</span></td>
                  <td style={{ padding: '8px 14px', color: C.gray }}>{a.winner_shop || '—'}</td>
                  <td style={{ padding: '8px 14px' }}>{(a.status === 'active' || a.status === 'upcoming') && <button onClick={() => handleEnd(a)} style={btn(C.error)}>Kết thúc sớm</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ── Tab: Duyệt nội dung ───────────────────────────────────────────────────────
const ReviewTab: React.FC = () => {
  const [pending, setPending] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    API.get('/api/v1/slots/pending-review').then(r => setPending(r.data.pending || [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleApprove = async (a: Auction) => {
    setBusy(a.auction_id)
    try { await API.post(`/api/v1/slots/${a.family}/auctions/${a.auction_id}/approve`); load() }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi') } finally { setBusy(null) }
  }
  const handleReject = async (a: Auction) => {
    const reason = prompt('Lý do từ chối:') || 'Không đạt yêu cầu'
    setBusy(a.auction_id)
    try { await API.post(`/api/v1/slots/${a.family}/auctions/${a.auction_id}/reject`, { reason }); load() }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi') } finally { setBusy(null) }
  }

  if (loading) return <div style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Đang tải...</div>
  if (pending.length === 0) return <div style={{ color: C.gray, textAlign: 'center', padding: 30, background: C.card, borderRadius: 12, border: `1px solid ${C.border}` }}>Không có nội dung nào đang chờ duyệt.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pending.map(a => (
        <div key={`${a.family}-${a.auction_id}`} style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {a.submission_image_url && <img src={a.submission_image_url} alt="" style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, flexShrink: 0 }} />}
          <div style={{ flex: 1 }}>
            <p style={{ margin: '0 0 4px', fontWeight: 700, fontSize: 13 }}>{FAMILY_LABEL[a.family || 'flash']} — {a.slot_name} (phiên #{a.auction_id})</p>
            <p style={{ margin: '0 0 4px', color: C.gray, fontSize: 12 }}>Người thắng: {a.winner_shop || '—'} · Tiêu đề: {a.submission_title || '—'}</p>
            <p style={{ margin: 0, color: C.warning, fontSize: 11 }}>
              {a.win_type === 'buyout'
                ? `Mua đứt — đã nộp ${a.submission_attempts ?? 0}/3 lần, hạn 6h tính từ lúc thanh toán. Từ chối lần thứ 3 sẽ huỷ vị trí luôn.`
                : 'Hạn phản hồi trong 6 giờ kể từ lúc nộp.'}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button onClick={() => handleApprove(a)} disabled={busy === a.auction_id} style={btn(C.success, busy === a.auction_id)}>✅ Duyệt</button>
            <button onClick={() => handleReject(a)} disabled={busy === a.auction_id} style={btn(C.error, busy === a.auction_id)}>❌ Từ chối</button>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Tab: Vi phạm ──────────────────────────────────────────────────────────────
const ViolationsTab: React.FC = () => {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    API.get('/api/v1/slots/violations').then(r => setViolations(r.data.violations || [])).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const handleUnban = async (v: Violation) => {
    if (!confirm(`Gỡ khoá đấu giá cho ${v.shop_name || `shop #${v.shop_id}`}?`)) return
    setBusy(v.shop_id)
    try { await API.post(`/api/v1/slots/violations/${v.shop_id}/unban`); load() }
    catch (e: any) { toast.error(e.response?.data?.detail || 'Lỗi') } finally { setBusy(null) }
  }

  if (loading) return <div style={{ color: C.gray, textAlign: 'center', padding: 30 }}>Đang tải...</div>
  if (violations.length === 0) return <div style={{ color: C.gray, textAlign: 'center', padding: 30, background: C.card, borderRadius: 12, border: `1px solid ${C.border}` }}>Chưa có vi phạm nào.</div>

  return (
    <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ background: 'rgba(0,0,0,0.02)' }}>{['Shop', 'Số lần vi phạm', 'Trạng thái', 'Cập nhật', ''].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: C.gray, fontSize: 11, borderBottom: `1px solid ${C.border}` }}>{h}</th>)}</tr></thead>
        <tbody>
          {violations.map(v => (
            <tr key={v.shop_id} style={{ borderBottom: `1px solid ${C.border}` }}>
              <td style={{ padding: '8px 14px', fontWeight: 600 }}>{v.shop_name || `Shop #${v.shop_id}`}</td>
              <td style={{ padding: '8px 14px', color: v.violation_count >= 3 ? C.error : C.warning, fontWeight: 700 }}>{v.violation_count}/3</td>
              <td style={{ padding: '8px 14px' }}>{v.banned ? <span style={{ color: C.error, fontWeight: 700 }}>🔒 Đã khoá đấu giá</span> : <span style={{ color: C.success }}>Bình thường</span>}</td>
              <td style={{ padding: '8px 14px', color: C.gray, fontSize: 12 }}>{fmtDate(v.updated_at)}</td>
              <td style={{ padding: '8px 14px' }}>{v.banned && <button onClick={() => handleUnban(v)} disabled={busy === v.shop_id} style={btn(C.blue, busy === v.shop_id)}>Gỡ khoá</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default SlotAuctionAdminPage
