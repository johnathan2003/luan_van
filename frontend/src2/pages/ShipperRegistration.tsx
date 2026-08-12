import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import { userService } from '../services/userService'
import API from '../services/api'
import { useAuth } from '../hooks/useAuth'

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
  'Đắk Lắk', 'Lâm Đồng', 'Kiên Giang', 'Bình Thuận', 'Quảng Nam',
  'Quảng Ngãi', 'Thừa Thiên Huế', 'Quảng Bình', 'Quảng Trị', 'Hà Tĩnh',
  'Ninh Bình', 'Nam Định', 'Thái Bình', 'Hà Nam', 'Hưng Yên',
  'Hải Dương', 'Bắc Ninh', 'Vĩnh Phúc', 'Phú Thọ', 'Thái Nguyên',
  'Bắc Giang', 'Lạng Sơn', 'Quảng Ninh', 'Hòa Bình', 'Sơn La',
  'Điện Biên', 'Lai Châu', 'Lào Cai', 'Yên Bái', 'Tuyên Quang',
  'Hà Giang', 'Cao Bằng', 'Bắc Kạn', 'Phú Yên', 'Ninh Thuận',
  'Đắk Nông', 'Gia Lai', 'Kon Tum', 'Bình Phước', 'Tây Ninh',
  'Vĩnh Long', 'Bến Tre', 'Trà Vinh', 'Đồng Tháp', 'Hậu Giang',
  'Sóc Trăng', 'Bạc Liêu', 'Cà Mau', 'Mỹ Tho',
]

const C = { orange: '#D97706', orangeLight: '#FEF3C7', gray: '#64748B', border: '#E2E8F0', error: '#DC2626' }

// ── Cascading Address Select ───────────────────────────────────────
const GEO_API = 'https://provinces.open-api.vn/api'

interface GeoItem { code: number; name: string }

