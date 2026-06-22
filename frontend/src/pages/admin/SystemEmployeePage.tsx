import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Loading from '../../components/common/Loading'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  general:           { label: 'Nhân viên',              color: C.gray,    bg: '#F1F5F9' },
  product_manager:   { label: 'Quản lý sản phẩm',       color: C.blue,    bg: C.light   },
  order_handler:     { label: 'Xử lý đơn hàng',         color: C.warning, bg: '#FEF3C7' },
  dispute_resolver:  { label: 'Giải quyết tranh chấp',  color: '#7C3AED', bg: '#EDE9FE' },
}

const MOCK_EMPLOYEES = [
  { employee_id:1, employee_name:'Trần Thị Admin',    employee_email:'admin2@buyzo.vn',  role_name:'product_manager',  created_at:'2025-01-10' },
  { employee_id:2, employee_name:'Lê Văn Hỗ Trợ',    employee_email:'support@buyzo.vn', role_name:'order_handler',    created_at:'2025-02-15' },
  { employee_id:3, employee_name:'Nguyễn Minh Trọng', employee_email:'dispute@buyzo.vn', role_name:'dispute_resolver', created_at:'2025-03-01' },
  { employee_id:4, employee_name:'Phạm Thị Thu',      employee_email:'content@buyzo.vn', role_name:'general',          created_at:'2025-04-20' },
]

const EMPTY_FORM = { employee_email: '', employee_name: '', role_name: 'general' }

const SystemEmployeePage: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>(MOCK_EMPLOYEES)
  const [loading, setLoading]     = useState(false)
  const [showForm, setShowForm]   = useState(false)
  const [form, setForm]           = useState({ ...EMPTY_FORM })
  const [search, setSearch]       = useState('')

  useEffect(() => {
    setLoading(true)
    adminService.getSystemEmployees()
      .then(r => setEmployees(r.data?.employees || r.data || MOCK_EMPLOYEES))
      .catch(() => setEmployees(MOCK_EMPLOYEES))
      .finally(() => setLoading(false))
  }, [])

  const handleCreate = () => {
    if (!form.employee_email || !form.employee_name) return alert('Vui lòng điền đầy đủ thông tin')
    setEmployees(es => [...es, { ...form, employee_id: Date.now(), created_at: new Date().toISOString().slice(0,10) }])
    setForm({ ...EMPTY_FORM })
    setShowForm(false)
  }

  const handleRemove = (id: number) => {
    if (window.confirm('Xóa nhân viên này khỏi hệ thống?')) setEmployees(es => es.filter(e => e.employee_id !== id))
  }

  const filtered = employees.filter(e =>
    !search || e.employee_name?.toLowerCase().includes(search.toLowerCase()) || e.employee_email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🧑‍💼 Nhân viên hệ thống</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Quản lý tài khoản nhân viên vận hành nền tảng BuyZO</p>
        </div>
        <button onClick={() => setShowForm(true)} style={{ padding: '10px 20px', background: C.blue, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + Thêm nhân viên
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {Object.entries(ROLE_META).map(([k, v]) => (
          <div key={k} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${v.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{v.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: v.color }}>{employees.filter(e => e.role_name === k).length}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '14px 18px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm theo tên hoặc email..."
          style={{ width: '100%', padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Nhân viên', 'Email', 'Vai trò', 'Ngày tạo', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Chưa có nhân viên hệ thống</td></tr>
            ) : filtered.map(e => {
              const rm = ROLE_META[e.role_name] ?? ROLE_META.general
              const initial = (e.employee_name?.[0] ?? '?').toUpperCase()
              return (
                <tr key={e.employee_id} style={{ borderBottom: `1px solid ${C.tint}` }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = '#F8FAFF')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: `linear-gradient(135deg, ${rm.color}, ${C.blue})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
                        {initial}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{e.employee_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: C.gray }}>{e.employee_email}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: rm.bg, color: rm.color }}>
                      {rm.label}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: C.gray }}>{e.created_at}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <button onClick={() => handleRemove(e.employee_id)} style={{ padding: '5px 14px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Xóa
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowForm(false)}>
          <div className="card" style={{ width: 420, padding: 28 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>Thêm nhân viên hệ thống</h2>
              <button onClick={() => setShowForm(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { key: 'employee_name',  label: 'Họ và tên',  type: 'text',  placeholder: 'VD: Nguyễn Thị Admin' },
                { key: 'employee_email', label: 'Email',      type: 'email', placeholder: 'VD: nhanvien@buyzo.vn' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Vai trò</label>
                <select value={form.role_name} onChange={e => setForm(p => ({ ...p, role_name: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}>
                  {Object.entries(ROLE_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: C.tint, color: C.gray, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleCreate} style={{ flex: 2, padding: '10px', background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>Thêm nhân viên</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SystemEmployeePage
