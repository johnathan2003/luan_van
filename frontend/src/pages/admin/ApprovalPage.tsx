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

const MOCK_SHOP_REGS = [
  { reg_id:1, shop_name:'GadgetHub VN',  user_id:10, address:'15 Lê Văn Sỹ, Q3, HCM',       status:'pending',  created_at:'2025-06-13' },
  { reg_id:2, shop_name:'OrganicFood',   user_id:11, address:'88 Phan Đăng Lưu, Phú Nhuận', status:'pending',  created_at:'2025-06-12' },
  { reg_id:3, shop_name:'SportZone',     user_id:12, address:'120 Nguyễn Xí, Bình Thạnh',   status:'approved', created_at:'2025-06-10' },
  { reg_id:4, shop_name:'KidsWorld',     user_id:13, address:'5 Đinh Tiên Hoàng, Q1',        status:'rejected', created_at:'2025-06-08' },
]

const MOCK_SHIPPER_REGS = [
  { reg_id:5, user_id:20, vehicle_type:'Xe máy',       license_plate:'59F1-12345', status:'pending',  created_at:'2025-06-14' },
  { reg_id:6, user_id:21, vehicle_type:'Xe đạp điện',  license_plate:'N/A',        status:'pending',  created_at:'2025-06-13' },
  { reg_id:7, user_id:22, vehicle_type:'Ô tô',          license_plate:'51A-99999',  status:'approved', created_at:'2025-06-11' },
]

const MOCK_PENDING_PRODUCTS = [
  { product_id:10, product_name:'Ốp lưng iPhone 15 Pro Max', shop_id:1, price:120000,  status:'pending', created_at:'2025-06-14' },
  { product_id:11, product_name:'Dầu gội Organic Coconut',    shop_id:3, price:85000,   status:'pending', created_at:'2025-06-13' },
  { product_id:12, product_name:'Giày thể thao Nike Air',     shop_id:2, price:1500000, status:'pending', created_at:'2025-06-12' },
]

type TabKey = 'shop' | 'shipper' | 'product'

const ApprovalPage: React.FC = () => {
  const [tab, setTab]           = useState<TabKey>('shop')
  const [shops, setShops]       = useState<any[]>(MOCK_SHOP_REGS)
  const [shippers, setShippers] = useState<any[]>(MOCK_SHIPPER_REGS)
  const [products, setProducts] = useState<any[]>(MOCK_PENDING_PRODUCTS)
  const [loading, setLoading]   = useState(false)

  useEffect(() => {
    setLoading(true)
    const p =
      tab === 'shop'    ? adminService.getShopRegistrations().then(r => setShops(r.data?.registrations || r.data || MOCK_SHOP_REGS)) :
      tab === 'shipper' ? adminService.getShipperRegistrations().then(r => setShippers(r.data?.registrations || r.data || MOCK_SHIPPER_REGS)) :
                          adminService.getPendingProducts().then(r => setProducts(r.data?.products || r.data || MOCK_PENDING_PRODUCTS))
    p.catch(() => {}).finally(() => setLoading(false))
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
