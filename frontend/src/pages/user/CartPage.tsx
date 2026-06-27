import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatCurrency } from '../../utils/formatters'
import { voucherService } from '../../services/voucherService'
import SuggestedDealsSection from '../../components/common/SuggestedDealsSection'
import { useAppDispatch, useAppSelector } from '../../store/hooks'
import { fetchCart, updateCartItem, removeFromCart } from '../../store/slices/cartSlice'
import type { CartItem } from '../../types/order'

// ─── Voucher helpers ───────────────────────────────────────────────────────────
import type { VoucherLite } from '../../types/voucher'

const isVoucherEligible = (v: VoucherLite, subtotal: number) => {
  if (subtotal <= 0 || v.status !== 'active') return false
  if (v.valid_to && new Date(v.valid_to) < new Date()) return false
  if (v.max_uses != null && v.current_uses >= v.max_uses) return false
  if (v.min_order_value && subtotal < Number(v.min_order_value)) return false
  return true
}

const voucherDiscountAmount = (v: VoucherLite, subtotal: number) => {
  if (v.discount_type === 'percentage') {
    let d = subtotal * (Number(v.discount_value) / 100)
    if (v.max_discount) d = Math.min(d, Number(v.max_discount))
    return Math.round(d)
  }
  return Math.min(Number(v.discount_value), subtotal)
}

const pickBestVoucher = (vouchers: VoucherLite[], subtotal: number) => {
  const eligible = vouchers.filter(v => isVoucherEligible(v, subtotal))
  if (!eligible.length) return null
  return eligible.map(v => ({ voucher: v, amount: voucherDiscountAmount(v, subtotal) }))
    .sort((a, b) => b.amount - a.amount)[0]
}

// ─── Item helpers ──────────────────────────────────────────────────────────────
const stock = (i: CartItem) => i.stock_quantity ?? 9999
const isOutOfStock = (i: CartItem) => stock(i) === 0
const isOverStock  = (i: CartItem) => stock(i) > 0 && i.quantity > stock(i)
const isLowStock   = (i: CartItem) => stock(i) > 0 && stock(i) <= 5 && !isOverStock(i)
const canBuy       = (i: CartItem) => !isOutOfStock(i)
const effectiveQty = (i: CartItem) => isOverStock(i) ? stock(i) : i.quantity
const itemPrice    = (i: CartItem) => Number(i.price) * effectiveQty(i)

// ─── SVG Icons ─────────────────────────────────────────────────────────────────
const ITrash = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/></svg>
const IWarn  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29,3.86L1.82,18a2,2,0,0,0,1.71,3H20.47A2,2,0,0,0,22.18,18L13.71,3.86A2,2,0,0,0,10.29,3.86Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
const ITruck = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>

// ─── Stock badge ───────────────────────────────────────────────────────────────
const StockBadge: React.FC<{ item: CartItem }> = ({ item }) => {
  if (isOutOfStock(item)) return (
    <span style={{ fontSize: 11, fontWeight: 700, background: '#FEE2E2', color: '#DC2626', padding: '3px 8px', borderRadius: 20 }}>
      🚫 Het hang
    </span>
  )
  if (isOverStock(item)) return (
    <span style={{ fontSize: 11, fontWeight: 700, background: '#FEF3C7', color: '#D97706', padding: '3px 8px', borderRadius: 20 }}>
      ⚠️ Chi con {stock(item)} san pham
    </span>
  )
  if (isLowStock(item)) return (
    <span style={{ fontSize: 11, fontWeight: 600, background: '#FFF7ED', color: '#EA580C', padding: '3px 8px', borderRadius: 20 }}>
      🔥 Sap het ({stock(item)} con lai)
    </span>
  )
  return <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 500 }}>✓ Con hang</span>
}

