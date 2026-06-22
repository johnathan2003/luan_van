import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import OrderCard from '../../components/order/OrderCard'
import Loading from '../../components/common/Loading'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchOrders } from '../../store/slices/orderSlice'
import { orderService } from '../../services/orderService'
import { MOCK_ORDERS } from '../../mocks/mockOrders'
import SuggestedDealsSection from '../../components/common/SuggestedDealsSection'
import DisputeFormModal, { DisputeTargetOption } from '../../components/dispute/DisputeFormModal'
import type { Order } from '../../types/order'

const TABS = [
  { key: '', label: 'Tất cả' },
  { key: 'pending', label: 'Chờ xác nhận' },
  { key: 'confirmed', label: 'Đã xác nhận' },
  { key: 'shipping', label: 'Đang giao' },
  { key: 'completed', label: 'Hoàn thành' },
  { key: 'cancelled', label: 'Đã hủy' },
  { key: 'returned', label: 'Khiếu nại' },
]

const OrderHistoryPage: React.FC = () => {
  const dispatch = useAppDispatch()
  const { orders, loading } = useAppSelector(s => s.order)
  const { user } = useAppSelector(s => s.auth)
  const [tab, setTab] = useState('')
  const [complainOrder, setComplainOrder] = useState<Order | null>(null)

  useEffect(() => { dispatch(fetchOrders({ order_status: tab || undefined })) }, [tab, dispatch])

  // Khi chua co don hang thuc (backend rong hoac chua dang nhap that), dung du lieu demo de test UI theo doi don hang
  const showDemo = !loading && orders.length === 0
  const demoOrders = tab ? MOCK_ORDERS.filter(o => o.order_status === tab) : MOCK_ORDERS
  const displayOrders = showDemo ? demoOrders : orders

  const handleCancel = async (id: number) => {
    if (!confirm('Hủy đơn hàng này?')) return
    try { await orderService.cancel(id); toast.success('Đã hủy đơn'); dispatch(fetchOrders({ order_status: tab || undefined })) }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Không thể hủy') }
  }

  const handleConfirmReceived = async (id: number) => {
    try { await orderService.confirmReceived(id); toast.success('Đã xác nhận nhận hàng!'); dispatch(fetchOrders({})) }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi') }
  }

  return (
    <div className="page-wrapper">

      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
        <h1 style={{ fontWeight: 700, fontSize: 24, marginBottom: 24 }}>Đơn hàng của tôi</h1>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gray-200)', marginBottom: 24, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)} style={{ padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: tab === t.key ? 700 : 400, color: tab === t.key ? 'var(--primary)' : 'var(--gray-600)', borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -2, whiteSpace: 'nowrap', fontSize: 14 }}>
              {t.label}
            </button>
          ))}
        </div>
        {showDemo && (
          <div style={{ background: 'var(--bg-highlight, #fff7ed)', border: '1px solid #fed7aa', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#b45309' }}>
            ⚠️ Chưa có đơn hàng thực — đang hiển thị <strong>dữ liệu demo</strong> để xem thử giao diện theo dõi hành trình đơn hàng.
          </div>
        )}
        {loading ? <Loading /> : displayOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gray-400)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>📦</div>
            <p>Không có đơn hàng nào</p>
          </div>
        ) : (
          displayOrders.map(o => <OrderCard key={o.order_id} order={o} onCancel={showDemo ? undefined : handleCancel} onConfirmReceived={showDemo ? undefined : handleConfirmReceived} onComplain={setComplainOrder} />)
        )}

        <SuggestedDealsSection />
      </div>

      {complainOrder && user && (
        <DisputeFormModal
          open={!!complainOrder}
          onClose={() => setComplainOrder(null)}
          orderId={complainOrder.order_id}
          complainantType="user"
          complainantId={user.user_id}
          complainantName={user.full_name || user.email}
          targetOptions={[
            { type: 'shop', id: complainOrder.shop_id, name: complainOrder.shop_id ? `Shop #${complainOrder.shop_id}` : 'Shop bán hàng' },
            ...(complainOrder.shipper_id ? [{ type: 'shipper', id: complainOrder.shipper_id, name: `Shipper #${complainOrder.shipper_id}` } as DisputeTargetOption] : []),
          ]}
        />
      )}

    </div>
  )
}

export default OrderHistoryPage
