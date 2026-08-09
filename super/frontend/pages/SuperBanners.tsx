/**
 * super/frontend/pages/SuperBanners.tsx
 * ----------------------------------------
 * Superadmin — duyệt banner shop nộp sau khi thắng đấu giá.
 *
 * Tab "Đang hoạt động" gọi ĐÚNG endpoint /banners/live mà trang chủ
 * (Home.tsx) cũng gọi — nên những gì hiện ở đây LUÔN khớp 100% với
 * những gì khách hàng đang thấy trên trang chủ thật (không phải bản mock).
 */
import React, { useEffect, useState, useCallback } from 'react'
import superApi from '../superApi'
import { getImageUrl } from '@/utils/helpers'

const S = {
  bg:      '#0a0a0f',
  card:    '#13131a',
  border:  '#1e1e2e',
  red:     '#dc2626',
  redDark: '#7f1d1d',
  green:   '#16a34a',
  orange:  '#d97706',
  text:    '#f1f5f9',
  muted:   '#475569',
  input:   '#1e1e2e',
}

interface BannerAuction {
  auction_id: number
  slot_id: number
  slot_name: string | null
  slot_position: string | null
  status: string
  current_price: number
  winner_shop: string | null
  banner_image_url: string | null
  banner_title: string | null
  banner_link: string | null
  banner_status: 'pending' | 'approved' | 'rejected' | null
  banner_reject_reason: string | null
}

interface LiveBanner {
  position: string
  slot_id: number
  slot_name: string | null
  auction_id: number
  image_url: string
  title: string | null
  link: string | null
  shop_name: string | null
  reviewed_at: string | null
}

const POSITION_LABEL: Record<string, string> = {
  home_slider:    'Banner đầu Trang chủ',
  mall_ads_main:  'Quảng cáo BuyZo Mall (7 phần)',
  mall_ads_fixed: 'Quảng cáo BuyZo Mall (3 phần)',
  mall_banner:    'Banner Mall (Hình 4)',
}

type Tab = 'pending' | 'live' | 'history'