// ─── Main ──────────────────────────────────────────────────────────────────────
const CartPage: React.FC = () => {
  const navigate  = useNavigate()
  const dispatch  = useAppDispatch()
  const { cart, loading } = useAppSelector(s => s.cart)
  const items = cart.items

  const [selected, setSelected]         = useState<Set<number>>(new Set())
  const [myVouchers, setMyVouchers]     = useState<VoucherLite[]>([])
  const [vouchersLoading, setVLoding]   = useState(true)

  // Tải giỏ hàng khi mount
  useEffect(() => { dispatch(fetchCart()) }, [dispatch])

  // Tự chọn tất cả sản phẩm có thể mua khi danh sách tải xong
  useEffect(() => {
    setSelected(new Set(items.filter(canBuy).map(i => i.cart_id)))
  }, [items.length])

  useEffect(() => {
    voucherService.getMyVouchers()
      .then(res => setMyVouchers(res.data.vouchers || []))
      .catch(() => {})
      .finally(() => setVLoding(false))
  }, [])

  // ── Selection ──────────────────────────────────────────────────────────────
  const buyableIds      = items.filter(canBuy).map(i => i.cart_id)
  const selectedBuyable = [...selected].filter(id => buyableIds.includes(id))

  const toggleItem = (item: CartItem) => {
    if (isOutOfStock(item)) return
    setSelected(prev => {
      const s = new Set(prev)
      s.has(item.cart_id) ? s.delete(item.cart_id) : s.add(item.cart_id)
      return s
    })
  }

  const shopIds   = [...new Set(items.map(i => i.shop_id ?? 0))]
  const shopItems = (sid: number) => items.filter(i => (i.shop_id ?? 0) === sid)

  const shopAllSelected = (sid: number) =>
    shopItems(sid).filter(canBuy).every(i => selected.has(i.cart_id)) && shopItems(sid).some(canBuy)

  const toggleShop = (sid: number) => {
    const ids = shopItems(sid).filter(canBuy).map(i => i.cart_id)
    const allOn = ids.every(id => selected.has(id))
    setSelected(prev => {
      const s = new Set(prev)
      allOn ? ids.forEach(id => s.delete(id)) : ids.forEach(id => s.add(id))
      return s
    })
  }

  const allBuyableSelected = buyableIds.every(id => selected.has(id)) && buyableIds.length > 0
  const toggleAll = () => setSelected(allBuyableSelected ? new Set() : new Set(buyableIds))

  // ── Mutations ──────────────────────────────────────────────────────────────
  const handleRemove = (cart_id: number) => {
    dispatch(removeFromCart(cart_id))
    setSelected(prev => { const s = new Set(prev); s.delete(cart_id); return s })
  }

  const handleRemoveSelected = () => {
    selectedBuyable.forEach(id => dispatch(removeFromCart(id)))
    setSelected(new Set())
  }

  const handleRemoveOutOfStock = () => {
    items.filter(i => !canBuy(i)).forEach(i => dispatch(removeFromCart(i.cart_id)))
  }

  const handleChangeQty = (item: CartItem, delta: number) => {
    const newQty = Math.max(1, Math.min(stock(item), item.quantity + delta))
    if (newQty !== item.quantity) {
      dispatch(updateCartItem({ cart_id: item.cart_id, quantity: newQty }))
    }
  }

  // ── Tính toán ──────────────────────────────────────────────────────────────
  const selItems   = items.filter(i => selectedBuyable.includes(i.cart_id))
  const subtotal   = selItems.reduce((s, i) => s + itemPrice(i), 0)
  const shipping   = subtotal >= 500000 || selItems.length === 0 ? 0 : 30000

  const platformBest = pickBestVoucher(myVouchers.filter(v => v.source === 'platform'), subtotal)
  const shopBests = shopIds.map(sid => {
    const info = items.find(i => (i.shop_id ?? 0) === sid)
    const sSubtotal = shopItems(sid).filter(i => selectedBuyable.includes(i.cart_id)).reduce((s, i) => s + itemPrice(i), 0)
    const best = pickBestVoucher(myVouchers.filter(v => v.source === 'shop' && v.shop_name === (info?.shop_name ?? '')), sSubtotal)
    return best ? { sid, shopName: info?.shop_name ?? '', ...best } : null
  }).filter((x): x is { sid: number; shopName: string; voucher: VoucherLite; amount: number } => x !== null)

  const discount   = (platformBest?.amount || 0) + shopBests.reduce((s, x) => s + x.amount, 0)
  const grandTotal = subtotal - discount + shipping

  const outOfStock = items.filter(i => !canBuy(i))

  // ── Checkout ───────────────────────────────────────────────────────────────
  const handleCheckout = () => {
    const checkoutItems = selItems.map(i => ({
      cart_id: i.cart_id,
      product_id: i.product_id,
      product_name: i.product_name,
      product_image: i.product_image,
      price: Number(i.price),
      quantity: effectiveQty(i),
      shop_id: i.shop_id,
      shop_name: i.shop_name,
    }))
    navigate('/checkout', { state: { cartItems: checkoutItems } })
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!loading && items.length === 0) return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 60, paddingBottom: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>🛒</div>
        <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 8, color: 'var(--text-primary)' }}>Gio hang trong</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>Them san pham vao gio de tiep tuc mua sam</p>
        <Link to="/products" className="btn btn-primary btn-lg">Kham pha san pham</Link>
        <div style={{ textAlign: 'left', marginTop: 32 }}><SuggestedDealsSection /></div>
      </div>
    </div>
  )

  return (
    <div className="page-wrapper" style={{ background: 'var(--bg-page)' }}>
      <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
            Gio hang
            {loading
              ? <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 10 }}>Dang tai...</span>
              : <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 8 }}>({items.length} san pham)</span>
            }
          </h1>
          <Link to="/products" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
            + Tiep tuc mua sam
          </Link>
        </div>

        {/* Banner hết hàng */}
        {outOfStock.length > 0 && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10,
            padding: '12px 16px', marginBottom: 16,
          }}>
            <span style={{ color: '#DC2626', marginTop: 1 }}><IWarn /></span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#DC2626', margin: '0 0 4px' }}>
                Co {outOfStock.length} san pham het hang trong gio!
              </p>
              <p style={{ fontSize: 13, color: '#7F1D1D', margin: 0 }}>Xoa chung truoc khi thanh toan.</p>
            </div>
            <button onClick={handleRemoveOutOfStock}
              style={{ flexShrink: 0, padding: '5px 14px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Xoa het hang
            </button>
          </div>
        )}

        {loading && items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
            <p>Dang tai gio hang...</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

            {/* ── Left ── */}
            <div>
              {/* Select all */}
              <div className="card" style={{ padding: '12px 20px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                <input type="checkbox" checked={allBuyableSelected} onChange={toggleAll}
                  style={{ width: 17, height: 17, cursor: 'pointer', accentColor: 'var(--primary)' }} />
                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                  Chon tat ca ({buyableIds.length} co the mua)
                </span>
                {selectedBuyable.length > 0 && (
                  <button onClick={handleRemoveSelected}
                    style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--error, #EF4444)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                    <ITrash /> Xoa da chon ({selectedBuyable.length})
                  </button>
                )}
              </div>

              {/* Nhóm theo shop */}
              {shopIds.map(sid => {
                const shopInfo = items.find(i => (i.shop_id ?? 0) === sid)
                return (
                  <div key={sid} className="card" style={{ marginBottom: 12, overflow: 'hidden' }}>
                    {/* Shop header */}
                    <div style={{
                      padding: '12px 20px', borderBottom: '1px solid var(--border-subtle)',
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--bg-highlight, var(--bg-card))',
                    }}>
                      <input type="checkbox"
                        checked={shopAllSelected(sid)}
                        onChange={() => toggleShop(sid)}
                        disabled={!shopItems(sid).some(canBuy)}
                        style={{ width: 16, height: 16, cursor: 'pointer', accentColor: 'var(--primary)' }} />
                      <span style={{ fontSize: 18 }}>🏪</span>
                      <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                        {shopInfo?.shop_name || `Shop #${sid}`}
                      </span>
                    </div>

                    {/* Items */}
                    {shopItems(sid).map((item, idx) => {
                      const oos  = isOutOfStock(item)
                      const over = isOverStock(item)
                      return (
                        <div key={item.cart_id} style={{
                          display: 'flex', gap: 14, padding: '16px 20px',
                          borderBottom: idx < shopItems(sid).length - 1 ? '1px solid var(--border-subtle)' : 'none',
                          opacity: oos ? 0.6 : 1,
                          background: oos ? 'var(--bg-highlight, #fafafa)' : 'transparent',
                        }}>
                          {/* Checkbox */}
                          <div style={{ paddingTop: 4 }}>
                            <input type="checkbox"
                              checked={selected.has(item.cart_id)}
                              onChange={() => toggleItem(item)}
                              disabled={oos}
                              style={{ width: 16, height: 16, cursor: oos ? 'not-allowed' : 'pointer', accentColor: 'var(--primary)' }} />
                          </div>

                          {/* Ảnh */}
                          <div style={{ flexShrink: 0 }}>
                            {item.product_image
                              ? <img src={item.product_image} alt={item.product_name}
                                  style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                              : <div style={{ width: 80, height: 80, borderRadius: 8, background: 'var(--bg-highlight)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32, border: '1px solid var(--border-subtle)' }}>📦</div>
                            }
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4, lineHeight: 1.4 }}>
                              {item.product_name || `San pham #${item.product_id}`}
                            </p>
                            <div style={{ marginBottom: 8 }}>
                              <StockBadge item={item} />
                            </div>

                            {/* Qty controls */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                              {!oos && (
                                <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                                  <button onClick={() => handleChangeQty(item, -1)} disabled={item.quantity <= 1}
                                    style={{ width: 32, height: 32, border: 'none', background: 'var(--bg-highlight)', cursor: item.quantity <= 1 ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', opacity: item.quantity <= 1 ? 0.4 : 1 }}>
                                    −
                                  </button>
                                  <span style={{ width: 36, textAlign: 'center', fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
                                    {item.quantity}
                                  </span>
                                  <button onClick={() => handleChangeQty(item, 1)} disabled={item.quantity >= stock(item)}
                                    style={{ width: 32, height: 32, border: 'none', background: 'var(--bg-highlight)', cursor: item.quantity >= stock(item) ? 'not-allowed' : 'pointer', fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', opacity: item.quantity >= stock(item) ? 0.4 : 1 }}>
                                    +
                                  </button>
                                </div>
                              )}
                              <button onClick={() => handleRemove(item.cart_id)}
                                style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 13, cursor: 'pointer', padding: '4px 8px', borderRadius: 6 }}
                                onMouseEnter={e => e.currentTarget.style.color = '#EF4444'}
                                onMouseLeave={e => e.currentTarget.style.color = 'var(--text-secondary)'}>
                                <ITrash /> Xoa
                              </button>
                            </div>
                          </div>

                          {/* Giá */}
                          <div style={{ textAlign: 'right', flexShrink: 0 }}>
                            <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary, #7C3AED)', margin: 0 }}>
                              {formatCurrency(itemPrice(item))}
                            </p>
                            {item.quantity > 1 && (
                              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                                {formatCurrency(Number(item.price))} / cai
                              </p>
                            )}
                            {over && (
                              <p style={{ fontSize: 11, color: '#D97706', margin: '4px 0 0', fontWeight: 600 }}>
                                Tinh theo {stock(item)} cai
                              </p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>

            {/* ── Right: Tổng đơn ── */}
            <div style={{ position: 'sticky', top: 80 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 16, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 12 }}>
                  Tom tat don hang
                </h3>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>San pham da chon ({selectedBuyable.length})</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>

                  {discount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Voucher giam gia</span>
                      <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(discount)}</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      <ITruck /> Phi van chuyen
                    </span>
                    <span style={{ color: shipping === 0 ? '#16A34A' : 'var(--text-primary)', fontWeight: 500 }}>
                      {shipping === 0
                        ? subtotal > 0 ? 'Mien phi' : '—'
                        : formatCurrency(shipping)}
                    </span>
                  </div>

                  {subtotal > 0 && subtotal < 500000 && (
                    <p style={{ fontSize: 12, color: '#2563EB', margin: 0 }}>
                      Mua them {formatCurrency(500000 - subtotal)} de mien phi ship
                    </p>
                  )}
                </div>

                <div style={{ height: 1, background: 'var(--border-subtle)', margin: '14px 0' }} />

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Tong cong</span>
                  <span style={{ fontWeight: 800, fontSize: 20, color: 'var(--primary, #7C3AED)' }}>
                    {formatCurrency(grandTotal)}
                  </span>
                </div>

                <button
                  onClick={handleCheckout}
                  disabled={selectedBuyable.length === 0}
                  style={{
                    width: '100%', padding: '13px 0', borderRadius: 8, border: 'none',
                    background: selectedBuyable.length === 0 ? '#9CA3AF' : 'var(--primary, #7C3AED)',
                    color: '#fff', fontWeight: 700, fontSize: 15,
                    cursor: selectedBuyable.length === 0 ? 'not-allowed' : 'pointer',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={e => { if (selectedBuyable.length > 0) e.currentTarget.style.opacity = '0.9' }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
                  {selectedBuyable.length === 0 ? 'Chon san pham de thanh toan' : `Thanh toan (${selectedBuyable.length} san pham)`}
                </button>

                {/* Cam kết */}
                <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    '🔒 Thanh toan bao mat, ma hoa SSL',
                    '↩️ Doi tra trong 7 ngay',
                    '✅ Hang chinh hang 100%',
                  ].map((t, i) => (
                    <p key={i} style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, display: 'flex', alignItems: 'center', gap: 6 }}>{t}</p>
                  ))}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Gợi ý deals */}
        {!loading && items.length > 0 && (
          <div style={{ marginTop: 32 }}><SuggestedDealsSection /></div>
        )}

      </div>
    </div>
  )
}

export default CartPage
