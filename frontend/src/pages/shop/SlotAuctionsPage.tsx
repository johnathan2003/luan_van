/**
 * SlotAuctionsPage.tsx — Danh sách phiên đấu giá Flash Sale / Top sản phẩm
 * ---------------------------------------------------------------------------
 * GET /api/v1/slots/{family}/auctions?status=
 * GET /api/v1/slots/my-wins
 *
 * Trang hub — giống tinh thần /shop/auction (banner). Click 1 phiên → vào
 * trang chi tiết /shop/slot-auctions/{family}/{auction_id} (cũng là nơi
 * link trong thông báo mở phiên trỏ tới).
 */
import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import API from '../../services/api'

interface Auction {
  auction_id: number
  slot_id: number
  slot_name: string | null
  slot_preview_image_url: string | null
  start_time: string
  end_time: string
  status: string
  start_price: number
  current_price: number
  end_price: number | null
  winner_shop_id: number | null
  winner_shop: string | null
  win_type: string | null
  submission_status: string | null
  activates_at: string | null
}
interface Win {
  family: 'flash' | 'top'
  auction_id: number
  slot_name: string | null
  status: string
  win_type: string | null
  final_paid_at: string | null
  payment_deadline: string | null
  submission_status: string | null
}

const C = {
  purple: '#7C3AED', purpleBg: 'rgba(124,58,237,0.08)',
  green: '#16A34A', greenBg: 'rgba(22,163,74,0.08)',
  orange: '#EA580C', orangeBg: 'rgba(234,88,12,0.08)',
  red: '#DC2626', redBg: '#FEE2E2',
  blue: '#2563EB',
  gray: 'var(--text-secondary)', border: 'var(--border-subtle)', card: 'var(--bg-card)',
}

function fmt(n: number) { return Number(n || 0).toLocaleString('vi-VN') + 'đ' }
function fmtDate(s: string) {
  return new Date(s).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  upcoming:  { label: 'Sắp mở',        color: C.orange, bg: C.orangeBg },
  active:    { label: 'Đang diễn ra',  color: C.green,  bg: C.greenBg },
  ended:     { label: 'Đã kết thúc',   color: C.gray,   bg: 'rgba(0,0,0,0.04)' },
  live:      { label: 'Đã lên hệ thống', color: C.blue, bg: 'rgba(37,99,235,0.08)' },
  forfeited: { label: 'Bị huỷ (quá hạn)', color: C.red, bg: C.redBg },
}

const FAMILY_LABEL: Record<string, string> = { flash: '⚡ Flash Sale', top: '🚀 Top sản phẩm' }

