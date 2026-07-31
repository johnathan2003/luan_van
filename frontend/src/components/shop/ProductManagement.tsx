import React, { useEffect, useState, useRef, useMemo } from 'react'
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

  // packaging dimensions (product-level)
  const [packaging, setPackaging] = useState({ length: '', width: '', height: '', weight: '' })
  const [sizeTiers, setSizeTiers] = useState<any[]>([])

  // Fetch size tiers một lần khi mở form
  useEffect(() => {
    if (sizeTiers.length > 0) return
    import('../../services/api').then(({ default: API }) => {
      API.get('/api/v1/shipping/size-tiers').then((r: any) => {
        setSizeTiers(r.data?.tiers ?? [])
      }).catch(() => {})
    })
  }, [])
  const setPkg = (field: 'length' | 'width' | 'height' | 'weight', val: string) =>
    setPackaging(prev => ({ ...prev, [field]: val }))
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
    setPackaging({ length: '', width: '', height: '', weight: '' })
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
    } catch (err: any) {
      console.error('Save error:', err)
      const errMsg = err?.response?.data?.detail || err?.message || 'Lỗi khi lưu'
      toast.error(errMsg)
    }
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
                  <div style={{ display: 'flex', gap: 16, marginTop: 3, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span style={{ fontWeight: 800, color: 'var(--primary)', fontSize: 16 }}>{formatCurrency(displayPrice)}</span>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Tồn: <b style={{ color: 'var(--gray-700)' }}>{displayStock}</b></span>
                    <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Bán: <b style={{ color: 'var(--gray-700)' }}>{p.sales_count ?? 0}</b></span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 }}>
                  <button onClick={e => { e.stopPropagation(); handleDelete(p.product_id) }} className="btn btn-danger btn-sm" style={{ fontSize: 12, padding: '5px 14px' }}>🗑️</button>
                  <span style={{ fontSize: 18, color: 'var(--gray-400)', transition: 'transform 0.2s', display: 'inline-block', transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }}>▾</span>
                </div>
              </div>

              {/* ── Detail panel ── */}
              {isExpanded && (
                <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '16px 20px', background: 'var(--bg-page, #F8FAFC)', display: 'flex', flexDirection: 'column', gap: 14 }}>

                  {/* ── Vi phạm admin ── */}
                  {rejection && p.status === 'rejected' && (
                    <div style={{ background: '#FEF2F2', border: '1.5px solid #FECACA', borderRadius: 12, padding: '14px 18px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 18 }}>🚩</span>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 800, color: '#991B1B' }}>Sản phẩm bị từ chối — Admin ghi nhận {rejection.violations.length} vi phạm</div>
                          <div style={{ fontSize: 11, color: '#B91C1C' }}>Kiểm tra lúc: {new Date(rejection.rejected_at).toLocaleString('vi-VN')}</div>
                        </div>
                      </div>
                      {rejection.violations.map((v, vi) => (
                        <div key={vi} style={{ padding: '10px 12px', background: 'white', borderRadius: 8, border: '1px solid #FECACA', marginBottom: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: '#DC2626', minWidth: 20 }}>{vi + 1}.</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 12, fontWeight: 700, color: '#991B1B' }}>📌 {v.label}</div>
                              {v.note && <div style={{ fontSize: 12, color: '#7F1D1D', marginTop: 3, fontStyle: 'italic' }}>"{v.note}"</div>}
                            </div>
                          </div>
                          {/* Ảnh bị đánh dấu với vòng tròn */}
                          {v.imageUrl && v.imgMarkers && v.imgMarkers.length > 0 && (
                            <div style={{ marginTop: 10, position: 'relative', display: 'inline-block', borderRadius: 10, overflow: 'hidden', border: '2px solid #FECACA' }}>
                              <img src={getImageUrl(v.imageUrl)} alt="" style={{ display: 'block', maxWidth: '100%', maxHeight: 260, objectFit: 'contain', background: '#F1F5F9' }} />
                              {v.imgMarkers.map((m, mi) => (
                                <div key={mi} style={{
                                  position: 'absolute',
                                  left: `${m.x}%`, top: `${m.y}%`,
                                  transform: 'translate(-50%,-50%)',
                                  width: 36, height: 36, borderRadius: '50%',
                                  border: '3px solid #DC2626',
                                  background: 'rgba(220,38,38,0.2)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  color: '#DC2626', fontSize: 12, fontWeight: 800,
                                  boxShadow: '0 0 0 2px white, 0 2px 6px rgba(0,0,0,0.3)',
                                  pointerEvents: 'none',
                                }}>{mi + 1}</div>
                              ))}
                              <div style={{ position: 'absolute', bottom: 6, right: 6, background: '#DC2626', color: 'white', fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 5 }}>
                                🚩 {v.imgMarkers.length} điểm vi phạm
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                      {rejection.reason && (
                        <div style={{ marginTop: 8, padding: '10px 14px', background: '#7F1D1D', borderRadius: 8 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#FCA5A5', marginBottom: 4 }}>📋 Lý do đầy đủ:</div>
                          <pre style={{ fontSize: 11, color: 'white', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'inherit', lineHeight: 1.6 }}>{rejection.reason}</pre>
                        </div>
                      )}
                    </div>
                  )}

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

      {/* ── Tab: Sản phẩm sẵn sàng bán ── */}
      {viewMode === 'ready' && (
        <div>
          <div style={{ background: 'linear-gradient(135deg, #E0F2FE, #BAE6FD)', borderRadius: 12, padding: '14px 18px', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, border: '1px solid #7DD3FC' }}>
            <span style={{ fontSize: 28 }}>{'✅'}</span>
            <div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#0369A1' }}>Sản phẩm đã được admin duyệt</div>
              <div style={{ fontSize: 12, color: '#0284C7', marginTop: 2 }}>Bấm <strong>Đăng bán ngay</strong> để khách hàng có thể thấy sản phẩm của bạn trên sàn Buyzo.</div>
            </div>
          </div>
          {approvedCount === 0 ? (
            <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>{'📭'}</div>
              <div style={{ fontSize: 14 }}>Chưa có sản phẩm nào được duyệt sẵn sàng</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Khi admin duyệt sản phẩm của bạn, chúng sẽ xuất hiện tại đây.</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {products.filter(p => p.status === 'approved').map(p => {
                const pvariants  = variantStore.get(p.product_id)
                const pbundles   = [...bundleStore.get(p.product_id), ...pvariants.flatMap((v: any) => v.bundleItems || [])]
                const pacc       = pbundles.filter((b: any) => b.type === 'accessory')
                const pgifts     = pbundles.filter((b: any) => b.type === 'gift')
                const imgs       = pvariants[0]?.image_urls?.length ? pvariants[0].image_urls : (p.image_urls || [])
                const price      = pvariants[0]?.price || p.price
                const isExpanded = readyExpandedId === p.product_id
                return (
                  <div key={p.product_id} className="card" style={{ overflow: 'hidden', border: '2px solid #7DD3FC', borderRadius: 12, transition: 'box-shadow 0.15s' }}>
                    {/* ── Compact row ── */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', cursor: 'pointer' }}
                      onClick={() => setReadyExpandedId(isExpanded ? null : p.product_id)}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        {imgs[0]
                          ? <img src={getImageUrl(imgs[0])} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10, display: 'block' }} />
                          : <div style={{ width: 64, height: 64, background: '#F0F9FF', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>{'🛍️'}</div>
                        }
                        <div style={{ position: 'absolute', top: -6, right: -6,
                          width: 22, height: 22, borderRadius: '50%',
                          background: '#0EA5E9', border: '2px solid white',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 12, fontWeight: 800, color: 'white' }}>{'✓'}</div>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.product_name}</div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#0EA5E9' }}>{formatCurrency(price)}</div>
                        <div style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 2 }}>
                          Tồn: {p.stock_quantity}
                          {pacc.length > 0 && <span style={{ marginLeft: 8 }}>📦 {pacc.length} phụ kiện</span>}
                          {pgifts.length > 0 && <span style={{ marginLeft: 8 }}>🎁 {pgifts.length} tặng kèm</span>}
                          {pvariants[0]?.promos?.length > 0 && <span style={{ marginLeft: 8 }}>🎯 {pvariants[0].promos.length} deal</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={async e => {
                            e.stopPropagation()
                            try {
                              await shopService.activateProduct(p.product_id)
                            } catch (_) { /* API có thể chưa có — tiếp tục với localStorage */ }
                            productApprovalStore.setActive(p.product_id)
                            setProducts(prev => prev.map(x => x.product_id === p.product_id ? { ...x, status: 'active' } : x))
                            setReadyExpandedId(null)
                            toast.success(`🚀 Sản phẩm "${p.product_name}" đã được đăng bán!`)
                          }}
                          style={{ padding: '8px 18px', background: 'linear-gradient(135deg, #0EA5E9, #0284C7)', color: 'white',
                            border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer',
                            boxShadow: '0 2px 6px rgba(14,165,233,0.4)', whiteSpace: 'nowrap' }}
                        >
                          🚀 Đăng bán
                        </button>
                        <span style={{ fontSize: 18, color: 'var(--gray-400)', userSelect: 'none' }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                    </div>

                    {/* ── Expanded detail ── */}
                    {isExpanded && (
                      <div style={{ borderTop: '1px solid #BAE6FD', background: '#F0F9FF', padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {/* Thumbnails */}
                        {imgs.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>🖼️ Hình ảnh sản phẩm</div>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              {imgs.map((url: string, i: number) => (
                                <img key={i} src={getImageUrl(url)} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8, border: '2px solid #7DD3FC' }} />
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Description */}
                        {p.description && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 6 }}>📝 Mô tả</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, background: 'white', borderRadius: 8, padding: '10px 12px', border: '1px solid #BAE6FD' }}>{p.description}</div>
                          </div>
                        )}
                        {/* Variants */}
                        {pvariants.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>🔀 Phiên bản</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                              {pvariants.map((v: any) => (
                                <div key={v.id} style={{ background: 'white', borderRadius: 8, padding: '8px 12px', border: '1px solid #BAE6FD', display: 'flex', alignItems: 'center', gap: 10 }}>
                                  {v.image_urls?.[0] && <img src={getImageUrl(v.image_urls[0])} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />}
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 600, fontSize: 13 }}>{v.name}</div>
                                    <div style={{ fontSize: 12, color: '#0EA5E9', fontWeight: 700 }}>{formatCurrency(v.price)} · Tồn: {v.stock}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Accessories */}
                        {pacc.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>📦 Phụ kiện đi kèm</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                              {pacc.map((b: any, bi: number) => (
                                <div key={bi} style={{ background: 'white', borderRadius: 8, border: '1px solid #BAE6FD', overflow: 'hidden' }}>
                                  {b.image_urls?.[0] && <img src={getImageUrl(b.image_urls[0])} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />}
                                  <div style={{ padding: '6px 8px' }}>
                                    <div style={{ fontWeight: 600, fontSize: 12 }}>{b.name}</div>
                                    <div style={{ fontSize: 12, color: 'var(--success)', fontWeight: 700 }}>{formatCurrency(b.price)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        {/* Gifts */}
                        {pgifts.length > 0 && (
                          <div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--gray-500)', textTransform: 'uppercase', marginBottom: 8 }}>🎁 Hàng tặng kèm</div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8 }}>
                              {pgifts.map((b: any, bi: number) => (
                                <div key={bi} style={{ background: '#FFF7ED', borderRadius: 8, border: '1px solid #FED7AA', overflow: 'hidden' }}>
                                  {b.image_urls?.[0] && <img src={getImageUrl(b.image_urls[0])} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }} />}
                                  <div style={{ padding: '6px 8px' }}>
                                    <div style={{ fontWeight: 600, fontSize: 12 }}>{b.name}</div>
                                    <div style={{ fontSize: 12, color: '#D97706', fontWeight: 700 }}>{b.price > 0 ? formatCurrency(b.price) : '🎁 Miễn phí'}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

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

          {/* 💰 Lợi nhuận ước tính */}
          {simpleForm.price > 0 && (() => {
            const gross    = simpleForm.price
            const fee      = Math.round(gross * 0.30)
            const admin    = Math.round(gross * 0.15)
            const shipper  = Math.round(gross * 0.05)
            const vat      = Math.round(gross * 0.10)
            const profit   = gross - fee
            const fmt      = (n: number) => n.toLocaleString('vi-VN') + '₫'
            return (
              <div style={{
                borderRadius: 10, padding: '12px 14px',
                background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                border: '1px solid #86efac',
                fontSize: 13,
              }}>
                <div style={{ fontWeight: 700, color: '#15803d', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  💰 Ước tính lợi nhuận / đơn hàng
                </div>
                {/* Bar */}
                <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', height: 10, marginBottom: 10 }}>
                  <div style={{ width: '70%', background: '#16a34a' }} title="Lợi nhuận shop 70%" />
                  <div style={{ width: '15%', background: '#f59e0b' }} title="Admin 15%" />
                  <div style={{ width: '5%',  background: '#3b82f6' }} title="Shipper 5%" />
                  <div style={{ width: '10%', background: '#94a3b8' }} title="VAT 10%" />
                </div>
                {/* Rows */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>💵 Khách thanh toán</span>
                    <span style={{ fontWeight: 600, color: '#1e293b' }}>{fmt(gross)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>📉 Chi phí sàn (30%)</span>
                    <span style={{ color: '#dc2626' }}>−{fmt(fee)}</span>
                  </div>
                  <div style={{ paddingLeft: 14, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12 }}>
                      <span>└ Admin (15%)</span><span>−{fmt(admin)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12 }}>
                      <span>└ Shipper (5%)</span><span>−{fmt(shipper)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8', fontSize: 12 }}>
                      <span>└ VAT (10%)</span><span>−{fmt(vat)}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px dashed #86efac', paddingTop: 6, marginTop: 2 }}>
                    <span style={{ fontWeight: 700, color: '#15803d' }}>✅ Shop nhận được (70%)</span>
                    <span style={{ fontWeight: 800, fontSize: 15, color: '#15803d' }}>{fmt(profit)}</span>
                  </div>
                </div>
              </div>
            )
          })()}

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

          {/* Kích thước đóng gói */}
          <div style={{ background: '#F0FDF4', border: '1.5px solid #86EFAC', borderRadius: 14, padding: '16px 18px' }}>
            <p style={{ fontSize: 12, fontWeight: 800, color: '#15803D', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: 0.5 }}>
              📦 Kích thước đóng gói
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10 }}>
              {([
                { key: 'length' as const, label: 'Dài', unit: 'cm', icon: '↔️', placeholder: 'vd: 30' },
                { key: 'width'  as const, label: 'Rộng', unit: 'cm', icon: '↕️', placeholder: 'vd: 20' },
                { key: 'height' as const, label: 'Cao',  unit: 'cm', icon: '⬆️', placeholder: 'vd: 15' },
                { key: 'weight' as const, label: 'Cân nặng', unit: 'kg', icon: '⚖️', placeholder: 'vd: 1.5' },
              ]).map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 11, fontWeight: 700, color: '#166534', display: 'block', marginBottom: 5 }}>
                    {f.icon} {f.label} <span style={{ fontWeight: 400, color: '#64748B' }}>({f.unit})</span>
                  </label>
                  <input
                    className="input"
                    type="text"
                    inputMode="decimal"
                    value={packaging[f.key]}
                    onChange={e => setPkg(f.key, e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
            </div>
            {/* Tính toán tự động */}
            {(packaging.length !== '' && packaging.width !== '' && packaging.height !== '') ? (() => {
              const vol  = (parseFloat(packaging.length) * parseFloat(packaging.width) * parseFloat(packaging.height) / 1000).toFixed(1)
              const volW = (parseFloat(packaging.length) * parseFloat(packaging.width) * parseFloat(packaging.height) / 5000).toFixed(2)
              const actW = parseFloat(packaging.weight)
              const charge = Math.max(actW || 0, parseFloat(volW)).toFixed(2)
              return (
                <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
                  <div style={{ flex: 1, background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 9, padding: '8px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: '#3B82F6', fontWeight: 700, margin: 0 }}>Thể tích</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#1D4ED8', margin: '2px 0 0' }}>{vol} <span style={{ fontSize: 10, fontWeight: 400 }}>dm³</span></p>
                  </div>
                  <div style={{ flex: 1, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 9, padding: '8px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: '#16A34A', fontWeight: 700, margin: 0 }}>Cân thể tích</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#15803D', margin: '2px 0 0' }}>{volW} <span style={{ fontSize: 10, fontWeight: 400 }}>kg</span></p>
                  </div>
                  <div style={{ flex: 1, background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 9, padding: '8px 12px', textAlign: 'center' }}>
                    <p style={{ fontSize: 10, color: '#EA580C', fontWeight: 700, margin: 0 }}>Cân tính phí</p>
                    <p style={{ fontSize: 16, fontWeight: 800, color: '#C2410C', margin: '2px 0 0' }}>{charge} <span style={{ fontSize: 10, fontWeight: 400 }}>kg</span></p>
                  </div>
                </div>
              )
            })() : null}

            {/* Bảng phí vận chuyển theo bậc */}
            {sizeTiers.length > 0 && (() => {
              const l = parseFloat(packaging.length) || 0
              const w = parseFloat(packaging.width)  || 0
              const h = parseFloat(packaging.height) || 0
              const k = parseFloat(packaging.weight) || 0

              const mainTiers = sizeTiers.filter(t => t.tier_level <= 5).sort((a: any, b: any) => a.tier_level - b.tier_level)
              const pickTier = (val: number, field: string) => val > 0 ? mainTiers.find((t: any) => val <= t[field]) : mainTiers[0]
              const tl = pickTier(l, 'max_length_cm')
              const tw = pickTier(w, 'max_width_cm')
              const th = pickTier(h, 'max_height_cm')
              const tk = pickTier(k, 'max_weight_kg')
              const candidates = [tl, tw, th, tk].filter(Boolean)
              const oversized = [tl, tw, th, tk].some((v, i) => { const val = [l,w,h,k][i]; return val > 0 && !v })
              const assigned = oversized ? { tier_level: 6, label: 'Quá khổ', extra_fee: 200000 }
                : candidates.length > 0 ? candidates.reduce((a: any, b: any) => a.tier_level >= b.tier_level ? a : b) : null

              const tierColors: Record<number, string> = { 1:'#0D9488',2:'#2563EB',3:'#D97706',4:'#7C3AED',5:'#DC2626',6:'#B45309' }

              return (
                <div style={{ marginTop: 14 }}>
                  {/* Badge bậc hiện tại */}
                  {assigned && (
                    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 10,
                      background: tierColors[assigned.tier_level] + '15',
                      border: `2px solid ${tierColors[assigned.tier_level]}`, borderRadius: 10, padding: '10px 14px' }}>
                      <span style={{ fontSize: 22, fontWeight: 900, color: tierColors[assigned.tier_level] }}>Bậc {assigned.tier_level}</span>
                      <div>
                        <p style={{ fontWeight: 800, color: tierColors[assigned.tier_level], margin: 0, fontSize: 14 }}>🚚 {assigned.label}</p>
                        <p style={{ color: '#64748B', margin: '2px 0 0', fontSize: 12 }}>
                          Phí thêm: <strong style={{ color: '#DC2626' }}>+{((assigned.extra_fee || 0) as number).toLocaleString('vi-VN')}₫</strong>
                        </p>
                      </div>
                    </div>
                  )}
                  {/* Bảng tham khảo */}
                  <p style={{ fontSize: 11, fontWeight: 700, color: '#64748B', margin: '0 0 6px', textTransform: 'uppercase' }}>📋 Bảng phí tham khảo</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {mainTiers.map((t: any) => {
                      const isActive = assigned && assigned.tier_level === t.tier_level
                      return (
                        <div key={t.tier_level} style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '5px 10px', borderRadius: 7,
                          background: isActive ? tierColors[t.tier_level] + '20' : '#F8FAFC',
                          border: isActive ? `1.5px solid ${tierColors[t.tier_level]}` : '1px solid #F1F5F9',
                        }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 11, fontWeight: 800, color: tierColors[t.tier_level] }}>Bậc {t.tier_level}</span>
                            <span style={{ fontSize: 11, color: '#64748B' }}>{t.label} · ≤{t.max_length_cm}×{t.max_width_cm}×{t.max_height_cm}cm, ≤{t.max_weight_kg}kg</span>
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 700, color: t.extra_fee === 0 ? '#16A34A' : '#DC2626' }}>
                            {t.extra_fee === 0 ? 'Miễn phí' : `+${(t.extra_fee as number).toLocaleString('vi-VN')}₫`}
                          </span>
                        </div>
                      )
                    })}
                    {/* Quá khổ row */}
                    <div style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '5px 10px', borderRadius: 7,
                      background: assigned?.tier_level === 6 ? '#B4530920' : '#FEF9C3',
                      border: assigned?.tier_level === 6 ? '1.5px solid #B45309' : '1px solid #FEF08A',
                    }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#B45309' }}>Bậc 6</span>
                        <span style={{ fontSize: 11, color: '#92400E' }}>Quá khổ · Vượt bậc 5</span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#B45309' }}>+200,000₫</span>
                    </div>
                  </div>
                </div>
              )
            })()}
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
 