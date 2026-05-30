import React, { useState, useRef, useEffect } from 'react'
import { useNotifications } from '../../hooks/useNotifications'
import { formatDate } from '../../utils/formatters'

const NotificationCenter: React.FC = () => {
  const [open, setOpen] = useState(false)
  const { notifications, unread_count, read, readAll } = useNotifications()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen(!open)}
        style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 'var(--radius)', padding: '6px 10px', cursor: 'pointer', color: 'white', position: 'relative', fontSize: 18 }}
      >
        🔔
        {unread_count > 0 && (
          <span style={{
            position: 'absolute', top: -4, right: -4, background: 'var(--error)',
            color: 'white', borderRadius: '50%', width: 18, height: 18,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700,
          }}>
            {unread_count > 9 ? '9+' : unread_count}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, background: 'white',
          borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
          width: 360, maxHeight: 480, display: 'flex', flexDirection: 'column',
          marginTop: 4, zIndex: 200,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--gray-800)' }}>Thông báo ({unread_count})</span>
            {unread_count > 0 && (
              <button onClick={readAll} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>
                Đánh dấu tất cả đã đọc
              </button>
            )}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)', fontSize: 14 }}>
                Không có thông báo
              </div>
            ) : notifications.map(n => (
              <div
                key={n.notification_id}
                onClick={() => read(n.notification_id)}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--gray-100)', cursor: 'pointer',
                  background: n.is_read ? 'white' : '#fff8f7',
                  transition: 'background var(--transition)',
                }}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {!n.is_read && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--primary)', flexShrink: 0, marginTop: 6 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)', marginBottom: 2 }}>{n.title}</p>
                    <p style={{ fontSize: 13, color: 'var(--gray-600)', lineHeight: 1.4 }}>{n.message}</p>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>{formatDate(n.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default NotificationCenter
