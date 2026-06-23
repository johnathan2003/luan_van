import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { userService } from '../services/userService'

const ShopRegistration: React.FC = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({ shop_name: '', description: '', address: '', phone: '' })
  const [loading, setLoading] = useState(false)

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
    <div className="page-wrapper">

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
              <textarea className="input" rows={3} placeholder="Giới thiệu shop..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} style={{ resize: 'vertical' }} />
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
