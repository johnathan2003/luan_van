/**
 * EmployeeLayout — top bar tối giản, không sidebar.
 * Employee chỉ thấy đúng 1 trang phù hợp với quyền.
 */
import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const EmployeeLayout: React.FC<{ children: React.ReactNode; shopName?: string }> = ({ children, shopName }) => {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    signOut()
    navigate('/login')
  }

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <header style={{
        background: '#0F172A', color: '#CBD5E1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 52, flexShrink: 0,
        boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>👷</span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#fff' }}>
            {shopName || 'Nhân viên'}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 13, color: '#94A3B8' }}>{user?.email}</span>
          <button onClick={handleLogout} style={{
            padding: '5px 14px', background: 'transparent', border: '1px solid #334155',
            borderRadius: 6, color: '#F87171', fontSize: 12, fontWeight: 600, cursor: 'pointer',
          }}>
            Đăng xuất
          </button>
        </div>
      </header>

      {/* Content */}
      <main style={{ flex: 1, padding: 24 }}>
        {children}
      </main>
    </div>
  )
}

export default EmployeeLayout
