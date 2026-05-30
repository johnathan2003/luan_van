import React, { useState } from 'react'
import { toast } from 'react-toastify'
import Navbar from '../components/common/Navbar'
import Footer from '../components/common/Footer'
import Header from '../components/common/Header'
import RoleSwitcher from '../components/auth/RoleSwitcher'
import { useAuth } from '../hooks/useAuth'
import { useAppDispatch } from '../store/hooks'
import { updateProfile } from '../store/slices/authSlice'
import { userService } from '../services/userService'
import { getImageUrl } from '../utils/helpers'

const ProfilePage: React.FC = () => {
  const { user } = useAuth()
  const dispatch = useAppDispatch()
  const [form, setForm] = useState({ full_name: user?.full_name || '', phone: user?.phone || '', address: user?.address || '' })
  const [pwForm, setPwForm] = useState({ old_password: '', new_password: '', confirm: '' })
  const [saving, setSaving] = useState(false)

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try { await dispatch(updateProfile(form)); toast.success('Đã lưu hồ sơ') }
    catch { toast.error('Lỗi lưu hồ sơ') }
    finally { setSaving(false) }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwForm.new_password !== pwForm.confirm) { toast.warning('Mật khẩu không khớp'); return }
    try { await userService.changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password }); toast.success('Đã đổi mật khẩu'); setPwForm({ old_password: '', new_password: '', confirm: '' }) }
    catch (err: any) { toast.error(err.response?.data?.detail || 'Mật khẩu cũ không đúng') }
  }

  return (
    <div className="page-wrapper">
      <Navbar />
      <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <Header title="Hồ sơ của tôi" />
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 24, alignItems: 'start' }}>
          {/* Avatar card */}
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>
            <div style={{ width: 88, height: 88, borderRadius: '50%', background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, fontWeight: 700, margin: '0 auto 16px' }}>
              {user?.avatar_url ? <img src={getImageUrl(user.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} /> : user?.full_name?.[0]?.toUpperCase() || '?'}
            </div>
            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{user?.full_name || 'Chưa đặt tên'}</p>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 16 }}>{user?.email}</p>
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-600)', marginBottom: 8 }}>Vai trò của tôi</p>
              <RoleSwitcher />
            </div>
          </div>

          {/* Forms */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* Profile form */}
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Thông tin cá nhân</h2>
              <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                  <div><label className="input-label">Họ và tên</label><input className="input" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
                  <div><label className="input-label">Số điện thoại</label><input className="input" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
                </div>
                <div><label className="input-label">Địa chỉ</label><input className="input" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} /></div>
                <div><button type="submit" disabled={saving} className="btn btn-primary" style={{ alignSelf: 'flex-start' }}>{saving ? 'Đang lưu...' : 'Lưu thay đổi'}</button></div>
              </form>
            </div>

            {/* Password form */}
            <div className="card" style={{ padding: 28 }}>
              <h2 style={{ fontWeight: 700, fontSize: 17, marginBottom: 20 }}>Đổi mật khẩu</h2>
              <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[['Mật khẩu hiện tại', 'old_password'], ['Mật khẩu mới', 'new_password'], ['Xác nhận mật khẩu mới', 'confirm']].map(([label, key]) => (
                  <div key={key}><label className="input-label">{label}</label><input className="input" type="password" value={(pwForm as any)[key]} onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))} /></div>
                ))}
                <div><button type="submit" className="btn btn-outline" style={{ alignSelf: 'flex-start' }}>Đổi mật khẩu</button></div>
              </form>
            </div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}

export default ProfilePage
