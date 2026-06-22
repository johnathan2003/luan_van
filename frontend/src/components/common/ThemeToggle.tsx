import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { THEME_MODE_ICONS, THEME_MODE_LABELS } from '../../utils/theme'

const MANUAL_MODES = ['light', 'dark'] as const

/** Nút chuyển theme — fixed góc dưới phải màn hình */
const ThemeToggle: React.FC = () => {
  const { themeMode, resolvedTheme, setMode } = useTheme()
  const active = themeMode === 'auto' ? resolvedTheme : themeMode
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()

  const currentIcon = THEME_MODE_ICONS[active as keyof typeof THEME_MODE_ICONS] || '🌙'

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 8,
      }}
    >
      {/* Dropdown menu — hiện khi hover/click */}
      {open && (
        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-lg)',
            boxShadow: 'var(--shadow-lg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {MANUAL_MODES.map(mode => (
            <button
              key={mode}
              type="button"
              title={THEME_MODE_LABELS[mode]}
              onClick={() => { setMode(mode); setOpen(false) }}
              style={{
                border: 'none',
                cursor: 'pointer',
                padding: '10px 16px',
                fontSize: 13,
                fontWeight: active === mode ? 700 : 400,
                background: active === mode ? 'var(--bg-highlight, var(--gray-100))' : 'transparent',
                color: active === mode ? 'var(--primary)' : 'var(--text-primary)',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                whiteSpace: 'nowrap',
                transition: 'background 0.15s',
                textAlign: 'left',
              }}
              onMouseEnter={e => { if (active !== mode) e.currentTarget.style.background = 'var(--bg-highlight, var(--gray-50))' }}
              onMouseLeave={e => { if (active !== mode) e.currentTarget.style.background = 'transparent' }}
            >
              <span>{THEME_MODE_ICONS[mode]}</span>
              <span>{THEME_MODE_LABELS[mode]}</span>
            </button>
          ))}
        </div>
      )}

      {/* Nut theo doi don hang */}
      <button
        type="button"
        aria-label="Theo dõi đơn hàng"
        title="Theo dõi đơn hàng"
        onClick={() => navigate('/orders')}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'box-shadow 0.2s, transform 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        📦
      </button>

      {/* Nut su kien (tich xu, vong quay, nhiem vu, do so) */}
      <button
        type="button"
        aria-label="Sự kiện"
        title="Sự kiện"
        onClick={() => navigate('/events')}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'box-shadow 0.2s, transform 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        🎁
      </button>

      {/* Toggle button */}
      <button
        type="button"
        aria-label="Chuyển đổi giao diện"
        onClick={() => setOpen(o => !o)}
        style={{
          width: 44,
          height: 44,
          borderRadius: '50%',
          border: '1px solid var(--border-subtle)',
          background: 'var(--bg-card)',
          boxShadow: 'var(--shadow-md)',
          cursor: 'pointer',
          fontSize: 20,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'box-shadow 0.2s, transform 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.transform = 'scale(1.08)' }}
        onMouseLeave={e => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'scale(1)' }}
      >
        {currentIcon}
      </button>
    </div>
  )
}

export default ThemeToggle
