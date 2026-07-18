import React, { useEffect, useState, useRef } from 'react'
//import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import { shopService } from '../../services/shopService'
import { productService } from '../../services/productService'
import { formatCurrency } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import {
  bundleStore, promoStore, attributeStore, variantStore,
  BundleItem, ProductAttribute, VariantLocal, VariantAttr,
} from '../../utils/productBundleStore'
import { rejectionStore } from '../../utils/rejectionStore'
import { productApprovalStore } from '../../utils/productApprovalStore'
import Modal from '../common/Modal'
import Loading from '../common/Loading'

// ── helpers ──────────────────────────────────────────────────────
const fmtVnd = (raw: string | number) => {
  const n = Number(String(raw).replace(/\./g, ''))
  return raw === '' || raw === 0 || isNaN(n) ? '' : n.toLocaleString('vi-VN')
}
const withTimeout = <T,>(p: Promise<T>, ms = 15000): Promise<T> =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))])

// ── factories ─────────────────────────────────────────────────────
const uid = () => `${Date.now()}_${Math.random().toString(36).slice(2)}`
const newVariant = (): VariantLocal => ({ id: `v_${uid()}`, name: '', price: 0, stock: 0, image_urls: [], attrs: [], promos: [] })
const newVAttr   = (): VariantAttr  => ({ id: `va_${uid()}`, name: '', values: [] })
const newBundleItem = (): BundleItem => ({ id: `bi_${uid()}`, name: '', price: 0, stock_quantity: 0, image_urls: [], type: 'accessory', attrs: [] })

// ── constants ─────────────────────────────────────────────────────
const QUICK_ATTRS = ['Màu sắc', 'Kích thước', 'Chất liệu', 'Mẫu mã', 'Phong cách', 'Xuất xứ']
const BUNDLE_TYPES: { value: BundleItem['type']; label: string }[] = [
  { value: 'accessory', label: '📦 Sản phẩm đi kèm' },
  { value: 'gift',      label: '🎁 Hàng tặng kèm' },
]
const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:   { label: 'Đang bán',   color: 'var(--success)' },
  approved: { label: 'Sẵn sàng',    color: '#0EA5E9' },
  pending:  { label: 'Chờ duyệt',  color: 'var(--warning)' },
  rejected: { label: 'Bị từ chối', color: 'var(--error)'   },
  archived: { label: 'Đã xóa',     color: 'var(--gray-400)' },
}

const EMPTY_SIMPLE = {
  product_name: '', category_id: '' as string | number,
  price: 0, stock_quantity: 0, description: '',
  image_urls: [] as string[], video_url: '',
}

const EMPTY_FORM = {
  product_name: '',
  description: '',
  video_urls: [] as string[],
  category_id: '' as string | number,
}