interface AddressSelectProps {
  value: { province: string; district: string; ward: string }
  onChange: (v: { province: string; district: string; ward: string }) => void
  hideWard?: boolean
}
const AddressSelect: React.FC<AddressSelectProps> = ({ value, onChange, hideWard = false }) => {
  const [provinces, setProvinces] = useState<GeoItem[]>([])
  const [districts, setDistricts] = useState<GeoItem[]>([])
  const [wards, setWards] = useState<GeoItem[]>([])
  const [provCode, setProvCode] = useState<number | null>(null)
  const [distCode, setDistCode] = useState<number | null>(null)
  const [loadingDist, setLoadingDist] = useState(false)
  const [loadingWard, setLoadingWard] = useState(false)

  // Load tỉnh/thành
  useEffect(() => {
    fetch(`${GEO_API}/?depth=1`)
      .then(r => r.json())
      .then((data: GeoItem[]) => setProvinces(data))
      .catch(() => {})
  }, [])

  // Load quận/huyện khi chọn tỉnh
  useEffect(() => {
    if (!provCode) { setDistricts([]); setWards([]); return }
    setLoadingDist(true)
    fetch(`${GEO_API}/p/${provCode}?depth=2`)
      .then(r => r.json())
      .then((data: any) => setDistricts(data.districts || []))
      .catch(() => setDistricts([]))
      .finally(() => setLoadingDist(false))
  }, [provCode])

  // Load phường/xã khi chọn quận
  useEffect(() => {
    if (!distCode) { setWards([]); return }
    setLoadingWard(true)
    fetch(`${GEO_API}/d/${distCode}?depth=2`)
      .then(r => r.json())
      .then((data: any) => setWards(data.wards || []))
      .catch(() => setWards([]))
      .finally(() => setLoadingWard(false))
  }, [distCode])

  const selStyle: React.CSSProperties = { width: '100%', padding: '10px 12px', borderRadius: 8, border: `1.5px solid ${C.border}`, fontSize: 14, color: '#374151', background: '#fff', outline: 'none', cursor: 'pointer' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Tỉnh/thành */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray, marginBottom: 5 }}>Địa chỉ / Chỗ ở hiện tại *</label>
        <select style={selStyle} value={value.province} required
          onChange={e => {
            const opt = e.target.options[e.target.selectedIndex]
            const code = Number(opt.dataset.code)
            setProvCode(code || null); setDistCode(null)
            setDistricts([]); setWards([])
            onChange({ province: e.target.value, district: '', ward: '' })
          }}>
          <option value="">-- Chọn tỉnh/thành --</option>
          {provinces.map(p => <option key={p.code} value={p.name} data-code={p.code}>{p.name}</option>)}
        </select>
      </div>

      {/* Quận/huyện */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: !value.province ? '#CBD5E1' : C.gray, marginBottom: 5 }}>Quận/huyện *</label>
        <select style={{ ...selStyle, background: !value.province ? '#F8FAFC' : '#fff', color: !value.province ? '#CBD5E1' : '#374151' }}
          value={value.district} disabled={!value.province} required
          onChange={e => {
            const opt = e.target.options[e.target.selectedIndex]
            const code = Number(opt.dataset.code)
            setDistCode(code || null); setWards([])
            onChange({ ...value, district: e.target.value, ward: '' })
          }}>
          <option value="">{loadingDist ? '⏳ Đang tải...' : !value.province ? '-- Chọn tỉnh/thành trước --' : '-- Chọn quận/huyện --'}</option>
          {districts.map(d => <option key={d.code} value={d.name} data-code={d.code}>{d.name}</option>)}
        </select>
      </div>

      {/* Phường/xã — ẩn với inter_province */}
      {!hideWard && (
        <div>
          <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: !value.district ? '#CBD5E1' : C.gray, marginBottom: 5 }}>Phường/xã *</label>
          <select style={{ ...selStyle, background: !value.district ? '#F8FAFC' : '#fff', color: !value.district ? '#CBD5E1' : '#374151' }}
            value={value.ward} disabled={!value.district} required
            onChange={e => onChange({ ...value, ward: e.target.value })}>
            <option value="">{loadingWard ? '⏳ Đang tải...' : !value.district ? '-- Chọn quận/huyện trước --' : '-- Chọn phường/xã --'}</option>
            {wards.map(w => <option key={w.code} value={w.name}>{w.name}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Upload ảnh 1 file ──────────────────────────────────────────────
async function uploadFile(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  const res = await API.post('/api/v1/products/upload-image', fd, {
    transformRequest: (data, headers) => { if (headers) delete (headers as any)['Content-Type']; return data },
  })
  return res.data?.url || res.data
}

// ── ImageUploadBox ────────────────────────────────────────────────
interface UploadBoxProps {
  label: string
  hint: string
  icon: string
  value: string
  onChange: (url: string) => void
}
const ImageUploadBox: React.FC<UploadBoxProps> = ({ label, hint, icon, value, onChange }) => {
  const [uploading, setUploading] = useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return
    setUploading(true)
    try {
      const url = await uploadFile(file)
      onChange(url)
      toast.success(`Đã tải ${label}`)
    } catch { toast.error('Upload thất bại') }
    finally { setUploading(false); e.target.value = '' }
  }

  return (
    <div>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: C.gray, marginBottom: 6 }}>
        {label} <span style={{ color: C.error }}>*</span>
        <span style={{ fontSize: 11, fontWeight: 400, color: '#94A3B8', marginLeft: 6 }}>{hint}</span>
      </label>
      <input ref={inputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFile} />
      {value ? (
        <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', border: `2px solid ${C.orange}`, background: '#fff' }}>
          <img src={value} alt={label} style={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }} />
          <button type="button" onClick={() => { onChange(''); if (inputRef.current) inputRef.current.value = '' }}
            style={{ position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: '50%', background: 'rgba(0,0,0,0.55)', border: 'none', cursor: 'pointer', color: '#fff', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            ✕
          </button>
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(13,148,136,0.85)', padding: '5px 10px', fontSize: 12, color: '#fff', fontWeight: 600 }}>
            ✓ Đã tải lên
          </div>
        </div>
      ) : (
        <div onClick={() => !uploading && inputRef.current?.click()}
          style={{ borderRadius: 12, border: `2px dashed ${C.border}`, background: '#FAFAFA', height: 140, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: uploading ? 'wait' : 'pointer', transition: 'all 0.15s' }}
          onMouseEnter={e => { if (!uploading) (e.currentTarget as HTMLDivElement).style.borderColor = C.orange }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = C.border }}>
          <span style={{ fontSize: 32 }}>{uploading ? '⏳' : icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: uploading ? C.gray : C.orange }}>{uploading ? 'Đang tải...' : 'Nhấn để chọn ảnh'}</span>
          <span style={{ fontSize: 11, color: '#94A3B8' }}>JPG, PNG — tối đa 5MB</span>
        </div>
      )}
    </div>
  )
}

