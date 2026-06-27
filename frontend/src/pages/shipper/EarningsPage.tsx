import React, { useEffect, useState } from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { shipmentService } from '../../services/shipmentService'

const C = {
  amber: '#D97706', gold: '#F59E0B', light: '#FEF3C7', tint: '#FFFBEB',
  navy: '#1E3A8A', blue: '#1D4ED8', gray: '#64748B',
  success: '#16A34A', error: '#DC2626',
}

const TYPE_META: Record<string, { label: string; color: string; bg: string }> = {
  delivery_fee: { label: 'Phí giao hàng', color: C.success, bg: '#DCFCE7' },
  bonus:        { label: 'Thưởng',         color: C.blue,    bg: '#DBEAFE' },
  adjustment:   { label: 'Điều chỉnh',    color: C.amber,   bg: C.light   },
  refund:       { label: 'Hoàn tiền',     color: '#7C3AED', bg: '#EDE9FE' },
}

const STATUS_META: Record<string, { label: string; color: string }> = {
  completed: { label: '✓ Hoàn tất',    color: C.success },
  pending:   { label: '⏳ Đang xử lý', color: C.amber   },
  cancelled: { label: '✕ Đã hủy',      color: C.error   },
}

const fmt = (n: number) => Math.abs(n).toLocaleString('vi-VN') + '₫'

function monthLabel(iso: string) {
  // "2026-06" → "T6"
  const parts = iso.split('-')
  return `T${parseInt(parts[1] ?? '1', 10)}`
}

const EarningsPage: React.FC = () => {
  const [transactions, setTransactions] = useState<any[]>([])
  const [monthly, setMonthly]           = useState<any[]>([])
  const [balance, setBalance]           = useState<{ balance: number; total_earned: number; total_withdrawn: number } | null>(null)
  const [loading, setLoading]           = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      shipmentService.getMyTransactions({ limit: 50 }),
      shipmentService.getMyMonthlyEarnings(6),
      shipmentService.getMyBalance(),
    ])
      .then(([txnRes, monthlyRes, balRes]) => {
        const txns = txnRes.data?.transactions ?? txnRes.data
        if (Array.isArray(txns)) setTransactions(txns)

        const months = monthlyRes.data?.monthly ?? monthlyRes.data
        if (Array.isArray(months)) {
          setMonthly(months.map((m: any) => ({
            month:      monthLabel(m.month),
            income:     m.total,
            deliveries: m.count,
          })))
        }

        const bal = balRes.data
        if (bal) setBalance({ balance: bal.balance, total_earned: bal.total_earned, total_withdrawn: bal.total_withdrawn })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const kpis = [
    { label: 'Số dư hiện tại', value: fmt(balance?.balance ?? 0),        color: C.amber,   big: true  },
    { label: 'Tổng thu nhập',  value: fmt(balance?.total_earned ?? 0),   color: C.success, big: false },
    { label: 'Đã rút',         value: fmt(balance?.total_withdrawn ?? 0), color: C.blue,    big: false },
    { label: 'Giao dịch',      value: String(transactions.length),        color: C.navy,    big: false },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.amber, margin: 0 }}>💰 Thu nhập</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>Thống kê thu nhập và giao dịch của bạn</p>
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {kpis.map(s => (
          <div key={s.label} style={{
            background: s.big ? `linear-gradient(135deg,${C.amber},${C.gold})` : 'var(--bg-card)',
            borderRadius: 14, padding: '16px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            borderLeft: s.big ? 'none' : `3px solid ${s.color}`,
          }}>
            <p style={{ fontSize: 11, fontWeight: 600, color: s.big ? 'rgba(255,255,255,0.8)' : C.gray, textTransform: 'uppercase', marginBottom: 6 }}>{s.label}</p>
            <p style={{ fontSize: s.big ? 22 : 18, fontWeight: 800, color: s.big ? 'white' : s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '20px 24px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <h3 style={{ fontWeight: 700, fontSize: 15, color: C.navy, margin: '0 0 16px' }}>📈 Thu nhập theo tháng</h3>
        {monthly.length === 0 ? (
          <div style={{ height: 220, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>
            {loading ? 'Đang tải...' : 'Chưa có dữ liệu'}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={monthly}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.amber} stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.amber} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9"/>
              <XAxis dataKey="month" tick={{ fontSize: 12 }}/>
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => (v / 1000000).toFixed(1) + 'M'}/>
              <Tooltip formatter={(v: number) => [fmt(v), 'Thu nhập']}/>
              <Area type="monotone" dataKey="income" stroke={C.amber} fill="url(#incomeGrad)" strokeWidth={2}/>
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Transaction table */}
      <div style={{ background: 'var(--bg-card)', borderRadius: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.tint}` }}>
          <h3 style={{ fontWeight: 700, fontSize: 15, color: C.navy, margin: 0 }}>📋 Lịch sử giao dịch</h3>
        </div>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>
        ) : transactions.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Chưa có giao dịch nào</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: C.tint }}>
                {['Ngày', 'Đơn hàng', 'Loại', 'Ghi chú', 'Số tiền', 'Trạng thái'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {transactions.map((t: any) => {
                const meta   = TYPE_META[t.type] ?? { label: t.type, color: C.gray, bg: '#F1F5F9' }
                const status = STATUS_META[t.status] ?? STATUS_META.pending
                const date   = t.created_at ? String(t.created_at).slice(0, 10) : '—'
                return (
                  <tr key={t.txn_id} style={{ borderBottom: `1px solid ${C.tint}` }}
                    onMouseEnter={e => (e.currentTarget.style.background = '#FFFBEB')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: C.gray }}>{date}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.navy, fontWeight: 500 }}>
                      {t.order_id ? `#${t.order_id}` : '—'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 20, background: meta.bg, color: meta.color }}>{meta.label}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: C.gray }}>{t.note ?? '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: t.amount >= 0 ? C.success : C.error }}>
                      {t.amount >= 0 ? '+' : '-'}{fmt(t.amount)}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: status.color }}>{status.label}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

export default EarningsPage
