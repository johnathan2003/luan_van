import React from 'react'
import { Link } from 'react-router-dom'
import type { Order } from '../../types/order'
import StatusBadge from './StatusBadge'
import { formatCurrency, formatDate, formatOrderId } from '../../utils/formatters'

interface Props { order: Order; onCancel?: (id: number) => void; onConfirmReceived?: (id: number) => void }

const OrderCard: React.FC<Props> = ({ order, onCancel, onConfirmReceived }) => (
  <div className="card" style={{ padding: 20, marginBottom: 12 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
      <div>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>{formatOrderId(order.order_id)}</span>
        <span style={{ marginLeft: 12 }}><StatusBadge status={order.order_status} /></span>
      </div>
      <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>{formatDate(order.created_at)}</span>
    </div>
    <div style={{ borderTop: '1px solid var(--gray-100)', paddingTop: 12, marginBottom: 12 }}>
      {order.items?.slice(0, 2).map(item => (
        <div key={item.order_item_id} style={{ display: 'flex', gap: 10, marginBottom: 8, alignItems: 'center' }}>
          {item.product_image && (
            <img src={item.product_image} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
          )}
          <div>
            <p style={{ fontSize: 14, fontWeight: 500 }}>{item.product_name}</p>
            <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>x{item.quantity} · {formatCurrency(item.price_at_order)}</p>
          </div>
        </div>
      ))}
      {(order.items?.length || 0) > 2 && (
        <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>+{order.items.length - 2} sản phẩm khác</p>
      )}
    </div>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--primary)' }}>
        Tổng: {formatCurrency(order.final_price)}
      </span>
      <div style={{ display: 'flex', gap: 8 }}>
        <Link to={`/orders/${order.order_id}`} className="btn btn-outline btn-sm">Xem chi tiết</Link>
        {order.order_status === 'pending' && onCancel && (
          <button onClick={() => onCancel(order.order_id)} className="btn btn-danger btn-sm">Hủy đơn</button>
        )}
        {order.order_status === 'delivered' && onConfirmReceived && (
          <button onClick={() => onConfirmReceived(order.order_id)} className="btn btn-primary btn-sm">Đã nhận hàng</button>
        )}
      </div>
    </div>
  </div>
)

export default OrderCard
