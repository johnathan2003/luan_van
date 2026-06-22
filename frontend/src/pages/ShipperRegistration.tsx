import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { userService } from '../services/userService'

const ShipperRegistration: React.FC = () => {
  const navigate = useNavigate()
  const [form, setForm] = useState({ vehicle_type: 'motorcycle', license_plate: '' })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await userService.registerShipper(form)
      toast.success('Đã gửi đăng ký shipper! Chờ admin phê duyệt.')
      navigate('/profile')
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi') }
    finally { setLoading(false) }
  }

  return (
    <div className="page-wrapper">

      <div className="container" style={{ paddingTop: 48, paddingBottom: 48, maxWidth: 500 }}>
        <div className="card" style={{ padding: 40 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🚚</div>
            <h1 style={{ fontWeight: 800, fontSize: 26, marginBottom: 8 }}>Đăng ký làm shipper</h1>
            <p style={{ color: 'var(--gray-500)', fontSize: 14 }}>Kiếm thu nhập thêm bằng cách giao hàng cho ShopVN</p>
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <label className="input-label">Loại phương tiện *</label>
              <select className="input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                <option value="motorcycle">🏍️ Xe máy</option>
                <option value="car">🚗 Xe ô tô</option>
                <option value="truck">🚛 Xe tải</option>
              </select>
            </div>
            <div>
              <label className="input-label">Biển số xe</label>
              <input className="input" placeholder="VD: 51A-12345" value={form.license_plate} onChange={e => setForm(f => ({ ...f, license_plate: e.target.value }))} />
            </div>
            <div style={{ background: 'var(--gray-50)', borderRadius: 'var(--radius)', padding: 14, fontSize: 13, color: 'var(--gray-600)' }}>
              ℹ️ Admin sẽ xem xét hồ sơ và phê duyệt trong 1-2 ngày làm việc.
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

export default ShipperRegistration
