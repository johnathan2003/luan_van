/**
 * ChatPage (User/Buyer)
 * Route: /chat?shop={shopId}
 *
 * Layout 2 cột:
 *  - Trái: danh sách conversation
 *  - Phải: cửa sổ chat với shop đang chọn
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { chatService } from '../../services/chatService'
import { getSocket } from '../../services/notificationService'
import type { Conversation, Message } from '../../types/chat'
import { formatDate } from '../../utils/formatters'

// ── Helpers ───────────────────────────────────────────────────────────────────
const avatar = (name?: string, url?: string) =>
  url ? (
    <img src={url} alt={name} style={styles.avatar} />
  ) : (
    <div style={{ ...styles.avatar, background: 'var(--primary)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 15 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )

// ── Component ─────────────────────────────────────────────────────────────────
const ChatPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const initShopId = Number(searchParams.get('shop')) || undefined

  const currentUser = useAppSelector(s => s.auth.user)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId]   = useState<number | null>(null)
  const [messages, setMessages]           = useState<Message[]>([])
  const [hasMore, setHasMore]             = useState(false)
  const [input, setInput]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [loadingConvs, setLoadingConvs]   = useState(true)
  const [loadingMsgs, setLoadingMsgs]     = useState(false)

  const bottomRef = useRef<HTMLDivElement>(null)
  const activeConv = conversations.find(c => c.conversation_id === activeConvId)
  const uid        = currentUser?.user_id ?? 0

  // ── Load danh sách conversation ──────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    try {
      setLoadingConvs(true)
      const res = await chatService.getMyConversations()
      setConversations(res.data.conversations)
    } catch { /* ignore */ } finally {
      setLoadingConvs(false)
    }
  }, [])

  // ── Mở conversation với shop (từ query param ?shop=) ─────────────────────
  const openShop = useCallback(async (shopId: number) => {
    try {
      const res = await chatService.openConversation(shopId)
      const conv: Conversation = res.data
      setConversations(prev => {
        const exists = prev.find(c => c.conversation_id === conv.conversation_id)
        return exists ? prev : [conv, ...prev]
      })
      setActiveConvId(conv.conversation_id)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    loadConversations()
  }, [loadConversations])

  useEffect(() => {
    if (initShopId) openShop(initShopId)
  }, [initShopId, openShop])

  // ── Socket: join/leave conversation room ──────────────────────────────────
  useEffect(() => {
    const sio = uid ? getSocket(uid) : null
    if (!sio || !activeConvId) return
    sio.emit('join_conversation', { conversation_id: activeConvId })
    return () => sio.emit('leave_conversation', { conversation_id: activeConvId })
  }, [uid, activeConvId])

  // ── Socket: nhận tin nhắn mới từ shop/NV gửi về ───────────────────────────
  useEffect(() => {
    const sio = uid ? getSocket(uid) : null
    if (!sio) return
    const onMsg = (data: any) => {
      console.log('[Chat:user] new_message received', { convId: data.conversation_id, activeConvId, content: data.message?.content })
      const convId = data.conversation_id
      const msg: Message = data.message
      // Cập nhật messages nếu đang mở conv đó
      if (convId === activeConvId) {
        setMessages(prev => {
          if (prev.find(m => m.message_id === msg.message_id)) return prev
          return [...prev, msg]
        })
      }
      // Cập nhật last_message + unread trong danh sách conv
      setConversations(prev =>
        prev.map(c =>
          c.conversation_id === convId
            ? { ...c, last_message: msg.content, last_message_at: msg.created_at,
                unread_count: convId === activeConvId ? 0 : c.unread_count + 1 }
            : c
        )
      )
    }
    sio.on('new_message', onMsg)
    return () => sio.off('new_message', onMsg)
  }, [uid, activeConvId])

  // ── Load tin nhắn khi chọn conversation ──────────────────────────────────
  useEffect(() => {
    if (!activeConvId) return
    setMessages([])
    setHasMore(false)
    setLoadingMsgs(true)
    chatService.getMessages(activeConvId)
      .then(res => {
        setMessages(res.data.messages)
        setHasMore(res.data.has_more)
      })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false))

    chatService.markRead(activeConvId).catch(() => {})
    // Cập nhật unread_count về 0
    setConversations(prev =>
      prev.map(c => c.conversation_id === activeConvId ? { ...c, unread_count: 0 } : c)
    )
  }, [activeConvId])

  // ── Cuộn xuống cuối khi có tin mới ───────────────────────────────────────
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Gửi tin nhắn ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !activeConvId || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await chatService.sendMessage(activeConvId, text)
      // Dedup: socket có thể đã thêm message này trước khi HTTP response về
      setMessages(prev =>
        prev.find(m => m.message_id === res.data.message_id) ? prev : [...prev, res.data]
      )
      setConversations(prev =>
        prev.map(c =>
          c.conversation_id === activeConvId
            ? { ...c, last_message: text, last_message_at: new Date().toISOString() }
            : c
        )
      )
    } catch { setInput(text) } finally { setSending(false) }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      {/* ── Sidebar: danh sách conv ───────────────────────────────────────── */}
      <aside style={styles.sidebar}>
        <div style={styles.sidebarHeader}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Tin nhắn</h2>
        </div>

        {loadingConvs ? (
          <div style={styles.empty}>Đang tải...</div>
        ) : conversations.length === 0 ? (
          <div style={styles.empty}>Chưa có cuộc hội thoại nào</div>
        ) : (
          conversations.map(conv => (
            <div
              key={conv.conversation_id}
              onClick={() => setActiveConvId(conv.conversation_id)}
              style={{
                ...styles.convItem,
                background: conv.conversation_id === activeConvId ? 'var(--gray-100)' : 'white',
              }}
            >
              {avatar(conv.partner_name, conv.partner_avatar)}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: conv.unread_count > 0 ? 700 : 500, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.partner_name || 'Shop'}
                  </span>
                  {conv.unread_count > 0 && (
                    <span style={styles.badge}>{conv.unread_count}</span>
                  )}
                </div>
                <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {conv.last_message || 'Bắt đầu cuộc trò chuyện'}
                </p>
              </div>
            </div>
          ))
        )}
      </aside>

      {/* ── Cửa sổ chat ────────────────────────────────────────────────────── */}
      <div style={styles.chatArea}>
        {!activeConvId ? (
          <div style={styles.placeholder}>
            <span style={{ fontSize: 48 }}>💬</span>
            <p style={{ color: 'var(--gray-500)', marginTop: 12 }}>Chọn một cuộc hội thoại để bắt đầu</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={styles.chatHeader}>
              {avatar(activeConv?.partner_name, activeConv?.partner_avatar)}
              <span style={{ fontWeight: 600, fontSize: 15 }}>{activeConv?.partner_name || 'Shop'}</span>
            </div>

            {/* Messages */}
            <div style={styles.messagesWrap}>
              {hasMore && (
                <button
                  style={styles.loadMoreBtn}
                  onClick={() => {
                    const firstId = messages[0]?.message_id
                    chatService.getMessages(activeConvId!, firstId)
                      .then(r => {
                        setMessages(prev => [...r.data.messages, ...prev])
                        setHasMore(r.data.has_more)
                      })
                  }}
                >
                  Tải tin cũ hơn
                </button>
              )}

              {loadingMsgs ? (
                <div style={styles.empty}>Đang tải tin nhắn...</div>
              ) : messages.length === 0 ? (
                <div style={styles.empty}>Hãy gửi tin nhắn đầu tiên 👋</div>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_id === currentUser?.user_id
                  return (
                    <div key={msg.message_id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                      {!isMine && (
                        <div style={{ marginRight: 8, flexShrink: 0 }}>
                          {avatar(msg.sender_name, msg.sender_avatar)}
                        </div>
                      )}
                      <div>
                        <div style={{
                          ...styles.bubble,
                          background:   isMine ? 'var(--primary)' : 'var(--gray-100)',
                          color:        isMine ? 'white' : 'var(--gray-900)',
                          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        }}>
                          {msg.image_url && (
                            <img src={msg.image_url} alt="attachment" style={{ maxWidth: 200, borderRadius: 8, marginBottom: 6, display: 'block' }} />
                          )}
                          {msg.content}
                        </div>
                        <p style={{ fontSize: 10, color: 'var(--gray-400)', marginTop: 2, textAlign: isMine ? 'right' : 'left' }}>
                          {formatDate(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={styles.inputRow}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Nhập tin nhắn... (Enter để gửi)"
                rows={1}
                style={styles.textarea}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                style={{
                  ...styles.sendBtn,
                  opacity: (!input.trim() || sending) ? 0.5 : 1,
                }}
              >
                {sending ? '...' : '➤'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    height: 'calc(100vh - var(--navbar-height) - 80px)',
    border: '1px solid var(--gray-200)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    background: 'white',
    boxShadow: 'var(--shadow)',
  },
  sidebar: {
    width: 300,
    borderRight: '1px solid var(--gray-200)',
    display: 'flex',
    flexDirection: 'column',
    overflowY: 'auto',
    flexShrink: 0,
  },
  sidebarHeader: {
    padding: '16px 20px',
    borderBottom: '1px solid var(--gray-200)',
    position: 'sticky',
    top: 0,
    background: 'white',
    zIndex: 1,
  },
  convItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 16px',
    cursor: 'pointer',
    borderBottom: '1px solid var(--gray-100)',
    transition: 'background var(--transition)',
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  badge: {
    background: 'var(--primary)',
    color: 'white',
    borderRadius: 999,
    fontSize: 10,
    fontWeight: 700,
    padding: '1px 6px',
    minWidth: 18,
    textAlign: 'center',
    flexShrink: 0,
  },
  chatArea: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  chatHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '12px 20px',
    borderBottom: '1px solid var(--gray-200)',
    background: 'white',
  },
  messagesWrap: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 20px',
    display: 'flex',
    flexDirection: 'column',
  },
  bubble: {
    padding: '10px 14px',
    maxWidth: 340,
    wordBreak: 'break-word',
    fontSize: 14,
    lineHeight: 1.5,
  },
  inputRow: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: 8,
    padding: '12px 16px',
    borderTop: '1px solid var(--gray-200)',
    background: 'white',
  },
  textarea: {
    flex: 1,
    resize: 'none',
    border: '1px solid var(--gray-300)',
    borderRadius: 'var(--radius-lg)',
    padding: '10px 14px',
    fontSize: 14,
    fontFamily: 'inherit',
    outline: 'none',
    maxHeight: 120,
    overflowY: 'auto',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: '50%',
    background: 'var(--primary)',
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    fontSize: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'opacity var(--transition)',
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    textAlign: 'center',
    padding: 24,
    color: 'var(--gray-400)',
    fontSize: 14,
  },
  loadMoreBtn: {
    alignSelf: 'center',
    background: 'none',
    border: '1px solid var(--gray-300)',
    borderRadius: 'var(--radius)',
    padding: '4px 12px',
    fontSize: 12,
    color: 'var(--gray-600)',
    cursor: 'pointer',
    marginBottom: 12,
  },
}

export default ChatPage
