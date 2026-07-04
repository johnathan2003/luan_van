import React, { useState, useEffect, useRef, useMemo } from 'react'
import { toast } from 'react-toastify'
import { Link } from 'react-router-dom'
import Header from '../components/common/Header'
import RoleSwitcher from '../components/auth/RoleSwitcher'
import { useAuth } from '../hooks/useAuth'
import { useAppDispatch } from '../store/hooks'
import { updateProfile, setUser } from '../store/slices/authSlice'
import { userService } from '../services/userService'
import { getImageUrl } from '../utils/helpers'
import API from '../services/api'
import {
  getFollowStats, getFollowingShops, getFollowingUsers, getMyFollowers,
  type FollowedShop, type FollowedUser,
} from '../utils/followStore'

// ── Extra profile fields lưu localStorage per-user ──────────────────────────────
interface ExtraProfile { age: string; gender: string; addresses: string[] }
function loadExtra(email: string): ExtraProfile {
  try {
    const raw = JSON.parse(localStorage.getItem(`buyzo_profile_extra_${email}`) || '{}')
    return {
      age:       raw.age       || '',
      gender:    raw.gender    || '',
      addresses: Array.isArray(raw.addresses) ? raw.addresses : [],
    }
  } catch { return { age: '', gender: '', addresses: [] } }
}
function saveExtra(email: string, data: ExtraProfile) {
  localStorage.setItem(`buyzo_profile_extra_${email}`, JSON.stringify(data))
}

// ── Địa chỉ có cấu trúc (Tỉnh/Quận/Phường/Số nhà) ──────────────────────────────
interface StructuredAddress {
  province: string; district: string; ward: string; street: string
  provinceCode: number | null; districtCode: number | null
}
const emptyAddr = (): StructuredAddress => ({
  province: '', district: '', ward: '', street: '',
  provinceCode: null, districtCode: null,
})
function loadStructuredAddrs(email: string): StructuredAddress[] | null {
  try {
    const raw = JSON.parse(localStorage.getItem(`buyzo_profile_structured_addrs_${email}`) || 'null')
    return Array.isArray(raw) ? raw as StructuredAddress[] : null
  } catch { return null }
}
function saveStructuredAddrs(email: string, addrs: StructuredAddress[]) {
  localStorage.setItem(`buyzo_profile_structured_addrs_${email}`, JSON.stringify(addrs))
}
const structuredToString = (a: StructuredAddress): string =>
  [a.street.trim(), a.ward.trim(), a.district.trim(), a.province.trim()].filter(Boolean).join(', ')

// ── Geo API ─────────────────────────────────────────────────────────────────────
const GEO = 'https://provinces.open-api.vn/api'
interface ProvinceItem { code: number; name: string }
interface DistrictItem { code: number; name: string }
interface WardItem     { code: number; name: string }

