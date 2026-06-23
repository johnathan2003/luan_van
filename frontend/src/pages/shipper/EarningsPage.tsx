import React, { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts'

const C = {
  amber: '#D97706', gold: '#F59E0B', light: '#FEF3C7', tint: '#FFFBEB',
  navy: '#1E3A8A', blue: '#1D4ED8', gray: '#64748B',
  success: '#16A34A', error: '#DC2626',
}

const MOCK_MONTHLY = [
  { month: 'T1', income: 3200000, deliveries: 42 },
  { month: 'T2', income: 2800000, deliveries: 37 },
  { month: 'T3', income: 4100000, deliveries: 55 },
  { month: 'T4', income: 3700000, deliveries: 49 },
  { month: 'T5', income: 5200000, deliveries: 68 },
  { month: 'T6', income: 4800000, deliveries: 63 },
]

const MOCK_TRANSACTIONS = [
  { txn_id: 1,  date: '2026-06-14', order_id: 2031, type: 'delivery_fee', amount: 35000,  status: 'paid',   note: 'Giao hàng thành công' },
  { txn_id: 2,  date: '2026-06-14', order_id: 2030, type: 'delivery_fee', amount: 28000,  status: 'paid',   note: 'Giao hàng thành công' },
  { txn_id: 3,  date: '2026-06-13', order_id: 2027, type: 'bonus',        amount: 50000,  status: 'paid',   note: 'Thưởng hoàn thành 60 đơn/tuần' },
  { txn_id: 4,  date: '2026-06-13', order_id: 2025, type: 'delivery_fee', amount: 30000,  status: 'paid',   note: 'Giao hàng thành công' },
  { txn_id: 5,  date: '2026-06-12', order_id: 2022, type: 'delivery_fee', amount: 32000,  status: 'paid',   note: 'Giao hàng thành công' },
  { txn_id: 6,  date: '2026-06-12', order_id: 2019, type: 'penalty',      amount: -20000, status: 'paid',   note: 'Phạt giao trễ > 2h' },
  { txn_id: 7,  date: '2026-06-11', order_id: 2015, type: 'delivery_fee', amount: 40000,  status: 'paid',   note: 'Giao hàng thành công' },
  { txn_id: 8,  date: '2026-06-10', order_id: 2010, type: 'withdrawal',   amount: -500000,status: 'paid',   note: 'Rút tiền về ngân hàng' },
  { txn_id: 9,  date: '2026-06-09', order_id: 2008, type: 'delivery_fee', amount: 27000,  status: 'pending',note: 'Đang xử lý' },
  { txn_id: 10, date: '2026-06-08', order_id: 2003, type: 'bonus',        amount: 100000, status: 'paid',   note: 'Thưởng đánh giá 5 sao' },
]

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  delivery_fee: { label: 'Phí giao hàng', color: C.success, bg: '#DCFCE7' },
  bonus:        { label: 'Thưởng',         color: C.blue,    bg: '#DBEAFE' },
  penalty:      { label: 'Phạt',           color: C.error,   bg: '#FEE2E2' },
  withdrawal:   { label: 'Rút tiền',       color: C.amber,   bg: C.light   },
}

const fmt = (n: number) => Math.abs(n).toLocaleString('vi-VN') + '₫'

const EarningsPage: React.FC = () => {
  const [transactions, setTransactions] = useState(MOCK_TRANSACTIONS)
  const [monthly, setMonthly]           = useState(MOCK_MONTHLY)
  const [period, setPeriod]             = useState<'week'|'month'|'all'>('month')

  useEffect(() => {
    // Gọi API khi có, fallback về mock
    // shipmentService.getEarnings().then(r => ...).catch(() => {})
  }, [])

  const totalIncome  = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0)
  const totalPenalty = transactions.filter(t => t.type === 'penalty').reduce((s, t) => s + Math.abs(t.amount), 0)
  const withdrawn    = transactions.filter(t => t.type === 'withdrawal').reduce((s, t) => s + Math.abs(t.amount), 0)
  const balance      = totalIncome - totalPenalty - withdrawn

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.amber, margin: 0 }}>💰 Thu nhập</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>Thống kê thu nhập và giao dịch của bạn</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Số dư hiện tại',  value: fmt(balance),      color: C.amber,   big: true },
          { label: 'Tổng thu nhập',   value: fmt(totalIncome),  color: C.success, big: false },
          { label: 'Tổng bị phạt',    value: fmt(totalPenalty), color: C.error,   big: false },
          { label: 'Đã rút',          value: fmt(withdrawn),    color: C.blue,    big: false },
        ].map(s => (
          <div key={s.label} style={{ background: s.big ? `linear-gradient(135deg,${C.amber},${C.gold})` : 'var(--bg-card)', borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderLeft: s.big ? 'none' : `3px solid ${s.color}` }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: s.big ? 'rgba(255,255,255,0.8)' : C.gray, textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: s.big ? 22 : 18, fontWeight: 800, color: s.big ? 'white' : s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: C.navy, margin: 0 }}>📈 Thu nhập theo tháng</h3>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['week','month','all'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '5px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: period === p ? C.amber : C.tint, color: period === p ? 'white' : C.gray,
              }}>
                {p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Tất cả'}
              </button>
            ))}
          </div>
        </div>
        <ResponsiveContainer width="100%" height={220}>
          <AreaChart data={monthly}>
            <defs>
              <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={C.amber} stopOpacity={0.3}/>
                <stop offset="95%" stopColor={C.amber} stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
            <XAxis dataKey="month" tick={{ fontSize: 12 }}/>
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v/1000000).toFixed(1)+'M'}/>
            <Tooltip formatter={(v: number) => [fmt(v), 'Thu nhập']}/>
            <Area type="monotone" dataKey="income" stroke={C.amber} fill="url(#incomeGrad)" strokeWidth={2}/>
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Transaction table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.tint}` }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: C.navy, margin: 0 }}>📋 Lịch sử giao dịch</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Ngày', 'Đơn hàng', 'Loại', 'Ghi chú', 'Số tiền', 'Trạng thái'].map(h => (
                <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {transactions.map(t => {
              const meta = TYPE_META[t.type] ?? TYPE_META.delivery_fee
              return (
                <tr key={t.txn_id} style={{ borderBottom: `1px solid ${C.tint}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#FFFBEB')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.gray }}>{t.date}</td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.navy, fontWeight: 500 }}>#{t.order_id}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: meta.bg, color: meta.color }}>{meta.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 13, color: C.gray }}>{t.note}</td>
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: t.amount >= 0 ? C.success : C.error }}>
                    {t.amount >= 0 ? '+' : '-'}{fmt(t.amount)}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.status === 'paid' ? C.success : C.amber }}>
                      {t.status === 'paid' ? '✓ Hoàn tất' : '⏳ Đang xử lý'}
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

export default EarningsPage
