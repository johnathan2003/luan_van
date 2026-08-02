import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import API from '../../services/api'
import Loading from '../../components/common/Loading'

const C = {
  navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF',
  gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626',
  purple: '#7C3AED',
}

/* ─── 8 Granular Permissions ──────────────────────────────────────── */
const PERMISSION_META: Record<string, { label: string; desc: string; color: string }> = {
  order_confirm:   { label: 'Xác nhận đơn',      desc: 'Duyệt & xác nhận đơn hàng mới',         color: C.blue    },
  refund_manage:   { label: 'Hoàn tiền',          desc: 'Xử lý yêu cầu hoàn tiền cho khách',     color: C.warning },
  product_manage:  { label: 'Quản lý sản phẩm',  desc: 'Duyệt, ẩn/hiện, chỉnh sửa sản phẩm',   color: '#0D9488' },
  dispute_manage:  { label: 'Xử lý tranh chấp',  desc: 'Giải quyết khiếu nại giữa các bên',     color: C.purple  },
  report_view:     { label: 'Xem báo cáo',        desc: 'Truy cập báo cáo doanh thu, thống kê',  color: C.gray    },
  voucher_manage:  { label: 'Quản lý voucher',    desc: 'Tạo, chỉnh sửa, vô hiệu hóa voucher',  color: '#EA580C' },
  shipper_support: { label: 'Hỗ trợ shipper',     desc: 'Xem & xử lý vấn đề giao nhận',          color: '#0891B2' },
  shipper_approve: { label: 'Duyệt shipper',      desc: 'Phê duyệt đơn đăng ký shipper mới',     color: C.success },
  warehouse_manage: { label: 'Quản lý kho', desc: 'Tổng quản lý kho — tạo & phân tài khoản Kho cấp 1/2/3', color: '#7C3AED' },
}

const ALL_PERMS = Object.keys(PERMISSION_META)

const EMPTY_FORM = { employee_username: '', employee_name: '', permissions: [] as string[] }

interface Employee {
  emp_id: number
  user_id: number
  emp_name: string
  email: string | null
  role_name: string
  status: string
  created_at: string | null
  permissions: string[]
}

