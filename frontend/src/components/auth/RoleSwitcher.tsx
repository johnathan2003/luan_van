import React from 'react'
import { useAuth } from '../../hooks/useAuth'
import { ROLE_LABELS } from '../../utils/constants'

const RoleSwitcher: React.FC = () => {
  const { user, currentRole, switchRole } = useAuth()
  const roles = user?.roles?.filter(r => r.status === 'active') || []
  if (roles.length <= 1) return null

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {roles.map(r => (
        <button
          key={r.role_name}
          onClick={() => switchRole(r.role_name)}
          className={`btn btn-sm ${currentRole === r.role_name ? 'btn-primary' : 'btn-outline'}`}
        >
          {ROLE_LABELS[r.role_name] || r.role_name}
        </button>
      ))}
    </div>
  )
}

export default RoleSwitcher
