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
  const [detailMall, setDetailMall]       = useState<any | null>(null)
  const [detailReg,  setDetailReg]        = useState<any | null>(null)

  const MOCK_SHOPS = [
    { reg_id: 1, shop_name: 'Cửa hàng Thời Trang Minh Anh', user_id: 101, address: '123 Nguyễn Trãi, Q5, TP.HCM', status: 'pending',  created_at: '2026-07-15 09:30' },
    { reg_id: 2, shop_name: 'Shop Điện Tử Hoàng Long',       user_id: 102, address: '45 Lê Lợi, Q1, TP.HCM',        status: 'approved', created_at: '2026-07-14 14:20' },
    { reg_id: 3, shop_name: 'BếpViet – Đồ Gia Dụng',         user_id: 103, address: '88 Trần Phú, Hà Nội',          status: 'rejected', created_at: '2026-07-13 11:00' },
  ]
  const MOCK_SHIPPERS = [
    { reg_id: 10, full_name: 'Nguyễn Văn Tú',  user_id: 201, vehicle_type: 'Xe máy',  license_plate: '59F1-23456', status: 'pending',  created_at: '2026-07-16 08:00' },
    { reg_id: 11, full_name: 'Trần Thị Bảo',   user_id: 202, vehicle_type: 'Xe máy',  license_plate: '51D2-78901', status: 'approved', created_at: '2026-07-15 16:45' },
    { reg_id: 12, full_name: 'Lê Quốc Hùng',   user_id: 203, vehicle_type: 'Xe tải',  license_plate: '30A3-11223', status: 'rejected', created_at: '2026-07-14 10:30' },
  ]
  const MOCK_MALL = [
    { product_id: 20, product_name: 'Shop Sneaker House',       user_id: 301, shop_name: 'Sneaker House',       status: 'pending',  created_at: '2026-07-17 09:00', address: '12 Bùi Viện, Q1' },
    { product_id: 21, product_name: 'TechZone Official Store',  user_id: 302, shop_name: 'TechZone',             status: 'approved', created_at: '2026-07-16 13:00', address: '99 CMT8, Q3' },
    { product_id: 22, product_name: 'Beauty & Glow Cosmetics',  user_id: 303, shop_name: 'Beauty & Glow',        status: 'rejected', created_at: '2026-07-15 17:30', address: '5 Đinh Tiên Hoàng, Q1' },
  ]

  const load = () => {
    setLoading(true)
    const setter = tab === 'shop' ? setShops : tab === 'shipper' ? setShippers : setProducts
    const key    = tab === 'shop' ? 'registrations' : tab === 'shipper' ? 'registrations' : 'products'
    const call   =
      tab === 'shop'    ? adminService.getShopRegistrations('') :
      tab === 'shipper' ? adminService.getShipperRegistrations('') :
                          adminService.getPendingProducts()
    call
      .then(r => {
        const d = r.data?.[key] ?? r.data
        setter(Array.isArray(d) ? d : [])
      })
      .catch(() => {
        // API không khả dụng — hiển thị demo data để preview UI
        if (tab === 'shop')         setShops(MOCK_SHOPS)
        else if (tab === 'shipper') setShippers(MOCK_SHIPPERS)
        else                        setProducts(MOCK_MALL)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [tab])

  const handleApprove = async (id: number) => {
    try {
      if (tab === 'product') {
        await adminService.approveProduct(id)
        setProducts(s => s.map(x => x.product_id === id ? { ...x, status: 'active' } : x))
      } else if (tab === 'shop') {
        await adminService.approveShop(id)
        setShops(s => s.map(x => x.reg_id === id ? { ...x, status: 'approved' } : x))
      } else if (tab === 'shipper') {
        await adminService.approveShipper(id)
        setShippers(s => s.map(x => x.reg_id === id ? { ...x, status: 'approved' } : x))
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
      } else if (tab === 'shop') {
        await adminService.rejectShop(rejectModal!, rejectReason)
        setShops(s => s.map(x => x.reg_id === rejectModal ? { ...x, status: 'rejected' } : x))
      } else if (tab === 'shipper') {
        await adminService.rejectShipper(rejectModal!, rejectReason)
        setShippers(s => s.map(x => x.reg_id === rejectModal ? { ...x, status: 'rejected' } : x))
      }
      toast.success('Đã từ chối')
      setRejectModal(null); setRejectReason('')
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Lỗi từ chối') }
  }

  const pendingShops    = shops.filter(x => x.status === 'pending').length
  const pendingShippers = shippers.filter(x => x.status === 'pending').length
  const pendingProducts = products.filter(x => x.status === 'pending').length

  // filter chỉ dùng cho tab đơn đăng ký (shop / shipper / mall)
  const applyRegFilter = (list: any[], nameField: string) =>
    list.filter(x => {
      if (filter === 'pending'  && x.status !== 'pending')  return false
      if (filter === 'rejected' && x.status !== 'rejected') return false
      if (search && !x[nameField]?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

  const filteredShops     = applyRegFilter(shops,    'shop_name')
  const filteredShippers  = applyRegFilter(shippers, 'full_name')
  const filteredMall      = applyRegFilter(products, 'product_name')
  // alias để không vỡ code bên dưới
  const filteredProducts  = filteredMall

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
          { key:'product', label:'BuyZo Mall',       count: pendingProducts, icon:'🏆', color: '#7C3AED' },
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

      {/* Common filter + search bar */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        {([['all','Tất cả'],['pending','Chờ duyệt'],['rejected','Từ chối']] as [FilterKey,string][]).map(([k,l]) => (
          <button key={k} onClick={() => setFilter(k)} style={{ padding: '6px 18px', borderRadius: 20, border: 'none', cursor: 'pointer', fontWeight: filter === k ? 700 : 500, fontSize: 13, background: filter === k ? C.blue : C.tint, color: filter === k ? 'white' : C.gray }}>{l}</button>
        ))}
        <div style={{ flex: 1, minWidth: 160, display: 'flex', gap: 8, alignItems: 'center', background: '#F1F5F9', borderRadius: 10, padding: '6px 12px' }}>
          <span style={{ color: C.gray }}>🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={tab === 'product' ? 'Tìm sản phẩm...' : tab === 'shipper' ? 'Tìm shipper...' : 'Tìm shop...'} style={{ border: 'none', background: 'none', outline: 'none', flex: 1, fontSize: 13 }} />
        </div>
        <button onClick={load} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: C.tint, color: C.blue, fontWeight: 600, cursor: 'pointer', fontSize: 13 }}>🔄 Làm mới</button>
      </div>

      {/* ── BuyZo Mall tab: registration list view ── */}
      {tab === 'product' && (
        <>
          {filteredProducts.length === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>✅ Không có đơn đăng ký nào</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {filteredProducts.map((p: any) => {
                const id = p.product_id ?? p.reg_id
                const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
                return (
                  <div key={id} className="card" onClick={() => setDetailMall(p)}
                    style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(124,58,237,0.12)')}
                    onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                        <span style={{ fontSize: 20 }}>🏆</span>
                        <p style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{p.shop_name ?? p.product_name}</p>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                      </div>
                      <p style={{ fontSize: 13, color: C.gray }}>UID #{p.user_id} · {p.address ?? '—'}</p>
                      {p.created_at && <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>🕐 {p.created_at}</p>}
                    </div>
                    {p.status === 'pending' && (
                      <div style={{ display: 'flex', gap: 8, marginLeft: 20 }} onClick={e => e.stopPropagation()}>
                        <button onClick={() => handleApprove(id)} style={{ padding: '8px 20px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✅ Duyệt</button>
                        <button onClick={() => { setRejectModal(id); setRejectReason('') }} style={{ padding: '8px 20px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>❌ Từ chối</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}


      {/* ── Shop / Shipper tab: list view ── */}
      {tab !== 'product' && (() => {
        const items = tab === 'shop' ? filteredShops : filteredShippers

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {items.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>✅ Không có yêu cầu nào</div>
            ) : items.map((item: any, idx) => {
              const id  = item.reg_id ?? item.product_id
              const fmtD = (s?: string) => s ? s.replace(/\.\d+$/, '').replace('T', ' ') : ''
              const title = item.shop_name ?? `Shipper #${item.user_id}`
              const sub   = tab === 'shop'
                ? `${item.full_name ?? `UID #${item.user_id}`} · ${item.address ?? '—'}`
                : `${item.full_name ?? `UID #${item.user_id}`} · ${item.vehicle_type} · ${item.license_plate}`
              const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending
              return (
                <div key={id ?? idx} className="card"
                  onClick={() => setDetailReg({ item, tabType: tab })}
                  style={{ padding: '18px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = `0 4px 16px rgba(${tab === 'shop' ? '29,78,216' : '217,119,6'},0.12)`)}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = '')}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <p style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{title}</p>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                    </div>
                    <p style={{ fontSize: 13, color: C.gray }}>{sub}</p>
                    {item.created_at && <p style={{ fontSize: 11, color: C.gray, marginTop: 4 }}>🕐 {fmtD(item.created_at)}</p>}
                  </div>
                  {item.status === 'pending' && (
                    <div style={{ display: 'flex', gap: 8, marginLeft: 20 }} onClick={e => e.stopPropagation()}>
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

      {/* Shop / Shipper detail modal */}
      {detailReg && (() => {
        const { item, tabType } = detailReg
        const id = item.reg_id ?? item.product_id
        const st = STATUS_STYLE[item.status] ?? STATUS_STYLE.pending
        const isShop = tabType === 'shop'
        const accent = isShop ? C.blue : C.warning
        const fmtDate = (s?: string) => s ? s.replace(/\.\d+$/, '').replace('T', ' ') : '—'
        const productImgs: string[] = (() => { try { return item.product_images ? JSON.parse(item.product_images) : [] } catch { return [] } })()
        const licenseFiles: string[] = (() => { try { return item.business_reg_url ? JSON.parse(item.business_reg_url) : [] } catch { return item.business_reg_url ? [item.business_reg_url] : [] } })()
        const VEHICLE_LABELS: Record<string, string> = {
          motorcycle: '🏍️ Xe máy', electric_bike: '🛵 Xe máy điện', car: '🚗 Xe ô tô',
          truck_small: '🚛 Xe tải nhỏ', truck_medium: '🚚 Xe tải trung', truck_large: '🏗️ Xe tải lớn',
        }
        const address = [item.zone_ward, item.zone_district, item.zone_province].filter(Boolean).join(', ') || item.zone_province || '—'
        const shipperDocs = [
          { label: '📋 Cà vẹt xe',  url: item.registration_url },
          { label: '🚗 Hình xe',     url: item.vehicle_photo_url },
          { label: '🪪 Bằng lái xe', url: item.license_url },
          { label: '🪪 CCCD',       url: item.id_card_url },
        ]
        const rows = isShop ? [
          ['🏪 Tên shop',   item.shop_name ?? '—'],
          ['👤 Chủ shop',   item.full_name ?? `UID #${item.user_id}`],
          ['📍 Địa chỉ',    item.address ?? '—'],
          ['📅 Ngày nộp',   fmtDate(item.created_at)],
          ['📝 Mô tả',      item.description ?? 'Không có'],
        ] : [
          ['👤 Họ tên',       item.full_name || `UID #${item.user_id}`],
          ['📧 Email',        item.email ?? '—'],
          ['📱 Điện thoại',   item.phone ?? '—'],
          ['🚗 Phương tiện',  VEHICLE_LABELS[item.vehicle_type] || item.vehicle_type || '—'],
          ['🔢 Biển số',      item.license_plate ?? '—'],
          ['📍 Địa chỉ / Chỗ ở', address],
          ['📅 Ngày nộp',     fmtDate(item.created_at)],
        ]
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={() => setDetailReg(null)}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 520, boxShadow: '0 24px 72px rgba(0,0,0,0.3)', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ background: isShop ? 'linear-gradient(135deg,#1D4ED8,#2563EB)' : 'linear-gradient(135deg,#D97706,#F59E0B)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 600, marginBottom: 4 }}>
                    {isShop ? '🏪 ĐƠN ĐĂNG KÝ MỞ SHOP' : '🚚 ĐƠN ĐĂNG KÝ SHIPPER'}
                  </p>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>
                    {isShop ? (item.shop_name ?? '—') : (item.full_name ?? `Shipper #${item.user_id}`)}
                  </h2>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                {rows.map(([label, value]) => (
                  <div key={label as string} style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                    <span style={{ minWidth: 130, fontSize: 13, color: C.gray, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 13, color: C.navy, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}
                {/* Ảnh giấy tờ shipper */}
                {!isShop && (
                  <div style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
                    <p style={{ fontSize: 13, color: C.gray, fontWeight: 600, marginBottom: 10 }}>📄 Hồ sơ ảnh giấy tờ</p>
                    <div style={{ display: 'flex', gap: 10 }}>
                      {shipperDocs.map(doc => (
                        <div key={doc.label} style={{ flex: 1, textAlign: 'center' }}>
                          {doc.url ? (
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              <img src={doc.url} alt={doc.label} style={{ width: '100%', height: 90, objectFit: 'cover', borderRadius: 8, border: '1.5px solid #E2E8F0', display: 'block', marginBottom: 4 }} />
                            </a>
                          ) : (
                            <div style={{ width: '100%', height: 90, borderRadius: 8, border: '1.5px dashed #E2E8F0', background: '#F8FAFC', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 4 }}>📷</div>
                          )}
                          <span style={{ fontSize: 11, color: C.gray, fontWeight: 600 }}>{doc.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {isShop && (
                  <>
                    {/* Ảnh sản phẩm */}
                    <div style={{ paddingTop: 4 }}>
                      <span style={{ fontSize: 13, color: C.gray, fontWeight: 600 }}>🖼️ Hình ảnh sản phẩm</span>
                      {productImgs.length === 0
                        ? <p style={{ fontSize: 13, color: C.gray, marginTop: 8 }}>Chưa có hình ảnh</p>
                        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                            {productImgs.map((url, i) => (
                              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                <img src={url} alt={`product-${i}`} style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)', cursor: 'pointer' }} />
                              </a>
                            ))}
                          </div>
                      }
                    </div>

                    {/* Giấy phép kinh doanh */}
                    <div style={{ paddingTop: 4, borderTop: '1px solid var(--border-subtle)', marginTop: 4 }}>
                      <span style={{ fontSize: 13, color: C.gray, fontWeight: 600 }}>🏛️ Giấy phép kinh doanh</span>
                      {licenseFiles.length === 0
                        ? <p style={{ fontSize: 13, color: C.gray, marginTop: 8 }}>Chưa nộp giấy phép</p>
                        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                            {licenseFiles.map((url, i) => {
                              const name = url.split('/').pop() || `Tệp ${i + 1}`
                              const ext = name.split('.').pop()?.toLowerCase()
                              const isImg = ['jpg','jpeg','png','webp','gif'].includes(ext || '')
                              const icon = ext === 'pdf' ? '📄' : ext === 'docx' || ext === 'doc' ? '📝' : '📎'
                              return isImg
                                ? <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                                    <img src={url} alt={name} style={{ width: 100, height: 100, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)', cursor: 'pointer' }} />
                                  </a>
                                : <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, width: 80, height: 80, borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--bg-highlight, rgba(0,0,0,0.03))', textDecoration: 'none', color: C.navy }}>
                                    <span style={{ fontSize: 28 }}>{icon}</span>
                                    <span style={{ fontSize: 10, fontWeight: 600, textAlign: 'center', padding: '0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', width: '100%' }}>{name}</span>
                                  </a>
                            })}
                          </div>
                      }
                    </div>
                  </>
                )}
              </div>

              {/* Footer */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, justifyContent: 'flex-end', flexShrink: 0 }}>
                <button onClick={() => setDetailReg(null)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Đóng</button>
                {item.status === 'pending' && (
                  <>
                    <button onClick={() => { handleApprove(id); setDetailReg(null) }}
                      style={{ padding: '8px 20px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✅ Duyệt</button>
                    <button onClick={() => { setDetailReg(null); setRejectModal(id); setRejectReason('') }}
                      style={{ padding: '8px 20px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>❌ Từ chối</button>
                  </>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* BuyZo Mall detail modal */}
      {detailMall && (() => {
        const p  = detailMall
        const id = p.product_id ?? p.reg_id
        const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
        return (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 5000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
            onClick={() => setDetailMall(null)}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 18, width: '100%', maxWidth: 560, boxShadow: '0 24px 72px rgba(0,0,0,0.3)', overflow: 'hidden' }}
              onClick={e => e.stopPropagation()}>

              {/* Header */}
              <div style={{ background: 'linear-gradient(135deg,#7C3AED,#4F46E5)', padding: '20px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, marginBottom: 4 }}>🏆 ĐƠN ĐĂNG KÝ BUYZO MALL</p>
                  <h2 style={{ fontSize: 18, fontWeight: 800, color: '#fff' }}>{p.shop_name ?? p.product_name}</h2>
                </div>
                <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
              </div>

              {/* Body */}
              <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[
                  ['👤 Chủ shop', `UID #${p.user_id}`],
                  ['📍 Địa chỉ',  p.address ?? '—'],
                  ['📅 Ngày nộp', p.created_at ?? '—'],
                  ['📦 Danh mục', p.category ?? 'Chưa rõ'],
                  ['📝 Ghi chú',  p.note ?? 'Không có ghi chú'],
                ].map(([label, value]) => (
                  <div key={label as string} style={{ display: 'flex', gap: 12, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
                    <span style={{ minWidth: 120, fontSize: 13, color: C.gray, fontWeight: 600 }}>{label}</span>
                    <span style={{ fontSize: 13, color: C.navy, fontWeight: 500 }}>{value}</span>
                  </div>
                ))}

                {/* Tài liệu đính kèm */}
                <div>
                  <p style={{ fontSize: 13, color: C.gray, fontWeight: 600, marginBottom: 8 }}>📎 Tài liệu đính kèm</p>
                  {p.files?.length ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {p.files.map((f: string, i: number) => (
                        <span key={i} style={{ fontSize: 12, padding: '4px 12px', borderRadius: 8, background: '#EEF2FF', color: '#4F46E5', fontWeight: 600 }}>📄 {f}</span>
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: 13, color: C.gray }}>Chưa có tài liệu</span>
                  )}
                </div>
              </div>

              {/* Footer actions */}
              <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button onClick={() => setDetailMall(null)} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Đóng</button>
                {p.status === 'pending' && (
                  <>
                    <button onClick={() => { handleApprove(id); setDetailMall(null) }}
                      style={{ padding: '8px 20px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>✅ Duyệt</button>
                    <button onClick={() => { setDetailMall(null); setRejectModal(id); setRejectReason('') }}
                      style={{ padding: '8px 20px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>❌ Từ chối</button>
                  </>
                )}
              </div>
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