const SuperBanners: React.FC = () => {
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<BannerAuction[]>([])
  const [live, setLive]       = useState<LiveBanner[]>([])
  const [history, setHistory] = useState<BannerAuction[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectTarget, setRejectTarget] = useState<BannerAuction | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [busy, setBusy] = useState<number | null>(null)

  const load = useCallback((t: Tab) => {
    setLoading(true)
    const req = t === 'pending' ? superApi.get('/banners/pending')
              : t === 'live'    ? superApi.get('/banners/live')
              :                   superApi.get('/banners/history')
    req.then(r => {
      if (t === 'pending') setPending(r.data.banners || [])
      else if (t === 'live') setLive(r.data.banners || [])
      else setHistory(r.data.banners || [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(tab) }, [tab, load])

  const handleApprove = async (a: BannerAuction) => {
    setBusy(a.auction_id)
    try {
      await superApi.post(`/banners/${a.auction_id}/approve`)
      setPending(ps => ps.filter(p => p.auction_id !== a.auction_id))
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi duyệt')
    } finally { setBusy(null) }
  }

  const handleReject = async () => {
    if (!rejectTarget) return
    setBusy(rejectTarget.auction_id)
    try {
      await superApi.post(`/banners/${rejectTarget.auction_id}/reject`, { reason: rejectReason || undefined })
      setPending(ps => ps.filter(p => p.auction_id !== rejectTarget.auction_id))
      setRejectTarget(null)
      setRejectReason('')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi từ chối')
    } finally { setBusy(null) }
  }

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'pending', label: '⏳ Chờ duyệt', count: pending.length },
    { key: 'live',    label: '✅ Đang hoạt động trên site', count: live.length },
    { key: 'history', label: '📋 Lịch sử' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ color: S.text, fontSize: 20, fontWeight: 800, margin: 0 }}>🖼️ Banner đấu giá</h1>
        <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>
          Duyệt banner shop nộp sau khi thắng đấu giá — tab "Đang hoạt động" lấy đúng dữ liệu Home.tsx đang hiển thị.
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
              background: tab === t.key ? S.red : S.card,
              color: tab === t.key ? '#fff' : S.muted,
            }}>
            {t.label}{t.count !== undefined ? ` (${t.count})` : ''}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: S.muted, textAlign: 'center', padding: 40 }}>Đang tải...</div>
      ) : tab === 'pending' ? (
        pending.length === 0 ? (
          <div style={{ color: S.muted, textAlign: 'center', padding: 40, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>
            Không có banner nào đang chờ duyệt.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {pending.map(a => (
              <div key={a.auction_id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ height: 140, background: '#0a0a0f' }}>
                  {a.banner_image_url && (
                    <img src={getImageUrl(a.banner_image_url)} alt={a.banner_title || ''}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <p style={{ color: S.text, fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>
                    {a.banner_title || '(không có tiêu đề)'}
                  </p>
                  <p style={{ color: S.muted, fontSize: 11, margin: '0 0 4px' }}>
                    {POSITION_LABEL[a.slot_position || ''] || a.slot_position} · {a.slot_name}
                  </p>
                  <p style={{ color: S.muted, fontSize: 11, margin: '0 0 10px' }}>
                    Shop: {a.winner_shop} · Giá thắng: {Number(a.current_price).toLocaleString('vi-VN')}đ
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => handleApprove(a)} disabled={busy === a.auction_id}
                      style={{ flex: 1, padding: '7px', background: S.green, color: '#fff', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      ✅ Duyệt
                    </button>
                    <button onClick={() => { setRejectTarget(a); setRejectReason('') }} disabled={busy === a.auction_id}
                      style={{ padding: '7px 12px', background: '#2d1010', color: '#ef4444', border: `1px solid ${S.redDark}`, borderRadius: 6, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'live' ? (
        live.length === 0 ? (
          <div style={{ color: S.muted, textAlign: 'center', padding: 40, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>
            Chưa có banner nào đang hiển thị trên trang chủ.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {live.map(b => (
              <div key={b.auction_id} style={{ background: S.card, border: `1px solid ${S.green}55`, borderRadius: 12, overflow: 'hidden' }}>
                <div style={{ height: 140, background: '#0a0a0f', position: 'relative' }}>
                  <img src={getImageUrl(b.image_url)} alt={b.title || ''}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <span style={{ position: 'absolute', top: 8, left: 8, background: S.green, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20 }}>
                    ✅ ĐANG HIỂN THỊ TRÊN TRANG CHỦ
                  </span>
                </div>
                <div style={{ padding: '12px 14px' }}>
                  <p style={{ color: S.text, fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>{b.title || '(không có tiêu đề)'}</p>
                  <p style={{ color: S.muted, fontSize: 11, margin: '0 0 4px' }}>
                    {POSITION_LABEL[b.position] || b.position} · {b.slot_name}
                  </p>
                  <p style={{ color: S.muted, fontSize: 11, margin: 0 }}>
                    Shop: {b.shop_name} · Duyệt lúc: {b.reviewed_at ? new Date(b.reviewed_at).toLocaleString('vi-VN') : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        history.length === 0 ? (
          <div style={{ color: S.muted, textAlign: 'center', padding: 40, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>
            Chưa có lịch sử banner nào.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(a => (
              <div key={a.auction_id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 10, padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                <div>
                  <p style={{ color: S.text, fontWeight: 600, fontSize: 13, margin: '0 0 2px' }}>
                    {a.banner_title || '(không có tiêu đề)'} — {POSITION_LABEL[a.slot_position || ''] || a.slot_position}
                  </p>
                  <p style={{ color: S.muted, fontSize: 11, margin: 0 }}>
                    Shop: {a.winner_shop}{a.banner_status === 'rejected' && a.banner_reject_reason ? ` · Lý do từ chối: ${a.banner_reject_reason}` : ''}
                  </p>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, flexShrink: 0,
                  background: a.banner_status === 'approved' ? '#052e16' : a.banner_status === 'rejected' ? '#2d1010' : '#1e1e2e',
                  color: a.banner_status === 'approved' ? S.green : a.banner_status === 'rejected' ? '#ef4444' : S.orange,
                }}>
                  {a.banner_status === 'approved' ? '✅ Đã duyệt' : a.banner_status === 'rejected' ? '❌ Từ chối' : '⏳ Chờ duyệt'}
                </span>
              </div>
            ))}
          </div>
        )
      )}

      {/* Reject modal */}
      {rejectTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setRejectTarget(null)}>
          <div style={{ width: 380, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>Từ chối banner</h2>
            <p style={{ color: S.muted, fontSize: 12, margin: 0 }}>{rejectTarget.banner_title || `Auction #${rejectTarget.auction_id}`}</p>
            <textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder="Lý do từ chối (tùy chọn)"
              rows={3} style={{ padding: '9px 12px', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none', resize: 'vertical' }} />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setRejectTarget(null)} style={{ padding: '8px 16px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleReject} disabled={busy === rejectTarget.auction_id}
                style={{ padding: '8px 18px', background: S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
                Từ chối
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperBanners
