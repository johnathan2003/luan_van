/**
 * 🎫 Trung tâm voucher — chia 3 loại:
 *  - Voucher sàn (do admin phát hành, áp dụng toàn nền tảng)
 *  - Voucher cửa hàng (do shop phát hành, áp dụng riêng shop đó)
 *  - Voucher của tôi (đã thu thập / lưu vào ví)
 * Mỗi role đăng nhập đều xem được, nhưng nội dung ví ("của tôi") là riêng theo từng user.
 */
import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import Loading from '../components/common/Loading'
import { voucherService } from '../services/voucherService'
import { formatDateOnly } from '../utils/formatters'
import SuggestedDealsSection from '../components/common/SuggestedDealsSection'

type TabKey = 'platform' | 'shop' | 'mine'

interface VoucherItem {
  voucher_id: number
  code: string
  discount_type: string
  discount_value: string
  min_order_value: string | null
  max_discount: string | null
  max_uses: number | null
  current_uses: number
  status: string
  valid_from: string | null
  valid_to: string | null
  source: 'platform' | 'shop'
  shop_name: string | null
  is_collected: boolean
}

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'platform', label: 'Voucher sàn', icon: '🏛️' },
  { key: 'shop', label: 'Voucher cửa hàng', icon: '🏪' },
  { key: 'mine', label: 'Voucher của tôi', icon: '🎫' },
]

const discountLabel = (v: VoucherItem) =>
  v.discount_type === 'percentage' ? `Giảm ${v.discount_value}%` : `Giảm ${Number(v.discount_value).toLocaleString('vi-VN')}₫`

const VoucherCard: React.FC<{ v: VoucherItem; onCollect: (id: number) => void; collecting: boolean }> = ({ v, onCollect, collecting }) => {
  const remaining = v.max_uses != null ? Math.max(v.max_uses - v.current_uses, 0) : null
  const soldOut = remaining !== null && remaining <= 0

  return (
    <div className="card" style={{
      display: 'flex', alignItems: 'stretch', overflow: 'hidden', borderRadius: 12,
      border: '1px solid var(--gray-200)',
    }}>
      <div style={{
        width: 90, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: v.source === 'platform' ? 'linear-gradient(135deg,#ff7a45,#ff4d4f)' : 'linear-gradient(135deg,#4096ff,#1677ff)',
        color: '#fff', fontWeight: 800, fontSize: 18, textAlign: 'center', padding: 8,
      }}>
        {v.discount_type === 'percentage' ? `${v.discount_value}%` : `${Number(v.discount_value) >= 1000 ? Math.round(Number(v.discount_value) / 1000) + 'K' : v.discount_value}`}
      </div>
      <div style={{ flex: 1, padding: '12px 16px', minWidth: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
          <div>
            <p style={{ fontWeight: 700, fontSize: 14 }}>{discountLabel(v)}</p>
            <p style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
              {v.source === 'platform' ? 'Voucher sàn BuyZo' : `Shop: ${v.shop_name || '—'}`}
            </p>
          </div>
          <code style={{ background: 'var(--gray-100)', padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{v.code}</code>
        </div>
        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {v.min_order_value && <span>Đơn tối thiểu {Number(v.min_order_value).toLocaleString('vi-VN')}₫</span>}
          {v.valid_to && <span>HSD: {formatDateOnly(v.valid_to)}</span>}
          {remaining !== null && <span>Còn {remaining} lượt</span>}
        </div>
        {!v.is_collected && (
          <div style={{ marginTop: 10 }}>
            <button
              className="btn btn-primary btn-sm"
              disabled={soldOut || collecting}
              onClick={() => onCollect(v.voucher_id)}
            >
              {soldOut ? 'Đã hết lượt' : collecting ? 'Đang lưu...' : '+ Thu thập'}
            </button>
          </div>
        )}
        {v.is_collected && (
          <p style={{ marginTop: 10, fontSize: 12, fontWeight: 600, color: 'var(--success)' }}>✓ Đã thu thập</p>
        )}
      </div>
    </div>
  )
}

const VoucherCenterPage: React.FC = () => {
  const [tab, setTab] = useState<TabKey>('platform')
  const [data, setData] = useState<Record<TabKey, VoucherItem[]>>({ platform: [], shop: [], mine: [] })
  const [loading, setLoading] = useState(true)
  const [collectingId, setCollectingId] = useState<number | null>(null)

  const loadAll = async () => {
    setLoading(true)
    try {
      const [p, s, m] = await Promise.all([
        voucherService.getPlatformVouchers(),
        voucherService.getShopVouchers(),
        voucherService.getMyVouchers(),
      ])
      setData({
        platform: p.data.vouchers || [],
        shop: s.data.vouchers || [],
        mine: m.data.vouchers || [],
      })
    } catch {
      toast.error('Không tải được danh sách voucher')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadAll() }, [])

  const handleCollect = async (voucherId: number) => {
    setCollectingId(voucherId)
    try {
      await voucherService.collectVoucher(voucherId)
      toast.success('Đã thu thập voucher!')
      await loadAll()
    } catch (err: any) {
      toast.error(err.response?.data?.detail || 'Không thể thu thập voucher')
    } finally {
      setCollectingId(null)
    }
  }

  const list = data[tab]

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 16 }}>🎫 Trung tâm voucher</h1>

      <div style={{ display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid var(--gray-200)' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: '10px 16px', fontSize: 14, fontWeight: 600, border: 'none', background: 'transparent',
              cursor: 'pointer', borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
              color: tab === t.key ? 'var(--primary)' : 'var(--gray-500)',
            }}
          >
            {t.icon} {t.label} {data[t.key].length > 0 && `(${data[t.key].length})`}
          </button>
        ))}
      </div>

      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--gray-400)' }}>
          {tab === 'mine' ? 'Bạn chưa thu thập voucher nào' : 'Hiện chưa có voucher nào'}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {list.map(v => (
            <VoucherCard key={v.voucher_id} v={v} onCollect={handleCollect} collecting={collectingId === v.voucher_id} />
          ))}
        </div>
      )}

      <SuggestedDealsSection />
    </div>
  )
}

export default VoucherCenterPage
