import React, { useEffect, useState } from 'react'

interface Props {
  /** Thời điểm kết thúc flash sale */
  endAt?: Date
  /** Số giây đếm ngược (mặc định 2h) nếu không truyền endAt */
  durationSeconds?: number
  label?: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function getRemaining(end: Date) {
  const diff = Math.max(0, end.getTime() - Date.now())
  const h = Math.floor(diff / 3_600_000)
  const m = Math.floor((diff % 3_600_000) / 60_000)
  const s = Math.floor((diff % 60_000) / 1000)
  return { h, m, s, done: diff <= 0 }
}

const FlashTimer: React.FC<Props> = ({
  endAt,
  durationSeconds = 7200,
  label = 'Flash Sale',
}) => {
  const [end] = useState(() => endAt ?? new Date(Date.now() + durationSeconds * 1000))
  const [time, setTime] = useState(() => getRemaining(end))

  useEffect(() => {
    const id = window.setInterval(() => setTime(getRemaining(end)), 1000)
    return () => window.clearInterval(id)
  }, [end])

  if (time.done) return null

  return (
    <div
      className="flash-timer"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'var(--flash-timer-bg)',
        color: 'var(--flash-timer-text)',
        padding: '8px 16px',
        borderRadius: 'var(--radius-full)',
        fontWeight: 700,
        fontSize: 14,
        boxShadow: 'var(--shadow-md)',
        border: 'var(--flash-timer-border, none)',
      }}
    >
      <span>⚡ {label}</span>
      <span style={{ opacity: 0.85, fontWeight: 500 }}>|</span>
      <span style={{ fontVariantNumeric: 'tabular-nums', letterSpacing: 1 }}>
        {pad(time.h)}:{pad(time.m)}:{pad(time.s)}
      </span>
    </div>
  )
}

export default FlashTimer
