import React, { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const BENEFITS = [
  { icon: '🏆', title: 'Huy hiệu Chính Hãng', desc: 'Badge "BuyZo Mall" xanh nổi bật trên mọi sản phẩm và trang shop — tăng độ tin tưởng tức thì từ người mua.' },
  { icon: '🔝', title: 'Ưu tiên hiển thị', desc: 'Sản phẩm của bạn được xếp hạng cao hơn trong kết quả tìm kiếm và danh mục nổi bật trên trang chủ.' },
  { icon: '🎯', title: 'Chiến dịch quảng cáo độc quyền', desc: 'Tham gia Flash Sale, Banner trang chủ và các chiến dịch marketing mùa lễ với chi phí ưu đãi.' },
  { icon: '📦', title: 'Giao hàng ưu tiên', desc: 'Đơn hàng từ shop Mall được xử lý và vận chuyển ưu tiên, cam kết giao trong 2 giờ nội thành.' },
  { icon: '💬', title: 'Hỗ trợ riêng 24/7', desc: 'Đường dây hỗ trợ riêng dành cho BuyZo Mall — giải quyết tranh chấp nhanh hơn, ưu tiên hơn.' },
  { icon: '📊', title: 'Báo cáo nâng cao', desc: 'Truy cập dữ liệu phân tích chuyên sâu: hành vi khách hàng, tỷ lệ chuyển đổi, dự báo doanh thu.' },
]

const REQUIREMENTS = [
  { icon: '⭐', label: 'Đánh giá trung bình ≥ 4.5/5 sao' },
  { icon: '📦', label: 'Tỷ lệ giao hàng thành công ≥ 95%' },
  { icon: '🚀', label: 'Hoạt động trên BuyZo ≥ 3 tháng' },
  { icon: '🏷️', label: 'Có ít nhất 10 sản phẩm đang bán' },
  { icon: '⚠️', label: 'Không có vi phạm chính sách trong 90 ngày' },
  { icon: '📄', label: 'Cung cấp giấy tờ đăng ký kinh doanh hợp lệ' },
]

const STEPS = [
  { num: '01', title: 'Nộp hồ sơ', desc: 'Điền form đăng ký và tải lên giấy tờ kinh doanh. Quá trình chỉ mất 5 phút.' },
  { num: '02', title: 'Thẩm định', desc: 'Đội ngũ BuyZo xét duyệt hồ sơ trong 3–5 ngày làm việc.' },
  { num: '03', title: 'Kích hoạt', desc: 'Nhận thông báo duyệt qua email và bắt đầu hưởng toàn bộ quyền lợi Mall ngay lập tức.' },
]

const BuyZoMallRegisterPage: React.FC = () => {
  const navigate = useNavigate()
  const [requested, setRequested] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')
  const [checks, setChecks] = useState([false, false, false])
  const allChecked = checks.every(Boolean)
  const toggleCheck = (i: number) => setChecks(prev => prev.map((v, idx) => idx === i ? !v : v))

  // Form nộp hồ sơ
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ shopName: '', bizType: '', taxCode: '', address: '' })
  const [files, setFiles] = useState<{ label: string; file: File | null }[]>([
    { label: 'Giấy đăng ký kinh doanh', file: null },
    { label: 'CMND / CCCD chủ sở hữu', file: null },
    { label: 'Logo / Hình ảnh thương hiệu', file: null },
  ])
  const fileRefs = [useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null), useRef<HTMLInputElement>(null)]

  const handleFileChange = (i: number, f: File | null) =>
    setFiles(prev => prev.map((v, idx) => idx === i ? { ...v, file: f } : v))

  const handleFormSubmit = () => {
    setShowForm(false)
    setChecks(prev => prev.map((v, idx) => idx === 0 ? true : v))
  }

  const handleRegister = async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/v1/shop/me/request-mall', {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      })
      const d = await r.json()
      if (r.ok) {
        setRequested(true)
        setMsg('🎉 Hồ sơ đã được gửi! Chúng tôi sẽ liên hệ trong 3–5 ngày làm việc.')
      } else {
        setMsg(d.detail ?? d.message ?? 'Đã gửi yêu cầu')
        setRequested(true)
      }
    } catch {
      setMsg('Lỗi kết nối. Vui lòng thử lại.')
    }
    setLoading(false)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 48 }}>

      {/* Hero */}
      <div style={{
        background: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 50%, #EC4899 100%)',
        borderRadius: 20, padding: '40px 40px', color: 'white', position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />
        <div style={{ position: 'absolute', bottom: -60, right: 60, width: 280, height: 280, borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, marginBottom: 16 }}>
            🏆 CHƯƠNG TRÌNH NHÃN HÀNG CHÍNH HÃNG
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, margin: '0 0 12px', lineHeight: 1.2 }}>
            Nâng cấp lên<br /><span style={{ color: '#FDE68A' }}>BuyZo Mall</span>
          </h1>
          <p style={{ fontSize: 16, opacity: 0.9, maxWidth: 480, lineHeight: 1.6, margin: '0 0 28px' }}>
            Trở thành thương hiệu được chứng nhận trên BuyZo — tăng uy tín, tăng doanh số và tiếp cận hàng triệu khách hàng với đặc quyền độc quyền.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 12, padding: '10px 18px', fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
              👇 Tick xanh 3 bước bên dưới để mở nút đăng ký
            </div>
            <button onClick={() => navigate('/shop')}
              style={{ padding: '10px 20px', background: 'rgba(255,255,255,0.15)', color: 'white', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 12, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
              Quay lại
            </button>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div>
        <h2 style={{ fontSize: 20, fontWeight: 800, color: '#1E3A8A', marginBottom: 16 }}>✨ Quyền lợi khi tham gia BuyZo Mall</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {BENEFITS.map((b, i) => (
            <div key={i} className="card" style={{ padding: '18px 20px', borderTop: '3px solid #7C3AED' }}>
              <div style={{ fontSize: 28, marginBottom: 10 }}>{b.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 14, color: '#1E3A8A', marginBottom: 6 }}>{b.title}</div>
              <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.6 }}>{b.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Requirements + Steps side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '4fr 6fr', gap: 20 }}>

        {/* Requirements */}
        <div className="card" style={{ padding: '22px 24px' }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A8A', marginBottom: 16 }}>📋 Điều kiện tham gia</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {REQUIREMENTS.map((r, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{r.icon}</span>
                <span style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{r.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Steps — checkboxes */}
        <div className="card" style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: '#1E3A8A', marginBottom: 16 }}>🗺️ Quy trình đăng ký</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
            {STEPS.map((s, i) => {
              const isStep0 = i === 0
              return (
                <div key={i}
                  onClick={() => isStep0 ? setShowForm(true) : toggleCheck(i)}
                  className={isStep0 ? 'mall-step-hover' : ''}
                  style={{
                    display: 'flex', gap: 14, alignItems: 'center', cursor: 'pointer',
                    padding: '12px 16px', borderRadius: 12, transition: 'all 0.15s',
                    background: checks[i] ? '#F0FDF4' : '#F8FAFC',
                    border: `2px solid ${checks[i] ? '#16A34A' : '#E2E8F0'}`,
                  }}>
                  {/* Step num badge */}
                  <div style={{
                    width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                    background: checks[i] ? 'linear-gradient(135deg, #16A34A, #15803D)' : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                    color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 12, transition: 'all 0.2s',
                  }}>{s.num}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 14, color: checks[i] ? '#15803D' : '#1E3A8A', marginBottom: 2, fontWeight: 700 }}
                      className={isStep0 ? 'mall-step-title' : ''}
                      onMouseEnter={e => isStep0 && ((e.currentTarget as HTMLElement).style.fontWeight = '800')}
                      onMouseLeave={e => isStep0 && ((e.currentTarget as HTMLElement).style.fontWeight = '700')}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 12, color: '#64748B', lineHeight: 1.4 }}>{s.desc}</div>
                  </div>
                  {/* Checkbox circle — bên phải */}
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: checks[i] ? '#16A34A' : '#FEE2E2',
                    border: `2px solid ${checks[i] ? '#16A34A' : '#FCA5A5'}`,
                    transition: 'all 0.2s',
                  }}>
                    <span style={{ color: checks[i] ? 'white' : '#DC2626', fontSize: 14, fontWeight: 800 }}>{checks[i] ? '✓' : '✕'}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Progress hint */}
          <div style={{ fontSize: 12, color: '#64748B', marginBottom: 16, textAlign: 'center' }}>
            {allChecked
              ? '✅ Đã xác nhận đủ 3 bước — sẵn sàng đăng ký!'
              : `Tick xanh cả 3 bước để mở nút đăng ký (${checks.filter(Boolean).length}/3)`}
          </div>

          {/* Register button — only show when all checked */}
          {requested ? (
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '14px 20px', fontSize: 14, fontWeight: 600, color: '#15803D', textAlign: 'center' }}>
              {msg}
            </div>
          ) : (
            <button onClick={handleRegister} disabled={!allChecked || loading}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                fontWeight: 800, fontSize: 15, cursor: allChecked && !loading ? 'pointer' : 'not-allowed',
                transition: 'all 0.2s',
                background: allChecked ? 'linear-gradient(135deg, #7C3AED, #4F46E5)' : '#E2E8F0',
                color: allChecked ? 'white' : '#94A3B8',
                boxShadow: allChecked ? '0 4px 16px rgba(124,58,237,0.4)' : 'none',
              }}>
              {loading ? '⏳ Đang gửi...' : allChecked ? '🏆 Đăng ký BuyZo Mall' : `🔒 Tick đủ 3 bước để đăng ký`}
            </button>
          )}
        </div>
      </div>

      {/* Modal nộp hồ sơ */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowForm(false)}>
          <div style={{ background: 'white', borderRadius: 18, width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)' }}
            onClick={e => e.stopPropagation()}>

            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'linear-gradient(135deg, #4F46E5, #7C3AED)', borderRadius: '18px 18px 0 0' }}>
              <div>
                <div style={{ fontWeight: 800, fontSize: 17, color: 'white' }}>📋 Nộp hồ sơ BuyZo Mall</div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>Điền đầy đủ thông tin và tải lên giấy tờ</div>
              </div>
              <button onClick={() => setShowForm(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: 'white', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: 16 }}>✕</button>
            </div>

            <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: 18 }}>

              {/* Text fields */}
              {[
                { key: 'shopName', label: 'Tên thương hiệu / Shop', placeholder: 'VD: Hoang An Official Store' },
                { key: 'bizType',  label: 'Loại hình kinh doanh',   placeholder: 'VD: Điện tử, Thời trang, Mỹ phẩm...' },
                { key: 'taxCode',  label: 'Mã số thuế',             placeholder: 'VD: 0123456789' },
                { key: 'address',  label: 'Địa chỉ kinh doanh',     placeholder: 'VD: 123 Nguyễn Huệ, Q.1, TP.HCM' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: '#374151', display: 'block', marginBottom: 6 }}>{f.label}</label>
                  <input
                    className="input"
                    value={(formData as any)[f.key]}
                    onChange={e => setFormData(prev => ({ ...prev, [f.key]: e.target.value }))}
                    placeholder={f.placeholder}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 8, border: '1px solid #D1D5DB', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              {/* File uploads */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#374151', marginBottom: 10 }}>📎 Tải lên giấy tờ</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {files.map((f, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, border: `2px dashed ${f.file ? '#16A34A' : '#D1D5DB'}`, background: f.file ? '#F0FDF4' : '#F9FAFB', cursor: 'pointer' }}
                      onClick={() => fileRefs[i].current?.click()}>
                      <span style={{ fontSize: 20 }}>{f.file ? '✅' : '📄'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: f.file ? '#15803D' : '#374151' }}>{f.label}</div>
                        <div style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{f.file ? f.file.name : 'Click để chọn file (JPG, PNG, PDF)'}</div>
                      </div>
                      {f.file && <button onClick={e => { e.stopPropagation(); handleFileChange(i, null) }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#DC2626', fontSize: 16 }}>✕</button>}
                      <input ref={fileRefs[i]} type="file" accept=".jpg,.jpeg,.png,.pdf" style={{ display: 'none' }}
                        onChange={e => handleFileChange(i, e.target.files?.[0] ?? null)} />
                    </div>
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                <button onClick={() => setShowForm(false)}
                  style={{ flex: 1, padding: '11px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 10, fontWeight: 600, fontSize: 14, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button onClick={handleFormSubmit}
                  style={{ flex: 2, padding: '11px', background: 'linear-gradient(135deg, #7C3AED, #4F46E5)', color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer', boxShadow: '0 4px 14px rgba(124,58,237,0.35)' }}>
                  ✅ Xác nhận nộp hồ sơ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default BuyZoMallRegisterPage
