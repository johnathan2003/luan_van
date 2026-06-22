/**
 * 💰 Finance Admin — Tài chính hệ thống
 * Nhóm 6: doanh thu nền tảng, lịch sử giao dịch, xuất báo cáo
 */
import React, { useState } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const fmt = (n: number) => n.toLocaleString('vi-VN') + '₫'

const REVENUE_DATA = [
  { month: 'T1', revenue: 42000000, commission: 4200000, orders: 380 },
  { month: 'T2', revenue: 38000000, commission: 3800000, orders: 310 },
  { month: 'T3', revenue: 55000000, commission: 5500000, orders: 490 },
  { month: 'T4', revenue: 62000000, commission: 6200000, orders: 540 },
  { month: 'T5', revenue: 78000000, commission: 7800000, orders: 670 },
  { month: 'T6', revenue: 91000000, commission: 9100000, orders: 800 },
]

const MOCK_TXN = [
  { id:'TXN-001', type:'commission', amount:320000,   shop:'TechWorld Store', order:'ORD-001', created_at:'2025-06-14 09:00', status:'completed' },
  { id:'TXN-002', type:'refund',     amount:-180000,  shop:'FashionVN',       order:'ORD-088', created_at:'2025-06-13 15:30', status:'completed' },
  { id:'TXN-003', type:'commission', amount:450000,   shop:'BookStore360',    order:'ORD-103', created_at:'2025-06-13 11:00', status:'completed' },
  { id:'TXN-004', type:'commission', amount:200000,   shop:'TechWorld Store', order:'ORD-105', created_at:'2025-06-12 08:45', status:'pending'   },
  { id:'TXN-005', type:'payout',     amount:-2000000, shop:'FashionVN',       order:'—',       created_at:'2025-06-11 17:00', status:'completed' },
]

const TXN_TYPE: Record<string, { label: string; color: string; bg: string }> = {
  commission: { label: 'Hoa hồng',  color: C.success, bg: '#DCFCE7' },
  refund:     { label: 'Hoàn tiền', color: C.error,   bg: '#FEE2E2' },
  payout:     { label: 'Thanh toán',color: C.warning, bg: '#FEF3C7' },
}

const FinancePage: React.FC = () => {
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')

  const total = REVENUE_DATA.reduce((s, d) => s + d.revenue, 0)
  const comm  = REVENUE_DATA.reduce((s, d) => s + d.commission, 0)
  const totalO = REVENUE_DATA.reduce((s, d) => s + d.orders, 0)
  const avg   = Math.round(total / totalO)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>💰 Tài chính hệ thống</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Theo dõi doanh thu nền tảng và lịch sử giao dịch</p>
        </div>
        <button onClick={() => alert('Đang xuất báo cáo Excel...')}
          style={{ padding: '10px 20px', background: C.success, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
          📥 Xuất Excel
        </button>
      </div>

      {/* KPI stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng GMV',         value: fmt(total), sub: 'Tổng giá trị giao dịch', color: C.blue,    bg: C.light },
          { label: 'Hoa hồng nền tảng',value: fmt(comm),  sub: `~${Math.round(comm/total*100)}% GMV`,       color: C.success, bg: '#DCFCE7' },
          { label: 'Tổng đơn hàng',    value: totalO,     sub: 'Trong kỳ',                                  color: '#7C3AED', bg: '#EDE9FE' },
          { label: 'Giá trị TB/đơn',   value: fmt(avg),   sub: 'Average order value',                       color: C.warning, bg: '#FEF3C7' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '16px 18px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.value}</p>
            <p style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{s.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
        {/* Revenue area */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>📈 Doanh thu theo tháng</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['week','month','year'] as const).map(p => (
                <button key={p} onClick={() => setPeriod(p)} style={{
                  padding: '4px 12px', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 600,
                  background: period === p ? C.blue : C.tint, color: period === p ? 'white' : C.gray,
                }}>{p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm'}</button>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={REVENUE_DATA}>
              <defs>
                <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={C.blue} stopOpacity={0.2}/>
                  <stop offset="95%" stopColor={C.blue} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v/1e6).toFixed(0)}M`} />
              <Tooltip formatter={(v: number) => fmt(v)} />
              <Area type="monotone" dataKey="revenue" stroke={C.blue} fill="url(#rev)" strokeWidth={2} />
              <Area type="monotone" dataKey="commission" stroke={C.success} fill="none" strokeWidth={2} strokeDasharray="4 2" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <span style={{ fontSize: 11, color: C.gray }}>— Doanh thu</span>
            <span style={{ fontSize: 11, color: C.gray }}>--- Hoa hồng</span>
          </div>
        </div>

        {/* Orders bar */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>📦 Đơn hàng / tháng</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={REVENUE_DATA} barSize={22}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="orders" fill={C.sky} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Transaction table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.light}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Lịch sử giao dịch</h3>
          <button onClick={() => alert('Xuất giao dịch...')} style={{ padding: '6px 14px', background: C.tint, color: C.blue, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>Xuất CSV</button>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Mã TXN', 'Loại', 'Shop', 'Đơn hàng', 'Số tiền', 'Thời gian', 'Trạng thái'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MOCK_TXN.map(t => {
              const tp = TXN_TYPE[t.type] ?? { label: t.type, color: C.gray, bg: '#F1F5F9' }
              return (
                <tr key={t.id} style={{ borderBottom: `1px solid ${C.tint}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: C.blue }}>{t.id}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tp.bg, color: tp.color }}>{tp.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13 }}>{t.shop}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.gray }}>{t.order}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: t.amount >= 0 ? C.success : C.error }}>
                    {t.amount >= 0 ? '+' : ''}{fmt(t.amount)}
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.gray }}>{t.created_at}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, background: t.status === 'completed' ? '#DCFCE7' : '#FEF3C7', color: t.status === 'completed' ? C.success : C.warning, fontWeight: 700 }}>
                      {t.status === 'completed' ? 'Hoàn thành' : 'Đang xử lý'}
                    </span>
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

export default FinancePage
