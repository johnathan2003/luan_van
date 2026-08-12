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

const STATUS_REG_MAP: Record<string, { label: string; color: string; bg: string }> = {
  pending:  { label: '⏳ Chờ duyệt', color: C.amber,   bg: '#FEF3C7' },
  approved: { label: '✓ Đã duyệt',   color: C.success, bg: '#DCFCE7' },
  rejected: { label: '✗ Từ chối',    color: C.error,   bg: '#FEE2E2' },
}

const REJECT_REASONS = [
  'Ảnh không rõ nét',
  'Giấy tờ không hợp lệ',
  'Thông tin không khớp',
  'Xe không đủ điều kiện',
]

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

interface ShipperReg {
  reg_id: number
  user_id: number
  full_name: string | null
  email: string | null
  phone: string | null
  vehicle_type: string
  license_plate: string
  shipper_type: string
  zone_province: string | null
  home_warehouse_id: number | null
  license_url: string | null
  registration_url: string | null
  id_card_url: string | null
  status: string
  rejection_reason: string | null
  reviewed_by_name: string | null
  reviewed_at: string | null
  created_at: string | null
}

interface Warehouse {
  warehouse_id: number
  name: string
  province: string
}

/* ─── Shipper List Tab ────────────────────────────────────────────── */
const ShipperListTab: React.FC<{ warehouses: Warehouse[] }> = ({ warehouses }) => {
  const [shippers, setShippers]       = useState<Shipper[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [filterType, setFilterType]   = useState('all')
  const [actingId, setActingId]       = useState<number | null>(null)
  const [assignModal, setAssignModal] = useState<Shipper | null>(null)
  const [selectedWH, setSelectedWH]  = useState<number | ''>('')

  const load = () => {
    setLoading(true)
    API.get('/api/v1/admin/shippers', { params: { limit: 100 } })
      .then((r: any) => setShippers(r.data?.shippers ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }
  useEffect(() => { load() }, [])

  const assignWarehouse = async () => {
    if (!assignModal || !selectedWH) return
    setActingId(assignModal.user_id)
    try {
      await API.post(`/api/v1/admin/shippers/${assignModal.user_id}/assign-warehouse`, { warehouse_id: selectedWH })
      const wh = warehouses.find(w => w.warehouse_id === selectedWH)
      toast.success(`Đã gán ${assignModal.full_name} vào ${wh?.name}`)
      setShippers(s => s.map(x =>
        x.user_id === assignModal.user_id
          ? { ...x, home_warehouse_id: selectedWH as number, zone_province: wh?.province ?? x.zone_province }
          : x
      ))
      setAssignModal(null)
      setSelectedWH('')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi gán kho')
    } finally { setActingId(null) }
  }

  const filtered = shippers.filter(s => {
    const q = search.toLowerCase()
    return (!search || s.full_name?.toLowerCase().includes(q) || s.email?.toLowerCase().includes(q))
      && (filterType === 'all' || s.shipper_type === filterType)
  })

  const stats = {
    total: shippers.length,
    zone:  shippers.filter(s => s.shipper_type === 'zone').length,
    inter: shippers.filter(s => s.shipper_type === 'inter_province').length,
    unassigned: shippers.filter(s => s.shipper_type === 'zone' && !s.home_warehouse_id).length,
  }

  const whName = (id: number | null) => warehouses.find(w => w.warehouse_id === id)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng shipper', value: stats.total,     color: C.navy,  icon: '🚚' },
          { label: 'Khu vực',      value: stats.zone,       color: C.teal,  icon: '🏍️' },
          { label: 'Liên tỉnh',    value: stats.inter,      color: C.amber, icon: '🚛' },
          { label: 'Chưa có kho',  value: stats.unassigned, color: C.error, icon: '⚠️' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 18px', borderLeft: '4px solid ' + s.color, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 18 }}>{s.icon}</span>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, margin: 0, textTransform: 'uppercase' }}>{s.label}</p>
            </div>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '14px 18px', display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
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
                <th key={h} style={{ padding: '13px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>
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
                  <td style={{ padding: '13px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: st.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>
                        {st.icon}
                      </div>
                      <div>
                        <p style={{ fontWeight: 700, fontSize: 14, color: C.navy, margin: 0 }}>{s.full_name}</p>
                        <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>#{s.shipper_id}</p>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{s.email}</p>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{s.phone || '—'}</p>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                      {st.icon} {st.label}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{s.vehicle_type}</p>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{s.license_plate}</p>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{
                      background: s.status === 'available' ? '#DCFCE7' : s.status === 'on_delivery' ? '#DBEAFE' : '#FEE2E2',
                      color: s.status === 'available' ? C.success : s.status === 'on_delivery' ? '#1D4ED8' : C.error,
                      borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700,
                    }}>
                      {s.status === 'available' ? '✓ Sẵn sàng' : s.status === 'on_delivery' ? '🚚 Đang giao' : '✗ Offline'}
                    </span>
                  </td>
                  <td style={{ padding: '13px 16px' }}>
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
                  <td style={{ padding: '13px 16px' }}>
                    {s.shipper_type === 'zone' ? (
                      <button
                        disabled={actingId === s.user_id}
                        onClick={() => { setAssignModal(s); setSelectedWH(s.home_warehouse_id ?? '') }}
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
              value={selectedWH}
              onChange={e => setSelectedWH(Number(e.target.value) || '')}
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
              <button onClick={assignWarehouse} disabled={!selectedWH || actingId === assignModal.user_id}
                style={{ flex: 2, padding: '10px 0', background: selectedWH ? C.teal : '#94A3B8', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: selectedWH ? 'pointer' : 'default' }}>
                {actingId === assignModal.user_id ? '⏳ Đang lưu...' : '✓ Xác nhận gán kho'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Registration Review Tab ─────────────────────────────────────── */
const RegistrationTab: React.FC<{ warehouses: Warehouse[] }> = ({ warehouses }) => {
  const [regs, setRegs]             = useState<ShipperReg[]>([])
  const [loading, setLoading]       = useState(true)
  const [filterStatus, setFilter]   = useState('pending')
  const [page, setPage]             = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [detailModal, setDetail]    = useState<ShipperReg | null>(null)
  const [acting, setActing]         = useState(false)
  const [rejectReason, setReason]   = useState('')
  const [customReason, setCustom]   = useState('')
  const [showRejectBox, setShowRej] = useState(false)

  const load = (s = filterStatus, p = page) => {
    setLoading(true)
    API.get('/api/v1/admin/shipper-registrations', { params: { page: p, limit: 15, status: s } })
      .then((r: any) => {
        setRegs(r.data?.registrations ?? [])
        setTotalPages(r.data?.pages ?? 1)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const changeFilter = (s: string) => { setFilter(s); setPage(1); load(s, 1) }
  const changePage   = (p: number) => { setPage(p); load(filterStatus, p) }

  const approve = async (reg: ShipperReg) => {
    setActing(true)
    try {
      await API.post(`/api/v1/admin/shipper-registrations/${reg.reg_id}/approve`)
      toast.success(`Đã duyệt đơn của ${reg.full_name}`)
      setDetail(null)
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi duyệt đơn')
    } finally { setActing(false) }
  }

  const reject = async (reg: ShipperReg) => {
    const reason = rejectReason === 'Khác' ? customReason : rejectReason
    if (!reason.trim()) { toast.warn('Vui lòng chọn lý do từ chối'); return }
    setActing(true)
    try {
      await API.post(`/api/v1/admin/shipper-registrations/${reg.reg_id}/reject`, { reason })
      toast.success(`Đã từ chối đơn của ${reg.full_name}`)
      setDetail(null)
      setShowRej(false)
      setReason('')
      setCustom('')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi từ chối đơn')
    } finally { setActing(false) }
  }

  const whName = (id: number | null) => warehouses.find(w => w.warehouse_id === id)?.name ?? '—'

  const openDetail = (reg: ShipperReg) => {
    setDetail(reg)
    setShowRej(false)
    setReason('')
    setCustom('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8 }}>
        {[['pending', '⏳ Chờ duyệt'], ['approved', '✓ Đã duyệt'], ['rejected', '✗ Từ chối']].map(([k, l]) => (
          <button key={k} onClick={() => changeFilter(k)}
            style={{ padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: filterStatus === k ? C.navy : '#F1F5F9', color: filterStatus === k ? 'white' : C.gray }}>
            {l}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 16, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#F8FAFC' }}>
              {['Người đăng ký', 'Liên hệ', 'Loại / Phương tiện', 'Kho ưu tiên', 'Ngày nộp', 'Trạng thái', 'Chi tiết'].map(h => (
                <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.gray, textTransform: 'uppercase', borderBottom: '1px solid #E2E8F0' }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: C.gray }}>Đang tải...</td></tr>
            ) : regs.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 48, textAlign: 'center', color: C.gray }}>Không có đơn nào</td></tr>
            ) : regs.map(r => {
              const st = STATUS_REG_MAP[r.status] ?? STATUS_REG_MAP.pending
              const ty = TYPE_MAP[r.shipper_type] ?? TYPE_MAP.zone
              return (
                <tr key={r.reg_id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontWeight: 700, fontSize: 14, color: C.navy, margin: 0 }}>{r.full_name ?? '—'}</p>
                    <p style={{ fontSize: 11, color: C.gray, margin: 0 }}>#{r.reg_id}</p>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize: 13, color: C.navy, margin: 0 }}>{r.email ?? '—'}</p>
                    <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>{r.phone ?? '—'}</p>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: ty.bg, color: ty.color, borderRadius: 8, padding: '3px 9px', fontSize: 12, fontWeight: 700 }}>
                      {ty.icon} {ty.label}
                    </span>
                    <p style={{ fontSize: 12, color: C.gray, margin: '4px 0 0' }}>{r.vehicle_type} · {r.license_plate}</p>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.navy }}>{whName(r.home_warehouse_id)}</td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.gray }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('vi-VN') : '—'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ background: st.bg, color: st.color, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 700 }}>
                      {st.label}
                    </span>
                    {r.rejection_reason && (
                      <p style={{ fontSize: 11, color: C.error, margin: '3px 0 0' }}>{r.rejection_reason}</p>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => openDetail(r)}
                      style={{ padding: '6px 14px', background: '#EEF2FF', color: '#4338CA', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                      👁 Xem
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
            <button key={p} onClick={() => changePage(p)}
              style={{ width: 36, height: 36, borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: page === p ? C.navy : '#F1F5F9', color: page === p ? 'white' : C.gray }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {detailModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setDetail(null)}>
          <div style={{ background: '#fff', borderRadius: 20, width: '100%', maxWidth: 640, maxHeight: '90vh', overflowY: 'auto', padding: 32, boxShadow: '0 24px 60px rgba(0,0,0,0.22)' }}
            onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
              <div>
                <h3 style={{ fontWeight: 800, color: C.navy, margin: 0, fontSize: 20 }}>📋 Đơn đăng ký Shipper</h3>
                <p style={{ color: C.gray, fontSize: 13, marginTop: 4 }}>#{detailModal.reg_id} · {detailModal.created_at ? new Date(detailModal.created_at).toLocaleDateString('vi-VN') : '—'}</p>
              </div>
              {(() => { const st = STATUS_REG_MAP[detailModal.status] ?? STATUS_REG_MAP.pending; return (
                <span style={{ background: st.bg, color: st.color, borderRadius: 10, padding: '6px 14px', fontSize: 13, fontWeight: 800 }}>
                  {st.label}
                </span>
              )})()}
            </div>

            {/* Info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
              {[
                ['👤 Họ tên',       detailModal.full_name ?? '—'],
                ['📧 Email',        detailModal.email ?? '—'],
                ['📱 SĐT',          detailModal.phone ?? '—'],
                ['🚗 Phương tiện',  `${detailModal.vehicle_type} · ${detailModal.license_plate}`],
                ['📦 Loại shipper', TYPE_MAP[detailModal.shipper_type]?.label ?? detailModal.shipper_type],
                ['🏭 Kho ưu tiên',  whName(detailModal.home_warehouse_id)],
              ].map(([k, v]) => (
                <div key={k} style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px' }}>
                  <p style={{ fontSize: 11, color: C.gray, margin: 0, fontWeight: 600 }}>{k}</p>
                  <p style={{ fontSize: 14, color: C.navy, margin: '4px 0 0', fontWeight: 600 }}>{v}</p>
                </div>
              ))}
            </div>

            {/* Documents */}
            <p style={{ fontWeight: 700, color: C.navy, fontSize: 14, marginBottom: 10 }}>📄 Giấy tờ đính kèm</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 24 }}>
              {[
                ['CCCD / CMT',  detailModal.id_card_url],
                ['Bằng lái xe', detailModal.license_url],
                ['Đăng ký xe',  detailModal.registration_url],
              ].map(([label, url]) => (
                <div key={label} style={{ background: '#F8FAFC', borderRadius: 12, padding: 12, textAlign: 'center' }}>
                  <p style={{ fontSize: 12, color: C.gray, margin: '0 0 8px', fontWeight: 600 }}>{label}</p>
                  {url ? (
                    <a href={url} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'inline-block', padding: '6px 12px', background: '#DBEAFE', color: '#1D4ED8', borderRadius: 8, fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                      🔗 Xem ảnh
                    </a>
                  ) : (
                    <span style={{ fontSize: 12, color: '#94A3B8' }}>Không có</span>
                  )}
                </div>
              ))}
            </div>

            {/* Reviewer info (if already reviewed) */}
            {detailModal.reviewed_by_name && (
              <div style={{ background: '#F8FAFC', borderRadius: 10, padding: '10px 14px', marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: C.gray, margin: 0 }}>
                  Duyệt bởi <strong>{detailModal.reviewed_by_name}</strong>
                  {detailModal.reviewed_at && ` · ${new Date(detailModal.reviewed_at).toLocaleDateString('vi-VN')}`}
                </p>
                {detailModal.rejection_reason && (
                  <p style={{ fontSize: 13, color: C.error, margin: '4px 0 0', fontWeight: 600 }}>Lý do: {detailModal.rejection_reason}</p>
                )}
              </div>
            )}

            {/* Actions — only for pending */}
            {detailModal.status === 'pending' && (
              <div>
                {!showRejectBox ? (
                  <div style={{ display: 'flex', gap: 10 }}>
                    <button onClick={() => setDetail(null)}
                      style={{ flex: 1, padding: '11px 0', background: '#F1F5F9', color: C.gray, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                      Đóng
                    </button>
                    <button onClick={() => setShowRej(true)}
                      style={{ flex: 1, padding: '11px 0', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                      ✗ Từ chối
                    </button>
                    <button onClick={() => approve(detailModal)} disabled={acting}
                      style={{ flex: 2, padding: '11px 0', background: C.success, color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                      {acting ? '⏳...' : '✓ Duyệt đơn'}
                    </button>
                  </div>
                ) : (
                  <div>
                    <p style={{ fontWeight: 700, color: C.navy, fontSize: 14, margin: '0 0 10px' }}>Chọn lý do từ chối</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                      {REJECT_REASONS.map(r => (
                        <button key={r} onClick={() => setReason(r)}
                          style={{ padding: '7px 14px', borderRadius: 9, border: `2px solid ${rejectReason === r ? C.error : '#E2E8F0'}`,
                            background: rejectReason === r ? '#FEE2E2' : '#fff', color: rejectReason === r ? C.error : C.gray,
                            fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                          {r}
                        </button>
                      ))}
                      <button onClick={() => setReason('Khác')}
                        style={{ padding: '7px 14px', borderRadius: 9, border: `2px solid ${rejectReason === 'Khác' ? C.error : '#E2E8F0'}`,
                          background: rejectReason === 'Khác' ? '#FEE2E2' : '#fff', color: rejectReason === 'Khác' ? C.error : C.gray,
                          fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                        Khác
                      </button>
                    </div>
                    {rejectReason === 'Khác' && (
                      <textarea
                        value={customReason} onChange={e => setCustom(e.target.value)}
                        placeholder="Nhập lý do cụ thể..."
                        rows={2}
                        style={{ width: '100%', padding: '9px 12px', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 13, resize: 'vertical', marginBottom: 12, outline: 'none', boxSizing: 'border-box' }}
                      />
                    )}
                    <div style={{ display: 'flex', gap: 10 }}>
                      <button onClick={() => { setShowRej(false); setReason(''); setCustom('') }}
                        style={{ flex: 1, padding: '10px 0', background: '#F1F5F9', color: C.gray, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                        Quay lại
                      </button>
                      <button onClick={() => reject(detailModal)} disabled={acting || !rejectReason}
                        style={{ flex: 2, padding: '10px 0', background: rejectReason ? C.error : '#94A3B8', color: '#fff', border: 'none', borderRadius: 10, fontWeight: 700, cursor: rejectReason ? 'pointer' : 'default' }}>
                        {acting ? '⏳...' : '✗ Xác nhận từ chối'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            {detailModal.status !== 'pending' && (
              <button onClick={() => setDetail(null)}
                style={{ width: '100%', padding: '11px 0', background: '#F1F5F9', color: C.gray, border: 'none', borderRadius: 10, fontWeight: 700, cursor: 'pointer' }}>
                Đóng
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────── */
const ShipperManagementPage: React.FC = () => {
  const [activeTab, setActiveTab]   = useState<'list' | 'reg'>('list')
  const [warehouses, setWarehouses] = useState<Warehouse[]>([])

  useEffect(() => {
    warehouseService.listWarehouses()
      .then((r: any) => setWarehouses(r.data ?? []))
      .catch(() => {})
  }, [])

  const tabs: { key: 'list' | 'reg'; label: string }[] = [
    { key: 'list', label: '🚚 Danh sách Shipper' },
    { key: 'reg',  label: '📋 Đơn đăng ký' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, padding: '0 4px' }}>
      {/* Header */}
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: C.navy, margin: 0 }}>🚚 Quản lý Shipper</h1>
        <p style={{ fontSize: 14, color: C.gray, marginTop: 4 }}>Quản lý đội ngũ giao hàng và duyệt đơn đăng ký</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            style={{ padding: '9px 22px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700,
              background: activeTab === t.key ? C.navy : 'transparent', color: activeTab === t.key ? 'white' : C.gray,
              transition: 'all 0.15s' }}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'list'
        ? <ShipperListTab warehouses={warehouses} />
        : <RegistrationTab warehouses={warehouses} />
      }
    </div>
  )
}

export default ShipperManagementPage
