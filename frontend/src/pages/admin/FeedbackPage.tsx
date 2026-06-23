/**
 * 💬 Feedback Admin — Phản hồi người dùng
 * Nhóm 9: xem phản hồi người dùng, lọc theo loại, ghi chú xử lý
 */
import React, { useState } from 'react'

const C = { navy: '#1E3A8A', blue: '#1D4ED8', light: '#DBEAFE', tint: '#EFF6FF', gray: '#64748B', success: '#16A34A', warning: '#D97706', error: '#DC2626', purple: '#7C3AED' }

const TYPE_MAP: Record<string, { label: string; color: string; bg: string; icon: string }> = {
  bug:        { label: 'Lỗi kỹ thuật', color: C.error,   bg: '#FEE2E2', icon: '🐛' },
  complaint:  { label: 'Khiếu nại',    color: C.warning, bg: '#FEF3C7', icon: '😤' },
  suggestion: { label: 'Góp ý',        color: C.blue,    bg: C.light,   icon: '💡' },
  praise:     { label: 'Khen ngợi',    color: C.success, bg: '#DCFCE7', icon: '⭐' },
  other:      { label: 'Khác',         color: C.gray,    bg: '#F1F5F9', icon: '📝' },
}

const STATUS_MAP: Record<string, { label: string; color: string; bg: string }> = {
  open:       { label: 'Chờ xử lý',  color: C.warning, bg: '#FEF3C7' },
  in_progress:{ label: 'Đang xử lý', color: C.blue,    bg: C.light   },
  resolved:   { label: 'Đã giải quyết', color: C.success, bg: '#DCFCE7' },
  closed:     { label: 'Đã đóng',    color: C.gray,    bg: '#F1F5F9' },
}

