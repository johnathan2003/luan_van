import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import Navbar from '../../components/common/Navbar'
import Footer from '../../components/common/Footer'
import { useCart } from '../../hooks/useCart'
import { useAuth } from '../../hooks/useAuth'
import { orderService } from '../../services/orderService'
import { formatCurrency } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import { PAYMENT_METHOD_LABELS } from '../../utils/constants'

const CheckoutPage: React.FC = () => {
  const { cart } = useCart()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [form, setForm] = useState({ shipping_address: user?.address || '', recipient_name: user?.full_name || '', recipient_phone: user?.phone || '', payment_method: 'cod', voucher_code: '', note: '' })
  const [loading, setLoading] = useState(false)

  const handlePlaceOrder = async () => {
    if (!form.shipping_address) { toast.warning('Vui lòng nhập địa chỉ nhận hàng'); return }
    setLoading(true)
    try {
      const res = await orderService.create({
        items: cart.items.map(i => ({ product_id: i.product_id, quantity: i.quantity })),
        ...form,
        payment_method: form.payment_method as any,
      })
      if (res.data.payment_url) {
        window.location.href = res.data.payment_url
      } else {
        toast.success('Đặt hàng thành công!')
        navigate(`/orders/${res.data.order_id}`)
      }
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Đặt hàng thất bại')
    } finally { setLoading(false) }
  }

  if (cart.items.length === 0) { navigate('/cart'); return null }

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 28 }}>Thanh toán</h1>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 24, alignItems: 'start' }}>
          {/* Left: form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Shipping info */}
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>📍 Thông tin giao hàng</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  { label: 'Người nhận', key: 'recipient_name', type: 'text', placeholder: 'Họ tên người nhận' },
                  { label: 'Số điện thoại', key: 'recipient_phone', type: 'tel', placeholder: '0909...' },
                  { label: 'Địa chỉ giao hàng', key: 'shipping_address', type: 'text', placeholder: 'Số nhà, đường, phường, quận, TP' },
                  { label: 'Ghi chú', key: 'note', type: 'text', placeholder: 'Ghi chú cho shipper...' },
                ].map(({ label, key, type, placeholder }) => (
                  <div key={key}>
                    <label className="input-label">{label}</label>
                    <input className="input" type={type} placeholder={placeholder} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
                  </div>
                ))}
              </div>
            </div>

            {/* Payment method */}
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>💳 Phương thức thanh toán</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {[['cod', '💵'], ['momo', '💜'], ['vnpay', '🏦']].map(([method, icon]) => (
                  <label key={method} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, border: `1.5px solid ${form.payment_method === method ? 'var(--primary)' : 'var(--gray-200)'}`, borderRadius: 'var(--radius)', cursor: 'pointer', background: form.payment_method === method ? '#fff0ed' : 'white' }}>
                    <input type="radio" name="payment" value={method} checked={form.payment_method === method} onChange={() => setForm(f => ({ ...f, payment_method: method }))} />
                    <span style={{ fontSize: 20 }}>{icon}</span>
                    <span style={{ fontWeight: 500, fontSize: 14 }}>{PAYMENT_METHOD_LABELS[method]}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Voucher */}
            <div className="card" style={{ padding: 24 }}>
              <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>🎫 Mã giảm giá</h2>
              <div style={{ display: 'flex', gap: 10 }}>
                <input className="input" placeholder="Nhập mã voucher..." value={form.voucher_code} onChange={e => setForm(f => ({ ...f, voucher_code: e.target.value }))} />
                <button className="btn btn-outline">Áp dụng</button>
              </div>
            </div>
          </div>

          {/* Right: order summary */}
          <div className="card" style={{ padding: 24, position: 'sticky', top: 80 }}>
            <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 16 }}>📋 Đơn hàng</h2>
            <div style={{ maxHeight: 300, overflowY: 'auto', marginBottom: 16 }}>
              {cart.items.map(item => (
                <div key={item.cart_id} style={{ display: 'flex', gap: 10, marginBottom: 12, alignItems: 'center' }}>
                  <img src={getImageUrl(item.product_image)} alt="" style={{ width: 48, height: 48, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 500, marginBottom: 2 }}>{item.product_name}</p>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)' }}>x{item.quantity} · {formatCurrency(item.price)}</p>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{formatCurrency(parseFloat(item.price) * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div style={{ height: 1, background: 'var(--gray-200)', marginBottom: 14 }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
              <span style={{ color: 'var(--gray-600)' }}>Tạm tính</span>
              <span>{formatCurrency(cart.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
              <span style={{ color: 'var(--gray-600)' }}>Phí vận chuyển</span>
              <span style={{ color: 'var(--success)' }}>Miễn phí</span>
            </div>
            <div style={{ height: 1, background: 'var(--gray-200)', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, fontSize: 17, marginBottom: 20 }}>
              <span>Tổng cộng</span>
              <span style={{ color: 'var(--primary)' }}>{formatCurrency(cart.total)}</span>
            </div>
            <button onClick={handlePlaceOrder} disabled={loading} className="btn btn-primary btn-lg w-full">
              {loading ? 'Đang xử lý...' : form.payment_method === 'cod' ? '✓ Đặt hàng' : '→ Thanh toán'}
            </button>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default CheckoutPage
