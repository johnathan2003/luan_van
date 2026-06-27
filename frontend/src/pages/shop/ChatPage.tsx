/**
 * ChatPage (Shop)
 * Route: /shop/chat
 *
 * Inbox của shop — giống layout user chat nhưng:
 *  - Gọi API shop/conversations thay vì conversations
 *  - Partner hiển thị là buyer
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { chatService } from '../../services/chatService'
import type { Conversation, Message } from '../../types/chat'
import { formatDate } from '../../utils/formatters'
import { getSocket } from '../../services/notificationService'

const avatar = (name?: string, url?: string, size = 40) =>
  url ? (
    <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--info)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.375, flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )

const ShopChatPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const initConvId = Number(searchParams.get('conv')) || undefined

  const currentUser = useAppSelector(s => s.auth.user)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId]   = useState<number | null>(initConvId ?? null)
  const [messages, setMessages]           = useState<Message[]>([])
  const [hasMore, setHasMore]             = useState(false)
  const [input, setInput]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [loadingConvs, setLoadingConvs]   = useState(true)
  const [loadingMsgs, setLoadingMsgs]     = useState(false)
  const [search, setSearch]               = useState('')

  const bottomRef  = useRef<HTMLDivElement>(null)
  const activeConv = conversations.find(c => c.conversation_id === activeConvId)
  const uid        = currentUser?.user_id ?? 0

  // ── Load inbox ────────────────────────────────────────────────────────────
  const loadConversations = useCallback(() => {
    chatService.getShopConversations()
      .then(res => setConversations(res.data.conversations))
      .catch(() => {})
      .finally(() => setLoadingConvs(false))
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Socket: join/leave conversation room khi chọn conv ───────────────────
  useEffect(() => {
    const sio = uid ? getSocket(uid) : null
    if (!sio || !activeConvId) return
    sio.emit('join_conversation', { conversation_id: activeConvId })
    return () => sio.emit('leave_conversation', { conversation_id: activeConvId })
  }, [uid, activeConvId])

  // ── Socket: nhận tin nhắn realtime (new_message từ conv room + new_chat_message từ user room) ──
  useEffect(() => {
    const sio = uid ? getSocket(uid) : null
    if (!sio) return

    const onMsg = (data: any) => {
      console.log('[Chat:shop] socket message received', { event: 'new_message/new_chat_message', convId: data.conversation_id, activeConvId, content: data.message?.content })
      const convId = data.conversation_id
      setConversations(prev => {
        const exists = prev.find(c => c.conversation_id === convId)
        if (exists) {
          return prev.map(c =>
            c.conversation_id === convId
              ? { ...c, last_message: data.message.content, last_message_at: data.message.created_at,
                  unread_count: activeConvId === convId ? 0 : c.unread_count + 1 }
              : c
          ).sort((a, b) =>
            new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
          )
        }
        // Conversation mới → reload inbox
        loadConversations()
        return prev
      })
      if (convId === activeConvId) {
        setMessages(prev => {
          if (prev.find((m: Message) => m.message_id === data.message.message_id)) return prev
          return [...prev, data.message]
        })
      }
    }

    // new_message: nhận khi đang mở conv (từ conv room)
    sio.on('new_message', onMsg)
    // new_chat_message: nhận ở user room khi khách nhắn vào shop (conv chưa có NV phụ trách)
    sio.on('new_chat_message', onMsg)

    return () => {
      sio.off('new_message', onMsg)
      sio.off('new_chat_message', onMsg)
    }
  }, [uid, activeConvId, loadConversations])

  // ── Load messages ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!activeConvId) return
    setMessages([])
    setHasMore(false)
    setLoadingMsgs(true)
    chatService.getMessages(activeConvId)
      .then(res => { setMessages(res.data.messages); setHasMore(res.data.has_more) })
      .catch(() => {})
      .finally(() => setLoadingMsgs(false))
    chatService.markRead(activeConvId).catch(() => {})
    setConversations(prev =>
      prev.map(c => c.conversation_id === activeConvId ? { ...c, unread_count: 0 } : c)
    )
  }, [activeConvId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // ── Gửi tin nhắn ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !activeConvId || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await chatService.sendMessage(activeConvId, text)
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

  const filtered = search.trim()
    ? conversations.filter(c =>
        c.partner_name?.toLowerCase().includes(search.toLowerCase())
      )
    : conversations

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 140px)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'white', boxShadow: 'var(--shadow)' }}>

      {/* Sidebar */}
      <aside style={{ width: 300, borderRight: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
        {/* Header */}
        <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-200)', position: 'sticky', top: 0, background: 'white', zIndex: 1 }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>Hộp thư khách hàng</h2>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Tìm theo tên khách..."
            style={{ width: '100%', padding: '7px 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
          />
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loadingConvs ? (
            <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20, fontSize: 14 }}>Đang tải...</p>
          ) : filtered.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20, fontSize: 14 }}>Không có tin nhắn nào</p>
          ) : (
            filtered.map(conv => (
              <div
                key={conv.conversation_id}
                onClick={() => setActiveConvId(conv.conversation_id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '12px 16px', cursor: 'pointer',
                  borderBottom: '1px solid var(--gray-100)',
                  background: conv.conversation_id === activeConvId ? 'var(--gray-100)' : 'white',
                  transition: 'background var(--transition)',
                }}
              >
                {avatar(conv.partner_name, conv.partner_avatar)}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: conv.unread_count > 0 ? 700 : 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {conv.partner_name || 'Khách hàng'}
                    </span>
                    {conv.unread_count > 0 && (
                      <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center' }}>
                        {conv.unread_count}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: 12, color: 'var(--gray-500)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.last_message || 'Bắt đầu trò chuyện'}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </aside>

      {/* Chat area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {!activeConvId ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)' }}>
            <span style={{ fontSize: 48 }}>💬</span>
            <p style={{ marginTop: 12, fontSize: 14 }}>Chọn một cuộc hội thoại</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', borderBottom: '1px solid var(--gray-200)', background: 'white' }}>
              {avatar(activeConv?.partner_name, activeConv?.partner_avatar)}
              <div>
                <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{activeConv?.partner_name || 'Khách hàng'}</p>
                <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: 0 }}>Khách hàng</p>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column' }}>
              {hasMore && (
                <button
                  onClick={() => {
                    const firstId = messages[0]?.message_id
                    chatService.getMessages(activeConvId!, firstId)
                      .then(r => { setMessages(prev => [...r.data.messages, ...prev]); setHasMore(r.data.has_more) })
                  }}
                  style={{ alignSelf: 'center', background: 'none', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', padding: '4px 12px', fontSize: 12, color: 'var(--gray-600)', cursor: 'pointer', marginBottom: 12 }}
                >
                  Tải tin cũ hơn
                </button>
              )}

              {loadingMsgs ? (
                <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20, fontSize: 14 }}>Đang tải...</p>
              ) : messages.length === 0 ? (
                <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20, fontSize: 14 }}>Hãy bắt đầu trò chuyện 👋</p>
              ) : (
                messages.map(msg => {
                  const isMine = msg.sender_role === 'shop'
                  return (
                    <div key={msg.message_id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                      {!isMine && <div style={{ marginRight: 8 }}>{avatar(msg.sender_name, msg.sender_avatar, 32)}</div>}
                      <div>
                        <div style={{
                          padding: '10px 14px',
                          maxWidth: 340,
                          wordBreak: 'break-word',
                          fontSize: 14,
                          lineHeight: 1.5,
                          background:   isMine ? 'var(--primary)' : 'var(--gray-100)',
                          color:        isMine ? 'white' : 'var(--gray-900)',
                          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                        }}>
                          {msg.image_url && <img src={msg.image_url} alt="img" style={{ maxWidth: 200, borderRadius: 8, marginBottom: 6, display: 'block' }} />}
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
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--gray-200)', background: 'white' }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Trả lời khách hàng... (Enter để gửi)"
                rows={1}
                style={{ flex: 1, resize: 'none', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', maxHeight: 120, overflowY: 'auto' }}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || sending}
                style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--primary)', color: 'white', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: (!input.trim() || sending) ? 0.5 : 1, transition: 'opacity var(--transition)' }}
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

export default ShopChatPage
