import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { formatCurrency } from '../../utils/formatters'
import { voucherService } from '../../services/voucherService'
import SuggestedDealsSection from '../../components/common/SuggestedDealsSection'

// ─── Voucher auto-apply helpers ────────────────────────────────────────────────
interface VoucherLite {
  voucher_id: number
  code: string
  discount_type: string
  discount_value: string
  min_order_value: string | null
  max_discount: string | null
  max_uses: number | null
  current_uses: number
  status: string
  valid_to: string | null
  source: 'platform' | 'shop'
  shop_name: string | null
}

const isVoucherEligible = (v: VoucherLite, subtotal: number) => {
  if (subtotal <= 0) return false
  if (v.status !== 'active') return false
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

// Chi chon 1 ma cao nhat (voucher san cong don voi 1 ma shop cao nhat)
const pickBestVoucher = (vouchers: VoucherLite[], subtotal: number): { voucher: VoucherLite; amount: number } | null => {
  const eligible = vouchers.filter(v => isVoucherEligible(v, subtotal))
  if (eligible.length === 0) return null
  return eligible
    .map(v => ({ voucher: v, amount: voucherDiscountAmount(v, subtotal) }))
    .sort((a, b) => b.amount - a.amount)[0]
}

// ─── Mock data ────────────────────────────────────────────────────────────────
// stock = 0  → het hang
// stock > 0 nhung < quantity → dat qua so luong con lai
interface MockItem {
  id: number
  shopId: number
  shopName: string
  shopIcon: string
  name: string
  variant: string
  image: string
  price: number
  originalPrice: number
  quantity: number   // so luong nguoi dung dat
  stock: number      // ton kho HIEN TAI (da cap nhat tu kho)
}

const INITIAL_ITEMS: MockItem[] = [
  {
    id: 1, shopId: 1, shopName: 'TechWorld Store', shopIcon: '🖥️',
    name: 'Tai nghe Bluetooth Sony WH-1000XM5',
    variant: 'Mau den / Khong day',
    image: 'https://placehold.co/100x100/1a1a2e/ffffff?text=Sony',
    price: 6990000, originalPrice: 8490000,
    quantity: 1,
    stock: 0,   // ← het hang (hom qua con 20, hom nay ban het)
  },
  {
    id: 2, shopId: 1, shopName: 'TechWorld Store', shopIcon: '🖥️',
    name: 'Cap sac nhanh USB-C 100W PD Anker',
    variant: 'Do dai 1.8m / Mau trang',
    image: 'https://placehold.co/100x100/0f3460/ffffff?text=Anker',
    price: 389000, originalPrice: 490000,
    quantity: 5,
    stock: 3,   // ← dat 5 nhung chi con 3 (sap het)
  },
  {
    id: 3, shopId: 2, shopName: 'Fashion Hub', shopIcon: '👗',
    name: 'Ao thun oversize unisex cotton 100%',
    variant: 'Size L / Mau xam nhat',
    image: 'https://placehold.co/100x100/533483/ffffff?text=Ao',
    price: 189000, originalPrice: 259000,
    quantity: 3,
    stock: 20,  // ← con hang binh thuong
  },
  {
    id: 4, shopId: 2, shopName: 'Fashion Hub', shopIcon: '👗',
    name: 'Quan short kaki nam phong cach Han Quoc',
    variant: 'Size 30 / Xanh navy',
    image: 'https://placehold.co/100x100/1a4a5a/ffffff?text=Quan',
    price: 299000, originalPrice: 399000,
    quantity: 1,
    stock: 0,   // ← het hang
  },
  {
    id: 5, shopId: 3, shopName: 'NutriFood Store', shopIcon: '🥗',
    name: 'Hat dieu rang muoi Da Lat loai 1 (500g)',
    variant: 'Rang muoi / Hop giay',
    image: 'https://placehold.co/100x100/2d6a4f/ffffff?text=Dieu',
    price: 145000, originalPrice: 175000,
    quantity: 2,
    stock: 8,   // ← con hang, sap het
  },
  {
    id: 6, shopId: 3, shopName: 'NutriFood Store', shopIcon: '🥗',
    name: 'Tra xanh Oolong nguyen chat Thai Nguyen 200g',
    variant: 'Loai thuong / Tui zip',
    image: 'https://placehold.co/100x100/1b4332/ffffff?text=Tra',
    price: 98000, originalPrice: 120000,
    quantity: 1,
    stock: 30,  // ← binh thuong
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────
const isOutOfStock  = (item: MockItem) => item.stock === 0
const isOverStock   = (item: MockItem) => item.stock > 0 && item.quantity > item.stock
const isLowStock    = (item: MockItem) => item.stock > 0 && item.stock <= 5
const canBuy        = (item: MockItem) => !isOutOfStock(item)
const effectiveQty  = (item: MockItem) => isOverStock(item) ? item.stock : item.quantity
const effectivePrice = (item: MockItem) => item.price * effectiveQty(item)

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const ITrash  = () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3,6 5,6 21,6"/><path d="M19,6l-1,14H6L5,6"/><path d="M10,11v6"/><path d="M14,11v6"/><path d="M9,6V4h6v2"/></svg>
const ITag    = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59,13.41l-7.17,7.17a2,2,0,0,1-2.83,0L2,12V2H12l8.59,8.59A2,2,0,0,1,20.59,13.41Z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
const IShield = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12,22s8-4,8-10V5l-8-3L4,5v7C4,18,12,22,12,22Z"/></svg>
const ITruck  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16,8 20,8 23,11 23,16 16,16 16,8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>
const IWarn   = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29,3.86L1.82,18a2,2,0,0,0,1.71,3H20.47A2,2,0,0,0,22.18,18L13.71,3.86A2,2,0,0,0,10.29,3.86Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>

// ─── Stock badge ──────────────────────────────────────────────────────────────
const StockBadge: React.FC<{ item: MockItem }> = ({ item }) => {
  if (isOutOfStock(item)) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
      background: '#FEE2E2', color: '#DC2626', padding: '3px 8px', borderRadius: 20 }}>
      🚫 Het hang
    </span>
  )
  if (isOverStock(item)) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700,
      background: '#FEF3C7', color: '#D97706', padding: '3px 8px', borderRadius: 20 }}>
      ⚠️ Chi con {item.stock} san pham
    </span>
  )
  if (isLowStock(item)) return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 600,
      background: '#FFF7ED', color: '#EA580C', padding: '3px 8px', borderRadius: 20 }}>
      🔥 Sap het ({item.stock} con lai)
    </span>
  )
  return (
    <span style={{ fontSize: 11, color: '#16A34A', fontWeight: 500 }}>
      ✓ Con hang ({item.stock})
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
const CartPage: React.FC = () => {
  const navigate   = useNavigate()
  const [items, setItems]             = useState<MockItem[]>(INITIAL_ITEMS)
  const [selected, setSelected]       = useState<Set<number>>(
    new Set(INITIAL_ITEMS.filter(canBuy).map(i => i.id))
  )
  const [myVouchers, setMyVouchers]   = useState<VoucherLite[]>([])
  const [vouchersLoading, setVouchersLoading] = useState(true)

  useEffect(() => {
    voucherService.getMyVouchers()
      .then(res => setMyVouchers(res.data.vouchers || []))
      .catch(() => {})
      .finally(() => setVouchersLoading(false))
  }, [])

  // ── Selection helpers ──
  const buyableIds     = items.filter(canBuy).map(i => i.id)
  const selectedBuyable = [...selected].filter(id => buyableIds.includes(id))

  const toggleItem = (item: MockItem) => {
    if (isOutOfStock(item)) return
    setSelected(prev => {
      const s = new Set(prev); s.has(item.id) ? s.delete(item.id) : s.add(item.id); return s
    })
  }

  const shopIds   = [...new Set(items.map(i => i.shopId))]
  const shopItems = (sid: number) => items.filter(i => i.shopId === sid)

  const shopAllSelected = (sid: number) =>
    shopItems(sid).filter(canBuy).every(i => selected.has(i.id)) && shopItems(sid).some(canBuy)

  const toggleShop = (sid: number) => {
    const ids = shopItems(sid).filter(canBuy).map(i => i.id)
    const allOn = ids.every(id => selected.has(id))
    setSelected(prev => {
      const s = new Set(prev)
      allOn ? ids.forEach(id => s.delete(id)) : ids.forEach(id => s.add(id))
      return s
    })
  }

  const allBuyableSelected = buyableIds.every(id => selected.has(id)) && buyableIds.length > 0
  const toggleAll = () =>
    setSelected(allBuyableSelected ? new Set() : new Set(buyableIds))

  const removeItem = (id: number) => {
    setItems(prev => prev.filter(i => i.id !== id))
    setSelected(prev => { const s = new Set(prev); s.delete(id); return s })
  }

  const removeOutOfStock = () => {
    const oos = items.filter(i => !canBuy(i)).map(i => i.id)
    setItems(prev => prev.filter(i => canBuy(i)))
    setSelected(prev => { const s = new Set(prev); oos.forEach(id => s.delete(id)); return s })
  }

  const changeQty = (id: number, delta: number) => {
    setItems(prev => prev.map(i => {
      if (i.id !== id) return i
      const q = Math.max(1, Math.min(i.stock, i.quantity + delta))
      return { ...i, quantity: q }
    }))
  }

  // ── Tinh toan ──
  const selItems    = items.filter(i => selectedBuyable.includes(i.id))
  const subtotal    = selItems.reduce((s, i) => s + effectivePrice(i), 0)
  const origTotal   = selItems.reduce((s, i) => s + i.originalPrice * effectiveQty(i), 0)
  const saved       = origTotal - subtotal

  // ── Tu dong ap voucher tot nhat: 1 voucher san (toan don) + 1 voucher shop/shop (cong don) ──
  const platformBest = pickBestVoucher(myVouchers.filter(v => v.source === 'platform'), subtotal)
  const shopBests = shopIds
    .map(sid => {
      const info = items.find(i => i.shopId === sid)!
      const sSubtotal = shopItems(sid).filter(i => selectedBuyable.includes(i.id)).reduce((s, i) => s + effectivePrice(i), 0)
      const best = pickBestVoucher(myVouchers.filter(v => v.source === 'shop' && v.shop_name === info.shopName), sSubtotal)
      return best ? { sid, shopName: info.shopName, ...best } : null
    })
    .filter((x): x is { sid: number; shopName: string; voucher: VoucherLite; amount: number } => x !== null)

  const shopDiscountTotal = shopBests.reduce((s, x) => s + x.amount, 0)
  const discount    = (platformBest?.amount || 0) + shopDiscountTotal
  const shipping    = subtotal >= 500000 || selItems.length === 0 ? 0 : 30000
  const grandTotal  = subtotal - discount + shipping

  const outOfStockInCart = items.filter(i => !canBuy(i))
  const hasBlocker = outOfStockInCart.length > 0

  if (items.length === 0) return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 60, paddingBottom: 60, textAlign: 'center' }}>
        <div style={{ fontSize: 80, marginBottom: 16 }}>🛒</div>
        <h2 style={{ fontWeight: 700, fontSize: 22, marginBottom: 8, color: 'var(--text-primary)' }}>Gio hang trong</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>Them san pham vao gio de tiep tuc mua sam</p>
        <Link to="/products" className="btn btn-primary btn-lg">Kham pha san pham</Link>

        <div style={{ textAlign: 'left', marginTop: 16 }}>
          <SuggestedDealsSection />
        </div>
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
            <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-secondary)', marginLeft: 8 }}>
              ({items.length} san pham)
            </span>
          </h1>
          <Link to="/products" style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 500, textDecoration: 'none' }}>
            + Tiep tuc mua sam
          </Link>
        </div>

        {/* Banner canh bao het hang */}
        {hasBlocker && (
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 10,
            background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 10,
            padding: '12px 16px', marginBottom: 16,
          }}>
            <span style={{ color: '#DC2626', marginTop: 1 }}><IWarn /></span>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#DC2626', margin: '0 0 4px' }}>
                Co {outOfStockInCart.length} san pham het hang trong gio!
              </p>
              <p style={{ fontSize: 13, color: '#7F1D1D', margin: 0 }}>
                Cac san pham nay da het hang tai kho. Ban can xoa chung truoc khi thanh toan.
              </p>
            </div>
            <button
              onClick={removeOutOfStock}
              style={{ flexShrink: 0, padding: '5px 14px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
            >
              Xoa tat ca het hang
            </button>
          </div>
        )}

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
                <button
                  onClick={() => selectedBuyable.forEach(id => removeItem(id))}
                  style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--error)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <ITrash /> Xoa da chon ({selectedBuyable.length})
                </button>
              )}
            </div>

            {/* Shop groups */}
            {shopIds.map(sid => {
              const shopInfo = items.find(i => i.shopId === sid)!
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
                    <span style={{ fontSize: 18 }}>{shopInfo.shopIcon}</span>
                    <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>{shopInfo.shopName}</span>
                    <span style={{ marginLeft: 6, fontSize: 12, color: '#16A34A', fontWeight: 600,
                      background: '#dcfce7', padding: '2px 8px', borderRadius: 20 }}>
                      Mall chinh hang
                    </span>
                  </div>

                  {shopItems(sid).map((item, idx) => {
                    const oos      = isOutOfStock(item)
                    const over     = isOverStock(item)

                    return (
                      <div key={item.id} style={{
                        display: 'flex', gap: 14, padding: '16px 20px',
                        borderBottom: idx < shopItems(sid).length - 1 ? '1px solid var(--border-subtle)' : 'none',
                        alignItems: 'flex-start',
                        background: oos ? 'rgba(239,68,68,0.04)' : 'transparent',
                        position: 'relative',
                      }}>
                        {/* Overlay het hang */}
                        {oos && (
                          <div style={{
                            position: 'absolute', inset: 0, zIndex: 1,
                            background: 'rgba(255,255,255,0.45)',
                            pointerEvents: 'none',
                          }} />
                        )}

                        {/* Checkbox */}
                        <input type="checkbox"
                          checked={selected.has(item.id) && !oos}
                          onChange={() => toggleItem(item)}
                          disabled={oos}
                          style={{ width: 16, height: 16, cursor: oos ? 'not-allowed' : 'pointer', marginTop: 34, flexShrink: 0, accentColor: 'var(--primary)', position: 'relative', zIndex: 2 }} />

                        {/* Image */}
                        <div style={{ position: 'relative', flexShrink: 0 }}>
                          <img src={item.image} alt={item.name}
                            style={{ width: 88, height: 88, objectFit: 'cover', borderRadius: 10,
                              border: '1px solid var(--border-subtle)',
                              filter: oos ? 'grayscale(0.6) opacity(0.6)' : 'none' }} />
                          {oos && (
                            <div style={{
                              position: 'absolute', inset: 0, borderRadius: 10,
                              background: 'rgba(0,0,0,0.45)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              <span style={{ color: '#fff', fontSize: 11, fontWeight: 800, textAlign: 'center', lineHeight: 1.3 }}>
                                HET{'\n'}HANG
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 2 }}>
                          <p style={{ fontWeight: 500, fontSize: 14, color: oos ? 'var(--text-secondary)' : 'var(--text-primary)', marginBottom: 3, lineHeight: 1.45 }}>
                            {item.name}
                          </p>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
                            Phan loai: {item.variant}
                          </p>

                          {/* Stock status badge */}
                          <div style={{ marginBottom: 8 }}>
                            <StockBadge item={item} />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 15, color: oos ? 'var(--text-secondary)' : 'var(--primary, #7C3AED)' }}>
                              {formatCurrency(item.price)}
                            </span>
                            {item.originalPrice > item.price && (
                              <span style={{ fontSize: 12, color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                                {formatCurrency(item.originalPrice)}
                              </span>
                            )}
                            {item.originalPrice > item.price && !oos && (
                              <span style={{ fontSize: 11, background: '#FEE2E2', color: '#DC2626', padding: '1px 6px', borderRadius: 4, fontWeight: 700 }}>
                                -{Math.round((1 - item.price / item.originalPrice) * 100)}%
                              </span>
                            )}
                          </div>

                          {/* Canh bao vuot so luong */}
                          {over && (
                            <p style={{ fontSize: 12, color: '#D97706', marginTop: 5, fontWeight: 500 }}>
                              ⚠️ So luong dat ({item.quantity}) vuot ton kho. Da tu dong dieu chinh con {item.stock}.
                            </p>
                          )}
                        </div>

                        {/* Qty + remove */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 12, flexShrink: 0, position: 'relative', zIndex: 2 }}>
                          <button onClick={() => removeItem(item.id)}
                            style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 4 }}
                            title="Xoa san pham">
                            <ITrash />
                          </button>

                          {/* Qty controls */}
                          {oos ? (
                            <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 600 }}>Xoa de tiep tuc</span>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', border: '1.5px solid var(--border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
                              <button onClick={() => changeQty(item.id, -1)}
                                style={{ width: 30, height: 30, border: 'none', borderRight: '1.5px solid var(--border-subtle)', background: 'var(--bg-highlight, var(--gray-50))', cursor: 'pointer', fontSize: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                −
                              </button>
                              <span style={{ width: 36, textAlign: 'center', fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>
                                {over ? item.stock : item.quantity}
                              </span>
                              <button onClick={() => changeQty(item.id, 1)}
                                disabled={item.quantity >= item.stock}
                                style={{ width: 30, height: 30, border: 'none', borderLeft: '1.5px solid var(--border-subtle)', background: 'var(--bg-highlight, var(--gray-50))', cursor: item.quantity >= item.stock ? 'not-allowed' : 'pointer', fontSize: 16, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: item.quantity >= item.stock ? 0.35 : 1 }}>
                                +
                              </button>
                            </div>
                          )}

                          {!oos && (
                            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                              {formatCurrency(effectivePrice(item))}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Shop footer */}
                  <div style={{ padding: '8px 20px', background: 'var(--bg-highlight, #f8f9fa)', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ITruck />
                    <span style={{ fontSize: 12, color: '#16A34A', fontWeight: 500 }}>Mien phi van chuyen don tu 500,000d</span>
                  </div>
                </div>
              )
            })}

            {/* Voucher tu dong ap dung */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <ITag />
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>Voucher tu dong ap dung</span>
              </div>

              {vouchersLoading ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Dang kiem tra voucher...</p>
              ) : !platformBest && shopBests.length === 0 ? (
                <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                  Chua co voucher nao ap dung duoc cho gio hang nay.{' '}
                  <Link to="/vouchers" style={{ color: 'var(--primary)', fontWeight: 600 }}>Thu thap voucher</Link>
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {platformBest && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#FFF1EB', borderRadius: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#D9480F' }}>🏛️ Voucher san — {platformBest.voucher.code}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#D9480F' }}>-{formatCurrency(platformBest.amount)}</span>
                    </div>
                  )}
                  {shopBests.map(s => (
                    <div key={s.sid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', background: '#EFF6FF', borderRadius: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8' }}>🏪 {s.shopName} — {s.voucher.code}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8' }}>-{formatCurrency(s.amount)}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 11, color: 'var(--text-secondary)', margin: '2px 0 0' }}>
                    Tu dong chon voucher giam nhieu nhat: voucher san duoc cong don voi 1 voucher shop cao nhat moi shop.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* ── Right: Summary ── */}
          <div>
            <div className="card" style={{ padding: 20, position: 'sticky', top: 80 }}>
              <h3 style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: 'var(--text-primary)' }}>
                Tom tat don hang
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Tam tinh ({selectedBuyable.length} sp)</span>
                  <span style={{ color: 'var(--text-primary)' }}>{formatCurrency(subtotal)}</span>
                </div>
                {saved > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Tiet kiem</span>
                    <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(saved)}</span>
                  </div>
                )}
                {discount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Voucher ap dung</span>
                    <span style={{ color: '#16A34A', fontWeight: 600 }}>-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Phi giao hang</span>
                  <span style={{ color: shipping === 0 ? '#16A34A' : 'var(--text-primary)', fontWeight: 500 }}>
                    {shipping === 0 ? 'Mien phi' : formatCurrency(shipping)}
                  </span>
                </div>
              </div>

              <div style={{ height: 1, background: 'var(--border-subtle)', margin: '12px 0' }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Tong cong</span>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontWeight: 800, fontSize: 20, color: 'var(--primary, #7C3AED)', margin: 0 }}>{formatCurrency(grandTotal)}</p>
                  {saved + discount > 0 && (
                    <p style={{ fontSize: 12, color: '#16A34A', margin: '2px 0 0' }}>Tiet kiem {formatCurrency(saved + discount)}</p>
                  )}
                </div>
              </div>

              {/* Nut dat hang / canh bao */}
              {hasBlocker ? (
                <div>
                  <button disabled style={{
                    width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                    background: '#FEE2E2', color: '#DC2626', fontWeight: 700, fontSize: 14, cursor: 'not-allowed',
                  }}>
                    🚫 Khong the thanh toan
                  </button>
                  <div style={{ marginTop: 10, padding: '10px 12px', background: '#FFF7ED', border: '1.5px solid #FED7AA', borderRadius: 8 }}>
                    <p style={{ fontSize: 12, color: '#C2410C', fontWeight: 600, margin: '0 0 4px' }}>
                      ⚠️ Co san pham het hang trong gio!
                    </p>
                    <p style={{ fontSize: 12, color: '#9A3412', margin: 0 }}>
                      Xoa {outOfStockInCart.length} san pham het hang de tiep tuc thanh toan.
                    </p>
                    <button onClick={removeOutOfStock}
                      style={{ marginTop: 8, width: '100%', padding: '7px 0', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Xoa {outOfStockInCart.length} sp het hang
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => selectedBuyable.length > 0 && navigate('/checkout')}
                  disabled={selectedBuyable.length === 0}
                  style={{
                    width: '100%', padding: '13px 0', borderRadius: 10, border: 'none',
                    background: selectedBuyable.length > 0 ? 'var(--primary, #7C3AED)' : 'var(--gray-200)',
                    color: selectedBuyable.length > 0 ? '#fff' : 'var(--gray-400)',
                    fontWeight: 700, fontSize: 15,
                    cursor: selectedBuyable.length > 0 ? 'pointer' : 'not-allowed',
                    transition: 'all 0.2s',
                  }}
                >
                  Dat hang ({selectedBuyable.length} san pham)
                </button>
              )}

              {!hasBlocker && selectedBuyable.length === 0 && (
                <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-secondary)', marginTop: 8 }}>
                  Vui long chon it nhat 1 san pham
                </p>
              )}

              {/* Trust */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 7 }}>
                {[
                  { icon: <IShield />, text: 'Thanh toan bao mat 100%' },
                  { icon: <ITruck />,  text: 'Giao hang toan quoc 2-5 ngay' },
                  { icon: <ITag />,    text: 'Doi tra mien phi trong 7 ngay' },
                ].map((b, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-secondary)' }}>
                    <span style={{ color: '#16A34A' }}>{b.icon}</span>
                    {b.text}
                  </div>
                ))}
              </div>
            </div>
          </div>

        </div>

        <SuggestedDealsSection />
      </div>
    </div>
  )
}

export default CartPage
