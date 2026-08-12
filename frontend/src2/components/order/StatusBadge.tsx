import React from 'react'
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../utils/constants'

interface Props { status: string }

const StatusBadge: React.FC<Props> = ({ status }) => {
  const color = ORDER_STATUS_COLORS[status] || '#6b7280'
  const bg = color + '20'
  return (
    <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, background: bg, color }}>
      {ORDER_STATUS_LABELS[status] || status}
    </span>
  )
}

export default StatusBadge
