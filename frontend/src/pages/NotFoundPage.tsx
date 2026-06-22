import React from 'react'
import { Link } from 'react-router-dom'

const NotFoundPage: React.FC = () => (
  <div className="page-wrapper">

    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 20px', textAlign: 'center' }}>
      <div style={{ fontSize: 80, marginBottom: 20 }}>🔍</div>
      <h1 style={{ fontSize: 32, fontWeight: 800, marginBottom: 12, color: 'var(--gray-800)' }}>404 - Không tìm thấy</h1>
      <p style={{ fontSize: 16, color: 'var(--gray-500)', marginBottom: 32 }}>Trang bạn đang tìm kiếm không tồn tại hoặc đã bị xóa.</p>
      <Link to="/" className="btn btn-primary btn-lg">← Về trang chủ</Link>
    </div>
  </div>
)

export default NotFoundPage
