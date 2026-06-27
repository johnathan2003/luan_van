import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Loading from '../../components/common/Loading'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ duyệt', color: C.warning, bg: '#FEF3C7' },
  approved: { label: 'Đã duyệt',  color: C.success, bg: '#DCFCE7' },
  rejected: { label: 'Từ chối',   color: C.error,   bg: '#FEE2E2' },
  active:   { label: 'Đã duyệt',  color: C.success, bg: '#DCFCE7' },
}

type TabKey = 'shop' | 'shipper' | 'product'

const ApprovalPage: React.FC = () => {
  const [tab, setTab]           = useState<TabKey>('shop')
  const [shops, setShops]       = useState<any[]>([])
  const [shippers, setShippers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)

  useEffect(() => {
    setLoading(true)
    const setter = tab === 'shop' ? setShops : tab === 'shipper' ? setShippers : setProducts
    const key    = tab === 'shop' ? 'registrations' : tab === 'shipper' ? 'registrations' : 'products'
    const call   =
      tab === 'shop'    ? adminService.getShopRegistrations() :
      tab === 'shipper' ? adminService.getShipperRegistrations() :
                          adminService.getPendingProducts()
    call
      .then(r => { const d = r.data?.[key] ?? r.data; if (Array.isArray(d)) setter(d) })
      .catch(() => setter([]))
      .finally(() => setLoading(false))
  }, [tab])

  const items = tab === 'shop' ? shops : tab === 'shipper' ? shippers : products

  const handleApprove = (id: number) => {
    adminService.approveShop(id).catch(() => {})
    if (tab === 'shop')    setShops(s => s.map(x => x.reg_id === id ? { ...x, status: 'approved' } : x))
    if (tab === 'shipper') setShippers(s => s.map(x => x.reg_id === id ? { ...x, status: 'approved' } : x))
    if (tab === 'product') setProducts(s => s.map(x => x.product_id === id ? { ...x, status: 'active' } : x))
  }

  const handleReject = (id: number) => {
    const reason = window.prompt('Lý do từ chối:')
    if (!reason) return
    if (tab === 'shop')    setShops(s => s.map(x => x.reg_id === id ? { ...x, status: 'rejected' } : x))
    if (tab === 'shipper') setShippers(s => s.map(x => x.reg_id === id ? { ...x, status: 'rejected' } : x))
    if (tab === 'product') setProducts(s => s.map(x => x.product_id === id ? { ...x, status: 'rejected' } : x))
  }

  const pendingShops     = shops.filter(x => x.status === 'pending').length
  const pendingShippers  = shippers.filter(x => x.status === 'pending').length
  const pendingProducts  = products.filter(x => x.status === 'pending').length

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>✅ Phê duyệt</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Xem xét và phê duyệt đăng ký cửa hàng, shipper và sản phẩm</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { key:'shop',    label:'Đăng ký Shop',   count: pendingShops,    icon:'🏪', color: C.blue },
          { key:'shipper', label:'Đăng ký Shipper', count: pendingShippers, icon:'🚚', color: C.warning },
          { key:'product', label:'Sản phẩm chờ',   count: pendingProducts, icon:'🏷️', color: '#7C3AED' },
        ].map(s => (
          <div key={s.key} className="card" style={{ padding: '16px 20px', borderLeft: `3px solid ${s.color}`, cursor: 'pointer', background: tab === s.key ? C.tint : 'var(--bg-card)' }}
            onClick={() => setTab(s.key as TabKey)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count} chờ duyệt</p>
              </div>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 8 }}>
        {([['shop','🏪 Đăng ký shop'],['shipper','🚚 Đăng ký shipper'],['product','🏷️ Sản phẩm chờ duyệt']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === k ? C.blue : C.tint, color: tab === k ? 'white' : C.gray,
          }}>{l}</button>
        ))}
      </div>

      {/* Items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>✅ Không có yêu cầu nào</div>
        ) : items.map((item: any, idx) => {
          const id    = item.reg_id ?? item.product_id
          const title = item.shop_name ?? item.product_name ?? `Shipper #${item.user_id}`
          const sub   = tab === 'shop'    ? `UID #${item.user_id} · ${item.address ?? '—'}`
                      : tab === 'shipper' ? `UID #${item.user_id} · ${item.vehicle_type} · ${item.license_plate}`
                      : `Shop #${item.shop_id} · ${Number(item.price||0).toLocaleString('vi-VN')}₫`
          const st  = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending
          return (
            <div key={id ?? idx} className="card" style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{title}</p>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <p style={{ fontSize: 13, color: C.gray }}>{sub}</p>
                {item.created_at && <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>🕐 {item.created_at}</p>}
              </div>
              {item.status === 'pending' && (
                <div style={{ display: 'flex', gap: 8, marginLeft: 20 }}>
                  <button onClick={() => handleApprove(id)} style={{ padding: '8px 20px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✅ Duyệt</button>
                  <button onClick={() => handleReject(id)}  style={{ padding: '8px 20px', background: '#FEE2E2', color: C.error,   border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>❌ Từ chối</button>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default ApprovalPage
