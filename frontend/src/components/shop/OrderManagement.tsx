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

const OrderManagement: React.FC = () => {
  const { user } = useAppSelector(s => s.auth)
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [complainOrder, setComplainOrder] = useState<any | null>(null)

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
                  {o.order_status === 'pending' && (
                    <button onClick={() => handleConfirm(o.order_id)} className="btn btn-primary btn-sm">Xác nhận</button>
                  )}
                  {o.order_status === 'confirmed' && (
                    <button onClick={() => handleReadyToShip(o.order_id)} className="btn btn-outline btn-sm">Chuẩn bị xong</button>
                  )}
                  {!['pending', 'cancelled'].includes(o.order_status) && (
                    <button onClick={() => setComplainOrder(o)} className="btn btn-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca', marginLeft: 6 }}>
                      ⚠️ Khiếu nại
                    </button>
                  )}
                </td>
              </tr>
              )
            })}
          </tbody>
        </table>
        {orders.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Không có đơn hàng</p>}
      </div>

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
