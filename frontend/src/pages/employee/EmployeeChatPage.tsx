/**
 * EmployeeChatPage
 * Trang chat dành riêng cho nhân viên có quyền message:read
 *
 * Khác với ShopChatPage (owner):
 *  - Gọi /api/v1/chat/employee/conversations (chỉ thấy conv chưa assign + của mình)
 *  - Có nút "Nhận hỗ trợ" cho conv chưa assign
 *  - Lắng nghe socket "new_chat_message" để biết có tin nhắn mới từ khách
 *  - Auto-assign khi gửi tin nhắn đầu tiên (backend xử lý)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAppSelector } from '../../store/hooks'
import { chatService } from '../../services/chatService'
import type { Conversation, Message } from '../../types/chat'
import { formatDate } from '../../utils/formatters'
import EmployeeLayout from './EmployeeLayout'
import { getSocket } from '../../services/notificationService'

const avatar = (name?: string, url?: string, size = 40) =>
  url ? (
    <img src={url} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{ width: size, height: size, borderRadius: '50%', background: 'var(--info)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: size * 0.375, flexShrink: 0 }}>
      {(name || '?')[0].toUpperCase()}
    </div>
  )

const EmployeeChatPage: React.FC = () => {
  const [searchParams]    = useSearchParams()
  const initConvId        = Number(searchParams.get('conv')) || undefined
  const currentUser       = useAppSelector(s => s.auth.user)

  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConvId, setActiveConvId]   = useState<number | null>(initConvId ?? null)
  const [messages, setMessages]           = useState<Message[]>([])
  const [hasMore, setHasMore]             = useState(false)
  const [input, setInput]                 = useState('')
  const [sending, setSending]             = useState(false)
  const [assigning, setAssigning]         = useState(false)
  const [loadingConvs, setLoadingConvs]   = useState(true)
  const [loadingMsgs, setLoadingMsgs]     = useState(false)
  const [search, setSearch]               = useState('')
  const [apiError, setApiError]           = useState<string | null>(null)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const activeConv = conversations.find(c => c.conversation_id === activeConvId)
  const uid        = currentUser?.user_id ?? 0

  // ── Load inbox ────────────────────────────────────────────────────────────
  const loadConversations = useCallback(() => {
    chatService.getEmployeeConversations()
      .then(res => { setConversations(res.data.conversations); setApiError(null) })
      .catch((e: any) => {
        const msg = e?.response?.data?.detail || e?.message || 'Lỗi tải danh sách hội thoại'
        setApiError(msg)
      })
      .finally(() => setLoadingConvs(false))
  }, [])

  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Socket: nhận new_chat_message khi không mở conversation ──────────────
  useEffect(() => {
    const sio = uid ? getSocket(uid) : null
    if (!sio) return

    const onNewChat = (data: any) => {
      const convId = data.conversation_id
      const msg    = data.message

      // Cập nhật unread + last_message trong danh sách
      setConversations(prev => {
        const exists = prev.find(c => c.conversation_id === convId)
        if (exists) {
          return prev.map(c =>
            c.conversation_id === convId
              ? { ...c, last_message: msg.content, last_message_at: msg.created_at,
                  unread_count: activeConvId === convId ? 0 : c.unread_count + 1 }
              : c
          ).sort((a, b) =>
            new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime()
          )
        }
        // Conv mới (chưa load) → reload inbox
        loadConversations()
        return prev
      })

      // Nếu đang mở conversation đó → thêm tin nhắn vào list
      if (convId === activeConvId) {
        setMessages(prev => {
          if (prev.find(m => m.message_id === msg.message_id)) return prev
          return [...prev, msg]
        })
      }
    }

    sio.on('new_chat_message', onNewChat)
    return () => sio.off('new_chat_message', onNewChat)
  }, [activeConvId, loadConversations])

  // ── Socket: khi conversation được assign ─────────────────────────────────
  useEffect(() => {
    const sio = uid ? getSocket(uid) : null
    if (!sio) return
    const onAssigned = (data: any) => {
      setConversations(prev =>
        prev.map(c =>
          c.conversation_id === data.conversation_id
            ? { ...c, assigned_employee_id: data.employee_id, assigned_employee_name: data.employee_name }
            : c
        )
      )
    }
    sio.on('conv_assigned', onAssigned)
    return () => sio.off('conv_assigned', onAssigned)
  }, [])

  // ── Join/leave conversation room ──────────────────────────────────────────
  useEffect(() => {
    const sio = uid ? getSocket(uid) : null
    if (!sio || !activeConvId) return
    sio.emit('join_conversation', { conversation_id: activeConvId })
    return () => sio.emit('leave_conversation', { conversation_id: activeConvId })
  }, [activeConvId])

  // ── Socket: real-time new_message trong conv đang mở ─────────────────────
  useEffect(() => {
    const sio = uid ? getSocket(uid) : null
    if (!sio) return
    const onMsg = (data: any) => {
      if (data.conversation_id !== activeConvId) return
      const msg = data.message
      setMessages(prev => {
        if (prev.find(m => m.message_id === msg.message_id)) return prev
        return [...prev, msg]
      })
      setConversations(prev =>
        prev.map(c =>
          c.conversation_id === data.conversation_id
            ? { ...c, last_message: msg.content, last_message_at: msg.created_at }
            : c
        )
      )
    }
    sio.on('new_message', onMsg)
    return () => sio.off('new_message', onMsg)
  }, [activeConvId])

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

  // ── Nhận phụ trách conversation ───────────────────────────────────────────
  const handleAssign = async () => {
    if (!activeConvId || assigning) return
    setAssigning(true)
    try {
      await chatService.assignConversation(activeConvId)
      setConversations(prev =>
        prev.map(c =>
          c.conversation_id === activeConvId
            ? { ...c, assigned_employee_id: currentUser?.user_id, assigned_employee_name: currentUser?.full_name }
            : c
        )
      )
    } catch (e: any) {
      alert(e?.response?.data?.detail || 'Không thể nhận phụ trách')
    } finally { setAssigning(false) }
  }

  // ── Gửi tin nhắn ─────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!input.trim() || !activeConvId || sending) return
    const text = input.trim()
    setInput('')
    setSending(true)
    try {
      const res = await chatService.sendMessage(activeConvId, text)
      setMessages(prev => {
        if (prev.find(m => m.message_id === res.data.message_id)) return prev
        return [...prev, res.data]
      })
      // Backend auto-assigns khi NV gửi → cập nhật local state
      setConversations(prev =>
        prev.map(c =>
          c.conversation_id === activeConvId
            ? { ...c, last_message: text, last_message_at: new Date().toISOString(),
                assigned_employee_id: c.assigned_employee_id ?? currentUser?.user_id }
            : c
        )
      )
    } catch { setInput(text) } finally { setSending(false) }
  }

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  const isAssignedToMe = activeConv?.assigned_employee_id === currentUser?.user_id
  const isUnassigned   = !activeConv?.assigned_employee_id
  const canReply       = isAssignedToMe || isUnassigned

  const filtered = search.trim()
    ? conversations.filter(c => c.partner_name?.toLowerCase().includes(search.toLowerCase()))
    : conversations

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <EmployeeLayout shopName="">
      <div style={{ display: 'flex', height: 'calc(100vh - 80px)', border: '1px solid var(--gray-200)', borderRadius: 'var(--radius-lg)', overflow: 'hidden', background: 'white', boxShadow: 'var(--shadow)' }}>

        {/* Sidebar — danh sách conversation */}
        <aside style={{ width: 290, borderRight: '1px solid var(--gray-200)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid var(--gray-200)', background: 'white' }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 10px' }}>Hỗ trợ khách hàng</h2>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Tìm theo tên khách..."
              style={{ width: '100%', padding: '7px 12px', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', fontSize: 13, boxSizing: 'border-box', outline: 'none' }}
            />
          </div>

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingConvs ? (
              <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20, fontSize: 14 }}>Đang tải...</p>
            ) : apiError ? (
              <div style={{ padding: 16, margin: 12, background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8 }}>
                <p style={{ fontSize: 12, color: '#dc2626', margin: 0, fontWeight: 600 }}>Không thể tải hội thoại</p>
                <p style={{ fontSize: 11, color: '#dc2626', margin: '4px 0 8px' }}>{apiError}</p>
                <button onClick={loadConversations} style={{ fontSize: 11, padding: '4px 10px', background: '#dc2626', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer' }}>
                  Thử lại
                </button>
              </div>
            ) : filtered.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20, fontSize: 14 }}>Chưa có tin nhắn nào</p>
            ) : (
              filtered.map(conv => {
                const isActive     = conv.conversation_id === activeConvId
                const myConv       = conv.assigned_employee_id === currentUser?.user_id
                const unassigned   = !conv.assigned_employee_id
                return (
                  <div
                    key={conv.conversation_id}
                    onClick={() => setActiveConvId(conv.conversation_id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '11px 14px', cursor: 'pointer',
                      borderBottom: '1px solid var(--gray-100)',
                      background: isActive ? '#f0f7ff' : 'white',
                      transition: 'background 0.15s',
                    }}
                  >
                    {avatar(conv.partner_name, conv.partner_avatar)}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 4 }}>
                        <span style={{ fontWeight: conv.unread_count > 0 ? 700 : 500, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {conv.partner_name || 'Khách hàng'}
                        </span>
                        {conv.unread_count > 0 && (
                          <span style={{ background: 'var(--primary)', color: 'white', borderRadius: 999, fontSize: 10, fontWeight: 700, padding: '1px 6px', minWidth: 18, textAlign: 'center', flexShrink: 0 }}>
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                      <p style={{ fontSize: 11.5, color: 'var(--gray-500)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.last_message || 'Bắt đầu trò chuyện'}
                      </p>
                      {/* Badge trạng thái assign */}
                      <div style={{ marginTop: 3 }}>
                        {myConv ? (
                          <span style={{ fontSize: 10, color: '#16a34a', fontWeight: 600 }}>✅ Bạn đang phụ trách</span>
                        ) : unassigned ? (
                          <span style={{ fontSize: 10, color: '#d97706', fontWeight: 600 }}>⏳ Chờ nhận hỗ trợ</span>
                        ) : (
                          <span style={{ fontSize: 10, color: 'var(--gray-400)' }}>👤 {conv.assigned_employee_name}</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </aside>

        {/* Chat area */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {!activeConvId ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--gray-400)' }}>
              <span style={{ fontSize: 48 }}>💬</span>
              <p style={{ marginTop: 12, fontSize: 14 }}>Chọn một cuộc hội thoại để hỗ trợ</p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 20px', borderBottom: '1px solid var(--gray-200)', background: 'white', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {avatar(activeConv?.partner_name, activeConv?.partner_avatar)}
                  <div>
                    <p style={{ fontWeight: 600, fontSize: 14, margin: 0 }}>{activeConv?.partner_name || 'Khách hàng'}</p>
                    <p style={{ fontSize: 11, color: 'var(--gray-400)', margin: 0 }}>
                      {isAssignedToMe ? '✅ Bạn đang phụ trách'
                       : isUnassigned  ? '⏳ Chưa có ai nhận'
                       : `👤 ${activeConv?.assigned_employee_name} đang phụ trách`}
                    </p>
                  </div>
                </div>

                {/* Nút Nhận hỗ trợ — chỉ hiện khi chưa assign */}
                {isUnassigned && (
                  <button
                    onClick={handleAssign}
                    disabled={assigning}
                    style={{
                      padding: '8px 18px', background: '#2563eb', color: '#fff',
                      border: 'none', borderRadius: 20, fontWeight: 700, fontSize: 13,
                      cursor: assigning ? 'not-allowed' : 'pointer', opacity: assigning ? 0.7 : 1,
                    }}
                  >
                    {assigning ? 'Đang nhận...' : '🙋 Nhận hỗ trợ'}
                  </button>
                )}
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
                  <p style={{ textAlign: 'center', color: 'var(--gray-400)', padding: 20, fontSize: 14 }}>Hãy bắt đầu hỗ trợ khách hàng 👋</p>
                ) : (
                  messages.map(msg => {
                    const isMine = msg.sender_role === 'shop'
                    return (
                      <div key={msg.message_id} style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: 8 }}>
                        {!isMine && <div style={{ marginRight: 8 }}>{avatar(msg.sender_name, msg.sender_avatar, 32)}</div>}
                        <div>
                          {!isMine && msg.sender_name && (
                            <p style={{ fontSize: 11, color: 'var(--gray-500)', margin: '0 0 2px' }}>{msg.sender_name}</p>
                          )}
                          <div style={{
                            padding: '10px 14px', maxWidth: 340, wordBreak: 'break-word', fontSize: 14, lineHeight: 1.5,
                            background:   isMine ? '#2563eb' : 'var(--gray-100)',
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

              {/* Input — chỉ cho phép khi assigned cho mình hoặc chưa assign */}
              {canReply ? (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--gray-200)', background: 'white' }}>
                  <textarea
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={handleKey}
                    placeholder={isUnassigned ? 'Nhắn tin sẽ tự động nhận phụ trách cuộc hội thoại...' : 'Trả lời khách hàng... (Enter để gửi)'}
                    rows={1}
                    style={{ flex: 1, resize: 'none', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 14, fontFamily: 'inherit', outline: 'none', maxHeight: 120, overflowY: 'auto' }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!input.trim() || sending}
                    style={{ width: 40, height: 40, borderRadius: '50%', background: '#2563eb', color: 'white', border: 'none', cursor: 'pointer', fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: (!input.trim() || sending) ? 0.5 : 1 }}
                  >
                    {sending ? '...' : '➤'}
                  </button>
                </div>
              ) : (
                <div style={{ padding: '12px 20px', borderTop: '1px solid var(--gray-200)', background: '#f9fafb', textAlign: 'center', fontSize: 13, color: 'var(--gray-500)' }}>
                  Hội thoại này đang được {activeConv?.assigned_employee_name} phụ trách
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </EmployeeLayout>
  )
}

export default EmployeeChatPage
