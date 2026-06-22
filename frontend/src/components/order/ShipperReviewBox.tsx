import React, { useState } from 'react'
import { toast } from 'react-toastify'
import StarRatingInput from './StarRatingInput'
import { getShipperReview, saveShipperReview } from '../../utils/shipperReviewStore'
import { formatDate } from '../../utils/formatters'

// chi hien thi de khuyen khich, khong tru/cong xu thuc
const SHIPPER_REVIEW_REWARD_XU = 100

interface Props {
  orderId: number
  shipperId?: number
  shipperName?: string
}

const ShipperReviewBox: React.FC<Props> = ({ orderId, shipperId, shipperName }) => {
  const existing = getShipperReview(orderId)
  const [editing, setEditing] = useState(!existing)
  const [rating, setRating] = useState(existing?.rating || 5)
  const [comment, setComment] = useState(existing?.comment || '')
  const [isAnonymous, setIsAnonymous] = useState(!!existing?.isAnonymous)
  const [saved, setSaved] = useState(existing)

  const handleSubmit = () => {
    if (!rating) { toast.warning('Vui lòng chọn số sao đánh giá'); return }
    const review = { orderId, shipperId, rating, comment, isAnonymous, createdAt: new Date().toISOString() }
    saveShipperReview(review)
    setSaved(review)
    setEditing(false)
    toast.success('Cảm ơn bạn đã đánh giá người giao hàng!')
  }

  const displayName = shipperName || (shipperId ? `Shipper #${shipperId}` : 'Người giao hàng')

  if (!editing && saved) {
    return (
      <div style={{ marginTop: 14, padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <StarRatingInput value={saved.rating} onChange={() => {}} readOnly size={16} />
            <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{formatDate(saved.createdAt)}</span>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', background: 'var(--gray-100)', borderRadius: 'var(--radius-full)', padding: '2px 8px' }}>
              {saved.isAnonymous ? '🙈 Ẩn danh' : '🙂 Công khai'}
            </span>
          </div>
          <button onClick={() => setEditing(true)} style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>
            Sửa đánh giá
          </button>
        </div>
        {saved.comment && <p style={{ fontSize: 13, color: 'var(--gray-600)', marginTop: 6 }}>{saved.comment}</p>}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 14, padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px dashed var(--gray-200)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, fontWeight: 600 }}>
          🛵 Đánh giá {displayName}
        </p>
        {!saved && (
          <span style={{
            fontSize: 11.5, fontWeight: 700, color: '#b45309', background: '#fffbeb',
            border: '1px solid #fde68a', borderRadius: 'var(--radius-full)', padding: '3px 10px',
          }}>
            🪙 +{SHIPPER_REVIEW_REWARD_XU} xu
          </span>
        )}
      </div>

      <StarRatingInput value={rating} onChange={setRating} />

      {/* Cong khai / An danh */}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button
          type="button"
          onClick={() => setIsAnonymous(false)}
          style={{
            flex: 1, padding: '8px 10px', fontSize: 12.5, fontWeight: 600, borderRadius: 'var(--radius)', cursor: 'pointer',
            border: !isAnonymous ? '1.5px solid var(--primary)' : '1px solid var(--gray-200)',
            background: !isAnonymous ? '#fff1f0' : 'white',
            color: !isAnonymous ? 'var(--primary)' : 'var(--gray-600)',
          }}
        >
          🙂 Công khai
        </button>
        <button
          type="button"
          onClick={() => setIsAnonymous(true)}
          style={{
            flex: 1, padding: '8px 10px', fontSize: 12.5, fontWeight: 600, borderRadius: 'var(--radius)', cursor: 'pointer',
            border: isAnonymous ? '1.5px solid var(--primary)' : '1px solid var(--gray-200)',
            background: isAnonymous ? '#fff1f0' : 'white',
            color: isAnonymous ? 'var(--primary)' : 'var(--gray-600)',
          }}
        >
          🙈 Ẩn danh
        </button>
      </div>
      <p style={{ fontSize: 11, color: 'var(--gray-400)', marginTop: 4 }}>
        {isAnonymous ? 'Tên của bạn sẽ được ẩn khi hiển thị đánh giá này.' : 'Đánh giá sẽ hiển thị công khai kèm tên của bạn.'}
      </p>

      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Người giao hàng có thân thiện, đúng giờ không?..."
        rows={2}
        style={{ width: '100%', marginTop: 10, padding: 8, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
      />

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        {saved && (
          <button onClick={() => setEditing(false)} style={{ padding: '6px 14px', fontSize: 13, background: 'none', border: '1px solid var(--gray-300)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
            Hủy
          </button>
        )}
        <button onClick={handleSubmit} className="btn btn-primary btn-sm">Gửi đánh giá</button>
      </div>
    </div>
  )
}

export default ShipperReviewBox
