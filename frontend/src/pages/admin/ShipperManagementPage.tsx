import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'
import { warehouseService } from '../../services/warehouseService'

const C = {
  amber: '#D97706', navy: '#1E3A8A', gray: '#64748B',
  success: '#16A34A', error: '#DC2626', purple: '#7C3AED', teal: '#0D9488',
}

const TYPE_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  zone:           { label: 'Khu vực',   icon: '🏍️', color: C.teal,   bg: '#CCFBF1' },
  inter_province: { label: 'Liên tỉnh', icon: '🚚', color: C.amber,  bg: '#FEF3C7' },
}

interface Shipper {
  user_id: number
  shipper_id: number
  full_name: string
  email: string
  phone: string
  vehicle_type: string
  license_plate: string
  shipper_type: string
  zone_province: string | null
  home_warehouse_id: number | null
  status: string
}

interface Warehouse {
  warehouse_id: number
  name: string
  province: string
}

const ShipperManagementPage: React.FC = () => {
  const [shippers, setShippers]     = useState<Shipper[]>([])
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterType, setFilterType] = useState('all')
  const [actingId, setActingId]     = useState<number | null>(null)
  const [assignModal, setAssignModal] = useState<Shipper | null>(null)
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | ''>('')

  const load = () => {
    setLoading(true)
    Promise.all([
      API.get('/api/v1/admin/shippers', { params: { limit: 100 } }),
      warehouseService.listWarehouses(),
    ])
      .then(([sr, wr]: any[]) => {
        setShippers(sr.data?.shippers ?? [])
        setWarehouses(wr.data ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const assignWarehouse = async () => {
    if (!assignModal || !selectedWarehouse) return
    setActingId(assignModal.user_id)
    try {
      await API.post(`/api/v1/admin/shippers/${assignModal.user_id}/assign-warehouse`, {
        warehouse_id: selectedWarehouse,
      })
      const wh = warehouses.find(w => w.warehouse_id === selectedWarehouse)
      toast.success(`Đã gán ${assignModal.full_name} vào ${wh?.name}`)
      setShippers(s => s.map(x =>
        x.user_id === assignModal.user_id
          ? { ...x, home_warehouse_id: selectedWarehouse as number, zone_province: wh?.province ?? x.zone_province }
          : x
      ))
      setAssignModal(null)
      setSelectedWarehouse('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi gán kho')
    } finally {
      setActingId(null)
    }
  }

  const filtered = shippers.filter(s => {
    const matchSearch = !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
    const matchType   = filterType === 'all' || s.shipper_type === filterType
    return matchSearch && matchType
  })

  const stats = {
    total: shippers.length,
    zone:  shippers.filter(s => s.shipper_type === 'zone').length,
    inter: shippers.filter(s => s.shipper_type === 'inter_province').length,
    unassigned: shippers.filter(s => s.shipper_type === 'zone' && !s.home_warehouse_id).length,
  }

  const whName = (id: number | null) => warehouses.find(w => w.warehouse_id === id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 4px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.navy, margin: 0 }}>🚚 Quản lý Shipper</h1>
        <p style={{ fontSize: 14, color: C.gray, marginTop: 4 }}>Gán kho phụ trách và theo dõi đội ngũ giao hàng</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng shipper',   value: stats.total,      color: C.navy,    icon: '🚚' },
          { label: 'Khu vực',        value: stats.zone,        color: C.teal,    icon: '🏍️' },
          { label: 'Liên tỉnh',      value: stats.inter,       color: C.amber,   icon: '🚛' },
          { label: 'Chưa có kho',    value: stats.unassigned,  color: C.error,   icon: '⚠️' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 18px', borderLeft: '4px solid ' + s.color, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 20 }}>{s.icon}</span>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, margin: 0, textTransform: 'uppercase' }}>{s.label}</p>
            </div>
            <p style={{ fontSize: 28, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 20px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        <input
          value={search} onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm tên, email..."
          style={{ flex: 1, minWidth: 200, padding: '9px 14px', border: '1px solid #E2E8F0', borderRadius: 10, fontSize: 14, outline: 'none' }}
        />
        <div style={{ display: 'flex', gap: 8 }}>
          {[['all', 'Tất cả'], ['zone', '🏍️ Khu vực'], ['inter_province', '🚚 Liên tỉnh']].map(([k, l]) => (
            <button key={k} onClick={() => setFilterType(k)}
              style={{ padding: '8px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: filterType === k ? C.navy : '#F1F5F9', color: filterType === k ? 'white' : C.gray }}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['Shipper', 'Liên hệ', 'Loại', 'Phương tiện', 'Trạng thái', 'Kho phụ trách', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '14px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5, borderBottom: '1px solid #E2E8F0' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: C.gray }}>Đang tải...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: C.gray }}>Không tìm thấy shipper</td></tr>
            ) : filtered.map(s => {
              const st = TYPE_MAP[s.shipper_type] ?? TYPE_MAP.zone
              const wh = whName(s.home_warehouse_id)
              return (
                <tr key={s.user_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 38, height: 38, borderRadius: '50%', background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                        {st.icon}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: C.navy, margin: 0 }}>{s.full_name}</p>
                        <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>#{s.shipper_id}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{s.email}</p>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{s.phone || '—'}</p>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                      {st.icon} {st.label}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{s.vehicle_type}</p>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{s.license_plate}</p>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{
                      background: s.status === 'available' ? '#DCFCE7' : s.status === 'on_delivery' ? '#DBEAFE' : '#FEE2E2',
                      color: s.status === 'available' ? C.success : s.status === 'on_delivery' ? '#1D4ED8' : C.error,
                      borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700
                    }}>
                      {s.status === 'available' ? '✓ Sẵn sàng' : s.status === 'on_delivery' ? '🚚 Đang giao' : '✗ Offline'}
                    </span>
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {wh ? (
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 13, color: C.teal, margin: 0 }}>🏭 {wh.name}</p>
                        <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>📍 {wh.province}</p>
                      </div>
                    ) : s.shipper_type === 'inter_province' ? (
                      <span style={{ color: C.amber, fontSize: 12, fontWeight: 600 }}>🚚 Di động liên tỉnh</span>
                    ) : (
                      <span style={{ color: C.error, fontSize: 12, fontWeight: 600 }}>⚠️ Chưa gán kho</span>
                    )}
                  </td>
                  <td style={{ padding: '14px 16px' }}>
                    {s.shipper_type === 'zone' ? (
                      <button
                        disabled={actingId === s.user_id}
                        onClick={() => { setAssignModal(s); setSelectedWarehouse(s.home_warehouse_id ?? '') }}
                        style={{ padding: '7px 14px', background: '#DBEAFE', color: '#1D4ED8', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        🏭 Gán kho
                      </button>
                    ) : (
                      <span style={{ color: '#94A3B8', fontSize: 12 }}>—</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Assign Warehouse Modal */}
      {assignModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setAssignModal(null)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 420, padding: 28, boxShadow: '0 24px 60px rgba(0,0,0,0.2)' }}
            onClick={e => e.stopPropagation()}>
            <h3 style={{ fontWeight: 800, color: C.navy, marginBottom: 4 }}>🏭 Gán kho cho shipper</h3>
            <p style={{ color: C.gray, fontSize: 14, marginBottom: 20 }}>{assignModal.full_name}</p>
            <label style={{ fontSize: 13, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 8 }}>Chọn kho phụ trách</label>
            <select
              value={selectedWarehouse}
              onChange={e => setSelectedWarehouse(Number(e.target.value) || '')}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1px solid #E2E8F0', fontSize: 14, marginBottom: 20, outline: 'none' }}>
              <option value="">-- Chọn kho --</option>
              {warehouses.map(w => (
                <option key={w.warehouse_id} value={w.warehouse_id}>{w.name} — {w.province}</option>
              ))}
            </select>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setAssignModal(null)}
                style={{ flex: 1, padding: '10px 0', background: '#F1F5F9', color: C.gray, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                Hủy
              </button>
              <button onClick={assignWarehouse} disabled={!selectedWarehouse || actingId === assignModal.user_id}
                style={{ flex: 2, padding: '10px 0', background: selectedWarehouse ? C.teal : '#94A3B8', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: selectedWarehouse ? 'pointer' : 'default' }}>
                {actingId === assignModal.user_id ? '⏳ Đang lưu...' : '✓ Xác nhận gán kho'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ShipperManagementPage
