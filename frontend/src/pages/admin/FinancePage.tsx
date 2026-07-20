/**
 * 💰 Finance Admin — Tài chính hệ thống
 * Nhóm 6: doanh thu nền tảng, lịch sử giao dịch, xuất báo cáo
 */
import React, { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { adminService } from '../../services/adminService'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const fmt = (n: number) => n.toLocaleString('vi-VN') + '₫'

const monthLabel = (period: string) => {
  // "2026-06" → "T6"
  const m = parseInt((period || '').split('-')[1] || '0', 10)
  return m ? `T${m}` : period
}

const TXN_TYPE: Record<string, { label: string; color: string; bg: string }> = {
  commission: { label: 'Hoa hồng',   color: C.success, bg: '#DCFCE7' },
  refund:     { label: 'Hoàn tiền',  color: C.error,   bg: '#FEE2E2' },
  payout:     { label: 'Thanh toán', color: C.warning, bg: '#FEF3C7' },
  adjustment: { label: 'Điều chỉnh', color: C.gray,    bg: '#F1F5F9' },
}

const FinancePage: React.FC = () => {
  const [monthly, setMonthly]         = useState<any[]>([])
  const [shopRevenue, setShopRevenue] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [period, setPeriod]           = useState<'week' | 'month' | 'year'>('month')

  useEffect(() => {
    const load = async () => {
      try {
        const [revRes, shopRes] = await Promise.all([
          adminService.getRevenueMonthly(6),
          adminService.getShopRevenueSummary(20),
        ])
        const raw = revRes.data?.monthly ?? revRes.data ?? []
        setMonthly(raw.map((r: any) => ({ ...r, month: monthLabel(r.period) })))
        setShopRevenue(shopRes.data?.shops ?? [])
      } catch {
        setMonthly([])
        setShopRevenue([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const total  = monthly.reduce((s, d) => s + (d.revenue || 0), 0)
  const comm   = monthly.reduce((s, d) => s + (d.commission || 0), 0)
  const totalO = monthly.reduce((s, d) => s + (d.orders || 0), 0)
  const avg    = totalO > 0 ? Math.round(total / totalO) : 0

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>

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
          { label: 'Hoa hồng nền tảng',value: fmt(comm),  sub: total > 0 ? `~${Math.round(comm/total*100)}% GMV` : '10% GMV', color: C.success, bg: '#DCFCE7' },
          { label: 'Tổng đơn hàng',    value: totalO,     sub: 'Trong kỳ',                color: '#7C3AED', bg: '#EDE9FE' },
          { label: 'Giá trị TB/đơn',   value: fmt(avg),   sub: 'Average order value',      color: C.warning, bg: '#FEF3C7' },
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
          {monthly.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>
              Chưa có dữ liệu doanh thu
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={monthly}>
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
          )}
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <span style={{ fontSize: 11, color: C.gray }}>— Doanh thu</span>
            <span style={{ fontSize: 11, color: C.gray }}>--- Hoa hồng</span>
          </div>
        </div>

        {/* Orders bar */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>📦 Đơn hàng / tháng</h3>
          {monthly.length === 0 ? (
            <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>
              Chưa có dữ liệu
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={monthly} barSize={22}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="orders" fill={C.sky} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Shop revenue summary */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.light}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>🏪 Doanh thu theo shop</h3>
            <p style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>Tổng kết từ đơn hàng hoàn thành · Admin nhận 25% (15% + VAT 10%) · Shipper 5% · Shop 70%</p>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['#', 'Tên shop', 'Doanh thu (GMV)', 'Shop (70%)', 'Phí sàn (25%)'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy, whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shopRevenue.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Chưa có dữ liệu doanh thu theo shop</td></tr>
            ) : shopRevenue.map((s, idx) => {
              const totalRev    = Math.round(s.total_revenue || 0)
              const adminIncome = Math.round((s.admin_fee || 0) + (s.vat_fee || 0))   // 15% + 10% = 25%
              const admin       = Math.round(s.admin_fee   || 0)
              const vat         = Math.round(s.vat_fee     || 0)
              const shipper     = Math.round(s.shipper_fee || 0)
              const profit      = Math.round(s.shop_profit || 0)
              return (
                <tr key={s.shop_id} style={{ borderBottom: `1px solid ${C.tint}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  {/* Rank */}
                  <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 700, color: idx < 3 ? C.warning : C.gray }}>
                    {idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`}
                  </td>
                  {/* Tên shop */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: C.navy }}>{s.shop_name}</div>
                    <div style={{ fontSize: 11, color: C.gray }}>ID: {s.shop_id}</div>
                  </td>
                  {/* Doanh thu */}
                  <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: C.blue }}>
                    {fmt(totalRev)}
                  </td>
                  {/* Shop 70% */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: '#7C3AED' }}>+{fmt(profit)}</div>
                    <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>70% doanh thu</div>
                  </td>
                  {/* Admin nhận 25% */}
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ fontWeight: 800, fontSize: 14, color: C.success }}>+{fmt(adminIncome)}</div>
                    <div style={{ fontSize: 10, color: C.gray, marginTop: 2 }}>
                      <span title="Phí admin 15%">🏢 {fmt(admin)}</span>
                      {' · '}
                      <span title="VAT 10%">🧾 {fmt(vat)}</span>
                    </div>
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
