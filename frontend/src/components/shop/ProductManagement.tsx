import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { shopService } from '../../services/shopService'
import { productService } from '../../services/productService'
import { formatCurrency } from '../../utils/formatters'
import { getImageUrl } from '../../utils/helpers'
import Modal from '../common/Modal'
import Loading from '../common/Loading'

const EMPTY_FORM = { product_name: '', price: '', stock_quantity: 0, description: '', image_urls: [] as string[], category_id: '' as string | number }

const ProductManagement: React.FC = () => {
  const [products, setProducts] = useState<any[]>([])
  const [categories, setCategories] = useState<{ category_id: number; category_name: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [editProduct, setEditProduct] = useState<any>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [uploading, setUploading] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const [prodRes, catRes] = await Promise.all([
        shopService.getProducts(),
        productService.getCategories(),
      ])
      setProducts(prodRes.data.products)
      setCategories(catRes.data.categories || [])
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const openAdd = () => {
    setEditProduct(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
  }
  const openEdit = (p: any) => {
    setEditProduct(p)
    setForm({ product_name: p.product_name, price: p.price, stock_quantity: p.stock_quantity, description: p.description || '', image_urls: p.image_urls || [], category_id: p.category_id ?? '' })
    setModalOpen(true)
  }

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const res = await productService.uploadImage(file)
      const url: string = res.data?.url || res.data
      setForm(f => ({ ...f, image_urls: [url] }))
    } catch {
      toast.error('Upload ảnh thất bại')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleSave = async () => {
    try {
      const payload = {
        ...form,
        price: Number(form.price),
        category_id: form.category_id !== '' ? Number(form.category_id) : undefined,
      }
      if (editProduct) {
        await productService.update(editProduct.product_id, payload)
        toast.success('Đã cập nhật sản phẩm')
      } else {
        await productService.create(payload as any)
        toast.success('Đã thêm sản phẩm, chờ duyệt')
      }
      setModalOpen(false); load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi') }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Xóa sản phẩm này?')) return
    try { await productService.delete(id); toast.success('Đã xóa'); load() } catch { toast.error('Lỗi xóa') }
  }

  const STATUS_MAP: Record<string, { label: string; color: string }> = {
    active: { label: 'Đang bán', color: 'var(--success)' },
    pending: { label: 'Chờ duyệt', color: 'var(--warning)' },
    rejected: { label: 'Bị từ chối', color: 'var(--error)' },
    archived: { label: 'Đã xóa', color: 'var(--gray-400)' },
  }

  if (loading) return <Loading />

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontWeight: 700, fontSize: 18 }}>Sản phẩm ({products.length})</h2>
        <button onClick={openAdd} className="btn btn-primary">+ Thêm sản phẩm</button>
      </div>

      <div className="card table-wrapper">
        <table>
          <thead>
            <tr><th>Sản phẩm</th><th>Giá</th><th>Tồn kho</th><th>Đã bán</th><th>Trạng thái</th><th>Thao tác</th></tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.product_id}>
                <td>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    {p.image_urls?.[0] && <img src={getImageUrl(p.image_urls[0])} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 6 }} />}
                    <span style={{ fontWeight: 500, fontSize: 13 }}>{p.product_name}</span>
                  </div>
                </td>
                <td style={{ fontWeight: 600, color: 'var(--primary)' }}>{formatCurrency(p.price)}</td>
                <td>{p.stock_quantity}</td>
                <td>{p.sales_count}</td>
                <td>
                  <span style={{ fontSize: 12, fontWeight: 600, color: STATUS_MAP[p.status]?.color }}>
                    {STATUS_MAP[p.status]?.label || p.status}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openEdit(p)} className="btn btn-outline btn-sm">Sửa</button>
                    <button onClick={() => handleDelete(p.product_id)} className="btn btn-danger btn-sm">Xóa</button>
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
          <div>
            <label className="input-label">Danh mục</label>
            <select className="input" value={form.category_id} onChange={e => setForm(f => ({ ...f, category_id: e.target.value }))}>
              <option value="">-- Chọn danh mục --</option>
              {categories.map(c => (
                <option key={c.category_id} value={c.category_id}>{c.category_name}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setModalOpen(false)} className="btn btn-ghost">Hủy</button>
            <button onClick={handleSave} className="btn btn-primary" disabled={uploading}>
              {editProduct ? 'Cập nhật' : 'Thêm mới'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ProductManagement
