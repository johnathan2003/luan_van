import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from './store/hooks'

interface ProtectedRouteProps {
  requiredRole?: string
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole }) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole) {
    const hasRole = user?.roles?.some((r: any) => r.role_name === requiredRole)
    if (!hasRole) {
      return <Navigate to="/" replace />
    }
  }

  return <Outlet />
}

export default ProtectedRoute
