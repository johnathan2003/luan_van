/**
 * super/frontend/pages/SuperSlotAuctions.tsx
 * ----------------------------------------------
 * Superadmin — CHỈ XEM đấu giá vị trí Flash Sale (flash) + Top sản phẩm (top).
 * Không có nút tạo/sửa/duyệt/gỡ khoá nào ở đây — admin (hệ thống chính,
 * /admin/slot-auctions) mới là người vận hành toàn bộ. Super đứng ngoài,
 * chỉ quan sát để nắm tình hình.
 *
 * GET /api/super/slots/... (chỉ GET — xem super/backend/routes/slot_auctions.py)
 */
import React, { useCallback, useEffect, useState } from 'react'
import superApi from '../superApi'

const S = {
  bg: '#0a0a0f', card: '#13131a', border: '#1e1e2e',
  red: '#dc2626', green: '#16a34a', orange: '#d97706', blue: '#2563eb',
  text: '#f1f5f9', muted: '#475569',
}

type Family = 'flash' | 'top'
const FAMILY_LABEL: Record<Family, string> = { flash: '⚡ Flash Sale', top: '🚀 Top sản phẩm' }

interface Slot {
  slot_id: number; name: string; base_price: number; is_active: boolean
  image_width: number | null; image_height: number | null
}
interface Auction {
  auction_id: number; slot_id: number; slot_name: string | null
  start_time: string; end_time: string; status: string
  current_price: number; end_price: number | null
  winner_shop: string | null; submission_status: string | null
  submission_image_url: string | null; family?: Family
}
interface Violation { shop_id: number; shop_name: string | null; violation_count: number; banned: boolean; updated_at: string | null }

const fmt = (n: number) => Number(n || 0).toLocaleString('vi-VN') + 'đ'
const fmtDate = (s: string | null) => s ? new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'
const STATUS_COLOR: Record<string, string> = { upcoming: S.orange, active: S.green, ended: S.muted, live: S.blue, forfeited: S.red }

const SuperSlotAuctions: React.FC = () => {
  const [family, setFamily] = useState<Family>('flash')
  const [tab, setTab] = useState<'slots' | 'auctions' | 'review' | 'violations'>('auctions')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ color: S.text, fontSize: 20, fontWeight: 800, margin: 0 }}>🏆 Đấu giá vị trí (chỉ xem)</h1>
        <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>
          Super chỉ quan sát — mọi thao tác (tạo slot, mở phiên, duyệt nội dung, gỡ khoá vi phạm) do admin thực hiện ở /admin/slot-auctions.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {(['flash', 'top'] as Family[]).map(f => (
          <button key={f} onClick={() => setFamily(f)}
            style={{ padding: '7px 16px', borderRadius: 8, border: `1px solid ${family === f ? S.red : S.border}`, background: family === f ? S.red : 'transparent', color: family === f ? '#fff' : S.muted, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
            {FAMILY_LABEL[f]}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, borderBottom: `1px solid ${S.border}` }}>
        {[
          { k: 'auctions', l: '📅 Phiên đấu giá' },
          { k: 'slots', l: '⚙️ Slot' },
          { k: 'review', l: '👁️ Nội dung chờ duyệt' },
          { k: 'violations', l: '⚠️ Vi phạm' },
        ].map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)}
            style={{ padding: '9px 16px', background: 'none', border: 'none', borderBottom: tab === t.k ? `2px solid ${S.red}` : '2px solid transparent', color: tab === t.k ? S.text : S.muted, fontWeight: tab === t.k ? 700 : 500, fontSize: 13, cursor: 'pointer' }}>
            {t.l}
          </button>
        ))}
      </div>

      {tab === 'slots' && <SlotsView family={family} />}
      {tab === 'auctions' && <AuctionsView family={family} />}
      {tab === 'review' && <ReviewView />}
      {tab === 'violations' && <ViolationsView />}
    </div>
  )
}

