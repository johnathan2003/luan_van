/**
 * 📈 Reports Admin — Báo cáo tổng hợp
 * Nhóm 3B: user-growth, top-products, order-status, voucher-usage — API thật
 */
import React, { useState, useEffect } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { adminService } from '../../services/adminService'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626', purple: '#7C3AED' }

const TABS = [
  { key: 'users',      label: '👥 Người dùng'  },
  { key: 'products',   label: '🏷️ Sản phẩm'    },
  { key: 'operations', label: '⚙️ Vận hành'     },
  { key: 'marketing',  label: '📣 Marketing'    },
]

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color: string }> = ({ label, value, sub, color }) => (
  <div className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${color}` }}>
    <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
    <p style={{ fontSize: 22, fontWeight: 800, color, marginTop: 4 }}>{value}</p>
    {sub && <p style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{sub}</p>}
  </div>
)

const Empty: React.FC<{ msg?: string }> = ({ msg = 'Chưa có dữ liệu' }) => (
  <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.gray, fontSize: 13 }}>{msg}</div>
)

const ReportsPage: React.FC = () => {
  const [tab, setTab]           = useState('users')
  const [period, setPeriod]     = useState<'week' | 'month' | 'year'>('month')
  const [loading, setLoading]   = useState(true)

  // Data states
  const [growth, setGrowth]         = useState<any[]>([])
  const [topProducts, setTopProducts] = useState<any[]>([])
  const [orderStatus, setOrderStatus] = useState<any[]>([])
  const [vouchers, setVouchers]     = useState<any[]>([])

  // Fetch all on mount (parallel)
  useEffect(() => {
    Promise.all([
      adminService.getReportUserGrowth(6),
      adminService.getReportTopProducts(5),
      adminService.getReportOrderStatus(),
      adminService.getReportVoucherUsage(10),
    ])
      .then(([gRes, pRes, oRes, vRes]) => {
        setGrowth(gRes.data?.growth ?? [])
        setTopProducts(pRes.data?.top_products ?? [])
        setOrderStatus(oRes.data?.order_status ?? [])
        setVouchers(vRes.data?.vouchers ?? [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // Derived user stats
  const totalNew    = growth.reduce((s, d) => s + (d.new || 0), 0)
  const totalActive = growth.reduce((s, d) => s + (d.active || 0), 0)
  const lastNew     = growth[growth.length - 1]?.new ?? 0

  // Derived order stats
  const totalOrders  = orderStatus.reduce((s, d) => s + (d.value || 0), 0)
  const completedPct = totalOrders > 0
    ? Math.round((orderStatus.filter(d => ['delivered','completed'].includes(d.status)).reduce((s,d)=>s+(d.value||0),0) / totalOrders) * 100)
    : 0
  const cancelledPct = totalOrders > 0
    ? Math.round((orderStatus.find(d=>d.status==='cancelled')?.value||0) / totalOrders * 100)
    : 0

  // Derived voucher stats
  const totalVoucherUses     = vouchers.reduce((s,v)=>s+(v.uses||0),0)
  const topVoucher           = topProducts[0]?.name ?? '—'
  const topVoucherSales      = topProducts[0]?.sales ?? 0

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: C.gray }}>Đang tải...</div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📈 Báo cáo & Phân tích</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Tổng hợp số liệu vận hành nền tảng BuyZO</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ display: 'flex', gap: 4, background: C.tint, padding: 4, borderRadius: 9 }}>
            {(['week','month','year'] as const).map(p => (
              <button key={p} onClick={() => setPeriod(p)} style={{
                padding: '6px 14px', borderRadius: 7, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                background: period === p ? C.blue : 'transparent', color: period === p ? 'white' : C.gray,
              }}>{p === 'week' ? 'Tuần' : p === 'month' ? 'Tháng' : 'Năm'}</button>
            ))}
          </div>
          <button onClick={() => alert('Đang xuất PDF...')}
            style={{ padding: '8px 18px', background: C.error, color: 'white', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            📄 Xuất PDF
          </button>
          <button onClick={() => alert('Đang xuất Excel...')}
            style={{ padding: '8px 18px', background: C.success, color: 'white', border: 'none', borderRadius: 9, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
            📊 Xuất Excel
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="card" style={{ padding: '12px 18px', display: 'flex', gap: 6 }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === t.key ? C.navy : C.tint, color: tab === t.key ? 'white' : C.gray,
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── Users ── */}
      {tab === 'users' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="ND mới (6 tháng)"  value={totalNew.toLocaleString('vi-VN')}   sub="Đăng ký thành công" color={C.blue} />
            <StatCard label="ND mới tháng gần nhất" value={lastNew}                        sub="Người dùng mới"     color={C.success} />
            <StatCard label="Đặt hàng (6 tháng)" value={totalActive.toLocaleString('vi-VN')} sub="Unique buyers"    color={C.purple} />
            <StatCard label="Dữ liệu thu thập"   value={`${growth.length} tháng`}          sub="Từ DB thực tế"      color={C.warning} />
          </div>
          <div className="card" style={{ padding: '18px 20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Tăng trưởng người dùng</h3>
            {growth.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={growth}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="new"    stroke={C.blue}    strokeWidth={2} dot={{ r: 3 }} name="ND mới" />
                  <Line type="monotone" dataKey="active" stroke={C.success} strokeWidth={2} dot={{ r: 3 }} name="Buyers" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Products ── */}
      {tab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="SP bán chạy nhất" value={topVoucher.length > 20 ? topVoucher.slice(0,20)+'…' : topVoucher} sub={`${topVoucherSales} đơn`} color={C.blue} />
            <StatCard label="Tổng SP có đơn"   value={topProducts.length}   sub="Trong dữ liệu"     color={C.success} />
            <StatCard label="Tổng đơn SP"       value={topProducts.reduce((s,p)=>s+(p.sales||0),0).toLocaleString('vi-VN')} sub="Tất cả SP" color={C.purple} />
            <StatCard label="Doanh thu SP"      value={`${Math.round(topProducts.reduce((s,p)=>s+(p.revenue||0),0)/1e6)}M₫`} sub="Tổng cộng" color={C.warning} />
          </div>
          <div className="card" style={{ padding: '18px 20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Top sản phẩm bán chạy</h3>
            {topProducts.length === 0 ? <Empty /> : (
              <ResponsiveContainer width="100%" height={Math.max(200, topProducts.length * 44)}>
                <BarChart data={topProducts} layout="vertical" barSize={18}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" width={200} tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString('vi-VN')} đơn`} />
                  <Bar dataKey="sales" fill={C.blue} radius={[0, 4, 4, 0]} name="Số đơn" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      {/* ── Operations ── */}
      {tab === 'operations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Tổng đơn hàng"      value={totalOrders.toLocaleString('vi-VN')} sub="Toàn bộ đơn"       color={C.blue} />
            <StatCard label="Tỷ lệ hoàn thành"   value={`${completedPct}%`}                  sub="delivered+completed" color={C.success} />
            <StatCard label="Tỷ lệ hủy"          value={`${cancelledPct}%`}                  sub="Cần cải thiện"       color={C.error} />
            <StatCard label="Trạng thái khác nhau" value={orderStatus.length}                sub="Loại trạng thái"     color={C.warning} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Phân bố trạng thái đơn hàng</h3>
              {orderStatus.length === 0 ? <Empty /> : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={orderStatus} cx="50%" cy="50%" outerRadius={80} dataKey="value"
                      label={({ name, value }) => `${name} (${value})`} labelLine={false}>
                      {orderStatus.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="card" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Chi tiết trạng thái</h3>
              {orderStatus.map(d => (
                <div key={d.status} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: `1px solid ${C.tint}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                    <span style={{ fontSize: 13, color: C.gray }}>{d.name}</span>
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: d.color }}>{d.value.toLocaleString('vi-VN')} đơn</span>
                </div>
              ))}
              {orderStatus.length === 0 && <p style={{ color: C.gray, fontSize: 13 }}>Chưa có dữ liệu</p>}
            </div>
          </div>
        </div>
      )}

      {/* ── Marketing ── */}
      {tab === 'marketing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Voucher đã dùng"   value={vouchers.length}                    sub="Có lượt dùng > 0"   color={C.blue} />
            <StatCard label="Tổng lượt dùng"    value={totalVoucherUses.toLocaleString('vi-VN')} sub="Tất cả voucher" color={C.success} />
            <StatCard label="Voucher top 1"     value={vouchers[0]?.code ?? '—'}           sub={`${vouchers[0]?.uses ?? 0} lượt`} color={C.purple} />
            <StatCard label="Tổng giảm giá"     value={`${Math.round(vouchers.reduce((s,v)=>s+(v.discount||0),0)/1e6)}M₫`} sub="Fixed discount" color={C.error} />
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.light}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Hiệu quả voucher</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.tint }}>
                  {['Mã voucher', 'Lượt sử dụng', 'Loại giảm', 'Giá trị', 'Tổng giảm', 'Hiệu quả'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Chưa có voucher nào được sử dụng</td></tr>
                ) : vouchers.map(v => {
                  const maxUses = vouchers[0]?.uses || 1
                  return (
                    <tr key={v.voucher_id} style={{ borderBottom: `1px solid ${C.tint}` }}
                      onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                      <td style={{ padding: '12px 16px' }}><code style={{ background: C.light, color: C.navy, padding: '3px 9px', borderRadius: 6, fontWeight: 700 }}>{v.code}</code></td>
                      <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: C.navy }}>{(v.uses||0).toLocaleString('vi-VN')}</td>
                      <td style={{ padding: '12px 16px', fontSize: 12, color: C.gray }}>{v.discount_type === 'fixed' ? 'Cố định' : 'Phần trăm'}</td>
                      <td style={{ padding: '12px 16px', fontSize: 13, color: C.blue }}>
                        {v.discount_type === 'fixed'
                          ? `${(v.discount_value||0).toLocaleString('vi-VN')}₫`
                          : `${v.discount_value}%`}
                      </td>
                      <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 600, color: C.error }}>
                        {v.discount_type === 'fixed' ? `${(v.discount||0).toLocaleString('vi-VN')}₫` : '—'}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ height: 8, background: C.tint, borderRadius: 4, overflow: 'hidden', width: 100 }}>
                          <div style={{ height: '100%', width: `${Math.min(100, ((v.uses||0) / maxUses) * 100)}%`, background: C.blue, borderRadius: 4 }} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
