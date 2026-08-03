import React, { useState, useRef, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { userService } from '../services/userService'

interface ProvinceItem { code: number; name: string }
interface DistrictItem { code: number; name: string }
interface WardItem    { code: number; name: string }

const GEO_API = 'https://provinces.open-api.vn/api'

// ── File type icon helper ───────────────────────────────────────────────────
const fileIcon = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'pdf') return '📄'
  if (ext === 'docx' || ext === 'doc') return '📝'
  if (['jpg','jpeg','png','webp','gif'].includes(ext || '')) return '🖼️'
  return '📎'
}

const fmtSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}


const ShopRegistration: React.FC = () => {
  const navigate = useNavigate()
  const [step, setStep] = useState<1 | 2>(1)

  // ── Step 1 state ──────────────────────────────────────────────────────────
  const [form, setForm] = useState({
    shop_name: '', description: '', phone: '', price_min: '', price_max: '',
    street: '', province: '', district: '', ward: '',
  })
  const [previewImgs, setPreviewImgs] = useState<string[]>([])
  const [imgFiles,    setImgFiles]    = useState<File[]>([])
  const imgRef = useRef<HTMLInputElement>(null)

  // ── Geo dropdowns ──────────────────────────────────────────────────────────
  const [provinces,    setProvinces]    = useState<ProvinceItem[]>([])
  const [districts,    setDistricts]    = useState<DistrictItem[]>([])
  const [wards,        setWards]        = useState<WardItem[]>([])
  const [provinceCode, setProvinceCode] = useState<number | null>(null)
  const [districtCode, setDistrictCode] = useState<number | null>(null)
  const [geoLoading,   setGeoLoading]   = useState(false)

  useEffect(() => {
    fetch(`${GEO_API}/p/`).then(r => r.json()).then((d: ProvinceItem[]) => setProvinces(d)).catch(() => {})
  }, [])

  useEffect(() => {
    if (provinceCode == null) { setDistricts([]); setWards([]); return }
    setGeoLoading(true)
    fetch(`${GEO_API}/p/${provinceCode}?depth=2`)
      .then(r => r.json()).then((d: { districts: DistrictItem[] }) => setDistricts(d.districts || []))
      .catch(() => setDistricts([])).finally(() => setGeoLoading(false))
  }, [provinceCode])

  useEffect(() => {
    if (districtCode == null) { setWards([]); return }
    setGeoLoading(true)
    fetch(`${GEO_API}/d/${districtCode}?depth=2`)
      .then(r => r.json()).then((d: { wards: WardItem[] }) => setWards(d.wards || []))
      .catch(() => setWards([])).finally(() => setGeoLoading(false))
  }, [districtCode])

  const handleProvinceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.selectedOptions[0] ? Number(e.target.selectedOptions[0].dataset.code) : null
    setForm(f => ({ ...f, province: e.target.value, district: '', ward: '' }))
    setProvinceCode(code); setDistrictCode(null); setDistricts([]); setWards([])
  }
  const handleDistrictChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const code = e.target.selectedOptions[0] ? Number(e.target.selectedOptions[0].dataset.code) : null
    setForm(f => ({ ...f, district: e.target.value, ward: '' }))
    setDistrictCode(code); setWards([])
  }

  const handleImgChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    setPreviewImgs(prev => [...prev, ...files.map(f => URL.createObjectURL(f))].slice(0, 5))
    setImgFiles(prev => [...prev, ...files].slice(0, 5))
  }
  const removeImg = (i: number) => {
    setPreviewImgs(p => p.filter((_, idx) => idx !== i))
    setImgFiles(p => p.filter((_, idx) => idx !== i))
  }

  // ── Step 2 state ──────────────────────────────────────────────────────────
  const [licenseFiles, setLicenseFiles] = useState<File[]>([])
  const [loading,      setLoading]      = useState(false)
  const [success,      setSuccess]      = useState(false)
  const [profileErr,   setProfileErr]   = useState<string | null>(null)
  const [dragOver,     setDragOver]     = useState(false)
  const licenseRef = useRef<HTMLInputElement>(null)

  const addLicenseFiles = (files: File[]) => {
    setLicenseFiles(prev => {
      const combined = [...prev, ...files]
      // dedupe by name
      const seen = new Set<string>()
      return combined.filter(f => { if (seen.has(f.name)) return false; seen.add(f.name); return true }).slice(0, 10)
    })
  }
  const removeLicense = (i: number) => setLicenseFiles(p => p.filter((_, idx) => idx !== i))

  // ── Step 1 → Step 2 ───────────────────────────────────────────────────────
  const handleNext = (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.shop_name.trim()) { toast.warning('Vui lòng nhập tên shop'); return }
    if (!form.province || !form.district || !form.ward || !form.street.trim()) {
      toast.warning('Vui lòng điền đầy đủ địa chỉ kho hàng'); return
    }
    setStep(2)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // ── Final submit ──────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    setLoading(true)
    try {
      const address = `${form.street}, ${form.ward}, ${form.district}, ${form.province}`

      // Upload product images
      let product_images: string | undefined
      if (imgFiles.length > 0) {
        const urls = await Promise.all(imgFiles.map(f => userService.uploadImage(f).then(r => r.data.url)))
        product_images = JSON.stringify(urls)
      }

      // Upload license documents
      let business_reg_url: string | undefined
      if (licenseFiles.length > 0) {
        const urls = await Promise.all(licenseFiles.map(f => userService.uploadImage(f).then(r => r.data.url)))
        business_reg_url = JSON.stringify(urls)
      }

      await userService.registerShop({ ...form, address, product_images, business_reg_url })
      setSuccess(true)
    } catch (err: any) {
      const detail: string = err.response?.data?.detail || 'Lỗi đăng ký'
      if (detail.includes('thông tin cá nhân')) {
        setProfileErr(detail)
        setStep(1)
      } else {
        toast.error(detail)
      }
    } finally {
      setLoading(false)
    }
  }

  // ── SELECT STYLE ──────────────────────────────────────────────────────────
  const selStyle: React.CSSProperties = {
    width: '100%', padding: '9px 12px', borderRadius: 8, fontSize: 13,
    border: '1.5px solid var(--border-subtle)',
    background: 'var(--bg-surface, rgba(255,255,255,0.6))',
    color: 'var(--text-primary)', cursor: 'pointer', outline: 'none',
  }

  // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
  if (success) return (
    <>
      <style>{`
        @keyframes checkPop { 0%{transform:scale(0.3);opacity:0}70%{transform:scale(1.15);opacity:1}100%{transform:scale(1)} }
        @keyframes successFadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .success-icon { animation: checkPop 0.5s cubic-bezier(0.22,1,0.36,1) both; }
        .success-text { animation: successFadeUp 0.5s 0.20s cubic-bezier(0.22,1,0.36,1) both; opacity:0; }
        .success-sub  { animation: successFadeUp 0.5s 0.35s cubic-bezier(0.22,1,0.36,1) both; opacity:0; }
        .success-note { animation: successFadeUp 0.5s 0.50s cubic-bezier(0.22,1,0.36,1) both; opacity:0; }
        .success-btn  { animation: successFadeUp 0.5s 0.65s cubic-bezier(0.22,1,0.36,1) both; opacity:0; }
      `}</style>
      <div style={{ textAlign: 'center', padding: '12px 0 4px' }}>
        <div className="success-icon" style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'linear-gradient(135deg, #16A34A, #22C55E)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 20px', boxShadow: '0 8px 24px rgba(22,163,74,0.35)',
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h3 className="success-text" style={{ fontWeight: 700, fontSize: 20, color: 'var(--gray-900)', marginBottom: 8 }}>
          Gửi đăng ký thành công!
        </h3>
        <p className="success-sub" style={{ fontSize: 14, color: 'var(--gray-600)', marginBottom: 20 }}>
          Đơn đăng ký mở shop của bạn đã được gửi đến hệ thống.
        </p>
        <div className="success-note" style={{
          background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(22,163,74,0.25)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 24, textAlign: 'left',
        }}>
          <p style={{ fontSize: 13, color: 'var(--gray-700)', margin: 0, lineHeight: 1.6 }}>
            🕐 Admin sẽ xem xét và phê duyệt trong vòng <strong>1–3 ngày làm việc</strong>.<br />
            📧 Kết quả sẽ được thông báo qua hệ thống khi có cập nhật.
          </p>
        </div>
        <button className="success-btn btn btn-primary btn-lg w-full" onClick={() => navigate('/')}
          style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)', border: 'none' }}>
          Về trang chủ
        </button>
      </div>
    </>
  )

  // ── STEP 2: Giấy phép kinh doanh ─────────────────────────────────────────
  if (step === 2) return (
    <>
      <style>{`
        @keyframes slideIn { from{opacity:0;transform:translateX(32px)} to{opacity:1;transform:translateX(0)} }
        .step2-wrap { animation: slideIn 0.35s cubic-bezier(0.22,1,0.36,1) both; }
        .license-drop { transition: border-color 0.2s, background 0.2s; }
        .license-file-row:hover { background: rgba(22,163,74,0.06) !important; }
        .shop-reg-submit { transition: transform 0.15s, box-shadow 0.15s !important; }
        .shop-reg-submit:hover:not(:disabled) { transform: translateY(-2px) !important; box-shadow: 0 6px 20px rgba(22,163,74,0.35) !important; }
      `}</style>

      <div className="step2-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 4 }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🏛️</div>
          <h3 style={{ fontWeight: 700, fontSize: 16, color: 'var(--gray-900)', margin: '0 0 6px' }}>
            Yêu cầu giấy phép kinh doanh
          </h3>
          <p style={{ fontSize: 12.5, color: 'var(--gray-500)', margin: 0, lineHeight: 1.5 }}>
            Vui lòng tải lên giấy phép đăng ký kinh doanh hoặc các tài liệu liên quan.<br />
            Chấp nhận: <strong>Ảnh, PDF, DOCX</strong> — tối đa 10 tệp
          </p>
        </div>

        {/* Drop zone */}
        <div
          className="license-drop"
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => {
            e.preventDefault(); setDragOver(false)
            addLicenseFiles(Array.from(e.dataTransfer.files))
          }}
          onClick={() => licenseRef.current?.click()}
          style={{
            border: `2px dashed ${dragOver ? '#16A34A' : 'rgba(22,163,74,0.4)'}`,
            borderRadius: 12,
            background: dragOver ? 'rgba(22,163,74,0.08)' : 'rgba(255,255,255,0.35)',
            padding: '28px 16px',
            textAlign: 'center',
            cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <div style={{ fontSize: 32, marginBottom: 8 }}>{dragOver ? '📂' : '📁'}</div>
          <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)', margin: '0 0 4px' }}>
            Kéo thả tệp vào đây hoặc nhấn để chọn
          </p>
          <p style={{ fontSize: 11.5, color: 'var(--gray-400)', margin: 0 }}>
            Ảnh (JPG, PNG), PDF, DOCX — mỗi tệp tối đa 20MB
          </p>
          <input
            ref={licenseRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            style={{ display: 'none' }}
            onChange={e => { addLicenseFiles(Array.from(e.target.files || [])); e.target.value = '' }}
          />
        </div>

        {/* File list */}
        {licenseFiles.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-500)', margin: 0 }}>
              Tệp đã chọn ({licenseFiles.length})
            </p>
            {licenseFiles.map((f, i) => (
              <div key={i} className="license-file-row" style={{
                display: 'flex', alignItems: 'center', gap: 10,
                background: 'rgba(255,255,255,0.5)', borderRadius: 8,
                border: '1px solid var(--border-subtle)', padding: '8px 12px',
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>{fileIcon(f.name)}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-800)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: 0 }}>{fmtSize(f.size)}</p>
                </div>
                <button type="button" onClick={() => removeLicense(i)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444', fontSize: 16, lineHeight: 1, padding: '2px 4px', flexShrink: 0 }}>✕</button>
              </div>
            ))}
          </div>
        )}

        {/* Note */}
        <div style={{ background: 'rgba(255,255,255,0.4)', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.6 }}>
          💡 Giấy tờ giúp xác minh tính hợp pháp của shop. Nếu chưa có giấy phép, bạn vẫn có thể gửi đơn — admin sẽ xem xét.
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button
            type="button"
            onClick={() => setStep(1)}
            disabled={loading}
            style={{
              flex: '0 0 auto', padding: '10px 20px', borderRadius: 10,
              border: '1.5px solid rgba(255,255,255,0.5)',
              background: 'rgba(255,255,255,0.3)', color: 'var(--gray-700)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}
          >
            ← Quay lại
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="btn btn-primary shop-reg-submit"
            style={{ flex: 1, background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)', border: 'none', fontSize: 14, fontWeight: 700 }}
          >
            {loading ? 'Đang gửi...' : '📤 Gửi đăng ký'}
          </button>
        </div>
      </div>
    </>
  )

  // ── STEP 1: Form thông tin shop ───────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes fieldIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .shop-reg-field { animation: fieldIn 0.4s cubic-bezier(0.22,1,0.36,1) both; }
        .shop-reg-submit { transition: transform 0.15s, box-shadow 0.15s !important; }
        .shop-reg-submit:hover:not(:disabled) { transform: translateY(-2px) !important; box-shadow: 0 6px 20px rgba(22,163,74,0.35) !important; }
        .shop-reg-submit:active:not(:disabled) { transform: scale(0.98) !important; }
      `}</style>

      {profileErr && (
        <div style={{
          background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.35)',
          borderRadius: 12, padding: '14px 18px', marginBottom: 4,
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <p style={{ fontWeight: 700, fontSize: 13, color: '#DC2626', margin: '0 0 6px' }}>Thông tin cá nhân chưa đầy đủ</p>
            <p style={{ fontSize: 12, color: '#7F1D1D', margin: '0 0 10px', lineHeight: 1.5 }}>
              {profileErr.replace('Vui lòng cập nhật thông tin cá nhân trước khi đăng ký shop: ', '')}
            </p>
            <Link to="/profile" style={{ display: 'inline-block', padding: '6px 14px', borderRadius: 7, background: '#DC2626', color: '#fff', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
              Cập nhật hồ sơ →
            </Link>
          </div>
        </div>
      )}

      <form onSubmit={handleNext} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Tên shop + SĐT */}
        <div className="shop-reg-field" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, animationDelay: '0.05s' }}>
          <div>
            <label className="input-label">Tên shop *</label>
            <input className="input" placeholder="Tên cửa hàng của bạn" value={form.shop_name}
              onChange={e => setForm(f => ({ ...f, shop_name: e.target.value }))} />
          </div>
          <div>
            <label className="input-label">Số điện thoại</label>
            <input className="input" placeholder="0909..." value={form.phone}
              onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
          </div>
        </div>

        {/* Mô tả */}
        <div className="shop-reg-field" style={{ animationDelay: '0.10s' }}>
          <label className="input-label">Mô tả sản phẩm kinh doanh</label>
          <textarea className="input" rows={2} placeholder="Giới thiệu shop, ngành hàng kinh doanh..."
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            style={{ resize: 'vertical' }} />
        </div>

        {/* Địa chỉ kho */}
        <div className="shop-reg-field" style={{ animationDelay: '0.15s' }}>
          <label className="input-label">Địa chỉ kho hàng *</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 6 }}>
            <div>
              <label className="input-label" style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 3 }}>Tỉnh / Thành phố</label>
              <select value={form.province} onChange={handleProvinceChange} style={selStyle}>
                <option value="">-- Chọn tỉnh/thành --</option>
                {provinces.map(p => <option key={p.code} value={p.name} data-code={p.code}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label" style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 3 }}>Quận / Huyện</label>
              <select value={form.district} onChange={handleDistrictChange}
                disabled={!form.province || geoLoading}
                style={{ ...selStyle, opacity: form.province ? 1 : 0.5, cursor: form.province ? 'pointer' : 'not-allowed' }}>
                <option value="">{geoLoading ? 'Đang tải...' : '-- Chọn quận/huyện --'}</option>
                {districts.map(d => <option key={d.code} value={d.name} data-code={d.code}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label" style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 3 }}>Phường / Xã</label>
              <select value={form.ward} onChange={e => setForm(f => ({ ...f, ward: e.target.value }))}
                disabled={!form.district || geoLoading}
                style={{ ...selStyle, opacity: form.district ? 1 : 0.5, cursor: form.district ? 'pointer' : 'not-allowed' }}>
                <option value="">{geoLoading ? 'Đang tải...' : '-- Chọn phường/xã --'}</option>
                {wards.map(w => <option key={w.code} value={w.name}>{w.name}</option>)}
              </select>
            </div>
            <div>
              <label className="input-label" style={{ fontSize: 11, color: 'var(--gray-500)', marginBottom: 3 }}>Số nhà, tên đường</label>
              <input className="input" placeholder="VD: 123 Nguyễn Trãi" value={form.street}
                onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
                style={{ fontSize: 13, padding: '9px 12px' }} />
            </div>
          </div>
        </div>

        {/* Hình ảnh sản phẩm */}
        <div className="shop-reg-field" style={{ animationDelay: '0.22s' }}>
          <label className="input-label">Hình ảnh sản phẩm <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(tối đa 5)</span></label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 6 }}>
            {previewImgs.map((src, i) => (
              <div key={i} style={{ position: 'relative', width: 68, height: 68 }}>
                <img src={src} alt="" style={{ width: 68, height: 68, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border-subtle)' }} />
                <button type="button" onClick={() => removeImg(i)}
                  style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', background: '#EF4444', color: '#fff', border: 'none', cursor: 'pointer', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              </div>
            ))}
            {previewImgs.length < 5 && (
              <button type="button" onClick={() => imgRef.current?.click()}
                style={{ width: 68, height: 68, borderRadius: 8, border: '2px dashed var(--border-subtle)', background: 'rgba(255,255,255,0.4)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, color: 'var(--gray-500)', fontSize: 11 }}>
                <span style={{ fontSize: 20 }}>📷</span>Thêm
              </button>
            )}
            <input ref={imgRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleImgChange} />
          </div>
        </div>

        {/* Khoảng giá */}
        <div className="shop-reg-field" style={{ animationDelay: '0.28s' }}>
          <label className="input-label">Khoảng giá sản phẩm (₫)</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 8, alignItems: 'center', marginTop: 4 }}>
            <input className="input" type="text" inputMode="numeric" placeholder="100.000" value={form.price_min}
              onChange={e => {
                const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                setForm(f => ({ ...f, price_min: raw ? Number(raw).toLocaleString('de-DE') : '' }))
              }} />
            <span style={{ textAlign: 'center', color: 'var(--gray-500)', fontWeight: 600 }}>—</span>
            <input className="input" type="text" inputMode="numeric" placeholder="10.000.000" value={form.price_max}
              onChange={e => {
                const raw = e.target.value.replace(/\./g, '').replace(/\D/g, '')
                setForm(f => ({ ...f, price_max: raw ? Number(raw).toLocaleString('de-DE') : '' }))
              }} />
          </div>
        </div>

        {/* Submit step 1 */}
        <div className="shop-reg-field" style={{ animationDelay: '0.33s' }}>
          <button type="submit" className="btn btn-primary btn-lg w-full shop-reg-submit"
            style={{ background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)', border: 'none' }}>
            Tiếp theo →
          </button>
        </div>
      </form>
    </>
  )
}

export default ShopRegistration
