/**
 * 🏷️ Product Admin — Quản lý sản phẩm (superadmin/admin)
 * - Load sản phẩm thật từ API theo tab
 * - Hiển thị ảnh thật
 * - Upload ảnh trực tiếp vào DB qua PATCH /admin/products/{id}/image
 */
import React, { useEffect, useState, useRef } from 'react'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import { productService } from '../../services/productService'
import { getImageUrl } from '../../utils/helpers'
import Loading from '../../components/common/Loading'

const C = {
  navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE',
  tint: '#EFF6FF', gray: '#64748B', success: '#16A34A',
  warning: '#D97706', error: '#DC2626',
}

const TABS = ['all', 'pending', 'active', 'hidden', 'rejected'] as const
const TAB_LABELS: Record<string, string> = {
  all: 'Tất cả', pending: 'Chờ duyệt', active: 'Đang bán',
  hidden: 'Đã ẩn', rejected: 'Từ chối',
}
const TAB_COLORS: Record<string, string> = {
  all: C.blue, pending: C.warning, active: C.success, hidden: C.gray, rejected: C.error,
}

interface Product {
  product_id: number
  product_name: string
  shop_id: number
  price: string
  stock_quantity: number
  image_urls: string[]
  status: string
  is_featured?: boolean
  sales_count?: number
}