// ── AddressEntry — 1 dòng địa chỉ có dropdown Tỉnh/Quận/Phường/Số nhà ─────────
interface AddressEntryProps {
  value: StructuredAddress
  onChange: (v: StructuredAddress) => void
  onRemove?: () => void
  showRemove: boolean
  index: number
  provinces: ProvinceItem[]
  inputStyle: React.CSSProperties
  labelStyle: React.CSSProperties
}
const AddressEntry: React.FC<AddressEntryProps> = ({
  value, onChange, onRemove, showRemove, index, provinces, inputStyle, labelStyle,
}) => {
  const [districts,  setDistricts]  = useState<DistrictItem[]>([])
  const [wards,      setWards]      = useState<WardItem[]>([])
  const [geoLoading, setGeoLoading] = useState(false)

  useEffect(() => {
    if (!value.provinceCode) { setDistricts([]); setWards([]); return }
    setGeoLoading(true)
    fetch(`${GEO}/p/${value.provinceCode}?depth=2`)
      .then(r => r.json())
      .then(d => setDistricts(d.districts || []))
      .catch(() => setDistricts([]))
      .finally(() => setGeoLoading(false))
  }, [value.provinceCode])

  useEffect(() => {
    if (!value.districtCode) { setWards([]); return }
    setGeoLoading(true)
    fetch(`${GEO}/d/${value.districtCode}?depth=2`)
      .then(r => r.json())
      .then(d => setWards(d.wards || []))
      .catch(() => setWards([]))
      .finally(() => setGeoLoading(false))
  }, [value.districtCode])

  const handleProvince = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = e.target.selectedOptions[0]
    onChange({ ...value, province: e.target.value, district: '', ward: '', provinceCode: opt ? Number(opt.dataset.code) : null, districtCode: null })
    setWards([])
  }
  const handleDistrict = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const opt = e.target.selectedOptions[0]
    onChange({ ...value, district: e.target.value, ward: '', districtCode: opt ? Number(opt.dataset.code) : null })
    setWards([])
  }
  const handleWard = (e: React.ChangeEvent<HTMLSelectElement>) =>
    onChange({ ...value, ward: e.target.value })

  const boxStyle: React.CSSProperties = {
    padding: 16, borderRadius: 10, marginBottom: 12,
    border: '1.5px solid #3b82f6',
    background: 'rgba(59,130,246,0.03)',
  }
  const headerStyle: React.CSSProperties = {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12,
  }

  return (
    <div style={boxStyle}>
      <div style={headerStyle}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6' }}>
          {index === 0 ? '📍 Địa chỉ chính' : `🏠 Địa chỉ ${index + 1}`}
        </span>
        {showRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Xoá địa chỉ này"
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: 'rgba(239,68,68,0.08)', border: '1.5px solid rgba(239,68,68,0.35)',
              color: '#ef4444', cursor: 'pointer', fontSize: 16, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
        {/* Tỉnh */}
        <div>
          <label style={labelStyle}>Tỉnh / Thành phố</label>
          <select value={value.province} onChange={handleProvince}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">-- Chọn tỉnh/thành phố --</option>
            {provinces.map(p => <option key={p.code} value={p.name} data-code={p.code}>{p.name}</option>)}
          </select>
        </div>
        {/* Quận */}
        <div>
          <label style={labelStyle}>Quận / Huyện</label>
          <select value={value.district} onChange={handleDistrict}
            disabled={!value.province || geoLoading}
            style={{ ...inputStyle, cursor: value.province ? 'pointer' : 'not-allowed', opacity: value.province ? 1 : 0.5 }}>
            <option value="">{geoLoading ? 'Đang tải...' : '-- Chọn quận/huyện --'}</option>
            {districts.map(d => <option key={d.code} value={d.name} data-code={d.code}>{d.name}</option>)}
          </select>
        </div>
        {/* Phường */}
        <div>
          <label style={labelStyle}>Phường / Xã</label>
          <select value={value.ward} onChange={handleWard}
            disabled={!value.district || geoLoading}
            style={{ ...inputStyle, cursor: value.district ? 'pointer' : 'not-allowed', opacity: value.district ? 1 : 0.5 }}>
            <option value="">{geoLoading ? 'Đang tải...' : '-- Chọn phường/xã --'}</option>
            {wards.map(w => <option key={w.code} value={w.name}>{w.name}</option>)}
          </select>
        </div>
        {/* Số nhà */}
        <div>
          <label style={labelStyle}>Số nhà, tên đường</label>
          <input
            style={inputStyle}
            value={value.street}
            onChange={e => onChange({ ...value, street: e.target.value })}
            placeholder="VD: 123 Nguyễn Trãi"
          />
        </div>
      </div>
    </div>
  )
}

// ── InfoRow — hiển thị 1 dòng thông tin (label trái / value phải) ──────────────
const InfoRow: React.FC<{ label: string; value?: string | null; icon?: string; last?: boolean }> = ({ label, value, icon, last }) => (
  <div style={{
    display: 'flex', alignItems: 'center',
    padding: '15px 20px',
    borderBottom: last ? 'none' : '1px solid var(--border-subtle)',
    gap: 12,
  }}>
    <span style={{ fontSize: 20, width: 28, textAlign: 'center', flexShrink: 0 }}>{icon}</span>
    <span style={{
      fontSize: 13, fontWeight: 600, color: 'var(--text-muted)',
      width: 160, flexShrink: 0,
      textTransform: 'uppercase', letterSpacing: '0.04em',
    }}>
      {label}
    </span>
    <span style={{
      flex: 1, fontSize: 15,
      color: value ? 'var(--text-primary)' : 'var(--text-muted)',
      fontStyle: value ? 'normal' : 'italic',
      fontWeight: value ? 500 : 400,
    }}>
      {value || 'Chưa cập nhật'}
    </span>
  </div>
)