/* ─── Permission Checkboxes ───────────────────────────────────────── */
const PermCheckboxes: React.FC<{
  selected: string[]
  onChange: (perms: string[]) => void
}> = ({ selected, onChange }) => {
  const toggle = (p: string) =>
    onChange(selected.includes(p) ? selected.filter(x => x !== p) : [...selected, p])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {ALL_PERMS.map(p => {
        const meta = PERMISSION_META[p]
        const active = selected.includes(p)
        return (
          <label key={p} style={{
            display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
            borderRadius: 10, border: `2px solid ${active ? meta.color : '#E2E8F0'}`,
            background: active ? meta.color + '11' : '#fff', cursor: 'pointer',
          }}>
            <input type="checkbox" checked={active} onChange={() => toggle(p)}
              style={{ marginTop: 2, accentColor: meta.color, width: 15, height: 15, flexShrink: 0 }} />
            <div>
              <p style={{ fontSize: 13, fontWeight: 700, color: active ? meta.color : C.navy, margin: 0 }}>{meta.label}</p>
              <p style={{ fontSize: 11, color: C.gray, margin: '2px 0 0' }}>{meta.desc}</p>
            </div>
          </label>
        )
      })}
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────── */
const SystemEmployeePage: React.FC = () => {
  const [employees, setEmployees]       = useState<Employee[]>([])
  const [loading, setLoading]           = useState(true)
  const [search, setSearch]             = useState('')
  const [showAddModal, setShowAdd]      = useState(false)
  const [form, setForm]                 = useState({ ...EMPTY_FORM })
  const [saving, setSaving]             = useState(false)
  const [editPerm, setEditPerm]         = useState<Employee | null>(null)
  const [editPerms, setEditPerms]       = useState<string[]>([])
  const [savingPerm, setSavingPerm]     = useState(false)

  const loadEmployees = () => {
    setLoading(true)
    adminService.getSystemEmployees()
      .then((r: any) => {
        const d = r.data?.employees ?? r.data
        if (Array.isArray(d)) setEmployees(d)
      })
      .catch(() => setEmployees([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadEmployees() }, [])

  const handleCreate = async () => {
    if (!form.employee_username.trim() || !form.employee_name.trim()) {
      toast.warn('Vui lòng điền đầy đủ tên và tài khoản đăng nhập')
      return
    }
    setSaving(true)
    try {
      const r: any = await API.post('/api/v1/admin/system-employees', {
        employee_username: form.employee_username.trim(),
        employee_name:     form.employee_name.trim(),
        permissions:       form.permissions,
      })
      toast.success(`Đã thêm nhân viên ${form.employee_name}`)
      setForm({ ...EMPTY_FORM })
      setShowAdd(false)
      loadEmployees()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi tạo nhân viên')
    } finally { setSaving(false) }
  }

  const handleRemove = async (emp: Employee) => {
    if (!window.confirm(`Vô hiệu hóa nhân viên ${emp.emp_name}?`)) return
    try {
      await API.delete(`/api/v1/admin/system-employees/${emp.emp_id}`)
      toast.success(`Đã xóa ${emp.emp_name}`)
      setEmployees(es => es.filter(e => e.emp_id !== emp.emp_id))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi xóa nhân viên')
    }
  }

  const openEditPerm = (emp: Employee) => {
    setEditPerm(emp)
    setEditPerms([...emp.permissions])
  }

  const savePermissions = async () => {
    if (!editPerm) return
    setSavingPerm(true)
    try {
      await API.put(`/api/v1/admin/system-employees/${editPerm.emp_id}/permissions`, {
        permissions: editPerms,
      })
      toast.success(`Đã cập nhật quyền cho ${editPerm.emp_name}`)
      setEmployees(es => es.map(e =>
        e.emp_id === editPerm.emp_id ? { ...e, permissions: [...editPerms] } : e
      ))
      setEditPerm(null)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi cập nhật quyền')
    } finally { setSavingPerm(false) }
  }

  const filtered = employees.filter(e =>
    !search
    || e.emp_name?.toLowerCase().includes(search.toLowerCase())
    || e.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy, margin: 0 }}>🧑‍💼 Nhân viên hệ thống</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 4 }}>Quản lý quyền truy cập cho nhân viên vận hành nền tảng</p>
        </div>
        <button onClick={() => setShowAdd(true)}
          style={{ padding: '10px 20px', background: C.blue, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + Thêm nhân viên
        </button>
      </div>

      {/* Stats — count by permission */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {[
          { label: 'Tổng nhân viên', value: employees.length, color: C.navy },
          { label: 'Có quyền đơn',   value: employees.filter(e => e.permissions.includes('order_confirm')).length,  color: C.blue    },
          { label: 'Duyệt shipper',  value: employees.filter(e => e.permissions.includes('shipper_approve')).length, color: C.success },
          { label: 'Xử lý tranh chấp', value: employees.filter(e => e.permissions.includes('dispute_manage')).length, color: C.purple },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 18px', borderLeft: '4px solid ' + s.color, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase', margin: 0 }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: '6px 0 0' }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '12px 16px' }}>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm theo tên hoặc email..."
          style={{ width: '100%', padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Nhân viên', 'Email', 'Quyền', 'Ngày thêm', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Chưa có nhân viên hệ thống</td></tr>
            ) : filtered.map(e => {
              const initial = (e.emp_name?.[0] ?? '?').toUpperCase()
              return (
                <tr key={e.emp_id} style={{ borderBottom: `1px solid ${C.tint}` }}
                  onMouseEnter={ev => (ev.currentTarget.style.background = '#F8FAFF')}
                  onMouseLeave={ev => (ev.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: `linear-gradient(135deg, ${C.blue}, ${C.navy})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 14, flexShrink: 0 }}>
                        {initial}
                      </div>
                      <span style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{e.emp_name}</span>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 13, color: C.gray }}>{e.email ?? '—'}</td>
                  <td style={{ padding: '13px 16px' }}>
                    {e.permissions.length === 0 ? (
                      <span style={{ fontSize: 12, color: '#94A3B8' }}>Chưa có quyền</span>
                    ) : (
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {e.permissions.slice(0, 3).map(p => {
                          const m = PERMISSION_META[p]
                          return m ? (
                            <span key={p} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: m.color + '20', color: m.color }}>
                              {m.label}
                            </span>
                          ) : null
                        })}
                        {e.permissions.length > 3 && (
                          <span style={{ fontSize: 11, fontWeight: 600, color: C.gray }}>+{e.permissions.length - 3}</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: C.gray }}>
                    {e.created_at ? new Date(e.created_at).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => openEditPerm(e)}
                        style={{ padding: '5px 12px', background: C.tint, color: C.blue, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        🔑 Sửa quyền
                      </button>
                      <button onClick={() => handleRemove(e)}
                        style={{ padding: '5px 12px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add Employee Modal */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowAdd(false)}>
          <div className="card" style={{ width: '100%', maxWidth: 560, padding: 28, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: 0 }}>+ Thêm nhân viên hệ thống</h2>
              <button onClick={() => setShowAdd(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
              {[
                { key: 'employee_name',     label: 'Họ và tên',           type: 'text', placeholder: 'VD: Nguyễn Thị Admin' },
                { key: 'employee_username', label: 'Tài khoản đăng nhập', type: 'text', placeholder: 'VD: nhanvien01 (tối thiểu 6 ký tự)' },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} placeholder={f.placeholder}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
              ))}
              {form.employee_username.trim() && (
                <div style={{ fontSize: 11, color: C.gray, marginTop: -6 }}>
                  📌 Email: <b>{form.employee_username.trim()}</b>@buyzo.com — Mật khẩu: <b>{form.employee_username.trim()}</b>
                </div>
              )}
            </div>

            <p style={{ fontSize: 13, fontWeight: 700, color: C.navy, margin: '0 0 10px' }}>🔑 Phân quyền</p>
            <PermCheckboxes
              selected={form.permissions}
              onChange={perms => setForm(p => ({ ...p, permissions: perms }))}
            />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowAdd(false)}
                style={{ flex: 1, padding: '10px', background: C.tint, color: C.gray, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>
                Hủy
              </button>
              <button onClick={handleCreate} disabled={saving}
                style={{ flex: 2, padding: '10px', background: saving ? '#94A3B8' : C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
                {saving ? '⏳ Đang lưu...' : '✓ Thêm nhân viên'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Permissions Modal */}
      {editPerm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setEditPerm(null)}>
          <div className="card" style={{ width: '100%', maxWidth: 560, padding: 28, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy, margin: 0 }}>🔑 Sửa quyền nhân viên</h2>
              <button onClick={() => setEditPerm(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            <p style={{ color: C.gray, fontSize: 13, marginBottom: 16 }}>{editPerm.emp_name} · {editPerm.email}</p>

            {/* Select / Deselect all */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <button onClick={() => setEditPerms([...ALL_PERMS])}
                style={{ padding: '5px 12px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Chọn tất cả
              </button>
              <button onClick={() => setEditPerms([])}
                style={{ padding: '5px 12px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Bỏ tất cả
              </button>
            </div>

            <PermCheckboxes selected={editPerms} onChange={setEditPerms} />

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setEditPerm(null)}
                style={{ flex: 1, padding: '10px', background: C.tint, color: C.gray, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>
                Hủy
              </button>
              <button onClick={savePermissions} disabled={savingPerm}
                style={{ flex: 2, padding: '10px', background: savingPerm ? '#94A3B8' : C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: savingPerm ? 'default' : 'pointer' }}>
                {savingPerm ? '⏳ Đang lưu...' : '✓ Lưu thay đổi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SystemEmployeePage
