import React from 'react'

interface LoadingProps { fullPage?: boolean; size?: 'sm' | 'md' | 'lg' }

const Loading: React.FC<LoadingProps> = ({ fullPage, size = 'md' }) => {
  const sizes = { sm: 24, md: 40, lg: 60 }
  const px = sizes[size]

  const spinner = (
    <div style={{
      width: px, height: px,
      border: `${px / 8}px solid var(--gray-200)`,
      borderTop: `${px / 8}px solid var(--primary)`,
      borderRadius: '50%',
      animation: 'spin 0.7s linear infinite',
    }} />
  )

  if (fullPage) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(255,255,255,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9999 }}>
        {spinner}
      </div>
    )
  }
  return <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>{spinner}</div>
}

export default Loading
