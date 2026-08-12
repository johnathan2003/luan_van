import React, { useState } from 'react'

interface Props {
  value: number
  onChange: (v: number) => void
  size?: number
  readOnly?: boolean
}

const StarRatingInput: React.FC<Props> = ({ value, onChange, size = 26, readOnly = false }) => {
  const [hover, setHover] = useState<number | null>(null)
  const display = hover ?? value

  return (
    <div style={{ display: 'inline-flex', gap: 4 }}>
      {[1, 2, 3, 4, 5].map(n => (
        <span
          key={n}
          onClick={readOnly ? undefined : () => onChange(n)}
          onMouseEnter={readOnly ? undefined : () => setHover(n)}
          onMouseLeave={readOnly ? undefined : () => setHover(null)}
          style={{
            fontSize: size,
            cursor: readOnly ? 'default' : 'pointer',
            color: n <= display ? '#fbbf24' : '#d1d5db',
            transition: 'color 0.15s, transform 0.1s',
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  )
}

export default StarRatingInput
