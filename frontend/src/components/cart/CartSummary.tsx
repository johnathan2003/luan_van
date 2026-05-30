import React from 'react'
import { useNavigate } from 'react-router-dom'
import { formatCurrency } from '../../utils/formatters'

interface Props { total: number; itemCount: number; discount?: number }

const CartSummary: React.FC<Props> = ({ total, itemCount, discount = 0 }) => {
  const navigate = useNavigate()
  const finalTotal = Math.max(0, total - discount)

  return (
    <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
      <h3 style={{ fontWeight: 700, marginBottom: 16, fontSize: 16 }}>Tóm tắt đơn hàng</h3>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
        <span style={{ color: 'var(--gray-600)' }}>Tổng ({itemCount} sản phẩm)</span>
        <span>{formatCurrency(total)}</span>
      </div>
      {discount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
          <span style={{ color: 'var(--gray-600)' }}>Giảm giá</span>
          <span style={{ color: 'var(--success)' }}>−{formatCurrency(discount)}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 14 }}>
        <span style={{ color: 'var(--gray-600)' }}>Phí giao hàng</span>
        <span style={{ color: 'var(--success)' }}>Miễn phí</span>
      </div>
      <div style={{ height: 1, background: 'var(--gray-200)', margin: '12px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, fontWeight: 700, fontSize: 16 }}>
        <span>Tổng cộng</span>
        <span style={{ color: 'var(--primary)' }}>{formatCurrency(finalTotal)}</span>
      </div>
      <button onClick={() => navigate('/checkout')} className="btn btn-primary w-full btn-lg">
        Tiến hành thanh toán →
      </button>
    </div>
  )
}

export default CartSummary
