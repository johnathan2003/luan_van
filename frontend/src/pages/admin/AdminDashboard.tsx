import React, { useEffect, useState } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import Navbar from '../../components/common/Navbar'
import Sidebar from '../../components/common/Sidebar'
import DashboardWidget from '../../components/admin/Dashboard'
import Loading from '../../components/common/Loading'
import { adminService } from '../../services/adminService'

const ADMIN_MENU = [
  { icon: '📊', label: 'Tổng quan', path: '/admin' },
  { icon: '👥', label: 'Người dùng', path: '/admin/users' },
  { icon: '✅', label: 'Phê duyệt', path: '/admin/approvals' },
  { icon: '🏆', label: 'Duyệt Mall', path: '/admin/mall-requests' },
  { icon: '🗑️', label: 'Xóa sản phẩm', path: '/admin/deletion-requests' },
  { icon: '⚖️', label: 'Khiếu nại', path: '/admin/disputes' },
  { icon: '🧑‍💼', label: 'Nhân viên HT', path: '/admin/system-employees' },
  { icon: '📋', label: 'Nhật ký', path: '/admin/logs' },
]

const AdminOverview: React.FC = () => {
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    adminService.getDashboard().then(r => setData(r.data)).finally(() => setLoading(false))
  }, [])

  if (loading) return <Loading />
  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 24 }}>Tổng quan hệ thống</h2>
      {data && <DashboardWidget data={data} />}
    </div>
  )
}

const AdminDashboard: React.FC = () => {
  const location = useLocation()
  const isRoot = location.pathname === '/admin'

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="container" style={{ paddingTop: 28, paddingBottom: 40, display: 'flex', gap: 24 }}>
        <Sidebar items={ADMIN_MENU} title="Quản trị" />
        <main style={{ flex: 1, minWidth: 0 }}>
          {isRoot ? <AdminOverview /> : <Outlet />}
        </main>
      </div>
    </div>
  )
}

export default AdminDashboard
