/**
 * ChatbotWidget — floating AI assistant, bottom-left corner.
 * Role-aware: admin (Pro), user/shop/shipper (Flash).
 * Conversation history persisted server-side via Redis.
 * Features: quick-action chips, simple markdown render, role badge, typing indicator.
 */
import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../../hooks/useAuth'
import API from '../../services/api'

// ── Role config ───────────────────────────────────────────────────────────────
const ROLE_CONFIG: Record<string, {
  label: string
  badge: string
  color: string
  gradient: string
  greeting: string
  placeholder: string
  chips: string[]
}> = {
  admin: {
    label: 'BuyZo Admin AI',
    badge: 'ADMIN',
    color: '#6D28D9',
    gradient: 'linear-gradient(135deg, #6D28D9 0%, #1D4ED8 100%)',
    greeting: 'Xin chào Admin! Tôi có thể giúp bạn xem thống kê, quản lý shop, đơn hàng và tranh chấp. Bạn cần gì?',
    placeholder: 'VD: Doanh thu tháng này? Tranh chấp mới nhất?',
    chips: ['📊 Thống kê hôm nay', '🏪 Shop đang chờ duyệt', '⚖️ Tranh chấp mới', '🛵 Shipper chờ duyệt'],
  },
  user: {
    label: 'BuyZo AI',
    badge: 'USER',
    color: '#1D4ED8',
    gradient: 'linear-gradient(135deg, #1D4ED8 0%, #06B6D4 100%)',
    greeting: 'Xin chào! Tôi có thể gợi ý sản phẩm, kiểm tra đơn hàng và tìm voucher cho bạn. Thử hỏi tôi nhé!',
    placeholder: 'VD: Tai nghe dưới 500k? Đơn hàng của tôi đâu?',
    chips: ['📦 Đơn hàng của tôi', '🔍 Tìm sản phẩm', '🎫 Voucher hiện có', '📋 Lịch sử mua hàng'],
  },
  shop: {
    label: 'BuyZo Shop AI',
    badge: 'SHOP',
    color: '#16A34A',
    gradient: 'linear-gradient(135deg, #16A34A 0%, #0891B2 100%)',
    greeting: 'Chào chủ shop! Tôi có thể xem doanh thu, sản phẩm sắp hết hàng và đơn hàng chờ xác nhận. Bạn cần gì?',
    placeholder: 'VD: Sản phẩm nào sắp hết? Doanh thu tuần này?',
    chips: ['💰 Doanh thu hôm nay', '📦 Đơn chờ xác nhận', '⚠️ Hàng sắp hết', '💳 Số dư ví'],
  },
  shipper: {
    label: 'BuyZo Shipper AI',
    badge: 'SHIPPER',
    color: '#D97706',
    gradient: 'linear-gradient(135deg, #D97706 0%, #EF4444 100%)',
    greeting: 'Chào shipper! Tôi có thể xem đơn giao hàng, thu nhập và cập nhật trạng thái đơn. Hỏi tôi nhé!',
    placeholder: 'VD: Đơn tiếp theo của tôi? Thu nhập tuần này?',
    chips: ['🚚 Đơn tiếp theo', '📋 Đơn hôm nay', '💵 Thu nhập tuần', '👤 Hồ sơ của tôi'],
  },
}