// ── Main ────────────────────────────────────────────────────────────────────────
const ProfilePage: React.FC = () => {
  const { user } = useAuth()
  const dispatch  = useAppDispatch()

  // ── Social follow stats ──────────────────────────────────────────────────────
  type ModalTab = 'following' | 'followers'
  type FollowSubTab = 'shops' | 'users'

  const [socialModal, setSocialModal]     = useState<ModalTab | null>(null)
  const [followSubTab, setFollowSubTab]   = useState<FollowSubTab>('shops')
  const [socialVersion, setSocialVersion] = useState(0)  // force re-read after update

  const followStats = useMemo(() => {
    if (!user?.email) return { followingShops: 0, followingUsers: 0, myFollowers: 0 }
    return getFollowStats(user.email)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, socialVersion])

  const followingShopsList  = useMemo(() => user?.email ? getFollowingShops(user.email)  : [], [user?.email, socialVersion])
  const followingUsersList  = useMemo(() => user?.email ? getFollowingUsers(user.email)  : [], [user?.email, socialVersion])
  const myFollowersList     = useMemo(() => user?.email ? getMyFollowers(user.email)     : [], [user?.email, socialVersion])

  const openModal = (tab: ModalTab) => {
    setSocialModal(tab)
    if (tab === 'following') setFollowSubTab('shops')
    setSocialVersion(v => v + 1)
  }

  // Avatar upload
  const avatarInputRef = useRef<HTMLInputElement>(null)
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null)
  const [avatarHover, setAvatarHover]     = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.warning('Vui lòng chọn file ảnh'); return }
    if (file.size > 5 * 1024 * 1024) { toast.warning('Ảnh tối đa 5 MB'); return }

    // Preview ngay lập tức
    setAvatarPreview(URL.createObjectURL(file))
    setAvatarUploading(true)
    try {
      await userService.uploadAvatar(file)
      // Refresh user từ server để lấy avatar_url mới
      const res = await API.get('/api/v1/users/me')
      dispatch(setUser(res.data.data ?? res.data))
      toast.success('✅ Cập nhật ảnh đại diện thành công')
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Lỗi upload ảnh')
      setAvatarPreview(null)   // rollback preview nếu lỗi
    } finally {
      setAvatarUploading(false)
      // Reset input để có thể chọn lại cùng file
      if (avatarInputRef.current) avatarInputRef.current.value = ''
    }
  }

  // Extra fields từ localStorage
  const [extra, setExtra] = useState<ExtraProfile>({ age: '', gender: '', addresses: [] })
  useEffect(() => {
    if (user?.email) setExtra(loadExtra(user.email))
  }, [user?.email])

  // Provinces cho AddressEntry
  const [provinces, setProvinces] = useState<ProvinceItem[]>([])
  useEffect(() => {
    fetch(`${GEO}/p/`)
      .then(r => r.json())
      .then((d: ProvinceItem[]) => setProvinces(d))
      .catch(() => {})
  }, [])

  // Edit mode
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState<{
    full_name: string; phone: string
    addresses: StructuredAddress[]
    age: string; gender: string
  }>({
    full_name: '', phone: '',
    addresses: [emptyAddr()],
    age: '', gender: '',
  })
  const [saving, setSaving] = useState(false)

  // Password
  const [showPw, setShowPw]     = useState(false)
  const [pwForm, setPwForm]     = useState({ old_password: '', new_password: '', confirm: '' })
  const [pwSaving, setPwSaving] = useState(false)

  const startEdit = () => {
    // Ưu tiên load địa chỉ có cấu trúc đã lưu, fallback → chuỗi cũ vào street
    let initAddresses: StructuredAddress[]
    const structured = user?.email ? loadStructuredAddrs(user.email) : null
    if (structured && structured.length > 0) {
      initAddresses = structured
    } else {
      const strs = extra.addresses.length > 0 ? extra.addresses : (user?.address ? [user.address] : [''])
      initAddresses = strs.map(s => ({ ...emptyAddr(), street: s }))
    }
    if (initAddresses.length === 0) initAddresses = [emptyAddr()]
    setForm({
      full_name: user?.full_name || '',
      phone:     user?.phone     || '',
      addresses: initAddresses,
      age:       extra.age       || '',
      gender:    extra.gender    || '',
    })
    setEditMode(true)
  }

  const cancelEdit = () => setEditMode(false)

  // Helpers cho danh sách địa chỉ (structured)
  const updateAddress = (idx: number, value: StructuredAddress) =>
    setForm(f => { const a = [...f.addresses]; a[idx] = value; return { ...f, addresses: a } })

  const removeAddress = (idx: number) =>
    setForm(f => ({ ...f, addresses: f.addresses.filter((_, j) => j !== idx) }))

  const addAddress = () =>
    setForm(f => ({ ...f, addresses: [...f.addresses, emptyAddr()] }))

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.age && (isNaN(Number(form.age)) || Number(form.age) < 1 || Number(form.age) > 120)) {
      toast.warning('Tuổi không hợp lệ (1–120)')
      return
    }
    // Lọc bỏ địa chỉ rỗng
    const cleanStructured = form.addresses.filter(a => a.street.trim() || a.province.trim())
    const cleanAddresses  = cleanStructured.map(structuredToString).filter(Boolean)

    setSaving(true)
    try {
      // Địa chỉ đầu tiên → backend
      await dispatch(updateProfile({
        full_name: form.full_name,
        phone:     form.phone,
        address:   cleanAddresses[0] || '',
      }))
      // Tất cả địa chỉ + age + gender → localStorage
      const newExtra: ExtraProfile = { age: form.age, gender: form.gender, addresses: cleanAddresses }
      if (user?.email) {
        saveExtra(user.email, newExtra)
        saveStructuredAddrs(user.email, cleanStructured)
      }
      setExtra(newExtra)
      toast.success('✅ Đã lưu thông tin cá nhân')
      setEditMode(false)
    } catch {
      toast.error('Lỗi lưu hồ sơ, vui lòng thử lại')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!pwForm.old_password) { toast.warning('Nhập mật khẩu hiện tại'); return }
    if (pwForm.new_password.length < 6) { toast.warning('Mật khẩu mới tối thiểu 6 ký tự'); return }
    if (pwForm.new_password !== pwForm.confirm) { toast.warning('Mật khẩu xác nhận không khớp'); return }
    setPwSaving(true)
    try {
      await userService.changePassword({ old_password: pwForm.old_password, new_password: pwForm.new_password })
      toast.success('✅ Đổi mật khẩu thành công')
      setPwForm({ old_password: '', new_password: '', confirm: '' })
      setShowPw(false)
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Mật khẩu hiện tại không đúng')
    } finally {
      setPwSaving(false)
    }
  }

  // ── Styles ──────────────────────────────────────────────────────────────────
  const inputStyle: React.CSSProperties = {
    width: '100%', boxSizing: 'border-box',
    padding: '10px 12px',
    border: '2px solid #3b82f6',
    borderRadius: 8, fontSize: 14,
    background: 'var(--bg-card)',
    color: 'var(--text-primary)',
    outline: 'none',
    boxShadow: '0 0 0 3px rgba(59,130,246,0.12)',
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 12, fontWeight: 600,
    color: 'var(--text-muted)', marginBottom: 6,
    textTransform: 'uppercase', letterSpacing: '0.05em',
  }

  const genderLabel = extra.gender === 'male' ? 'Nam' : extra.gender === 'female' ? 'Nữ' : extra.gender === 'other' ? 'Khác' : ''

  // Địa chỉ hiển thị ở view mode: ưu tiên localStorage, fallback backend
  const displayAddresses: string[] = extra.addresses.length > 0
    ? extra.addresses
    : (user?.address ? [user.address] : [])

  return (
    <>
    <div className="page-wrapper">
      <div className="container" style={{ paddingTop: 32, paddingBottom: 48 }}>
        <Header title="Hồ sơ của tôi" />

        <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 28, alignItems: 'start' }}>

          {/* ── Avatar card ──────────────────────────────────────────────────── */}
          <div className="card" style={{ padding: 28, textAlign: 'center' }}>

            {/* Input file ẩn */}
            <input
              ref={avatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />

            {/* Avatar với overlay chỉnh sửa */}
            <div
              style={{ position: 'relative', width: 88, height: 88, margin: '0 auto 12px', cursor: 'pointer' }}
              onClick={() => !avatarUploading && avatarInputRef.current?.click()}
              onMouseEnter={() => setAvatarHover(true)}
              onMouseLeave={() => setAvatarHover(false)}
              title="Nhấn để thay ảnh đại diện"
            >
              {/* Vòng tròn avatar */}
              <div style={{
                width: 88, height: 88, borderRadius: '50%',
                background: 'var(--primary)', color: 'white',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 36, fontWeight: 700, overflow: 'hidden',
                border: avatarHover ? '3px solid #3b82f6' : '3px solid transparent',
                transition: 'border 0.15s',
              }}>
                {avatarUploading ? (
                  <span style={{ fontSize: 24 }}>⏳</span>
                ) : avatarPreview ? (
                  <img src={avatarPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : user?.avatar_url ? (
                  <img src={getImageUrl(user.avatar_url)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  user?.full_name?.[0]?.toUpperCase() || '?'
                )}
              </div>

              {/* Overlay camera khi hover hoặc uploading */}
              {(avatarHover || avatarUploading) && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.45)',
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  transition: 'opacity 0.15s',
                }}>
                  <span style={{ fontSize: 20 }}>{avatarUploading ? '⏳' : '📷'}</span>
                  <span style={{ fontSize: 9, color: 'white', fontWeight: 600, marginTop: 2, letterSpacing: '0.03em' }}>
                    {avatarUploading ? 'Đang tải...' : 'Thay ảnh'}
                  </span>
                </div>
              )}

              {/* Badge bút chì nhỏ góc dưới phải */}
              {!avatarUploading && (
                <div style={{
                  position: 'absolute', bottom: 2, right: 2,
                  width: 22, height: 22, borderRadius: '50%',
                  background: '#3b82f6', border: '2px solid var(--bg-card)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11,
                }}>
                  ✏️
                </div>
              )}
            </div>

            <p style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{user?.full_name || 'Chưa đặt tên'}</p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2, fontStyle: 'italic' }}>Nhấn ảnh để thay đổi</p>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>{user?.email}</p>
            {user?.phone && <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 4 }}>📞 {user.phone}</p>}

            <span style={{
              display: 'inline-block', marginTop: 8, marginBottom: 16,
              padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
              background: user?.status === 'active' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)',
              color: user?.status === 'active' ? '#16a34a' : '#dc2626',
            }}>
              {user?.status === 'active' ? '✓ Hoạt động' : user?.status || 'inactive'}
            </span>

            {/* ── Follow stats ─────────────────────────────────────────────── */}
            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 14, marginBottom: 4 }}>
              {/* Đang theo dõi */}
              <button
                onClick={() => openModal('following')}
                style={{
                  width: '100%', border: 'none', background: 'none', cursor: 'pointer',
                  padding: '8px 0', borderRadius: 8, transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-highlight)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {followStats.followingShops + followStats.followingUsers}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                  Đang theo dõi
                  {followStats.followingShops > 0 || followStats.followingUsers > 0
                    ? ` (${followStats.followingShops} shop · ${followStats.followingUsers} ND)`
                    : ''}
                </div>
              </button>

              {/* Người theo dõi */}
              <button
                onClick={() => openModal('followers')}
                style={{
                  width: '100%', border: 'none', background: 'none', cursor: 'pointer',
                  padding: '8px 0', borderRadius: 8, transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-highlight)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)' }}>
                  {followStats.myFollowers}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>Người theo dõi bạn</div>
              </button>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vai trò hiện tại</p>
              <RoleSwitcher />
            </div>
          </div>

          {/* ── Right column ─────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* ── Thông tin cá nhân ─────────────────────────────────────────── */}
            <div className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ fontWeight: 700, fontSize: 17, margin: 0 }}>Thông tin cá nhân</h2>
                {!editMode && (
                  <button onClick={startEdit} className="btn btn-outline"
                    style={{ fontSize: 13, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    ✏️ Chỉnh sửa
                  </button>
                )}
              </div>

              {/* VIEW MODE */}
              {!editMode && (() => {
                const staticRows = [
                  { icon: '👤', label: 'Họ và tên',      value: user?.full_name     as string | null | undefined },
                  { icon: '📧', label: 'Email',           value: user?.email         as string | null | undefined },
                  { icon: '📞', label: 'Số điện thoại',  value: user?.phone         as string | null | undefined },
                  { icon: '🎂', label: 'Tuổi',           value: extra.age ? `${extra.age} tuổi` : null },
                  { icon: '⚧',  label: 'Giới tính',      value: genderLabel || null },
                ]
                const addrRows = displayAddresses.length > 0
                  ? displayAddresses.map((addr, i) => ({
                      icon: i === 0 ? '📍' : '🏠',
                      label: displayAddresses.length === 1 ? 'Địa chỉ' : (i === 0 ? 'Địa chỉ chính' : `Địa chỉ ${i + 1}`),
                      value: addr || null,
                    }))
                  : [{ icon: '📍', label: 'Địa chỉ', value: null as string | null | undefined }]
                const allRows = [...staticRows, ...addrRows]
                return (
                  <div style={{ borderRadius: 12, border: '1px solid var(--border-subtle)', overflow: 'hidden', marginTop: 8 }}>
                    {allRows.map((row, i) => (
                      <div key={`${row.label}-${i}`} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-highlight, rgba(0,0,0,0.025))' }}>
                        <InfoRow icon={row.icon} label={row.label} value={row.value} last={i === allRows.length - 1} />
                      </div>
                    ))}
                  </div>
                )
              })()}

              {/* EDIT MODE */}
              {editMode && (
                <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Email không thể thay đổi. Các trường còn lại có thể chỉnh sửa tự do.
                  </p>

                  {/* Email — chỉ đọc */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', borderRadius: 8,
                    background: 'var(--bg-highlight, rgba(0,0,0,0.04))',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    <span style={{ fontSize: 16 }}>📧</span>
                    <div>
                      <div style={{ ...labelStyle, marginBottom: 1 }}>Email</div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>{user?.email}</div>
                    </div>
                    <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text-muted)', background: 'var(--border-subtle)', padding: '2px 8px', borderRadius: 10 }}>
                      Không thể sửa
                    </span>
                  </div>

                  {/* Họ tên + SĐT */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Họ và tên</label>
                      <input style={inputStyle} value={form.full_name} autoFocus
                        onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                        placeholder="Nhập họ và tên" />
                    </div>
                    <div>
                      <label style={labelStyle}>Số điện thoại</label>
                      <input style={inputStyle} value={form.phone}
                        onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                        placeholder="Ví dụ: 0901234567" />
                    </div>
                  </div>

                  {/* Tuổi + Giới tính */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <div>
                      <label style={labelStyle}>Tuổi</label>
                      <input style={inputStyle} value={form.age} type="number" min={1} max={120}
                        onChange={e => setForm(f => ({ ...f, age: e.target.value }))}
                        placeholder="Ví dụ: 22" />
                    </div>
                    <div>
                      <label style={labelStyle}>Giới tính</label>
                      <select style={{ ...inputStyle, cursor: 'pointer' }} value={form.gender}
                        onChange={e => setForm(f => ({ ...f, gender: e.target.value }))}>
                        <option value="">-- Chọn giới tính --</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="other">Khác</option>
                      </select>
                    </div>
                  </div>

                  {/* Địa chỉ — form cấu trúc Tỉnh/Quận/Phường/Số nhà */}
                  <div>
                    <label style={labelStyle}>
                      Địa chỉ
                      {form.addresses.length > 1 && (
                        <span style={{ marginLeft: 6, fontWeight: 400, textTransform: 'none', letterSpacing: 0, color: 'var(--text-muted)', fontSize: 11 }}>
                          (địa chỉ đầu tiên là địa chỉ chính)
                        </span>
                      )}
                    </label>

                    {form.addresses.map((addr, i) => (
                      <AddressEntry
                        key={i}
                        index={i}
                        value={addr}
                        onChange={v => updateAddress(i, v)}
                        onRemove={() => removeAddress(i)}
                        showRemove={form.addresses.length > 1}
                        provinces={provinces}
                        inputStyle={inputStyle}
                        labelStyle={labelStyle}
                      />
                    ))}

                    {/* Nút thêm địa chỉ mới */}
                    <button
                      type="button"
                      onClick={addAddress}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'rgba(59,130,246,0.07)',
                        border: '1.5px dashed #3b82f6',
                        borderRadius: 8, color: '#3b82f6',
                        cursor: 'pointer', padding: '8px 16px',
                        fontSize: 13, fontWeight: 600, marginTop: 2,
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.14)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'rgba(59,130,246,0.07)')}
                    >
                      ➕ Thêm địa chỉ
                    </button>
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                    <button type="submit" disabled={saving} className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {saving ? '⏳ Đang lưu...' : '💾 Lưu thay đổi'}
                    </button>
                    <button type="button" onClick={cancelEdit} className="btn btn-outline" disabled={saving}>
                      Huỷ
                    </button>
                  </div>
                </form>
              )}
            </div>

            {/* ── Bảo mật ──────────────────────────────────────────────────── */}
            <div className="card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <h2 style={{ fontWeight: 700, fontSize: 17, margin: 0 }}>Bảo mật</h2>
                {!showPw && (
                  <button onClick={() => setShowPw(true)} className="btn btn-outline"
                    style={{ fontSize: 13, padding: '7px 16px', display: 'flex', alignItems: 'center', gap: 6 }}>
                    🔑 Đổi mật khẩu
                  </button>
                )}
              </div>

              {!showPw && (
                <div>
                  <InfoRow icon="🔒" label="Mật khẩu" value="••••••••" last />
                  <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    Nhấn <strong>Đổi mật khẩu</strong> để cập nhật mật khẩu mới
                  </p>
                </div>
              )}

              {showPw && (
                <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {([
                    ['Mật khẩu hiện tại',     'old_password'],
                    ['Mật khẩu mới',           'new_password'],
                    ['Xác nhận mật khẩu mới',  'confirm'],
                  ] as [string, keyof typeof pwForm][]).map(([lbl, key]) => (
                    <div key={key}>
                      <label style={labelStyle}>{lbl}</label>
                      <input style={inputStyle} type="password" value={pwForm[key]}
                        onChange={e => setPwForm(f => ({ ...f, [key]: e.target.value }))}
                        placeholder="••••••••"
                        autoComplete={key === 'old_password' ? 'current-password' : 'new-password'} />
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: 10, paddingTop: 4 }}>
                    <button type="submit" disabled={pwSaving} className="btn btn-primary"
                      style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {pwSaving ? '⏳ Đang lưu...' : '🔑 Xác nhận đổi'}
                    </button>
                    <button type="button" disabled={pwSaving} className="btn btn-outline"
                      onClick={() => { setShowPw(false); setPwForm({ old_password: '', new_password: '', confirm: '' }) }}>
                      Huỷ
                    </button>
                  </div>
                </form>
              )}
            </div>

          </div>
        </div>
      </div>
    </div>

    {/* ── Social Modal ─────────────────────────────────────────────────────── */}
    {socialModal && (
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        onClick={() => setSocialModal(null)}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            background: 'var(--bg-card)', borderRadius: 16,
            width: 420, maxWidth: '95vw', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: 'var(--shadow-lg)', overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '16px 20px', borderBottom: '1px solid var(--border-subtle)',
          }}>
            {/* Tab switcher */}
            <div style={{ display: 'flex', gap: 4 }}>
              {([['following', 'Đang theo dõi'], ['followers', 'Người theo dõi']] as [ModalTab, string][]).map(([t, lbl]) => (
                <button key={t} onClick={() => setSocialModal(t)} style={{
                  border: 'none', cursor: 'pointer', padding: '6px 14px', borderRadius: 8,
                  fontSize: 13, fontWeight: socialModal === t ? 700 : 400,
                  background: socialModal === t ? 'var(--primary)' : 'transparent',
                  color: socialModal === t ? 'white' : 'var(--text-muted)',
                }}>
                  {lbl}&nbsp;
                  <span style={{ opacity: 0.75 }}>
                    {t === 'following'
                      ? followStats.followingShops + followStats.followingUsers
                      : followStats.myFollowers}
                  </span>
                </button>
              ))}
            </div>
            <button onClick={() => setSocialModal(null)} style={{
              border: 'none', background: 'none', cursor: 'pointer', fontSize: 20, lineHeight: 1,
              color: 'var(--text-muted)', padding: '4px 8px',
            }}>×</button>
          </div>

          {/* Sub-tab (chỉ khi "Đang theo dõi") */}
          {socialModal === 'following' && (
            <div style={{ display: 'flex', gap: 0, padding: '10px 20px 0', borderBottom: '1px solid var(--border-subtle)' }}>
              {([['shops', `🏪 Shop (${followStats.followingShops})`], ['users', `👤 Người dùng (${followStats.followingUsers})`]] as [FollowSubTab, string][]).map(([t, lbl]) => (
                <button key={t} onClick={() => setFollowSubTab(t)} style={{
                  border: 'none', borderBottom: followSubTab === t ? '2px solid var(--primary)' : '2px solid transparent',
                  background: 'none', cursor: 'pointer', padding: '8px 16px',
                  fontSize: 13, fontWeight: followSubTab === t ? 600 : 400,
                  color: followSubTab === t ? 'var(--primary)' : 'var(--text-muted)',
                  marginBottom: -1,
                }}>
                  {lbl}
                </button>
              ))}
            </div>
          )}

          {/* Content */}
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px 0' }}>
            {socialModal === 'following' && followSubTab === 'shops' && (
              followingShopsList.length === 0
                ? <EmptyState text="Bạn chưa theo dõi shop nào" />
                : followingShopsList.map(s => <ShopRow key={s.shopId} shop={s} />)
            )}
            {socialModal === 'following' && followSubTab === 'users' && (
              followingUsersList.length === 0
                ? <EmptyState text="Bạn chưa theo dõi người dùng nào" />
                : followingUsersList.map(u => <UserRow key={u.userId} user={u} />)
            )}
            {socialModal === 'followers' && (
              myFollowersList.length === 0
                ? <EmptyState text="Chưa có ai theo dõi bạn" />
                : myFollowersList.map(u => <UserRow key={u.userId} user={u} />)
            )}
          </div>
        </div>
      </div>
    )}
    </>
  )
}

