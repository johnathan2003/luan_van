import React, { useEffect, useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { toast } from 'react-toastify'
import { shopService } from '../../services/shopService'
import { productService } from '../../services/productService'
import { formatCurrency } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import {
  bundleStore, promoStore, attributeStore, variantStore,
  BundleItem, ProductAttribute, VariantLocal, VariantAttr,
} from '../../utils/productBundleStore'
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
  const [viewMode, setViewMode]                 = useState<'products' | 'combo' | 'gifts'>('products')
  const [statusFilter, setStatusFilter]         = useState<'all' | 'active' | 'pending' | 'rejected'>('all')
  const [comboExpandedId, setComboExpandedId]   = useState<number | null>(null)
  const [giftsExpandedId, setGiftsExpandedId]   = useState<number | null>(null)
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

  // ── load ──────────────────────────────────────────────────────
  const load = async () => {
    setLoading(true)
    try {
      const [pr, cr] = await Promise.all([shopService.getProducts(), productService.getCategories()])
      setProducts(pr.data.products)
      setCategories(cr.data.categories || [])
    } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

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

  // ── simple add ──────────────────────────────────────────────────────
  const openSimpleAdd = () => { setSimpleForm({ ...EMPTY_SIMPLE }); setSimplePriceInput(''); setSimpleAttrs([]); setSimpleAttrValueInput({}); setSimpleAttrPriceInput({}); setSimpleModalOpen(true) }

  const handleSimpleSave = async () => {
    const rawPrice = Number(simplePriceInput.replace(/\./g, '').replace(/[^0-9]/g, '')) || simpleForm.price
    if (!simpleForm.product_name.trim()) { toast.error('Nhập tên sản phẩm'); return }
    if (rawPrice <= 0) { toast.error('Nhập giá sản phẩm'); return }
    try {
      const res = await withTimeout(productService.create({ product_name: simpleForm.product_name, category_id: Number(simpleForm.category_id) || undefined, price: rawPrice, stock_quantity: simpleForm.stock_quantity, description: simpleForm.description, image_urls: simpleForm.image_urls, video_url: simpleForm.video_url }))
      const newId: number = res.data?.product_id || res.data?.id
      if (newId && simpleAttrs.length > 0) {
        // Save attrs as legacy format for display in product card
        attributeStore.save(newId, simpleAttrs.map(a => ({ id: a.id, name: a.name, values: a.values.map(v => v.label) })))
        // Also save as first variant with attrs
        variantStore.save(newId, [{ ...newVariant(), price: rawPrice, stock: simpleForm.stock_quantity, image_urls: simpleForm.image_urls, attrs: simpleAttrs }])
      }
      toast.success('Đã gửi sản phẩm để admin duyệt!')
      setSimpleModalOpen(false); load()
    } catch (err: any) { toast.error(err?.response?.data?.detail || 'Không thể tạo sản phẩm') }
  }

  const handleSimpleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (!files.length) return
    setSimpleImgUploading(true)
    try {
      const urls = await Promise.all(files.map(f => withTimeout(productService.uploadImage(f)).then(r => r.data?.url || r.data)))
      setSimpleForm(f => ({ ...f, image_urls: [...f.image_urls, ...urls] }))
    } catch { toast.error('Upload ảnh thất bại') }
    finally { setSimpleImgUploading(false); e.target.value = '' }
  }

  const handleSimpleVideoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (!files.length) return
    setSimpleVideoUploading(true)
    try {
      const urls = await Promise.all(files.map(f => withTimeout(productService.uploadImage(f)).then(r => r.data?.url || r.data)))
      setSimpleForm(f => ({ ...f, video_url: urls[0] || '' }))
      toast.success('Upload video OK')
    } catch { toast.error('Upload video thất bại') }
    finally { setSimpleVideoUploading(false); e.target.value = '' }
  }

  // ── variant helpers ──────────────────────────────────────────
  const updateVariant = (id: string, patch: Partial<VariantLocal>) =>
    setLocalVariants(p => p.map(v => v.id === id ? { ...v, ...patch } : v))

  const addVariant = () => setLocalVariants(p => [...p, newVariant()])
  const removeVariant = (id: string) => setLocalVariants(p => p.filter(v => v.id !== id))

  const handleVariantImageChange = async (e: React.ChangeEvent<HTMLInputElement>, varId: string) => {
    const files = Array.from(e.target.files || []); if (!files.length) return
    setVariantUploading(varId)
    try {
      const results = await Promise.all(files.map(f => withTimeout(productService.uploadImage(f)).then(r => r.data?.url || r.data)))
      updateVariant(varId, { image_urls: [...(localVariants.find(v => v.id === varId)?.image_urls || []), ...results] })
    } catch (err: any) { toast.error(err?.message === 'timeout' ? 'Upload quá 15 giây' : 'Upload ảnh thất bại') }
    finally { setVariantUploading(null); e.target.value = '' }
  }

  const addVAttr = (varId: string) => {
    const attr = newVAttr()
    updateVariant(varId, { attrs: [...(localVariants.find(v => v.id === varId)?.attrs || []), attr] })
  }
  const removeVAttr = (varId: string, attrId: string) =>
    updateVariant(varId, { attrs: localVariants.find(v => v.id === varId)?.attrs.filter(a => a.id !== attrId) || [] })

  const addVAttrValue = (varId: string, attrId: string) => {
    const k = `${varId}__${attrId}`
    const label = (vLabelInput[k] || '').trim()
    if (!label) return
    const delta = Number((vPriceInput[k] || '0').replace(/\./g, '').replace(/[^0-9\-]/g, '')) || 0
    updateVariant(varId, {
      attrs: localVariants.find(v => v.id === varId)?.attrs.map(a => a.id === attrId ? { ...a, values: [...a.values, { label, price_delta: delta }] } : a) || []
    })
    setVLabelInput(p => ({ ...p, [k]: '' })); setVPriceInput(p => ({ ...p, [k]: '' }))
  }
  const removeVAttrValue = (varId: string, attrId: string, vi: number) =>
    updateVariant(varId, {
      attrs: localVariants.find(v => v.id === varId)?.attrs.map(a => a.id === attrId ? { ...a, values: a.values.filter((_, i) => i !== vi) } : a) || []
    })

  const addVPromo = (varId: string) => {
    const rule = { id: `pr_${uid()}`, type: 'buy_get_free' as const, buy_qty: 2, bonus_qty: 1 }
    updateVariant(varId, { promos: [...(localVariants.find(v => v.id === varId)?.promos || []), rule] })
  }
  const removeVPromo = (varId: string, ruleId: string) =>
    updateVariant(varId, { promos: localVariants.find(v => v.id === varId)?.promos.filter(r => r.id !== ruleId) || [] })
  const updateVPromo = (varId: string, ruleId: string, patch: any) =>
    updateVariant(varId, { promos: localVariants.find(v => v.id === varId)?.promos.map(r => r.id === ruleId ? { ...r, ...patch } : r) || [] })

  // ── per-variant bundle items ───────────────────────────────
  const addVBundle = (varId: string) => {
    const item: BundleItem = { id: `vbi_${uid()}`, name: '', price: 0, stock_quantity: 0, image_urls: [], type: 'gift', attrs: [] }
    updateVariant(varId, { bundleItems: [...(localVariants.find(v => v.id === varId)?.bundleItems || []), item] })
  }
  const removeVBundle = (varId: string, itemId: string) =>
    updateVariant(varId, { bundleItems: localVariants.find(v => v.id === varId)?.bundleItems?.filter(b => b.id !== itemId) || [] })
  const updateVBundle = (varId: string, itemId: string, patch: Partial<BundleItem>) =>
    updateVariant(varId, { bundleItems: localVariants.find(v => v.id === varId)?.bundleItems?.map(b => b.id === itemId ? { ...b, ...patch } : b) || [] })

  const handleVBundleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, varId: string, biId: string) => {
    const files = Array.from(e.target.files || []); if (!files.length) return
    const key = `${varId}__${biId}`
    setVBundleUploading(key)
    try {
      const results = await Promise.all(files.map(f => withTimeout(productService.uploadImage(f)).then(r => r.data?.url || r.data)))
      const v = localVariants.find(v => v.id === varId)
      const bi = v?.bundleItems?.find(b => b.id === biId)
      if (bi) updateVBundle(varId, biId, { image_urls: [...(bi.image_urls || []), ...results] })
    } catch (err: any) { toast.error(err?.message === 'timeout' ? 'Upload quá 15 giây' : 'Upload ảnh thất bại') }
    finally { setVBundleUploading(null); e.target.value = '' }
  }

  // ── excel upload ─────────────────────────────────────────────
  const excelRef = useRef<HTMLInputElement>(null)
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: 'binary' })
        const ws = wb.Sheets[wb.SheetNames[0]]
        const rows: any[] = XLSX.utils.sheet_to_json(ws, { defval: '' })
        if (rows.length === 0) { toast.error('File Excel không có dữ liệu'); return }
        const first = rows[0]
        // Map common column names
        const name = first['Tên sản phẩm'] || first['product_name'] || first['name'] || ''
        const price = Number(String(first['Giá'] || first['price'] || '0').replace(/[^0-9]/g, '')) || 0
        const stock = Number(first['Tồn kho'] || first['stock'] || 0) || 0
        const desc  = first['Mô tả'] || first['description'] || ''
        if (name) setForm(f => ({ ...f, product_name: name, description: desc }))
        if (price > 0 || stock > 0) {
          setLocalVariants(p => p.map((v, i) => i === 0 ? { ...v, price, stock } : v))
        }
        if (rows.length > 1) {
          const newVs = rows.slice(1).map(row => ({
            ...newVariant(),
            name: row['Phiên bản'] || row['variant'] || '',
            price: Number(String(row['Giá'] || row['price'] || '0').replace(/[^0-9]/g, '')) || 0,
            stock: Number(row['Tồn kho'] || row['stock'] || 0) || 0,
          }))
          setLocalVariants(p => [p[0], ...newVs])
        }
        toast.success(`Đã đọc ${rows.length} dòng từ Excel`)
      } catch { toast.error('Không đọc được file Excel') }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  const promoLabel = (r: { type: string; buy_qty: number; bonus_qty: number }) =>
    r.type === 'buy_get_free' ? `Mua ${r.buy_qty} tặng ${r.bonus_qty} miễn phí` : `Mua ${r.buy_qty} tính tiền ${r.bonus_qty}`

  // ── video ────────────────────────────────────────────────────
  const handleVideoAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (!files.length) return
    setVideoUploading(true)
    try {
      const results = await Promise.all(files.map(f => withTimeout(productService.uploadImage(f)).then(r => r.data?.url || r.data)))
      setForm(f => ({ ...f, video_urls: [...f.video_urls, ...results] }))
      toast.success('Đã upload video')
    } catch (err: any) { toast.error(err?.message === 'timeout' ? 'Upload quá 15 giây' : 'Upload video thất bại') }
    finally { setVideoUploading(false); e.target.value = '' }
  }

  // ── bundle ───────────────────────────────────────────────────
  const addBundleItem    = () => setBundleItems(p => [...p, newBundleItem()])
  const removeBundleItem = (id: string) => setBundleItems(p => p.filter(b => b.id !== id))
  const updateBundleItem = (id: string, patch: Partial<BundleItem>) =>
    setBundleItems(p => p.map(b => b.id === id ? { ...b, ...patch } : b))
  const handleBundleImageChange = async (e: React.ChangeEvent<HTMLInputElement>, itemId: string) => {
    const files = Array.from(e.target.files || []); if (!files.length) return
    setBundleUploading(itemId)
    try {
      const results = await Promise.all(files.map(f => withTimeout(productService.uploadImage(f)).then(r => r.data?.url || r.data)))
      setBundleItems(p => p.map(b => b.id === itemId ? { ...b, image_urls: [...(b.image_urls || []), ...results] } : b))
    } catch (err: any) { toast.error(err?.message === 'timeout' ? 'Upload quá 15 giây' : 'Upload thất bại') }
    finally { setBundleUploading(null); e.target.value = '' }
  }
  const removeBundleImage = (itemId: string, idx: number) =>
    setBundleItems(p => p.map(b => b.id === itemId ? { ...b, image_urls: b.image_urls.filter((_, i) => i !== idx) } : b))

  // ── save ─────────────────────────────────────────────────────
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
        </div>
        <button onClick={openAdd} className="btn btn-primary">+ Thêm sản phẩm</button>
      </div>

      {/* Tab navigation */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, borderBottom: '2px solid var(--border-subtle)' }}>
        {([
          { key: 'products', icon: '🛍️', label: 'Sản phẩm đang bán' },
          { key: 'combo',    icon: '🔀', label: 'Danh sách combo' },
          { key: 'gifts',    icon: '🎁', label: 'Sản phẩm tặng kèm' },
        ] as const).map(tab => (
          <button key={tab.key} onClick={() => setViewMode(tab.key)}
            style={{ padding: '10px 20px', fontWeight: viewMode === tab.key ? 700 : 500, fontSize: 14,
              borderBottom: viewMode === tab.key ? '2.5px solid var(--primary)' : '2.5px solid transparent',
              color: viewMode === tab.key ? 'var(--primary)' : 'var(--gray-500)',
              background: 'none', border: 'none', cursor: 'pointer', whiteSpace: 'nowrap',
              transition: 'color 0.15s', marginBottom: -2 }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Sản phẩm đang bán ── */}
      {viewMode === 'products' && <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

        {/* Status filter pills */}
        {(() => {
          const counts = {
            all:      products.length,
            active:   products.filter(p => p.status === 'active').length,
            pending:  products.filter(p => p.status === 'pending').length,
            rejected: products.filter(p => p.status === 'rejected').length,
          }
          const pills: { key: typeof statusFilter; label: string; color: string; bg: string }[] = [
            { key: 'all',      label: `Tất cả (${counts.all})`,            color: 'var(--gray-700)',  bg: 'var(--bg-page)' },
            { key: 'active',   label: `🟢 Đang bán (${counts.active})`,     color: 'var(--success)',   bg: '#F0FDF4' },
            { key: 'pending',  label: `⏳ Chờ duyệt (${counts.pending})`,  color: 'var(--warning)',   bg: '#FFFBEB' },
            { key: 'rejected', label: `❌ Bị từ chối (${counts.rejected})`, color: 'var(--error)',     bg: '#FEF2F2' },
          ]
          return (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
              {pills.map(pill => (
                <button key={pill.key} onClick={() => setStatusFilter(pill.key)}
                  style={{ padding: '5px 14px', borderRadius: 20, fontSize: 13, fontWeight: statusFilter === pill.key ? 700 : 500, cursor: 'pointer', transition: 'all 0.15s',
                    border: statusFilter === pill.key ? `1.5px solid ${pill.color}` : '1.5px solid var(--border-subtle)',
                    background: statusFilter === pill.key ? pill.bg : 'transparent',
                    color: statusFilter === pill.key ? pill.color : 'var(--gray-500)' }}>
                  {pill.label}
                </button>
              ))}
            </div>
          )
        })()}

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
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 16 }}>{formatCurrency(displayPrice)}</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Tồn: <b style={{ color: 'var(--gray-700)' }}>{displayStock}</b></span>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Bán: <b style={{ color: 'var(--gray-700)' }}>{p.sales_count ?? 0}</b></span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(p) }} className="btn btn-outline btn-sm" style={{ fontSize: 12, padding: '5px 14px' }}>✏️ Sửa</button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(p.product_id) }} className="btn btn-danger btn-sm" style={{ fontSize: 12, padding: '5px 14px' }}>🗑️</button>
                  <span style={{ fontSize: 18, color: 'var(--gray-400)', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                </div>
              </div>

              {/* ── Detail panel ── */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px', background: 'var(--bg-page, #F8FAFC)', display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* Mô tả */}
                  {p.description && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Mô tả</p>
                      <p style={{ fontSize: 13, color: 'var(--gray-700)', lineHeight: 1.6 }}>{p.description}</p>
                    </div>
                  )}

                  {/* Phiên bản sản phẩm */}
                  {variants.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>🔀 Phiên bản sản phẩm</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {variants.map((v, vi) => (
                          <div key={v.id} style={{ background: 'white', borderRadius: 12, border: '1.5px solid var(--border-subtle)', overflow: 'hidden' }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 14px', background: vi === 0 ? '#F0FDF4' : '#F8FAFC', borderBottom: '1px solid var(--border-subtle)' }}>
                              <span style={{ fontSize: 12, fontWeight: 800, color: vi === 0 ? 'var(--success)' : 'var(--gray-600)' }}>
                                📦 {v.name || `Phiên bản ${vi + 1}`}{vi === 0 ? ' (Chính)' : ''}
                              </span>
                              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)' }}>{formatCurrency(v.price)}</span>
                            </div>
                            <div style={{ padding: '10px 14px' }}>
                              {/* Images */}
                              {v.image_urls?.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                                  {v.image_urls.map((url, ii) => (
                                    <div key={ii}
                                      onMouseEnter={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setHoverImg({ url: getImageUrl(url), x: r.left + r.width / 2, y: r.top }) }}
                                      onMouseLeave={() => setHoverImg(null)}
                                      style={{ width: 56, height: 56, borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border-subtle)', cursor: 'pointer', flexShrink: 0 }}>
                                      <img src={getImageUrl(url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Stats */}
                              <div style={{ display: 'flex', gap: 12, marginBottom: v.attrs.length > 0 || v.promos.length > 0 ? 8 : 0, flexWrap: 'wrap' }}>
                                <span style={{ fontSize: 12, color: 'var(--gray-500)' }}>Tồn: <b>{v.stock}</b></span>
                                {v.promos.length > 0 && <span style={{ fontSize: 12, color: '#D97706' }}>🎯 {v.promos.length} deal</span>}
                              </div>
                              {/* Attrs */}
                              {v.attrs.length > 0 && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                                  {v.attrs.map(attr => (
                                    <div key={attr.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-600)', minWidth: 80, paddingTop: 3, flexShrink: 0 }}>{attr.name}:</span>
                                      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                                        {attr.values.map((av, avi) => (
                                          <span key={avi} style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: '#EDE9FE', color: '#6D28D9', border: '1px solid #DDD6FE' }}>
                                            {av.label}{av.price_delta !== 0 ? ` (${av.price_delta > 0 ? '+' : ''}${formatCurrency(av.price_delta)})` : ''}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Promos */}
                              {v.promos.length > 0 && (
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                                  {v.promos.map(r => (
                                    <div key={r.id} style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 8, background: r.type === 'buy_get_free' ? '#FFFBEB' : '#EFF6FF', border: `1px solid ${r.type === 'buy_get_free' ? '#FDE68A' : '#BFDBFE'}`, color: r.type === 'buy_get_free' ? '#92400E' : '#1E40AF' }}>
                                      {r.type === 'buy_get_free' ? '🎁' : '💰'} {promoLabel(r)}
                                    </div>
                                  ))}
                                </div>
                              )}
                              {/* Per-variant bundle items */}
                              {(v.bundleItems || []).length > 0 && (
                                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-subtle)' }}>
                                  <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--gray-400)', textTransform: 'uppercase', letterSpacing: 0.4, display: 'block', marginBottom: 6 }}>🎁 Hàng tặng kèm phiên bản này</span>
                                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                    {(v.bundleItems || []).map(bi => (
                                      <div key={bi.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: bi.type === 'gift' ? '#FFFBEB' : 'white', borderRadius: 10, padding: '6px 10px', border: `1.5px solid ${bi.type === 'gift' ? '#FDE68A' : 'var(--border-subtle)'}` }}>
                                        {(bi.image_urls || []).length > 0
                                          ? <img src={getImageUrl(bi.image_urls![0])} alt=""
                                              style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', flexShrink: 0, border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                                              onMouseEnter={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setHoverImg({ url: getImageUrl(bi.image_urls![0]), x: r.left + r.width / 2, y: r.top, name: bi.name, price: bi.price, type: bi.type, stock: bi.stock_quantity }) }}
                                              onMouseLeave={() => setHoverImg(null)} />
                                          : <span style={{ fontSize: 22, flexShrink: 0 }}>{bi.type === 'gift' ? '🎁' : '📦'}</span>
                                        }
                                        <div>
                                          <div style={{ fontSize: 12, fontWeight: 600 }}>{bi.name || '—'}</div>
                                          <div style={{ fontSize: 11, color: bi.type === 'gift' ? '#D97706' : 'var(--success)', fontWeight: 600 }}>{bi.type === 'gift' ? 'Tặng miễn phí' : formatCurrency(bi.price)}</div>
                                          {(bi.stock_quantity ?? 0) > 0 && <div style={{ fontSize: 10, color: 'var(--gray-400)' }}>SL: {bi.stock_quantity}</div>}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Bundle items */}
                  {items.length > 0 && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--gray-400)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 }}>📦 Hàng đi kèm chung (tất cả phiên bản)</p>
                      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        {items.map(b => (
                          <div key={b.id}
                            onMouseEnter={e => { const r = (e.currentTarget as HTMLElement).getBoundingClientRect(); setHoverImg({ url: b.image_urls?.[0] ? getImageUrl(b.image_urls[0]) : '', x: r.left + r.width / 2, y: r.top, name: b.name, price: b.price, type: b.type, stock: b.stock_quantity }) }}
                            onMouseLeave={() => setHoverImg(null)}
                            style={{ display: 'flex', alignItems: 'center', gap: 10, background: b.type === 'gift' ? '#FFF7ED' : 'white', borderRadius: 12, padding: '8px 12px', border: `1.5px solid ${b.type === 'gift' ? '#FED7AA' : 'var(--border-subtle)'}`, cursor: 'default' }}>
                            {b.image_urls?.[0] ? <img src={getImageUrl(b.image_urls[0])} alt="" style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} /> : <span style={{ fontSize: 24, flexShrink: 0 }}>{b.type === 'gift' ? '🎁' : '📦'}</span>}
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name || '—'}</div>
                              <div style={{ fontSize: 12, fontWeight: 600, color: b.type === 'gift' ? '#EA580C' : 'var(--success)' }}>{b.type === 'gift' ? '🎁 Tặng kèm' : formatCurrency(b.price)}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
                    <button onClick={() => openEdit(p)} className="btn btn-primary" style={{ fontSize: 13 }}>✏️ Sửa sản phẩm</button>
                    <button onClick={() => handleDelete(p.product_id)} className="btn btn-danger" style={{ fontSize: 13 }}>🗑️ Xóa</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
          </>
        })()}
      </div>}

      {/* ── Tab: Danh sách combo ── */}
      {viewMode === 'combo' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 4 }}>
            Combo là tập hợp sản phẩm / phụ kiện đi kèm — shop cấu hình riêng cho từng sản phẩm.
          </p>
          {products.filter(p => p.status === 'active' || p.status === 'pending').length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>Chưa có sản phẩm nào đang bán</div>
          )}
          {products.filter(p => p.status === 'active' || p.status === 'pending').map(p => {
            const comboAll = [
              ...bundleStore.get(p.product_id).filter(b => b.type === 'accessory'),
              ...variantStore.get(p.product_id).flatMap(v => (v.bundleItems || []).filter(b => b.type === 'accessory')),
            ]
            const isOpen = comboExpandedId === p.product_id
            const imgs = variantStore.get(p.product_id)[0]?.image_urls || p.image_urls || []
            return (
              <div key={p.product_id} className="card" style={{ overflow: 'hidden' }}>
                <div onClick={() => setComboExpandedId(isOpen ? null : p.product_id)}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-page)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {imgs[0] ? <img src={getImageUrl(imgs[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 22 }}>🛍️</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{p.product_name}</span>
                    <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>{formatCurrency(p.price)}</span>
                  </div>
                  <span style={{ fontSize: 12, marginRight: 8 }}>
                    {comboAll.length > 0
                      ? <span style={{ color: 'var(--success)', fontWeight: 700 }}>📦 {comboAll.length} combo</span>
                      : <span style={{ color: 'var(--gray-400)' }}>Chưa có combo</span>}
                  </span>
                  <button onClick={e => { e.stopPropagation(); openEdit(p) }} className="btn btn-outline btn-sm" style={{ fontSize: 11, padding: '4px 10px' }}>⚙️ Cài đặt</button>
                  <span style={{ color: 'var(--gray-400)', fontSize: 16, transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 16px 14px 72px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {comboAll.length === 0
                      ? <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>Chưa cấu hình — nhấn ⚙️ Cài đặt để thêm combo</span>
                      : comboAll.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8, background: 'var(--bg-page)' }}>
                          {(item.image_urls || []).length > 0 && (
                            <img src={getImageUrl(item.image_urls![0])} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name || 'Không tên'}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Tồn: {item.stock_quantity ?? 0}</div>
                          </div>
                          <span style={{ fontWeight: 700, color: 'var(--primary)', fontSize: 13 }}>{formatCurrency(item.price)}</span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#EFF6FF', color: '#2563EB' }}>📦 Đi kèm</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Sản phẩm tặng kèm ── */}
      {viewMode === 'gifts' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ fontSize: 13, color: 'var(--gray-400)', marginBottom: 4 }}>
            Sản phẩm tặng kèm là quà miễn phí đi kèm khi mua — cấu hình riêng cho từng sản phẩm.
          </p>
          {products.filter(p => p.status === 'active' || p.status === 'pending').length === 0 && (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)' }}>Chưa có sản phẩm nào đang bán</div>
          )}
          {products.filter(p => p.status === 'active' || p.status === 'pending').map(p => {
            const giftsAll = [
              ...bundleStore.get(p.product_id).filter(b => b.type === 'gift'),
              ...variantStore.get(p.product_id).flatMap(v => (v.bundleItems || []).filter(b => b.type === 'gift')),
            ]
            const isOpen = giftsExpandedId === p.product_id
            const imgs = variantStore.get(p.product_id)[0]?.image_urls || p.image_urls || []
            return (
              <div key={p.product_id} className="card" style={{ overflow: 'hidden' }}>
                <div onClick={() => setGiftsExpandedId(isOpen ? null : p.product_id)}
                  style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, overflow: 'hidden', flexShrink: 0, background: 'var(--bg-page)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {imgs[0] ? <img src={getImageUrl(imgs[0])} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ fontSize: 22 }}>🛍️</span>}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{p.product_name}</span>
                    <span style={{ marginLeft: 10, fontSize: 12, color: 'var(--primary)', fontWeight: 700 }}>{formatCurrency(p.price)}</span>
                  </div>
                  <span style={{ fontSize: 12, marginRight: 8 }}>
                    {giftsAll.length > 0
                      ? <span style={{ color: '#EA580C', fontWeight: 700 }}>🎁 {giftsAll.length} quà tặng</span>
                      : <span style={{ color: 'var(--gray-400)' }}>Chưa có tặng kèm</span>}
                  </span>
                  <button onClick={e => { e.stopPropagation(); openEdit(p) }} className="btn btn-outline btn-sm" style={{ fontSize: 11, padding: '4px 10px' }}>⚙️ Cài đặt</button>
                  <span style={{ color: 'var(--gray-400)', fontSize: 16, transform: isOpen ? 'rotate(180deg)' : 'none', display: 'inline-block', transition: 'transform 0.2s' }}>▾</span>
                </div>
                {isOpen && (
                  <div style={{ padding: '0 16px 14px 72px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {giftsAll.length === 0
                      ? <span style={{ fontSize: 13, color: 'var(--gray-400)' }}>Chưa cấu hình — nhấn ⚙️ Cài đặt để thêm tặng kèm</span>
                      : giftsAll.map((item, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 12px', borderRadius: 8, background: 'var(--bg-page)' }}>
                          {(item.image_urls || []).length > 0 && (
                            <img src={getImageUrl(item.image_urls![0])} alt="" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }} />
                          )}
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: 13, fontWeight: 600 }}>{item.name || 'Không tên'}</div>
                            <div style={{ fontSize: 12, color: 'var(--gray-400)' }}>Tồn: {item.stock_quantity ?? 0}</div>
                          </div>
                          <span style={{ fontWeight: 700, color: item.price > 0 ? 'var(--primary)' : 'var(--success)', fontSize: 13 }}>
                            {item.price > 0 ? formatCurrency(item.price) : 'Miễn phí'}
                          </span>
                          <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 12, background: '#FFF7ED', color: '#EA580C' }}>🎁 Tặng kèm</span>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Hover image tooltip ── */}
      {hoverImg && (
        <div style={{ position: 'fixed', left: Math.min(hoverImg.x - 160, window.innerWidth - 340), top: Math.max(hoverImg.y - (hoverImg.name !== undefined ? 420 : 340), 10), zIndex: 9000, pointerEvents: 'none', animation: 'fadeInScale 0.15s ease' }}>
          <style>{`@keyframes fadeInScale{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}}`}</style>
          <div style={{ background: 'white', borderRadius: 16, overflow: 'hidden', boxShadow: '0 12px 48px rgba(0,0,0,0.28)', border: '2px solid var(--primary)', width: 320 }}>
            {hoverImg.url ? <img src={hoverImg.url} alt="" style={{ width: 320, height: 280, objectFit: 'cover', display: 'block' }} /> : <div style={{ width: 320, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#F1F5F9', fontSize: 60 }}>🛍️</div>}
            {hoverImg.name !== undefined && (
              <div style={{ padding: '12px 16px 14px', borderTop: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: 14, fontWeight: 700 }}>{hoverImg.name || '—'}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 12, color: 'var(--gray-500)' }}>
                  <span>{hoverImg.type === 'gift' ? '🎁 Hàng tặng kèm' : formatCurrency(hoverImg.price ?? 0)}</span>
                  <span>Tồn: {hoverImg.stock ?? 0}</span>
                </div>
                <div style={{ marginTop: 4, fontSize: 11, fontWeight: 600, color: hoverImg.type === 'gift' ? '#EA580C' : 'var(--success)' }}>
                  {hoverImg.type === 'gift' ? '🎁 Tặng kèm' : '📦 Đi kèm'}
                </div>
              </div>
            )}
          </div>
          <div style={{ position: 'absolute', bottom: -10, left: '50%', transform: 'translateX(-50%)', width: 0, height: 0, borderLeft: '10px solid transparent', borderRight: '10px solid transparent', borderTop: '10px solid var(--primary)' }} />
        </div>
      )}

      {/* ════════════════════════════════════════════════════════
          MODAL: Thêm sản phẩm mới (đơn giản → gửi admin duyệt)
          ════════════════════════════════════════════════════════ */}
      <Modal open={simpleModalOpen} onClose={() => setSimpleModalOpen(false)} title="Thêm sản phẩm mới" width={620}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '80vh', overflowY: 'auto', paddingRight: 8 }}>

          <div style={{ padding: '10px 14px', borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', fontSize: 13, color: '#1D4ED8', lineHeight: 1.5 }}>
            📋 Thông tin cơ bản sẽ được gửi đến admin để duyệt. Sau khi duyệt, bạn có thể cài đặt thêm phiên bản, combo và tặng kèm.
          </div>

          {/* Tên sản phẩm */}
          <div>
            <label className="input-label">Tên sản phẩm <span style={{ color: 'var(--error)' }}>*</span></label>
            <input className="input" type="text" value={simpleForm.product_name}
              onChange={e => setSimpleForm(f => ({ ...f, product_name: e.target.value }))} placeholder="Nhập tên sản phẩm" />
          </div>

          {/* Danh mục */}
          <div>
            <label className="input-label">Danh mục</label>
            <select className="input" value={simpleForm.category_id}
              onChange={e => setSimpleForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">-- Chọn danh mục --</option>
              {categories.map(c => <option key={c.category_id} value={c.category_id}>{c.category_name}</option>)}
            </select>
          </div>

          {/* Giá + Tồn kho */}
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label className="input-label">Giá bán (₫) <span style={{ color: 'var(--error)' }}>*</span></label>
              <input className="input" type="text" inputMode="numeric" value={simplePriceInput}
                placeholder="0"
                onChange={e => {
                  const digits = e.target.value.replace(/[^0-9]/g, '')
                  const num = digits === '' ? 0 : Number(digits)
                  setSimplePriceInput(digits === '' ? '' : num.toLocaleString('vi-VN'))
                  setSimpleForm(f => ({ ...f, price: num }))
                }} />
            </div>
            <div style={{ flex: 1 }}>
              <label className="input-label">Tồn kho</label>
              <input className="input" type="number" min={0} value={simpleForm.stock_quantity || ''}
                onChange={e => setSimpleForm(f => ({ ...f, stock_quantity: Number(e.target.value) }))} placeholder="0" />
            </div>
          </div>

          {/* Thuộc tính sản phẩm */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="input-label" style={{ margin: 0 }}>Thuộc tính sản phẩm</label>
              <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: 12 }}
                onClick={() => setSimpleAttrs(a => [...a, { id: `sa_${Date.now()}`, name: '', values: [] }])}>
                + Thêm thuộc tính
              </button>
            </div>
            {/* Quick-add chips */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: simpleAttrs.length > 0 ? 10 : 0 }}>
              {['Màu sắc', 'Kích thước', 'Chất liệu', 'Mẫu mã', 'Xuất xứ'].filter(q => !simpleAttrs.some(a => a.name === q)).map(q => (
                <button key={q} type="button"
                  onClick={() => setSimpleAttrs(a => [...a, { id: `sa_${Date.now()}_${q}`, name: q, values: [] }])}
                  style={{ padding: '3px 10px', borderRadius: 14, fontSize: 12, border: '1px dashed var(--border-subtle)', background: 'transparent', cursor: 'pointer', color: 'var(--gray-500)' }}>
                  + {q}
                </button>
              ))}
            </div>
            {/* Attr rows */}
            {simpleAttrs.map((attr, aIdx) => (
              <div key={attr.id} style={{ marginBottom: 10, padding: 12, borderRadius: 10, border: '1px solid var(--border-subtle)', background: 'var(--bg-page)' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                  <input className="input" style={{ flex: 1, height: 34, fontSize: 13 }} value={attr.name} placeholder="Tên thuộc tính (VD: Màu sắc)"
                    onChange={e => setSimpleAttrs(a => a.map((x, i) => i === aIdx ? { ...x, name: e.target.value } : x))} />
                  <button type="button" onClick={() => setSimpleAttrs(a => a.filter((_, i) => i !== aIdx))}
                    style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
                </div>
                {/* Values */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
                  {attr.values.map((val, vIdx) => (
                    <div key={vIdx} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '3px 8px 3px 10px', borderRadius: 14,
                      background: 'white', border: '1.5px solid var(--border-subtle)', fontSize: 13 }}>
                      <span>{val.label}</span>
                      {val.price_delta !== 0 && (
                        <span style={{ fontSize: 11, color: val.price_delta > 0 ? 'var(--success)' : 'var(--error)', fontWeight: 700 }}>
                          {val.price_delta > 0 ? '+' : ''}{val.price_delta.toLocaleString('vi-VN')}₫
                        </span>
                      )}
                      <button type="button" onClick={() => setSimpleAttrs(a => a.map((x, i) => i === aIdx ? { ...x, values: x.values.filter((_, j) => j !== vIdx) } : x))}
                        style={{ color: 'var(--gray-400)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: '0 2px' }}>×</button>
                    </div>
                  ))}
                </div>
                {/* Add value row */}
                <div style={{ display: 'flex', gap: 6 }}>
                  <input className="input" style={{ flex: 2, height: 32, fontSize: 12 }}
                    value={simpleAttrValueInput[attr.id] || ''} placeholder="Tên giá trị (VD: Đỏ)"
                    onChange={e => setSimpleAttrValueInput(p => ({ ...p, [attr.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        const label = (simpleAttrValueInput[attr.id] || '').trim()
                        if (!label) return
                        const priceKey = `${attr.id}__new`
                        const priceDelta = Number((simpleAttrPriceInput[priceKey] || '').replace(/\./g, '')) || 0
                        setSimpleAttrs(a => a.map((x, i) => i === aIdx ? { ...x, values: [...x.values, { label, price_delta: priceDelta }] } : x))
                        setSimpleAttrValueInput(p => ({ ...p, [attr.id]: '' }))
                        setSimpleAttrPriceInput(p => ({ ...p, [priceKey]: '' }))
                      }
                    }} />
                  <input className="input" style={{ flex: 1, height: 32, fontSize: 12 }}
                    value={simpleAttrPriceInput[`${attr.id}__new`] || ''} placeholder="+/- Giá (₫)"
                    onChange={e => {
                      const raw = e.target.value
                      const sign = raw.startsWith('-') ? '-' : ''
                      const digits = raw.replace(/[^0-9]/g, '')
                      const formatted = digits === '' ? '' : Number(digits).toLocaleString('vi-VN')
                      setSimpleAttrPriceInput(p => ({ ...p, [`${attr.id}__new`]: sign + formatted }))
                    }} />
                  <button type="button" className="btn btn-outline btn-sm" style={{ fontSize: 12, height: 32, padding: '0 10px', whiteSpace: 'nowrap' }}
                    onClick={() => {
                      const label = (simpleAttrValueInput[attr.id] || '').trim()
                      if (!label) return
                      const priceKey = `${attr.id}__new`
                      const priceDelta = Number((simpleAttrPriceInput[priceKey] || '').replace(/\./g, '')) || 0
                      setSimpleAttrs(a => a.map((x, i) => i === aIdx ? { ...x, values: [...x.values, { label, price_delta: priceDelta }] } : x))
                      setSimpleAttrValueInput(p => ({ ...p, [attr.id]: '' }))
                      setSimpleAttrPriceInput(p => ({ ...p, [priceKey]: '' }))
                    }}>+ Thêm</button>
                </div>
              </div>
            ))}
          </div>

          {/* Mô tả */}
          <div>
            <label className="input-label">Mô tả sản phẩm</label>
            <textarea className="input" rows={3} value={simpleForm.description}
              onChange={e => setSimpleForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Mô tả chi tiết về sản phẩm..." style={{ resize: 'vertical' }} />
          </div>

          {/* Hình ảnh */}
          <div>
            <label className="input-label">Hình ảnh sản phẩm</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
              {simpleForm.image_urls.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 72, height: 72 }}>
                  <img src={getImageUrl(url)} alt="" style={{ width: 72, height: 72, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                  <button onClick={() => setSimpleForm(f => ({ ...f, image_urls: f.image_urls.filter((_, j) => j !== i) }))}
                    style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: 'var(--error)', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
              ))}
              <label style={{ width: 72, height: 72, borderRadius: 8, border: '2px dashed var(--border-subtle)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--gray-400)', fontSize: 12, flexShrink: 0 }}>
                {simpleImgUploading ? '⏳' : <><span style={{ fontSize: 22 }}>📷</span><span>Thêm ảnh</span></>}
                <input ref={simpleImgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleSimpleImageChange} />
              </label>
            </div>
          </div>

          {/* Video */}
          <div>
            <label className="input-label">Video sản phẩm (tuỳ chọn)</label>
            {simpleForm.video_url ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'var(--bg-page)', border: '1px solid var(--border-subtle)' }}>
                <span style={{ fontSize: 20 }}>🎬</span>
                <span style={{ flex: 1, fontSize: 12, color: 'var(--gray-600)', wordBreak: 'break-all' }}>{simpleForm.video_url.split('/').pop()}</span>
                <button onClick={() => setSimpleForm(f => ({ ...f, video_url: '' }))} style={{ color: 'var(--error)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
              </div>
            ) : (
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 8, border: '2px dashed var(--border-subtle)', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 13 }}>
                {simpleVideoUploading ? '⏳ Đang upload...' : <><span style={{ fontSize: 20 }}>🎬</span><span>Chọn video (.mp4, .mov...)</span></>}
                <input ref={simpleVideoRef} type="file" accept="video/*" style={{ display: 'none' }} onChange={handleSimpleVideoChange} />
              </label>
            )}
          </div>

        </div>
        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 16, borderTop: '1px solid var(--border-subtle)', marginTop: 8 }}>
          <button className="btn btn-ghost" onClick={() => setSimpleModalOpen(false)}>Hủy</button>
          <button className="btn btn-primary" onClick={handleSimpleSave} disabled={simpleImgUploading || simpleVideoUploading}>
            📤 Gửi duyệt
          </button>
        </div>
      </Modal>

      {/* ════════════════════════════════════════════════════════
          MODAL: Thêm / Sửa sản phẩm
          ════════════════════════════════════════════════════════ */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editProduct ? 'Sửa sản phẩm' : 'Thêm sản phẩm'} width={800}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '78vh', overflowY: 'auto', paddingRight: 20 }}>

          {/* Tên sản phẩm */}
          <div>
            <label className="input-label">Tên sản phẩm</label>
            <input className="input" type="text" value={form.product_name} onChange={e => setForm(f => ({ ...f, product_name: e.target.value }))} placeholder="Nhập tên sản phẩm" />
          </div>

          {/* Mô tả */}
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
