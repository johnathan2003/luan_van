import React from 'react'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: React.ReactNode
}

const Header: React.FC<HeaderProps> = ({ title, subtitle, action }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-6)' }}>
    <div>
      <h1 style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--gray-900)', marginBottom: subtitle ? 4 : 0 }}>{title}</h1>
      {subtitle && <p style={{ color: 'var(--gray-500)', fontSize: 'var(--font-size-sm)' }}>{subtitle}</p>}
    </div>
    {action && <div>{action}</div>}
  </div>
)

export default Header
