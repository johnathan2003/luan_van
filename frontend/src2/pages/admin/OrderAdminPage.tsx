/**
 * 📦 Order Admin — Quản lý đơn hàng
 * Nhóm 4: xem danh sách, xem chi tiết đơn hàng, gán shipper
 */
import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import { shipmentService } from '../../services/shipmentService'
import Loading from '../../components/common/Loading'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626', amber: '#F59E0B' }

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:       { label: 'Chờ xử lý',    color: C.warning, bg: '#FEF3C7' },
  confirmed:     { label: 'Đã xác nhận',  color: C.blue,    bg: C.light },
  paid:          { label: 'Đã thanh toán', color: '#7C3AED', bg: '#EDE9FE' },
  ready_to_ship: { label: 'Sẵn giao',     color: C.sky,     bg: '#E0F2FE' },
  shipped:       { label: 'Đang giao',    color: C.warning, bg: '#FEF3C7' },
  delivered:     { label: 'Đã giao',      color: C.success, bg: '#DCFCE7' },
  completed:     { label: 'Hoàn thành',   color: C.success, bg: '#DCFCE7' },
  cancelled:     { label: 'Đã hủy',       color: C.error,   bg: '#FEE2E2' },
  returned:      { label: 'Hoàn trả',     color: C.gray,    bg: '#F1F5F9' },
}

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = STATUS_MAP[status] ?? { label: status, color: C.gray, bg: '#F1F5F9' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>{s.label}</span>
}

const VEHICLE_ICON: Record<string, string> = { bike: '🏍️', motorbike: '🛵', car: '🚗', truck: '🚛' }

