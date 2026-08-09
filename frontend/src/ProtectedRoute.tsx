import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from './store/hooks'

interface ProtectedRouteProps {
  requiredRole?: string
  /** Ngược với requiredRole: nếu user có bất kỳ role nào trong danh sách này
   * (cách nhau bởi "|") thì bị chặn, dù đã đăng nhập. Dùng cho các route
   * "khách hàng" (giỏ hàng/thanh toán/đăng ký shop-shipper...) để nhân viên
   * nội bộ (Admin_emp/quản lý kho các cấp) không mua/bán được trên sàn. */
  blockRoles?: string
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole, blockRoles }) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const location = useLocation()

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (requiredRole) {
    // Hỗ trợ multi-role: "hub_manager|district_manager|admin"
    const allowedRoles = requiredRole.split('|').map(r => r.trim())
    const hasRole = user?.roles?.some((r: any) => allowedRoles.includes(r.role_name))
    if (!hasRole) {
      return <Navigate to="/" replace />
    }
  }

  if (blockRoles) {
    const blocked = blockRoles.split('|').map(r => r.trim())
    const hasBlockedRole = user?.roles?.some((r: any) => blocked.includes(r.role_name))
    if (hasBlockedRole) {
      return <Navigate to="/" replace />
    }
  }

  return <Outlet />
}

export default ProtectedRoute
