/**
 * EmployeeDashboard — trang trung gian, tự redirect dựa vào quyền.
 * Employee không thấy trang này lâu.
 */
import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import API from '../../services/api'
import EmployeeLayout from './EmployeeLayout'

const EmployeeDashboard: React.FC = () => {
  const navigate = useNavigate()

  useEffect(() => {
    API.get('/api/v1/employee/me').then(r => {
      const perms: string[] = r.data?.permissions ?? []
      if (perms.includes('order:read')) {
        navigate('/employee/orders', { replace: true })
      } else if (perms.includes('message:read')) {
        navigate('/employee/messages', { replace: true })
      } else if (perms.includes('product:update')) {
        navigate('/employee/products', { replace: true })
      }
      // Nếu không có quyền nào được map → ở lại trang này hiện thông báo
    }).catch(() => {})
  }, [])

  return (
    <EmployeeLayout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div style={{ textAlign: 'center', color: '#64748B' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⏳</div>
          <p style={{ fontSize: 14 }}>Đang chuyển tới trang làm việc...</p>
          <p style={{ fontSize: 12, marginTop: 8, color: '#94A3B8' }}>
            Nếu không thấy gì, liên hệ quản lý shop để được phân quyền.
          </p>
        </div>
      </div>
    </EmployeeLayout>
  )
}

export default EmployeeDashboard