// Mapping chip text → bot message
const CHIP_MESSAGES: Record<string, string> = {
  '📊 Thống kê hôm nay': 'Cho tôi xem thống kê hệ thống hôm nay',
  '🏪 Shop đang chờ duyệt': 'Danh sách shop đang chờ duyệt',
  '⚖️ Tranh chấp mới': 'Xem các tranh chấp đang mở',
  '🛵 Shipper chờ duyệt': 'Danh sách shipper đang chờ duyệt',
  '📦 Đơn hàng của tôi': 'Đơn hàng gần nhất của tôi là gì?',
  '🔍 Tìm sản phẩm': 'Gợi ý một số sản phẩm bán chạy cho tôi',
  '🎫 Voucher hiện có': 'Có voucher gì đang dùng được không?',
  '📋 Lịch sử mua hàng': 'Xem lịch sử mua hàng của tôi',
  '💰 Doanh thu hôm nay': 'Doanh thu shop hôm nay là bao nhiêu?',
  '📦 Đơn chờ xác nhận': 'Có bao nhiêu đơn đang chờ tôi xác nhận?',
  '⚠️ Hàng sắp hết': 'Sản phẩm nào đang sắp hết hàng?',
  '💳 Số dư ví': 'Số dư ví shop hiện tại là bao nhiêu?',
  '🚚 Đơn tiếp theo': 'Đơn giao hàng tiếp theo tôi cần xử lý là gì?',
  '📋 Đơn hôm nay': 'Hôm nay tôi có bao nhiêu đơn?',
  '💵 Thu nhập tuần': 'Thu nhập của tôi tuần này là bao nhiêu?',
  '👤 Hồ sơ của tôi': 'Cho tôi xem hồ sơ shipper của mình',
}

type Msg = { role: 'user' | 'bot'; text: string; ts: Date }

// ── Simple markdown renderer ──────────────────────────────────────────────────
function renderMarkdown(text: string): React.ReactNode {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Bullet list
    if (line.match(/^[-•*]\s+/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^[-•*]\s+/)) {
        items.push(lines[i].replace(/^[-•*]\s+/, ''))
        i++
      }
      elements.push(
        <ul key={`ul-${i}`} style={{ margin: '4px 0', paddingLeft: 18 }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 2 }}>{inlineMarkdown(item)}</li>
          ))}
        </ul>
      )
      continue
    }

    // Numbered list
    if (line.match(/^\d+\.\s+/)) {
      const items: string[] = []
      while (i < lines.length && lines[i].match(/^\d+\.\s+/)) {
        items.push(lines[i].replace(/^\d+\.\s+/, ''))
        i++
      }
      elements.push(
        <ol key={`ol-${i}`} style={{ margin: '4px 0', paddingLeft: 18 }}>
          {items.map((item, j) => (
            <li key={j} style={{ marginBottom: 2 }}>{inlineMarkdown(item)}</li>
          ))}
        </ol>
      )
      continue
    }

    // Empty line
    if (line.trim() === '') {
      elements.push(<div key={`br-${i}`} style={{ height: 4 }} />)
      i++
      continue
    }

    // Normal paragraph
    elements.push(
      <p key={`p-${i}`} style={{ margin: '2px 0' }}>{inlineMarkdown(line)}</p>
    )
    i++
  }

  return <>{elements}</>
}

function inlineMarkdown(text: string): React.ReactNode {
  // Bold **text** or __text__
  const parts = text.split(/(\*\*[^*]+\*\*|__[^_]+__)/g)
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    if (part.startsWith('__') && part.endsWith('__')) {
      return <strong key={i}>{part.slice(2, -2)}</strong>
    }
    return part
  })
}

// ── BotAvatar ─────────────────────────────────────────────────────────────────
const BotAvatar: React.FC<{ gradient: string; size?: number }> = ({ gradient, size = 32 }) => (
  <div style={{
    width: size, height: size, borderRadius: '50%', flexShrink: 0,
    background: gradient,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: size * 0.5, boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
  }}>🤖</div>
)

// ── TypingDots ────────────────────────────────────────────────────────────────
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

