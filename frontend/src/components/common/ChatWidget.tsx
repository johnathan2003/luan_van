/**
 * ChatWidget — nút chat nổi góc dưới phải
 * Hiển thị badge tin chưa đọc, click mở popup danh sách hội thoại
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { chatService } from '../../services/chatService'
import type { Conversation } from '../../types/chat'

// ── Helpers ──────────────────────────────────────────────────────────────────
const timeAgo = (iso?: string) => {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)   return 'vừa xong'
  if (diff < 3600) return `${Math.floor(diff / 60)} phút`
  if (diff < 86400)return `${Math.floor(diff / 3600)} giờ`
  return `${Math.floor(diff / 86400)} ngày`
}

const AvatarCircle: React.FC<{ name?: string; url?: string; size?: number }> = ({ name, url, size = 40 }) => {
  const s: React.CSSProperties = {
    width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
    background: 'var(--primary, #7C3AED)', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.4, fontWeight: 700,
  }
  return url
    ? <img src={url} alt={name} style={{ ...s, objectFit: 'cover' }} />
    : <div style={s}>{(name || '?')[0].toUpperCase()}</div>
}

// ── Keyframes (injected once) ─────────────────────────────────────────────────
const STYLE_ID = 'chat-widget-style'
if (!document.getElementById(STYLE_ID)) {
  const el = document.createElement('style')
  el.id = STYLE_ID
  el.textContent = `
    @keyframes cw-pop { from { opacity:0; transform: scale(0.9) translateY(8px) } to { opacity:1; transform: scale(1) translateY(0) } }
    @keyframes cw-pulse { 0%,100%{transform:scale(1)}50%{transform:scale(1.15)} }
    @keyframes cw-bounce { 0%,100%{transform:translateY(0)}40%{transform:translateY(-6px)}60%{transform:translateY(-3px)} }
  `
  document.head.appendChild(el)
}

// ── Main ─────────────────────────────────────────────────────────────────────
const ChatWidget: React.FC = () => {
  const { isAuthenticated, user, currentRole } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen]                   = useState(false)
  const [convs, setConvs]                 = useState<Conversation[]>([])
  const [loading, setLoading]             = useState(false)
  const [hasNew, setHasNew]               = useState(false)   // animation trigger
  const prevUnread                        = useRef(0)
  const panelRef                          = useRef<HTMLDivElement>(null)

  // ── Xác định role hiển thị & đường dẫn chat ──────────────────────────────
  const role       = currentRole || user?.current_role || ''
  const chatPath   = role === 'shop' ? '/shop/chat'
                   : role === 'employee' ? '/employee/chat'
                   : '/chat'

  // Chỉ hiện với user/shop/employee (không hiện với admin)
  const visible = isAuthenticated && role !== 'admin'

  // ── Fetch conversations ───────────────────────────────────────────────────
  const fetchConvs = useCallback(async () => {
    if (!visible) return
    try {
      setLoading(true)
      let res
      if (role === 'shop')     res = await chatService.getShopConversations()
      else if (role === 'employee') res = await chatService.getEmployeeConversations()
      else                     res = await chatService.getMyConversations()
      const list: Conversation[] = res.data?.conversations ?? res.data ?? []
      setConvs(list)
      const totalUnread = list.reduce((s, c) => s + (c.unread_count || 0), 0)
      if (totalUnread > prevUnread.current && prevUnread.current >= 0) {
        setHasNew(true)
        setTimeout(() => setHasNew(false), 2000)
      }
      prevUnread.current = totalUnread
    } catch { /* ignore */ } finally {
      setLoading(false)
    }
  }, [visible, role])

  // Poll every 20s
  useEffect(() => {
    if (!visible) return
    fetchConvs()
    const id = setInterval(fetchConvs, 20_000)
    return () => clearInterval(id)
  }, [visible, fetchConvs])

  // Đóng popup khi click ngoài
  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  if (!visible) return null

  const totalUnread = convs.reduce((s, c) => s + (c.unread_count || 0), 0)

  const goTo = (conv: Conversation) => {
    setOpen(false)
    if (role === 'shop' || role === 'employee') {
      navigate(`${chatPath}?conv=${conv.conversation_id}`)
    } else {
      navigate(`${chatPath}?shop=${conv.shop_id}`)
    }
  }

  // ── Styles ────────────────────────────────────────────────────────────────
  const btnStyle: React.CSSProperties = {
    position: 'fixed', bottom: 24, right: 24, zIndex: 1200,
    width: 56, height: 56, borderRadius: '50%',
    background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
    border: 'none', cursor: 'pointer', color: '#fff',
    boxShadow: '0 4px 20px rgba(124,58,237,0.45)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.2s, box-shadow 0.2s',
    animation: hasNew ? 'cw-bounce 0.6s ease' : undefined,
  }

  const badgeStyle: React.CSSProperties = {
    position: 'absolute', top: -4, right: -4,
    minWidth: 20, height: 20, borderRadius: 10,
    background: '#EF4444', color: '#fff',
    fontSize: 11, fontWeight: 800, lineHeight: '20px',
    textAlign: 'center', padding: '0 5px',
    border: '2px solid #fff',
    animation: hasNew ? 'cw-pulse 0.6s ease' : undefined,
  }

  const panelStyle: React.CSSProperties = {
    position: 'fixed', bottom: 90, right: 24, zIndex: 1200,
    width: 360, maxHeight: 480,
    background: 'var(--bg-card)', borderRadius: 16,
    boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
    border: '1px solid var(--border-subtle)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    animation: 'cw-pop 0.22s ease',
  }

  return (
    <div ref={panelRef}>
      {/* ── Popup panel ── */}
      {open && (
        <div style={panelStyle}>
          {/* Header */}
          <div style={{
            padding: '14px 18px', borderBottom: '1px solid var(--border-subtle)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #7C3AED11, transparent)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 18 }}>💬</span>
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Tin nhắn</span>
              {totalUnread > 0 && (
                <span style={{
                  background: '#EF4444', color: '#fff',
                  fontSize: 11, fontWeight: 700,
                  padding: '1px 7px', borderRadius: 10,
                }}>
                  {totalUnread} chưa đọc
                </span>
              )}
            </div>
            <button
              onClick={() => { setOpen(false); navigate(chatPath) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: 12, color: 'var(--primary, #7C3AED)',
                fontWeight: 600, padding: '4px 8px', borderRadius: 6,
              }}
            >
              Xem tất cả →
            </button>
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading && convs.length === 0 ? (
              <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>
                ⏳ Đang tải...
              </div>
            ) : convs.length === 0 ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div style={{ fontSize: 40, marginBottom: 10 }}>💬</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Chưa có tin nhắn nào</p>
                <button
                  onClick={() => { setOpen(false); navigate(chatPath) }}
                  style={{
                    marginTop: 10, padding: '8px 16px', borderRadius: 8,
                    background: 'var(--primary, #7C3AED)', color: '#fff',
                    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}
                >
                  Bắt đầu chat
                </button>
              </div>
            ) : (
              convs.map(conv => (
                <div
                  key={conv.conversation_id}

                  onClick={() => goTo(conv)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px', cursor: 'pointer',

                    borderBottom: '1px solid var(--border-subtle)',
                    background: conv.unread_count > 0
                      ? 'rgba(124,58,237,0.04)'
                      : 'transparent',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-highlight, rgba(0,0,0,0.04))')}
                  onMouseLeave={e => (e.currentTarget.style.background = conv.unread_count > 0 ? 'rgba(124,58,237,0.04)' : 'transparent')}
                >

                  {/* Avatar — click toàn bộ row vẫn navigate */}
                  <div style={{ cursor: 'pointer' }} onClick={() => goTo(conv)}>
                    <AvatarCircle name={conv.partner_name} url={conv.partner_avatar} size={42} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => goTo(conv)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                      {/* Tên — underline khi hover để báo hiệu clickable */}
                      <span
                        style={{
                          fontWeight: conv.unread_count > 0 ? 700 : 500,
                          fontSize: 14, color: 'var(--primary, #7C3AED)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          maxWidth: 160,
                          textDecoration: 'none',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        title="Mở trang chat"
                      >

                        {conv.partner_name || 'Shop'}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, marginLeft: 6 }}>
                        {timeAgo(conv.last_message_at)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                      <span style={{
                        fontSize: 12,
                        color: conv.unread_count > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: conv.unread_count > 0 ? 600 : 400,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',

                        maxWidth: 220,

                      }}>
                        {conv.last_message || 'Bắt đầu cuộc trò chuyện'}
                      </span>
                      {conv.unread_count > 0 && (
                        <span style={{
                          minWidth: 18, height: 18, borderRadius: 9,
                          background: '#7C3AED', color: '#fff',
                          fontSize: 10, fontWeight: 800, flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 4px', marginLeft: 6,
                        }}>
                          {conv.unread_count}
                        </span>
                      )}
                    </div>
                  </div>


                  {/* Nút → mở trang chat đầy đủ */}
                  <button
                    onClick={e => { e.stopPropagation(); goTo(conv) }}
                    title="Mở trang chat đầy đủ"
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      color: 'var(--primary, #7C3AED)', fontSize: 16, padding: '4px',
                      borderRadius: 6, flexShrink: 0, opacity: 0.6,
                      transition: 'opacity 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                    onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
                  >
                    ↗
                  </button>

                </div>
              ))
            )}
          </div>

          {/* Footer */}
          {convs.length > 0 && (
            <div style={{
              padding: '10px 16px', borderTop: '1px solid var(--border-subtle)',
              textAlign: 'center',
            }}>
              <button
                onClick={() => { setOpen(false); navigate(chatPath) }}
                style={{
                  width: '100%', padding: '9px', borderRadius: 8,
                  background: 'linear-gradient(135deg, #7C3AED, #5B21B6)',
                  color: '#fff', border: 'none', cursor: 'pointer',
                  fontWeight: 700, fontSize: 13,
                }}
              >
                💬 Mở trang chat đầy đủ
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Floating button ── */}
      <button
        style={btnStyle}
        onClick={() => { setOpen(o => !o); if (!open) fetchConvs() }}
        title="Tin nhắn"
        onMouseEnter={e => {
          e.currentTarget.style.transform = 'scale(1.1)'
          e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.6)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = 'scale(1)'
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.45)'
        }}
      >
        {/* Icon chat / close */}
        <span style={{ fontSize: 22, lineHeight: 1, transition: 'transform 0.2s', transform: open ? 'rotate(15deg)' : 'none' }}>
          {open ? '✕' : '💬'}
        </span>

        {/* Badge unread */}
        {!open && totalUnread > 0 && (
          <span style={badgeStyle}>
            {totalUnread > 99 ? '99+' : totalUnread}
          </span>
        )}
      </button>
    </div>
  )
}

export default ChatWidget
