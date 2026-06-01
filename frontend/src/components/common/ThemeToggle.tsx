import React from 'react'
import { useTheme } from '../../hooks/useTheme'
import { THEME_MODE_ICONS, THEME_MODE_LABELS } from '../../utils/theme'

const MANUAL_MODES = ['light', 'dark'] as const

const ThemeToggle: React.FC = () => {
  const { themeMode, resolvedTheme, setMode } = useTheme()
  /** Auto chạy ngầm theo giờ — nút active theo giao diện đang hiển thị */
  const active = themeMode === 'auto' ? resolvedTheme : themeMode

  return (
    <div
      role="group"
      aria-label="Chế độ giao diện"
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--theme-toggle-bg, rgba(255,255,255,0.15))',
        borderRadius: 'var(--radius-full)',
        padding: 3,
        gap: 2,
      }}
    >
      {MANUAL_MODES.map(mode => (
        <button
          key={mode}
          type="button"
          title={THEME_MODE_LABELS[mode]}
          aria-pressed={active === mode}
          onClick={() => setMode(mode)}
          style={{
            border: 'none',
            cursor: 'pointer',
            borderRadius: 'var(--radius-full)',
            padding: '5px 10px',
            fontSize: 13,
            fontWeight: active === mode ? 700 : 500,
            background: active === mode ? 'var(--bg-surface)' : 'transparent',
            color: active === mode ? 'var(--text-primary)' : 'var(--text-on-topbar)',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            transition: 'background var(--transition), color var(--transition)',
            whiteSpace: 'nowrap',
          }}
        >
          <span aria-hidden>{THEME_MODE_ICONS[mode]}</span>
          <span style={{ fontSize: 11 }}>{THEME_MODE_LABELS[mode]}</span>
        </button>
      ))}
    </div>
  )
}

export default ThemeToggle