// ── Main Widget ───────────────────────────────────────────────────────────────
const ChatbotWidget: React.FC = () => {
  const { isAuthenticated, currentRole } = useAuth()
  const [open, setOpen]             = useState(false)
  const [msgs, setMsgs]             = useState<Msg[]>([])
  const [input, setInput]           = useState('')
  const [loading, setLoading]       = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [showChips, setShowChips]   = useState(true)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef  = useRef<HTMLTextAreaElement>(null)

  const role = currentRole as string
  const cfg  = ROLE_CONFIG[role]
  if (!isAuthenticated || !cfg) return null

  // Initialize greeting once when opened
  useEffect(() => {
    if (open && !initialized) {
      setMsgs([{ role: 'bot', text: cfg.greeting, ts: new Date() }])
      setInitialized(true)
      setShowChips(true)
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

  const sendMessage = useCallback(async (text?: string) => {
    const msg = (text ?? input).trim()
    if (!msg || loading) return
    setInput('')
    setShowChips(false)
    setMsgs(m => [...m, { role: 'user', text: msg, ts: new Date() }])
    setLoading(true)
    try {
      const res = await API.post('/api/v1/bot/query', { message: msg })
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

  const handleClear = async () => {
    try { await API.post('/api/v1/bot/clear') } catch {}
    setMsgs([{ role: 'bot', text: cfg.greeting, ts: new Date() }])
    setShowChips(true)
  }

  const formatTime = (d: Date) =>
    d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })

  return (
    <>
      {/* CSS */}
      <style>{`
        @keyframes botDot {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1);   opacity: 1;   }
        }
        @keyframes botSlideUp {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0)    scale(1);    }
        }
        .bot-chip {
          display: inline-block;
          padding: 5px 11px;
          margin: 3px 3px 3px 0;
          border-radius: 16px;
          font-size: 12px;
          cursor: pointer;
          border: 1.5px solid;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .bot-chip:hover { opacity: 0.8; transform: scale(0.97); }
      `}</style>

      {/* Floating button container */}
      <div style={{ position: 'fixed', bottom: 24, left: 24, zIndex: 1200 }}>

        {/* Popup */}
        {open && (
          <div style={{
            position: 'absolute', bottom: 64, left: 0,
            width: 368, height: 540,
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
              padding: '12px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
              flexShrink: 0,
            }}>
              <BotAvatar gradient="rgba(255,255,255,0.2)" size={36} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 14 }}>{cfg.label}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: 0.5,
                    background: 'rgba(255,255,255,0.25)',
                    borderRadius: 4, padding: '1px 5px',
                  }}>{cfg.badge}</span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.85, marginTop: 1 }}>
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
                    maxWidth: '80%',
                    background: m.role === 'user' ? cfg.color : '#fff',
                    color: m.role === 'user' ? '#fff' : '#1E293B',
                    borderRadius: m.role === 'user' ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    padding: '9px 13px',
                    fontSize: 13, lineHeight: 1.6,
                    boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                    wordBreak: 'break-word',
                  }}>
                    {m.role === 'bot'
                      ? renderMarkdown(m.text)
                      : <span style={{ whiteSpace: 'pre-wrap' }}>{m.text}</span>
                    }
                    <div style={{ fontSize: 10, opacity: 0.55, marginTop: 4, textAlign: 'right' }}>
                      {formatTime(m.ts)}
                    </div>
                  </div>
                </div>
              ))}

              {/* Quick chips — shown after greeting */}
              {showChips && !loading && msgs.length <= 1 && (
                <div style={{ paddingLeft: 36 }}>
                  <div style={{ fontSize: 11, color: '#94A3B8', marginBottom: 4 }}>Gợi ý nhanh:</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 0 }}>
                    {cfg.chips.map(chip => (
                      <button
                        key={chip}
                        className="bot-chip"
                        onClick={() => sendMessage(CHIP_MESSAGES[chip] ?? chip)}
                        style={{
                          color: cfg.color,
                          borderColor: cfg.color + '55',
                          background: cfg.color + '0f',
                        }}
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                </div>
              )}

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

            {/* Input area */}
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
                  color: '#1E293B', transition: 'border-color 0.15s',
                }}
                onFocus={e => (e.target.style.borderColor = cfg.color)}
                onBlur={e  => (e.target.style.borderColor = '#E2E8F0')}
              />
              <button
                onClick={() => sendMessage()}
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

            {/* Footer */}
            <div style={{
              textAlign: 'center', padding: '5px 0 8px',
              background: '#fff', borderTop: '1px solid #F1F5F9',
            }}>
              <button
                onClick={handleClear}
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
