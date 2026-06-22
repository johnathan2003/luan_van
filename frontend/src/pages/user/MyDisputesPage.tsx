import React, { useState } from 'react'
import { useAppSelector } from '../../store/hooks'
import { getAllDisputes, getDisputesByComplainant, getDisputesByTarget } from '../../utils/disputeStore'
import type { Dispute } from '../../types/dispute'
import { DISPUTE_STATUS_LABELS, DISPUTE_STATUS_COLORS, DISPUTE_TARGET_LABELS } from '../../types/dispute'
import { formatDate, formatOrderId } from '../../utils/formatters'

type Tab = 'sent' | 'received'

// Trang "Khieu nai cua toi" - dung chung cho user (nguoi mua) va shop, loc theo current_role
// 2 tab: Da gui (toi la nguoi khieu nai) va Bi khieu nai (toi la doi tuong bi khieu nai toi)
// Giao dien dang danh sach (table) giong style OrderManagement - bam vao dong de xem chi tiet trong modal
const MyDisputesPage: React.FC = () => {
  const { user } = useAppSelector(s => s.auth)
  const role = user?.current_role
  const isShop = role === 'shop'
  const isShipper = role === 'shipper'
  // Shipper chi co the la BEN BI khieu nai (target) - mo hinh hien chua cho shipper tu gui khieu nai len san
  const complainantType: 'user' | 'shop' = isShop ? 'shop' : 'user'
  const targetType: 'user' | 'shop' | 'shipper' = isShop ? 'shop' : isShipper ? 'shipper' : 'user'

  const [tab, setTab] = useState<Tab>(isShipper ? 'received' : 'sent')
  const [selected, setSelected] = useState<Dispute | null>(null)

  // Khieu nai THUC cua tai khoan dang dang nhap (khop dung user_id)
  const sentDisputesReal = (user && !isShipper) ? getDisputesByComplainant(complainantType, user.user_id) : []
  const receivedDisputesReal = user ? getDisputesByTarget(targetType, user.user_id) : []

  // Neu tai khoan chua co khieu nai thuc nao (vi du tai khoan seed khong khop id voi du lieu demo),
  // tam hien thi du lieu demo theo dung chieu/vai tro de xem giao dien, kem canh bao ro rang.
  const sentDemo = isShipper ? [] : getAllDisputes().filter(d => d.complainant_type === complainantType)
  const receivedDemo = getAllDisputes().filter(d => d.target_type === targetType)

  const showDemoSent = sentDisputesReal.length === 0 && sentDemo.length > 0
  const showDemoReceived = receivedDisputesReal.length === 0 && receivedDemo.length > 0

  const sentDisputes = showDemoSent ? sentDemo : sentDisputesReal
  const receivedDisputes = showDemoReceived ? receivedDemo : receivedDisputesReal
  const disputes = tab === 'sent' ? sentDisputes : receivedDisputes
  const showingDemo = tab === 'sent' ? showDemoSent : showDemoReceived

  return (
    <div>
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

      {showingDemo && (
        <div style={{ background: 'var(--bg-highlight, #fff7ed)', border: '1px solid #fed7aa', borderRadius: 'var(--radius)', padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#b45309' }}>
          ⚠️ Tài khoản của bạn chưa có khiếu nại thực — đang hiển thị <strong>dữ liệu demo</strong> để xem thử giao diện.
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
          <div className="card" style={{ width: 520, maxHeight: '90vh', overflowY: 'auto', padding: 26 }} onClick={e => e.stopPropagation()}>
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
                    <img key={i} src={img} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--gray-200)' }} />
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