const SlotsView: React.FC<{ family: Family }> = ({ family }) => {
  const [slots, setSlots] = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    superApi.get(`/slots/${family}`).then((r: any) => setSlots(r.data.slots || [])).finally(() => setLoading(false))
  }, [family])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ color: S.muted, textAlign: 'center', padding: 30 }}>Đang tải...</div>
  if (slots.length === 0) return <div style={{ color: S.muted, textAlign: 'center', padding: 30, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>Chưa có slot nào.</div>

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ background: S.bg }}>{['ID', 'Tên', 'Giá sàn', 'Kích thước', 'Trạng thái'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: S.muted, fontSize: 11, borderBottom: `1px solid ${S.border}` }}>{h}</th>)}</tr></thead>
        <tbody>
          {slots.map(s => (
            <tr key={s.slot_id} style={{ borderBottom: `1px solid ${S.border}` }}>
              <td style={{ padding: '8px 14px', color: S.muted }}>#{s.slot_id}</td>
              <td style={{ padding: '8px 14px', color: S.text, fontWeight: 600 }}>{s.name}</td>
              <td style={{ padding: '8px 14px', color: S.red }}>{fmt(s.base_price)}</td>
              <td style={{ padding: '8px 14px', color: S.muted }}>{s.image_width && s.image_height ? `${s.image_width}×${s.image_height}` : '—'}</td>
              <td style={{ padding: '8px 14px' }}><span style={{ color: s.is_active ? S.green : S.muted, fontWeight: 700 }}>{s.is_active ? '🟢 Hoạt động' : '⚪ Tắt'}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const AuctionsView: React.FC<{ family: Family }> = ({ family }) => {
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    setLoading(true)
    superApi.get(`/slots/${family}/auctions`).then((r: any) => setAuctions(r.data.auctions || [])).finally(() => setLoading(false))
  }, [family])

  useEffect(() => { load() }, [load])

  if (loading) return <div style={{ color: S.muted, textAlign: 'center', padding: 30 }}>Đang tải...</div>
  if (auctions.length === 0) return <div style={{ color: S.muted, textAlign: 'center', padding: 30, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>Không có phiên nào.</div>

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ background: S.bg }}>{['ID', 'Slot', 'Thời gian', 'Giá hiện tại', 'Trạng thái', 'Người thắng'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: S.muted, fontSize: 11, borderBottom: `1px solid ${S.border}` }}>{h}</th>)}</tr></thead>
        <tbody>
          {auctions.map(a => (
            <tr key={a.auction_id} style={{ borderBottom: `1px solid ${S.border}` }}>
              <td style={{ padding: '8px 14px', color: S.muted }}>#{a.auction_id}</td>
              <td style={{ padding: '8px 14px', color: S.text, fontWeight: 600 }}>{a.slot_name}</td>
              <td style={{ padding: '8px 14px', color: S.muted, fontSize: 12 }}>{fmtDate(a.start_time)} → {fmtDate(a.end_time)}</td>
              <td style={{ padding: '8px 14px', color: S.red, fontWeight: 700 }}>{fmt(a.current_price)}</td>
              <td style={{ padding: '8px 14px' }}><span style={{ color: STATUS_COLOR[a.status] || S.muted, fontWeight: 700 }}>{a.status}</span></td>
              <td style={{ padding: '8px 14px', color: S.muted }}>{a.winner_shop || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const ReviewView: React.FC = () => {
  const [pending, setPending] = useState<Auction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    superApi.get('/slots/pending-review').then((r: any) => setPending(r.data.pending || [])).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: S.muted, textAlign: 'center', padding: 30 }}>Đang tải...</div>
  if (pending.length === 0) return <div style={{ color: S.muted, textAlign: 'center', padding: 30, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>Không có nội dung nào đang chờ duyệt.</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pending.map(a => (
        <div key={`${a.family}-${a.auction_id}`} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, padding: 16, display: 'flex', gap: 16, alignItems: 'flex-start' }}>
          {a.submission_image_url && <img src={a.submission_image_url} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, flexShrink: 0, background: S.bg }} />}
          <div>
            <p style={{ margin: '0 0 4px', color: S.text, fontWeight: 700, fontSize: 13 }}>{FAMILY_LABEL[a.family || 'flash']} — {a.slot_name} (phiên #{a.auction_id})</p>
            <p style={{ margin: 0, color: S.muted, fontSize: 12 }}>Người thắng: {a.winner_shop || '—'} — đang chờ admin duyệt.</p>
          </div>
        </div>
      ))}
    </div>
  )
}

const ViolationsView: React.FC = () => {
  const [violations, setViolations] = useState<Violation[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    superApi.get('/slots/violations').then((r: any) => setViolations(r.data.violations || [])).finally(() => setLoading(false))
  }, [])

  if (loading) return <div style={{ color: S.muted, textAlign: 'center', padding: 30 }}>Đang tải...</div>
  if (violations.length === 0) return <div style={{ color: S.muted, textAlign: 'center', padding: 30, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>Chưa có vi phạm nào.</div>

  return (
    <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr style={{ background: S.bg }}>{['Shop', 'Số lần vi phạm', 'Trạng thái', 'Cập nhật'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: S.muted, fontSize: 11, borderBottom: `1px solid ${S.border}` }}>{h}</th>)}</tr></thead>
        <tbody>
          {violations.map(v => (
            <tr key={v.shop_id} style={{ borderBottom: `1px solid ${S.border}` }}>
              <td style={{ padding: '8px 14px', color: S.text, fontWeight: 600 }}>{v.shop_name || `Shop #${v.shop_id}`}</td>
              <td style={{ padding: '8px 14px', color: v.violation_count >= 3 ? S.red : S.orange, fontWeight: 700 }}>{v.violation_count}/3</td>
              <td style={{ padding: '8px 14px' }}>{v.banned ? <span style={{ color: S.red, fontWeight: 700 }}>🔒 Đã khoá đấu giá</span> : <span style={{ color: S.green }}>Bình thường</span>}</td>
              <td style={{ padding: '8px 14px', color: S.muted, fontSize: 12 }}>{fmtDate(v.updated_at)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default SuperSlotAuctions
