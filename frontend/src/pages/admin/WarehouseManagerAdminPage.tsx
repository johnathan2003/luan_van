/**
 * WarehouseManagerAdminPage
 * Admin tạo và quản lý tài khoản quản lý kho (nhân viên hệ thống).
 * Quản lý kho KHÔNG phải shipper — do admin tạo thẳng.
 */
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'
import { warehouseService } from '../../services/warehouseService'

const C = {
  navy: '#1E3A8A', teal: '#0D9488', amber: '#D97706',
  success: '#16A34A', error: '#DC2626', gray: '#64748B', purple: '#7C3AED',
}

interface WM {
  user_id: number
  full_name: string
  email: string
  phone: string
  warehouse_id: number | null
  warehouse_name: string | null
  province: string | null
  status: string
}

interface Warehouse {
  warehouse_id: number
  name: string
  province: string
}

const EMPTY_FORM = { full_name: '', email: '', phone: '', password: '', warehouse_id: '' }

const WarehouseManagerAdminPage: React.FC = () => {
  const [managers, setManagers]     = useState<WM[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading]       = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm]   = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<number | null>(null)
  const [selected, setSelected] = useState<WM | null>(null)

  const load = () => {
    setLoading(true)
    Promise.all([
      API.get('/api/v1/admin/warehouse-managers'),
      warehouseService.listWarehouses(),
    ])
      .then(([mr, wr]: any[]) => {
        setManagers(mr.data?.managers ?? [])
        setWarehouses(wr.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.full_name || !form.email || !form.password || !form.warehouse_id) {
      toast.error('Vui lòng điền đầy đủ thông tin bắt buộc')
      return
    }
    setSaving(true)
    try {
      await API.post('/api/v1/admin/warehouse-managers', {
        full_name:    form.full_name,
        email:        form.email,
        phone:        form.phone,
        password:     form.password,
        warehouse_id: Number(form.warehouse_id),
      })
      toast.success(`Đã tạo tài khoản quản lý kho cho ${form.full_name}`)
      setShowCreate(false)
      setForm({ ...EMPTY_FORM })
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi tạo tài khoản')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (wm: WM) => {
    if (!window.confirm(`Xóa tài khoản quản lý kho của ${wm.full_name}?`)) return
    setDeleting(wm.user_id)
    try {
      await API.delete(`/api/v1/admin/warehouse-managers/${wm.user_id}`)
      toast.success('Đã xóa tài khoản')
      setManagers(m => m.filter(x => x.user_id !== wm.user_id))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi xóa tài khoản')
    } finally {
      setDeleting(null)
    }
  }

  const getWh = (id: number | null) => warehouses.find(w => w.warehouse_id === id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 4px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: C.navy, margin: 0 }}>🏭 Quản lý Kho</h1>
          <p style={{ fontSize: 14, color: C.gray, marginTop: 4 }}>Tạo và quản lý tài khoản nhân viên quản lý kho — do admin chỉ định trực tiếp</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          style={{ padding: '10px 20px', background: C.teal, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + Thêm quản lý kho
        </button>
      </div>

      {/* Warehouse overview — from real data */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {warehouses.map(w => {
          const count = managers.filter(m => m.warehouse_id === w.warehouse_id).length
          return (
            <div key={w.warehouse_id} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 20px', borderLeft: '4px solid ' + C.teal, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
              <p style={{ fontWeight: 800, color: C.navy, margin: '0 0 4px', fontSize: 15 }}>🏭 {w.name}</p>
              <p style={{ color: C.gray, fontSize: 12, margin: '0 0 8px' }}>📍 {w.province}</p>
              <p style={{ color: count > 0 ? C.success : C.error, fontWeight: 700, fontSize: 13, margin: 0 }}>
                {count > 0 ? `✓ ${count} quản lý` : '⚠️ Chưa có quản lý'}
              </p>
            </div>
          )
        })}
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['Họ tên', 'Liên hệ', 'Kho quản lý', 'Tỉnh/Thành phố', 'Trạng thái', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E2E8F0' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: C.gray }}>Đang tải...</td></tr>
            ) : managers.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 48, textAlign: 'center', color: C.gray }}>Chưa có quản lý kho nào. Nhấn "+ Thêm" để tạo.</td></tr>
            ) : managers.map(m => {
              const warehouse = getWh(m.warehouse_id)
              return (
                <tr key={m.user_id} style={{ borderBottom: '1px solid #F1F5F9' }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFC')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏭</div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: C.navy, margin: 0 }}>{m.full_name}</p>
                        <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>ID #{m.user_id}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{m.email}</p>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{m.phone || '—'}</p>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {warehouse ? (
                      <span style={{ background: '#CCFBF1', color: C.teal, borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
                        🏭 {warehouse.name}
                      </span>
                    ) : m.warehouse_name ? (
                      <span style={{ background: '#CCFBF1', color: C.teal, borderRadius: 8, padding: '4px 12px', fontSize: 13, fontWeight: 700 }}>
                        🏭 {m.warehouse_name}
                      </span>
                    ) : (
                      <span style={{ color: C.error, fontSize: 12 }}>⚠️ Chưa gán kho</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px', fontSize: 13, color: C.gray }}>
                    📍 {warehouse?.province ?? m.province ?? '—'}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: m.status === 'active' ? '#DCFCE7' : '#FEE2E2', color: m.status === 'active' ? C.success : C.error, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                      {m.status === 'active' ? '✓ Hoạt động' : '✗ Vô hiệu'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button onClick={() => setSelected(m)}
                        style={{ padding: '6px 12px', background: '#DBEAFE', color: '#1D4ED8', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        Chi tiết
                      </button>
                      <button onClick={() => handleDelete(m)} disabled={deleting === m.user_id}
                        style={{ padding: '6px 12px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                        {deleting === m.user_id ? '⏳' : 'Xóa'}
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowCreate(false)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 480, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, color: C.navy, margin: 0 }}>🏭 Tạo tài khoản quản lý kho</h3>
              <button onClick={() => setShowCreate(false)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.gray }}>✕</button>
            </div>

            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {[
                { label: 'Họ tên *', key: 'full_name', type: 'text', placeholder: 'Nguyễn Văn A' },
                { label: 'Email *', key: 'email', type: 'email', placeholder: 'manager@kho.vn' },
                { label: 'Số điện thoại', key: 'phone', type: 'tel', placeholder: '09xxxxxxxx' },
                { label: 'Mật khẩu *', key: 'password', type: 'password', placeholder: 'Tối thiểu 8 ký tự' },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label style={{ fontSize: 13, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 6 }}>{label}</label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    value={(form as any)[key]}
                    onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
                  />
                </div>
              ))}

              <div>
                <label style={{ fontSize: 13, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 6 }}>Kho phụ trách *</label>
                <select
                  value={form.warehouse_id}
                  onChange={e => setForm(f => ({ ...f, warehouse_id: e.target.value }))}
                  style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 14, outline: 'none' }}>
                  <option value="">-- Chọn kho --</option>
                  {warehouses.map(w => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>{w.name} — {w.province}</option>
                  ))}
                </select>
              </div>

              <div style={{ background: '#FEF3C7', borderRadius: 10, padding: '12px 16px', fontSize: 13, color: '#92400E', marginTop: 4 }}>
                ⚠️ Quản lý kho là nhân viên hệ thống, <strong>không tham gia giao hàng trực tiếp</strong>. Họ sẽ đăng nhập tại <code>/warehouse</code>.
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
                <button type="button" onClick={() => setShowCreate(false)}
                  style={{ flex: 1, padding: '11px 0', background: '#F1F5F9', color: C.gray, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                  Hủy
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex: 2, padding: '11px 0', background: C.teal, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                  {saving ? '⏳ Đang tạo...' : '✓ Tạo tài khoản'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setSelected(null)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontWeight: 800, color: C.navy, margin: 0 }}>Chi tiết quản lý kho</h3>
              <button onClick={() => setSelected(null)} style={{ background: '#F1F5F9', border: 'none', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', color: C.gray }}>✕</button>
            </div>
            {[
              ['Họ tên', selected.full_name],
              ['Email', selected.email],
              ['Điện thoại', selected.phone || '—'],
              ['Kho phụ trách', getWh(selected.warehouse_id)?.name ?? selected.warehouse_name ?? '—'],
              ['Tỉnh/Thành phố', getWh(selected.warehouse_id)?.province ?? selected.province ?? '—'],
              ['URL đăng nhập', '/warehouse'],
              ['Trạng thái', selected.status === 'active' ? '✓ Hoạt động' : '✗ Vô hiệu'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F1F5F9' }}>
                <span style={{ color: C.gray, fontSize: 14 }}>{k}</span>
                <span style={{ color: C.navy, fontWeight: 600, fontSize: 14 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default WarehouseManagerAdminPage
