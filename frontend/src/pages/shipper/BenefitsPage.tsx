import React, { useState } from 'react'

const C = {
  amber: '#D97706', gold: '#F59E0B', light: '#FEF3C7', tint: '#FFFBEB',
  navy: '#1E3A8A', blue: '#1D4ED8', gray: '#64748B',
  success: '#16A34A', error: '#DC2626',
}

const MOCK_LEVEL = {
  current: 'Vàng',
  deliveries_done: 312,
  deliveries_next: 500,
  rating: 4.8,
  badge: '🥇',
}

const LEVELS = [
  { name: 'Đồng', icon: '🥉', min: 0,   max: 99,  color: '#92400E', bg: '#FEF3C7', bonus_pct: 0,  desc: 'Mức khởi đầu' },
  { name: 'Bạc',  icon: '🥈', min: 100, max: 299, color: '#6B7280', bg: '#F9FAFB', bonus_pct: 5,  desc: 'Thưởng +5% mỗi đơn' },
  { name: 'Vàng', icon: '🥇', min: 300, max: 499, color: '#D97706', bg: '#FEF3C7', bonus_pct: 10, desc: 'Thưởng +10% mỗi đơn' },
  { name: 'Kim cương', icon: '💎', min: 500, max: 999, color: '#1D4ED8', bg: '#DBEAFE', bonus_pct: 15, desc: 'Thưởng +15% + ưu tiên đơn hàng' },
  { name: 'Huyền thoại', icon: '👑', min: 1000, max: 99999, color: '#7C3AED', bg: '#EDE9FE', bonus_pct: 20, desc: 'Thưởng +20% + bảo hiểm xe miễn phí' },
]

const MOCK_BONUSES = [
  { bonus_id: 1, type: 'weekly_target', title: 'Hoàn thành 60 đơn/tuần',   reward: 50000,  period: 'Tuần 23/2026', status: 'received', received_at: '2026-06-09' },
  { bonus_id: 2, type: '5star_rating',  title: 'Duy trì 4.8★ trong tháng', reward: 100000, period: 'T5/2026',      status: 'received', received_at: '2026-06-01' },
  { bonus_id: 3, type: 'weekend_surge', title: 'Thưởng giao dịp cuối tuần',reward: 30000,  period: 'CN 08/06',     status: 'received', received_at: '2026-06-08' },
  { bonus_id: 4, type: 'weekly_target', title: 'Hoàn thành 60 đơn/tuần',   reward: 50000,  period: 'Tuần 24/2026', status: 'pending',  received_at: null },
  { bonus_id: 5, type: 'milestone',     title: 'Đạt 300 đơn giao thành công', reward: 200000, period: 'Tháng 6',   status: 'received', received_at: '2026-06-05' },
]

const MOCK_WELFARE = [
  { id: 1, icon: '🏥', title: 'Bảo hiểm tai nạn',    desc: 'Bảo hiểm tai nạn cá nhân 24/7, mức bồi thường lên đến 50 triệu đồng.', active: true },
  { id: 2, icon: '⛽', title: 'Hỗ trợ nhiên liệu',   desc: 'Phụ cấp xăng 500.000₫/tháng cho shipper từ cấp Bạc trở lên.', active: true },
  { id: 3, icon: '🔧', title: 'Sửa chữa xe',         desc: 'Hỗ trợ chi phí sửa chữa phương tiện tối đa 2.000.000₫/năm.', active: true },
  { id: 4, icon: '🎓', title: 'Đào tạo kỹ năng',     desc: 'Khóa học kỹ năng giao tiếp và an toàn giao thông miễn phí hàng quý.', active: true },
  { id: 5, icon: '💎', title: 'Bảo hiểm xe miễn phí', desc: 'Dành riêng cho shipper Huyền thoại — bảo hiểm xe máy 1 năm miễn phí.', active: false },
]

const fmt = (n: number) => n.toLocaleString('vi-VN') + '₫'

