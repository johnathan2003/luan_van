/**
 * 📈 Reports Admin — Báo cáo tổng hợp
 * Nhóm 9: báo cáo người dùng, sản phẩm, vận hành, marketing + xuất
 */
import React, { useState } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', sky: '#3B82F6', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626', purple: '#7C3AED' }

const TABS = [
  { key: 'users',     label: '👥 Người dùng',  icon: '👥' },
  { key: 'products',  label: '🏷️ Sản phẩm',   icon: '🏷️' },
  { key: 'operations',label: '⚙️ Vận hành',    icon: '⚙️' },
  { key: 'marketing', label: '📣 Marketing',   icon: '📣' },
]

// --- Mock data ---
const USER_GROWTH = [
  { month:'T1', new:120, active:950, churned:15 },
  { month:'T2', new:145, active:1020, churned:20 },
  { month:'T3', new:190, active:1150, churned:18 },
  { month:'T4', new:220, active:1300, churned:22 },
  { month:'T5', new:280, active:1520, churned:30 },
  { month:'T6', new:310, active:1780, churned:28 },
]

const TOP_PRODUCTS = [
  { name:'Tai nghe Sony WH-1000XM5', sales:340, revenue:2210000000 },
  { name:'Cáp USB-C 100W',           sales:1200, revenue:60000000 },
  { name:'Áo thun Oversize Limited',  sales:430, revenue:120400000 },
  { name:'Clean Code (sách)',         sales:280, revenue:50400000 },
  { name:'Giày Nike Air Max',         sales:190, revenue:285000000 },
]

const ORDER_STATUS_DATA = [
  { name:'Hoàn thành', value:68, color:'#16A34A' },
  { name:'Đang giao',  value:15, color:'#3B82F6' },
  { name:'Đang xử lý',value:10, color:'#D97706' },
  { name:'Đã hủy',     value:7,  color:'#DC2626' },
]

const VOUCHER_USAGE = [
  { code:'WELCOME10', uses:420, discount:84000000 },
  { code:'SALE50K',   uses:128, discount:6400000  },
  { code:'NEWSHOP20', uses:85,  discount:23800000 },
]

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color: string }> = ({ label, value, sub, color }) => (
  <div className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${color}` }}>
    <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{label}</p>
    <p style={{ fontSize: 24, fontWeight: 800, color, marginTop: 4 }}>{value}</p>
    {sub && <p style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{sub}</p>}
  </div>
)

const ReportsPage: React.FC = () => {
  const [tab, setTab] = useState('users')
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month')

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
          <button onClick={() => alert('Đang xuất báo cáo PDF...')}
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
            <StatCard label="Tổng ND"       value="1,780"  sub="Tính đến hiện tại" color={C.blue} />
            <StatCard label="ND mới (tháng)" value="310"   sub="+12% so tháng trước" color={C.success} />
            <StatCard label="ND hoạt động"  value="1,240" sub="Có đơn trong 30 ngày" color={C.purple} />
            <StatCard label="Tỷ lệ rời bỏ" value="1.8%"  sub="Churn rate tháng này" color={C.warning} />
          </div>
          <div className="card" style={{ padding: '18px 20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Tăng trưởng người dùng</h3>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={USER_GROWTH}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="new"    stroke={C.blue}    strokeWidth={2} dot={{ r: 3 }} name="ND mới" />
                <Line type="monotone" dataKey="active" stroke={C.success} strokeWidth={2} dot={{ r: 3 }} name="ND hoạt động" />
                <Line type="monotone" dataKey="churned"stroke={C.error}   strokeWidth={2} dot={{ r: 3 }} name="Rời bỏ" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Products ── */}
      {tab === 'products' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Tổng SP"         value="4,210"  sub="Đang bán" color={C.blue} />
            <StatCard label="SP mới (tháng)"  value="132"    sub="+8% so tháng trước" color={C.success} />
            <StatCard label="SP bị ẩn"        value="47"     sub="Chờ xử lý" color={C.warning} />
            <StatCard label="SP bán chạy nhất" value="Sony WH-1000XM5" sub="340 đơn" color={C.purple} />
          </div>
          <div className="card" style={{ padding: '18px 20px' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Top 5 sản phẩm bán chạy</h3>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={TOP_PRODUCTS} layout="vertical" barSize={18}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => `${v} đơn`} />
                <Bar dataKey="sales" fill={C.blue} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── Operations ── */}
      {tab === 'operations' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Tổng đơn hàng"  value="3,190"  sub="Trong kỳ" color={C.blue} />
            <StatCard label="Tỷ lệ hoàn thành" value="68%" sub="68% trong tổng đơn" color={C.success} />
            <StatCard label="Đơn bị hủy"     value="7%"    sub="Cần cải thiện" color={C.error} />
            <StatCard label="Thời gian giao TB" value="2.4 ngày" sub="Toàn quốc" color={C.warning} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="card" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 16 }}>Phân bố trạng thái đơn hàng</h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={ORDER_STATUS_DATA} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name} ${value}%`} labelLine={false}>
                    {ORDER_STATUS_DATA.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v}%`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="card" style={{ padding: '18px 20px' }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy, marginBottom: 12 }}>Chỉ số vận hành</h3>
              {[
                { label: 'Tỷ lệ giao thành công', value: '94.2%', color: C.success },
                { label: 'Tranh chấp mở', value: '23 tranh chấp', color: C.warning },
                { label: 'Thời gian xử lý đơn TB', value: '1.8 giờ', color: C.blue },
                { label: 'Đơn hoàn trả', value: '48 đơn (1.5%)', color: C.error },
                { label: 'Shipper đang hoạt động', value: '32 shipper', color: C.purple },
                { label: 'Rating TB shipper', value: '4.7 ⭐', color: C.warning },
              ].map(s => (
                <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${C.tint}` }}>
                  <span style={{ fontSize: 13, color: C.gray }}>{s.label}</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: s.color }}>{s.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Marketing ── */}
      {tab === 'marketing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
            <StatCard label="Voucher đang hoạt động" value="8"       sub="Tổng 12 voucher" color={C.blue} />
            <StatCard label="Lượt dùng voucher"     value="633"      sub="Tháng này"        color={C.success} />
            <StatCard label="Giảm giá đã phát"      value="114.2M₫"  sub="Tổng tiền giảm"   color={C.error} />
            <StatCard label="Banner đang chạy"      value="4"        sub="Trên trang chủ"    color={C.warning} />
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.light}` }}>
              <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>Hiệu quả voucher</h3>
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: C.tint }}>
                  {['Mã voucher', 'Lượt sử dụng', 'Tổng giảm giá', 'Hiệu quả'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VOUCHER_USAGE.map(v => (
                  <tr key={v.code} style={{ borderBottom: `1px solid ${C.tint}` }}>
                    <td style={{ padding: '12px 16px' }}><code style={{ background: C.light, color: C.navy, padding: '3px 9px', borderRadius: 6, fontWeight: 700 }}>{v.code}</code></td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: C.navy }}>{v.uses.toLocaleString('vi-VN')}</td>
                    <td style={{ padding: '12px 16px', fontSize: 14, fontWeight: 700, color: C.error }}>{v.discount.toLocaleString('vi-VN')}₫</td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ height: 8, background: C.tint, borderRadius: 4, overflow: 'hidden', width: 120 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, v.uses / 5)}%`, background: C.blue, borderRadius: 4 }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

export default ReportsPage