// ── Sub-components cho modal ──────────────────────────────────────────────────

const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 14 }}>
    <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
    {text}
  </div>
)

const ShopRow: React.FC<{ shop: FollowedShop }> = ({ shop }) => (
  <Link to={`/shops/${shop.shopId}`} style={{ textDecoration: 'none', color: 'inherit' }}>
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 20px', transition: 'background 0.12s',
    }}
    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-highlight)')}
    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{
        width: 42, height: 42, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: 'linear-gradient(135deg,#1D4ED8,#6366F1)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18, color: 'white', fontWeight: 700,
      }}>
        {shop.avatarUrl
          ? <img src={shop.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : shop.shopName[0]?.toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          🏪 {shop.shopName}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          Theo dõi từ {new Date(shop.followedAt).toLocaleDateString('vi-VN')}
        </div>
      </div>
      <span style={{ fontSize: 12, color: 'var(--primary)' }}>Xem →</span>
    </div>
  </Link>
)

const UserRow: React.FC<{ user: FollowedUser }> = ({ user }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '10px 20px',
  }}>
    <div style={{
      width: 42, height: 42, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: 'linear-gradient(135deg,#7C3AED,#C026D3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 18, color: 'white', fontWeight: 700,
    }}>
      {user.avatarUrl
        ? <img src={user.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : user.fullName[0]?.toUpperCase()}
    </div>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {user.fullName}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
        {new Date(user.followedAt).toLocaleDateString('vi-VN')}
      </div>
    </div>
  </div>
)

export default ProfilePage
