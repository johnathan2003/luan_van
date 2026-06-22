import React, { useState } from 'react'
import { toast } from 'react-toastify'
import type { DisputeComplainantType, DisputeTargetType } from '../../types/dispute'
import { DISPUTE_REASONS, DISPUTE_TARGET_LABELS } from '../../types/dispute'
import { createDispute, hasOpenDispute } from '../../utils/disputeStore'
import { formatOrderId } from '../../utils/formatters'

export interface DisputeTargetOption {
  type: DisputeTargetType
  id?: number
  name: string
}

interface Props {
  open: boolean
  onClose: () => void
  orderId: number
  orderCode?: string
  complainantType: DisputeComplainantType
  complainantId: number
  complainantName: string
  targetOptions: DisputeTargetOption[] // cac doi tuong co the khieu nai cho don hang nay
  onSubmitted?: () => void
}

const MAX_IMAGES = 5

const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

const DisputeFormModal: React.FC<Props> = ({
  open, onClose, orderId, orderCode, complainantType, complainantId, complainantName, targetOptions, onSubmitted,
}) => {
  const [targetType, setTargetType] = useState<DisputeTargetType>(targetOptions[0]?.type || 'shop')
  const [reasonCode, setReasonCode] = useState('')
  const [content, setContent] = useState('')
  const [images, setImages] = useState<string[]>([])
  const [videoName, setVideoName] = useState<string | undefined>()
  const [videoPreviewUrl, setVideoPreviewUrl] = useState<string | undefined>()
  const [submitting, setSubmitting] = useState(false)

  if (!open) return null

  const target = targetOptions.find(t => t.type === targetType) || targetOptions[0]
  const reasonKey = `${complainantType}->${targetType}`
  const reasonOptions = DISPUTE_REASONS[reasonKey] || []

  const reset = () => {
    setReasonCode('')
    setContent('')
    setImages([])
    setVideoName(undefined)
    setVideoPreviewUrl(undefined)
  }

  const handleClose = () => { reset(); onClose() }

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    if (images.length + files.length > MAX_IMAGES) {
      toast.warn(`Tối đa ${MAX_IMAGES} ảnh bằng chứng`)
      return
    }
    const urls = await Promise.all(files.map(fileToDataUrl))
    setImages(prev => [...prev, ...urls])
    e.target.value = ''
  }

  const handleVideoPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setVideoName(file.name)
    // Chi tao preview tam thoi de xem truoc - KHONG luu noi dung video vao localStorage
    setVideoPreviewUrl(URL.createObjectURL(file))
    e.target.value = ''
  }

  const handleSubmit = async () => {
    if (!target) { toast.error('Vui lòng chọn đối tượng khiếu nại'); return }
    if (!reasonCode) { toast.error('Vui lòng chọn lý do khiếu nại'); return }
    if (!content.trim()) { toast.error('Vui lòng nhập nội dung mô tả chi tiết'); return }

    if (hasOpenDispute(orderId, complainantType, complainantId)) {
      toast.warn('Đơn hàng này đã có khiếu nại đang chờ xử lý')
      return
    }

    setSubmitting(true)
    try {
      const reasonLabel = reasonOptions.find(r => r.code === reasonCode)?.label || reasonCode
      createDispute({
        order_id: orderId,
        order_code: orderCode,
        complainant_type: complainantType,
        complainant_id: complainantId,
        complainant_name: complainantName,
        target_type: target.type,
        target_id: target.id,
        target_name: target.name,
        reason_code: reasonCode,
        reason_label: reasonLabel,
        content: content.trim(),
        images,
        videoName,
      })
      toast.success('Đã gửi khiếu nại tới sàn. Vui lòng chờ admin xử lý.')
      onSubmitted?.()
      handleClose()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={handleClose}>
      <div className="card" style={{ width: '100%', maxWidth: 560, maxHeight: '90vh', overflowY: 'auto', padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ fontWeight: 700, fontSize: 18 }}>⚠️ Gửi khiếu nại đơn hàng {formatOrderId(orderId)}</h3>
          <button onClick={handleClose} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-500)' }}>✕</button>
        </div>

        {targetOptions.length > 1 && (
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Khiếu nại đối tượng nào?</label>
            <div style={{ display: 'flex', gap: 8 }}>
              {targetOptions.map(t => (
                <button
                  key={t.type}
                  onClick={() => { setTargetType(t.type); setReasonCode('') }}
                  style={{
                    flex: 1, padding: '8px 10px', borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: 'pointer',
                    border: `1.5px solid ${targetType === t.type ? 'var(--primary)' : 'var(--gray-200)'}`,
                    background: targetType === t.type ? 'var(--primary)' : 'white',
                    color: targetType === t.type ? 'white' : 'var(--gray-700)',
                  }}
                >
                  {DISPUTE_TARGET_LABELS[t.type]}: {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Lý do khiếu nại</label>
          <select value={reasonCode} onChange={e => setReasonCode(e.target.value)} className="input" style={{ width: '100%', padding: 9, borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 14 }}>
            <option value="">-- Chọn lý do --</option>
            {reasonOptions.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>Nội dung chi tiết</label>
          <textarea
            value={content}
            onChange={e => setContent(e.target.value)}
            rows={4}
            placeholder="Mô tả chi tiết sự việc để admin có cơ sở xử lý..."
            style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid var(--gray-200)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
            Ảnh bằng chứng <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(tối đa {MAX_IMAGES})</span>
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {images.map((img, i) => (
              <div key={i} style={{ position: 'relative', width: 64, height: 64 }}>
                <img src={img} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }} />
                <button
                  onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                  style={{ position: 'absolute', top: -6, right: -6, width: 20, height: 20, borderRadius: '50%', background: '#ef4444', color: 'white', border: 'none', fontSize: 11, cursor: 'pointer', lineHeight: 1 }}
                >✕</button>
              </div>
            ))}
            {images.length < MAX_IMAGES && (
              <label style={{ width: 64, height: 64, border: '1.5px dashed var(--gray-300)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'var(--gray-400)', fontSize: 22 }}>
                +
                <input type="file" accept="image/*" multiple onChange={handleImagePick} style={{ display: 'none' }} />
              </label>
            )}
          </div>
        </div>

        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, display: 'block' }}>
            Video bằng chứng <span style={{ color: 'var(--gray-400)', fontWeight: 400 }}>(chỉ xem trước, không lưu)</span>
          </label>
          {videoPreviewUrl ? (
            <div>
              <video src={videoPreviewUrl} controls style={{ width: '100%', maxHeight: 180, borderRadius: 8, background: '#000' }} />
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                <span style={{ fontSize: 12.5, color: 'var(--gray-500)' }}>📎 {videoName}</span>
                <button onClick={() => { setVideoName(undefined); setVideoPreviewUrl(undefined) }} style={{ fontSize: 12.5, color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer' }}>Xóa</button>
              </div>
            </div>
          ) : (
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', border: '1.5px dashed var(--gray-300)', borderRadius: 8, cursor: 'pointer', color: 'var(--gray-500)', fontSize: 13 }}>
              🎬 Chọn video từ máy
              <input type="file" accept="video/*" onChange={handleVideoPick} style={{ display: 'none' }} />
            </label>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={handleClose} className="btn btn-outline">Hủy</button>
          <button onClick={handleSubmit} disabled={submitting} className="btn btn-primary">
            {submitting ? 'Đang gửi...' : 'Gửi khiếu nại'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DisputeFormModal
