import React, { useState, useEffect } from 'react'
import { useAppSelector } from '../../store/hooks'
import { useShopStatus } from '../../App'
import { getDisputesByComplainant, getDisputesByTarget, seedUserDemoDisputesIfNeeded } from '../../utils/disputeStore'
import type { Dispute } from '../../types/dispute'
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_COLORS, DISPUTE_TARGET_LABELS } from '../../types/dispute'
import { formatDate, formatOrderId } from '../../utils/formatters'

type Tab = 'sent' | 'received'

// Trang "Khiếu nại của tôi" - dung chung cho user (nguoi mua) va shop, loc theo current_role
// 2 tab: Da gui (toi la nguoi khieu nai) va Bi khieu nai (toi la doi tuong bi khieu nai toi)
// Giao dien dang danh sach (table) giong style OrderManagement - bam vao dong de xem chi tiet trong modal
const MyDisputesPage: React.FC = () => {
  const { user } = useAppSelector(s => s.auth)
  const { isSuspended, suspendedReason } = useShopStatus()
  const role = user?.current_role
  const isShop = role === 'shop'
  const isShipper = role === 'shipper'
  // Shipper chi co the la BEN BI khieu nai (target) - mo hinh hien chua cho shipper tu gui khieu nai len san
  const complainantType: 'user' | 'shop' = isShop ? 'shop' : 'user'
  const targetType: 'user' | 'shop' | 'shipper' = isShop ? 'shop' : isShipper ? 'shipper' : 'user'

  const [tab, setTab] = useState<Tab>(isShipper ? 'received' : 'sent')
  const [selected, setSelected] = useState<Dispute | null>(null)
  const [sentDisputes, setSentDisputes] = useState<Dispute[]>([])
  const [receivedDisputes, setReceivedDisputes] = useState<Dispute[]>([])

  const reload = () => {
    if (!user) return
    setSentDisputes(isShipper ? [] : getDisputesByComplainant(complainantType, user.user_id))
    setReceivedDisputes(getDisputesByTarget(targetType, user.user_id))
  }

  useEffect(() => {
    if (!user) return
    seedUserDemoDisputesIfNeeded(user.user_id, user.full_name || 'Người dùng', role as 'user' | 'shop' | 'shipper')
    reload()
  }, [user?.user_id]) // eslint-disable-line react-hooks/exhaustive-deps

  const disputes = tab === 'sent' ? sentDisputes : receivedDisputes

  return (
    <div>
      {/* Banner thông báo đình chỉ — chỉ hiện với shop bị suspend */}
      {isSuspended && isShop && (
        <div style={{
          background: 'linear-gradient(135deg, #FEF2F2, #FFF5F5)',
          border: '1.5px solid #FECACA', borderRadius: 14,
          padding: '18px 20px', marginBottom: 20,
        }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg, #DC2626, #ef4444)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>⛔</div>
            <div style={{ flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: '#991B1B', marginBottom: 4 }}>
                Cửa hàng của bạn đang bị đình chỉ
              </p>
              {suspendedReason && (
                <p style={{ fontSize: 13, color: '#B91C1C', marginBottom: 8, lineHeight: 1.5 }}>
                  <strong>Lý do:</strong> {suspendedReason}
                </p>
              )}
              <p style={{ fontSize: 13, color: '#6B7280', marginBottom: 10, lineHeight: 1.6 }}>
                Nếu bạn cho rằng quyết định này không chính xác, bạn có thể gửi khiếu nại
                tới ban quản trị sàn bên dưới hoặc liên hệ hỗ trợ qua email.
              </p>
              <a href="mailto:support@buyzo.vn" style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: '#DC2626', color: 'white', borderRadius: 8,
                padding: '8px 16px', fontSize: 13, fontWeight: 700, textDecoration: 'none',
              }}>
                📧 Liên hệ hỗ trợ
              </a>
            </div>
          </div>
        </div>
      )}

      <p style={{ color: 'var(--text-secondary)', fontSize: 13.5, marginBottom: 16 }}>
        {isShipper
          ? 'Các khiếu nại mà khách hàng hoặc shop gửi liên quan tới quá trình giao hàng của bạn — sàn (admin) sẽ xem xét và xử lý.'
          : isShop
          ? 'Theo dõi các khiếu nại shop đã gửi tới sàn và các khiếu nại khách hàng/shipper gửi về shop của bạn.'
          : 'Danh sách các khiếu nại bạn đã gửi tới sàn — sàn (admin) sẽ xem xét và xử lý dựa trên nội dung, hình ảnh/video bằng chứng bạn cung cấp.'}
      </p>

      {!isShipper && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          <button onClick={() => setTab('sent')} className={`btn btn-sm ${tab === 'sent' ? 'btn-primary' : 'btn-outline'}`}>
            📤 Đã gửi ({sentDisputes.length})
          </button>
          <button onClick={() => setTab('received')} className={`btn btn-sm ${tab === 'received' ? 'btn-primary' : 'btn-outline'}`}>
            🚩 Bị khiếu nại ({receivedDisputes.length})
          </button>
        </div>
      )}

      {disputes.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗂️</div>
          <p>{tab === 'sent' ? 'Bạn chưa gửi khiếu nại nào' : 'Chưa có khiếu nại nào nhắm tới bạn'}</p>
        </div>
      ) : (
        <div className="card table-wrapper">
          <table>
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>{tab === 'sent' ? 'Đối tượng bị khiếu nại' : 'Người gửi khiếu nại'}</th>
                <th>Lý do</th>
                <th>Trạng thái</th>
                <th>Ngày gửi</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {disputes.map(d => (
                <tr key={d.dispute_id} onClick={() => setSelected(d)} style={{ cursor: 'pointer' }}>
                  <td style={{ fontWeight: 600 }}>{formatOrderId(d.order_id)}</td>
                  <td style={{ fontSize: 13 }}>
                    {tab === 'sent'
                      ? <>{DISPUTE_TARGET_LABELS[d.target_type]} — {d.target_name}</>
                      : <>{d.complainant_type === 'shop' ? 'Shop' : 'Người mua'} — {d.complainant_name}</>}
                  </td>
                  <td style={{ fontSize: 13 }}>{d.reason_label}</td>
                  <td>
                    <span style={{
                      display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600,
                      background: DISPUTE_STATUS_COLORS[d.status] + '20', color: DISPUTE_STATUS_COLORS[d.status],
                    }}>
                      {DISPUTE_STATUS_LABELS[d.status]}
                    </span>
                  </td>
                  <td style={{ fontSize: 13 }}>{formatDate(d.created_at)}</td>
                  <td>
                    <button onClick={e => { e.stopPropagation(); setSelected(d) }} className="btn btn-outline btn-sm">Xem chi tiết</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={() => setSelected(null)}>
          <div className="card" style={{ width: '90vw', maxWidth: 780, maxHeight: '90vh', overflowY: 'auto', padding: '32px 36px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
              <div>
                <h2 style={{ fontSize: 17, fontWeight: 800 }}>{formatOrderId(selected.order_id)}</h2>
                <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginTop: 2 }}>
                  {tab === 'sent'
                    ? <>Khiếu nại {DISPUTE_TARGET_LABELS[selected.target_type]} — {selected.target_name}</>
                    : <>Bị khiếu nại bởi {selected.complainant_type === 'shop' ? 'Shop' : 'Người mua'} — {selected.complainant_name}</>}
                </p>
              </div>
              <button onClick={() => setSelected(null)} style={{ border: 'none', background: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--gray-500)' }}>✕</button>
            </div>

            <span style={{
              display: 'inline-block', padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: 12, fontWeight: 600, marginBottom: 14,
              background: DISPUTE_STATUS_COLORS[selected.status] + '20', color: DISPUTE_STATUS_COLORS[selected.status],
            }}>
              {DISPUTE_STATUS_LABELS[selected.status]}
            </span>

            <p style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>📌 {selected.reason_label}</p>
            <p style={{ fontSize: 13.5, color: 'var(--gray-700)', marginBottom: 12, whiteSpace: 'pre-wrap' }}>{selected.content}</p>

            {selected.evidence.images.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--gray-500)', marginBottom: 6 }}>HÌNH ẢNH BẰNG CHỨNG</p>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {selected.evidence.images.map((img, i) => (
                    <img key={i} src={img} alt="" style={{ width: 220, height: 220, objectFit: 'cover', borderRadius: 10, border: '1px solid var(--gray-200)', cursor: 'pointer' }} onClick={() => window.open(img, '_blank')} />
                  ))}
                </div>
              </div>
            )}
            {selected.evidence.videoName && (
              <p style={{ fontSize: 12.5, color: 'var(--gray-500)', marginBottom: 12 }}>🎬 Video bằng chứng: {selected.evidence.videoName}</p>
            )}

            {selected.resolution_note && (
              <div style={{ background: 'var(--gray-50, #f8fafc)', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--gray-700)', marginBottom: 12 }}>
                <strong>Kết luận từ sàn:</strong> {selected.resolution_note}
              </div>
            )}

            <p style={{ fontSize: 12, color: 'var(--gray-400)' }}>Gửi lúc {formatDate(selected.created_at)}</p>
          </div>
        </div>
      )}
    </div>
  )
}

export default MyDisputesPage
