import React from 'react'
import type { AdminDashboard } from '../../types/admin'
import { useNavigate } from 'react-router-dom'

interface Props { data: AdminDashboard }

const DashboardWidget: React.FC<Props> = ({ data }) => {
  const navigate = useNavigate()
  const stats = [
    { label: 'Người dùng', value: data.total_users, icon: '👥', color: 'var(--info)', path: '/admin/users' },
    { label: 'Shop', value: data.total_shops, icon: '🏪', color: 'var(--primary)', path: '/admin/approvals' },
    { label: 'Tổng đơn hàng', value: data.total_orders, icon: '📦', color: 'var(--success)', path: '' },
    { label: 'Shop chờ duyệt', value: data.pending_shop_registrations, icon: '⏳', color: 'var(--warning)', path: '/admin/approvals' },
    { label: 'Shipper chờ duyệt', value: data.pending_shipper_registrations, icon: '🚚', color: 'var(--secondary)', path: '/admin/approvals' },
    { label: 'Khiếu nại mở', value: data.open_disputes, icon: '⚖️', color: 'var(--error)', path: '/admin/disputes' },
  ]

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
      {stats.map(s => (
        <div
          key={s.label}
          className="card"
          style={{ padding: 20, cursor: s.path ? 'pointer' : 'default', borderTop: `4px solid ${s.color}`, transition: 'transform var(--transition)' }}
          onClick={() => s.path && navigate(s.path)}
          onMouseEnter={e => { if (s.path) (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)' }}
          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = '' }}
        >
          <div style={{ fontSize: 28, marginBottom: 10 }}>{s.icon}</div>
          <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>{s.label}</p>
          <p style={{ fontSize: 28, fontWeight: 800, color: s.color }}>{s.value}</p>
        </div>
      ))}
    </div>
  )
}

export default DashboardWidget
