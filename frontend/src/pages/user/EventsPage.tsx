import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'react-toastify'
import LuckyWheel from '../../components/events/LuckyWheel'
import {
  getXu, getCheckinInfo, doCheckin, CHECKIN_REWARDS,
  getMissionsToday, claimMission,
  getOfficialNumberToday, getUserTicketToday, rerollUserTicket, canPlayLotteryToday, playLottery, getLastLotteryResult,
  getEventVouchers, msUntilMidnight, type SpinReward,
} from '../../utils/eventsStore'

function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

const DAY_ICONS = ['🌱', '🌿', '🌳', '⭐', '🌟', '💫', '🏆']

// Card section tiêu đề đồng nhất
function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: subtitle ? 6 : 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--primary), #a855f7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0,
        }}>{icon}</div>
        <h2 style={{ fontWeight: 700, fontSize: 17, margin: 0 }}>{title}</h2>
      </div>
      {subtitle && <p style={{ fontSize: 13, color: 'var(--gray-500)', marginLeft: 46 }}>{subtitle}</p>}
    </div>
  )
}

// route tương ứng với từng loại nhiệm vụ
const MISSION_ROUTES: Record<string, string> = {
  view_products:    '/products',
  view_products_10: '/products',
  view_shop:        '/products',   // trang sản phẩm → user tự vào trang shop từ đó
}

