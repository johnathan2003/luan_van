/**
 * 📣 System Notification Admin — Thông báo hệ thống
 * Nhóm 7: thêm, sửa, xóa thông báo gửi tới người dùng
 */
import React, { useState } from 'react'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626' }

const AUDIENCE_OPTS = [
  { value: 'all',      label: '🌐 Tất cả người dùng' },
  { value: 'user', label: '👤 Khách hàng' },
  { value: 'shop',     label: '🏪 Cửa hàng' },
  { value: 'shipper',  label: '🚚 Shipper' },
]

const TYPE_OPTS = [
  { value: 'info',    label: 'ℹ️ Thông tin', color: C.blue,    bg: C.light },
  { value: 'warning', label: '⚠️ Cảnh báo',  color: C.warning, bg: '#FEF3C7' },
  { value: 'success', label: '✅ Thông báo tốt', color: C.success, bg: '#DCFCE7' },
  { value: 'promo',   label: '🎁 Khuyến mãi', color: '#7C3AED', bg: '#EDE9FE' },
]

const EMPTY = { title: '', content: '', type: 'info', audience: 'all', send_at: '' }

const SystemNotificationPage: React.FC = () => {
  const [notiList, setNotiList] = useState(MOCK_NOTIS)
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId]     = useState<number | null>(null)
  const [form, setForm]         = useState<any>(EMPTY)

  const openAdd  = () => { setForm(EMPTY); setEditId(null); setShowForm(true) }
  const openEdit = (n: any) => { setForm({ ...n }); setEditId(n.id); setShowForm(true) }
  const remove   = (id: number) => { if (window.confirm('Xóa thông báo này?')) setNotiList(ns => ns.filter(n => n.id !== id)) }

  const handleSave = () => {
    if (editId !== null) {
      setNotiList(ns => ns.map(n => n.id === editId ? { ...n, ...form } : n))
    } else {
      setNotiList(ns => [{ ...form, id: Date.now(), created_at: new Date().toISOString().slice(0, 16), sent: false }, ...ns])
    }
    setShowForm(false)
  }

  const typeOpt     = (v: string) => TYPE_OPTS.find(o => o.value === v) ?? TYPE_OPTS[0]
  const audienceOpt = (v: string) => AUDIENCE_OPTS.find(o => o.value === v)?.label ?? v

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>📣 Thông báo hệ thống</h1>
          <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Gửi thông báo toàn nền tảng đến người dùng, cửa hàng, shipper</p>
        </div>
        <button onClick={openAdd} style={{ padding: '10px 20px', background: C.blue, color: 'white', border: 'none', borderRadius: 10, fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>
          + Thêm thông báo
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
        {[
          { label: 'Tổng thông báo', value: notiList.length,                            color: C.blue },
          { label: 'Đã gửi',        value: notiList.filter(n => n.sent).length,         color: C.success },
          { label: 'Chưa gửi',      value: notiList.filter(n => !n.sent).length,        color: C.warning },
          { label: 'Hẹn giờ',       value: notiList.filter(n => n.send_at).length,      color: '#7C3AED' },
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '14px 18px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 11, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 26, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {notiList.map(n => {
          const tp = typeOpt(n.type)
          return (
            <div key={n.id} className="card" style={{ padding: '16px 20px', display: 'flex', gap: 16, alignItems: 'flex-start', borderLeft: `4px solid ${tp.color}` }}>
              {/* Type badge */}
              <div style={{ flexShrink: 0, marginTop: 2 }}>
                <span style={{ fontSize: 11, fontWeight: 700, padding: '4px 10px', borderRadius: 20, background: tp.bg, color: tp.color }}>{tp.label}</span>
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: C.navy, marginBottom: 4 }}>{n.title}</p>
                <p style={{ fontSize: 13, color: C.gray, marginBottom: 8, lineHeight: 1.5 }}>{n.content}</p>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: C.gray }}>📣 {audienceOpt(n.audience)}</span>
                  {n.send_at && <span style={{ fontSize: 11, color: C.warning }}>⏰ {n.send_at}</span>}
                  <span style={{ fontSize: 11, color: C.gray }}>🕐 {n.created_at}</span>
                  <span style={{
                    fontSize: 11, fontWeight: 700, padding: '1px 8px', borderRadius: 10,
                    background: n.sent ? '#DCFCE7' : '#FEF3C7', color: n.sent ? C.success : C.warning
                  }}>{n.sent ? '✅ Đã gửi' : '⏳ Chưa gửi'}</span>
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                {!n.sent && <button onClick={() => setNotiList(ns => ns.map(x => x.id === n.id ? { ...x, sent: true } : x))}
                  style={{ padding: '6px 14px', background: '#DCFCE7', color: C.success, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>🚀 Gửi ngay</button>}
                <button onClick={() => openEdit(n)}
                  style={{ padding: '6px 14px', background: C.light, color: C.blue, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>✏️ Sửa</button>
                <button onClick={() => remove(n.id)}
                  style={{ padding: '6px 14px', background: '#FEE2E2', color: C.error, border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>🗑️ Xóa</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowForm(false)}>
          <div className="card" style={{ width: 500, padding: 28, maxHeight: '90vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>{editId ? 'Sửa thông báo' : 'Thêm thông báo mới'}</h2>
              <button onClick={() => setShowForm(false)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Tiêu đề</label>
                <input value={form.title} onChange={e => setForm((p: any) => ({ ...p, title: e.target.value }))} placeholder="VD: Bảo trì hệ thống"
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Nội dung</label>
                <textarea value={form.content} onChange={e => setForm((p: any) => ({ ...p, content: e.target.value }))} rows={3} placeholder="Nội dung chi tiết..."
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Loại thông báo</label>
                  <select value={form.type} onChange={e => setForm((p: any) => ({ ...p, type: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}>
                    {TYPE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Đối tượng</label>
                  <select value={form.audience} onChange={e => setForm((p: any) => ({ ...p, audience: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}>
                    {AUDIENCE_OPTS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: C.gray, display: 'block', marginBottom: 4 }}>Hẹn giờ gửi (tùy chọn)</label>
                <input type="datetime-local" value={form.send_at} onChange={e => setForm((p: any) => ({ ...p, send_at: e.target.value }))}
                  style={{ width: '100%', padding: '9px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', background: C.tint, color: C.gray, border: 'none', borderRadius: 9, fontWeight: 600, cursor: 'pointer' }}>Hủy</button>
              <button onClick={handleSave} style={{ flex: 2, padding: '10px', background: C.blue, color: 'white', border: 'none', borderRadius: 9, fontWeight: 700, cursor: 'pointer' }}>
                {editId ? 'Lưu thay đổi' : 'Tạo thông báo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const MOCK_NOTIS = [
  { id:1, title:'Bảo trì hệ thống', content:'Hệ thống sẽ bảo trì từ 2:00 - 4:00 sáng ngày 20/06/2025. Vui lòng không thực hiện giao dịch trong thời gian này.', type:'warning', audience:'all',      send_at:'',                 created_at:'2025-06-14 08:00', sent: false },
  { id:2, title:'Chính sách phí mới', content:'Từ ngày 01/07/2025, phí hoa hồng nền tảng sẽ được điều chỉnh. Xem chi tiết tại trang chính sách.', type:'info', audience:'shop',    send_at:'2025-06-20 09:00', created_at:'2025-06-13 15:00', sent: false },
  { id:3, title:'Khuyến mãi hè 2025', content:'BuyZO tặng voucher 50K cho tất cả khách hàng nhân dịp hè. Áp dụng đến 30/06/2025.', type:'promo',   audience:'customer', send_at:'',                 created_at:'2025-06-10 10:00', sent: true  },
]

export default SystemNotificationPage
