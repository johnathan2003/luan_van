import React, { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAppSelector } from './store/hooks'
import { getEmployeeTier } from './utils/warehouseRole'

interface ProtectedRouteProps {
  requiredRole?: string
  /** Ngược với requiredRole: nếu user có bất kỳ role nào trong danh sách này
   * (cách nhau bởi "|") thì bị chặn, dù đã đăng nhập. Dùng cho các route
   * "khách hàng" (giỏ hàng/thanh toán/đăng ký shop-shipper...) để nhân viên
   * nội bộ (Admin_emp/quản lý kho các cấp) không mua/bán được trên sàn. */
  blockRoles?: string
  /** Chỉ dùng cho route /hub, /district, /ward. Role "employee" giờ dùng
   * CHUNG cho nhân viên shop lẫn nhân viên kho — requiredRole="employee"
   * không đủ để phân biệt tier, cần gọi thêm API xác nhận tier thật.
   * Admin luôn được qua không cần check. */
  requireEmployeeTier?: 'hub' | 'district' | 'ward'
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ requiredRole, blockRoles, requireEmployeeTier }) => {
  const { isAuthenticated, user } = useAppSelector((state) => state.auth)
  const location = useLocation()
  const isAdmin = !!user?.roles?.some((r: any) => r.role_name === 'admin')
  const [tierChecked, setTierChecked] = useState(!requireEmployeeTier)
  const [tierOk, setTierOk]           = useState(false)

  useEffect(() => {
    if (!requireEmployeeTier || !isAuthenticated) return
    if (isAdmin) { setTierOk(true); setTierChecked(true); return }
    let cancelled = false
    getEmployeeTier().then(t => {
      if (!cancelled) { setTierOk(t === requireEmployeeTier); setTierChecked(true) }
    })
    return () => { cancelled = true }
  }, [requireEmployeeTier, isAuthenticated, isAdmin])

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

  if (requireEmployeeTier) {
    if (!tierChecked) return null
    if (!tierOk) return <Navigate to="/" replace />
  }

  return <Outlet />
}

export default ProtectedRoute
