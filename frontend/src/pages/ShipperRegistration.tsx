import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { userService } from '../services/userService'

const SHIPPER_TYPES = [
  {
    value: 'zone',
    icon: '🏍️',
    label: 'Ship Khu Vực',
    vehicle: 'Xe máy / ô tô',
    desc: 'Phụ trách 1 tỉnh/thành cố định. Lấy hàng từ kho khu vực và giao đến tay khách.',
    color: '#0D9488',
    bg: '#CCFBF1',
  },
  {
    value: 'inter_province',
    icon: '🚚',
    label: 'Ship Liên Tỉnh',
    vehicle: 'Xe tải',
    desc: 'Vận chuyển hàng loạt giữa các kho tỉnh thành. Yêu cầu xe tải và kinh nghiệm lái đường dài.',
    color: '#D97706',
    bg: '#FEF3C7',
  },
]

const PROVINCES = [
  'TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Hải Phòng',
  'Bình Dương', 'Đồng Nai', 'Bà Rịa - Vũng Tàu', 'An Giang', 'Khánh Hòa',
  'Nghệ An', 'Thanh Hóa', 'Bình Định', 'Long An', 'Tiền Giang',
]

const ShipperRegistration: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<1|2>(1)
  const [shipperType, setShipperType] = useState<string>('')
  const [form, setForm] = useState({
    vehicle_type: 'motorcycle',
    license_plate: '',
    zone_province: '',
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await userService.registerShipper({ ...form, shipper_type: shipperType })
      toast.success('Đã gửi đăng ký shipper! Chờ admin phê duyệt.')
      navigate('/profile')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi khi gửi đăng ký')
    } finally {
      setLoading(false)
    }
  }

  const selectedType = SHIPPER_TYPES.find(t => t.value === shipperType)

  return (
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 48, paddingBottom: 48, maxWidth: 600 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>🚚</div>
          <h1 style={{ fontWeight: 800, fontSize: 28, marginBottom: 8, color: '#1E3A5F' }}>Đăng ký làm Shipper</h1>
          <p style={{ color: '#64748B', fontSize: 15 }}>Kiếm thu nhập thêm bằng cách giao hàng cho ShopVN</p>

          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
            {[1, 2].map(s => (
              <React.Fragment key={s}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 14,
                  background: step >= s ? '#D97706' : '#E2E8F0',
                  color: step >= s ? '#fff' : '#94A3B8',
                }}>
                  {s}
                </div>
                {s < 2 && <div style={{ width: 60, height: 2, background: step > s ? '#D97706' : '#E2E8F0', borderRadius: 2 }} />}
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 44, marginTop: 6 }}>
            {['Chọn loại shipper', 'Thông tin xe'].map((l, i) => (
              <span key={l} style={{ fontSize: 12, color: step >= i + 1 ? '#D97706' : '#94A3B8', fontWeight: step === i + 1 ? 700 : 400 }}>{l}</span>
            ))}
          </div>
        </div>

        {/* Step 1: Chọn loại shipper */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {SHIPPER_TYPES.map(t => (
              <div key={t.value} onClick={() => setShipperType(t.value)}
                style={{
                  borderRadius: 16, padding: '20px 22px', cursor: 'pointer', transition: 'all 0.15s',
                  border: '2px solid ' + (shipperType === t.value ? t.color : '#E2E8F0'),
                  background: shipperType === t.value ? t.bg : '#fff',
                  boxShadow: shipperType === t.value ? '0 4px 16px rgba(0,0,0,0.08)' : 'none',
                }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: t.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, flexShrink: 0 }}>
                    {t.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                      <span style={{ fontWeight: 800, fontSize: 16, color: t.color }}>{t.label}</span>
                      <span style={{ fontSize: 12, background: t.bg, color: t.color, borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>
                        🚗 {t.vehicle}
                      </span>
                    </div>
                    <p style={{ fontSize: 14, color: '#374151', margin: 0, lineHeight: 1.6 }}>{t.desc}</p>
                  </div>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%', border: '2px solid ' + (shipperType === t.value ? t.color : '#CBD5E1'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 4,
                    background: shipperType === t.value ? t.color : 'transparent',
                  }}>
                    {shipperType === t.value && <span style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>✓</span>}
                  </div>
                </div>
              </div>
            ))}

            <button onClick={() => setStep(2)} disabled={!shipperType}
              style={{
                padding: '13px', borderRadius: 12, border: 'none', cursor: shipperType ? 'pointer' : 'default',
                background: shipperType ? '#D97706' : '#E2E8F0', color: shipperType ? '#fff' : '#94A3B8',
                fontWeight: 800, fontSize: 15, marginTop: 8, transition: 'all 0.15s',
              }}>
              Tiếp theo → Nhập thông tin xe
            </button>
          </div>
        )}

        {/* Step 2: Thông tin xe + submit */}
        {step === 2 && selectedType && (
          <div className="card" style={{ padding: 36 }}>
            {/* Selected type recap */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '14px 18px', background: selectedType.bg, borderRadius: 12 }}>
              <span style={{ fontSize: 28 }}>{selectedType.icon}</span>
              <div>
                <p style={{ fontWeight: 800, color: selectedType.color, margin: 0 }}>{selectedType.label}</p>
                <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>{selectedType.vehicle}</p>
              </div>
              <button onClick={() => setStep(1)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: '#64748B', fontSize: 13, fontWeight: 600 }}>
                ✏️ Đổi loại
              </button>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {/* Vehicle type */}
              <div>
                <label className="input-label">Loại phương tiện *</label>
                <select className="input" value={form.vehicle_type}
                  onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
                  {shipperType === 'inter_province' ? (
                    <>
                      <option value="truck_small">🚛 Xe tải nhỏ (dưới 2.5T)</option>
                      <option value="truck_medium">🚚 Xe tải trung (2.5T–5T)</option>
                      <option value="truck_large">🏗️ Xe tải lớn (trên 5T)</option>
                    </>
                  ) : (
                    <>
                      <option value="motorcycle">🏍️ Xe máy</option>
                      <option value="electric_bike">🛵 Xe máy điện</option>
                      <option value="car">🚗 Xe ô tô</option>
                    </>
                  )}
                </select>
              </div>

              {/* License plate */}
              <div>
                <label className="input-label">Biển số xe *</label>
                <input className="input" placeholder="VD: 51A-12345" required
                  value={form.license_plate}
                  onChange={e => setForm(f => ({ ...f, license_plate: e.target.value }))} />
              </div>

              {/* Zone province — for zone & inter_province */}
              {(shipperType === 'zone' || shipperType === 'inter_province') && (
                <div>
                  <label className="input-label">
                    {shipperType === 'zone' ? 'Tỉnh/thành phụ trách *' : 'Kho xuất phát (tỉnh/thành) *'}
                  </label>
                  <select className="input" value={form.zone_province} required
                    onChange={e => setForm(f => ({ ...f, zone_province: e.target.value }))}>
                    <option value="">-- Chọn tỉnh/thành --</option>
                    {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
              )}

              <div style={{ background: '#F0F9FF', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#0369A1' }}>
                ℹ️ Admin sẽ xem xét hồ sơ và phê duyệt trong 1-2 ngày làm việc. Bạn sẽ nhận được thông báo qua email sau khi được duyệt.
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(1)}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: '1px solid #E2E8F0', background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: '#64748B' }}>
                  ← Quay lại
                </button>
                <button type="submit" disabled={loading}
                  style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: 'pointer', fontWeight: 800, fontSize: 14, background: '#D97706', color: '#fff' }}>
                  {loading ? '⏳ Đang gửi...' : '📤 Gửi đăng ký'}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}

export default ShipperRegistration
