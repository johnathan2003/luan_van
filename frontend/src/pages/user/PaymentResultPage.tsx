import React, { useEffect, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'

const PaymentResultPage: React.FC = () => {
  const [params] = useSearchParams()
  const [status, setStatus] = useState<'success' | 'fail' | 'pending'>('pending')

  useEffect(() => {
    const resultCode = params.get('resultCode') || params.get('vnp_ResponseCode')
    if (resultCode === '0' || resultCode === '00') setStatus('success')
    else if (resultCode) setStatus('fail')
    else {
      const msg = params.get('message') || ''
      setStatus(msg.toLowerCase().includes('success') ? 'success' : 'fail')
    }
  }, [params])

  const orderId = params.get('orderId')?.split('_')[1] || params.get('vnp_TxnRef')?.split('_')[0]

  return (
    <div className="page-wrapper">

      <div className="container" style={{ paddingTop: 60, paddingBottom: 60, textAlign: 'center' }}>
        {status === 'pending' ? (
          <div><div className="spinner" style={{ margin: '0 auto 20px' }} /><p>Đang kiểm tra...</p></div>
        ) : status === 'success' ? (
          <div>
            <div style={{ fontSize: 72, marginBottom: 20 }}>✅</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--success)', marginBottom: 12 }}>Thanh toán thành công!</h1>
            <p style={{ color: 'var(--gray-600)', marginBottom: 32, fontSize: 16 }}>Đơn hàng của bạn đã được xác nhận và đang được xử lý.</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              {orderId && <Link to={`/orders/${orderId}`} className="btn btn-primary btn-lg">Xem đơn hàng</Link>}
              <Link to="/" className="btn btn-outline btn-lg">Tiếp tục mua sắm</Link>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 72, marginBottom: 20 }}>❌</div>
            <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--error)', marginBottom: 12 }}>Thanh toán thất bại</h1>
            <p style={{ color: 'var(--gray-600)', marginBottom: 32, fontSize: 16 }}>Đã xảy ra lỗi. Vui lòng thử lại hoặc chọn phương thức khác.</p>
            <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
              <Link to="/cart" className="btn btn-primary btn-lg">Thử lại</Link>
              <Link to="/orders" className="btn btn-outline btn-lg">Xem đơn hàng</Link>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}

export default PaymentResultPage
