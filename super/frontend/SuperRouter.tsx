/**
 * super/frontend/SuperRouter.tsx
 * --------------------------------
 * Routes cho khu vực /super/*.
 * SuperGuard kiểm tra super_token (JWT) — không dùng Redux auth state.
 */
import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import SuperLogin   from './SuperLogin'
import SuperLayout  from './SuperLayout'
import SuperDashboard from './pages/SuperDashboard'
import SuperProducts  from './pages/SuperProducts'
import SuperOrders    from './pages/SuperOrders'
import SuperUsers     from './pages/SuperUsers'

/** Guard: kiểm tra super_token trong localStorage */
const SuperGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const token = localStorage.getItem('super_token')
  if (!token) return <Navigate to="/super/login" replace />
  return <>{children}</>
}

const SuperRouter: React.FC = () => (
  <Routes>
    {/* Login — không cần layout */}
    <Route path="login" element={<SuperLogin />} />

    {/* Protected — bọc trong SuperLayout */}
    <Route path="*" element={
      <SuperGuard>
        <SuperLayout>
          <Routes>
            <Route index           element={<SuperDashboard />} />
            <Route path="products" element={<SuperProducts />} />
            <Route path="orders"   element={<SuperOrders />} />
            <Route path="users"    element={<SuperUsers />} />
            <Route path="*"        element={<Navigate to="/super" replace />} />
          </Routes>
        </SuperLayout>
      </SuperGuard>
    } />
  </Routes>
)

export default SuperRouter
