import React, { useEffect, useState } from 'react'
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

const EventsPage: React.FC = () => {
  const [xu, setXu] = useState(getXu())
  const [checkinInfo, setCheckinInfo] = useState(getCheckinInfo())
  const [missions, setMissions] = useState(getMissionsToday())
  const [lotteryResult, setLotteryResult] = useState(getLastLotteryResult())
  const [lotteryPlayed, setLotteryPlayed] = useState(!canPlayLotteryToday())
  const [userTicket, setUserTicket] = useState(getUserTicketToday())
  const [countdown, setCountdown] = useState(msUntilMidnight())

  useEffect(() => {
    // lam moi 1 lan khi vao trang (nhiem vu co the duoc tich trong luc luot trang khac)
    setMissions(getMissionsToday())
    setCheckinInfo(getCheckinInfo())
  }, [])

  // dem ngược tới 00:00 — luc so san moi duoc cong bo
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
    if (reward.type === 'none') {
      toast.info(reward.label)
    } else {
      toast.success(`Chúc mừng! Bạn nhận được ${reward.label} 🎉`)
    }
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
      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontWeight: 700, fontSize: 22 }}>🎁 Sự kiện</h1>
            <p style={{ color: 'var(--gray-500)', fontSize: 14, marginTop: 4 }}>Điểm danh, quay số, làm nhiệm vụ để nhận xu và voucher mỗi ngày</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 'var(--radius-full)', padding: '10px 18px' }}>
            <span style={{ fontSize: 20 }}>🪙</span>
            <div>
              <p style={{ fontSize: 11, color: 'var(--gray-500)' }}>Số dư xu</p>
              <p style={{ fontWeight: 700, fontSize: 17, color: '#b45309' }}>{xu.toLocaleString('vi-VN')}</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Điểm danh ── */}
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Điểm danh hàng ngày</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
              Streak hiện tại: <strong>{checkinInfo.streak} ngày</strong> — điểm danh liên tục để nhận thưởng tăng dần, ngày thứ 7 nhận thưởng lớn!
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 10, marginBottom: 22 }}>
              {CHECKIN_REWARDS.map((reward, i) => {
                const isToday = checkinInfo.checkedToday ? i === checkinInfo.dayInCycle : i === checkinInfo.dayInCycle
                const isPast = checkinInfo.checkedToday ? i < checkinInfo.dayInCycle || i === checkinInfo.dayInCycle : i < checkinInfo.dayInCycle
                return (
                  <div key={i} style={{
                    textAlign: 'center', padding: '14px 4px', borderRadius: 'var(--radius)',
                    background: isToday && checkinInfo.checkedToday ? 'var(--primary)' : isToday ? '#fff7ed' : isPast ? 'var(--gray-100)' : 'var(--gray-50)',
                    border: isToday && !checkinInfo.checkedToday ? '2px dashed var(--primary)' : '1px solid transparent',
                  }}>
                    <p style={{ fontSize: 11, fontWeight: 600, color: isToday && checkinInfo.checkedToday ? 'white' : 'var(--gray-500)' }}>Ngày {i + 1}</p>
                    <p style={{ fontSize: 16, marginTop: 4 }}>{isToday && checkinInfo.checkedToday ? '✅' : '🪙'}</p>
                    <p style={{ fontSize: 12, fontWeight: 700, color: isToday && checkinInfo.checkedToday ? 'white' : 'var(--gray-700)' }}>{reward}</p>
                  </div>
                )
              })}
            </div>
            <button
              onClick={handleCheckin}
              disabled={checkinInfo.checkedToday}
              className="btn btn-primary"
              style={{ opacity: checkinInfo.checkedToday ? 0.6 : 1, cursor: checkinInfo.checkedToday ? 'not-allowed' : 'pointer' }}
            >
              {checkinInfo.checkedToday ? '✅ Đã điểm danh hôm nay' : `Điểm danh ngay (+${checkinInfo.nextReward} xu)`}
            </button>
          </div>

        {/* ── Vòng quay ── */}
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Vòng quay may mắn</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 24 }}>
              Mỗi ngày được quay 1 lượt miễn phí, có cơ hội nhận xu hoặc voucher giảm giá
            </p>
            <LuckyWheel onResult={handleSpinResult} />
          </div>

        {/* ── Nhiệm vụ ── */}
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Nhiệm vụ hôm nay</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
              Hoàn thành nhiệm vụ bằng cách lướt xem sản phẩm/cửa hàng thật trên BuyZo để nhận xu
            </p>
            {missions.map(m => (
              <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px 0', borderBottom: '1px solid var(--gray-100)' }}>
                <span style={{ fontSize: 26 }}>{m.icon}</span>
                <div style={{ flex: 1 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, marginBottom: 6 }}>{m.label}</p>
                  <div style={{ height: 8, background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(100, (m.progress / m.target) * 100)}%`, background: m.done ? '#10b981' : 'var(--primary)', transition: 'width 0.3s' }} />
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 4 }}>{m.progress}/{m.target} · Thưởng {m.reward} xu</p>
                </div>
                <button
                  onClick={() => handleClaimMission(m.key)}
                  disabled={!m.done || m.claimed}
                  className="btn btn-sm"
                  style={{
                    background: m.claimed ? 'var(--gray-100)' : m.done ? 'var(--primary)' : 'var(--gray-100)',
                    color: m.claimed ? 'var(--gray-400)' : m.done ? 'white' : 'var(--gray-400)',
                    border: 'none', cursor: (!m.done || m.claimed) ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {m.claimed ? 'Đã nhận' : m.done ? 'Nhận xu' : 'Chưa xong'}
                </button>
              </div>
            ))}
          </div>

        {/* ── Dò số ── */}
          <div className="card" style={{ padding: 28 }}>
            <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 6 }}>Dò số trúng thưởng</h2>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 20 }}>
              Mỗi ngày sàn công bố 1 dãy 6 số. So khớp với số vé của bạn theo đúng vị trí — trùng nhiều số, thưởng lớn!
            </p>

            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>🏛️ Số sàn công bố hôm nay</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              {officialNumber.split('').map((d, i) => (
                <div key={i} style={{ width: 42, height: 52, background: 'var(--gray-900)', color: 'white', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 20 }}>
                  {d}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 20 }}>
              🕛 Sàn công bố số mới vào lúc 00:00 mỗi ngày — số tiếp theo sau <strong>{formatCountdown(countdown)}</strong>
            </p>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <p style={{ fontSize: 13, fontWeight: 600 }}>🎫 Số vé của bạn</p>
              <button
                onClick={handleRerollTicket}
                disabled={lotteryPlayed}
                style={{
                  fontSize: 12, fontWeight: 600, padding: '4px 10px', borderRadius: 'var(--radius-full)',
                  border: '1px solid var(--primary)', background: 'white', color: 'var(--primary)',
                  cursor: lotteryPlayed ? 'not-allowed' : 'pointer', opacity: lotteryPlayed ? 0.5 : 1,
                }}
              >
                🔄 Đổi số khác
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              {userTicket.split('').map((d, i) => {
                const matched = lotteryResult ? lotteryResult.ticket[i] === lotteryResult.official[i] : false
                return (
                  <div key={i} style={{
                    width: 42, height: 52, borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 700, fontSize: 20, border: '2px solid var(--primary)',
                    background: matched ? 'var(--primary)' : 'white', color: matched ? 'white' : 'var(--primary)',
                  }}>
                    {d}
                  </div>
                )
              })}
            </div>
            <p style={{ fontSize: 12, color: 'var(--gray-400)', marginBottom: 24 }}>
              {lotteryPlayed ? 'Số vé đã khóa cho hôm nay.' : 'Bạn có thể đổi số bao nhiêu lần tùy ý trước khi bấm "Dò số ngay".'}
            </p>

            <button
              onClick={handlePlayLottery}
              disabled={lotteryPlayed}
              className="btn btn-primary"
              style={{ opacity: lotteryPlayed ? 0.6 : 1, cursor: lotteryPlayed ? 'not-allowed' : 'pointer' }}
            >
              {lotteryPlayed ? '✅ Đã dò số hôm nay' : '🔍 Dò số ngay'}
            </button>

            {lotteryResult && (
              <div style={{ marginTop: 18, padding: 14, background: lotteryResult.matches >= 3 ? '#ecfdf5' : 'var(--gray-50)', borderRadius: 'var(--radius)', border: `1px solid ${lotteryResult.matches >= 3 ? '#a7f3d0' : 'var(--gray-200)'}` }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{lotteryResult.rewardLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Voucher đã nhận từ sự kiện */}
        {vouchers.length > 0 && (
          <div className="card" style={{ padding: 24, marginTop: 20 }}>
            <h2 style={{ fontWeight: 700, fontSize: 16, marginBottom: 14 }}>🎟️ Voucher từ sự kiện</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
              {vouchers.slice(0, 8).map(v => (
                <div key={v.code} style={{ padding: 12, border: '1px dashed #fdba74', background: '#fff7ed', borderRadius: 'var(--radius)' }}>
                  <p style={{ fontWeight: 700, fontSize: 13, color: '#b45309' }}>{v.label}</p>
                  <p style={{ fontSize: 11, color: 'var(--gray-500)', marginTop: 4 }}>Mã: {v.code}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default EventsPage
