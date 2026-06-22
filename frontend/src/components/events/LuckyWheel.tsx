import React, { useState } from 'react'
import { SPIN_REWARDS, doSpin, canSpinToday, type SpinReward } from '../../utils/eventsStore'

interface Props {
  onResult: (reward: SpinReward) => void
}

const COLORS = ['#fee2e2', '#fef3c7', '#d1fae5', '#dbeafe', '#fce7f3', '#ede9fe', '#fff7ed', '#e0f2fe']
const SEGMENT_DEG = 360 / SPIN_REWARDS.length

const LuckyWheel: React.FC<Props> = ({ onResult }) => {
  const [rotation, setRotation] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [canSpin, setCanSpin] = useState(canSpinToday())

  const handleSpin = () => {
    if (spinning || !canSpin) return
    const result = doSpin()
    if (!result) { setCanSpin(false); return }

    setSpinning(true)
    // quay nhieu vong + dung tai vi tri index (mui ten o tren, 12h)
    const targetDeg = 360 - (result.index * SEGMENT_DEG + SEGMENT_DEG / 2)
    const extraSpins = 5 * 360
    const finalRotation = rotation - (rotation % 360) + extraSpins + targetDeg

    setRotation(finalRotation)

    setTimeout(() => {
      setSpinning(false)
      setCanSpin(false)
      onResult(result.reward)
    }, 3200)
  }

  // conic-gradient cho banh xe
  const gradient = SPIN_REWARDS
    .map((_, i) => `${COLORS[i % COLORS.length]} ${i * SEGMENT_DEG}deg ${(i + 1) * SEGMENT_DEG}deg`)
    .join(', ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <div style={{ position: 'relative', width: 280, height: 280 }}>
        {/* mui ten */}
        <div style={{
          position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
          width: 0, height: 0, borderLeft: '14px solid transparent', borderRight: '14px solid transparent',
          borderTop: '24px solid var(--primary)', zIndex: 2,
        }} />
        <div
          style={{
            width: 280, height: 280, borderRadius: '50%',
            background: `conic-gradient(${gradient})`,
            border: '6px solid white', boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            position: 'relative', transition: spinning ? 'transform 3.2s cubic-bezier(0.17, 0.89, 0.32, 1)' : 'none',
            transform: `rotate(${rotation}deg)`,
          }}
        >
          {SPIN_REWARDS.map((r, i) => {
            const angle = i * SEGMENT_DEG + SEGMENT_DEG / 2
            return (
              <div
                key={i}
                style={{
                  position: 'absolute', top: '50%', left: '50%', width: 110,
                  transform: `rotate(${angle}deg) translate(38px, -10px)`,
                  transformOrigin: 'left center', fontSize: 11, fontWeight: 700,
                  color: 'var(--gray-700)', textAlign: 'center',
                }}
              >
                {r.label}
              </div>
            )
          })}
        </div>
        {/* tam banh xe */}
        <div style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 52, height: 52, borderRadius: '50%', background: 'var(--primary)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 700, fontSize: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.2)', zIndex: 1,
        }}>
          🎯
        </div>
      </div>

      <button
        onClick={handleSpin}
        disabled={spinning || !canSpin}
        className="btn btn-primary"
        style={{ minWidth: 180, opacity: (spinning || !canSpin) ? 0.6 : 1, cursor: (spinning || !canSpin) ? 'not-allowed' : 'pointer' }}
      >
        {spinning ? 'Đang quay...' : canSpin ? '🎰 Quay ngay (1 lượt/ngày)' : 'Đã quay hôm nay, mai quay tiếp!'}
      </button>
    </div>
  )
}

export default LuckyWheel
