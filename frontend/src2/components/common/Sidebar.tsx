import React from 'react'
import { NavLink, useLocation } from 'react-router-dom'

interface SidebarItem { icon: string; label: string; path: string }
interface SidebarProps { items: SidebarItem[]; title?: string }

const Sidebar: React.FC<SidebarProps> = ({ items, title }) => (
  <aside style={{ width: 220, flexShrink: 0 }}>
    <div className="card" style={{ padding: '8px 0', position: 'sticky', top: 80 }}>
      {title && (
        <div style={{ padding: '12px 20px 8px', fontWeight: 700, fontSize: 13, color: 'var(--gray-500)', textTransform: 'uppercase', letterSpacing: 1 }}>
          {title}
        </div>
      )}
      {items.map(item => (
        <NavLink
          key={item.path}
          to={item.path}
          end
          style={({ isActive }) => ({
            display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px',
            fontSize: 14, fontWeight: isActive ? 600 : 400,
            color: isActive ? 'var(--primary)' : 'var(--gray-700)',
            background: isActive ? '#fff0ed' : 'transparent',
            borderRight: isActive ? '3px solid var(--primary)' : '3px solid transparent',
            transition: 'all var(--transition)',
          })}
        >
          <span>{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </div>
  </aside>
)

export default Sidebar
