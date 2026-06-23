/**
 * 📦 Order Admin — Quản lý đơn hàng
 * Nhóm 4: xem danh sách, xem chi tiết đơn hàng
 */
import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Loading from '../../components/common/Loading'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:       { label: 'Chờ xử lý',  color: C.warning, bg: '#FEF3C7' },
  confirmed:     { label: 'Đã xác nhận',color: C.blue,    bg: C.light },
  paid:          { label: 'Đã thanh toán', color: '#7C3AED', bg: '#EDE9FE' },
  ready_to_ship: { label: 'Sẵn giao',   color: C.sky,     bg: '#E0F2FE' },
  shipped:       { label: 'Đang giao',   color: C.warning, bg: '#FEF3C7' },
  delivered:     { label: 'Đã giao',    color: C.success, bg: '#DCFCE7' },
  completed:     { label: 'Hoàn thành', color: C.success, bg: '#DCFCE7' },
  cancelled:     { label: 'Đã hủy',     color: C.error,   bg: '#FEE2E2' },
  returned:      { label: 'Hoàn trả',   color: C.gray,    bg: '#F1F5F9' },
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_MAP[status] ?? { label: status, color: C.gray, bg: '#F1F5F9' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
}

const OrderAdminPage: React.FC = () => {
  const [orders, setOrders]     = useState<any[]>(MOCK_ORDERS)
  const [loading, setLoading]   = useState(false)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState<any | null>(null)

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) || String(o.order_id).includes(search)
    const matchFilter = filter === 'all' || o.order_status === filter
    return matchSearch && matchFilter
  })

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📦 Quản lý đơn hàng</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Theo dõi và quản lý toàn bộ đơn hàng trên nền tảng</p>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng đơn',    value: orders.length,                                          color: C.blue,    bg: C.light },
          { label: 'Đang xử lý', value: orders.filter(o=>['pending','confirmed'].includes(o.order_status)).length, color: C.warning, bg:'#FEF3C7' },
          { label: 'Đang giao',  value: orders.filter(o=>o.order_status==='shipped').length,     color: C.sky,     bg:'#E0F2FE' },
          { label: 'Hoàn thành', value: orders.filter(o=>['delivered','completed'].includes(o.order_status)).length, color: C.success, bg:'#DCFCE7' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filter + Search */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm mã đơn, ID..."
          style={{ flex:1, minWidth:180, padding:'8px 14px', border:`1px solid ${C.light}`, borderRadius:8, fontSize:13, outline:'none' }} />
        <select value={filter} onChange={e => setFilter(e.target.value)}
          style={{ padding:'8px 14px', border:`1px solid ${C.light}`, borderRadius:8, fontSize:13, outline:'none' }}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_MAP).map(([k,v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Mã đơn', 'Khách hàng', 'Shop', 'Tổng tiền', 'Thanh toán', 'Trạng thái', 'Ngày tạo', 'Chi tiết'].map(h => (
                <th key={h} style={{ padding:'11px 14px', textAlign:'left', fontSize:12, fontWeight:700, color:C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding:32, textAlign:'center', color:C.gray }}>Không có đơn hàng nào</td></tr>
            ) : filtered.map((o, i) => (
              <tr key={o.order_id ?? i} style={{ borderBottom:`1px solid ${C.tint}` }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding:'12px 14px', fontSize:13, fontWeight:600, color:C.blue }}>{o.order_number}</td>
                <td style={{ padding:'12px 14px', fontSize:13 }}>UID #{o.user_id}</td>
                <td style={{ padding:'12px 14px', fontSize:13 }}>Shop #{o.shop_id}</td>
                <td style={{ padding:'12px 14px', fontSize:13, fontWeight:700, color:C.navy }}>{Number(o.final_price||0).toLocaleString('vi-VN')}₫</td>
                <td style={{ padding:'12px 14px', fontSize:12 }}>{o.payment_method?.toUpperCase()}</td>
                <td style={{ padding:'12px 14px' }}><StatusBadge status={o.order_status} /></td>
                <td style={{ padding:'12px 14px', fontSize:12, color:C.gray }}>{o.created_at?.slice(0,10)}</td>
                <td style={{ padding:'12px 14px' }}>
                  <button onClick={() => setSelected(o)} style={{ padding:'5px 12px', background:C.light, color:C.blue, border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>Chi tiết</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setSelected(null)}>
          <div className="card" style={{ width:520, padding:28, maxHeight:'85vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <h2 style={{ fontSize:18, fontWeight:800, color:C.navy }}>Chi tiết đơn hàng</h2>
              <button onClick={() => setSelected(null)} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {[
                ['Mã đơn', selected.order_number],
                ['Khách hàng', `UID #${selected.user_id}`],
                ['Cửa hàng', `Shop #${selected.shop_id}`],
                ['Shipper', selected.shipper_id ? `#${selected.shipper_id}` : '—'],
                ['Tổng tiền', `${Number(selected.total_price||0).toLocaleString('vi-VN')}₫`],
                ['Giảm giá', `${Number(selected.discount_amount||0).toLocaleString('vi-VN')}₫`],
                ['Phí ship', `${Number(selected.shipping_fee||0).toLocaleString('vi-VN')}₫`],
                ['Thanh toán cuối', `${Number(selected.final_price||0).toLocaleString('vi-VN')}₫`],
                ['Phương thức TT', selected.payment_method?.toUpperCase()],
                ['TT thanh toán', selected.payment_status],
                ['TT đơn hàng', selected.order_status],
                ['Ngày tạo', selected.created_at?.slice(0,16)],
              ].map(([k,v]) => (
                <div key={k} style={{ padding:'8px 12px', background:C.tint, borderRadius:8 }}>
                  <p style={{ fontSize:11, color:C.gray, fontWeight:600 }}>{k}</p>
                  <p style={{ fontSize:14, color:C.navy, fontWeight:600 }}>{v}</p>
                </div>
              ))}
            </div>
            {selected.shipping_address && (
              <div style={{ marginTop:14, padding:'12px 16px', background:'#F8FAFF', borderRadius:8 }}>
                <p style={{ fontSize:11, color:C.gray, fontWeight:600, marginBottom:4 }}>ĐỊA CHỈ GIAO HÀNG</p>
                <p style={{ fontSize:13, color:C.navy }}>{selected.recipient_name} — {selected.recipient_phone}</p>
                <p style={{ fontSize:13, color:C.gray }}>{selected.shipping_address}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const MOCK_ORDERS = [
  { order_id:1, order_number:'ORD-20250601-0001', user_id:4, shop_id:1, shipper_id:3, total_price:6500000, discount_amount:650000, shipping_fee:30000, final_price:5880000, payment_method:'momo', payment_status:'paid', order_status:'delivered', shipping_address:'99 CMT8, Q3, HCM', recipient_name:'Hoàng Văn An', recipient_phone:'0905555551', created_at:'2025-06-01T10:30:00' },
  { order_id:2, order_number:'ORD-20250602-0002', user_id:4, shop_id:1, shipper_id:null,total_price:180000, discount_amount:0, shipping_fee:25000, final_price:205000, payment_method:'cod', payment_status:'unpaid', order_status:'pending', shipping_address:'99 CMT8, Q3, HCM', recipient_name:'Hoàng Văn An', recipient_phone:'0905555551', created_at:'2025-06-02T14:00:00' },
  { order_id:3, order_number:'ORD-20250603-0003', user_id:5, shop_id:2, shipper_id:3, total_price:280000, discount_amount:0, shipping_fee:20000, final_price:300000, payment_method:'vnpay', payment_status:'paid', order_status:'shipped', shipping_address:'10 Lê Lai, Q1, HCM', recipient_name:'Nguyễn Thị B', recipient_phone:'0911111111', created_at:'2025-06-03T09:15:00' },
]

export default OrderAdminPage
