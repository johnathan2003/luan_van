import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import { shopService } from '../../services/shopService'
import Modal from '../common/Modal'
import { PERMISSIONS } from '../../utils/constants'

const EmployeeManagement: React.FC = () => {
  const [employees, setEmployees] = useState<any[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [permModal, setPermModal] = useState<any>(null)
  const [form, setForm] = useState({ employee_email: '', employee_name: '', position: '', permissions: [] as string[] })
  const [perms, setPerms] = useState<string[]>([])

  const load = async () => {
    const res = await shopService.getEmployees()
    setEmployees(res.data.employees)
  }

  useEffect(() => { load() }, [])

  const handleAdd = async () => {
    try {
      await shopService.addEmployee(form)
      toast.success('Đã thêm nhân viên')
      setModalOpen(false)
      load()
    } catch (err: any) { toast.error(err.response?.data?.detail || 'Lỗi') }
  }

  const openPerms = (emp: any) => { setPermModal(emp); setPerms(emp.permissions || []) }

  const handleSavePerms = async () => {
    try {
      await shopService.updateEmployeePermissions(permModal.employee_id, perms)
      toast.success('Đã cập nhật quyền')
      setPermModal(null)
      load()
    } catch { toast.error('Lỗi') }
  }

  const handleRemove = async (id: number) => {
    if (!confirm('Xóa nhân viên?')) return
    await shopService.removeEmployee(id)
    toast.success('Đã xóa'); load()
  }

  const togglePerm = (code: string) => setPerms(p => p.includes(code) ? p.filter(x => x !== code) : [...p, code])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontWeight: 700, fontSize: 18 }}>Nhân viên ({employees.length})</h2>
        <button onClick={() => setModalOpen(true)} className="btn btn-primary">+ Thêm nhân viên</button>
      </div>

      <div className="card table-wrapper">
        <table>
          <thead><tr><th>Tên</th><th>Chức vụ</th><th>Trạng thái</th><th>Quyền hạn</th><th>Thao tác</th></tr></thead>
          <tbody>
            {employees.map(e => (
              <tr key={e.employee_id}>
                <td style={{ fontWeight: 500 }}>{e.employee_name}</td>
                <td>{e.position || '—'}</td>
                <td><span style={{ color: e.status === 'active' ? 'var(--success)' : 'var(--gray-400)', fontWeight: 600, fontSize: 13 }}>{e.status === 'active' ? 'Đang làm' : 'Nghỉ'}</span></td>
                <td style={{ fontSize: 13, color: 'var(--gray-600)' }}>{e.permissions?.length || 0} quyền</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => openPerms(e)} className="btn btn-outline btn-sm">Phân quyền</button>
                    <button onClick={() => handleRemove(e.employee_id)} className="btn btn-danger btn-sm">Xóa</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {employees.length === 0 && <p style={{ textAlign: 'center', padding: 32, color: 'var(--gray-400)' }}>Chưa có nhân viên</p>}
      </div>

      {/* Add modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Thêm nhân viên">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {[['Email', 'employee_email', 'email'], ['Tên', 'employee_name', 'text'], ['Chức vụ', 'position', 'text']].map(([label, key, type]) => (
            <div key={key}>
              <label className="input-label">{label}</label>
              <input className="input" type={type} value={(form as any)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
            <button onClick={() => setModalOpen(false)} className="btn btn-ghost">Hủy</button>
            <button onClick={handleAdd} className="btn btn-primary">Thêm</button>
          </div>
        </div>
      </Modal>

      {/* Permission modal */}
      <Modal open={!!permModal} onClose={() => setPermModal(null)} title={`Phân quyền: ${permModal?.employee_name}`}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {PERMISSIONS.map(p => (
            <label key={p.code} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14 }}>
              <input type="checkbox" checked={perms.includes(p.code)} onChange={() => togglePerm(p.code)} />
              <span>{p.label}</span>
              <code style={{ fontSize: 11, color: 'var(--gray-400)', marginLeft: 'auto' }}>{p.code}</code>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={() => setPermModal(null)} className="btn btn-ghost">Hủy</button>
          <button onClick={handleSavePerms} className="btn btn-primary">Lưu quyền</button>
        </div>
      </Modal>
    </div>
  )
}

export default EmployeeManagement
