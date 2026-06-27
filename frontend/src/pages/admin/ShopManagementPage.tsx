/**
 * 🏪 Shop Management — Quản lý cửa hàng
 * Nhóm 2: xem list, chi tiết, cảnh cáo, đình chỉ, kích hoạt, doanh thu
 */
import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Loading from '../../components/common/Loading'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  active:    { label: 'Hoạt động',  color: C.success, bg: '#DCFCE7' },
  suspended: { label: 'Đình chỉ',   color: C.error,   bg: '#FEE2E2' },
  pending:   { label: 'Chờ duyệt',  color: C.warning, bg: '#FEF3C7' },
  warned:    { label: 'Cảnh cáo',   color: '#7C3AED', bg: '#EDE9FE' },
}

const Badge: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_LABEL[status] ?? { label: status, color: C.gray, bg: '#F1F5F9' }
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  )
}

const ActionBtn: React.FC<{ label: string; color: string; bg: string; onClick: () => void }> = ({ label, color, bg, onClick }) => (
  <button onClick={onClick} style={{ fontSize: 12, fontWeight: 600, padding: '5px 12px', border: 'none', borderRadius: 6, background: bg, color, cursor: 'pointer' }}>{label}</button>
)

const ShopManagementPage: React.FC = () => {
  const [shops, setShops]   = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]  = useState('')
  const [filter, setFilter]  = useState('all')
  const [selected, setSelected] = useState<any | null>(null)

  useEffect(() => {
    // Dùng getShopRegistrations approved để lấy danh sách shop đã duyệt
    adminService.getShopRegistrations('approved')
      .then(r => setShops(r.data?.registrations || r.data || []))
      .catch(() => setShops([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = shops.filter(s => {
    const matchSearch = !search || s.shop_name?.toLowerCase().includes(search.toLowerCase())
    const matchFilter = filter === 'all' || s.status === filter
    return matchSearch && matchFilter
  })

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🏪 Quản lý cửa hàng</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Quản lý, giám sát và xử lý vi phạm cửa hàng trên nền tảng</p>
        </div>
        <div style={{ fontSize: 13, color: C.gray }}>{filtered.length} cửa hàng</div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng shop',    value: shops.length,                                    color: C.blue,    bg: C.light },
          { label: 'Hoạt động',   value: shops.filter(s=>s.status==='active').length,      color: C.success, bg: '#DCFCE7' },
          { label: 'Đình chỉ',    value: shops.filter(s=>s.status==='suspended').length,   color: C.error,   bg: '#FEE2E2' },
          { label: 'Cảnh cáo',   value: shops.filter(s=>s.status==='warned').length,      color: '#7C3AED', bg: '#EDE9FE' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm tên cửa hàng..."
          style={{ flex: 1, padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}
        />
        {['all','active','suspended','warned','pending'].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
            background: filter === f ? C.blue : C.tint, color: filter === f ? 'white' : C.gray,
          }}>
            {{ all:'Tất cả', active:'Hoạt động', suspended:'Đình chỉ', warned:'Cảnh cáo', pending:'Chờ duyệt' }[f]}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['ID', 'Tên cửa hàng', 'Chủ shop', 'Địa chỉ', 'Trạng thái', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Không có dữ liệu</td></tr>
            ) : filtered.map((shop, i) => (
              <tr key={shop.shop_id ?? shop.reg_id ?? i} style={{ borderBottom: `1px solid ${C.tint}`, transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <td style={{ padding: '12px 16px', fontSize: 13, color: C.gray }}>#{shop.shop_id ?? shop.reg_id ?? i + 1}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{shop.shop_name ?? '—'}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>{shop.phone ?? ''}</div>
                </td>
                <td style={{ padding: '12px 16px', fontSize: 13 }}>{shop.user_id ? `UID #${shop.user_id}` : '—'}</td>
                <td style={{ padding: '12px 16px', fontSize: 12, color: C.gray, maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.address ?? '—'}</td>
                <td style={{ padding: '12px 16px' }}><Badge status={shop.status ?? 'active'} /></td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    <ActionBtn label="Chi tiết" color={C.blue} bg={C.light} onClick={() => setSelected(shop)} />
                    {shop.status !== 'warned'    && <ActionBtn label="Cảnh cáo"  color={C.warning} bg="#FEF3C7" onClick={() => alert(`Cảnh cáo shop #${shop.shop_id}`)} />}
                    {shop.status === 'active'    && <ActionBtn label="Đình chỉ"  color={C.error}   bg="#FEE2E2" onClick={() => alert(`Đình chỉ shop #${shop.shop_id}`)} />}
                    {shop.status === 'suspended' && <ActionBtn label="Kích hoạt" color={C.success} bg="#DCFCE7" onClick={() => alert(`Kích hoạt shop #${shop.shop_id}`)} />}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelected(null)}>
          <div className="card" style={{ width: 480, padding: 28, maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>Chi tiết cửa hàng</h2>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            {Object.entries(selected).map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: `1px solid ${C.tint}` }}>
                <span style={{ width: 160, fontSize: 12, fontWeight: 600, color: C.gray, textTransform: 'uppercase' }}>{k}</span>
                <span style={{ fontSize: 13, color: C.navy }}>{String(v ?? '—')}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default ShopManagementPage
