import React, { useRef, useState } from 'react'
import { toast } from 'react-toastify'
import StarRatingInput from './StarRatingInput'
import { getReview, saveReview } from '../../utils/reviewStore'
import { formatDate } from '../../utils/formatters'

// so xu thuong khi danh gia san pham — chi hien thi de khuyen khich, khong tru/cong xu thuc
const REVIEW_REWARD_XU = 200
const XU_PER_IMAGE = 50
const MAX_IMAGES = 6

interface Props {
  orderItemId: number
  productName?: string
}

const ItemReviewBox: React.FC<Props> = ({ orderItemId, productName }) => {
  const existing = getReview(orderItemId)
  const [editing, setEditing] = useState(!existing)
  const [rating, setRating] = useState(existing?.rating || 5)
  const [comment, setComment] = useState(existing?.comment || '')
  const [images, setImages] = useState<string[]>(existing?.images || [])
  const [isAnonymous, setIsAnonymous] = useState(!!existing?.isAnonymous)
  const [saved, setSaved] = useState(existing)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = () => {
    if (!rating) { toast.warning('Vui lòng chọn số sao đánh giá'); return }
    const review = { orderItemId, rating, comment, images, isAnonymous, createdAt: new Date().toISOString() }
    saveReview(review)
    setSaved(review)
    setEditing(false)
    toast.success('Cảm ơn bạn đã đánh giá!')
  }

  const handlePickImages = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const remaining = MAX_IMAGES - images.length
    if (remaining <= 0) {
      toast.warning(`Chỉ được đăng tối đa ${MAX_IMAGES} ảnh`)
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }
    const toRead = files.slice(0, remaining)
    if (files.length > remaining) {
      toast.warning(`Chỉ được đăng tối đa ${MAX_IMAGES} ảnh, đã bỏ qua ${files.length - remaining} ảnh dư`)
    }
    toRead.forEach(file => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setImages(prev => prev.length >= MAX_IMAGES ? prev : [...prev, reader.result as string])
        }
      }
      reader.readAsDataURL(file)
    })
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeImage = (idx: number) => {
    setImages(prev => prev.filter((_, i) => i !== idx))
  }

  if (!editing && saved) {
    return (
      <div style={{ marginTop: 10, padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        {saved.images && saved.images.length > 0 && (
          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            {saved.images.map((src, i) => (
              <img key={i} src={src} alt="" style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)' }} />
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ marginTop: 10, padding: 12, background: 'var(--gray-50)', borderRadius: 'var(--radius)', border: '1px dashed var(--gray-200)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <p style={{ fontSize: 13, fontWeight: 600 }}>
          ⭐ Đánh giá {productName ? `"${productName}"` : 'sản phẩm'}
        </p>
        {!saved && (
          <span style={{
            fontSize: 11.5, fontWeight: 700, color: '#b45309', background: '#fffbeb',
            border: '1px solid #fde68a', borderRadius: 'var(--radius-full)', padding: '3px 10px',
          }}>
            🪙 +{REVIEW_REWARD_XU} xu
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
        placeholder="Chia sẻ cảm nhận của bạn về sản phẩm..."
        rows={2}
        style={{ width: '100%', marginTop: 10, padding: 8, border: '1px solid var(--gray-200)', borderRadius: 'var(--radius)', fontSize: 13, resize: 'vertical', fontFamily: 'inherit' }}
      />

      {/* Dang hinh */}
      <div style={{ marginTop: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <p style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--gray-600)' }}>
            📷 Đăng hình ảnh ({images.length}/{MAX_IMAGES})
          </p>
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#b45309', background: '#fffbeb',
            border: '1px solid #fde68a', borderRadius: 'var(--radius-full)', padding: '2px 8px',
          }}>
            🪙 +{XU_PER_IMAGE} xu/ảnh
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {images.map((src, i) => (
            <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
              <img src={src} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 'var(--radius)', border: '1px solid var(--gray-200)' }} />
              <button
                type="button"
                onClick={() => removeImage(i)}
                style={{
                  position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%',
                  background: 'var(--gray-900)', color: 'white', border: 'none', cursor: 'pointer',
                  fontSize: 12, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                ✕
              </button>
            </div>
          ))}
          {images.length < MAX_IMAGES && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 64, height: 64, borderRadius: 'var(--radius)', border: '1px dashed var(--gray-300)',
                background: 'white', color: 'var(--gray-400)', cursor: 'pointer', fontSize: 22,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              +
            </button>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handlePickImages}
          style={{ display: 'none' }}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 12 }}>
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

export default ItemReviewBox
