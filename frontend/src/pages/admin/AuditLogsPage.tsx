import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import Loading from '../../components/common/Loading'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const ACTION_COLOR: Record<string, string> = {
  approve_shop: '#16A34A',    reject_shop: '#DC2626',
  ban_user: '#DC2626',        unban_user: '#16A34A',
  approve_product: '#16A34A', reject_product: '#DC2626',
  resolve_dispute: '#7C3AED', delete_product: '#DC2626',
  update_config: '#D97706',   send_notification: '#1D4ED8',
  approve_shipper: '#16A34A', approve_voucher: '#16A34A',
}

const AuditLogsPage: React.FC = () => {
  const [logs, setLogs]             = useState<any[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [actionFilter, setActionFilter] = useState('all')

  useEffect(() => {
    setLoading(true)
    adminService.getLogs()
      .then(r => { const d = r.data?.logs ?? r.data; if (Array.isArray(d)) setLogs(d) })
      .catch(() => setLogs([]))
      .finally(() => setLoading(false))
  }, [])

  const uniqueActions = [...new Set(logs.map((l: any) => l.action).filter(Boolean))]
  const filtered = logs.filter(l => {
    const ms = actionFilter === 'all' || l.action === actionFilter
    const mq = !search || l.action?.includes(search) || String(l.admin_id).includes(search) || l.target_type?.includes(search)
    return ms && mq
  })

  if (loading) return <Loading />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📋 Nhật ký hệ thống</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Ghi lại toàn bộ hành động của admin trên nền tảng</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng log',   value: logs.length,                                                                      color: C.blue    },
          { label: 'Hôm nay',   value: logs.filter(l => l.created_at?.startsWith('2025-06-14')).length,                  color: C.success },
          { label: 'Từ chối',   value: logs.filter(l => l.action?.includes('reject') || l.action?.includes('ban')).length, color: C.error   },
          { label: 'Phê duyệt', value: logs.filter(l => l.action?.includes('approve')).length,                           color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm hành động, đối tượng..."
          style={{ flex: 1, minWidth: 180, padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }} />
        <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
          style={{ padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}>
          <option value="all">Tất cả hành động</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Thời gian', 'Admin', 'Hành động', 'Đối tượng', 'ID', 'Ghi chú'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Không có nhật ký nào</td></tr>
            ) : filtered.map(l => (
              <tr key={l.log_id} style={{ borderBottom: `1px solid ${C.tint}` }}
                onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <td style={{ padding: '11px 16px', fontSize: 12, color: C.gray, whiteSpace: 'nowrap' }}>{l.created_at}</td>
                <td style={{ padding: '11px 16px', fontSize: 13 }}>
                  <span style={{ fontWeight: 600, color: C.navy }}>#{l.admin_id}</span>
                  <span style={{ fontSize: 11, color: C.gray, display: 'block' }}>{l.admin_email}</span>
                </td>
                <td style={{ padding: '11px 16px' }}>
                  <code style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 6, background: C.tint, color: ACTION_COLOR[l.action] ?? C.gray }}>
                    {l.action}
                  </code>
                </td>
                <td style={{ padding: '11px 16px', fontSize: 13, color: C.gray }}>{l.target_type}</td>
                <td style={{ padding: '11px 16px', fontSize: 13 }}>#{l.target_id ?? '—'}</td>
                <td style={{ padding: '11px 16px', fontSize: 12, color: C.gray, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {l.note || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default AuditLogsPage
