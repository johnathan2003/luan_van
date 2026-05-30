import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { shopService } from '../../services/shopService'
import { orderService } from '../../services/orderService'
import { formatCurrency, formatDate, formatOrderId } from '../../utils/formatters'
import StatusBadge from '../order/StatusBadge'
import Loading from '../common/Loading'

const OrderManagement: React.FC = () => {
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')

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
        {['', 'pending', 'confirmed', 'ready_to_ship', 'shipping', 'completed', 'cancelled'].map(s => (
          <button key={s} onClick={() => setFilter(s)} className={`btn btn-sm ${filter === s ? 'btn-primary' : 'btn-outline'}`}>
            {s === '' ? 'Tất cả' : s === 'pending' ? 'Chờ xác nhận' : s === 'confirmed' ? 'Đã xác nhận' : s === 'ready_to_ship' ? 'Chuẩn bị giao' : s === 'shipping' ? 'Đang giao' : s === 'completed' ? 'Hoàn thành' : 'Đã hủy'}
          </button>
        ))}
      </div>

      <div className="card table-wrapper">
        <table>
          <thead>
            <tr><th>Mã đơn</th><th>Sản phẩm</th><th>Tổng tiền</th><th>Thanh toán</th><th>Trạng thái</th><th>Ngày đặt</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {orders.map(o => (
              <tr key={o.order_id}>
                <td style={{ fontWeight: 600 }}>{formatOrderId(o.order_id)}</td>
                <td style={{ fontSize: 13 }}>{o.items?.map((i: any) => `${i.product_name} x${i.quantity}`).join(', ')}</td>
                <td style={{ fontWeight: 700, color: 'var(--primary)' }}>{formatCurrency(o.final_price)}</td>
                <td><span style={{ fontSize: 12 }}>{o.payment_method.toUpperCase()} · {o.payment_status === 'paid' ? '✅ Đã TT' : '⏳ Chờ TT'}</span></td>
                <td><StatusBadge status={o.order_status} /></td>
                <td style={{ fontSize: 13 }}>{formatDate(o.created_at)}</td>
                <td>
                  {o.order_status === 'pending' && (
                    <button onClick={() => handleConfirm(o.order_id)} className="btn btn-primary btn-sm">Xác nhận</button>
                  )}
                  {o.order_status === 'confirmed' && (
                    <button onClick={() => handleReadyToShip(o.order_id)} className="btn btn-outline btn-sm">Chuẩn bị xong</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {orders.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Không có đơn hàng</p>}
      </div>
    </div>
  )
}

export default OrderManagement