const SlotAuctionsPage: React.FC = () => {
  const navigate = useNavigate()
  const [family, setFamily] = useState<'flash' | 'top'>('flash')
  const [status, setStatus] = useState<'active' | 'upcoming' | 'ended' | 'all'>('active')
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [wins, setWins] = useState<Win[]>([])
  const [loading, setLoading] = useState(true)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const loadAuctions = useCallback(async () => {
    try {
      const r = await API.get(`/api/v1/slots/${family}/auctions`, { params: status === 'all' ? {} : { status } })
      setAuctions(r.data.auctions)
    } catch { /* ignore */ }
  }, [family, status])

  const loadWins = useCallback(async () => {
    try {
      const r = await API.get('/api/v1/slots/my-wins')
      setWins(r.data.wins)
    } catch { /* not a shop owner */ }
  }, [])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadAuctions(), loadWins()]).finally(() => setLoading(false))
  }, [loadAuctions, loadWins])

  const needsAction = wins.filter(w =>
    (w.win_type === 'bid' && !w.final_paid_at && w.status === 'ended') ||
    (w.final_paid_at && (!w.submission_status || w.submission_status === 'rejected'))
  )

  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '7px 16px', borderRadius: 8, border: `1px solid ${active ? C.purple : C.border}`,
    background: active ? C.purple : 'transparent', color: active ? 'white' : C.gray,
    cursor: 'pointer', fontWeight: 600, fontSize: 13,
  })

  return (
    <div style={{ maxWidth: 900 }}>
      <h2 style={{ margin: '0 0 4px' }}>🏆 Đấu giá vị trí Flash Sale / Top sản phẩm</h2>
      <p style={{ color: C.gray, fontSize: 13, marginBottom: 16 }}>
        Thắng phiên để sản phẩm của bạn lên khu Flash Sale trang chủ hoặc được ưu tiên hiển thị khi khách tìm kiếm/duyệt danh mục.
        {' '}<Link to="/shop/auction-rules" style={{ color: C.purple, fontWeight: 600 }}>Xem quy định đấu giá →</Link>
      </p>

      {needsAction.length > 0 && (
        <div style={{ background: C.orangeBg, border: `1px solid ${C.orange}44`, borderRadius: 12, padding: '14px 18px', marginBottom: 18 }}>
          <p style={{ margin: '0 0 8px', fontWeight: 700, color: C.orange, fontSize: 13 }}>⚠️ Có {needsAction.length} phiên cần bạn xử lý</p>
          {needsAction.map(w => (
            <div key={`${w.family}-${w.auction_id}`}
              onClick={() => navigate(`/shop/slot-auctions/${w.family}/${w.auction_id}`)}
              style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'white', borderRadius: 8, cursor: 'pointer', marginBottom: 6, fontSize: 13 }}>
              <span>{FAMILY_LABEL[w.family]} — {w.slot_name || `#${w.auction_id}`}</span>
              <span style={{ color: C.orange, fontWeight: 700 }}>
                {!w.final_paid_at ? 'Cần thanh toán nốt →' : w.submission_status === 'rejected' ? 'Nội dung bị từ chối →' : 'Cần nộp nội dung →'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <button style={btnStyle(family === 'flash')} onClick={() => setFamily('flash')}>⚡ Flash Sale</button>
        <button style={btnStyle(family === 'top')} onClick={() => setFamily('top')}>🚀 Top sản phẩm</button>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        <button style={btnStyle(status === 'active')} onClick={() => setStatus('active')}>🟢 Đang mở</button>
        <button style={btnStyle(status === 'upcoming')} onClick={() => setStatus('upcoming')}>⏳ Sắp mở</button>
        <button style={btnStyle(status === 'ended')} onClick={() => setStatus('ended')}>🏁 Đã kết thúc</button>
        <button style={btnStyle(status === 'all')} onClick={() => setStatus('all')}>📋 Tất cả</button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: C.gray }}>Đang tải...</div>
      ) : auctions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, background: C.card, border: `1px solid ${C.border}`, borderRadius: 14 }}>
          <div style={{ fontSize: 32, marginBottom: 10 }}>🎯</div>
          <p style={{ color: C.gray }}>Không có phiên nào ở trạng thái này.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {auctions.map(a => {
            const st = STATUS_LABEL[a.status] || STATUS_LABEL.ended
            return (
              <div key={a.auction_id}
                onClick={() => navigate(`/shop/slot-auctions/${family}/${a.auction_id}`)}
                style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{a.slot_name || `Slot #${a.slot_id}`}</span>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 999, padding: '2px 9px', fontSize: 11, fontWeight: 700 }}>{st.label}</span>
                    {a.slot_preview_image_url && (
                      <button onClick={e => { e.stopPropagation(); setPreviewUrl(a.slot_preview_image_url) }}
                        style={{ background: 'none', border: `1px solid ${C.border}`, borderRadius: 999, padding: '1px 8px', fontSize: 11, color: C.blue, cursor: 'pointer' }}>
                        🖼️ Xem vị trí
                      </button>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: C.gray }}>
                    {fmtDate(a.start_time)} → {fmtDate(a.end_time)} · Giá hiện tại: <b style={{ color: C.purple }}>{fmt(a.current_price)}</b>
                    {a.end_price != null && <> · endPrice: {fmt(a.end_price)}</>}
                    {a.winner_shop && <> · Đang dẫn: <b>{a.winner_shop}</b></>}
                  </div>
                </div>
                <span style={{ color: C.gray, fontSize: 18 }}>→</span>
              </div>
            )
          })}
        </div>
      )}

      {previewUrl && (
        <div onClick={() => setPreviewUrl(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, cursor: 'zoom-out' }}>
          <img src={previewUrl} alt="Hướng dẫn vị trí" style={{ maxWidth: '90%', maxHeight: '90%', borderRadius: 8, objectFit: 'contain' }} />
        </div>
      )}
    </div>
  )
}

export default SlotAuctionsPage
