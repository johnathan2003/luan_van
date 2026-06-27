/**
 * 🖼️ Banner Admin — Quản lý banner quảng cáo
 * Nhóm 7: duyệt, xóa, sắp xếp thứ tự banner
 */
import React, { useState, useEffect } from 'react'
import { adminService } from '../../services/adminService'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const BannerAdminPage: React.FC = () => {
  const [banners, setBanners] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'pending' | 'active' | 'rejected'>('pending')

  const loadData = async () => {
    try {
      const res = await adminService.getBanners()
      setBanners(res.data?.banners ?? res.data ?? [])
    } catch {
      setBanners([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  const byTab = banners.filter(b => b.status === tab)

  const approve = async (id: number) => {
    await adminService.updateBanner(id, { status: 'active' })
    setBanners(bs => bs.map(b => b.banner_id === id ? { ...b, status: 'active' } : b))
  }
  const reject = async (id: number) => {
    await adminService.updateBanner(id, { status: 'rejected' })
    setBanners(bs => bs.map(b => b.banner_id === id ? { ...b, status: 'rejected' } : b))
  }
  const remove = async (id: number) => {
    if (!window.confirm('Xóa banner này?')) return
    await adminService.deleteBanner(id)
    setBanners(bs => bs.filter(b => b.banner_id !== id))
  }
  const moveUp = async (id: number, idx: number) => {
    // optimistic reorder in UI; persist new display_order
    const activeList = banners.filter(b => b.status === 'active')
    if (idx <= 0) return
    const prev = activeList[idx - 1]
    // swap display_order
    await Promise.all([
      adminService.updateBanner(id,            { display_order: prev.display_order }),
      adminService.updateBanner(prev.banner_id, { display_order: activeList[idx].display_order }),
    ])
    loadData()
  }

  const statusColor: Record<string, string> = { active: C.success, pending: C.warning, rejected: C.error }
  const statusBg:    Record<string, string> = { active: '#DCFCE7', pending: '#FEF3C7', rejected: '#FEE2E2' }
  const statusLabel: Record<string, string> = { active: 'Hiển thị', pending: 'Chờ duyệt', rejected: 'Từ chối' }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>

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
          <div key={b.banner_id} className="card" style={{ display: 'flex', gap: 20, padding: 18, alignItems: 'flex-start' }}>
            {/* Preview */}
            <div style={{
              width: 280, height: 110, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
              background: `linear-gradient(135deg, ${b.color1 || '#DBEAFE'}, ${b.color2 || '#1D4ED8'})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {b.image_url
                ? <img src={b.image_url} alt={b.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span style={{ fontSize: 48 }}>{b.emoji || '🖼️'}</span>
              }
            </div>

            {/* Info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: C.navy }}>{b.title}</span>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: statusBg[b.status], color: statusColor[b.status] }}>{statusLabel[b.status]}</span>
                {tab === 'active' && <span style={{ fontSize: 11, background: C.light, color: C.blue, padding: '2px 8px', borderRadius: 20, fontWeight: 600 }}>Thứ tự #{b.display_order ?? idx + 1}</span>}
              </div>
              <p style={{ fontSize: 13, color: C.gray, marginBottom: 4 }}>Shop: <strong>{b.shop_name || '—'}</strong></p>
              <p style={{ fontSize: 12, color: C.gray }}>Hiệu lực: {b.valid_from || '—'} → {b.valid_to || '—'}</p>
              {b.link && <p style={{ fontSize: 12, color: C.gray, marginTop: 2 }}>Link: <a href={b.link} style={{ color: C.blue }}>{b.link}</a></p>}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
              {b.status === 'pending' && <>
                <button onClick={() => approve(b.banner_id)} style={{ padding: '7px 18px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>✅ Duyệt</button>
                <button onClick={() => reject(b.banner_id)}  style={{ padding: '7px 18px', background: '#FEE2E2', color: C.error,   border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>❌ Từ chối</button>
              </>}
              {b.status === 'active' && idx > 0 &&
                <button onClick={() => moveUp(b.banner_id, idx)} style={{ padding: '7px 18px', background: C.tint, color: C.blue, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>⬆️ Lên trên</button>
              }
              <button onClick={() => remove(b.banner_id)} style={{ padding: '7px 18px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>🗑️ Xóa</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default BannerAdminPage
