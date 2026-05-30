import React from 'react'
import UserManagement from '../../components/admin/UserManagement'
import Header from '../../components/common/Header'

const UserManagementPage: React.FC = () => (
  <div>
    <Header title="Quản lý người dùng" subtitle="Xem và quản lý tất cả tài khoản trong hệ thống" />
    <UserManagement />
  </div>
)

export default UserManagementPage
