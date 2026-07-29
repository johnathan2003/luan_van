import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../../hooks/useTheme'
import { useAuth } from '../../hooks/useAuth'
import { THEME_MODE_ICONS, THEME_MODE_LABELS } from '../../utils/theme'
import { chatService } from '../../services/chatService'
import type { Conversation, Message } from '../../types/chat'

const MANUAL_MODES = ['light', 'dark'] as const
const MAX_BUBBLES = 5

const timeAgo = (iso?: string) => {
  if (!iso) return ''
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  if (diff < 60)    return 'vua xong'
  if (diff < 3600)  return `${Math.floor(diff / 60)} phut`
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ`
  return `${Math.floor(diff / 86400)} ngay`
}

if (!document.getElementById('cw-kf')) {
  const s = document.createElement('style')
  s.id = 'cw-kf'
  s.textContent = `
    @keyframes cw-pop{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes cw-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
    @keyframes cw-bounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}60%{transform:translateY(-2px)}}
    @keyframes cw-fadeinX{from{opacity:0;transform:translateX(-6px)}to{opacity:1;transform:translateX(0)}}
  `
  document.head.appendChild(s)
}

const BTN: React.CSSProperties = {
  width: 44, height: 44, borderRadius: '50%',
  border: '1px solid var(--border-subtle)',
  background: 'var(--bg-card)', boxShadow: 'var(--shadow-md)',
  cursor: 'pointer', fontSize: 20,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  transition: 'box-shadow 0.2s, transform 0.2s',
}
const on  = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.transform = 'scale(1.08)' }
const off = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.boxShadow = 'var(--shadow-md)'; e.currentTarget.style.transform = 'scale(1)' }

const Av = ({ src, name, sz = 38 }: { src?: string; name?: string; sz?: number }) =>
  src
    ? <img src={src} alt="" style={{ width: sz, height: sz, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: sz, height: sz, borderRadius: '50%', background: 'var(--primary,#7C3AED)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: sz * 0.4, flexShrink: 0 }}>
        {(name || '?')[0].toUpperCase()}
      </div>

const ThemeToggle: React.FC = () => {
  const { themeMode, resolvedTheme, setMode } = useTheme()
  const { isAuthenticated, user, currentRole } = useAuth()
  const active = themeMode === 'auto' ? resolvedTheme : themeMode
  const navigate = useNavigate()

  const [themeOpen,      setThemeOpen]      = useState(false)
  const [chatOpen,       setChatOpen]       = useState(false)
  const [convs,          setConvs]          = useState<Conversation[]>([])
  const [hasNew,         setHasNew]         = useState(false)
  const [activeConv,     setActiveConv]     = useState<Conversation | null>(null)
  const [minimizedConvs, setMinimizedConvs] = useState<Conversation[]>([])
  const [msgMap,         setMsgMap]         = useState<Record<number, Message[]>>({})
  const [inputMap,       setInputMap]       = useState<Record<number, string>>({})
  const [sendingMap,     setSendingMap]     = useState<Record<number, boolean>>({})
  const [toastMap,       setToastMap]       = useState<Record<number, string | null>>({})
  const [hoverBubble,    setHoverBubble]    = useState<number | null>(null)

  const prevUnread    = useRef(0)
  const activeConvRef = useRef<Conversation | null>(null)
  const minimizedRef  = useRef<Conversation[]>([])
  const toastTimers   = useRef<Record<number, ReturnType<typeof setTimeout>>>({})
  const openIdsRef    = useRef<number[]>([])
  const wrapRef       = useRef<HTMLDivElement>(null)
  const chatRef       = useRef<HTMLDivElement>(null)
  const msgEnd        = useRef<HTMLDivElement>(null)

  useEffect(() => { activeConvRef.current = activeConv },     [activeConv])
  useEffect(() => { minimizedRef.current  = minimizedConvs }, [minimizedConvs])
  useEffect(() => {
    const ids: number[] = []
    if (activeConv) ids.push(activeConv.conversation_id)
    minimizedConvs.forEach(c => ids.push(c.conversation_id))
    openIdsRef.current = ids
  }, [activeConv, minimizedConvs])

  const role     = currentRole || user?.current_role || ''
  const chatPath = role === 'shop' ? '/shop/chat' : role === 'employee' ? '/employee/chat' : '/chat'
  // Luôn hiện nút chat — click sẽ redirect login nếu chưa đăng nhập
  const showChat = true

  const fetchConvs = useCallback(async () => {
    if (!isAuthenticated) return
    try {
      let res
      if (role === 'shop')          res = await chatService.getShopConversations()
      else if (role === 'employee') res = await chatService.getEmployeeConversations()
      else                          res = await chatService.getMyConversations()
      const list: Conversation[] = res.data?.conversations ?? res.data ?? []
      setConvs(list)
      const total = list.reduce((s, c) => s + (c.unread_count || 0), 0)
      if (total > prevUnread.current) { setHasNew(true); setTimeout(() => setHasNew(false), 1800) }
      prevUnread.current = total
    } catch { /* ignore */ }
  }, [showChat, role])

  useEffect(() => {
    if (!isAuthenticated) return
    fetchConvs()
    const id = setInterval(fetchConvs, 20_000)
    return () => clearInterval(id)
  }, [showChat, fetchConvs])

  const fetchMsgsForConv = useCallback(async (convId: number) => {
    const isMin    = minimizedRef.current.some(c => c.conversation_id === convId)
    const isActive = activeConvRef.current?.conversation_id === convId
    if (!isMin && !isActive) return
    try {
      const res = await chatService.getMessages(convId, undefined, 50)
      // Sort ASC (cũ → mới) để render đúng thứ tự chat
      const sorted: Message[] = [...(res.data?.messages ?? [])].sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      )
      setMsgMap(prev => {
        const old = prev[convId] ?? []
        if (isMin) {
          const oldIds = new Set(old.map((m: Message) => m.message_id))
          const fresh  = sorted.filter((m: Message) => !oldIds.has(m.message_id) && m.sender_id !== user?.user_id)
          if (fresh.length > 0) {
            const preview = fresh[fresh.length - 1].content || 'Tin nhắn mới'
            setToastMap(t => ({ ...t, [convId]: preview }))
            if (toastTimers.current[convId]) clearTimeout(toastTimers.current[convId])
            toastTimers.current[convId] = setTimeout(() => setToastMap(t => ({ ...t, [convId]: null })), 3000)
            // Dua bubble len dau khi co tin moi
            setMinimizedConvs(prev2 => {
              const conv = prev2.find(c => c.conversation_id === convId)
              if (!conv) return prev2
              return [conv, ...prev2.filter(c => c.conversation_id !== convId)]
            })
          }
        }
        return { ...prev, [convId]: sorted }
      })
      if (isActive) chatService.markRead(convId).catch(() => {})
    } catch { /* ignore */ }
  }, [user?.user_id])

  useEffect(() => {
    const key = [activeConv?.conversation_id ?? '', ...minimizedConvs.map(c => c.conversation_id)].join(',')
    if (!key.replace(/,/g, '')) return
    openIdsRef.current.forEach(id => fetchMsgsForConv(id))
    const timer = setInterval(() => openIdsRef.current.forEach(id => fetchMsgsForConv(id)), 5000)
    return () => clearInterval(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConv?.conversation_id, minimizedConvs.map(c => c.conversation_id).join(','), fetchMsgsForConv])

  const activeMessages = activeConv ? (msgMap[activeConv.conversation_id] ?? []) : []
  useEffect(() => { msgEnd.current?.scrollIntoView({ behavior: 'smooth' }) }, [activeMessages.length])

  const openConv = (c: Conversation) => {
    setMinimizedConvs(prev => {
      const withoutNew = prev.filter(m => m.conversation_id !== c.conversation_id)
      const cur = activeConvRef.current
      if (cur && cur.conversation_id !== c.conversation_id) {
        return withoutNew.some(m => m.conversation_id === cur.conversation_id) ? withoutNew : [cur, ...withoutNew]
      }
      return withoutNew
    })
    setActiveConv(c)
    setChatOpen(true)
    setInputMap(m => ({ ...m, [c.conversation_id]: m[c.conversation_id] ?? '' }))
  }

  // Thu gon: them vao DAU danh sach bubble
  const minimizeActive = () => {
    if (!activeConv) return
    setMinimizedConvs(prev => prev.some(c => c.conversation_id === activeConv.conversation_id) ? prev : [activeConv, ...prev])
    setActiveConv(null)
    setChatOpen(false)
  }

  const restoreBubble = (convId: number) => {
    const conv = minimizedRef.current.find(c => c.conversation_id === convId)
    if (!conv) return
    setMinimizedConvs(prev => {
      const withoutTarget = prev.filter(c => c.conversation_id !== convId)
      const cur = activeConvRef.current
      if (cur) {
        return withoutTarget.some(c => c.conversation_id === cur.conversation_id) ? withoutTarget : [cur, ...withoutTarget]
      }
      return withoutTarget
    })
    setActiveConv(conv)
    setChatOpen(true)
    chatService.markRead(convId).catch(() => {})
  }

  const closeBubble = (convId: number) => {
    setMinimizedConvs(prev => prev.filter(c => c.conversation_id !== convId))
    setMsgMap(prev  => { const n = { ...prev };  delete n[convId]; return n })
    setToastMap(prev => { const n = { ...prev }; delete n[convId]; return n })
    if (toastTimers.current[convId]) clearTimeout(toastTimers.current[convId])
  }

  const closePanel     = () => { setActiveConv(null) }
  const fullClosePanel = () => { setActiveConv(null); setChatOpen(false) }

  const handleSend = async (convId: number) => {
    const text = (inputMap[convId] ?? '').trim()
    if (!text || sendingMap[convId]) return
    setInputMap(m  => ({ ...m,  [convId]: '' }))
    setSendingMap(m => ({ ...m, [convId]: true }))
    try {
      const res = await chatService.sendMessage(convId, text)
      setMsgMap(prev => ({ ...prev, [convId]: [...(prev[convId] ?? []), res.data] }))
    } catch { /* ignore */ } finally { setSendingMap(m => ({ ...m, [convId]: false })) }
  }

  useEffect(() => {
    if (!chatOpen && !themeOpen) return
    const h = (e: MouseEvent) => {
      const inW = wrapRef.current?.contains(e.target as Node)
      const inC = chatRef.current?.contains(e.target as Node)
      if (!inW && !inC) {
        setThemeOpen(false)
        if (!activeConvRef.current) setChatOpen(false)
      }
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [chatOpen, themeOpen])

  const totalUnread   = convs.reduce((s, c) => s + (c.unread_count || 0), 0)
  const icon          = THEME_MODE_ICONS[active as keyof typeof THEME_MODE_ICONS] || '\u{1F319}'
  const visibleBubbles = minimizedConvs.slice(0, MAX_BUBBLES)

  return (
    <>
      {/* Chat panel */}
      {chatOpen && (
        <div ref={chatRef} style={{ position: 'fixed', bottom: 24, right: 80, zIndex: 10000, width: 320, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 16, boxShadow: '0 8px 40px rgba(0,0,0,0.18)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {activeConv ? (
            <>
              <div style={{ padding: '8px 10px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <button onClick={closePanel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--text-secondary)', lineHeight: 1, paddingBottom: 2 }}>&#x2039;</button>
                <Av src={activeConv.partner_avatar} name={activeConv.partner_name} sz={30} />
                <span style={{ flex: 1, fontWeight: 700, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeConv.partner_name || 'Shop'}</span>
                <button onClick={minimizeActive} title="Thu gọn" style={{ background: 'var(--bg-highlight,rgba(0,0,0,0.06))', border: 'none', cursor: 'pointer', width: 26, height: 26, borderRadius: '50%', fontSize: 16, fontWeight: 700, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#x2212;</button>
                <button onClick={() => { const id = activeConv.conversation_id; fullClosePanel(); navigate(role === 'shop' || role === 'employee' ? chatPath + '?conv=' + id : chatPath + '?shop=' + activeConv.shop_id) }} title="Mở chat" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--primary,#7C3AED)' }}>&#x2922;</button>
                <button onClick={fullClosePanel} style={{ background: 'var(--bg-highlight,rgba(0,0,0,0.06))', border: 'none', cursor: 'pointer', width: 26, height: 26, borderRadius: '50%', fontSize: 13, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#x2715;</button>
              </div>
              <div style={{ overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column-reverse', gap: 6, minHeight: 280, maxHeight: 340, background: 'var(--bg-page,#f5f5f5)' }}>
                {activeMessages.length === 0
                  ? <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)', fontSize: 12, paddingTop: 80 }}>Bắt đầu cuộc trò chuyện</div>
                  : [...activeMessages].reverse().map((m: Message) => {
                      const mine = m.sender_id === user?.user_id
                      return (
                        <div key={m.message_id} style={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 6 }}>
                          {!mine && <Av src={activeConv.partner_avatar} name={activeConv.partner_name} sz={24} />}
                          <div style={{ maxWidth: '72%', padding: '8px 12px', borderRadius: mine ? '18px 18px 4px 18px' : '18px 18px 18px 4px', background: mine ? 'var(--primary,#7C3AED)' : 'var(--bg-card)', color: mine ? '#fff' : 'var(--text-primary)', fontSize: 13, lineHeight: 1.4, boxShadow: '0 1px 2px rgba(0,0,0,0.08)', wordBreak: 'break-word' }}>
                            {m.image_url && <img src={m.image_url} alt="" style={{ maxWidth: '100%', borderRadius: 8, display: 'block', marginBottom: m.content ? 4 : 0 }} />}
                            {m.content}
                          </div>
                        </div>
                      )
                    })
                }
              </div>
              <div style={{ borderTop: '1px solid var(--border-subtle)', padding: '8px 10px', display: 'flex', gap: 8, alignItems: 'center', background: 'var(--bg-card)' }}>
                <input
                  value={inputMap[activeConv.conversation_id] ?? ''}
                  onChange={e => setInputMap(m => ({ ...m, [activeConv.conversation_id]: e.target.value }))}
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(activeConv.conversation_id) } }}
                  placeholder="Nhắn tin..."
                  style={{ flex: 1, border: '1px solid var(--border-subtle)', borderRadius: 20, padding: '7px 14px', fontSize: 13, outline: 'none', background: 'var(--bg-page,#f5f5f5)', color: 'var(--text-primary)' }}
                />
                <button
                  onClick={() => handleSend(activeConv.conversation_id)}
                  disabled={!(inputMap[activeConv.conversation_id] ?? '').trim() || !!sendingMap[activeConv.conversation_id]}
                  style={{ width: 34, height: 34, borderRadius: '50%', border: 'none', cursor: (inputMap[activeConv.conversation_id] ?? '').trim() ? 'pointer' : 'default', background: (inputMap[activeConv.conversation_id] ?? '').trim() ? 'var(--primary,#7C3AED)' : 'var(--bg-highlight,#eee)', color: (inputMap[activeConv.conversation_id] ?? '').trim() ? '#fff' : 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, transition: 'background 0.15s' }}
                >&#x27A4;</button>
              </div>
            </>
          ) : (
            <>
              <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 18 }}>&#x1F4AC;</span>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>Tin nhắn</span>
                  {totalUnread > 0 && <span style={{ background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, padding: '1px 7px', borderRadius: 8 }}>{totalUnread} chua doc</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button onClick={() => { setChatOpen(false); navigate(chatPath) }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: 'var(--primary,#7C3AED)', fontWeight: 600 }}>Xem tất cả &#x2192;</button>
                  <button onClick={() => setChatOpen(false)} style={{ background: 'var(--bg-highlight,rgba(0,0,0,0.06))', border: 'none', cursor: 'pointer', width: 28, height: 28, borderRadius: '50%', fontSize: 14, color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>&#x2715;</button>
                </div>
              </div>
              <div style={{ overflowY: 'auto', maxHeight: 6 * 58 }}>
                {convs.length === 0
                  ? <div style={{ padding: 32, textAlign: 'center' }}>
                      <div style={{ fontSize: 36, marginBottom: 8 }}>&#x1F4AC;</div>
                      <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>Chưa có tin nhắn nào</p>
                    </div>
                  : convs.map(c => (
                    <div key={c.conversation_id} onClick={() => openConv(c)}
                      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)', background: c.unread_count > 0 ? 'rgba(124,58,237,0.04)' : 'transparent', transition: 'background 0.15s' }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-highlight,rgba(0,0,0,0.04))')}
                      onMouseLeave={e => (e.currentTarget.style.background = c.unread_count > 0 ? 'rgba(124,58,237,0.04)' : 'transparent')}
                    >
                      <Av src={c.partner_avatar} name={c.partner_name} sz={38} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ fontWeight: c.unread_count > 0 ? 700 : 500, fontSize: 13, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{c.partner_name || 'Shop'}</span>
                          <span style={{ fontSize: 11, color: 'var(--text-secondary)', flexShrink: 0, marginLeft: 4 }}>{timeAgo(c.last_message_at)}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 }}>
                          <span style={{ fontSize: 12, color: c.unread_count > 0 ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: c.unread_count > 0 ? 600 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 }}>{c.last_message || 'Bắt đầu cuộc trò chuyện'}</span>
                          {c.unread_count > 0 && <span style={{ minWidth: 16, height: 16, borderRadius: 8, background: '#7C3AED', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', marginLeft: 4, flexShrink: 0 }}>{c.unread_count}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                }
              </div>
            </>
          )}
        </div>
      )}

      {/* Fixed button group */}
      <div ref={wrapRef} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>

        {/* Minimized bubbles — toi da MAX_BUBBLES, moi nhat o tren */}
        {showChat && visibleBubbles.map(conv => {
          const convId  = conv.conversation_id
          const toast   = toastMap[convId] ?? null
          const lastMsg = (msgMap[convId] ?? []).slice(-1)[0]
          const hovered = hoverBubble === convId
          return (
            <div key={convId} style={{ position: 'relative' }}
              onMouseEnter={() => setHoverBubble(convId)}
              onMouseLeave={() => setHoverBubble(null)}
            >
              {(toast || hovered) && (
                <div style={{ position: 'absolute', right: 'calc(100% + 10px)', top: '50%', transform: 'translateY(-50%)', background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, padding: '8px 12px', boxShadow: '0 4px 20px rgba(0,0,0,0.15)', minWidth: 160, maxWidth: 220, animation: 'cw-fadeinX 0.18s ease', pointerEvents: 'none', zIndex: 1, whiteSpace: 'nowrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                    <Av src={conv.partner_avatar} name={conv.partner_name} sz={18} />
                    <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>{conv.partner_name || 'Shop'}</span>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {toast ?? (lastMsg?.content ? (lastMsg.content.length > 34 ? lastMsg.content.slice(0, 34) + '...' : lastMsg.content) : 'Bắt đầu cuộc trò chuyện')}
                  </p>
                </div>
              )}
              <div onClick={() => restoreBubble(convId)} style={{ width: 44, height: 44, borderRadius: '50%', cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)', border: '2px solid var(--primary,#7C3AED)', overflow: 'hidden' }}>
                <Av src={conv.partner_avatar} name={conv.partner_name} sz={40} />
              </div>
              {toast && <span style={{ position: 'absolute', top: 0, left: 0, width: 12, height: 12, borderRadius: '50%', background: '#EF4444', border: '2px solid var(--bg-card)', animation: 'cw-pulse 1s ease infinite', pointerEvents: 'none' }} />}
              {hovered && (
                <button onClick={e => { e.stopPropagation(); closeBubble(convId) }} title="Đóng"
                  style={{ position: 'absolute', top: -5, right: -5, width: 18, height: 18, borderRadius: '50%', border: 'none', cursor: 'pointer', background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.25)' }}>
                  &#x2715;
                </button>
              )}
            </div>
          )
        })}

        {/* Chat button */}
        {showChat && (
          <div style={{ position: 'relative' }}>
            <button type="button" aria-label="Tin nhắn" title="Tin nhắn"
              onClick={() => { if (!isAuthenticated) { navigate('/login'); return } setThemeOpen(false); if (chatOpen && !activeConv) { setChatOpen(false) } else { setChatOpen(true); setActiveConv(null); fetchConvs() } }}
              style={{ ...BTN, animation: hasNew ? 'cw-bounce 0.6s ease' : undefined } as React.CSSProperties}
              onMouseEnter={on} onMouseLeave={off}
            >&#x1F4AC;</button>
            {totalUnread > 0 && !chatOpen && (
              <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, borderRadius: 9, background: '#EF4444', color: '#fff', fontSize: 10, fontWeight: 800, lineHeight: '18px', textAlign: 'center', padding: '0 4px', border: '2px solid var(--bg-card)', pointerEvents: 'none' }}>
                {totalUnread > 99 ? '99+' : totalUnread}
              </span>
            )}
          </div>
        )}

        <button type="button" aria-label="Theo dõi đơn hàng" title="Theo dõi đơn hàng" onClick={() => navigate('/orders')} style={BTN} onMouseEnter={on} onMouseLeave={off}>&#x1F4E6;</button>
        <button type="button" aria-label="Sự kiện" title="Sự kiện" onClick={() => navigate('/events')} style={BTN} onMouseEnter={on} onMouseLeave={off}>&#x1F381;</button>

        {/* Theme button + dropdown sang trai */}
        <div style={{ position: 'relative' }}>
          {themeOpen && (
            <div style={{ position: 'absolute', right: 'calc(100% + 10px)', bottom: 0, background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.15)', overflow: 'hidden', display: 'flex', flexDirection: 'column', animation: 'cw-fadeinX 0.15s ease', whiteSpace: 'nowrap', zIndex: 1 }}>
              {MANUAL_MODES.map(mode => (
                <button key={mode} type="button" onClick={() => { setMode(mode); setThemeOpen(false) }}
                  style={{ border: 'none', cursor: 'pointer', padding: '11px 18px', fontSize: 13, fontWeight: active === mode ? 700 : 400, background: active === mode ? 'rgba(124,58,237,0.08)' : 'transparent', color: active === mode ? 'var(--primary,#7C3AED)' : 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 10, transition: 'background 0.15s', textAlign: 'left' }}
                  onMouseEnter={e => { if (active !== mode) (e.currentTarget as HTMLButtonElement).style.background = 'var(--bg-highlight,rgba(0,0,0,0.04))' }}
                  onMouseLeave={e => { if (active !== mode) (e.currentTarget as HTMLButtonElement).style.background = 'transparent' }}
                >
                  <span style={{ fontSize: 16 }}>{THEME_MODE_ICONS[mode]}</span>
                  <span>{THEME_MODE_LABELS[mode]}</span>
                </button>
              ))}
            </div>
          )}
          <button type="button" aria-label="Chuyển đổi giao diện" onClick={() => { setThemeOpen(o => !o); setChatOpen(false) }} style={BTN} onMouseEnter={on} onMouseLeave={off}>{icon}</button>
        </div>

      </div>
    </>
  )
}

export default ThemeToggle
