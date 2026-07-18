import React, { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../../hooks/useNotifications'
import { formatDate } from '../../utils/formatters'

type TabKey = 'all' | 'product' | 'auction' | 'message'

const TABS: { key: TabKey; label: string; emoji: string; types: string[] }[] = [
  { key: 'all',     label: 'Tất cả',    emoji: '🔔', types: [] },
  { key: 'product', label: 'Sản phẩm',  emoji: '🏪', types: ['product_', 'approved', 'rejected', 'product'] },
  { key: 'auction', label: 'Đấu giá',   emoji: '⚡', types: ['auction_', 'bid_', 'deposit_'] },
  { key: 'message', label: 'Tin nhắn',  emoji: '💬', types: ['message_', 'support_', 'customer_', 'chat_'] },
]

function matchTab(type: string | undefined, tab: TabKey): boolean {
  if (tab === 'all') return true
  const patterns = TABS.find(t => t.key === tab)?.types ?? []
  return patterns.some(p => type?.includes(p) || type === p.replace('_', ''))
}

const NotificationCenter: React.FC = () => {
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<TabKey>('all')
  const { notifications, unread_count, read, readAll } = useNotifications()
  const ref = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const filtered = tab === 'all' ? notifications : notifications.filter(n => matchTab(n.type, tab))

  const unreadByTab = (t: TabKey) =>
    t === 'all'
      ? unread_count
      : notifications.filter(n => !n.is_read && matchTab(n.type, t)).length

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
          width: 380, maxHeight: 520, display: 'flex', flexDirection: 'column',
          marginTop: 4, zIndex: 200,
        }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--gray-100)' }}>
            <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--gray-800)' }}>Thông báo</span>
            {unread_count > 0 && (
              <button onClick={readAll} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--primary)', cursor: 'pointer', fontWeight: 500 }}>
                Đọc tất cả
              </button>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--gray-100)', padding: '0 8px' }}>
            {TABS.map(t => {
              const cnt = unreadByTab(t.key)
              const active = tab === t.key
              return (
                <button key={t.key} onClick={() => setTab(t.key)} style={{
                  flex: 1, padding: '8px 4px', border: 'none', background: 'none',
                  fontSize: 12, fontWeight: active ? 700 : 400,
                  color: active ? 'var(--primary)' : 'var(--gray-500)',
                  borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
                  cursor: 'pointer', position: 'relative', whiteSpace: 'nowrap',
                }}>
                  {t.emoji} {t.label}
                  {cnt > 0 && (
                    <span style={{
                      marginLeft: 4, background: '#EF4444', color: 'white',
                      borderRadius: 10, padding: '0 5px', fontSize: 10, fontWeight: 700,
                    }}>{cnt}</span>
                  )}
                </button>
              )
            })}
          </div>

          {/* List */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {filtered.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--gray-400)', fontSize: 14 }}>
                Không có thông báo
              </div>
            ) : filtered.map(n => (
              <div
                key={n.notification_id}
                onClick={() => {
                  read(n.notification_id)
                  if (n.action_url) { setOpen(false); navigate(n.action_url) }
                }}
                style={{
                  padding: '12px 16px', borderBottom: '1px solid var(--gray-100)',
                  cursor: n.action_url ? 'pointer' : 'default',
                  background: n.is_read ? 'white' : '#EFF6FF',
                  transition: 'background var(--transition)',
                }}
                onMouseEnter={e => { if (n.action_url) (e.currentTarget as HTMLDivElement).style.background = n.is_read ? '#F8FAFC' : '#DBEAFE' }}
                onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background = n.is_read ? 'white' : '#EFF6FF'}
              >
                <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                  {!n.is_read && (
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#2563EB', flexShrink: 0, marginTop: 6 }} />
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-800)', marginBottom: 2 }}>{n.title}</p>
                    <p style={{ fontSize: 12, color: 'var(--gray-600)', lineHeight: 1.5, whiteSpace: 'pre-line' }}>{n.message}</p>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                      <p style={{ fontSize: 11, color: 'var(--gray-400)' }}>{formatDate(n.created_at)}</p>
                      {n.action_url && <span style={{ fontSize: 11, color: '#2563EB', fontWeight: 600 }}>Xem chi tiết →</span>}
                    </div>
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
