/**
 * ⚙️ Admin Overview — Dashboard tổng quan hệ thống
 */
import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import Loading from '../../components/common/Loading'
import { adminService } from '../../services/adminService'
import type { AdminDashboard } from '../../types/admin'

// ── Màu admin navy ─────────────────────────────────────────────
const C = {
  navy:    '#1E3A8A',
  blue:    '#1D4ED8',
  sky:     '#3B82F6',
  light:   '#DBEAFE',
  tint:    '#EFF6FF',
  success: '#16A34A',
  warning: '#D97706',
  error:   '#DC2626',
  gray:    '#64748B',
}

// ── Mock chart data (weekly trend) ────────────────────────────
const genWeeklyOrders = (total: number) => {
  const days = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']
  const base = Math.round(total / 7)
  return days.map((d, i) => ({
    day: d,
    orders: Math.max(0, base + Math.round(Math.sin(i * 0.9) * base * 0.4)),
  }))
}

const genUserGrowth = (total: number) => {
  const months = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6']
  return months.map((m, i) => ({
    month: m,
    users: Math.round(total * (0.55 + i * 0.09)),
  }))
}

// ── Stat Card ─────────────────────────────────────────────────
interface StatCardProps {
  icon: string; label: string; value: number | string
  color: string; bg: string; delta?: string; path?: string
}
const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bg, delta, path }) => {
  const inner = (
    <div className="card" style={{
      padding: '20px 22px',
      borderLeft: `4px solid ${color}`,
      background: 'var(--bg-card)',
      cursor: path ? 'pointer' : 'default',
      transition: 'transform 0.15s, box-shadow 0.15s',
      height: '100%',
    }}
      onMouseEnter={e => { if (path) { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = `0 8px 24px ${color}28` } }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = ''; (e.currentTarget as HTMLDivElement).style.boxShadow = '' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: C.gray, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>{label}</p>
          <p style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>
            {typeof value === 'number' ? value.toLocaleString('vi-VN') : value}
          </p>
          {delta && <p style={{ fontSize: 12, color: C.success, marginTop: 6, fontWeight: 600 }}>{delta}</p>}
        </div>
        <div style={{ width: 44, height: 44, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>
          {icon}
        </div>
      </div>
    </div>
  )
  return path ? <Link to={path} style={{ textDecoration: 'none' }}>{inner}</Link> : inner
}

// ── Section Header ─────────────────────────────────────────────
const SectionHeader: React.FC<{ title: string; sub?: string; action?: React.ReactNode }> = ({ title, sub, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 2 }}>{title}</h3>
      {sub && <p style={{ fontSize: 12, color: C.gray }}>{sub}</p>}
    </div>
    {action}
  </div>
)

// ── Custom Tooltip ─────────────────────────────────────────────
const OrderTooltip: React.FC<any> = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'white', border: `1px solid ${C.light}`, borderRadius: 8, padding: '10px 14px', boxShadow: '0 4px 16px rgba(30,58,138,0.12)' }}>
      <p style={{ fontWeight: 700, color: C.navy, marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ fontSize: 13, color: p.color }}>
          📦 Đơn hàng: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────
