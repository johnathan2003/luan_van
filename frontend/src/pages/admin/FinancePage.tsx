/**
 * 💰 Finance Admin — Tài chính hệ thống
 * Nhóm 6: doanh thu nền tảng, lịch sử giao dịch, xuất báo cáo
 */
import React, { useState, useEffect } from 'react'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts'
import { toast } from 'react-toastify'
import { adminService } from '../../services/adminService'
import API from '../../services/api'

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

/* ─── Revenue Config Tab ──────────────────────────────────────────────────── */

const PIE_COLORS: Record<string, string> = {
  shop: '#7C3AED', admin: '#1D4ED8', shipper: '#0D9488', vat: '#D97706',
}

const RevenueConfigTab: React.FC = () => {
  const [cfg, setCfg]         = useState({ shop_rate: 70, admin_rate: 15, shipper_rate: 5, vat_rate: 10 })
  const [history, setHistory] = useState<any[]>([])
  const [editing, setEditing] = useState({ ...cfg })
  const [saving, setSaving]   = useState(false)
  const [note, setNote]       = useState('')

  const load = () => {
    API.get('/api/v1/admin/revenue-config').then((r: any) => {
      const cur = r.data?.current
      if (cur) { setCfg(cur); setEditing({ shop_rate: cur.shop_rate, admin_rate: cur.admin_rate, shipper_rate: cur.shipper_rate, vat_rate: cur.vat_rate }) }
      setHistory(r.data?.history ?? [])
    }).catch(() => {})
  }
  useEffect(() => { load() }, [])

  const total = editing.shop_rate + editing.admin_rate + editing.shipper_rate + editing.vat_rate
  const isValid = Math.abs(total - 100) < 0.01

  const pieData = [
    { name: `Shop ${editing.shop_rate}%`,    value: editing.shop_rate,    fill: PIE_COLORS.shop    },
    { name: `Admin ${editing.admin_rate}%`,   value: editing.admin_rate,   fill: PIE_COLORS.admin   },
    { name: `Shipper ${editing.shipper_rate}%`,value: editing.shipper_rate, fill: PIE_COLORS.shipper },
    { name: `VAT ${editing.vat_rate}%`,       value: editing.vat_rate,     fill: PIE_COLORS.vat     },
  ]

  const save = async () => {
    if (!isValid) { toast.warn(`Tổng phải = 100%, hiện tại ${total.toFixed(2)}%`); return }
    if (!window.confirm('Thay đổi này áp dụng cho đơn hàng mới. Đơn đã hoàn thành giữ nguyên phân chia cũ. Xác nhận?')) return
    setSaving(true)
    try {
      await API.put('/api/v1/admin/revenue-config', { ...editing, note })
      toast.success('Đã lưu cấu hình doanh thu')
      setNote('')
      load()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi lưu cấu hình')
    } finally { setSaving(false) }
  }

  const fieldMeta = [
    { key: 'shop_rate',    label: 'Shop nhận',    color: PIE_COLORS.shop    },
    { key: 'admin_rate',   label: 'Admin nhận',   color: PIE_COLORS.admin   },
    { key: 'shipper_rate', label: 'Shipper nhận', color: PIE_COLORS.shipper },
    { key: 'vat_rate',     label: 'VAT',          color: PIE_COLORS.vat     },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Left — input */}
        <div className="card" style={{ padding: '24px 28px' }}>
          <p style={{ fontWeight: 800, color: '#1E3A8A', fontSize: 15, margin: '0 0 6px' }}>⚙️ Phân chia doanh thu</p>
          <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 20px' }}>Áp dụng cho mọi đơn hàng mới từ thời điểm lưu</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {fieldMeta.map(f => (
              <div key={f.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: '50%', background: f.color, flexShrink: 0 }} />
                <label style={{ fontSize: 13, fontWeight: 600, color: '#1E3A8A', minWidth: 120 }}>{f.label}</label>
                <input
                  type="number" min={0} max={100} step={0.5}
                  value={(editing as any)[f.key]}
                  onChange={e => setEditing(p => ({ ...p, [f.key]: parseFloat(e.target.value) || 0 }))}
                  style={{ width: 80, padding: '7px 10px', border: `2px solid ${f.color}40`, borderRadius: 8, fontSize: 15, fontWeight: 700, textAlign: 'center', outline: 'none', color: f.color }}
                />
                <span style={{ fontSize: 14, color: '#94A3B8' }}>%</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: '10px 14px', borderRadius: 10,
            background: isValid ? '#DCFCE7' : '#FEE2E2',
            border: `1px solid ${isValid ? '#86EFAC' : '#FCA5A5'}` }}>
            <p style={{ fontWeight: 800, color: isValid ? '#16A34A' : '#DC2626', fontSize: 13, margin: 0 }}>
              Tổng: {total.toFixed(2)}% {isValid ? '✅' : '❌ Phải đúng 100%'}
            </p>
          </div>

          <div style={{ marginTop: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#64748B', display: 'block', marginBottom: 6 }}>Ghi chú thay đổi (tuỳ chọn)</label>
            <input value={note} onChange={e => setNote(e.target.value)} placeholder="VD: Điều chỉnh theo chính sách Q3-2026"
              style={{ width: '100%', padding: '8px 12px', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button onClick={() => setEditing({ shop_rate: cfg.shop_rate, admin_rate: cfg.admin_rate, shipper_rate: cfg.shipper_rate, vat_rate: cfg.vat_rate })}
              style={{ flex: 1, padding: '10px', background: '#F1F5F9', color: '#64748B', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>
              Hủy
            </button>
            <button onClick={save} disabled={!isValid || saving}
              style={{ flex: 2, padding: '10px', background: !isValid || saving ? '#94A3B8' : '#1D4ED8', color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: isValid && !saving ? 'pointer' : 'default' }}>
              {saving ? '⏳ Đang lưu...' : '💾 Lưu cấu hình'}
            </button>
          </div>
        </div>

        {/* Right — pie chart */}
        <div className="card" style={{ padding: '24px 28px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <p style={{ fontWeight: 800, color: '#1E3A8A', fontSize: 15, margin: '0 0 6px', alignSelf: 'flex-start' }}>📊 Phân chia trực quan</p>
          <PieChart width={260} height={220}>
            <Pie data={pieData} cx={130} cy={100} innerRadius={60} outerRadius={100} dataKey="value" paddingAngle={2}>
              {pieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
            </Pie>
            <Tooltip formatter={(v: number) => `${v}%`} />
          </PieChart>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
            {pieData.map(d => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: d.fill }} />
                <span style={{ fontSize: 12, color: '#64748B' }}>{d.name}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, background: '#FEF3C7', borderRadius: 10, padding: '10px 14px', width: '100%' }}>
            <p style={{ fontSize: 12, color: '#92400E', margin: 0, fontWeight: 600 }}>
              ⚠️ Thay đổi áp dụng cho đơn hàng mới. Đơn đã hoàn thành giữ nguyên phân chia cũ.
            </p>
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="card" style={{ padding: '18px 20px' }}>
          <p style={{ fontWeight: 800, color: '#1E3A8A', fontSize: 14, margin: '0 0 12px' }}>📋 Lịch sử thay đổi</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.slice(0, 5).map((h, i) => (
              <div key={h.config_id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 12px',
                background: i === 0 ? '#EFF6FF' : '#F8FAFC', borderRadius: 8, border: i === 0 ? '1px solid #BFDBFE' : '1px solid #F1F5F9' }}>
                {i === 0 && <span style={{ fontSize: 11, fontWeight: 800, color: '#1D4ED8', background: '#DBEAFE', borderRadius: 6, padding: '2px 6px' }}>Hiện tại</span>}
                <span style={{ fontSize: 12, color: '#64748B', minWidth: 120 }}>
                  {h.changed_at ? new Date(h.changed_at).toLocaleDateString('vi-VN') : '—'}
                </span>
                <span style={{ fontSize: 12, color: '#1E3A8A', fontWeight: 600 }}>
                  Shop {h.shop_rate}% · Admin {h.admin_rate}% · Shipper {h.shipper_rate}% · VAT {h.vat_rate}%
                </span>
                {h.changed_by_name && (
                  <span style={{ fontSize: 11, color: '#94A3B8', marginLeft: 'auto' }}>bởi {h.changed_by_name}</span>
                )}
                {h.note && (
                  <span style={{ fontSize: 11, color: '#64748B', fontStyle: 'italic' }}>— {h.note}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */

const FinancePage: React.FC = () => {
  const [monthly, setMonthly]         = useState<any[]>([])
  const [shopRevenue, setShopRevenue] = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [period, setPeriod]           = useState<'week' | 'month' | 'year'>('month')
  const [activeTab, setActiveTab]     = useState<'overview' | 'shops' | 'config'>('overview')

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

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, background: '#F1F5F9', borderRadius: 12, padding: 4, width: 'fit-content' }}>
        {([
          ['overview', '📈 Tổng quan'],
          ['shops',    '🏪 Doanh thu shop'],
          ['config',   '⚙️ Cấu hình doanh thu'],
        ] as const).map(([t, label]) => (
          <button key={t} onClick={() => setActiveTab(t)}
            style={{ padding: '9px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700,
              background: activeTab === t ? C.navy : 'transparent', color: activeTab === t ? 'white' : C.gray, transition: 'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'config' && <RevenueConfigTab />}

      {/* KPI stats — chỉ hiện ở tab overview */}
      {activeTab !== 'config' && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
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
      </div>}

      {/* Charts — chỉ ở overview */}
      {activeTab === 'overview' && <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 16 }}>
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
      </div>}

      {/* Shop revenue summary */}
      {activeTab === 'shops' && <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: `1px solid ${C.light}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>🏪 Doanh thu theo shop</h3>
            <p style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>Tổng kết từ đơn hàng hoàn thành</p>
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
      </div>}

    </div>
  )
}

export default FinancePage