const FeedbackPage: React.FC = () => {
  const [feedbacks, setFeedbacks] = useState(MOCK_FEEDBACKS)
  const [typeFilter, setTypeFilter]     = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [search, setSearch]             = useState('')
  const [selected, setSelected]         = useState<any | null>(null)
  const [note, setNote]                 = useState('')

  const filtered = feedbacks.filter(f => {
    const mt = typeFilter === 'all' || f.type === typeFilter
    const ms = statusFilter === 'all' || f.status === statusFilter
    const mq = !search || f.subject.toLowerCase().includes(search.toLowerCase()) || f.user_email.toLowerCase().includes(search.toLowerCase())
    return mt && ms && mq
  })

  const updateStatus = (id: number, status: string) => {
    setFeedbacks(fs => fs.map(f => f.id === id ? { ...f, status } : f))
    if (selected?.id === id) setSelected((s: any) => ({ ...s, status }))
  }

  const saveNote = (id: number) => {
    setFeedbacks(fs => fs.map(f => f.id === id ? { ...f, admin_note: note } : f))
    setSelected((s: any) => ({ ...s, admin_note: note }))
    setNote('')
  }

  const openDetail = (f: any) => { setSelected(f); setNote(f.admin_note ?? '') }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>💬 Phản hồi người dùng</h1>
        <p style={{ fontSize: 13, color: C.gray, marginTop: 2 }}>Quản lý và xử lý phản hồi từ người dùng trên nền tảng</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10 }}>
        {[
          { label: 'Tổng', value: feedbacks.length, color: C.blue },
          ...Object.entries(STATUS_MAP).map(([k, v]) => ({
            label: v.label, value: feedbacks.filter(f => f.status === k).length, color: v.color,
          })),
        ].map(s => (
          <div key={s.label} className="card" style={{ padding: '12px 16px', borderLeft: `3px solid ${s.color}` }}>
            <p style={{ fontSize: 10, color: C.gray, fontWeight: 600, textTransform: 'uppercase' }}>{s.label}</p>
            <p style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '14px 18px', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 Tìm tiêu đề, email..."
          style={{ flex: 1, minWidth: 180, padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }} />
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          style={{ padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}>
          <option value="all">Tất cả loại</option>
          {Object.entries(TYPE_MAP).map(([k, v]) => <option key={k} value={k}>{v.icon} {v.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          style={{ padding: '8px 14px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none' }}>
          <option value="all">Tất cả trạng thái</option>
          {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>

      {/* List */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: C.tint }}>
              {['Tiêu đề', 'Người gửi', 'Loại', 'Trạng thái', 'Ngày gửi', 'Hành động'].map(h => (
                <th key={h} style={{ padding: '11px 16px', textAlign: 'left', fontSize: 12, fontWeight: 700, color: C.navy }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: C.gray }}>Không có phản hồi nào</td></tr>
            ) : filtered.map(f => {
              const tp = TYPE_MAP[f.type] ?? TYPE_MAP.other
              const st = STATUS_MAP[f.status] ?? STATUS_MAP.open
              return (
                <tr key={f.id} style={{ borderBottom: `1px solid ${C.tint}` }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#F8FAFF')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontWeight: 600, fontSize: 14, color: C.navy }}>{f.subject}</p>
                    <p style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>{f.content.slice(0, 60)}...</p>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{f.user_name}</p>
                    <p style={{ fontSize: 11, color: C.gray }}>{f.user_email}</p>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: tp.bg, color: tp.color }}>{tp.icon} {tp.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: st.bg, color: st.color }}>{st.label}</span>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: 12, color: C.gray }}>{f.created_at.slice(0, 10)}</td>
                  <td style={{ padding: '12px 16px' }}>
                    <button onClick={() => openDetail(f)}
                      style={{ padding: '5px 12px', background: C.light, color: C.blue, border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                      Chi tiết
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setSelected(null)}>
          <div className="card" style={{ width: 520, padding: 28, maxHeight: '85vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>Chi tiết phản hồi</h2>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: C.gray }}>✕</button>
            </div>

            {/* Tags row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: TYPE_MAP[selected.type]?.bg, color: TYPE_MAP[selected.type]?.color }}>
                {TYPE_MAP[selected.type]?.icon} {TYPE_MAP[selected.type]?.label}
              </span>
              <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: STATUS_MAP[selected.status]?.bg, color: STATUS_MAP[selected.status]?.color }}>
                {STATUS_MAP[selected.status]?.label}
              </span>
            </div>

            <h3 style={{ fontSize: 16, fontWeight: 700, color: C.navy, marginBottom: 8 }}>{selected.subject}</h3>
            <p style={{ fontSize: 13, color: C.gray, marginBottom: 4 }}>Từ: <strong>{selected.user_name}</strong> ({selected.user_email})</p>
            <p style={{ fontSize: 12, color: C.gray, marginBottom: 16 }}>🕐 {selected.created_at}</p>

            <div style={{ padding: '14px 16px', background: C.tint, borderRadius: 10, marginBottom: 20, fontSize: 13, color: C.navy, lineHeight: 1.6 }}>
              {selected.content}
            </div>

            {/* Update status */}
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.gray, marginBottom: 8 }}>CẬP NHẬT TRẠNG THÁI</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(STATUS_MAP).map(([k, v]) => (
                  <button key={k} onClick={() => updateStatus(selected.id, k)}
                    style={{ padding: '6px 14px', borderRadius: 7, border: selected.status === k ? `2px solid ${v.color}` : '2px solid transparent', cursor: 'pointer', fontSize: 12, fontWeight: 600, background: v.bg, color: v.color }}>
                    {v.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Admin note */}
            <div>
              <p style={{ fontSize: 12, fontWeight: 600, color: C.gray, marginBottom: 8 }}>GHI CHÚ XỬ LÝ</p>
              {selected.admin_note && (
                <div style={{ padding: '10px 14px', background: '#FEF3C7', borderRadius: 8, marginBottom: 8, fontSize: 13, color: '#92400E' }}>
                  📌 {selected.admin_note}
                </div>
              )}
              <textarea value={note} onChange={e => setNote(e.target.value)} rows={3}
                placeholder="Ghi chú xử lý, hành động đã thực hiện..."
                style={{ width: '100%', padding: '10px 12px', border: `1px solid ${C.light}`, borderRadius: 8, fontSize: 13, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }} />
              <button onClick={() => saveNote(selected.id)}
                style={{ marginTop: 8, padding: '8px 20px', background: C.blue, color: 'white', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: 13, cursor: 'pointer' }}>
                💾 Lưu ghi chú
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const MOCK_FEEDBACKS = [
  { id:1, subject:'Không thể thanh toán VNPay', content:'Tôi đã thử thanh toán qua VNPay nhưng liên tục bị báo lỗi "Giao dịch thất bại". Đơn hàng #ORD-20250601-0002. Tôi đã thử 3 lần nhưng không được.', type:'bug',       user_name:'Hoàng Văn An', user_email:'customer1@example.com', status:'open',        created_at:'2025-06-14T09:30:00', admin_note:'' },
  { id:2, subject:'Sản phẩm nhận được khác mô tả', content:'Tôi đặt áo size L nhưng nhận được size M. Shop không phản hồi tin nhắn. Yêu cầu hoàn tiền hoặc đổi hàng ngay.', type:'complaint', user_name:'Nguyễn Thị B',  user_email:'user2@example.com',      status:'in_progress', created_at:'2025-06-13T14:00:00', admin_note:'Đã liên hệ shop, đang chờ phản hồi trong 24h.' },
  { id:3, subject:'Góp ý thêm bộ lọc theo vùng', content:'App nên có bộ lọc sản phẩm theo vùng/tỉnh thành để tìm sản phẩm giao hàng nhanh hơn. Tính năng này sẽ rất hữu ích.', type:'suggestion', user_name:'Trần Minh C', user_email:'user3@example.com',      status:'open',        created_at:'2025-06-12T11:00:00', admin_note:'' },
  { id:4, subject:'BuyZO thật sự tuyệt vời!', content:'Mua hàng rất dễ, giao hàng nhanh và shop hỗ trợ nhiệt tình. Chắc chắn sẽ tiếp tục mua sắm trên BuyZO!', type:'praise',     user_name:'Lê Thị D',    user_email:'user4@example.com',      status:'resolved',    created_at:'2025-06-11T08:00:00', admin_note:'Cảm ơn khách hàng.' },
  { id:5, subject:'App bị crash khi mở giỏ hàng', content:'Khi nhấn vào giỏ hàng trên điện thoại, ứng dụng tự động đóng. Thử nhiều lần vẫn bị. Thiết bị: iPhone 14 iOS 17.', type:'bug',       user_name:'Phạm Văn E',  user_email:'user5@example.com',      status:'in_progress', created_at:'2025-06-10T16:30:00', admin_note:'Team dev đang kiểm tra.' },
]

export default FeedbackPage
