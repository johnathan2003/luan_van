/**
 * super/frontend/pages/SuperBanners.tsx
 * ----------------------------------------
 * Superadmin — CHỈ XEM banner shop nộp sau khi thắng đấu giá (tab "Chờ
 * duyệt" giờ chỉ để quan sát). Duyệt/từ chối nội dung ĐÃ CHUYỂN SANG ADMIN
 * (/admin/banner-auction — POST /api/v1/banners/auctions/{id}/approve|
 * reject), đồng bộ với cách slot_auctions hoạt động.
 *
 * Ngoại lệ: tab "Quản lý (CRUD)" vẫn thuộc quyền super — đây là năng lực
 * quản lý bảng banners chính thức, tách biệt khỏi luồng đấu giá.
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

interface ManagedBanner {
  banner_id: number
  slot_id: number
  slot_name: string | null
  position: string
  image_url: string
  title: string | null
  link: string | null
  shop_id: number | null
  shop_name: string | null
  source_auction_id: number | null
  status: 'active' | 'inactive'
  created_at: string | null
  updated_at: string | null
}

interface Slot { slot_id: number; name: string; position: string }

const POSITION_LABEL: Record<string, string> = {
  home_slider:    'Banner đầu Trang chủ',
  mall_ads_main:  'Quảng cáo BuyZo Mall (7 phần)',
  mall_ads_fixed: 'Quảng cáo BuyZo Mall (3 phần)',
  mall_banner:    'Banner Mall (Hình 4)',
}

type Tab = 'pending' | 'live' | 'manage' | 'history'

const EMPTY_MANAGE_FORM = { slot_id: '', image_url: '', title: '', link: '', shop_name: '', status: 'active' }

const SuperBanners: React.FC = () => {
  const [tab, setTab] = useState<Tab>('pending')
  const [pending, setPending] = useState<BannerAuction[]>([])
  const [live, setLive]       = useState<LiveBanner[]>([])
  const [history, setHistory] = useState<BannerAuction[]>([])
  const [managed, setManaged] = useState<ManagedBanner[]>([])
  const [slots, setSlots]     = useState<Slot[]>([])
  const [loading, setLoading] = useState(true)

  // Quản lý (full CRUD) modal
  const [manageModal, setManageModal] = useState(false)
  const [editingBanner, setEditingBanner] = useState<ManagedBanner | null>(null)
  const [manageForm, setManageForm] = useState<any>(EMPTY_MANAGE_FORM)
  const [manageSaving, setManageSaving] = useState(false)

  const load = useCallback((t: Tab) => {
    setLoading(true)
    const req = t === 'pending' ? superApi.get('/banners/pending')
              : t === 'live'    ? superApi.get('/banners/live')
              : t === 'manage'  ? superApi.get('/banners/manage')
              :                   superApi.get('/banners/history')
    req.then(r => {
      if (t === 'pending') setPending(r.data.banners || [])
      else if (t === 'live') setLive(r.data.banners || [])
      else if (t === 'manage') setManaged(r.data.banners || [])
      else setHistory(r.data.banners || [])
    }).finally(() => setLoading(false))
  }, [])

  useEffect(() => { load(tab) }, [tab, load])
  useEffect(() => { superApi.get('/banners/manage/slots').then(r => setSlots(r.data.slots || [])).catch(() => {}) }, [])

  const TABS: { key: Tab; label: string; count?: number }[] = [
    { key: 'pending', label: '⏳ Chờ duyệt (xem)', count: pending.length },
    { key: 'live',    label: '✅ Đang hoạt động trên site', count: live.length },
    { key: 'manage',  label: '🛠️ Quản lý (CRUD)', count: managed.length },
    { key: 'history', label: '📋 Lịch sử' },
  ]

  // ── Quản lý (full CRUD) ──────────────────────────────────────────────────
  const openCreateBanner = () => {
    setEditingBanner(null)
    setManageForm(EMPTY_MANAGE_FORM)
    setManageModal(true)
  }
  const openEditBanner = (b: ManagedBanner) => {
    setEditingBanner(b)
    setManageForm({
      slot_id: String(b.slot_id), image_url: b.image_url, title: b.title || '',
      link: b.link || '', shop_name: b.shop_name || '', status: b.status,
    })
    setManageModal(true)
  }
  const handleSaveBanner = async () => {
    setManageSaving(true)
    try {
      const payload: any = {
        slot_id: Number(manageForm.slot_id), image_url: manageForm.image_url,
        title: manageForm.title || null, link: manageForm.link || null,
        shop_name: manageForm.shop_name || null, status: manageForm.status,
      }
      if (editingBanner) await superApi.patch(`/banners/manage/${editingBanner.banner_id}`, payload)
      else await superApi.post('/banners/manage', payload)
      setManageModal(false)
      load('manage')
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi lưu')
    } finally { setManageSaving(false) }
  }
  const handleToggleStatus = async (b: ManagedBanner) => {
    try {
      await superApi.patch(`/banners/manage/${b.banner_id}`, { status: b.status === 'active' ? 'inactive' : 'active' })
      setManaged(ms => ms.map(x => x.banner_id === b.banner_id ? { ...x, status: x.status === 'active' ? 'inactive' : 'active' } : x))
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi')
    }
  }
  const handleDeleteBanner = async (b: ManagedBanner) => {
    if (!confirm(`Xoá banner "${b.title || b.image_url}"? Không thể phục hồi.`)) return
    try {
      await superApi.delete(`/banners/manage/${b.banner_id}`)
      setManaged(ms => ms.filter(x => x.banner_id !== b.banner_id))
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi xoá')
    }
  }

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
                  <p style={{ color: S.muted, fontSize: 11, margin: 0 }}>
                    Shop: {a.winner_shop} · Giá thắng: {Number(a.current_price).toLocaleString('vi-VN')}đ
                  </p>
                  <p style={{ color: S.orange, fontSize: 10, margin: '8px 0 0' }}>Duyệt/từ chối do admin thực hiện ở /admin/banner-auction.</p>
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
      ) : tab === 'manage' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <button onClick={openCreateBanner} style={{ padding: '9px 18px', background: S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
              + Thêm banner thủ công
            </button>
          </div>
          {managed.length === 0 ? (
            <div style={{ color: S.muted, textAlign: 'center', padding: 40, background: S.card, borderRadius: 12, border: `1px solid ${S.border}` }}>
              Chưa có banner nào trong bảng chính thức.
            </div>
          ) : (
            <div style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: '#0a0a0f' }}>
                    {['Ảnh', 'Tiêu đề', 'Vị trí', 'Shop', 'Trạng thái', 'Nguồn', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: S.muted, fontSize: 11, fontWeight: 700, borderBottom: `1px solid ${S.border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {managed.map(b => (
                    <tr key={b.banner_id} style={{ borderBottom: `1px solid ${S.border}` }}>
                      <td style={{ padding: '8px 14px' }}>
                        <img src={getImageUrl(b.image_url)} alt="" style={{ width: 60, height: 34, objectFit: 'cover', borderRadius: 4, background: '#0a0a0f' }} />
                      </td>
                      <td style={{ padding: '8px 14px', color: S.text, fontWeight: 600 }}>{b.title || '(không có tiêu đề)'}</td>
                      <td style={{ padding: '8px 14px', color: S.muted }}>{POSITION_LABEL[b.position] || b.position}</td>
                      <td style={{ padding: '8px 14px', color: S.muted }}>{b.shop_name || '—'}</td>
                      <td style={{ padding: '8px 14px' }}>
                        <button onClick={() => handleToggleStatus(b)} style={{
                          padding: '3px 10px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700,
                          background: b.status === 'active' ? '#052e16' : '#1e1e2e',
                          color: b.status === 'active' ? S.green : S.muted,
                        }}>
                          {b.status === 'active' ? '● Đang hiện' : '○ Đã ẩn'}
                        </button>
                      </td>
                      <td style={{ padding: '8px 14px', color: S.muted, fontSize: 11 }}>
                        {b.source_auction_id ? `Đấu giá #${b.source_auction_id}` : 'Thủ công'}
                      </td>
                      <td style={{ padding: '8px 14px' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => openEditBanner(b)} style={{ padding: '5px 9px', background: '#1e1e2e', color: '#94a3b8', border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>✏️</button>
                          <button onClick={() => handleDeleteBanner(b)} style={{ padding: '5px 9px', background: '#2d1010', color: '#ef4444', border: `1px solid ${S.redDark}`, borderRadius: 6, fontSize: 11, cursor: 'pointer' }}>🗑</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
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

      {/* Create/Edit banner modal (bảng quản lý CRUD) */}
      {manageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !manageSaving && setManageModal(false)}>
          <div style={{ width: 420, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 14, maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>
                {editingBanner ? `✏️ Sửa banner #${editingBanner.banner_id}` : '+ Thêm banner thủ công'}
              </h2>
              <button onClick={() => setManageModal(false)} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>SLOT</label>
              <select value={manageForm.slot_id} onChange={e => setManageForm((f: any) => ({ ...f, slot_id: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }}>
                <option value="">-- Chọn slot --</option>
                {slots.map(s => <option key={s.slot_id} value={s.slot_id}>{s.name} ({POSITION_LABEL[s.position] || s.position})</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>ĐƯỜNG DẪN ẢNH</label>
              <input value={manageForm.image_url} onChange={e => setManageForm((f: any) => ({ ...f, image_url: e.target.value }))} placeholder="/uploads/banners/... hoặc URL đầy đủ"
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
              {manageForm.image_url && (
                <img src={getImageUrl(manageForm.image_url)} alt="preview" style={{ marginTop: 8, width: '100%', height: 100, objectFit: 'cover', borderRadius: 8, background: '#0a0a0f' }} />
              )}
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>TIÊU ĐỀ</label>
              <input value={manageForm.title} onChange={e => setManageForm((f: any) => ({ ...f, title: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>LINK KHI CLICK</label>
              <input value={manageForm.link} onChange={e => setManageForm((f: any) => ({ ...f, link: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>TÊN SHOP (hiển thị, tùy chọn)</label>
              <input value={manageForm.shop_name} onChange={e => setManageForm((f: any) => ({ ...f, shop_name: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
            </div>

            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>TRẠNG THÁI</label>
              <select value={manageForm.status} onChange={e => setManageForm((f: any) => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }}>
                <option value="active">Đang hiện trên site</option>
                <option value="inactive">Đã ẩn</option>
              </select>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button onClick={() => setManageModal(false)} disabled={manageSaving} style={{ padding: '9px 18px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSaveBanner} disabled={manageSaving || !manageForm.slot_id || !manageForm.image_url}
                style={{ padding: '9px 20px', background: manageSaving ? S.redDark : S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: manageSaving ? 'not-allowed' : 'pointer' }}>
                {manageSaving ? 'Đang lưu...' : '💾 Lưu'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperBanners
