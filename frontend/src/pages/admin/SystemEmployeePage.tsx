import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import Header from '../../components/common/Header'
import Modal from '../../components/common/Modal'
import Loading from '../../components/common/Loading'
import { PERMISSIONS } from '../../utils/constants'

const SystemEmployeePage: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ employee_email: '', employee_name: '', role_name: 'general', permissions: [] as string[] })

  const load = async () => {
    setLoading(true)
    try { const r = await adminService.getSystemEmployees(); setEmployees(r.data.employees) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handleCreate = async () => {
    try { await adminService.createSystemEmployee(form); toast.success('Đã tạo nhân viên hệ thống'); setModalOpen(false); load() }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi') }
  }

  const togglePerm = (code: string) => setForm(f => ({ ...f, permissions: f.permissions.includes(code) ? f.permissions.filter(p => p !== code) : [...f.permissions, code] }))

  if (loading) return <div><Header title="Nhân viên hệ thống" /><Loading /></div>

  return (
    <div>
      <Header title="Nhân viên hệ thống" action={<button onClick={() => setModalOpen(true)} className="btn btn-primary">+ Thêm nhân viên</button>} />
      <div className="card table-wrapper">
        <table>
          <thead><tr><th>Tên</th><th>Email</th><th>Vai trò</th><th>Số quyền</th></tr></thead>
        </table>
        {employees.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Chưa có nhân viên hệ thống</p>}
      </div>
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Thêm nhân viên hệ thống">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[['Email', 'employee_email', 'email'], ['Tên', 'employee_name', 'text']].map(([label, key, type]) => (
            <div key={key}><label className="input-label">{label}</label><input className="input" type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} /></div>
          ))}
          <div><label className="input-label">Vai trò</label>
            <select className="input" value={form.role_name} onChange={e => setForm(f => ({ ...f, role_name: e.target.value }))}>
              {['general', 'product_manager', 'order_handler', 'dispute_resolver'].map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="input-label">Quyền hạn</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
              {PERMISSIONS.map(p => (
                <label key={p.code} style={{ display: 'flex', gap: 8, cursor: 'pointer', fontSize: 13 }}>
                  <input type="checkbox" checked={form.permissions.includes(p.code)} onChange={() => togglePerm(p.code)} />{p.label}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => setModalOpen(false)} className="btn btn-ghost">Hủy</button>
            <button onClick={handleCreate} className="btn btn-primary">Tạo</button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default SystemEmployeePage