const ProductAdminPage: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading]   = useState(true)
  const [tab, setTab]           = useState<string>('all')
  const [search, setSearch]     = useState('')

  // Modal upload ảnh
  const [imgModal, setImgModal]       = useState<Product | null>(null)
  const [previewUrl, setPreviewUrl]   = useState<string>('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [uploading, setUploading]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const load = (status = tab, q = search) => {
    setLoading(true)
    adminService.getAllProducts(status === 'all' ? undefined : status, q || undefined)
      .then(r => setProducts(r.data?.products || []))
      .catch(() => toast.error('Không tải được danh sách sản phẩm'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load(tab, search) }, [tab])   // eslint-disable-line

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    load(tab, search)
  }

  const handleApprove = async (id: number) => {
    try {
      await adminService.approveProduct(id)
      toast.success('Đã duyệt sản phẩm')
      setProducts(p => p.map(x => x.product_id === id ? { ...x, status: 'active' } : x))
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi') }
  }

  const handleReject = async (id: number) => {
    const reason = window.prompt('Lý do từ chối:')
    if (!reason) return
    try {
      await adminService.rejectProduct(id, reason)
      toast.success('Đã từ chối')
      setProducts(p => p.map(x => x.product_id === id ? { ...x, status: 'rejected' } : x))
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi') }
  }

  // ── Image modal ──
  const openImgModal = (p: Product) => {
    setImgModal(p)
    setPreviewUrl(p.image_urls?.[0] || '')
    setPendingFile(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleSaveImage = async () => {
    if (!imgModal) return
    setUploading(true)
    try {
      let finalUrl = imgModal.image_urls?.[0] || ''

      if (pendingFile) {
        const res = await productService.uploadImage(pendingFile)
        finalUrl = res.data?.url || res.data
      }

      await adminService.updateProductImage(imgModal.product_id, finalUrl ? [finalUrl] : [])
      toast.success('Đã cập nhật ảnh sản phẩm!')
      setProducts(p => p.map(x =>
        x.product_id === imgModal.product_id
          ? { ...x, image_urls: finalUrl ? [finalUrl] : [] }
          : x
      ))
      setImgModal(null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Cập nhật ảnh thất bại')
    } finally {
      setUploading(false)
    }
  }

  const handleRemoveImage = () => {
    setPreviewUrl('')
    setPendingFile(null)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🏷️ Quản lý sản phẩm</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
          Duyệt sản phẩm, ẩn/hiện, upload ảnh trực tiếp vào database
        </p>
      </div>

      {/* Tabs + Search */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 600,
              background: tab === t ? TAB_COLORS[t] : C.tint,
              color: tab === t ? 'white' : C.gray,
            }}>{TAB_LABELS[t]}</button>
          ))}
        </div>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="🔍 Tìm sản phẩm..."
            style={{ flex: 1, padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}
          />
          <button type="submit" style={{ padding: '8px 14px', borderRadius: 8, background: C.blue, color: '#fff', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            Tìm
          </button>
        </form>
      </div>

      {/* Product grid */}
      {loading ? <Loading /> : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
          {products.length === 0 ? (
            <div className="card" style={{ padding: 32, textAlign: 'center', color: C.gray, gridColumn: '1/-1' }}>
              Không có sản phẩm nào
            </div>
          ) : products.map(p => (
            <div key={p.product_id} className="card" style={{ overflow: 'hidden' }}>
              {/* Ảnh sản phẩm */}
              <div style={{ height: 150, position: 'relative', background: C.tint, overflow: 'hidden' }}>
                {p.image_urls?.[0]
                  ? <img src={getImageUrl(p.image_urls[0])} alt={p.product_name}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: C.light }}>
                      🛍️
                    </div>
                }
                {/* Overlay nút sửa ảnh */}
                <button
                  onClick={() => openImgModal(p)}
                  style={{
                    position: 'absolute', bottom: 8, right: 8,
                    padding: '5px 10px', borderRadius: 6, border: 'none',
                    background: 'rgba(0,0,0,0.65)', color: '#fff',
                    fontSize: 11, fontWeight: 600, cursor: 'pointer',
                  }}>
                  📷 Sửa ảnh
                </button>
              </div>

              <div style={{ padding: '14px 16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: C.navy, flex: 1, marginRight: 8, lineHeight: 1.3 }}>
                    {p.product_name}
                  </p>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, flexShrink: 0,
                    background: TAB_COLORS[p.status] + '20', color: TAB_COLORS[p.status],
                  }}>
                    {TAB_LABELS[p.status] || p.status}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: C.success, fontWeight: 700, marginBottom: 3 }}>
                  {Number(p.price || 0).toLocaleString('vi-VN')}₫
                </p>
                <p style={{ fontSize: 11, color: C.gray, marginBottom: 12 }}>
                  Shop #{p.shop_id} · Tồn: {p.stock_quantity ?? 0} · Bán: {p.sales_count ?? 0}
                </p>

                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {p.status === 'pending' && <>
                    <button onClick={() => handleApprove(p.product_id)}
                      style={{ flex: 1, padding: '7px', background: C.success, color: 'white', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      ✅ Duyệt
                    </button>
                    <button onClick={() => handleReject(p.product_id)}
                      style={{ flex: 1, padding: '7px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      ❌ Từ chối
                    </button>
                  </>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal upload ảnh ── */}
      {imgModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !uploading && setImgModal(null)}
        >
          <div
            className="card"
            style={{ width: 400, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>📷 Cập nhật ảnh sản phẩm</h2>
              <button onClick={() => setImgModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>

            <p style={{ fontSize: 13, color: C.gray, marginTop: -10 }}>
              <strong>{imgModal.product_name}</strong> (ID: {imgModal.product_id})
            </p>

            {/* Preview */}
            <div style={{
              width: '100%', height: 200, borderRadius: 10, overflow: 'hidden',
              border: '2px dashed var(--border-subtle)',
              background: C.tint,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', position: 'relative',
            }}
              onClick={() => fileRef.current?.click()}
            >
              {previewUrl
                ? <img
                    src={previewUrl.startsWith('blob:') ? previewUrl : getImageUrl(previewUrl)}
                    alt="preview"
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                : <div style={{ textAlign: 'center', color: C.gray }}>
                    <div style={{ fontSize: 40, marginBottom: 8 }}>🖼️</div>
                    <p style={{ fontSize: 13 }}>Click để chọn ảnh</p>
                  </div>
              }
              {previewUrl && (
                <div style={{
                  position: 'absolute', inset: 0, background: 'rgba(0,0,0,0)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  transition: 'background 0.2s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(0,0,0,0.3)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(0,0,0,0)')}
                >
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, opacity: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                  >🔄 Đổi ảnh</span>
                </div>
              )}
            </div>

            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={() => fileRef.current?.click()}
                style={{ flex: 1, padding: '9px', background: C.blue, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
              >
                📁 Chọn ảnh
              </button>
              {previewUrl && (
                <button
                  onClick={handleRemoveImage}
                  style={{ padding: '9px 14px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}
                >
                  ✕ Xóa
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', paddingTop: 4, borderTop: '1px solid var(--border-subtle)' }}>
              <button onClick={() => setImgModal(null)} disabled={uploading}
                style={{ padding: '9px 20px', background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 8, fontSize: 13, cursor: 'pointer', color: C.gray }}>
                Hủy
              </button>
              <button onClick={handleSaveImage} disabled={uploading}
                style={{ padding: '9px 24px', background: uploading ? '#9CA3AF' : C.success, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: uploading ? 'not-allowed' : 'pointer' }}>
                {uploading ? 'Đang lưu...' : '💾 Lưu vào DB'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProductAdminPage
