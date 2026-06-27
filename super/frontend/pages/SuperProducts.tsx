/**
 * super/frontend/pages/SuperProducts.tsx
 * ----------------------------------------
 * Superadmin — quản lý sản phẩm trực tiếp trong DB.
 * Có thể sửa ảnh, tên, giá, trạng thái, xóa cứng.
 */
import React, { useEffect, useState, useRef } from 'react'
import superApi, { uploadFile } from '../superApi'
import { getImageUrl } from '@/utils/helpers'

const S = {
  bg:      '#0a0a0f',
  card:    '#13131a',
  border:  '#1e1e2e',
  red:     '#dc2626',
  redDark: '#7f1d1d',
  text:    '#f1f5f9',
  muted:   '#475569',
  input:   '#1e1e2e',
}

interface Product {
  product_id:    number
  product_name:  string
  shop_id:       number
  price:         string
  stock_quantity: number
  image_urls:    string[]
  status:        string
  is_featured:   boolean
  sales_count:   number
}

const STATUS_COLOR: Record<string, string> = {
  active: '#16a34a', pending: '#d97706', hidden: '#64748b', rejected: '#dc2626',
}

const SuperProducts: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [status, setStatus]     = useState('all')
  const [page, setPage]         = useState(1)

  // Image modal
  const [imgProduct, setImgProduct]   = useState<Product | null>(null)
  const [previewUrl, setPreviewUrl]   = useState('')
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [saving, setSaving]           = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // Edit modal
  const [editProduct, setEditProduct] = useState<Product | null>(null)
  const [editForm, setEditForm]       = useState<Partial<Product>>({})

  const load = (s = status, q = search, p = page) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p) })
    if (s !== 'all') params.set('status', s)
    if (q) params.set('search', q)
    superApi.get(`/products?${params}`)
      .then(r => { setProducts(r.data.products || []); setTotal(r.data.total || 0) })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [status, page])

  const handleSearch = (e: React.FormEvent) => { e.preventDefault(); setPage(1); load(status, search, 1) }

  // ── Image upload ──
  const openImg = (p: Product) => {
    setImgProduct(p)
    setPreviewUrl(p.image_urls?.[0] || '')
    setPendingFile(null)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setPendingFile(file)
    setPreviewUrl(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleSaveImage = async () => {
    if (!imgProduct) return
    setSaving(true)
    try {
      let url = imgProduct.image_urls?.[0] || ''
      if (pendingFile) {
        url = await uploadFile(pendingFile)
      }
      await superApi.patch(`/products/${imgProduct.product_id}`, {
        image_urls: url ? [url] : [],
      })
      setProducts(ps => ps.map(p => p.product_id === imgProduct.product_id ? { ...p, image_urls: url ? [url] : [] } : p))
      setImgProduct(null)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi lưu ảnh')
    } finally { setSaving(false) }
  }

  // ── Edit product ──
  const openEdit = (p: Product) => {
    setEditProduct(p)
    setEditForm({ product_name: p.product_name, price: p.price as any, stock_quantity: p.stock_quantity, status: p.status })
  }

  const handleSaveEdit = async () => {
    if (!editProduct) return
    try {
      await superApi.patch(`/products/${editProduct.product_id}`, editForm)
      setProducts(ps => ps.map(p => p.product_id === editProduct.product_id ? { ...p, ...editForm } : p))
      setEditProduct(null)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi khi cập nhật')
    }
  }

  // ── Hard delete ──
  const handleHardDelete = async (p: Product) => {
    if (!confirm(`XÓA CỨNG: ${p.product_name} (ID: ${p.product_id})\nKHÔNG THỂ PHỤC HỒI. Tiếp tục?`)) return
    try {
      await superApi.delete(`/products/${p.product_id}/hard`)
      setProducts(ps => ps.filter(x => x.product_id !== p.product_id))
      setTotal(t => t - 1)
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi xóa')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ color: S.text, fontSize: 20, fontWeight: 800, margin: 0 }}>📦 Sản phẩm</h1>
        <p style={{ color: S.muted, fontSize: 12, marginTop: 4 }}>
          Tổng: {total} — can thiệp trực tiếp DB, không ghi log
        </p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        {['all','active','pending','hidden','rejected'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            style={{
              padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
              background: status === s ? S.red : S.card,
              color: status === s ? '#fff' : S.muted,
            }}>
            {s === 'all' ? 'Tất cả' : s}
          </button>
        ))}
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm sản phẩm..."
            style={{ padding: '7px 12px', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
          <button type="submit" style={{ padding: '7px 14px', background: S.red, color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Tìm</button>
        </form>
      </div>

      {/* Grid */}
      {loading
        ? <div style={{ color: S.muted, textAlign: 'center', padding: 40 }}>Đang tải...</div>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {products.map(p => (
              <div key={p.product_id} style={{ background: S.card, border: `1px solid ${S.border}`, borderRadius: 12, overflow: 'hidden' }}>
                {/* Image */}
                <div style={{ height: 140, position: 'relative', background: '#0a0a0f', overflow: 'hidden' }}>
                  {p.image_urls?.[0]
                    ? <img src={getImageUrl(p.image_urls[0])} alt={p.product_name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: S.border }}>📦</div>
                  }
                  <button onClick={() => openImg(p)} style={{
                    position: 'absolute', bottom: 8, right: 8,
                    padding: '4px 9px', background: 'rgba(0,0,0,0.7)', color: '#fff',
                    border: 'none', borderRadius: 6, fontSize: 11, cursor: 'pointer',
                  }}>📷 Ảnh</button>
                </div>

                <div style={{ padding: '12px 14px' }}>
                  <p style={{ color: S.text, fontWeight: 600, fontSize: 13, margin: '0 0 4px', lineHeight: 1.3 }}>
                    {p.product_name}
                  </p>
                  <p style={{ color: '#16a34a', fontSize: 13, fontWeight: 700, margin: '0 0 2px' }}>
                    {Number(p.price || 0).toLocaleString('vi-VN')}₫
                  </p>
                  <p style={{ color: S.muted, fontSize: 11, margin: '0 0 10px' }}>
                    ID:{p.product_id} · Shop:{p.shop_id} · Tồn:{p.stock_quantity}
                    &nbsp;·&nbsp;
                    <span style={{ color: STATUS_COLOR[p.status] || S.muted }}>
                      {p.status}
                    </span>
                  </p>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(p)} style={{
                      flex: 1, padding: '6px', background: '#1e1e2e', color: '#94a3b8',
                      border: `1px solid ${S.border}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>✏️ Sửa</button>
                    <button onClick={() => handleHardDelete(p)} style={{
                      padding: '6px 10px', background: '#2d1010', color: '#ef4444',
                      border: `1px solid ${S.redDark}`, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer',
                    }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      }

      {/* Pagination */}
      {total > 30 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>← Trước</button>
          <span style={{ padding: '7px 14px', color: S.muted, fontSize: 13 }}>Trang {page}</span>
          <button onClick={() => setPage(p => p + 1)} disabled={products.length < 30}
            style={{ padding: '7px 14px', background: S.card, border: `1px solid ${S.border}`, color: S.text, borderRadius: 7, cursor: 'pointer', fontSize: 13 }}>Tiếp →</button>
        </div>
      )}

      {/* ── Image modal ── */}
      {imgProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => !saving && setImgProduct(null)}>
          <div style={{ width: 380, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>📷 Cập nhật ảnh</h2>
              <button onClick={() => setImgProduct(null)} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <p style={{ color: S.muted, fontSize: 12, margin: 0 }}>
              {imgProduct.product_name} (ID: {imgProduct.product_id})
            </p>
            <div style={{ height: 180, borderRadius: 10, overflow: 'hidden', border: `2px dashed ${S.border}`, background: '#0a0a0f', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => fileRef.current?.click()}>
              {previewUrl
                ? <img src={previewUrl.startsWith('blob:') ? previewUrl : getImageUrl(previewUrl)}
                    alt="preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: S.muted }}>
                    <div style={{ fontSize: 36 }}>🖼️</div>
                    <p style={{ fontSize: 12, marginTop: 6 }}>Click để chọn ảnh</p>
                  </div>
              }
            </div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => fileRef.current?.click()} style={{ flex: 1, padding: '9px', background: '#1e1e2e', color: S.text, border: `1px solid ${S.border}`, borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>📁 Chọn ảnh</button>
              {previewUrl && <button onClick={() => { setPreviewUrl(''); setPendingFile(null) }} style={{ padding: '9px 12px', background: '#2d1010', color: '#ef4444', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer' }}>✕</button>}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setImgProduct(null)} disabled={saving} style={{ padding: '9px 18px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSaveImage} disabled={saving} style={{ padding: '9px 20px', background: saving ? S.redDark : S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer' }}>
                {saving ? 'Đang lưu...' : '💾 Lưu vào DB'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit modal ── */}
      {editProduct && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setEditProduct(null)}>
          <div style={{ width: 400, background: S.card, border: `1px solid ${S.border}`, borderRadius: 14, padding: 28, display: 'flex', flexDirection: 'column', gap: 14 }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ color: S.text, fontSize: 15, fontWeight: 800, margin: 0 }}>✏️ Sửa sản phẩm ID:{editProduct.product_id}</h2>
              <button onClick={() => setEditProduct(null)} style={{ background: 'none', border: 'none', color: S.muted, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            {[
              { label: 'Tên sản phẩm', key: 'product_name', type: 'text' },
              { label: 'Giá (VND)', key: 'price', type: 'number' },
              { label: 'Tồn kho', key: 'stock_quantity', type: 'number' },
            ].map(({ label, key, type }) => (
              <div key={key}>
                <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>{label.toUpperCase()}</label>
                <input type={type} value={(editForm as any)[key] ?? ''} onChange={e => setEditForm(f => ({ ...f, [key]: type === 'number' ? Number(e.target.value) : e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }} />
              </div>
            ))}
            <div>
              <label style={{ display: 'block', color: '#94a3b8', fontSize: 11, fontWeight: 600, marginBottom: 5 }}>TRẠNG THÁI</label>
              <select value={editForm.status ?? ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                style={{ width: '100%', padding: '9px 12px', boxSizing: 'border-box', background: S.input, border: `1px solid ${S.border}`, borderRadius: 7, color: S.text, fontSize: 13, outline: 'none' }}>
                {['active', 'pending', 'hidden', 'rejected'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button onClick={() => setEditProduct(null)} style={{ padding: '9px 18px', background: 'none', border: `1px solid ${S.border}`, borderRadius: 8, color: S.muted, fontSize: 13, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSaveEdit} style={{ padding: '9px 20px', background: S.red, color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>💾 Lưu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SuperProducts
