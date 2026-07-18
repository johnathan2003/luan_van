import React, { useEffect, useRef, useState, useCallback } from 'react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: number
}

const SHAKE_KEYFRAMES = `
@keyframes modal-shake {
  0%   { transform: translateX(0); }
  15%  { transform: translateX(-8px); }
  30%  { transform: translateX(8px); }
  45%  { transform: translateX(-6px); }
  60%  { transform: translateX(6px); }
  75%  { transform: translateX(-3px); }
  90%  { transform: translateX(3px); }
  100% { transform: translateX(0); }
}
`

const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, width = 620 }) => {
  const [shaking, setShaking] = useState(false)
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden'
    else document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [open])

  useEffect(() => {
    const id = 'modal-shake-style'
    if (!document.getElementById(id)) {
      const style = document.createElement('style')
      style.id = id
      style.textContent = SHAKE_KEYFRAMES
      document.head.appendChild(style)
    }
  }, [])

  const handleBackdropClick = useCallback(() => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current)
    setShaking(true)
    shakeTimer.current = setTimeout(() => setShaking(false), 500)
  }, [])

  useEffect(() => {
    return () => {
      if (shakeTimer.current) clearTimeout(shakeTimer.current)
    }
  }, [])

  if (!open) return null

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed', inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'white',
          borderRadius: 'var(--radius-xl)',
          width: '100%',
          maxWidth: width,
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: 'var(--shadow-lg)',
          animation: shaking ? 'modal-shake 0.5s ease' : 'none',
        }}
      >
        {title && (
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '20px 24px', borderBottom: '1px solid var(--gray-100)',
          }}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>{title}</h2>
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--gray-400)', lineHeight: 1 }}
            >×</button>
          </div>
        )}
        <div style={{ padding: 24 }}>{children}</div>
      </div>
    </div>
  )
}

export default Modal
