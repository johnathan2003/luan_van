import React, { useEffect, useState } from 'react'
import { shopService } from '../../services/shopService'

const C = {
  navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6',
  light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B',
  success: '#16A34A', warning: '#D97706', error: '#DC2626',
}

// Danh sách quyền dựa trên constants.ts + thêm mô tả
const ALL_PERMISSIONS = [
  { code: 'order:read',    label: 'Xem đơn hàng',      icon: '📋', group: 'Đơn hàng' },
  { code: 'order:confirm', label: 'Xác nhận đơn',       icon: '✅', group: 'Đơn hàng' },
  { code: 'order:cancel',  label: 'Hủy đơn hàng',      icon: '❌', group: 'Đơn hàng' },
  { code: 'message:read',  label: 'Đọc tin nhắn',       icon: '💬', group: 'Hỗ trợ KH' },
  { code: 'message:send',  label: 'Gửi tin nhắn',       icon: '📤', group: 'Hỗ trợ KH' },
  { code: 'product:create',label: 'Tạo sản phẩm',       icon: '➕', group: 'Sản phẩm' },
  { code: 'product:update',label: 'Sửa sản phẩm',       icon: '✏️', group: 'Sản phẩm' },
  { code: 'product:delete',label: 'Xóa sản phẩm',       icon: '🗑️', group: 'Sản phẩm' },
  { code: 'shop:analytics',label: 'Xem thống kê',        icon: '📊', group: 'Khác' },
]

const PERM_GROUPS = ['Đơn hàng', 'Hỗ trợ KH', 'Sản phẩm', 'Khác']

const EMPTY_FORM = { employee_email: '', employee_name: '', position: '', password: '' }

