import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import API from '../../services/api'

const C = {
  amber: '#D97706', navy: '#1E3A8A', gray: '#64748B',
  success: '#16A34A', error: '#DC2626', purple: '#7C3AED', teal: '#0D9488',
}

const TYPE_MAP: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  free:           { label: 'Tự do',     icon: '🛵', color: C.purple, bg: '#EDE9FE' },
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
  status: string
  is_warehouse_manager: boolean
}

const ShipperManagementPage: React.FC = () => {
  const [shippers, setShippers] = useState<Shipper[]>([])
  const [loading, setLoading]   = useState(true)
  const [search, setSearch]     = useState('')
  const [filterType, setFilterType] = useState('all')
  const [actingId, setActingId] = useState<number | null>(null)

  const load = () => {
    setLoading(true)
    API.get('/api/v1/admin/shippers', { params: { limit: 100 } })
      .then((r: any) => setShippers(r.data?.shippers ?? []))
      .catch(() => setShippers(MOCK_SHIPPERS))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const promote = async (userId: number, name: string) => {
    setActingId(userId)
    try {
      await API.post(`/api/v1/admin/shippers/${userId}/promote-warehouse-manager`)
      toast.success(`Đã bổ nhiệm ${name} làm Quản lý kho!`)
      setShippers(s => s.map(x => x.user_id === userId ? { ...x, is_warehouse_manager: true } : x))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi bổ nhiệm')
    } finally {
      setActingId(null)
    }
  }

  const demote = async (userId: number, name: string) => {
    setActingId(userId)
    try {
      await API.delete(`/api/v1/admin/shippers/${userId}/remove-warehouse-manager`)
      toast.success(`Đã thu hồi quyền quản lý kho của ${name}`)
      setShippers(s => s.map(x => x.user_id === userId ? { ...x, is_warehouse_manager: false } : x))
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi thu hồi')
    } finally {
      setActingId(null)
    }
  }

  const filtered = shippers.filter(s => {
    const matchSearch = !search || s.full_name.toLowerCase().includes(search.toLowerCase()) || s.email.toLowerCase().includes(search.toLowerCase())
    const matchType   = filterType === 'all' || (filterType === 'wm' ? s.is_warehouse_manager : s.shipper_type === filterType)
    return matchSearch && matchType
  })

  const stats = {
    total:   shippers.length,
    free:    shippers.filter(s => s.shipper_type === 'free').length,
    zone:    shippers.filter(s => s.shipper_type === 'zone').length,
    inter:   shippers.filter(s => s.shipper_type === 'inter_province').length,
    wm:      shippers.filter(s => s.is_warehouse_manager).length,
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '0 4px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.navy, margin: 0 }}>🚚 Quản lý Shipper</h1>
        <p style={{ fontSize: 14, color: C.gray, marginTop: 4 }}>Duyệt, bổ nhiệm quản lý kho và theo dõi đội ngũ giao hàng</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng shipper', value: stats.total, color: C.navy,    icon: '🚚' },
          { label: 'Tự do',        value: stats.free,  color: C.purple,  icon: '🛵' },
          { label: 'Khu vực',      value: stats.zone,  color: C.teal,    icon: '🏍️' },
          { label: 'Liên tỉnh',    value: stats.inter, color: C.amber,   icon: '🚛' },
          { label: 'Quản lý kho',  value: stats.wm,    color: C.success, icon: '🏭' },
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
          {[['all', 'Tất cả'], ['free', '🛵 Tự do'], ['zone', '🏍️ Khu vực'], ['inter_province', '🚚 Liên tỉnh'], ['wm', '🏭 Quản lý kho']].map(([k, l]) => (
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
              {['Shipper', 'Liên hệ', 'Loại', 'Phương tiện', 'Trạng thái', 'Vai trò', 'Hành động'].map(h => (
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
              const st = TYPE_MAP[s.shipper_type] ?? TYPE_MAP.free
              return (
                <tr key={s.user_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  {/* Name */}
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

                  {/* Contact */}
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{s.email}</p>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{s.phone || '—'}</p>
                  </td>

                  {/* Type */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                      {st.icon} {st.label}
                    </span>
                  </td>

                  {/* Vehicle */}
                  <td style={{ padding: '14px 16px' }}>
                    <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{s.vehicle_type}</p>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{s.license_plate}</p>
                  </td>

                  {/* Status */}
                  <td style={{ padding: '14px 16px' }}>
                    <span style={{ background: s.status === 'active' ? '#DCFCE7' : '#FEE2E2', color: s.status === 'active' ? C.success : C.error, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                      {s.status === 'active' ? '✓ Hoạt động' : s.status === 'on_delivery' ? '🚚 Đang giao' : '✗ Tạm nghỉ'}
                    </span>
                  </td>

                  {/* Role */}
                  <td style={{ padding: '14px 16px' }}>
                    {s.is_warehouse_manager ? (
                      <span style={{ background: '#DCFCE7', color: C.success, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                        🏭 Quản lý kho
                      </span>
                    ) : (
                      <span style={{ background: '#F1F5F9', color: C.gray, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600 }}>
                        Shipper
                      </span>
                    )}
                  </td>

                  {/* Action */}
                  <td style={{ padding: '14px 16px' }}>
                    {s.is_warehouse_manager ? (
                      <button
                        disabled={actingId === s.user_id}
                        onClick={() => demote(s.user_id, s.full_name)}
                        style={{ padding: '7px 14px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {actingId === s.user_id ? '⏳...' : '✗ Thu hồi QL'}
                      </button>
                    ) : (
                      <button
                        disabled={actingId === s.user_id}
                        onClick={() => promote(s.user_id, s.full_name)}
                        style={{ padding: '7px 14px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        {actingId === s.user_id ? '⏳...' : '🏭 Bổ nhiệm QL'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Mock data (khi API chưa sẵn sàng) ─────────────────────────────────────
const MOCK_SHIPPERS: Shipper[] = [
  { user_id: 10, shipper_id: 1, full_name: 'Nguyễn Văn A', email: 'shipper1@demo.vn', phone: '0901111111', vehicle_type: 'motorcycle', license_plate: '51A-00001', shipper_type: 'free', status: 'active', is_warehouse_manager: false },
  { user_id: 11, shipper_id: 2, full_name: 'Trần Thị B',   email: 'shipper2@demo.vn', phone: '0902222222', vehicle_type: 'motorcycle', license_plate: '51B-00002', shipper_type: 'zone', status: 'active', is_warehouse_manager: false },
  { user_id: 12, shipper_id: 3, full_name: 'Lê Văn C',     email: 'shipper3@demo.vn', phone: '0903333333', vehicle_type: 'truck_medium', license_plate: '51C-00003', shipper_type: 'inter_province', status: 'active', is_warehouse_manager: false },
  { user_id: 13, shipper_id: 4, full_name: 'Phạm Thị D',   email: 'shipper4@demo.vn', phone: '0904444444', vehicle_type: 'truck_large', license_plate: '51D-00004', shipper_type: 'inter_province', status: 'active', is_warehouse_manager: true },
  { user_id: 14, shipper_id: 5, full_name: 'Hoàng Văn E',  email: 'shipper5@demo.vn', phone: '0905555555', vehicle_type: 'motorcycle', license_plate: '51E-00005', shipper_type: 'zone', status: 'on_delivery', is_warehouse_manager: false },
]

export default ShipperManagementPage