const EventsPage: React.FC = () => {
  const navigate = useNavigate()
  const [xu, setXu] = useState(getXu())
  const [checkinInfo, setCheckinInfo] = useState(getCheckinInfo())
  const [missions, setMissions] = useState(getMissionsToday())
  const [lotteryResult, setLotteryResult] = useState(getLastLotteryResult())
  const [lotteryPlayed, setLotteryPlayed] = useState(!canPlayLotteryToday())
  const [userTicket, setUserTicket] = useState(getUserTicketToday())
  const [countdown, setCountdown] = useState(msUntilMidnight())

  useEffect(() => {
    setMissions(getMissionsToday())
    setCheckinInfo(getCheckinInfo())
  }, [])

  useEffect(() => {
    const t = setInterval(() => setCountdown(msUntilMidnight()), 1000)
    return () => clearInterval(t)
  }, [])

  const refreshXu = () => setXu(getXu())

  const handleCheckin = () => {
    const r = doCheckin()
    if (!r) { toast.info('Bạn đã điểm danh hôm nay rồi!'); return }
    toast.success(`Điểm danh thành công! +${r.reward} xu (streak ${r.streak} ngày)`)
    setCheckinInfo(getCheckinInfo())
    refreshXu()
  }

  const handleClaimMission = (key: string) => {
    const reward = claimMission(key)
    if (reward == null) { toast.warning('Chưa hoàn thành nhiệm vụ này'); return }
    toast.success(`Nhận thưởng nhiệm vụ! +${reward} xu`)
    setMissions(getMissionsToday())
    refreshXu()
  }

  const handleSpinResult = (reward: SpinReward) => {
    refreshXu()
    if (reward.type === 'none') toast.info(reward.label)
    else toast.success(`Chúc mừng! Bạn nhận được ${reward.label} 🎉`)
  }

  const handlePlayLottery = () => {
    const r = playLottery()
    if (!r) { toast.info('Bạn đã dò số hôm nay rồi, mai quay lại nhé!'); return }
    setLotteryResult(r)
    setLotteryPlayed(true)
    refreshXu()
    toast.success(r.rewardLabel)
  }

  const handleRerollTicket = () => {
    if (lotteryPlayed) { toast.warning('Số vé đã được dùng để dò số hôm nay, không đổi được nữa'); return }
    const t = rerollUserTicket()
    setUserTicket(t)
    toast.info('Đã đổi số vé mới, chọn số bạn ưng rồi bấm "Dò số ngay"!')
  }

  const officialNumber = getOfficialNumberToday()
  const vouchers = getEventVouchers()

  return (
    <div className="page-wrapper">
      <style>{`
        @keyframes evFloat1 { 0%,100%{transform:translateY(0) rotate(-4deg)} 50%{transform:translateY(-14px) rotate(4deg)} }
        @keyframes evFloat2 { 0%,100%{transform:translateY(0) rotate(6deg)} 50%{transform:translateY(-10px) rotate(-4deg)} }
        @keyframes evFloat3 { 0%,100%{transform:translateY(0) rotate(0deg)} 50%{transform:translateY(-18px) rotate(8deg)} }
        @keyframes evFloat4 { 0%,100%{transform:translateY(0) rotate(-8deg)} 50%{transform:translateY(-8px) rotate(2deg)} }
        @keyframes evPulse  { 0%,100%{opacity:.55;transform:scale(1)} 50%{opacity:.85;transform:scale(1.08)} }
        .ev-deco { position:absolute; display:flex; align-items:center; justify-content:center;
                   border-radius:50%; font-size:22px; user-select:none; pointer-events:none; }
      `}</style>

      {/* ── Hero banner ── */}
      <div style={{
        background: 'linear-gradient(135deg, #6d28d9 0%, #7c3aed 40%, #a855f7 70%, #c084fc 100%)',
        position: 'relative', overflow: 'hidden',
      }}>
        {/* decorative blobs */}
        <div style={{ position: 'absolute', top: -40, right: -40, width: 200, height: 200, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'absolute', bottom: -60, left: 80, width: 160, height: 160, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
        <div style={{ position: 'absolute', top: 20, left: '40%', width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.06)' }} />

        <div className="container" style={{ paddingTop: 36, paddingBottom: 36, position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <div>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 500, letterSpacing: 1, marginBottom: 6 }}>BUYZO EVENTS</p>
              <h1 style={{ color: 'white', fontWeight: 800, fontSize: 28, margin: 0, lineHeight: 1.2 }}>🎁 Sự kiện hàng ngày</h1>
              <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 8 }}>
                Điểm danh · Vòng quay · Nhiệm vụ · Dò số — nhận xu & voucher mỗi ngày!
              </p>
            </div>

            {/* Xu badge */}
            <div style={{
              background: 'rgba(255,255,255,0.15)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,0.3)', borderRadius: 16,
              padding: '14px 22px', display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <div style={{
                width: 44, height: 44, borderRadius: '50%',
                background: 'linear-gradient(135deg, #fbbf24, #f59e0b)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                boxShadow: '0 4px 12px rgba(251,191,36,0.4)',
              }}>🪙</div>
              <div>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500 }}>Số dư xu của bạn</p>
                <p style={{ fontWeight: 800, fontSize: 22, color: '#fde68a', lineHeight: 1 }}>{xu.toLocaleString('vi-VN')} xu</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Decorative side floats ── */}
      <div style={{ position: 'relative' }}>
        {/* LEFT SIDE */}
        {([
          { top: 60,  left: 18, size: 54, bg: 'linear-gradient(135deg,#a78bfa,#7c3aed)', icon: '🎁', anim: 'evFloat1 4.2s ease-in-out infinite' },
          { top: 190, left: 42, size: 44, bg: 'linear-gradient(135deg,#fde68a,#f59e0b)', icon: '⭐', anim: 'evFloat2 5s ease-in-out infinite' },
          { top: 340, left: 10, size: 48, bg: 'linear-gradient(135deg,#fbcfe8,#ec4899)', icon: '🎀', anim: 'evFloat3 6.5s ease-in-out infinite' },
          { top: 490, left: 50, size: 40, bg: 'linear-gradient(135deg,#bbf7d0,#10b981)', icon: '✨', anim: 'evFloat4 3.8s ease-in-out infinite' },
          { top: 640, left: 20, size: 50, bg: 'linear-gradient(135deg,#bfdbfe,#3b82f6)', icon: '🎯', anim: 'evFloat1 5.5s ease-in-out infinite 1s' },
          { top: 800, left: 38, size: 42, bg: 'linear-gradient(135deg,#fecaca,#ef4444)', icon: '🎲', anim: 'evFloat2 4.8s ease-in-out infinite 0.5s' },
        ] as const).map((d, i) => (
          <div key={i} className="ev-deco" style={{
            top: d.top, left: d.left, width: d.size, height: d.size,
            background: d.bg, animation: d.anim,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', opacity: 0.72,
          }}>{d.icon}</div>
        ))}

        {/* RIGHT SIDE */}
        {([
          { top: 80,  right: 20, size: 52, bg: 'linear-gradient(135deg,#fde68a,#f59e0b)', icon: '🪙', anim: 'evFloat2 4.6s ease-in-out infinite' },
          { top: 220, right: 48, size: 46, bg: 'linear-gradient(135deg,#c4b5fd,#8b5cf6)', icon: '🎰', anim: 'evFloat3 5.2s ease-in-out infinite 0.7s' },
          { top: 370, right: 14, size: 50, bg: 'linear-gradient(135deg,#a7f3d0,#10b981)', icon: '🎫', anim: 'evFloat1 7s ease-in-out infinite' },
          { top: 510, right: 52, size: 42, bg: 'linear-gradient(135deg,#fed7aa,#f97316)', icon: '🏆', anim: 'evFloat4 4.3s ease-in-out infinite 1.2s' },
          { top: 670, right: 18, size: 48, bg: 'linear-gradient(135deg,#fce7f3,#db2777)', icon: '💎', anim: 'evFloat2 6s ease-in-out infinite 0.3s' },
          { top: 820, right: 44, size: 44, bg: 'linear-gradient(135deg,#dbeafe,#2563eb)', icon: '🌟', anim: 'evFloat3 5.8s ease-in-out infinite 0.9s' },
        ] as const).map((d, i) => (
          <div key={i} className="ev-deco" style={{
            top: d.top, right: d.right, width: d.size, height: d.size,
            background: d.bg, animation: d.anim,
            boxShadow: '0 4px 16px rgba(0,0,0,0.12)', opacity: 0.72,
          }}>{d.icon}</div>
        ))}

      <div className="container" style={{ paddingTop: 28, paddingBottom: 48 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* ── Điểm danh ── */}
          <div className="card" style={{ padding: 28, background: 'linear-gradient(135deg, #fefce8 0%, #fff 60%)' }}>
            <SectionHeader
              icon="📅"
              title="Điểm danh hàng ngày"
              subtitle={`Streak hiện tại: ${checkinInfo.streak} ngày liên tiếp — điểm danh đủ 7 ngày để nhận thưởng lớn!`}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 22 }}>
              {CHECKIN_REWARDS.map((reward, i) => {
                const isToday = i === checkinInfo.dayInCycle
                const isPast = checkinInfo.checkedToday
                  ? i < checkinInfo.dayInCycle || i === checkinInfo.dayInCycle
                  : i < checkinInfo.dayInCycle
                const isDay7 = i === 6

                let bg = 'var(--gray-50)'
                let borderStyle = '1.5px solid var(--gray-150)'
                let textColor = 'var(--gray-400)'
                let rewardColor = 'var(--gray-500)'

                if (isToday && checkinInfo.checkedToday) {
                  bg = 'linear-gradient(135deg, #7c3aed, #a855f7)'
                  borderStyle = 'none'
                  textColor = 'rgba(255,255,255,0.85)'
                  rewardColor = 'white'
                } else if (isToday) {
                  bg = 'linear-gradient(135deg, #ede9fe, #f5f3ff)'
                  borderStyle = '2px dashed #7c3aed'
                  textColor = '#7c3aed'
                  rewardColor = '#6d28d9'
                } else if (isPast) {
                  bg = '#f0fdf4'
                  borderStyle = '1.5px solid #bbf7d0'
                  textColor = '#16a34a'
                  rewardColor = '#15803d'
                } else if (isDay7) {
                  bg = 'linear-gradient(135deg, #fefce8, #fef9c3)'
                  borderStyle = '1.5px solid #fde68a'
                  textColor = '#92400e'
                  rewardColor = '#b45309'
                }

                return (
                  <div key={i} style={{
                    textAlign: 'center', padding: '14px 4px', borderRadius: 12,
                    background: bg, border: borderStyle,
                    boxShadow: isToday ? '0 4px 16px rgba(124,58,237,0.2)' : isDay7 && !isPast ? '0 2px 8px rgba(251,191,36,0.25)' : 'none',
                    transition: 'transform 0.15s',
                    cursor: 'default',
                  }}>
                    <p style={{ fontSize: 10, fontWeight: 700, color: textColor, letterSpacing: 0.5 }}>NGÀY {i + 1}</p>
                    <p style={{ fontSize: 20, marginTop: 6 }}>
                      {isPast ? '✅' : isToday && !checkinInfo.checkedToday ? '👆' : DAY_ICONS[i]}
                    </p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: rewardColor, marginTop: 4 }}>{reward}</p>
                    <p style={{ fontSize: 9, color: textColor, marginTop: 1 }}>xu</p>
                  </div>
                )
              })}
            </div>

            <button
              onClick={handleCheckin}
              disabled={checkinInfo.checkedToday}
              style={{
                padding: '12px 28px', borderRadius: 12, border: 'none', cursor: checkinInfo.checkedToday ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: 15,
                background: checkinInfo.checkedToday
                  ? 'var(--gray-100)'
                  : 'linear-gradient(135deg, #7c3aed, #a855f7)',
                color: checkinInfo.checkedToday ? 'var(--gray-400)' : 'white',
                boxShadow: checkinInfo.checkedToday ? 'none' : '0 4px 16px rgba(124,58,237,0.35)',
                transition: 'opacity 0.2s',
              }}
            >
              {checkinInfo.checkedToday ? '✅ Đã điểm danh hôm nay' : `👆 Điểm danh ngay · +${checkinInfo.nextReward} xu`}
            </button>
          </div>

          {/* ── Vòng quay ── */}
          <div className="card" style={{
            padding: 28, textAlign: 'center',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #fff 60%)',
          }}>
            <SectionHeader
              icon="🎰"
              title="Vòng quay may mắn"
              subtitle="Mỗi ngày được quay 1 lượt miễn phí — có cơ hội nhận xu hoặc voucher giảm giá!"
            />
            <LuckyWheel onResult={handleSpinResult} />
          </div>

          {/* ── Nhiệm vụ ── */}
          <div className="card" style={{ padding: 28 }}>
            <SectionHeader
              icon="📋"
              title="Nhiệm vụ hôm nay"
              subtitle="Hoàn thành nhiệm vụ bằng cách lướt xem sản phẩm/cửa hàng trên BuyZo để nhận xu"
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {missions.map((m, idx) => (
                <div key={m.key} style={{
                  display: 'flex', alignItems: 'center', gap: 14,
                  padding: '16px 14px', borderRadius: 12,
                  background: m.claimed ? '#f0fdf4' : m.done ? '#fefce8' : idx % 2 === 0 ? 'var(--gray-50)' : 'white',
                  border: m.claimed ? '1px solid #bbf7d0' : m.done ? '1px solid #fde68a' : '1px solid transparent',
                  transition: 'background 0.2s',
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                    background: m.claimed ? '#dcfce7' : m.done ? '#fef9c3' : 'var(--gray-100)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
                  }}>{m.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 7 }}>{m.label}</p>
                    <div style={{ height: 7, background: 'var(--gray-150)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{
                        height: '100%',
                        width: `${Math.min(100, (m.progress / m.target) * 100)}%`,
                        background: m.claimed ? 'linear-gradient(90deg,#22c55e,#16a34a)' : m.done ? 'linear-gradient(90deg,#f59e0b,#d97706)' : 'linear-gradient(90deg,var(--primary),#a855f7)',
                        transition: 'width 0.4s',
                        borderRadius: 99,
                      }} />
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 5 }}>
                      {m.progress}/{m.target} · Thưởng <strong style={{ color: '#b45309' }}>{m.reward} xu</strong>
                    </p>
                  </div>
                  {m.claimed ? (
                    <button disabled style={{
                      padding: '8px 16px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                      whiteSpace: 'nowrap', cursor: 'not-allowed',
                      background: 'var(--gray-100)', color: 'var(--gray-400)',
                    }}>✅ Đã nhận</button>
                  ) : (
                    <button
                      onClick={() => m.done ? handleClaimMission(m.key) : navigate(MISSION_ROUTES[m.key] || '/products')}
                      style={{
                        padding: '8px 20px', borderRadius: 10, border: 'none', fontSize: 13, fontWeight: 700,
                        whiteSpace: 'nowrap', cursor: 'pointer',
                        background: m.done
                          ? 'linear-gradient(135deg, #22c55e, #16a34a)'
                          : 'linear-gradient(135deg, #ef4444, #dc2626)',
                        color: 'white',
                        boxShadow: m.done
                          ? '0 3px 10px rgba(34,197,94,0.35)'
                          : '0 3px 10px rgba(239,68,68,0.35)',
                      }}
                    >Nhận</button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* ── Dò số ── */}
          <div className="card" style={{ padding: 28, background: 'linear-gradient(135deg, #eff6ff 0%, #fff 60%)' }}>
            <SectionHeader
              icon="🎱"
              title="Dò số trúng thưởng"
              subtitle="Mỗi ngày sàn công bố 1 dãy 6 số — trùng nhiều số theo đúng vị trí, thưởng càng lớn!"
            />

            {/* Đếm ngược */}
            <div style={{
              background: 'linear-gradient(135deg, #1e1b4b, #312e81)',
              borderRadius: 14, padding: '24px 20px', marginBottom: 16,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
            }}>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', marginBottom: 8 }}>🕛 Số sàn mới công bố sau</p>
              <p style={{ fontSize: 36, fontWeight: 800, color: '#c4b5fd', letterSpacing: 4, lineHeight: 1 }}>
                {formatCountdown(countdown)}
              </p>
            </div>

            {/* Số vé */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <p style={{ fontSize: 13, fontWeight: 700 }}>🎫 Số vé của bạn</p>
              <button
                onClick={handleRerollTicket}
                disabled={lotteryPlayed}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '6px 12px', borderRadius: 99,
                  border: '1.5px solid var(--primary)', background: 'white', color: 'var(--primary)',
                  cursor: lotteryPlayed ? 'not-allowed' : 'pointer', opacity: lotteryPlayed ? 0.45 : 1,
                }}
              >
                🔄 Đổi số khác
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
              {userTicket.split('').map((d, i) => {
                const matched = lotteryResult ? lotteryResult.ticket[i] === lotteryResult.official[i] : false
                return (
                  <div key={i} style={{
                    width: 46, height: 56, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: 22,
                    border: matched ? 'none' : '2px solid var(--primary)',
                    background: matched ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'white',
                    color: matched ? 'white' : 'var(--primary)',
                    boxShadow: matched ? '0 4px 12px rgba(124,58,237,0.35)' : 'none',
                    transition: 'all 0.3s',
                  }}>{d}</div>
                )
              })}
            </div>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 22 }}>
              {lotteryPlayed ? '🔒 Số vé đã khóa cho hôm nay.' : 'Đổi số bao nhiêu lần tùy ý trước khi bấm "Dò số ngay".'}
            </p>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={handlePlayLottery}
                disabled={lotteryPlayed}
                style={{
                  padding: '12px 28px', borderRadius: 12, border: 'none', fontSize: 15, fontWeight: 700,
                  cursor: lotteryPlayed ? 'not-allowed' : 'pointer',
                  background: lotteryPlayed ? 'var(--gray-100)' : 'linear-gradient(135deg, #1e40af, #3b82f6)',
                  color: lotteryPlayed ? 'var(--gray-400)' : 'white',
                  boxShadow: lotteryPlayed ? 'none' : '0 4px 16px rgba(59,130,246,0.35)',
                }}
              >
                {lotteryPlayed ? '✅ Đã dò số hôm nay' : '🔍 Dò số ngay'}
              </button>

              {/* TEST ONLY */}
              <button
                onClick={() => {
                  Object.keys(localStorage).forEach(k => { if (k.includes('buyzo_lottery')) localStorage.removeItem(k) })
                  Object.keys(localStorage).forEach(k => { if (k.includes('buyzo_lottery_ticket')) localStorage.removeItem(k) })
                  setLotteryPlayed(false)
                  setLotteryResult(undefined)
                  setUserTicket(getUserTicketToday())
                }}
                style={{
                  fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px dashed #f87171',
                  background: '#fff1f2', color: '#b91c1c', cursor: 'pointer',
                }}
              >🧪 [Test] Reset dò số</button>
            </div>

            {lotteryResult && (
              <div style={{
                marginTop: 18, padding: '14px 18px',
                background: lotteryResult.matches >= 3 ? 'linear-gradient(135deg,#ecfdf5,#d1fae5)' : 'var(--gray-50)',
                borderRadius: 12,
                border: `1.5px solid ${lotteryResult.matches >= 3 ? '#6ee7b7' : 'var(--gray-200)'}`,
              }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: lotteryResult.matches >= 3 ? '#065f46' : 'var(--gray-600)' }}>
                  {lotteryResult.matches >= 3 ? '🎉 ' : ''}{lotteryResult.rewardLabel}
                </p>
                {lotteryResult.matches > 0 && (
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>Trùng {lotteryResult.matches}/6 số</p>
                )}
              </div>
            )}
          </div>

          {/* ── Voucher ── */}
          {vouchers.length > 0 && (
            <div className="card" style={{ padding: 28 }}>
              <SectionHeader icon="🎟️" title="Voucher từ sự kiện" />
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
                {vouchers.slice(0, 9).map(v => (
                  <div key={v.code} style={{
                    padding: '14px 16px',
                    background: 'linear-gradient(135deg, #fff7ed, #fef3c7)',
                    border: '1.5px dashed #fbbf24', borderRadius: 12,
                    position: 'relative', overflow: 'hidden',
                  }}>
                    <div style={{
                      position: 'absolute', top: -16, right: -16, width: 60, height: 60,
                      borderRadius: '50%', background: 'rgba(251,191,36,0.15)',
                    }} />
                    <p style={{ fontWeight: 700, fontSize: 13, color: '#92400e', lineHeight: 1.3 }}>{v.label}</p>
                    <p style={{
                      fontSize: 11, color: '#b45309', marginTop: 8,
                      fontFamily: 'monospace', letterSpacing: 1.5, fontWeight: 600,
                    }}>{v.code}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
      </div>{/* end position:relative */}
    </div>
  )
}

export default EventsPage
