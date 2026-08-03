/**
 * HubDistrictsPage — Quản lý kho quận (cấp 2) từ kho tổng (cấp 1)
 */
import React, { useEffect, useState } from 'react'
import API from '../../services/api'

const C = { navy: '#0F172A', blue: '#0D9488', light: '#CCFBF1', tint: '#F0FDFA', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const HubDistrictsPage: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    API.get('/api/v1/warehouses/hub/districts')
      .then(r => setData(r.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  const handleToggle = async (districtId: number) => {
    setToggling(districtId)
    try {
      await API.post(`/api/v1/warehouses/hub/districts/${districtId}/toggle-active`)
      load()
    } catch {
      alert('Lỗi khi cập nhật trạng thái kho')
    } finally {
      setToggling(null)
    }
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
  if (!data) return <div style={{ padding: 40, textAlign: 'center', color: C.error }}>Không thể tải dữ liệu</div>

  const { hub, districts = [] } = data
  const filtered = districts.filter((d: any) =>
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    (d.district || '').toLowerCase().includes(search.toLowerCase())
  )

  const activeCount = districts.filter((d: any) => d.is_active).length

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>🏘️ Kho quận/huyện</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>
            Thuộc {hub?.name} · {activeCount}/{districts.length} đang hoạt động
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <span style={{ background: '#DCFCE7', color: C.success, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            ✅ {activeCount} hoạt động
          </span>
          <span style={{ background: '#FEE2E2', color: C.error, padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
            ⛔ {districts.length - activeCount} tạm dừng
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="card" style={{ padding: '10px 16px' }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="🔍 Tìm kho theo tên hoặc quận/huyện..."
          style={{ width: '100%', border: 'none', outline: 'none', fontSize: 14, background: 'transparent' }}
        />
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['#', 'Kho quận/huyện', 'Địa chỉ', 'Kho phường', 'Quản lý', 'Trạng thái', 'Thao tác'].map(h => (
                <th key={h} style={{ padding: '11px 14px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Không có kho nào</td></tr>
            ) : filtered.map((d: any, idx: number) => (
              <tr key={d.warehouse_id}
                style={{ borderBottom: '1px solid #F1F5F9' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray, fontWeight: 600 }}>#{idx + 1}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: C.navy }}>{d.name}</div>
                  <div style={{ fontSize: 11, color: C.gray }}>📍 {d.district || d.province}</div>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray }}>{d.address || '—'}</td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ background: C.tint, color: C.blue, padding: '3px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700 }}>
                    {d.ward_count ?? 0} phường
                  </span>
                </td>
                <td style={{ padding: '12px 14px', fontSize: 13, color: C.gray }}>
                  {d.manager_name ? (
                    <div>
                      <div style={{ fontWeight: 600, color: C.navy }}>{d.manager_name}</div>
                      <div style={{ fontSize: 11, color: C.gray }}>ID: {d.manager_id}</div>
                    </div>
                  ) : <span style={{ color: C.warning }}>⚠️ Chưa có</span>}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{
                    padding: '4px 10px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                    background: d.is_active ? '#DCFCE7' : '#FEE2E2',
                    color: d.is_active ? C.success : C.error,
                  }}>
                    {d.is_active ? '✅ Hoạt động' : '⛔ Tạm dừng'}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <button
                    onClick={() => handleToggle(d.warehouse_id)}
                    disabled={toggling === d.warehouse_id}
                    style={{
                      padding: '6px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700,
                      background: d.is_active ? '#FEE2E2' : '#DCFCE7',
                      color: d.is_active ? C.error : C.success,
                      opacity: toggling === d.warehouse_id ? 0.5 : 1,
                    }}>
                    {toggling === d.warehouse_id ? '...' : d.is_active ? 'Tạm dừng' : 'Kích hoạt'}
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

export default HubDistrictsPage