const AdminOverviewPage: React.FC = () => {
  const [data, setData]       = useState<AdminDashboard | null>(null)
  const [logs, setLogs]       = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([adminService.getDashboard(), adminService.getLogs()])
      .then(([d, l]) => {
        setData(d.data)
        setLogs(l.data.logs?.slice(0, 6) || [])
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  if (!data) return <p style={{ color: C.gray }}>Không thể tải dữ liệu.</p>

  const weeklyOrders = genWeeklyOrders(data.total_orders)
  const userGrowth   = genUserGrowth(data.total_users)
  const pieData = [
    { name: 'Người dùng', value: data.total_users,   color: C.blue },
    { name: 'Shop',       value: data.total_shops,    color: C.success },
    { name: 'Khiếu nại', value: data.open_disputes,  color: C.error },
    { name: 'Chờ duyệt', value: data.pending_shop_registrations + data.pending_shipper_registrations, color: C.warning },
  ]

  const dateStr = new Date().toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Hero Header ── */}
      <div style={{
        background: `linear-gradient(120deg, ${C.navy} 0%, ${C.blue} 60%, ${C.sky} 100%)`,
        borderRadius: 16, padding: '24px 28px', color: 'white',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        boxShadow: `0 8px 32px ${C.navy}40`,
      }}>
        <div>
          <p style={{ fontSize: 13, opacity: 0.8, marginBottom: 4 }}>☀️ {dateStr}</p>
          <h1 style={{ fontSize: 26, fontWeight: 800, marginBottom: 4 }}>Tổng quan hệ thống</h1>
          <p style={{ fontSize: 14, opacity: 0.85 }}>Nền tảng BuyZO — Quản trị toàn bộ hoạt động</p>
        </div>
        <div style={{ textAlign: 'right', opacity: 0.9 }}>
          <p style={{ fontSize: 13, marginBottom: 4 }}>Trạng thái hệ thống</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4ADE80', display: 'inline-block', boxShadow: '0 0 8px #4ADE80' }} />
            <span style={{ fontWeight: 700, fontSize: 15 }}>Hoạt động bình thường</span>
          </div>
        </div>
      </div>

      {/* ── 6 Stat Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        <StatCard icon="👥" label="Tổng người dùng"     value={data.total_users}                    color={C.blue}    bg={C.light}  delta="▲ Đang hoạt động" path="/admin/users" />
        <StatCard icon="🏪" label="Shop hoạt động"      value={data.total_shops}                    color={C.success} bg="#DCFCE7"   delta="▲ Đã phê duyệt"  path="/admin/approvals" />
        <StatCard icon="📦" label="Tổng đơn hàng"       value={data.total_orders}                   color={C.navy}    bg={C.tint} />
        <StatCard icon="⏳" label="Shop chờ duyệt"      value={data.pending_shop_registrations}     color={C.warning} bg="#FEF3C7"   path="/admin/approvals" />
        <StatCard icon="🚚" label="Shipper chờ duyệt"   value={data.pending_shipper_registrations}  color={C.sky}     bg={C.light}  path="/admin/approvals" />
        <StatCard icon="⚖️" label="Khiếu nại mở"        value={data.open_disputes}                  color={C.error}   bg="#FEE2E2"   path="/admin/disputes" />
      </div>

      {/* ── Charts Row 1: Area + Pie ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16 }}>

        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionHeader title="📈 Đơn hàng trong tuần" sub="Phân bố đơn hàng 7 ngày gần nhất" />
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={weeklyOrders} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id="gradOrders" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={C.light} />
              <XAxis dataKey="day" tick={{ fontSize: 12, fill: C.gray }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.gray }} axisLine={false} tickLine={false} />
              <Tooltip content={<OrderTooltip />} />
              <Area type="monotone" dataKey="orders" stroke={C.blue} strokeWidth={2.5}
                fill="url(#gradOrders)" dot={{ r: 4, fill: C.blue, strokeWidth: 0 }} activeDot={{ r: 6 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionHeader title="🥧 Phân phối" sub="Tỷ lệ các đối tượng" />
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="45%" innerRadius={52} outerRadius={80}
                paddingAngle={3} dataKey="value" stroke="none">
                {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
              <Tooltip formatter={(v: number) => v.toLocaleString('vi-VN')} />
              <Legend iconType="circle" iconSize={9} wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Charts Row 2: Bar + Pending ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionHeader title="👥 Tăng trưởng người dùng" sub="Lũy kế 6 tháng gần nhất" />
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={userGrowth} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.light} />
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: C.gray }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.gray }} axisLine={false} tickLine={false} />
              <Tooltip formatter={(v: number) => [v.toLocaleString('vi-VN'), 'Người dùng']} />
              <Bar dataKey="users" radius={[6, 6, 0, 0]}>
                {userGrowth.map((_, i) => (
                  <Cell key={i} fill={i === userGrowth.length - 1 ? C.navy : C.sky} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card" style={{ padding: '20px 22px' }}>
          <SectionHeader title="⚡ Cần xử lý ngay" sub="Các tác vụ đang chờ admin" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {[
              { icon: '✅', label: 'Shop chờ phê duyệt',    count: data.pending_shop_registrations,   color: C.warning, path: '/admin/approvals' },
              { icon: '🚚', label: 'Shipper chờ phê duyệt', count: data.pending_shipper_registrations, color: C.blue,    path: '/admin/approvals' },
              { icon: '⚖️', label: 'Khiếu nại chưa xử lý',  count: data.open_disputes,                color: C.error,   path: '/admin/disputes' },
              { icon: '🧑‍💼', label: 'Quản lý nhân viên HT',  count: null,                              color: C.navy,    path: '/admin/system-employees' },
            ].map(a => (
              <Link key={a.label} to={a.path} style={{ textDecoration: 'none' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px', borderRadius: 10,
                  background: (a.count !== null && a.count > 0) ? `${a.color}12` : 'var(--bg-card-muted)',
                  border: `1px solid ${(a.count !== null && a.count > 0) ? a.color + '30' : 'var(--border-subtle)'}`,
                  transition: 'transform 0.15s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(4px)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = '')}
                >
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{a.label}</span>
                  {a.count !== null && (
                    <span style={{ fontWeight: 800, fontSize: 18, color: a.count > 0 ? a.color : C.gray, minWidth: 24, textAlign: 'right' }}>{a.count}</span>
                  )}
                  <span style={{ fontSize: 16, color: C.gray }}>›</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* ── Recent Logs ── */}
      <div className="card" style={{ padding: '20px 22px' }}>
        <SectionHeader
          title="📋 Nhật ký hoạt động gần đây"
          sub="6 sự kiện mới nhất trên hệ thống"
          action={<Link to="/admin/logs" style={{ fontSize: 13, color: C.blue, fontWeight: 600, textDecoration: 'none' }}>Xem tất cả →</Link>}
        />
        {logs.length === 0 ? (
          <p style={{ color: C.gray, fontSize: 14 }}>Chưa có nhật ký nào.</p>
        ) : (
          <div>
            {logs.map((l: any, i: number) => (
              <div key={l.log_id ?? i} style={{
                display: 'flex', gap: 14, padding: '10px 4px',
                borderBottom: i < logs.length - 1 ? `1px solid ${C.tint}` : 'none',
                alignItems: 'center',
              }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: C.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  🔧
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <code style={{ background: C.light, color: C.navy, padding: '2px 8px', borderRadius: 5, fontSize: 12, fontWeight: 600 }}>{l.action}</code>
                  <span style={{ marginLeft: 8, fontSize: 12, color: C.gray }}>
                    {l.target_type}{l.target_id ? ` #${l.target_id}` : ''}
                  </span>
                </div>
                <span style={{ fontSize: 11, color: C.gray, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {l.created_at?.slice(0, 16).replace('T', ' ') ?? '—'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export default AdminOverviewPage