const ProductManagement: React.FC = () => {
  const [products, setProducts]     = useState<any[]>([])
  const [categories, setCategories] = useState<{ category_id: number; category_name: string }[]>([])
  const [loading, setLoading]       = useState(true)
  const [modalOpen, setModalOpen]   = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [form, setForm]             = useState(EMPTY_FORM)

  // per-variant state
  const [localVariants, setLocalVariants]     = useState<VariantLocal[]>([newVariant()])
  const [variantUploading, setVariantUploading] = useState<string | null>(null)
  const variantFileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  // per-variant bundle image upload
  const [vBundleUploading, setVBundleUploading] = useState<string | null>(null)
  const vBundleFileRefs = useRef<Record<string, HTMLInputElement | null>>({})
  // attr label/price inputs keyed by `${variantId}__${attrId}`
  const [vLabelInput, setVLabelInput] = useState<Record<string, string>>({})
  const [vPriceInput, setVPriceInput] = useState<Record<string, string>>({})

  // global video upload
  const [videoUploading, setVideoUploading] = useState(false)
  const videoRef = useRef<HTMLInputElement>(null)

  // bundle items (global – not per-variant)
  const [bundleItems, setBundleItems]         = useState<BundleItem[]>([])
  const [bundleUploading, setBundleUploading] = useState<string | null>(null)
  const [bundleAttrInputs, setBundleAttrInputs] = useState<Record<string, string>>({})
  const bundleFileRefs = useRef<Record<string, HTMLInputElement | null>>({})

  // ── tab view mode ────────────────────────────────────────
  const [viewMode, setViewMode]                 = useState<'products' | 'ready' | 'combo' | 'gifts'>('products')
  const [statusFilter, setStatusFilter]         = useState<'all' | 'active' | 'pending' | 'rejected'>('all')
  const [comboExpandedId, setComboExpandedId]   = useState<number | null>(null)
  const [giftsExpandedId, setGiftsExpandedId]   = useState<number | null>(null)
  const [readyExpandedId, setReadyExpandedId]   = useState<number | null>(null)
  // ── simple add form ──────────────────────────────────────
  const [simpleModalOpen, setSimpleModalOpen]   = useState(false)
  const [simpleForm, setSimpleForm]             = useState({ ...EMPTY_SIMPLE })
  const [simplePriceInput, setSimplePriceInput] = useState('')
  const [simpleAttrs, setSimpleAttrs]           = useState<VariantAttr[]>([])
  const [simpleAttrValueInput, setSimpleAttrValueInput] = useState<Record<string, string>>({}) // key=attrId: label being typed
  const [simpleAttrPriceInput, setSimpleAttrPriceInput] = useState<Record<string, string>>({}) // key=attrId__valueIdx: formatted price
  const [simpleImgUploading, setSimpleImgUploading] = useState(false)
  const [simpleVideoUploading, setSimpleVideoUploading] = useState(false)
  const simpleImgRef   = useRef<HTMLInputElement>(null)
  const simpleVideoRef = useRef<HTMLInputElement>(null)
  // UI
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [hoverImg, setHoverImg]     = useState<{ url: string; x: number; y: number; name?: string; price?: number; type?: string; stock?: number } | null>(null)

  // ── mock seed ────────────────────────────────────────────────
  const seedMockData = () => {
    if (!localStorage.getItem('_shop_mock_seeded')) {
      // Chỉ seed rejection data cho mock products bị từ chối
      rejectionStore.save({ product_id: 105, rejected_at: new Date(Date.now() - 86400000).toISOString(), reason: 'Hình ảnh không rõ ràng, mô tả thiếu thông số kỹ thuật', violations: [{ label: 'Ảnh sản phẩm', note: 'Ảnh bị mờ, không thể hiện rõ sản phẩm', imageUrl: 'https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=400', imgMarkers: [{ x: 35, y: 45 }, { x: 70, y: 30 }] }, { label: 'Mô tả', note: 'Thiếu thông số RAM, dung lượng pin' }] })
      rejectionStore.save({ product_id: 106, rejected_at: new Date(Date.now() - 172800000).toISOString(), reason: 'Giá không hợp lệ so với thị trường', violations: [{ label: 'Giá bán', note: 'Giá cao hơn 300% so với giá tham chiếu thị trường' }] })
      localStorage.setItem('_shop_mock_seeded', '1')
    }
  }

  // ── load ──────────────────────────────────────────────────────
  const MOCK_PRODUCTS = [
    { product_id: 101, product_name: 'iPhone 15 Pro Max 256GB', shop_id: 1, price: '29000000', stock_quantity: 35, sales_count: 128, status: 'active',   image_urls: ['https://images.unsplash.com/photo-1695048133142-1a20484d2569?w=300'], description: 'iPhone 15 Pro Max chip A17 Pro, camera 48MP, titanium frame' },
    { product_id: 102, product_name: 'Samsung Galaxy S24 Ultra', shop_id: 1, price: '26000000', stock_quantity: 22, sales_count: 87,  status: 'active',   image_urls: ['https://images.unsplash.com/photo-1706807594948-d7c5d0d22efb?w=300'], description: 'Galaxy S24 Ultra bút S Pen, camera 200MP, AI Galaxy' },
    { product_id: 103, product_name: 'AirPods Pro (2nd Gen)',    shop_id: 1, price: '6500000',  stock_quantity: 60, sales_count: 214, status: 'active',   image_urls: ['https://images.unsplash.com/photo-1606841837239-c5a1a4a07af7?w=300'], description: 'AirPods Pro 2 chống ồn ANC, chip H2, USB-C' },
    { product_id: 104, product_name: 'MacBook Air M3 13"',       shop_id: 1, price: '32000000', stock_quantity: 12, sales_count: 0,   status: 'approved', image_urls: ['https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=300'], description: 'MacBook Air chip M3, 8GB RAM, 256GB SSD, màn 13.6"' },
    { product_id: 107, product_name: 'iPad Air M2 11"',           shop_id: 1, price: '18500000', stock_quantity: 20, sales_count: 0,   status: 'approved', image_urls: ['https://images.unsplash.com/photo-1585771724684-38269d6639fd?w=300'], description: 'iPad Air M2 chip M2, màn 11" Liquid Retina, USB-C' },
    { product_id: 108, product_name: 'Beats Studio Pro',          shop_id: 1, price: '8900000',  stock_quantity: 15, sales_count: 0,   status: 'pending',  image_urls: ['https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=300'], description: 'Beats Studio Pro Over-Ear, ANC, USB-C, 40h pin' },
    { product_id: 105, product_name: 'iPad Pro 12.9" M2',         shop_id: 1, price: '24000000', stock_quantity: 8,  sales_count: 0,   status: 'rejected', image_urls: ['https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=300'], description: 'iPad Pro 12.9 chip M2, màn Liquid Retina XDR' },
    { product_id: 106, product_name: 'Apple Watch Series 9',      shop_id: 1, price: '10500000', stock_quantity: 18, sales_count: 0,   status: 'rejected', image_urls: ['https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=300'], description: 'Apple Watch S9 chip S9, màn Always-On Retina' },
  ]

  const load = async () => {
    setLoading(true)
    seedMockData()
    try {
      const [pr, cr] = await Promise.all([shopService.getProducts(), productService.getCategories()])
      const apiProducts = pr.data.products || []
      const base = apiProducts.length > 0 ? apiProducts : MOCK_PRODUCTS
      // Áp dụng override status từ admin (approved/rejected)
      setProducts(productApprovalStore.applyToProducts(base))
      setCategories(cr.data.categories || [])
    } catch {
      setProducts(productApprovalStore.applyToProducts(MOCK_PRODUCTS))
    } finally { setLoading(false) }
  }
  useEffect(() => {
    load()
    // Lắng nghe khi admin duyệt/từ chối → reload ngay
    const handler = () => load()
    window.addEventListener('buyzo-product-status-changed', handler)
    return () => window.removeEventListener('buyzo-product-status-changed', handler)
  }, [])

  // ── open modal ───────────────────────────────────────────────
  const openAdd = () => {
    setEditProduct(null); setForm(EMPTY_FORM)
    const v = newVariant(); setLocalVariants([v])
    setBundleItems([]); setVLabelInput({}); setVPriceInput({}); setBundleAttrInputs({})
    setModalOpen(true)
  }
  const openEdit = (p: any) => {
    setEditProduct(p)
    setForm({ product_name: p.product_name, description: p.description || '', video_urls: p.video_urls || (p.video_url ? [p.video_url] : []), category_id: p.category_id ?? '' })
    const saved = variantStore.get(p.product_id)
    if (saved.length > 0) {
      setLocalVariants(saved)
    } else {
      // migrate legacy data to primary variant
      const legacyAttrs: ProductAttribute[] = attributeStore.get(p.product_id)
      const legacyPromos = promoStore.get(p.product_id)
      const primaryV: VariantLocal = {
        ...newVariant(),
        price: Number(p.price) || 0,
        stock: p.stock_quantity || 0,
        image_urls: p.image_urls || [],
        attrs: legacyAttrs.map(a => ({ id: a.id, name: a.name, values: a.values.map(lbl => ({ label: lbl, price_delta: 0 })) })),
        promos: legacyPromos,
      }
      setLocalVariants([primaryV])
    }
    setBundleItems(bundleStore.get(p.product_id))
    setVLabelInput({}); setVPriceInput({}); setBundleAttrInputs({})
    setModalOpen(true)
  }

  const MAX_IMAGES = 5

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setLoading(true)
    try {
      const res = await productService.uploadImage(file)
      const url: string = res.data?.url || res.data
      setForm(f => ({ ...f, image_urls: [url] }))
    } catch {
      toast.error('Upload ảnh thất bại')
    } finally {
      setLoading(false)
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    const pv = localVariants[0]
    if (!form.product_name.trim()) { toast.error('Nhập tên sản phẩm'); return }
    if (!pv || pv.price <= 0) { toast.error('Nhập giá cho phiên bản chính'); return }
    try {
      const payload: any = {
        product_name: form.product_name,
        description: form.description,
        category_id: form.category_id !== '' ? Number(form.category_id) : undefined,
        video_url: form.video_urls[0] || '',
        price: pv.price,
        stock_quantity: pv.stock,
        image_urls: pv.image_urls,
      }
      if (editProduct) {
        await productService.update(editProduct.product_id, payload)
        variantStore.save(editProduct.product_id, localVariants)
        bundleStore.save(editProduct.product_id, bundleItems)
        toast.success('Đã cập nhật sản phẩm')
      } else {
        const res = await productService.create(payload)
        const newId: number = res.data?.product_id || res.data?.id
        if (newId) {
          variantStore.save(newId, localVariants)
          if (bundleItems.length > 0) bundleStore.save(newId, bundleItems)
        }
        toast.success('Đã thêm sản phẩm, chờ duyệt')
      }
      setModalOpen(false); load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi khi lưu') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa sản phẩm này?')) return
    try {
      await productService.delete(id)
      variantStore.remove(id); bundleStore.remove(id); promoStore.remove(id); attributeStore.remove(id)
      if (expandedId === id) setExpandedId(null)
      toast.success('Đã xóa'); load()
    } catch { toast.error('Lỗi xóa') }
  }

  if (loading) return <Loading />

  // ── render ───────────────────────────────────────────────────
  const approvedCount = products.filter(p => p.status === 'approved').length
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 style={{ fontWeight: 700, fontSize: 18 }}>Sản phẩm ({products.length})</h2>
          {/* Quick badge: active count */}
          {products.filter(p => p.status === 'active').length > 0 && (
            <button
              onClick={() => { setViewMode('products'); setStatusFilter('active') }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: '#F0FDF4', color: 'var(--success)', border: '1.5px solid var(--success)', cursor: 'pointer' }}>
              🟢 {products.filter(p => p.status === 'active').length} đang bán
            </button>
          )}
          {products.filter(p => p.status === 'pending').length > 0 && (
            <button
              onClick={() => { setViewMode('products'); setStatusFilter('pending') }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: '#FFFBEB', color: 'var(--warning)', border: '1.5px solid var(--warning)', cursor: 'pointer' }}>
              ⏳ {products.filter(p => p.status === 'pending').length} chờ duyệt
            </button>
          )}
          {approvedCount > 0 && (
            <button
              onClick={() => setViewMode('ready')}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: '#E0F2FE', color: '#0EA5E9', border: '1.5px solid #0EA5E9', cursor: 'pointer',
                boxShadow: '0 0 0 3px #BAE6FD' }}>
              ✅ {approvedCount} sẵn sàng bán
            </button>
          )}
          {products.filter(p => p.status === 'rejected').length > 0 && (
            <button
              onClick={() => { setViewMode('products'); setStatusFilter('rejected') }}
              style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                background: '#FEF2F2', color: 'var(--error)', border: '1.5px solid var(--error)', cursor: 'pointer' }}>
              ❌ {products.filter(p => p.status === 'rejected').length} bị từ chối
            </button>
          )}
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Thêm sản phẩm</button>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border-subtle)' }}>
        {([
          { key: 'products', icon: '🛍️', label: 'Sản phẩm đang bán' },
          { key: 'ready',    icon: '✅', label: approvedCount > 0 ? `Sẵn sàng bán (${approvedCount})` : 'Sẵn sàng bán' },
          { key: 'combo',    icon: '🔀', label: 'Danh sách combo' },
          { key: 'gifts',    icon: '🎁', label: 'Sản phẩm tặng kèm' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setViewMode(tab.key)}
            style={{ padding: '10px 20px', fontWeight: viewMode === tab.key ? 700 : 500, fontSize: 14,
              borderBottom: viewMode === tab.key ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              color: viewMode === tab.key ? (tab.key === 'ready' ? '#0EA5E9' : 'var(--primary)') : (tab.key === 'ready' && approvedCount ? '#0EA5E9' : 'var(--gray-500)'),
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 0.15s', marginBottom: -2 }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Sản phẩm đang bán ── */}
      {viewMode === 'products' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {(() => {
          const filtered = statusFilter === 'all' ? products : products.filter(p => p.status === statusFilter)
          return <>
            {filtered.length === 0 && (
              <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>
                {statusFilter === 'active'   && 'Chưa có sản phẩm nào được duyệt'}
                {statusFilter === 'pending'  && 'Không có sản phẩm nào đang chờ duyệt'}
                {statusFilter === 'rejected' && 'Không có sản phẩm nào bị từ chối'}
                {statusFilter === 'all'      && 'Chưa có sản phẩm nào'}
              </div>
            )}
            {filtered.map(p => {
          const isExpanded = expandedId === p.product_id
          const items  = bundleStore.get(p.product_id)
          const variants = variantStore.get(p.product_id)
          const pAttrs = attributeStore.get(p.product_id)
          const rejection = rejectionStore.get(p.product_id)
          const displayPrice = variants[0]?.price || p.price
          const displayStock = variants[0]?.stock ?? p.stock_quantity
          const displayImgs  = variants[0]?.image_urls?.length ? variants[0].image_urls : (p.image_urls || [])
          const totalPromos      = variants.reduce((s, v) => s + (v.promos?.length || 0), 0)
          const totalAttrs       = variants.reduce((s, v) => s + (v.attrs?.length || 0), 0)
          const totalBundleItems = variants.reduce((s, v) => s + (v.bundleItems?.length || 0), 0) + items.length

          return (
            <div key={p.product_id} className="card" style={{ overflow: 'hidden', transition: 'box-shadow 0.15s' }}>

              {/* ── Compact row ── */}
              <div onClick={() => setExpandedId(isExpanded ? null : p.product_id)}
                style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                <div style={{ width: 56, height: 56, borderRadius: 10, flexShrink: 0, overflow: 'hidden', background: 'var(--bg-page)', border: '1.5px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {displayImgs[0] ? <img src={getImageUrl(displayImgs[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 24 }}>🛍️</span>}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{p.product_name}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (STATUS_MAP[p.status]?.color || 'var(--gray-400)') + '18', color: STATUS_MAP[p.status]?.color || 'var(--gray-400)' }}>
                      {STATUS_MAP[p.status]?.label || p.status}
                    </span>
                    {variants.length > 1 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#EEF2FF', color: '#4F46E5' }}>🔀 {variants.length} phiên bản</span>}
                    {totalPromos > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEF3C7', color: '#D97706' }}>🎯 {totalPromos} deal</span>}
                    {totalAttrs > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F5F3FF', color: '#7C3AED' }}>🏷️ {totalAttrs} thuộc tính</span>}
                    {totalBundleItems > 0 && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#F0FDF4', color: 'var(--success)' }}>🎁 {totalBundleItems} kèm</span>}
                    {rejection && p.status === 'rejected' && <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: '#FEE2E2', color: 'var(--error)', cursor: 'pointer' }} onClick={e => { e.stopPropagation(); setExpandedId(p.product_id) }}>🚩 {rejection.violations.length} vi phạm admin</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {products.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Chưa có sản phẩm nào</p>}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm'}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Ảnh sản phẩm */}
          <div>
            <label className="input-label">Ảnh sản phẩm</label>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {/* Preview */}
              <div style={{
                width: 80, height: 80, borderRadius: 8, flexShrink: 0,
                border: '1.5px dashed var(--border-subtle)',
                background: 'var(--bg-page)',
                overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {form.image_urls[0]
                  ? <img src={getImageUrl(form.image_urls[0])} alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ fontSize: 28, color: 'var(--gray-400)' }}>🖼️</span>
                }
              </div>
              {/* Upload controls */}
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'inline-block', padding: '7px 14px',
                  background: uploading ? 'var(--gray-200)' : 'var(--primary)',
                  color: uploading ? 'var(--gray-500)' : '#fff',
                  borderRadius: 6, fontSize: 13, fontWeight: 600,
                  cursor: uploading ? 'not-allowed' : 'pointer',
                }}>
                  {uploading ? 'Đang tải...' : '📁 Chọn ảnh'}
                  <input type="file" accept="image/*" style={{ display: 'none' }} disabled={uploading} onChange={handleImageChange} />
                </label>
                {form.image_urls[0] && (
                  <button
                    onClick={() => setForm(f => ({ ...f, image_urls: [] }))}
                    style={{ marginLeft: 8, background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 13 }}
                  >✕ Xóa ảnh</button>
                )}
                <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 5 }}>JPG, PNG, WebP — tối đa 5MB</p>
              </div>
            </div>
          </div>

          {[
            { label: 'Tên sản phẩm', key: 'product_name', type: 'text' },
            { label: 'Giá (VND)', key: 'price', type: 'number' },
            { label: 'Số lượng tồn kho', key: 'stock_quantity', type: 'number' },
          ].map(({ label, key, type }) => (
            <div key={key}>
              <label className="input-label">{label}</label>
              <input className="input" type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="input-label">Mô tả</label>
            <textarea className="input" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
          </div>

          {/* Danh mục */}
          <div>
            <label className="input-label">Danh mục</label>
            <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">-- Chọn danh mục --</option>
              {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
            </select>
          </div>

          {/* Hình ảnh sản phẩm (primary variant) */}
          <div>
            <label className="input-label">Hình ảnh sản phẩm <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 11 }}>(ảnh chính – phiên bản đầu tiên)</span></label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {(localVariants[0]?.image_urls || []).map((url, ii) => (
                <div key={ii} style={{ position: 'relative', width: 80, height: 80, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border-subtle)', flexShrink: 0 }}>
                  <img src={getImageUrl(url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button type="button" onClick={() => updateVariant(localVariants[0].id, { image_urls: localVariants[0].image_urls.filter((_, i) => i !== ii) })}
                    style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 12, lineHeight: '18px', cursor: 'pointer', padding: 0 }}>×</button>
                </div>
              ))}
              <label style={{ width: 80, height: 80, borderRadius: 8, border: '1.5px dashed var(--primary)', background: variantUploading === localVariants[0]?.id ? 'var(--gray-100)' : 'var(--bg-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: variantUploading === localVariants[0]?.id ? 'not-allowed' : 'pointer', gap: 2, flexShrink: 0 }}>
                <span style={{ fontSize: 22, color: 'var(--primary)' }}>{variantUploading === localVariants[0]?.id ? '⏳' : '+'}</span>
                <span style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 600 }}>Thêm ảnh</span>
                <input type="file" accept="image/*" multiple style={{ display: 'none' }}
                  disabled={variantUploading === localVariants[0]?.id}
                  onChange={e => handleVariantImageChange(e, localVariants[0].id)} />
              </label>
            </div>
          </div>

          {/* Video */}
          <div>
            <label className="input-label">Video sản phẩm (tuỳ chọn)</label>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {form.video_urls.map((url, idx) => (
                <div key={idx} style={{ position: 'relative', width: 120, height: 80, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border-subtle)', background: '#000', flexShrink: 0 }}>
                  <video src={url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                  <button onClick={() => setForm(f => ({ ...f, video_urls: f.video_urls.filter((_, i) => i !== idx) }))} style={{ position: 'absolute', top: 2, right: 2, width: 20, height: 20, borderRadius: '50%', background: 'rgba(0,0,0,0.7)', border: 'none', color: '#fff', fontSize: 13, lineHeight: '20px', cursor: 'pointer', padding: 0 }}>×</button>
                </div>
              ))}
              <label style={{ width: 120, height: 80, borderRadius: 8, border: '1.5px dashed var(--primary)', background: videoUploading ? 'var(--gray-100)' : 'var(--bg-page)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: videoUploading ? 'not-allowed' : 'pointer', flexShrink: 0, gap: 2 }}>
                <span style={{ fontSize: 22, color: videoUploading ? 'var(--gray-400)' : 'var(--primary)' }}>{videoUploading ? '⏳' : '🎬'}</span>
                <span style={{ fontSize: 10, color: videoUploading ? 'var(--gray-400)' : 'var(--primary)', fontWeight: 600 }}>{videoUploading ? 'Đang tải...' : 'Thêm video'}</span>
                <input ref={videoRef} type="file" accept="video/*" multiple style={{ display: 'none' }} disabled={videoUploading} onChange={handleVideoAdd} />
              </label>
            </div>
          </div>

          {/* ══════════════════════════════════════════════
              PHIÊN BẢN SẢN PHẨM
              ══════════════════════════════════════════════ */}
          <div style={{ borderTop: '2px solid var(--primary)', paddingTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div>
                <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--primary)' }}>🔀 Phiên bản sản phẩm</p>
                <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>Mỗi phiên bản có giá riêng · thuộc tính riêng · ưu đãi riêng</p>
              </div>
              <button type="button" onClick={addVariant} style={{ padding: '7px 14px', borderRadius: 8, border: '2px solid var(--primary)', background: 'white', color: 'var(--primary)', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                + Thêm phiên bản
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {localVariants.map((v, vIdx) => (
                <div key={v.id} style={{ borderRadius: 14, border: `2px solid ${vIdx === 0 ? 'var(--primary)' : 'var(--border-subtle)'}`, overflow: 'hidden' }}>

                  {/* Header */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 16px', background: vIdx === 0 ? 'var(--primary)' : '#F1F5F9' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: vIdx === 0 ? 'white' : 'var(--gray-700)' }}>
                        📦 Phiên bản #{vIdx + 1}{vIdx === 0 ? ' — Chính' : ''}
                      </span>
                    </div>
                    {localVariants.length > 1 && (
                      <button type="button" onClick={() => removeVariant(v.id)} style={{ background: vIdx === 0 ? 'rgba(255,255,255,0.2)' : 'none', border: 'none', color: vIdx === 0 ? 'white' : 'var(--error)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '2px 8px', borderRadius: 6, fontWeight: 700 }}>× Xóa</button>
                    )}
                  </div>

                  {/* Body */}
                  <div style={{ padding: '14px 16px', background: vIdx === 0 ? '#F0FDF4' : 'white', display: 'flex', flexDirection: 'column', gap: 12 }}>

                    {/* Tên phiên bản */}
                    <input className="input" placeholder={vIdx === 0 ? 'Tên phiên bản (vd: Phiên bản cơ bản, Màu đen, Size M)' : 'Tên phiên bản (vd: Màu trắng, Size XL, Chất liệu titan)'}
                      value={v.name} onChange={e => updateVariant(v.id, { name: e.target.value })} style={{ fontSize: 14, fontWeight: 600 }} />

                    {/* Ảnh + Giá + Tồn kho (row) */}
                    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                      {/* Ảnh */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)' }}>Ảnh</span>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', maxWidth: 220 }}>
                          {(v.image_urls || []).map((url, ii) => (
                            <div key={ii} style={{ position: 'relative', width: 60, height: 60, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border-subtle)', flexShrink: 0 }}>
                              <img src={getImageUrl(url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              <button type="button" onClick={() => updateVariant(v.id, { image_urls: v.image_urls.filter((_, i) => i !== ii) })}
                                style={{ position: 'absolute', top: 2, right: 2, width: 16, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 11, lineHeight: '16px', cursor: 'pointer', padding: 0 }}>×</button>
                            </div>
                          ))}
                          <label style={{ width: 60, height: 60, borderRadius: 8, border: '1.5px dashed var(--primary)', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: variantUploading === v.id ? 'not-allowed' : 'pointer', gap: 2, flexShrink: 0 }}>
                            {variantUploading === v.id ? <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>⏳</span> : <><span style={{ fontSize: 18, color: 'var(--primary)' }}>+</span><span style={{ fontSize: 9, color: 'var(--primary)', fontWeight: 600 }}>Ảnh</span></>}
                            <input ref={el => { variantFileRefs.current[v.id] = el }} type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={variantUploading === v.id} onChange={e => handleVariantImageChange(e, v.id)} />
                          </label>
                        </div>
                      </div>

                      {/* Giá + Tồn */}
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', display: 'block', marginBottom: 4 }}>Giá (VND)</label>
                          <input className="input" type="text" inputMode="numeric" placeholder="0"
                            value={fmtVnd(v.price)}
                            onChange={e => {
                              const raw = e.target.value.replace(/\./g, '').replace(/[^0-9]/g, '')
                              updateVariant(v.id, { price: raw === '' ? 0 : Math.max(0, Number(raw)) })
                            }}
                            style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', display: 'block', marginBottom: 4 }}>Tồn kho</label>
                          <input className="input" type="text" inputMode="numeric" placeholder="0"
                            value={v.stock === 0 ? '' : String(v.stock)}
                            onChange={e => {
                              const raw = e.target.value.replace(/[^0-9]/g, '')
                              updateVariant(v.id, { stock: raw === '' ? 0 : Math.max(0, Number(raw)) })
                            }}
                            style={{ fontSize: 18, fontWeight: 700 }} />
                        </div>
                      </div>
                    </div>

                    {/* ── Thuộc tính (per-variant, with pricing) ── */}
                    <div style={{ paddingTop: 10, borderTop: '1.5px dashed var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.4 }}>🏷️ Thuộc tính</span>
                        <button type="button" onClick={() => addVAttr(v.id)} style={{ padding: '3px 10px', borderRadius: 6, border: '1.5px solid var(--primary)', background: 'white', color: 'var(--primary)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Thêm thuộc tính</button>
                      </div>
                      {/* Quick presets */}
                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                        {QUICK_ATTRS.map(q => {
                          const has = v.attrs.some(a => a.name === q)
                          return (
                            <button key={q} type="button"
                              onClick={() => { if (!has) { const a = newVAttr(); updateVariant(v.id, { attrs: [...v.attrs, { ...a, name: q }] }) } }}
                              style={{ padding: '3px 10px', borderRadius: 20, border: `1.5px solid ${has ? 'var(--primary)' : 'var(--border-subtle)'}`, background: has ? 'var(--primary)' : 'white', color: has ? '#fff' : 'var(--gray-600)', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                              {q}
                            </button>
                          )
                        })}
                      </div>
                      {v.attrs.length === 0 && <p style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>Chọn nhanh hoặc bấm "+ Thêm thuộc tính"</p>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {v.attrs.map(attr => {
                          const k = `${v.id}__${attr.id}`
                          return (
                            <div key={attr.id} style={{ background: vIdx === 0 ? 'white' : 'var(--bg-page)', borderRadius: 10, padding: '10px 12px', border: '1px solid var(--border-subtle)' }}>
                              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
                                <input value={attr.name}
                                  onChange={e => updateVariant(v.id, { attrs: v.attrs.map(a => a.id === attr.id ? { ...a, name: e.target.value } : a) })}
                                  placeholder="Tên thuộc tính (vd: Chất liệu, Màu sắc)"
                                  className="input" style={{ flex: 1, fontSize: 13, fontWeight: 600 }} />
                                <button type="button" onClick={() => removeVAttr(v.id, attr.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '2px 4px' }}>×</button>
                              </div>
                              {/* Value chips */}
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 8 }}>
                                {attr.values.map((av, avi) => (
                                  <span key={avi} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 10px 3px 12px', background: '#EDE9FE', color: '#6D28D9', borderRadius: 20, fontSize: 12, fontWeight: 600 }}>
                                    {av.label}
                                    {av.price_delta !== 0 && <span style={{ fontSize: 10, color: av.price_delta > 0 ? '#16A34A' : '#DC2626', marginLeft: 2 }}>({av.price_delta > 0 ? '+' : ''}{formatCurrency(av.price_delta)})</span>}
                                    <button type="button" onClick={() => removeVAttrValue(v.id, attr.id, avi)} style={{ background: 'none', border: 'none', color: '#7C3AED', cursor: 'pointer', fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2 }}>×</button>
                                  </span>
                                ))}
                                {attr.values.length === 0 && <span style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>Chưa có giá trị</span>}
                              </div>
                              {/* Add value: label + price delta */}
                              <div style={{ display: 'flex', gap: 5 }}>
                                <input value={vLabelInput[k] || ''}
                                  onChange={e => setVLabelInput(p => ({ ...p, [k]: e.target.value }))}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVAttrValue(v.id, attr.id) } }}
                                  placeholder="Giá trị (vd: Gỗ, Sắt, Titan)"
                                  className="input" style={{ flex: 1, fontSize: 12, padding: '6px 10px' }} />
                                <input value={vPriceInput[k] || ''}
                                  onChange={e => {
                                    const raw = e.target.value
                                    const sign = raw.startsWith('-') ? '-' : ''
                                    const digits = raw.replace(/[^0-9]/g, '')
                                    const num = digits === '' ? '' : Number(digits).toLocaleString('vi-VN')
                                    setVPriceInput(p => ({ ...p, [k]: sign + num }))
                                  }}
                                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addVAttrValue(v.id, attr.id) } }}
                                  placeholder="+/- giá (vd: 5.000)"
                                  className="input" type="text" inputMode="numeric"
                                  style={{ width: 130, fontSize: 12, padding: '6px 10px' }} />
                                <button type="button" onClick={() => addVAttrValue(v.id, attr.id)}
                                  style={{ padding: '6px 12px', background: '#7C3AED', color: '#fff', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>+ Thêm</button>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* ── Ưu đãi (per-variant) ── */}
                    <div style={{ paddingTop: 10, borderTop: '1.5px dashed var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.4 }}>🎯 Ưu đãi cho phiên bản này</span>
                        <button type="button" onClick={() => addVPromo(v.id)} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#1D4ED8', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Thêm deal</button>
                      </div>
                      {v.promos.length === 0 && <p style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>Chưa có ưu đãi</p>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {v.promos.map(rule => (
                          <div key={rule.id} style={{ background: rule.type === 'buy_get_free' ? '#FFFBEB' : '#EFF6FF', borderRadius: 10, padding: '10px 12px', border: `1.5px solid ${rule.type === 'buy_get_free' ? '#FDE68A' : '#BFDBFE'}` }}>
                            <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                              <button type="button" onClick={() => updateVPromo(v.id, rule.id, { type: 'buy_get_free' })}
                                style={{ flex: 1, padding: '5px 8px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: rule.type === 'buy_get_free' ? '2px solid #D97706' : '2px solid var(--border-subtle)', background: rule.type === 'buy_get_free' ? '#F59E0B' : 'white', color: rule.type === 'buy_get_free' ? '#fff' : 'var(--gray-500)' }}>
                                🎁 Tặng miễn phí
                              </button>
                              <button type="button" onClick={() => updateVPromo(v.id, rule.id, { type: 'buy_pay_less' })}
                                style={{ flex: 1, padding: '5px 8px', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer', border: rule.type === 'buy_pay_less' ? '2px solid #1D4ED8' : '2px solid var(--border-subtle)', background: rule.type === 'buy_pay_less' ? '#1D4ED8' : 'white', color: rule.type === 'buy_pay_less' ? '#fff' : 'var(--gray-500)' }}>
                                💰 Giảm số tiền tính
                              </button>
                              <button type="button" onClick={() => removeVPromo(v.id, rule.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: '0 4px' }}>×</button>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>Mua</span>
                              <input type="text" inputMode="numeric" value={rule.buy_qty === 0 ? '' : String(rule.buy_qty)}
                                onChange={e => { const val = Number(e.target.value.replace(/[^0-9]/g, '')); updateVPromo(v.id, rule.id, { buy_qty: Math.max(1, val || 1) }) }}
                                style={{ width: 56, padding: '5px 8px', border: '1.5px solid var(--border-subtle)', borderRadius: 7, fontSize: 17, fontWeight: 800, textAlign: 'center', color: 'var(--primary)', background: 'white' }} />
                              <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-700)' }}>{rule.type === 'buy_get_free' ? 'sp → tặng thêm' : 'sp → tính tiền'}</span>
                              <input type="text" inputMode="numeric" value={rule.bonus_qty === 0 ? '' : String(rule.bonus_qty)}
                                onChange={e => { const val = Number(e.target.value.replace(/[^0-9]/g, '')); updateVPromo(v.id, rule.id, { bonus_qty: Math.max(1, val || 1) }) }}
                                style={{ width: 56, padding: '5px 8px', border: '1.5px solid var(--border-subtle)', borderRadius: 7, fontSize: 17, fontWeight: 800, textAlign: 'center', color: rule.type === 'buy_get_free' ? '#D97706' : '#1D4ED8', background: 'white' }} />
                              <span style={{ fontSize: 13, fontWeight: 700, color: rule.type === 'buy_get_free' ? '#D97706' : '#1D4ED8' }}>{rule.type === 'buy_get_free' ? 'miễn phí 🎁' : 'sản phẩm 💰'}</span>
                              <div style={{ marginLeft: 'auto', padding: '4px 10px', background: 'white', borderRadius: 7, fontSize: 11, fontWeight: 600, color: rule.type === 'buy_get_free' ? '#92400E' : '#1E40AF' }}>
                                ✨ {promoLabel(rule)}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* ── Hàng tặng kèm (per-variant) ── */}
                    <div style={{ paddingTop: 10, borderTop: '1.5px dashed var(--border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--gray-600)', textTransform: 'uppercase', letterSpacing: 0.4 }}>🎁 Hàng tặng kèm phiên bản này</span>
                        <button type="button" onClick={() => addVBundle(v.id)} style={{ padding: '3px 10px', borderRadius: 6, border: 'none', background: '#F59E0B', color: '#fff', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>+ Thêm quà</button>
                      </div>
                      {(v.bundleItems || []).length === 0 && <p style={{ fontSize: 11, color: 'var(--gray-400)', fontStyle: 'italic' }}>Chưa có hàng tặng kèm cho phiên bản này</p>}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {(v.bundleItems || []).map(bi => (
                          <div key={bi.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, background: bi.type === 'gift' ? '#FFFBEB' : 'white', borderRadius: 9, padding: '8px 10px', border: `1.5px solid ${bi.type === 'gift' ? '#FDE68A' : 'var(--border-subtle)'}` }}>
                            {/* Images row */}
                            {(bi.image_urls || []).length > 0 && (
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                {(bi.image_urls || []).map((url, imgIdx) => (
                                  <div key={imgIdx} style={{ position: 'relative', width: 46, height: 46, borderRadius: 6, overflow: 'hidden', border: '1.5px solid var(--border-subtle)', flexShrink: 0 }}>
                                    <img src={getImageUrl(url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    <button type="button" onClick={() => updateVBundle(v.id, bi.id, { image_urls: (bi.image_urls || []).filter((_, i) => i !== imgIdx) })}
                                      style={{ position: 'absolute', top: 1, right: 1, width: 15, height: 15, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', fontSize: 10, lineHeight: '15px', cursor: 'pointer', padding: 0 }}>×</button>
                                  </div>
                                ))}
                              </div>
                            )}
                            {/* Controls row */}
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              {/* Image upload */}
                              <label style={{ width: 38, height: 38, borderRadius: 6, border: '1.5px dashed var(--primary)', background: 'white', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: vBundleUploading === `${v.id}__${bi.id}` ? 'not-allowed' : 'pointer', flexShrink: 0, gap: 1 }}>
                                {vBundleUploading === `${v.id}__${bi.id}` ? <span style={{ fontSize: 10 }}>⏳</span> : <><span style={{ fontSize: 14, color: 'var(--primary)', lineHeight: 1 }}>+</span><span style={{ fontSize: 8, color: 'var(--primary)', fontWeight: 700 }}>Ảnh</span></>}
                                <input ref={el => { vBundleFileRefs.current[`${v.id}__${bi.id}`] = el }} type="file" accept="image/*" multiple style={{ display: 'none' }}
                                  disabled={vBundleUploading === `${v.id}__${bi.id}`}
                                  onChange={e => handleVBundleImageChange(e, v.id, bi.id)} />
                              </label>
                              {/* Type toggles */}
                              <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
                                <button type="button" onClick={() => updateVBundle(v.id, bi.id, { type: 'gift' })} style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: bi.type === 'gift' ? '2px solid #D97706' : '2px solid var(--border-subtle)', background: bi.type === 'gift' ? '#F59E0B' : 'white', color: bi.type === 'gift' ? '#fff' : 'var(--gray-500)' }}>🎁 Tặng</button>
                                <button type="button" onClick={() => updateVBundle(v.id, bi.id, { type: 'accessory' })} style={{ padding: '2px 7px', borderRadius: 5, fontSize: 10, fontWeight: 700, cursor: 'pointer', border: bi.type === 'accessory' ? '2px solid var(--primary)' : '2px solid var(--border-subtle)', background: bi.type === 'accessory' ? 'var(--primary)' : 'white', color: bi.type === 'accessory' ? '#fff' : 'var(--gray-500)' }}>📦 Kèm</button>
                              </div>
                              <input className="input" placeholder="Tên" value={bi.name} onChange={e => updateVBundle(v.id, bi.id, { name: e.target.value })} style={{ flex: 1, fontSize: 12, padding: '5px 8px' }} />
                              <input className="input" type="number" inputMode="numeric" placeholder="Số lượng" min={0}
                                value={bi.stock_quantity === 0 ? '' : bi.stock_quantity}
                                onChange={e => updateVBundle(v.id, bi.id, { stock_quantity: e.target.value === '' ? 0 : Number(e.target.value) })}
                                style={{ width: 100, fontSize: 12, padding: '5px 8px' }} />
                              <button type="button" onClick={() => removeVBundle(v.id, bi.id)} style={{ background: 'none', border: 'none', color: 'var(--error)', cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: '0 2px', flexShrink: 0 }}>×</button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Footer buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', paddingTop: 4 }}>
            {/* Excel upload – left side */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 8, border: '1.5px solid #16A34A', background: '#F0FDF4', color: '#16A34A', fontSize: 13, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              📊 Upload Excel
              <input ref={excelRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleExcelUpload} />
            </label>
            <span style={{ fontSize: 11, color: 'var(--gray-400)', flexShrink: 0 }}>Điền nhanh từ file .xlsx</span>
            <div style={{ flex: 1 }} />
            <button type="button" onClick={() => setModalOpen(false)} className="btn btn-ghost">Hủy</button>
            <button type="button" onClick={handleSave} className="btn btn-primary" disabled={variantUploading !== null || videoUploading}>
              {editProduct ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ProductManagement
