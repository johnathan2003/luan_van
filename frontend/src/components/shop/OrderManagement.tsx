import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { shopService } from '../../services/shopService'
import { orderService } from '../../services/orderService'
import { formatCurrency, formatDate, formatOrderId } from '../../utils/formatters'
import StatusBadge from '../order/StatusBadge'
import Loading from '../common/Loading'
import { useAppSelector } from '../../store/hooks'
import DisputeFormModal from '../dispute/DisputeFormModal'
import { getDisputesByOrder } from '../../utils/disputeStore'

interface Dimensions { length: string; width: string; height: string; weight: string }

const STATUS_LABEL: Record<string, string> = {
  pending: '📋 Chờ xác nhận', confirmed: '📦 Đang đóng hàng', ready_to_ship: '🚚 Chờ shipper',
  shipped: '🛵 Đang giao', delivered: '✅ Đã giao', completed: '🎉 Hoàn thành', cancelled: '❌ Đã hủy',
}

const OrderManagement: React.FC = () => {
  const { user } = useAppSelector(s => s.auth)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [complainOrder, setComplainOrder] = useState<any | null>(null)
  const [detailOrder, setDetailOrder] = useState<any | null>(null)
  const [dims, setDims] = useState<Record<number, Dimensions>>({})
  const [editingDims, setEditingDims] = useState<Set<number>>(new Set())

  const DEFAULT_DIMS: Dimensions = { length: '30', width: '20', height: '15', weight: '1.5' }

  const openDetail = (o: any) => {
    setDetailOrder(o)
    setDims(prev => prev[o.order_id] ? prev : { ...prev, [o.order_id]: { ...DEFAULT_DIMS } })
  }

  const toggleEditDims = (id: number) => {
    setEditingDims(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const setDim = (id: number, field: keyof Dimensions, val: string) =>
    setDims(prev => ({ ...prev, [id]: { ...prev[id], [field]: val } }))

  const calcVolume = (d: Dimensions) => {
    const l = parseFloat(d.length), w = parseFloat(d.width), h = parseFloat(d.height)
    if (!l || !w || !h) return null
    return (l * w * h / 1000).toFixed(1)
  }

  const calcVolWeight = (d: Dimensions) => {
    const l = parseFloat(d.length), w = parseFloat(d.width), h = parseFloat(d.height)
    if (!l || !w || !h) return null
    return (l * w * h / 5000).toFixed(2)
  }

  const load = async () => {
    setLoading(true)
    try {
      const params = filter ? { order_status: filter } : {}
      const res = await shopService.getOrders(params)
      setOrders(res.data.orders)
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [filter])

  const handleConfirm = async (id: number) => {
    try { await orderService.confirm(id); toast.success('Đã xác nhận đơn hàng'); load() } catch { toast.error('Lỗi xác nhận') }
  }

  const handleReadyToShip = async (id: number) => {
    try { await orderService.readyToShip(id); toast.success('Đã đánh dấu sẵn sàng giao'); load() } catch { toast.error('Lỗi') }
  }

  if (loading) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { v: '',              l: 'Tất cả' },
          { v: 'pending',       l: '📋 Chờ xác nhận' },
          { v: 'confirmed',     l: '📦 Đang đóng hàng' },
          { v: 'ready_to_ship', l: '🚚 Chờ shipper' },
          { v: 'shipped',       l: '🛵 Đang giao' },
          { v: 'delivered',     l: '✅ Đã giao' },
          { v: 'completed',     l: '🎉 Hoàn thành' },
          { v: 'cancelled',     l: '❌ Đã hủy' },
        ].map(({ v, l }) => (
          <button key={v} onClick={() => setFilter(v)} className={`btn btn-sm ${filter === v ? 'btn-primary' : 'btn-outline'}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="card table-wrapper">
        <table>
          <thead>
            <tr><th>Mã đơn</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th>Khiếu nại</th><th>Ngày đặt</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {orders.map(o => {
              const orderDisputes = getDisputesByOrder(o.order_id)
              const sentByShop = orderDisputes.find(d => d.complainant_type === 'shop' && d.complainant_id === user?.user_id)
              const receivedByShop = orderDisputes.find(d => d.target_type === 'shop' && d.target_id === user?.user_id)
              return (
              <tr key={o.order_id}>
                <td style={{ fontWeight: 600 }}>{formatOrderId(o.order_id)}</td>
                <td style={{ fontSize: 13 }}>{o.items?.map((i: any) => `${i.product_name} x${i.quantity}`).join(', ')}</td>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(o.final_price)}</td>
                <td><span style={{ fontSize: 12 }}>{o.payment_method.toUpperCase()} · {o.payment_status === 'paid' ? '✅ Đã TT' : '⏳ Chờ TT'}</span></td>
                <td><StatusBadge status={o.order_status} /></td>
                <td>
                  {receivedByShop && (
                    <span title={`Bị khách/shipper khiếu nại — ${receivedByShop.reason_label}`} style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fee2e2', color: '#dc2626', marginBottom: 2 }}>
                      🚩 Bị khiếu nại
                    </span>
                  )}
                  {sentByShop && (
                    <span title={`Shop đã gửi khiếu nại — ${sentByShop.reason_label}`} style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#fef3c7', color: '#d97706' }}>
                      📤 Đã khiếu nại
                    </span>
                  )}
                  {!receivedByShop && !sentByShop && <span style={{ fontSize: 12, color: 'var(--gray-300)' }}>—</span>}
                </td>
                <td style={{ fontSize: 13 }}>{formatDate(o.created_at)}</td>
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {o.order_status === 'pending' && (
                      <button onClick={() => handleConfirm(o.order_id)} className="btn btn-primary btn-sm">Xác nhận</button>
                    )}
                    {o.order_status === 'confirmed' && (
                      <button onClick={() => handleReadyToShip(o.order_id)} className="btn btn-outline btn-sm">Chuẩn bị xong</button>
                    )}
                    <button onClick={() => openDetail(o)} className="btn btn-sm"
                      style={{ background: '#F8FAFC', color: '#475569', border: '1px solid #E2E8F0' }}>
                      🔍 Chi tiết sản phẩm
                    </button>
                    {!['pending', 'cancelled'].includes(o.order_status) && (
                      <button onClick={() => setComplainOrder(o)} className="btn btn-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
                        ⚠️ Khiếu nại
                      </button>
                    )}
                  </div>
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
        {orders.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Không có đơn hàng</p>}
      </div>

      {/* Modal chi tiết sản phẩm */}
      {detailOrder && (() => {
        const o = detailOrder
        const d = dims[o.order_id] || { ...DEFAULT_DIMS }
        const isEditing = editingDims.has(o.order_id)
        const vol = calcVolume(d)
        const volW = calcVolWeight(d)
        const actualW = parseFloat(d.weight)
        const chargeW = volW ? Math.max(actualW || 0, parseFloat(volW)).toFixed(2) : (actualW ? actualW.toFixed(2) : null)

        // Mask helpers
        const maskPhone = (p: string) => p ? p.slice(0, 3) + ' *** ' + p.slice(-2) : '—'
        const maskAddr  = (a: string) => {
          if (!a) return '—'
          const parts = a.split(',')
          if (parts.length <= 2) return a.slice(0, 6) + '***' + (parts[parts.length - 1] ? ', ' + parts[parts.length - 1].trim() : '')
          return '***' + ', ' + parts.slice(-2).map(s => s.trim()).join(', ')
        }

        return (
          <div onClick={() => setDetailOrder(null)} style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div onClick={e => e.stopPropagation()} style={{
              background: '#fff', borderRadius: 16, width: 560, maxWidth: '95vw', maxHeight: '90vh',
              boxShadow: '0 24px 64px rgba(0,0,0,0.2)', overflow: 'hidden', display: 'flex', flexDirection: 'column',
            }}>
              {/* Header */}
              <div style={{ padding: '18px 24px', borderBottom: '1px solid #F1F5F9', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#FAFAFA', flexShrink: 0 }}>
                <div>
                  <p style={{ fontWeight: 800, fontSize: 16, margin: 0, color: '#0F172A' }}>Chi tiết sản phẩm</p>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{formatOrderId(o.order_id)} · {STATUS_LABEL[o.order_status] ?? o.order_status}</p>
                </div>
                <button onClick={() => setDetailOrder(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#94A3B8', lineHeight: 1 }}>✕</button>
              </div>

              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 20, overflowY: 'auto' }}>

                {/* Thông tin người mua */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Thông tin người mua</p>
                  <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 14 }}>👤</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{o.user_name || `Khách #${o.user_id}`}</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ fontSize: 14 }}>📞</span>
                      <span style={{ fontSize: 13, color: '#475569' }}>{maskPhone(o.phone || o.delivery_phone || '0912345678')}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4 }}>🔒 Đã ẩn</span>
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 14, flexShrink: 0 }}>📍</span>
                      <span style={{ fontSize: 13, color: '#475569' }}>{maskAddr(o.delivery_address || '123 Đường ABC, Phường XYZ, Quận 1, TP. HCM')}</span>
                      <span style={{ fontSize: 10, color: '#94A3B8', marginLeft: 4, flexShrink: 0 }}>🔒 Đã ẩn</span>
                    </div>
                  </div>
                </div>

                {/* Danh sách sản phẩm */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Sản phẩm trong đơn</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {(o.items || []).map((item: any, idx: number) => (
                      <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
                        <div>
                          <p style={{ fontWeight: 600, fontSize: 13, margin: 0 }}>{item.product_name}</p>
                          {item.variant_name && <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>Phân loại: {item.variant_name}</p>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: 'var(--primary)', margin: 0 }}>{formatCurrency(item.price * item.quantity)}</p>
                          <p style={{ fontSize: 11, color: '#94A3B8', margin: '2px 0 0' }}>x{item.quantity} · {formatCurrency(item.price)}/cái</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, paddingTop: 10, borderTop: '1px dashed #E2E8F0' }}>
                    <p style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)', margin: 0 }}>Tổng: {formatCurrency(o.final_price)}</p>
                  </div>
                </div>

                {/* Kích thước & cân nặng */}
                <div>
                  <p style={{ fontSize: 12, fontWeight: 700, color: '#64748B', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 }}>Kích thước & Cân nặng gói hàng</p>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
                    {([
                      { key: 'length', label: 'Dài', unit: 'cm' },
                      { key: 'width',  label: 'Rộng', unit: 'cm' },
                      { key: 'height', label: 'Cao',  unit: 'cm' },
                      { key: 'weight', label: 'Cân nặng', unit: 'kg' },
                    ] as { key: keyof Dimensions; label: string; unit: string }[]).map(f => (
                      <div key={f.key}>
                        <label style={{ fontSize: 11, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 4 }}>{f.label} ({f.unit})</label>
                        <div style={{ padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, fontWeight: 700, color: '#0F172A' }}>
                          {d[f.key] || '—'} <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8' }}>{f.unit}</span>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Kết quả tính toán */}
                  {(vol || chargeW) && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginTop: 12 }}>
                      {vol && (
                        <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                          <p style={{ fontSize: 11, color: '#3B82F6', fontWeight: 600, margin: 0 }}>Thể tích</p>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#1D4ED8', margin: '4px 0 0' }}>{vol}</p>
                          <p style={{ fontSize: 10, color: '#93C5FD', margin: 0 }}>dm³</p>
                        </div>
                      )}
                      {volW && (
                        <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                          <p style={{ fontSize: 11, color: '#16A34A', fontWeight: 600, margin: 0 }}>Cân thể tích</p>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#15803D', margin: '4px 0 0' }}>{volW}</p>
                          <p style={{ fontSize: 10, color: '#86EFAC', margin: 0 }}>kg</p>
                        </div>
                      )}
                      {chargeW && (
                        <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 10, padding: '10px 14px', textAlign: 'center' }}>
                          <p style={{ fontSize: 11, color: '#EA580C', fontWeight: 600, margin: 0 }}>Cân tính phí</p>
                          <p style={{ fontSize: 18, fontWeight: 800, color: '#C2410C', margin: '4px 0 0' }}>{chargeW}</p>
                          <p style={{ fontSize: 10, color: '#FDBA74', margin: 0 }}>kg · max(thực/thể tích)</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid #F1F5F9', display: 'flex', justifyContent: 'flex-end' }}>
                <button onClick={() => setDetailOrder(null)} className="btn btn-outline btn-sm">Đóng</button>
              </div>
            </div>
          </div>
        )
      })()}

      {complainOrder && user && (
        <DisputeFormModal
          open={!!complainOrder}
          onClose={() => setComplainOrder(null)}
          orderId={complainOrder.order_id}
          complainantType="shop"
          complainantId={user.user_id}
          complainantName={user.full_name || user.email}
          targetOptions={[
            { type: 'user', id: complainOrder.user_id, name: `Khách #${complainOrder.user_id}` },
            ...(complainOrder.shipper_id ? [{ type: 'shipper' as const, id: complainOrder.shipper_id, name: `Shipper #${complainOrder.shipper_id}` }] : []),
          ]}
        />
      )}
    </div>
  )
}

export default OrderManagement
