/**
 * DistrictWardsPage — Quản lý kho phường (cấp 3) từ kho quận
 */
import React, { useEffect, useState } from 'react'
import API from '../../services/api'

const C = { navy: '#0F172A', purple: '#7C3AED', light: '#EDE9FE', tint: '#F5F3FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const DistrictWardsPage: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', ward: '', address: '' })
  const [saving, setSaving] = useState(false)

  const load = () => {
    setLoading(true)
    API.get('/api/v1/warehouses/district/wards')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (wardId: number) => {
    setToggling(wardId)
    try {
      await API.post(`/api/v1/warehouses/district/wards/${wardId}/toggle-active`)
      load()
    } catch {
      alert('Lỗi khi cập nhật trạng thái kho')
    } finally {
      setToggling(null)
    }
  }

  const handleCreate = async () => {
    if (!form.name || !form.ward) { alert('Nhập tên kho và tên phường'); return }
    setSaving(true)
    try {
      await API.post('/api/v1/warehouses/district/wards', form)
      setShowCreate(false)
      setForm({ name: '', ward: '', address: '' })
      load()
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Lỗi tạo kho')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>

  const { district, wards = [] } = data || {}
  const filtered = wards.filter((w: any) =>
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    (w.ward || '').toLowerCase().includes(search.toLowerCase())
  )
  const activeCount = wards.filter((w: any) => w.is_active).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🏠 Kho phường/xã</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
            Thuộc {district?.name} · {activeCount}/{wards.length} đang hoạt động
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowCreate(true)}
            style={{ padding: '8px 16px', background: C.purple, color: 'white', border: 'none', borderRadius: 8, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            + Tạo kho phường
          </button>
        </div>
      </div>

      {/* Create modal */}
      {showCreate && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 16, padding: 28, width: 420, display: 'flex', flexDirection: 'column', gap: 14 }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: C.navy, margin: 0 }}>🏠 Tạo kho phường mới</h3>
            {[
              { key: 'name', label: 'Tên kho*', placeholder: 'VD: Kho Phường 1' },
              { key: 'ward', label: 'Tên phường*', placeholder: 'VD: Phường 1' },
              { key: 'address', label: 'Địa chỉ', placeholder: 'Số nhà, đường...' },
            ].map(f => (
              <div key={f.key}>
                <label style={{ fontSize: 12, color: C.gray, fontWeight: 600 }}>{f.label}</label>
                <input
                  value={(form as any)[f.key]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  style={{ width: '100%', marginTop: 4, padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <button onClick={() => setShowCreate(false)}
                style={{ flex: 1, padding: '10px', background: '#F1F5F9', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>
                Hủy
              </button>
              <button onClick={handleCreate} disabled={saving}
                style={{ flex: 2, padding: '10px', background: C.purple, color: 'white', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700, opacity: saving ? 0.5 : 1 }}>
                {saving ? 'Đang tạo...' : 'Tạo kho'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="card" style={{ padding: '10px 16px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm kho theo tên hoặc phường..."
          style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
        />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['#', 'Kho phường', 'Phường/xã', 'Shipper', 'Quản lý', 'Trạng thái', 'Thao tác'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Không có kho phường nào</td></tr>
            ) : filtered.map((w: any, idx: number) => (
              <tr key={w.warehouse_id} style={{ borderBottom: '1px solid #F1F5F9' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAF5FF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray }}>#{idx + 1}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{w.name}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>ID: {w.warehouse_id}</div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray }}>{w.ward || '—'}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ background: w.shipper_count > 0 ? '#DCFCE7' : '#FEE2E2', color: w.shipper_count > 0 ? C.success : C.error, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    {w.shipper_count > 0 ? `✅ ${w.shipper_count} shipper` : '⚠️ Chưa có'}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13 }}>
                  {w.manager_name
                    ? <div><div style={{ fontWeight: 600, color: C.navy }}>{w.manager_name}</div></div>
                    : <span style={{ color: C.warning }}>⚠️ Chưa có</span>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: w.is_active ? '#DCFCE7' : '#FEE2E2', color: w.is_active ? C.success : C.error }}>
                    {w.is_active ? '✅ Hoạt động' : '⛔ Tạm dừng'}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <button onClick={() => handleToggle(w.warehouse_id)} disabled={toggling === w.warehouse_id}
                    style={{ padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: w.is_active ? '#FEE2E2' : '#DCFCE7', color: w.is_active ? C.error : C.success, opacity: toggling === w.warehouse_id ? 0.5 : 1 }}>
                    {toggling === w.warehouse_id ? '...' : w.is_active ? 'Tạm dừng' : 'Kích hoạt'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default DistrictWardsPage
