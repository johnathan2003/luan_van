import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import Loading from '../../components/common/Loading'
import StatusBadge from '../../components/order/StatusBadge'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchOrderById } from '../../store/slices/orderSlice'
import { formatCurrency, formatDate, formatOrderId } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import { PAYMENT_METHOD_LABELS } from '../../utils/constants'
import { findMockOrder, isMockOrderId } from '../../mocks/mockOrders'
import ItemReviewBox from '../../components/order/ItemReviewBox'
import ShipperReviewBox from '../../components/order/ShipperReviewBox'

const OrderDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const dispatch = useAppDispatch()
  const { selectedOrder: realOrder, loading } = useAppSelector(s => s.order)
  const [waited, setWaited] = useState(false)

  const numId = Number(id)
  const mockOrder = isMockOrderId(numId) ? findMockOrder(numId) : undefined

  useEffect(() => {
    if (!id || mockOrder) return
    dispatch(fetchOrderById(numId))
    // fetchOrderById khong co trang thai pending/rejected rieng -> doi 1 chut
    // truoc khi ket luan "khong tim thay" de tranh nhay UI, rieng cho don demo
    const t = setTimeout(() => setWaited(true), 500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, dispatch])

  const order = mockOrder || realOrder

  if (!mockOrder && loading) return (<Loading />)
  if (!order) {
    if (!waited && !mockOrder) return (<Loading />)
    return (<div className="container" style={{ padding: 40 }}>Không tìm thấy đơn hàng</div>)
  }

  const steps = ['pending', 'confirmed', 'ready_to_ship', 'shipping', 'delivered', 'completed']
  const stepLabels = ['Đặt hàng', 'Xác nhận', 'Chuẩn bị', 'Đang giao', 'Đã giao', 'Hoàn thành']
  const currentStep = steps.indexOf(order.order_status)

  return (
    <div className="page-wrapper">
      
      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 22 }}>Đơn hàng {formatOrderId(order.order_id)}</h1>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>{formatDate(order.created_at)}</p>
          </div>
          <StatusBadge status={order.order_status} />
        </div>

        {/* Progress bar */}
        {order.order_status !== 'cancelled' && (
          <div className="card" style={{ padding: 24, marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 16, left: '10%', right: '10%', height: 3, background: 'var(--gray-200)', zIndex: 0 }}>
                <div style={{ height: '100%', background: 'var(--primary)', width: `${Math.min(100, (currentStep / (steps.length - 1)) * 100)}%`, transition: 'width 0.5s ease' }} />
              </div>
              {steps.map((s, i) => (
                <div key={s} style={{ textAlign: 'center', zIndex: 1, flex: 1 }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', margin: '0 auto 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 13, background: i <= currentStep ? 'var(--primary)' : 'var(--gray-200)', color: i <= currentStep ? 'white' : 'var(--gray-400)' }}>
                    {i < currentStep ? '✓' : i + 1}
                  </div>
                  <p style={{ fontSize: 11, color: i <= currentStep ? 'var(--primary)' : 'var(--gray-400)', fontWeight: i === currentStep ? 700 : 400 }}>{stepLabels[i]}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20 }}>
          {/* Items */}
          <div>
            <div className="card" style={{ padding: 24, marginBottom: 16 }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Sản phẩm</h2>
              {order.items.map(item => (
                <div key={item.order_item_id} style={{ padding: '12px 0', borderBottom: '1px solid var(--gray-100)' }}>
                  <div style={{ display: 'flex', gap: 14 }}>
                    <img src={getImageUrl(item.product_image)} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
                    <div style={{ flex: 1 }}>
                      <p style={{ fontWeight: 500, marginBottom: 4 }}>{item.product_name}</p>
                      <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>x{item.quantity} · {formatCurrency(item.price_at_order)}/cái</p>
                    </div>
                    <p style={{ fontWeight: 700 }}>{formatCurrency(parseFloat(item.price_at_order) * item.quantity)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Shipping info */}
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>Thông tin giao hàng</h2>
              <p style={{ fontSize: 14, marginBottom: 6 }}>👤 {order.recipient_name || '—'}</p>
              <p style={{ fontSize: 14, marginBottom: 6 }}>📞 {order.recipient_phone || '—'}</p>
              <p style={{ fontSize: 14, marginBottom: 6 }}>📍 {order.shipping_address}</p>
              {order.note && <p style={{ fontSize: 14, color: 'var(--gray-500)' }}>📝 {order.note}</p>}
            </div>
          </div>

          {/* Summary */}
          <div>
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16 }}>Tóm tắt</h2>
              {[
                { label: 'Tạm tính', value: formatCurrency(order.total_price) },
                { label: 'Giảm giá', value: `−${formatCurrency(order.discount)}` },
                { label: 'Phí giao hàng', value: 'Miễn phí' },
              ].map(r => (
                <div key={r.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10, fontSize: 14 }}>
                  <span style={{ color: 'var(--gray-600)' }}>{r.label}</span>
                  <span>{r.value}</span>
                </div>
              ))}
              <div style={{ height: 1, background: 'var(--gray-200)', margin: '12px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17 }}>
                <span>Tổng cộng</span>
                <span style={{ color: 'var(--primary)' }}>{formatCurrency(order.final_price)}</span>
              </div>
              <div style={{ height: 1, background: 'var(--gray-200)', margin: '12px 0' }} />
              <div style={{ fontSize: 14, color: 'var(--gray-600)' }}>
                <p>💳 {PAYMENT_METHOD_LABELS[order.payment_method]}</p>
                <p style={{ marginTop: 4 }}>Trạng thái: {order.payment_status === 'paid' ? '✅ Đã thanh toán' : '⏳ Chưa thanh toán'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Danh gia - gop chung danh gia san pham va danh gia nguoi giao hang, rong full chieu ngang */}
        {(order.order_status === 'delivered' || order.order_status === 'completed') && (
          <div className="card" style={{ padding: 24, marginTop: 20 }}>
            <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>Đánh giá</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>Chia sẻ trải nghiệm của bạn về sản phẩm và người giao hàng</p>

            {order.items.map(item => (
              <div key={item.order_item_id} style={{ paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--gray-100)' }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                  <img src={getImageUrl(item.product_image)} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
                  <p style={{ fontWeight: 500, fontSize: 14 }}>{item.product_name}</p>
                </div>
                <ItemReviewBox orderItemId={item.order_item_id} productName={item.product_name} />
              </div>
            ))}

            {(order.shipment || order.shipper_id) && (
              <ShipperReviewBox orderId={order.order_id} shipperId={order.shipper_id || order.shipment?.shipper_id} />
            )}
          </div>
        )}
      </div>

    </div>
  )
}

export default OrderDetailPage
