import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import { formatCurrency } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import { variantStore, bundleStore, attributeStore } from '../../utils/productBundleStore'
import Loading from '../../components/common/Loading'
import Modal from '../../components/common/Modal'
import { toast } from 'react-toastify'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: 'Chờ duyệt', color: C.warning, bg: '#FEF3C7' },
  approved: { label: 'Đã duyệt',  color: C.success, bg: '#DCFCE7' },
  rejected: { label: 'Từ chối',   color: C.error,   bg: '#FEE2E2' },
  active:   { label: 'Đang bán',  color: C.success, bg: '#DCFCE7' },
}

type TabKey = 'shop' | 'shipper' | 'product'
type FilterKey = 'all' | 'pending' | 'active' | 'rejected'

const ApprovalPage: React.FC = () => {
  const [tab, setTab]           = useState<TabKey>('shop')
  const [shops, setShops]       = useState<any[]>([])
  const [shippers, setShippers] = useState<any[]>([])
  const [products, setProducts] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [filter, setFilter]     = useState<FilterKey>('all')
  const [search, setSearch]     = useState('')
  const [rejectModal, setRejectModal] = useState<number | null>(null)
  const [rejectReason, setRejectReason] = useState('')
  const [detailProduct, setDetailProduct] = useState<any | null>(null)

  const load = () => {
    setLoading(true)
    const setter = tab === 'shop' ? setShops : tab === 'shipper' ? setShippers : setProducts
    const key    = tab === 'shop' ? 'registrations' : tab === 'shipper' ? 'registrations' : 'products'
    const call   =
      tab === 'shop'    ? adminService.getShopRegistrations() :
      tab === 'shipper' ? adminService.getShipperRegistrations() :
                          adminService.getPendingProducts()
    call
      .then(r => { const d = r.data?.[key] ?? r.data; if (Array.isArray(d)) setter(d) })
      .catch(() => setter([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab])

  const handleApprove = async (id: number) => {
    try {
      if (tab === 'product') {
        await adminService.approveProduct(id)
        setProducts(s => s.map(x => x.product_id === id ? { ...x, status: 'active' } : x))
      } else {
        await adminService.approveShop(id)
        if (tab === 'shop')    setShops(s => s.map(x => x.reg_id === id ? { ...x, status: 'approved' } : x))
        if (tab === 'shipper') setShippers(s => s.map(x => x.reg_id === id ? { ...x, status: 'approved' } : x))
      }
      toast.success('Đã phê duyệt')
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Lỗi duyệt') }
  }

  const handleReject = async () => {
    if (!rejectReason.trim()) { toast.warning('Nhập lý do từ chối'); return }
    try {
      if (tab === 'product') {
        await adminService.rejectProduct(rejectModal!, rejectReason)
        setProducts(s => s.map(x => x.product_id === rejectModal ? { ...x, status: 'rejected' } : x))
      } else {
        if (tab === 'shop')    setShops(s => s.map(x => x.reg_id === rejectModal ? { ...x, status: 'rejected' } : x))
        if (tab === 'shipper') setShippers(s => s.map(x => x.reg_id === rejectModal ? { ...x, status: 'rejected' } : x))
      }
      toast.success('Đã từ chối')
      setRejectModal(null); setRejectReason('')
    } catch { toast.error('Lỗi') }
  }

  const pendingShops    = shops.filter(x => x.status === 'pending').length
  const pendingShippers = shippers.filter(x => x.status === 'pending').length
  const pendingProducts = products.filter(x => x.status === 'pending').length

  // Filtered products
  const filteredProducts = products.filter(p => {
    if (filter === 'pending'  && p.status !== 'pending')  return false
    if (filter === 'active'   && p.status !== 'active')   return false
    if (filter === 'rejected' && p.status !== 'rejected') return false
    if (search && !p.product_name?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>✅ Phê duyệt</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Duyệt sản phẩm, ẩn/hiện, upload ảnh trực tiếp vào database</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
        {[
          { key:'shop',    label:'Đăng ký Shop',   count: pendingShops,    icon:'🏪', color: C.blue },
          { key:'shipper', label:'Đăng ký Shipper', count: pendingShippers, icon:'🚚', color: C.warning },
          { key:'product', label:'Sản phẩm chờ',   count: pendingProducts, icon:'🏷️', color: '#7C3AED' },
        ].map(s => (
          <div key={s.key} className="card" style={{ padding: '16px 20px', borderLeft: `3px solid ${s.color}`, cursor: 'pointer', background: tab === s.key ? C.tint : 'var(--bg-card)' }}
            onClick={() => setTab(s.key as TabKey)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>{s.label}</p>
                <p style={{ fontSize: 24, fontWeight: 800, color: s.color }}>{s.count} chờ duyệt</p>
              </div>
              <span style={{ fontSize: 28 }}>{s.icon}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 8 }}>
        {([['shop','🏪 Đăng ký shop'],['shipper','🚚 Đăng ký shipper'],['product','🏷️ Sản phẩm chờ duyệt']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === k ? C.blue : C.tint, color: tab === k ? 'white' : C.gray,
          }}>{l}</button>
        ))}
      </div>

      {/* ── Product tab: rich grid view ── */}
      {tab === 'product' && (
        <>
          {/* Filter + search bar */}
          <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {([['all','Tất cả'],['pending','Chờ duyệt'],['active','Đang bán'],['rejected','Từ chối']] as [FilterKey,string][]).map(([k,l]) => (
              <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: filter === k ? 700 : 500, fontSize: 13, background: filter === k ? C.blue : C.tint, color: filter === k ? 'white' : C.gray }}>{l}</button>
            ))}
            <div style={{ flex: 1, minWidth: 160, display: 'flex', gap: 8, alignItems: 'center', background: '#F1F5F9', borderRadius: 10, padding: '6px 12px' }}>
              <span style={{ color: C.gray }}>🔍</span>
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sản phẩm..." style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontSize: 13 }} />
            </div>
            <button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: C.tint, color: C.blue, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>🔄 Làm mới</button>
          </div>

          {filteredProducts.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>✅ Không có sản phẩm nào</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
              {filteredProducts.map((p: any) => {
                const variants  = variantStore.get(p.product_id)
                const bundles   = bundleStore.get(p.product_id)
                const attrs     = attributeStore.get(p.product_id)
                const mainV     = variants[0]
                const imgs      = mainV?.image_urls?.length ? mainV.image_urls : (p.image_urls || [])
                const price     = mainV?.price || Number(p.price) || 0
                const stock     = mainV?.stock ?? p.stock_quantity ?? 0
                const allAttrs  = mainV?.attrs?.length ? mainV.attrs : attrs.map(a => ({ name: a.name, values: a.values.map((v: string) => ({ label: v, price_delta: 0 })) }))
                const allPromos = variants.flatMap(v => v.promos || [])
                const allBundle = [...bundles, ...variants.flatMap(v => v.bundleItems || [])]
                const accessories = allBundle.filter(b => b.type === 'accessory')
                const gifts       = allBundle.filter(b => b.type === 'gift')
                const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending

                return (
                  <div key={p.product_id} className="card" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                    {/* Image */}
                    <div style={{ position: 'relative', width: '100%', paddingTop: '52%', background: '#F1F5F9', overflow: 'hidden' }}>
                      {imgs[0]
                        ? <img src={getImageUrl(imgs[0])} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 52, color: '#CBD5E1' }}>🛍️</div>
                      }
                      {/* Extra images strip */}
                      {imgs.length > 1 && (
                        <div style={{ position: 'absolute', bottom: 8, left: 8, display: 'flex', gap: 4 }}>
                          {imgs.slice(1, 5).map((url: string, i: number) => (
                            <img key={i} src={getImageUrl(url)} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', border: '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
                          ))}
                          {imgs.length > 5 && <div style={{ width: 36, height: 36, borderRadius: 6, background: 'rgba(0,0,0,0.5)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700 }}>+{imgs.length - 5}</div>}
                        </div>
                      )}
                      <span style={{ position: 'absolute', top: 10, right: 10, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>

                    {/* Content */}
                    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                      {/* Name + price */}
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 16, color: C.navy, cursor: 'pointer' }} onClick={() => setDetailProduct({ p, variants, allAttrs, allPromos, accessories, gifts, imgs, price, stock })}>{p.product_name}</div>
                        <div style={{ display: 'flex', gap: 12, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ fontSize: 17, fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(price)}</span>
                          <span style={{ fontSize: 12, color: C.gray }}>Shop #{p.shop_id} · Tồn: <b>{stock}</b> · Bán: <b>{p.sales_count ?? 0}</b></span>
                        </div>
                        {p.description && <p style={{ fontSize: 12, color: C.gray, marginTop: 4, lineHeight: 1.5, WebkitLineClamp: 2, overflow: 'hidden', display: '-webkit-box', WebkitBoxOrient: 'vertical' as any }}>{p.description}</p>}
                      </div>

                      {/* Variants */}
                      {variants.length > 1 && (
                        <div style={{ background: '#F8FAFC', borderRadius: 8, padding: '8px 10px' }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 5, textTransform: 'uppercase', letterSpacing: 0.4 }}>🔀 {variants.length} phiên bản</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {variants.map((v, vi) => (
                              <span key={vi} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'white', fontWeight: 600 }}>
                                {v.name || `PB ${vi + 1}`} — {formatCurrency(v.price)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Attributes */}
                      {allAttrs.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>🏷️ Thuộc tính</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {allAttrs.map((attr: any, ai: number) => (
                              <div key={ai} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, fontWeight: 700, color: C.navy, minWidth: 70 }}>{attr.name}:</span>
                                {(attr.values || []).map((val: any, vi: number) => (
                                  <span key={vi} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#EEF2FF', color: '#4F46E5', fontWeight: 600 }}>
                                    {val.label || val}{val.price_delta ? ` (+${Number(val.price_delta).toLocaleString('vi-VN')}₫)` : ''}
                                  </span>
                                ))}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Promo deals */}
                      {allPromos.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>🎯 Ưu đãi ({allPromos.length})</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                            {allPromos.map((r: any, ri: number) => (
                              <span key={ri} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 14, background: '#FEF3C7', color: '#D97706', fontWeight: 600 }}>
                                🎁 {r.condition_type === 'quantity' ? `Mua ${r.condition_value}` : `≥${Number(r.condition_value).toLocaleString('vi-VN')}₫`} → {r.reward_type === 'free' ? 'Tặng miễn phí' : r.reward_type === 'discount' ? `-${r.reward_value}%` : formatCurrency(r.reward_value)}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Accessories */}
                      {accessories.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>📦 Phụ kiện đi kèm ({accessories.length})</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {accessories.map((b: any, bi: number) => (
                              <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: '#F8FAFC', border: '1px solid var(--border-subtle)' }}>
                                {(b.image_urls || []).length > 0 && <img src={getImageUrl(b.image_urls[0])} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600 }}>{b.name || '—'}</div>
                                  <div style={{ fontSize: 11, color: C.success, fontWeight: 700 }}>{formatCurrency(b.price)}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Gifts */}
                      {gifts.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>🎁 Hàng tặng kèm ({gifts.length})</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {gifts.map((b: any, bi: number) => (
                              <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 8, background: '#FFF7ED', border: '1px solid #FED7AA' }}>
                                {(b.image_urls || []).length > 0 && <img src={getImageUrl(b.image_urls[0])} alt="" style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                                <div>
                                  <div style={{ fontSize: 12, fontWeight: 600 }}>{b.name || '—'}</div>
                                  <div style={{ fontSize: 11, color: '#D97706', fontWeight: 700 }}>{b.price > 0 ? formatCurrency(b.price) : 'Tặng miễn phí'}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>

                        {p.status === 'pending' && (
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button onClick={() => handleApprove(p.product_id)}
                              style={{ flex: 1, padding: '9px 0', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                              ✅ Duyệt
                            </button>
                            <button onClick={() => { setRejectModal(p.product_id); setRejectReason('') }}
                              style={{ flex: 1, padding: '9px 0', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                              ❌ Từ chối
                            </button>
                          </div>
                        )}
                        {p.status !== 'pending' && (
                          <div style={{ textAlign: 'center', padding: '7px 12px', borderRadius: 8, background: st.bg, color: st.color, fontSize: 12, fontWeight: 700 }}>{st.label}</div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}

      {/* ── Shop / Shipper tab: list view ── */}
      {tab !== 'product' && (() => {
        const items = tab === 'shop' ? shops : shippers
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>✅ Không có yêu cầu nào</div>
            ) : items.map((item: any, idx) => {
              const id  = item.reg_id ?? item.product_id
              const title = item.shop_name ?? `Shipper #${item.user_id}`
              const sub   = tab === 'shop'
                ? `UID #${item.user_id} · ${item.address ?? '—'}`
                : `UID #${item.user_id} · ${item.vehicle_type} · ${item.license_plate}`
              const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending
              return (
                <div key={id ?? idx} className="card" style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{title}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: 13, color: C.gray }}>{sub}</p>
                    {item.created_at && <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>🕐 {item.created_at}</p>}
                  </div>
                  {item.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginLeft: 20 }}>
                      <button onClick={() => handleApprove(id)} style={{ padding: '8px 20px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✅ Duyệt</button>
                      <button onClick={() => { setRejectModal(id); setRejectReason('') }} style={{ padding: '8px 20px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>❌ Từ chối</button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )
      })()}


      {/* ── Detail modal ── */}
      {detailProduct && (() => {
        const { p, variants, allAttrs, allPromos, accessories, gifts, imgs, price, stock } = detailProduct
        const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
        const [activeImg, setActiveImg] = (React as any).useState ? [imgs[0], () => {}] : [imgs[0], () => {}]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={() => setDetailProduct(null)}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 900, maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 72px rgba(0,0,0,0.35)' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>📋 Chi tiết sản phẩm</h2>
                  <span style={{ fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                <button onClick={() => setDetailProduct(null)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gray, lineHeight: 1 }}>✕</button>
              </div>

              {/* Scrollable body */}
              <div style={{ overflowY: 'auto', flex: 1, padding: 24, display: 'flex', gap: 24 }}>

                {/* Left — image gallery */}
                <div style={{ flexShrink: 0, width: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ width: 320, height: 280, borderRadius: 12, overflow: 'hidden', background: '#F1F5F9', flexShrink: 0 }}>
                    {imgs[0]
                      ? <img src={getImageUrl(imgs[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} id="detail-main-img" />
                      : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 64, color: '#CBD5E1' }}>🛍️</div>
                    }
                  </div>
                  {imgs.length > 1 && (
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {imgs.map((url: string, i: number) => (
                        <img key={i} src={getImageUrl(url)} alt="" onClick={() => { const el = document.getElementById('detail-main-img') as HTMLImageElement; if (el) el.src = getImageUrl(url) }}
                          style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', border: `2px solid ${C.light}`, cursor: 'pointer' }} />
                      ))}
                    </div>
                  )}
                  {p.video_url && (
                    <video src={p.video_url} controls style={{ width: '100%', borderRadius: 10, marginTop: 4 }} />
                  )}
                </div>

                {/* Right — info */}
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div>
                    <h3 style={{ fontSize: 20, fontWeight: 800, color: C.navy, lineHeight: 1.3 }}>{p.product_name}</h3>
                    <div style={{ display: 'flex', gap: 12, marginTop: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(price)}</span>
                      <span style={{ fontSize: 13, color: C.gray }}>Shop #{p.shop_id} · Tồn: <b>{stock}</b> · Đã bán: <b>{p.sales_count ?? 0}</b></span>
                    </div>
                    {p.description && <p style={{ fontSize: 13, color: C.gray, marginTop: 8, lineHeight: 1.7, background: '#F8FAFC', borderRadius: 8, padding: '10px 14px' }}>{p.description}</p>}
                  </div>

                  {/* Variants */}
                  {variants.length > 0 && (
                    <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔀 {variants.length} phiên bản</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {variants.map((v: any, vi: number) => (
                          <div key={vi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'white', borderRadius: 8, border: '1px solid var(--border-subtle)' }}>
                            {(v.image_urls || []).length > 0 && <img src={getImageUrl(v.image_urls[0])} alt="" style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: C.navy }}>{v.name || `Phiên bản ${vi + 1}`}</div>
                              <div style={{ fontSize: 12, color: C.gray }}>Tồn: {v.stock} · {formatCurrency(v.price)}</div>
                              {(v.attrs || []).length > 0 && (
                                <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                                  {v.attrs.map((a: any, ai: number) => (
                                    <span key={ai} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: '#EEF2FF', color: '#4F46E5', fontWeight: 600 }}>
                                      {a.name}: {(a.values || []).map((val: any) => val.label || val).join(', ')}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Attributes */}
                  {allAttrs.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>🏷️ Thuộc tính sản phẩm</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allAttrs.map((attr: any, ai: number) => (
                          <div key={ai} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: C.navy, minWidth: 80, paddingTop: 2 }}>{attr.name}:</span>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                              {(attr.values || []).map((val: any, vi: number) => (
                                <span key={vi} style={{ fontSize: 12, padding: '3px 10px', borderRadius: 12, background: '#EEF2FF', color: '#4F46E5', fontWeight: 600 }}>
                                  {val.label || val}{val.price_delta ? ` (+${Number(val.price_delta).toLocaleString('vi-VN')}₫)` : ''}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Promos */}
                  {allPromos.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎯 Ưu đãi ({allPromos.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {allPromos.map((r: any, ri: number) => (
                          <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8 }}>
                            <span style={{ fontSize: 16 }}>🎁</span>
                            <span style={{ fontSize: 13, fontWeight: 600, color: '#92400E' }}>
                              {r.condition_type === 'quantity' ? `Mua ${r.condition_value} sp` : `Đơn từ ${Number(r.condition_value).toLocaleString('vi-VN')}₫`}
                              {' → '}
                              {r.reward_type === 'free' ? 'Tặng miễn phí' : r.reward_type === 'discount' ? `Giảm ${r.reward_value}%` : `Giảm ${formatCurrency(r.reward_value)}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Accessories */}
                  {accessories.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>📦 Phụ kiện đi kèm ({accessories.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {accessories.map((b: any, bi: number) => (
                          <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#F8FAFC', border: '1px solid var(--border-subtle)', borderRadius: 8 }}>
                            {(b.image_urls || []).length > 0 && <img src={getImageUrl(b.image_urls[0])} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{b.name || '—'}</div>
                              <div style={{ fontSize: 12, color: C.success, fontWeight: 700 }}>{formatCurrency(b.price)} · Tồn: {b.stock_quantity}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Gifts */}
                  {gifts.length > 0 && (
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.gray, marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>🎁 Hàng tặng kèm ({gifts.length})</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {gifts.map((b: any, bi: number) => (
                          <div key={bi} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8 }}>
                            {(b.image_urls || []).length > 0 && <img src={getImageUrl(b.image_urls[0])} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />}
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 13, fontWeight: 700 }}>{b.name || '—'}</div>
                              <div style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>{b.price > 0 ? formatCurrency(b.price) : '🎁 Tặng miễn phí'} · Tồn: {b.stock_quantity}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Footer actions */}
              {p.status === 'pending' && (
                <div style={{ padding: '16px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 12, flexShrink: 0 }}>
                  <button onClick={() => { handleApprove(p.product_id); setDetailProduct(null) }}
                    style={{ flex: 1, padding: '12px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    ✅ Duyệt sản phẩm
                  </button>
                  <button onClick={() => { setDetailProduct(null); setRejectModal(p.product_id); setRejectReason('') }}
                    style={{ flex: 1, padding: '12px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 15, cursor: 'pointer' }}>
                    ❌ Từ chối
                  </button>
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Reject modal */}
      <Modal open={rejectModal !== null} onClose={() => setRejectModal(null)} title="Lý do từ chối">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <textarea className="input" rows={4} placeholder="Nhập lý do từ chối..." value={rejectReason} onChange={e => setRejectReason(e.target.value)} style={{ resize: 'vertical' }} />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setRejectModal(null)} className="btn btn-ghost">Hủy</button>
            <button onClick={handleReject} className="btn btn-danger">Từ chối</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ApprovalPage
