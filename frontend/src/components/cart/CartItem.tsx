import React from 'react'
import type { CartItem as CartItemType } from '../../types/order'
import { formatCurrency } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import { useCart } from '../../hooks/useCart'

interface Props { item: CartItemType }

const CartItem: React.FC<Props> = ({ item }) => {
  const { update, remove } = useCart()

  return (
    <div style={{ display: 'flex', gap: 16, padding: '16px 0', borderBottom: '1px solid var(--gray-100)', alignItems: 'center' }}>
      <img src={getImageUrl(item.product_image)} alt={item.product_name} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 'var(--radius)' }} />
      <div style={{ flex: 1 }}>
        <p style={{ fontWeight: 500, marginBottom: 4 }}>{item.product_name}</p>
        <p style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: 8 }}>{formatCurrency(item.price)}</p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button onClick={() => item.quantity > 1 ? update(item.cart_id, item.quantity - 1) : remove(item.cart_id)}
            style={{ width: 28, height: 28, border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', background: 'none', cursor: 'pointer', fontSize: 16 }}>−</button>
          <span style={{ minWidth: 32, textAlign: 'center', fontWeight: 600 }}>{item.quantity}</span>
          <button onClick={() => update(item.cart_id, item.quantity + 1)}
            style={{ width: 28, height: 28, border: '1.5px solid var(--gray-200)', borderRadius: 'var(--radius)', background: 'none', cursor: 'pointer', fontSize: 16 }}>+</button>
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: 8 }}>
          {formatCurrency(parseFloat(item.price) * item.quantity)}
        </p>
        <button onClick={() => remove(item.cart_id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 13 }}>🗑 Xóa</button>
      </div>
    </div>
  )
}

export default CartItem