const PermBadge: React.FC<{ code: string }> = ({ code }) => {
  const p = ALL_PERMISSIONS.find(x => x.code === code)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3,
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: C.light, color: C.blue,
    }}>
      {p?.icon} {p?.label ?? code}
    </span>
  )
}

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading]     = useState(false)
  const [showAdd, setShowAdd]     = useState(false)
  const [permTarget, setPermTarget] = useState<any | null>(null)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [perms, setPerms]         = useState<string[]>([])
  const [search, setSearch]       = useState('')
  const [credential, setCredential] = useState<{ email: string; password: string } | null>(null)

  useEffect(() => {
    setLoading(true)
    shopService.getEmployees()
      .then((res: any) => {
        const data = res.data?.employees ?? res.data
        if (Array.isArray(data)) setEmployees(data)
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }, [])

  const handleAdd = async () => {
    if (!form.employee_email || !form.employee_name) return alert('Vui lòng điền đầy đủ thông tin')
    try {
      const res = await shopService.addEmployee({
        employee_email: form.employee_email,
        employee_name:  form.employee_name,
        position:       form.position,
        password:       form.password || undefined,
        permissions:    [],
      })
      const data = res.data
      setForm({ ...EMPTY_FORM })
      setShowAdd(false)
      // Refresh danh sách từ API để có đúng employee_id + data thật
      shopService.getEmployees().then((r: any) => {
        const list = r.data?.employees ?? r.data
        if (Array.isArray(list)) setEmployees(list)
      }).catch(() => {})
      // Hiển thị credential nếu backend trả về
      if (data.login_password) {
        setCredential({ email: data.login_email, password: data.login_password })
      }
    } catch (err: any) {
      alert(err.response?.data?.detail || 'Lỗi thêm nhân viên')
    }
  }

  const handleRemove = async (id: number) => {
    if (!confirm('Xóa nhân viên này khỏi shop?')) return
    const prev = employees
    setEmployees(es => es.filter(e => e.employee_id !== id))
    try {
      await shopService.removeEmployee(id)
    } catch (err: any) {
      setEmployees(prev)
      alert(err.response?.data?.detail || 'Lỗi xóa nhân viên')
    }
  }

  const openPerms = (emp: any) => {
    setPermTarget(emp)
    setPerms(emp.permissions || [])
  }

  const handleSavePerms = () => {
    setEmployees(es => es.map(e =>
      e.employee_id === permTarget.employee_id ? { ...e, permissions: perms } : e
    ))
    shopService.updateEmployeePermissions(permTarget.employee_id, perms).catch(() => {})
    setPermTarget(null)
  }

  const togglePerm = (code: string) =>
    setPerms(p => p.includes(code) ? p.filter(x => x !== code) : [...p, code])

  const filtered = employees.filter(e =>
    !search ||
    e.employee_name?.toLowerCase().includes(search.toLowerCase()) ||
    e.employee_email?.toLowerCase().includes(search.toLowerCase()) ||
    e.position?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: C.navy, margin: 0 }}>👥 Nhân viên shop</h2>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>Quản lý nhân viên và phân quyền truy cập</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          padding: '10px 20px', background: C.blue, color: 'white',
          border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>
          + Thêm nhân viên
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {[
          { label: 'Tổng nhân viên',   value: employees.length,                                         color: C.blue    },
          { label: 'Đang hoạt động',   value: employees.filter(e => e.status === 'active').length,       color: C.success },
          { label: 'Tổng quyền đã cấp', value: employees.reduce((s, e) => s + (e.permissions?.length || 0), 0), color: C.warning },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm tên, email, chức vụ..."
          style={{ width: '100%', padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      {/* Employee cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="card" style={{ padding: 40, textAlign: 'center', color: C.gray }}>
            {search ? 'Không tìm thấy nhân viên' : 'Chưa có nhân viên nào'}
          </div>
        ) : filtered.map(emp => (
          <div key={emp.employee_id} className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              {/* Avatar */}
              <div style={{
                width: 46, height: 46, borderRadius: '50%', flexShrink: 0,
                background: `linear-gradient(135deg, ${C.blue}, ${C.sky})`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'white', fontWeight: 800, fontSize: 18,
              }}>
                {(emp.employee_name?.[0] ?? '?').toUpperCase()}
              </div>

              {/* Info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 2 }}>
                  <span style={{ fontWeight: 700, fontSize: 15, color: C.navy }}>{emp.employee_name}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
                    background: emp.status === 'active' ? '#DCFCE7' : '#FEE2E2',
                    color: emp.status === 'active' ? C.success : C.error,
                  }}>
                    {emp.status === 'active' ? '● Đang làm' : '● Nghỉ'}
                  </span>
                </div>
                <p style={{ fontSize: 12, color: C.gray, marginBottom: 8 }}>
                  {[emp.employee_email, emp.position || 'Chưa có chức vụ', emp.hired_date ? `Vào: ${emp.hired_date}` : ''].filter(Boolean).join(' · ')}
                </p>

                {/* Permission badges */}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {(emp.permissions || []).length === 0 ? (
                    <span style={{ fontSize: 12, color: C.gray, fontStyle: 'italic' }}>Chưa có quyền nào</span>
                  ) : (emp.permissions as string[]).map(code => (
                    <PermBadge key={code} code={code} />
                  ))}
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <button onClick={() => openPerms(emp)} style={{
                  padding: '7px 16px', background: C.tint, color: C.blue,
                  border: `1px solid ${C.light}`, borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}>
                  🔑 Phân quyền
                </button>
                <button onClick={() => handleRemove(emp.employee_id)} style={{
                  padding: '7px 14px', background: '#FEE2E2', color: C.error,
                  border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 12, cursor: 'pointer',
                }}>
                  Xóa
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Employee Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowAdd(false)}>
          <div className="card" style={{ width: 440, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: 0 }}>Thêm nhân viên</h2>
              <button onClick={() => setShowAdd(false)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'employee_name',  label: 'Họ và tên *',  type: 'text',     placeholder: 'VD: Nguyễn Văn A' },
                { key: 'employee_email', label: 'Email đăng nhập *', type: 'email', placeholder: 'VD: nhanvien@gmail.com' },
                { key: 'position',       label: 'Chức vụ',       type: 'text',     placeholder: 'VD: Nhân viên bán hàng' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>{f.label}</label>
                  <input
                    type={f.type}
                    value={(form as any)[f.key]}
                    placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 5 }}>
                  Mật khẩu <span style={{ fontWeight: 400, color: C.gray }}>(để trống → tự tạo ngẫu nhiên)</span>
                </label>
                <input
                  type="text"
                  value={form.password}
                  placeholder="VD: NhanVien@2025"
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }}
                />
              </div>
              <p style={{ fontSize: 12, color: C.gray, background: C.tint, padding: '8px 12px', borderRadius: 8, margin: 0 }}>
                🔑 Mật khẩu sẽ hiển thị <strong>1 lần</strong> sau khi tạo — lưu lại ngay để giao cho nhân viên.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
              <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: 10, background: C.tint, color: C.gray, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleAdd} style={{ flex: 2, padding: 10, background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>Thêm nhân viên</button>
            </div>
          </div>
        </div>
      )}

      {/* Credential Modal — hiện 1 lần sau khi tạo nhân viên */}
      {credential && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="card" style={{ width: 420, padding: 28, border: `2px solid ${C.warning}` }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>🔐</div>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: 0 }}>Thông tin đăng nhập nhân viên</h2>
              <p style={{ fontSize: 12, color: C.error, marginTop: 6, fontWeight: 600 }}>
                ⚠️ Lưu lại ngay — thông tin này chỉ hiện 1 lần!
              </p>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'Email đăng nhập', value: credential.email },
                { label: 'Mật khẩu',        value: credential.password },
              ].map(row => (
                <div key={row.label} style={{ background: C.tint, borderRadius: 8, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, margin: '0 0 4px' }}>{row.label}</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <code style={{ flex: 1, fontSize: 15, fontWeight: 700, color: C.navy, wordBreak: 'break-all' }}>{row.value}</code>
                    <button
                      onClick={() => navigator.clipboard.writeText(row.value)}
                      style={{ padding: '4px 10px', background: C.light, color: C.blue, border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer', flexShrink: 0 }}>
                      Copy
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => setCredential(null)}
              style={{ width: '100%', marginTop: 18, padding: 11, background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
              ✅ Đã lưu, đóng lại
            </button>
          </div>
        </div>
      )}

      {/* Permission Modal */}
      {permTarget && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setPermTarget(null)}>
          <div className="card" style={{ width: 500, padding: 28, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: 0 }}>🔑 Phân quyền nhân viên</h2>
              <button onClick={() => setPermTarget(null)} style={{ border: 'none', background: 'none', fontSize: 22, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: C.gray, marginBottom: 18 }}>
              {permTarget.employee_name} — {permTarget.position || 'Chưa có chức vụ'}
            </p>

            {/* Permission groups */}
            {PERM_GROUPS.map(group => {
              const groupPerms = ALL_PERMISSIONS.filter(p => p.group === group)
              return (
                <div key={group} style={{ marginBottom: 16 }}>
                  <p style={{ fontSize: 11, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>
                    {group}
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {groupPerms.map(p => {
                      const checked = perms.includes(p.code)
                      return (
                        <label key={p.code} onClick={() => togglePerm(p.code)} style={{
                          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                          padding: '10px 14px', borderRadius: 9,
                          background: checked ? C.light : C.tint,
                          border: `1px solid ${checked ? C.blue : 'transparent'}`,
                        }}>
                          <div style={{
                            width: 18, height: 18, borderRadius: 4, flexShrink: 0,
                            background: checked ? C.blue : 'white',
                            border: `2px solid ${checked ? C.blue : '#CBD5E1'}`,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            {checked && <span style={{ color: 'white', fontSize: 11, fontWeight: 800 }}>✓</span>}
                          </div>
                          <span style={{ fontSize: 14 }}>{p.icon}</span>
                          <span style={{ fontSize: 13, fontWeight: 600, color: checked ? C.blue : C.navy, flex: 1 }}>{p.label}</span>
                          <code style={{ fontSize: 10, color: C.gray, background: '#F1F5F9', padding: '2px 6px', borderRadius: 4 }}>
                            {p.code}
                          </code>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            <div style={{ display: 'flex', gap: 10, marginTop: 8, paddingTop: 16, borderTop: `1px solid ${C.light}` }}>
              <button onClick={() => setPermTarget(null)} style={{ flex: 1, padding: 10, background: C.tint, color: C.gray, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSavePerms} style={{ flex: 2, padding: 10, background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>
                💾 Lưu quyền ({perms.length} quyền)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default EmployeeManagement
