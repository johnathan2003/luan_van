/**
 * 🖼️ Banner Admin — Quản lý banner quảng cáo
 * Nhóm 7: duyệt, xóa, sắp xếp thứ tự banner
 */
import React, { useState } from 'react'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const BannerAdminPage: React.FC = () => {
  const [banners, setBanners] = useState(MOCK_BANNERS)
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected'>('pending')

  const byTab = banners.filter(b => b.status === tab)

  const approve = (id: number) => setBanners(bs => bs.map(b => b.id === id ? { ...b, status: 'active' } : b))
  const reject  = (id: number) => setBanners(bs => bs.map(b => b.id === id ? { ...b, status: 'rejected' } : b))
  const remove  = (id: number) => { if (window.confirm('Xóa banner này?')) setBanners(bs => bs.filter(b => b.id !== id)) }
  const moveUp  = (id: number) => {
    setBanners(bs => {
      const idx = bs.findIndex(b => b.id === id)
      if (idx <= 0) return bs
      const a = [...bs]
      ;[a[idx - 1], a[idx]] = [a[idx], a[idx - 1]]
      return a
    })
  }

  const statusColor: Record<string, string> = { active: C.success, pending: C.warning, rejected: C.error }
  const statusBg:    Record<string, string> = { active: '#DCFCE7', pending: '#FEF3C7', rejected: '#FEE2E2' }
  const statusLabel: Record<string, string> = { active: 'Hiển thị', pending: 'Chờ duyệt', rejected: 'Từ chối' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🖼️ Quản lý Banner</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Duyệt và sắp xếp banner quảng cáo từ cửa hàng</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {(['pending','active','rejected'] as const).map(s => (
          <div key={s} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${statusColor[s]}`, cursor: 'pointer', background: tab === s ? C.tint : 'var(--bg-card)' }}
            onClick={() => setTab(s)}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{statusLabel[s]}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: statusColor[s] }}>{banners.filter(b => b.status === s).length}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 8 }}>
        {(['pending','active','rejected'] as const).map(s => (
          <button key={s} onClick={() => setTab(s)} style={{
            padding: '7px 18px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: tab === s ? statusColor[s] : C.tint, color: tab === s ? 'white' : C.gray,
          }}>{statusLabel[s]}</button>
        ))}
      </div>

      {/* Banner cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {byTab.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>Không có banner nào ở trạng thái này</div>
        ) : byTab.map((b, idx) => (
          <div key={b.id} className="card" style={{ display: 'flex', gap: 20, padding: 18, alignItems: 'flex-start' }}>
            {/* Preview */}
            <div style={{
              width: 280, height: 110, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
              background: `linear-gradient(135deg, ${b.color1}, ${b.color2})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: 48 }}>{b.emoji}</span>
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>{b.title}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: statusBg[b.status], color: statusColor[b.status] }}>{statusLabel[b.status]}</span>
                {tab === 'active' && <span style={{ fontSize: 11, background: C.light, color: C.blue, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Thứ tự #{idx + 1}</span>}
              </div>
              <p style={{ fontSize: 13, color: C.gray, marginBottom: 4 }}>Shop: <strong>{b.shop_name}</strong></p>
              <p style={{ fontSize: 12, color: C.gray }}>Hiệu lực: {b.valid_from} → {b.valid_to}</p>
              <p style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>Link: <a href={b.link} style={{ color: C.blue }}>{b.link}</a></p>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              {b.status === 'pending' && <>
                <button onClick={() => approve(b.id)} style={{ padding: '7px 18px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✅ Duyệt</button>
                <button onClick={() => reject(b.id)}  style={{ padding: '7px 18px', background: '#FEE2E2', color: C.error,   border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>❌ Từ chối</button>
              </>}
              {b.status === 'active' && idx > 0 &&
                <button onClick={() => moveUp(b.id)} style={{ padding: '7px 18px', background: C.tint, color: C.blue, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>⬆️ Lên trên</button>
              }
              <button onClick={() => remove(b.id)} style={{ padding: '7px 18px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>🗑️ Xóa</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

const MOCK_BANNERS = [
  { id:1, title:'Sale Hè 2025', shop_name:'TechWorld Store', status:'pending', valid_from:'2025-06-01', valid_to:'2025-06-30', link:'https://example.com/sale', emoji:'🌞', color1:'#FEF08A', color2:'#F97316' },
  { id:2, title:'Fashion Week',  shop_name:'FashionVN',      status:'pending', valid_from:'2025-07-01', valid_to:'2025-07-07', link:'https://example.com/fw',   emoji:'👗', color1:'#E879F9', color2:'#7C3AED' },
  { id:3, title:'Back to School',shop_name:'BookStore360',   status:'active',  valid_from:'2025-08-01', valid_to:'2025-09-01', link:'https://example.com/bts',  emoji:'📚', color1:'#60A5FA', color2:'#1D4ED8' },
  { id:4, title:'Siêu sale 12/12',shop_name:'TechWorld Store',status:'active', valid_from:'2025-12-10', valid_to:'2025-12-13',link:'https://example.com/1212', emoji:'🎉', color1:'#34D399', color2:'#059669' },
]

export default BannerAdminPage