// ════════ MAIN ════════
const ShipperRegistration: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<1|2|3|4>(1)
  const [shipperType, setShipperType] = useState<string>('')
  const [form, setForm] = useState({
    vehicle_type: 'motorcycle',
    license_plate: '',
    zone_province: '',
    zone_district: '',
    zone_ward: '',
  })
  const [docs, setDocs] = useState({
    registration_url: '',   // Cà vẹt xe
    vehicle_photo_url: '',  // Hình xe
    license_url: '',        // Bằng lái xe
  })
  const [loading, setLoading] = useState(false)
  const { user } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!docs.registration_url) { toast.error('Vui lòng tải ảnh cà vẹt xe'); return }
    if (!docs.vehicle_photo_url) { toast.error('Vui lòng tải ảnh xe'); return }
    if (!docs.license_url) { toast.error('Vui lòng tải ảnh bằng lái xe'); return }
    setLoading(true)
    try {
      await userService.registerShipper({ ...form, shipper_type: shipperType, ...docs })
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
      <div className="container" style={{ paddingTop: 8, paddingBottom: 48, maxWidth: 600 }}>

        {/* Step indicator */}
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          {/* Step indicator */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 20 }}>
            {[1, 2, 3, 4].map(s => (
              <React.Fragment key={s}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 800, fontSize: 13,
                  background: step >= s ? C.orange : '#E2E8F0',
                  color: step >= s ? '#fff' : '#94A3B8',
                }}>{s}</div>
                {s < 4 && <div style={{ width: 36, height: 2, background: step > s ? C.orange : '#E2E8F0', borderRadius: 2 }} />}
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 6 }}>
            {['Loại shipper', 'Thông tin xe', 'Hồ sơ ảnh', 'Xác nhận'].map((l, i) => (
              <span key={l} style={{ fontSize: 10, color: step >= i + 1 ? C.orange : '#94A3B8', fontWeight: step === i + 1 ? 700 : 400 }}>{l}</span>
            ))}
          </div>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {SHIPPER_TYPES.map(t => (
              <div key={t.value} onClick={() => setShipperType(t.value)}
                style={{
                  borderRadius: 16, padding: '20px 22px', cursor: 'pointer', transition: 'all 0.15s',
                  border: '2px solid ' + (shipperType === t.value ? t.color : C.border),
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
                      <span style={{ fontSize: 12, background: t.bg, color: t.color, borderRadius: 6, padding: '2px 8px', fontWeight: 600 }}>🚗 {t.vehicle}</span>
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
                background: shipperType ? C.orange : '#E2E8F0', color: shipperType ? '#fff' : '#94A3B8',
                fontWeight: 800, fontSize: 15, marginTop: 8, transition: 'all 0.15s',
              }}>
              Tiếp theo → Nhập thông tin xe & hồ sơ
            </button>
          </div>
        )}

        {/* Step 2 — Thông tin xe */}
        {step === 2 && selectedType && (
          <div className="card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '14px 18px', background: selectedType.bg, borderRadius: 12 }}>
              <span style={{ fontSize: 28 }}>{selectedType.icon}</span>
              <div>
                <p style={{ fontWeight: 800, color: selectedType.color, margin: 0 }}>{selectedType.label}</p>
                <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{selectedType.vehicle}</p>
              </div>
              <button type="button" onClick={() => setStep(1)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', cursor: 'pointer', color: C.gray, fontSize: 13, fontWeight: 600 }}>✏️ Đổi loại</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              <div>
                <label className="input-label">Loại phương tiện *</label>
                <select className="input" value={form.vehicle_type} onChange={e => setForm(f => ({ ...f, vehicle_type: e.target.value }))}>
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

              <div>
                <label className="input-label">Biển số xe *</label>
                <input className="input" placeholder="VD: 51A-12345" required value={form.license_plate}
                  onChange={e => setForm(f => ({ ...f, license_plate: e.target.value }))} />
              </div>

              <AddressSelect
                value={{ province: form.zone_province, district: form.zone_district, ward: form.zone_ward }}
                onChange={v => setForm(f => ({ ...f, zone_province: v.province, zone_district: v.district, zone_ward: v.ward }))}
                hideWard={shipperType === 'inter_province'}
              />

              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setStep(1)}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: C.gray }}>
                  ← Quay lại
                </button>
                <button type="button"
                  disabled={!form.license_plate.trim() || !form.zone_province || !form.zone_district || (shipperType !== 'inter_province' && !form.zone_ward)}
                  onClick={() => setStep(3)}
                  style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 14, color: '#fff', transition: 'all 0.15s',
                    background: form.license_plate.trim() && form.zone_province && form.zone_district && (shipperType === 'inter_province' || form.zone_ward) ? C.orange : '#E2E8F0',
                    cursor: form.license_plate.trim() && form.zone_province && form.zone_district && (shipperType === 'inter_province' || form.zone_ward) ? 'pointer' : 'default' }}>
                  Tiếp theo → Tải hồ sơ ảnh
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 — Hồ sơ ảnh */}
        {step === 3 && selectedType && (
          <div className="card" style={{ padding: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '14px 18px', background: selectedType.bg, borderRadius: 12 }}>
              <span style={{ fontSize: 28 }}>{selectedType.icon}</span>
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 800, color: selectedType.color, margin: 0 }}>{selectedType.label}</p>
                <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{form.license_plate} · {[form.zone_ward, form.zone_district, form.zone_province].filter(Boolean).join(', ')}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <ImageUploadBox
                label="Cà vẹt xe (Đăng ký xe)"
                hint="Mặt trước giấy đăng ký"
                icon="📋"
                value={docs.registration_url}
                onChange={url => setDocs(d => ({ ...d, registration_url: url }))}
              />
              <ImageUploadBox
                label="Hình chụp xe"
                hint="Ảnh xe rõ biển số"
                icon="🚗"
                value={docs.vehicle_photo_url}
                onChange={url => setDocs(d => ({ ...d, vehicle_photo_url: url }))}
              />
              <ImageUploadBox
                label="Bằng lái xe"
                hint="Mặt trước bằng lái còn hiệu lực"
                icon="🪪"
                value={docs.license_url}
                onChange={url => setDocs(d => ({ ...d, license_url: url }))}
              />

              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setStep(2)}
                  style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: C.gray }}>
                  ← Quay lại
                </button>
                <button type="button"
                  disabled={!docs.registration_url || !docs.vehicle_photo_url || !docs.license_url}
                  onClick={() => setStep(4)}
                  style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 14, color: '#fff', transition: 'all 0.15s',
                    background: docs.registration_url && docs.vehicle_photo_url && docs.license_url ? C.orange : '#E2E8F0',
                    cursor: docs.registration_url && docs.vehicle_photo_url && docs.license_url ? 'pointer' : 'default' }}>
                  Tiếp theo → Xác nhận
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Step 4 — Xác nhận thông tin */}
        {step === 4 && selectedType && (
          <div className="card" style={{ padding: 28 }}>
            <p style={{ fontWeight: 800, fontSize: 15, color: '#1E3A8A', marginBottom: 16 }}>📋 Xác nhận thông tin đăng ký</p>

            {/* Thông tin cá nhân */}
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>👤 Thông tin cá nhân</p>
                <button type="button" onClick={() => navigate('/profile')}
                  style={{ fontSize: 12, fontWeight: 600, color: C.orange, background: 'transparent', border: `1px solid ${C.orange}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                  ✏️ Chỉnh sửa
                </button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Row label="Họ tên" value={user?.full_name || user?.username || '—'} />
                <Row label="Email" value={user?.email || '—'} />
                <Row label="Số điện thoại" value={(user as any)?.phone || '—'} />
              </div>
            </div>

            {/* Thông tin xe */}
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', marginBottom: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>🚗 Thông tin xe</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Row label="Loại shipper" value={selectedType.label} />
                <Row label="Phương tiện" value={VEHICLE_LABELS[form.vehicle_type] || form.vehicle_type} />
                <Row label="Biển số" value={form.license_plate} />
                <Row label="Địa chỉ" value={[form.zone_ward, form.zone_district, form.zone_province].filter(Boolean).join(', ')} />
              </div>
            </div>

            {/* Hồ sơ ảnh */}
            <div style={{ background: '#F8FAFC', borderRadius: 12, padding: '14px 16px', marginBottom: 16 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>📄 Hồ sơ ảnh</p>
              <div style={{ display: 'flex', gap: 10 }}>
                {[
                  { label: 'Cà vẹt xe', url: docs.registration_url },
                  { label: 'Hình xe', url: docs.vehicle_photo_url },
                  { label: 'Bằng lái', url: docs.license_url },
                ].map(d => (
                  <div key={d.label} style={{ flex: 1, textAlign: 'center' }}>
                    <img src={d.url} alt={d.label} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, border: `1.5px solid ${C.border}`, marginBottom: 4 }} />
                    <span style={{ fontSize: 11, color: C.gray }}>{d.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ background: '#F0F9FF', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#0369A1', marginBottom: 16 }}>
              ℹ️ Admin sẽ xem xét và phê duyệt trong 1-2 ngày làm việc. Bạn sẽ nhận thông báo qua email.
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep(3)}
                style={{ flex: 1, padding: '11px', borderRadius: 10, border: `1px solid ${C.border}`, background: '#fff', cursor: 'pointer', fontWeight: 600, fontSize: 14, color: C.gray }}>
                ← Quay lại
              </button>
              <button disabled={loading} onClick={async () => {
                setLoading(true)
                try {
                  await userService.registerShipper({ ...form, shipper_type: shipperType, ...docs })
                  toast.success('Đã gửi đăng ký shipper! Chờ admin phê duyệt.')
                  navigate('/')
                } catch (err: any) {
                  toast.error(err.response?.data?.detail || 'Lỗi khi gửi đăng ký')
                } finally { setLoading(false) }
              }}
                style={{ flex: 2, padding: '11px', borderRadius: 10, border: 'none', cursor: loading ? 'wait' : 'pointer', fontWeight: 800, fontSize: 14, background: C.orange, color: '#fff' }}>
                {loading ? '⏳ Đang gửi...' : '📤 Xác nhận & Gửi đăng ký'}
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}

// ── Helper components ─────────────────────────────────────────────
const Row = ({ label, value }: { label: string; value: string }) => (
  <div style={{ display: 'flex', gap: 8, alignItems: 'baseline' }}>
    <span style={{ fontSize: 12, color: '#94A3B8', minWidth: 100, flexShrink: 0 }}>{label}:</span>
    <span style={{ fontSize: 13, fontWeight: 600, color: '#1E293B' }}>{value}</span>
  </div>
)

const VEHICLE_LABELS: Record<string, string> = {
  motorcycle: '🏍️ Xe máy', electric_bike: '🛵 Xe máy điện', car: '🚗 Xe ô tô',
  truck_small: '🚛 Xe tải nhỏ', truck_medium: '🚚 Xe tải trung', truck_large: '🏗️ Xe tải lớn',
}

export default ShipperRegistration