const OrderAdminPage: React.FC = () => {
  const [orders, setOrders]     = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filter, setFilter]     = useState('all')
  const [selected, setSelected] = useState<any | null>(null)

  // Assign shipper modal state
  const [showAssign, setShowAssign]               = useState(false)
  const [availableShippers, setAvailableShippers] = useState<any[]>([])
  const [shippersLoading, setShippersLoading]     = useState(false)
  const [selectedShipper, setSelectedShipper]     = useState<number | null>(null)
  const [assigning, setAssigning]                 = useState(false)
  const [assignError, setAssignError]             = useState('')

  useEffect(() => {
    setLoading(true)
    adminService.getOrders({ limit: 100 })
      .then((res: any) => {
        const list = res.data?.orders ?? res.data
        if (Array.isArray(list)) setOrders(list)
      })
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }, [])

  const filtered = orders.filter(o => {
    const matchSearch = !search || o.order_number?.toLowerCase().includes(search.toLowerCase()) || String(o.order_id).includes(search)
    const matchFilter = filter === 'all' || o.order_status === filter
    return matchSearch && matchFilter
  })

  const openAssignModal = async () => {
    setShowAssign(true)
    setSelectedShipper(null)
    setAssignError('')
    setShippersLoading(true)
    try {
      const res = await shipmentService.getAvailableShippers()
      setAvailableShippers(res.data?.shippers ?? [])
    } catch {
      setAvailableShippers([])
    } finally {
      setShippersLoading(false)
    }
  }

  const doAssign = async () => {
    if (!selected || !selectedShipper) return
    setAssigning(true)
    setAssignError('')
    try {
      await adminService.assignShipperToOrder(selected.order_id, selectedShipper)
      setOrders(os => os.map(o =>
        o.order_id === selected.order_id ? { ...o, order_status: 'shipped', shipper_id: selectedShipper } : o
      ))
      setSelected((s: any) => ({ ...s, order_status: 'shipped', shipper_id: selectedShipper }))
      setShowAssign(false)
    } catch (e: any) {
      setAssignError(e?.response?.data?.detail ?? 'Gán shipper thất bại')
    } finally {
      setAssigning(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📦 Quản lý đơn hàng</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Theo dõi và quản lý toàn bộ đơn hàng trên nền tảng</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng đơn',    value: orders.length,                                            color: C.blue,    bg: C.light },
          { label: 'Đang xử lý', value: orders.filter(o=>['pending','confirmed'].includes(o.order_status)).length, color: C.warning, bg:'#FEF3C7' },
          { label: 'Sẵn giao',   value: orders.filter(o=>o.order_status==='ready_to_ship').length, color: C.sky,     bg:'#E0F2FE' },
          { label: 'Đang giao',  value: orders.filter(o=>o.order_status==='shipped').length,       color: C.amber,   bg:'#FEF9C3' },
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
      {selected && !showAssign && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.45)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => setSelected(null)}>
          <div className="card" style={{ width:540, padding:28, maxHeight:'88vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div>
                <h2 style={{ fontSize:18, fontWeight:800, color:C.navy }}>Chi tiết đơn hàng</h2>
                <p style={{ fontSize:12, color:C.gray, marginTop:2 }}>{selected.order_number}</p>
              </div>
              <button onClick={() => setSelected(null)} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:16 }}>
              {([
                ['Khách hàng', `UID #${selected.user_id}`],
                ['Cửa hàng', `Shop #${selected.shop_id}`],
                ['Shipper', selected.shipper_id ? `#${selected.shipper_id}` : '— Chưa gán'],
                ['Tổng tiền', `${Number(selected.total_price||0).toLocaleString('vi-VN')}₫`],
                ['Giảm giá', `${Number(selected.discount_amount||0).toLocaleString('vi-VN')}₫`],
                ['Phí ship', `${Number(selected.shipping_fee||0).toLocaleString('vi-VN')}₫`],
                ['Thanh toán cuối', `${Number(selected.final_price||0).toLocaleString('vi-VN')}₫`],
                ['Phương thức TT', selected.payment_method?.toUpperCase()],
                ['TT thanh toán', selected.payment_status],
                ['Ngày tạo', selected.created_at?.slice(0,16)],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} style={{ padding:'8px 12px', background:C.tint, borderRadius:8 }}>
                  <p style={{ fontSize:11, color:C.gray, fontWeight:600 }}>{k}</p>
                  <p style={{ fontSize:14, color:C.navy, fontWeight:600, marginTop:2 }}>{v}</p>
                </div>
              ))}
            </div>

            {/* Trạng thái */}
            <div style={{ padding:'10px 14px', background:C.tint, borderRadius:8, marginBottom:16, display:'flex', alignItems:'center', gap:10 }}>
              <span style={{ fontSize:12, color:C.gray, fontWeight:600 }}>TRẠNG THÁI:</span>
              <StatusBadge status={selected.order_status} />
            </div>

            {selected.shipping_address && (
              <div style={{ padding:'12px 16px', background:'#F8FAFF', borderRadius:8, marginBottom:16 }}>
                <p style={{ fontSize:11, color:C.gray, fontWeight:600, marginBottom:4 }}>ĐỊA CHỈ GIAO HÀNG</p>
                <p style={{ fontSize:13, color:C.navy }}>{selected.recipient_name} — {selected.recipient_phone}</p>
                <p style={{ fontSize:13, color:C.gray }}>{selected.shipping_address}</p>
              </div>
            )}

            {/* Nút gán shipper: chỉ khi ready_to_ship */}
            {selected.order_status === 'ready_to_ship' && (
              <button onClick={openAssignModal}
                style={{ width:'100%', padding:'12px 0', background:'#E0F2FE', color:C.sky, border:`2px solid ${C.sky}`, borderRadius:10, fontWeight:700, fontSize:14, cursor:'pointer' }}>
                🚚 Gán Shipper cho đơn này
              </button>
            )}
          </div>
        </div>
      )}

      {/* Assign Shipper Modal */}
      {showAssign && selected && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:3000, display:'flex', alignItems:'center', justifyContent:'center' }}
          onClick={() => !assigning && setShowAssign(false)}>
          <div className="card" style={{ width:460, padding:28, maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:18 }}>
              <div>
                <h2 style={{ fontSize:17, fontWeight:800, color:C.navy }}>🚚 Gán Shipper</h2>
                <p style={{ fontSize:12, color:C.gray, marginTop:2 }}>Đơn: {selected.order_number}</p>
              </div>
              <button onClick={() => !assigning && setShowAssign(false)} style={{ border:'none', background:'none', fontSize:20, cursor:'pointer', color:C.gray }}>✕</button>
            </div>

            {assignError && (
              <div style={{ padding:'10px 14px', background:'#FEE2E2', color:C.error, borderRadius:8, fontSize:13, marginBottom:14 }}>
                ❌ {assignError}
              </div>
            )}

            {shippersLoading ? (
              <div style={{ padding:32, textAlign:'center', color:C.gray }}>Đang tải danh sách shipper...</div>
            ) : availableShippers.length === 0 ? (
              <div style={{ padding:24, textAlign:'center', background:C.tint, borderRadius:10, marginBottom:18 }}>
                <p style={{ fontSize:28, marginBottom:8 }}>🚫</p>
                <p style={{ fontWeight:600, color:C.navy }}>Không có shipper nào đang sẵn sàng</p>
                <p style={{ fontSize:12, color:C.gray, marginTop:4 }}>Shipper cần bật trạng thái "Sẵn sàng" trên ứng dụng</p>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
                <p style={{ fontSize:12, fontWeight:600, color:C.gray }}>CHỌN SHIPPER ({availableShippers.length} sẵn sàng)</p>
                {availableShippers.map((s: any) => {
                  const isSelected = selectedShipper === s.shipper_id
                  return (
                    <div key={s.shipper_id} onClick={() => setSelectedShipper(s.shipper_id)}
                      style={{
                        padding:'12px 16px', borderRadius:10, cursor:'pointer',
                        border: isSelected ? `2px solid ${C.sky}` : `2px solid ${C.tint}`,
                        background: isSelected ? '#E0F2FE' : C.tint,
                        display:'flex', alignItems:'center', gap:12,
                        transition:'all 0.15s',
                      }}>
                      <span style={{ fontSize:26 }}>{VEHICLE_ICON[s.vehicle_type] ?? '🛵'}</span>
                      <div style={{ flex:1 }}>
                        <p style={{ fontWeight:700, color:C.navy, fontSize:14 }}>Shipper #{s.shipper_id}</p>
                        <p style={{ fontSize:12, color:C.gray, marginTop:2 }}>
                          {s.vehicle_type ?? 'Phương tiện không rõ'} &nbsp;·&nbsp; ⭐ {s.rating ?? '—'}
                        </p>
                      </div>
                      {isSelected && <span style={{ fontSize:20, color:C.sky }}>✓</span>}
                    </div>
                  )
                })}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => !assigning && setShowAssign(false)}
                style={{ flex:1, padding:'10px 0', background:C.tint, color:C.gray, border:'none', borderRadius:9, fontWeight:600, fontSize:13, cursor:'pointer' }}>
                Huỷ
              </button>
              <button onClick={doAssign} disabled={!selectedShipper || assigning}
                style={{
                  flex:2, padding:'10px 0', border:'none', borderRadius:9, fontWeight:700, fontSize:14,
                  cursor: (!selectedShipper || assigning) ? 'not-allowed' : 'pointer',
                  background: (!selectedShipper || assigning) ? C.gray : C.sky,
                  color: 'white',
                }}>
                {assigning ? 'Đang gán...' : '🚚 Xác nhận gán shipper'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderAdminPage
