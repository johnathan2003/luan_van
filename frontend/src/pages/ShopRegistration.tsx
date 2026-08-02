import React, { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { userService } from '../services/userService'

const ShopRegistration: React.FC = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({ shop_name: '', description: '', address: '', phone: '', price_min: '', price_max: '' })
  const [loading, setLoading] = useState(false)
  const [previewImgs, setPreviewImgs] = useState<string[]>([])
  const imgRef = useRef<HTMLInputElement>(null)

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    const urls = files.map(f => URL.createObjectURL(f))
    setPreviewImgs(prev => [...prev, ...urls].slice(0, 5))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.shop_name || !form.address) { toast.warning('Vui lòng điền đầy đủ thông tin bắt buộc'); return }
    setLoading(true)
    try {
      await userService.registerShop(form)
      toast.success('Đã gửi đăng ký shop! Vui lòng chờ admin phê duyệt.')
      navigate('/profile')
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi đăng ký') }
    finally { setLoading(false) }
  }

  return (
    <div style={{
      minHeight: '100vh',
      backgroundImage: 'url(/background_DKshop.png)',
      backgroundSize: 'cover',
      backgroundPosition: 'center',
      backgroundRepeat: 'no-repeat',
    }}>
      <div className="container" style={{ paddingTop: 48, paddingBottom: 48, maxWidth: 600 }}>
        <div className="card" style={{ padding: 40 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🏪</div>
            <h1 style={{ fontWeight: 800, fontSize: 26, marginBottom: 8 }}>Đăng ký mở shop</h1>
            <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Điền thông tin để bắt đầu bán hàng trên ShopVN</p>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {[
              { label: 'Tên shop *', key: 'shop_name', placeholder: 'Tên cửa hàng của bạn' },
              { label: 'Địa chỉ kho hàng *', key: 'address', placeholder: 'Địa chỉ kho/shop' },
              { label: 'Số điện thoại', key: 'phone', placeholder: '0909...' },
            ].map(({ label, key, placeholder }) => (
              <div key={key}>
                <label className="input-label">{label}</label>
                <input className="input" placeholder={placeholder} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
              </div>
            ))}
            <div>
              <label className="input-label">Mô tả shop</label>
              <textarea className="input" rows={3} placeholder="Giới thiệu shop, ngành hàng kinh doanh..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
            </div>

            {/* Hình ảnh sản phẩm muốn bán */}
            <div>
              <label className="input-label">Hình ảnh sản phẩm muốn bán <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(tối đa 5 ảnh)</span></label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                {previewImgs.map((src, i) => (
                  <div key={i} style={{ position: 'relative', width: 80, height: 80 }}>
                    <img src={src} alt="" style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border-subtle)' }} />
                    <button type="button" onClick={() => setPreviewImgs(p => p.filter((_, idx) => idx !== i))}
                      style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                  </div>
                ))}
                {previewImgs.length < 5 && (
                  <button type="button" onClick={() => imgRef.current?.click()}
                    style={{ width: 80, height: 80, borderRadius: 10, border: '2px dashed var(--border-subtle)', background: 'var(--gray-50)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--gray-400)', fontSize: 12 }}>
                    <span style={{ fontSize: 22 }}>📷</span>Thêm ảnh
                  </button>
                )}
                <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgChange} />
              </div>
            </div>

            {/* Khoảng giá */}
            <div>
              <label className="input-label">Khoảng giá sản phẩm (₫)</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginTop: 4 }}>
                <input className="input" type="number" placeholder="Giá thấp nhất" value={form.price_min} onChange={e => setForm(f => ({ ...f, price_min: e.target.value }))} />
                <span style={{ textAlign: 'center', color: 'var(--gray-400)', fontWeight: 600 }}>—</span>
                <input className="input" type="number" placeholder="Giá cao nhất" value={form.price_max} onChange={e => setForm(f => ({ ...f, price_max: e.target.value }))} />
              </div>
            </div>

            <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 14, fontSize: 13, color: 'var(--gray-600)' }}>
              ℹ️ Sau khi gửi, admin sẽ xem xét và phê duyệt trong vòng 1-3 ngày làm việc.
            </div>
            <button type="submit" disabled={loading} className="btn btn-primary btn-lg w-full">
              {loading ? 'Đang gửi...' : '📤 Gửi đăng ký'}
            </button>
          </form>
        </div>
      </div>

    </div>
  )
}

export default ShopRegistration