const BenefitsPage: React.FC = () => {
  const [tab, setTab] = useState<'overview'|'bonuses'|'welfare'>('overview')
  const currentLevel = LEVELS.find(l => l.name === MOCK_LEVEL.current) ?? LEVELS[0]
  const nextLevel    = LEVELS[LEVELS.indexOf(currentLevel) + 1]
  const progress     = ((MOCK_LEVEL.deliveries_done - currentLevel.min) / (MOCK_LEVEL.deliveries_next - currentLevel.min)) * 100

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.amber, margin: 0 }}>🎁 Phúc lợi & Thưởng</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 3 }}>Chương trình phúc lợi và thưởng dành cho shipper BuyZO</p>
      </div>

      {/* Level card */}
      <div style={{ background: `linear-gradient(135deg, ${currentLevel.color}, ${C.gold})`, borderRadius: 16, padding: '24px 28px', color: 'white' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ fontSize: 12, opacity: 0.85, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 1 }}>Cấp độ hiện tại</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 6 }}>
              <span style={{ fontSize: 40 }}>{currentLevel.icon}</span>
              <p style={{ fontSize: 32, fontWeight: 900 }}>{currentLevel.name}</p>
            </div>
            <p style={{ fontSize: 13, opacity: 0.85, marginTop: 4 }}>{currentLevel.desc}</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontSize: 11, opacity: 0.8, fontWeight: 600 }}>ĐÁNH GIÁ</p>
            <p style={{ fontSize: 28, fontWeight: 800 }}>⭐ {MOCK_LEVEL.rating}</p>
          </div>
        </div>

        {/* Progress to next level */}
        {nextLevel && (
          <div style={{ marginTop: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, opacity: 0.9, marginBottom: 6 }}>
              <span>{MOCK_LEVEL.deliveries_done} đơn đã giao</span>
              <span>Lên {nextLevel.name} {nextLevel.icon} cần {MOCK_LEVEL.deliveries_next} đơn</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.25)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(progress, 100)}%`, background: 'white', borderRadius: 4 }} />
            </div>
            <p style={{ fontSize: 11, opacity: 0.8, marginTop: 4 }}>Còn {MOCK_LEVEL.deliveries_next - MOCK_LEVEL.deliveries_done} đơn nữa để lên cấp</p>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, background: 'var(--bg-card)', padding: '10px 14px', borderRadius: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
        {([
          ['overview', '🏆 Các cấp độ'],
          ['bonuses',  '💰 Lịch sử thưởng'],
          ['welfare',  '🎁 Phúc lợi'],
        ] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} style={{
            padding: '8px 20px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: tab === k ? C.amber : '#F1F5F9', color: tab === k ? 'white' : C.gray,
          }}>{l}</button>
        ))}
      </div>

      {/* ── Tab: Cấp độ ── */}
      {tab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {LEVELS.map((lv, idx) => {
            const isCurrent = lv.name === MOCK_LEVEL.current
            const isPassed  = LEVELS.indexOf(currentLevel) > idx
            return (
              <div key={lv.name} style={{
                background: 'var(--bg-card)', borderRadius: 14, padding: '16px 20px',
                border: isCurrent ? `2px solid ${lv.color}` : '2px solid transparent',
                boxShadow: isCurrent ? `0 0 0 4px ${lv.bg}` : '0 1px 3px rgba(0,0,0,0.07)',
                opacity: isPassed ? 0.6 : 1,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                  <span style={{ fontSize: 32 }}>{lv.icon}</span>
                  <div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <p style={{ fontWeight: 800, fontSize: 16, color: lv.color, margin: 0 }}>{lv.name}</p>
                      {isCurrent && <span style={{ fontSize: 11, fontWeight: 700, background: lv.bg, color: lv.color, padding: '2px 10px', borderRadius: 20 }}>Cấp hiện tại</span>}
                    </div>
                    <p style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>{lv.min}–{lv.max === 99999 ? '∞' : lv.max} đơn · {lv.desc}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  {lv.bonus_pct > 0
                    ? <p style={{ fontSize: 18, fontWeight: 800, color: lv.color }}>+{lv.bonus_pct}%</p>
                    : <p style={{ fontSize: 13, color: C.gray }}>Cơ bản</p>
                  }
                  <p style={{ fontSize: 11, color: C.gray }}>thưởng/đơn</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Tab: Thưởng ── */}
      {tab === 'bonuses' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 4 }}>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 18px', borderLeft: `3px solid ${C.success}`, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase' }}>Tổng đã nhận</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: C.success }}>{fmt(MOCK_BONUSES.filter(b=>b.status==='received').reduce((s,b)=>s+b.reward,0))}</p>
            </div>
            <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: '14px 18px', borderLeft: `3px solid ${C.amber}`, boxShadow: '0 1px 3px rgba(0,0,0,0.07)' }}>
              <p style={{ fontSize: 11, fontWeight: 600, color: C.gray, textTransform: 'uppercase' }}>Đang chờ</p>
              <p style={{ fontSize: 22, fontWeight: 800, color: C.amber }}>{fmt(MOCK_BONUSES.filter(b=>b.status==='pending').reduce((s,b)=>s+b.reward,0))}</p>
            </div>
          </div>
          {MOCK_BONUSES.map(b => (
            <div key={b.bonus_id} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '16px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontWeight: 700, fontSize: 14, color: C.navy, margin: 0 }}>{b.title}</p>
                <p style={{ fontSize: 12, color: C.gray, marginTop: 3 }}>{b.period}{b.received_at ? ` · Nhận: ${b.received_at}` : ''}</p>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>
                <p style={{ fontSize: 18, fontWeight: 800, color: C.success, margin: 0 }}>+{fmt(b.reward)}</p>
                <span style={{ fontSize: 11, fontWeight: 600, padding: '2px 9px', borderRadius: 20, background: b.status==='received'?'#DCFCE7':C.light, color: b.status==='received'?C.success:C.amber }}>
                  {b.status === 'received' ? '✓ Đã nhận' : '⏳ Chờ nhận'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Phúc lợi ── */}
      {tab === 'welfare' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {MOCK_WELFARE.map(w => (
            <div key={w.id} style={{ background: 'var(--bg-card)', borderRadius: 14, padding: '18px 20px', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', display: 'flex', gap: 16, alignItems: 'flex-start', opacity: w.active ? 1 : 0.5 }}>
              <span style={{ fontSize: 32, flexShrink: 0 }}>{w.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 4 }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: C.navy, margin: 0 }}>{w.title}</p>
                  {!w.active && <span style={{ fontSize: 11, fontWeight: 700, background: '#EDE9FE', color: '#7C3AED', padding: '2px 9px', borderRadius: 20 }}>💎 Kim cương+</span>}
                </div>
                <p style={{ fontSize: 13, color: C.gray, margin: 0 }}>{w.desc}</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, flexShrink: 0,
                background: w.active ? '#DCFCE7' : '#F1F5F9', color: w.active ? C.success : C.gray }}>
                {w.active ? '✓ Đang áp dụng' : '🔒 Chưa mở'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default BenefitsPage
