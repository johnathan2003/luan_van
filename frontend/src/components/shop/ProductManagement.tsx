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

  const MAX_IMAGES = 5

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    const remaining = MAX_IMAGES - form.image_urls.length
    const toUpload = files.slice(0, remaining)
    if (toUpload.length < files.length) toast.info(`Tối đa ${MAX_IMAGES} ảnh, đã bỏ qua ${files.length - toUpload.length} ảnh`)
    setUploading(true)
    try {
      const urls = await Promise.all(toUpload.map(async f => {
        const res = await productService.uploadImage(f)
        return res.data?.url || res.data as string
      }))
      setForm(f => ({ ...f, image_urls: [...f.image_urls, ...urls] }))
    } catch {
      toast.error('Upload ảnh thất bại')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const removeImage = (idx: number) => {
    setForm(f => ({ ...f, image_urls: f.image_urls.filter((_, i) => i !== idx) }))
  }

  const moveImage = (from: number, to: number) => {
    setForm(f => {
      const arr = [...f.image_urls]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return { ...f, image_urls: arr }
    })
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

          {/* Ảnh sản phẩm — multi-image */}
          <div>
            <label className="input-label">
              Ảnh sản phẩm{' '}
              <span style={{ fontWeight: 400, color: 'var(--gray-400)', fontSize: 11 }}>
                ({form.image_urls.length}/{MAX_IMAGES} — ảnh đầu tiên là ảnh chính)
              </span>
            </label>

            {/* Thumbnail grid */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              {form.image_urls.map((url, i) => (
                <div key={i} style={{ position: 'relative', width: 76, height: 76 }}>
                  <img src={getImageUrl(url)} alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 8,
                      border: i === 0 ? '2px solid var(--primary)' : '2px solid var(--border-subtle)' }} />
                  {/* Ảnh chính badge */}
                  {i === 0 && (
                    <span style={{
                      position: 'absolute', top: 2, left: 2, fontSize: 9, fontWeight: 700,
                      background: 'var(--primary)', color: '#fff', padding: '1px 5px', borderRadius: 4,
                    }}>Chính</span>
                  )}
                  {/* Di chuyển trái */}
                  {i > 0 && (
                    <button onClick={() => moveImage(i, i - 1)} title="Di chuyển lên trước" style={{
                      position: 'absolute', bottom: 2, left: 2, width: 18, height: 18,
                      background: 'rgba(0,0,0,0.55)', border: 'none', borderRadius: 4,
                      color: '#fff', fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                    }}>‹</button>
                  )}
                  {/* Xóa */}
                  <button onClick={() => removeImage(i)} title="Xóa ảnh" style={{
                    position: 'absolute', top: 2, right: 2, width: 18, height: 18,
                    background: 'rgba(220,38,38,0.85)', border: 'none', borderRadius: '50%',
                    color: '#fff', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    lineHeight: 1, padding: 0,
                  }}>×</button>
                </div>
              ))}

              {/* Add button */}
              {form.image_urls.length < MAX_IMAGES && (
                <label style={{
                  width: 76, height: 76, borderRadius: 8,
                  border: '2px dashed var(--border-subtle)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  cursor: uploading ? 'not-allowed' : 'pointer',
                  background: 'var(--bg-page)', gap: 4,
                  opacity: uploading ? 0.5 : 1,
                }}>
                  <span style={{ fontSize: 22, lineHeight: 1 }}>{uploading ? '⏳' : '+'}</span>
                  <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>{uploading ? 'Đang tải' : 'Thêm ảnh'}</span>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={uploading} onChange={handleImageChange} />
                </label>
              )}
            </div>
            <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: -4 }}>
              JPG, PNG, WebP — tối đa 5MB/ảnh · Nhấn ‹ để đặt làm ảnh chính
            </p>
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
