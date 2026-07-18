/**
 * ChatbotWidget — floating AI assistant, bottom-left corner.
 * Role-aware: admin (Sonnet), user/shop/shipper (Haiku). Employee: hidden.
 * Chat history: session-only (lost on tab close).
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import API from '../../services/api'

// ── Config per role ────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, { label: string; color: string; gradient: string; greeting: string; placeholder: string }> = {
  admin: {
    label: 'BuyZo Admin AI',
    color: '#6D28D9',
    gradient: 'linear-gradient(135deg, #6D28D9 0%, #1D4ED8 100%)',
    greeting: 'Xin chào Admin! Tôi có thể giúp bạn xem thống kê, quản lý shop, đơn hàng và khiếu nại. Bạn cần gì?',
    placeholder: 'VD: Doanh thu tháng này? Top shop bán chạy?',
  },
  user: {
    label: 'BuyZo AI',
    color: '#1D4ED8',
    gradient: 'linear-gradient(135deg, #1D4ED8 0%, #06B6D4 100%)',
    greeting: 'Xin chào! Tôi có thể gợi ý sản phẩm, kiểm tra đơn hàng, tìm voucher cho bạn. Thử hỏi tôi nhé!',
    placeholder: 'VD: Tai nghe không dây dưới 500k? Đơn hàng của tôi đâu?',
  },
  shop: {
    label: 'BuyZo Shop AI',
    color: '#16A34A',
    gradient: 'linear-gradient(135deg, #16A34A 0%, #0891B2 100%)',
    greeting: 'Chào chủ shop! Tôi có thể xem doanh thu, sản phẩm sắp hết hàng, đơn hàng chờ xác nhận. Bạn cần gì?',
    placeholder: 'VD: Sản phẩm nào sắp hết? Doanh thu tuần này?',
  },
  shipper: {
    label: 'BuyZo Shipper AI',
    color: '#D97706',
    gradient: 'linear-gradient(135deg, #D97706 0%, #EF4444 100%)',
    greeting: 'Chào shipper! Tôi có thể xem đơn giao hàng, thu nhập, rating và cập nhật trạng thái đơn. Hỏi tôi nhé!',
    placeholder: 'VD: Hôm nay tôi có bao nhiêu đơn? Thu nhập tuần này?',
  },
}

type Msg = { role: 'user' | 'bot'; text: string; ts: Date }

// ── BotAvatar ──────────────────────────────────────────────────────────────────
const BotAvatar: React.FC<{ gradient: string; size?: number }> = ({ gradient, size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: gradient,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.5, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  }}>🤖</div>
)

// ── TypingDots ─────────────────────────────────────────────────────────────────
const TypingDots: React.FC = () => (
  <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '8px 12px' }}>
    {[0, 1, 2].map(i => (
      <div key={i} style={{
        width: 7, height: 7, borderRadius: '50%',
        background: '#94A3B8',
        animation: 'botDot 1.2s infinite',
        animationDelay: `${i * 0.2}s`,
      }} />
    ))}
  </div>
)

// ── Main Widget ────────────────────────────────────────────────────────────────
const ChatbotWidget: React.FC = () => {
  const { isAuthenticated, currentRole } = useAuth()
  const [open, setOpen]       = useState(false)
  const [msgs, setMsgs]       = useState<Msg[]>([])
  const [input, setInput]     = useState('')
  const [loading, setLoading] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  // Only show for supported roles
  const role = currentRole as string
  const cfg  = ROLE_CONFIG[role]
  if (!isAuthenticated || !cfg) return null

  // Initialize greeting once
  useEffect(() => {
    if (open && !initialized) {
      setMsgs([{ role: 'bot', text: cfg.greeting, ts: new Date() }])
      setInitialized(true)
    }
  }, [open, initialized, cfg])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [msgs, loading])

  // Focus input on open
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  const sendMessage = useCallback(async () => {
    const text = input.trim()
    if (!text || loading) return
    setInput('')
    setMsgs(m => [...m, { role: 'user', text, ts: new Date() }])
    setLoading(true)
    try {
      const res = await API.post('/api/v1/bot/query', { message: text })
      const reply: string = res.data.reply
      setMsgs(m => [...m, { role: 'bot', text: reply, ts: new Date() }])
    } catch (e: any) {
      const errMsg = e?.response?.data?.detail || 'Có lỗi xảy ra, thử lại nhé.'
      setMsgs(m => [...m, { role: 'bot', text: `⚠️ ${errMsg}`, ts: new Date() }])
    } finally {
      setLoading(false)
    }
  }, [input, loading])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {/* CSS for dot animation */}
      <style>{`
        @keyframes botDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        @keyframes botSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
      `}</style>

      {/* Floating button — bottom-left */}
      <div style={{
        position: 'fixed', bottom: 24, left: 24, zIndex: 1200,
      }}>
        {/* Popup */}
        {open && (
          <div style={{
            position: 'absolute', bottom: 64, left: 0,
            width: 360, height: 520,
            background: '#fff',
            borderRadius: 18,
            boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden',
            animation: 'botSlideUp 0.22s cubic-bezier(0.22,1,0.36,1)',
          }}>

            {/* Header */}
            <div style={{
              background: cfg.gradient, color: '#fff',
              padding: '14px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              flexShrink: 0,
            }}>
              <BotAvatar gradient="rgba(255,255,255,0.2)" size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 14 }}>{cfg.label}</div>
                <div style={{ fontSize: 11, opacity: 0.85 }}>
                  {loading ? '● Đang trả lời...' : '● Sẵn sàng'}
                </div>
              </div>
              <button
                onClick={() => setOpen(false)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none',
                  borderRadius: '50%', width: 28, height: 28,
                  cursor: 'pointer', color: '#fff', fontSize: 16,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >×</button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1, overflowY: 'auto', padding: '12px 14px',
              display: 'flex', flexDirection: 'column', gap: 10,
              background: '#F8FAFC',
            }}>
              {msgs.map((m, i) => (
                <div key={i} style={{
                  display: 'flex',
                  flexDirection: m.role === 'user' ? 'row-reverse' : 'row',
                  alignItems: 'flex-end', gap: 8,
                }}>
                  {m.role === 'bot' && <BotAvatar gradient={cfg.gradient} size={28} />}

                  <div style={{
                    maxWidth: '78%',
                    background: m.role === 'user' ? cfg.color : '#fff',
                    color: m.role === 'user' ? '#fff' : '#1E293B',
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '9px 13px',
                    fontSize: 13, lineHeight: 1.6,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  }}>
                    {m.text}
                    <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textAlign: 'right' }}>
                      {formatTime(m.ts)}
                    </div>
                  </div>
                </div>
              ))}

              {loading && (
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
                  <BotAvatar gradient={cfg.gradient} size={28} />
                  <div style={{
                    background: '#fff', borderRadius: '16px 16px 16px 4px',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  }}>
                    <TypingDots />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div style={{
              padding: '10px 12px', borderTop: '1px solid #E2E8F0',
              background: '#fff', flexShrink: 0,
              display: 'flex', gap: 8, alignItems: 'flex-end',
            }}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={cfg.placeholder}
                rows={1}
                disabled={loading}
                style={{
                  flex: 1, border: '1.5px solid #E2E8F0', borderRadius: 10,
                  padding: '8px 12px', fontSize: 13, resize: 'none',
                  outline: 'none', fontFamily: 'inherit', lineHeight: 1.5,
                  maxHeight: 88, overflowY: 'auto',
                  background: loading ? '#F8FAFC' : '#fff',
                  color: '#1E293B',
                  transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = cfg.color)}
                onBlur={e  => (e.target.style.borderColor = '#E2E8F0')}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  width: 38, height: 38, borderRadius: 10, border: 'none',
                  background: !input.trim() || loading ? '#E2E8F0' : cfg.gradient,
                  color: !input.trim() || loading ? '#94A3B8' : '#fff',
                  cursor: !input.trim() || loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18, flexShrink: 0, transition: 'all 0.15s',
                }}
              >➤</button>
            </div>

            {/* Clear chat */}
            <div style={{ textAlign: 'center', padding: '6px 0 8px', background: '#fff' }}>
              <button
                onClick={() => { setMsgs([{ role: 'bot', text: cfg.greeting, ts: new Date() }]) }}
                style={{ fontSize: 11, color: '#94A3B8', background: 'none', border: 'none', cursor: 'pointer' }}
              >
                🗑 Xóa lịch sử chat
              </button>
            </div>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setOpen(o => !o)}
          title={cfg.label}
          style={{
            width: 52, height: 52, borderRadius: '50%', border: 'none',
            background: open ? '#64748B' : cfg.gradient,
            color: '#fff', fontSize: 24,
            cursor: 'pointer', boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.2s',
            transform: open ? 'rotate(45deg)' : 'rotate(0deg)',
          }}
        >
          {open ? '×' : '🤖'}
        </button>
      </div>
    </>
  )
}

export default ChatbotWidget
