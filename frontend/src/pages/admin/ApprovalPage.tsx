import React, { useEffect, useState } from 'react'
import { adminService } from '../../services/adminService'
import ApprovalList from '../../components/admin/ApprovalList'
import Header from '../../components/common/Header'
import Loading from '../../components/common/Loading'

const ApprovalPage: React.FC = () => {
  const [tab, setTab] = useState<'shop' | 'shipper' | 'product'>('shop')
  const [items, setItems] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      if (tab === 'shop') { const r = await adminService.getShopRegistrations(); setItems(r.data.registrations) }
      else if (tab === 'shipper') { const r = await adminService.getShipperRegistrations(); setItems(r.data.registrations) }
      else { const r = await adminService.getPendingProducts(); setItems(r.data.products) }
    } finally { setLoading(false) }
  }

  useEffect(() => { load() }, [tab])

  const approve = async (id: number) => {
    if (tab === 'shop') await adminService.approveShop(id)
    else if (tab === 'shipper') await adminService.approveShipper(id)
    else await adminService.approveProduct(id)
  }

  const reject = async (id: number, reason: string) => {
    if (tab === 'shop') await adminService.rejectShop(id, reason)
    else if (tab === 'shipper') await adminService.rejectShipper(id, reason)
    else await adminService.rejectProduct(id, reason)
  }

  const mapItems = () => {
    if (tab === 'shop') return items.map(i => ({ id: i.reg_id, title: i.shop_name, subtitle: `User ID: ${i.user_id}`, date: i.created_at, status: i.status }))
    if (tab === 'shipper') return items.map(i => ({ id: i.reg_id, title: `Shipper #${i.user_id}`, subtitle: i.vehicle_type, date: i.created_at, status: i.status }))
    return items.map(i => ({ id: i.product_id, title: i.product_name, subtitle: `Shop ID: ${i.shop_id}`, status: i.status }))
  }

  return (
    <div>
      <Header title="Phê duyệt" subtitle="Xem xét và phê duyệt các yêu cầu đang chờ" />
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--gray-200)', marginBottom: 24 }}>
        {([['shop', '🏪 Đăng ký shop'], ['shipper', '🚚 Đăng ký shipper'], ['product', '🏷️ Sản phẩm chờ duyệt']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding: '10px 18px', background: 'none', border: 'none', cursor: 'pointer', fontWeight: tab === key ? 700 : 400, color: tab === key ? 'var(--primary)' : 'var(--gray-600)', borderBottom: tab === key ? '2px solid var(--primary)' : '2px solid transparent', marginBottom: -2, fontSize: 14 }}>
            {label}
          </button>
        ))}
      </div>
      {loading ? <Loading /> : <ApprovalList items={mapItems()} onApprove={approve} onReject={reject} onRefresh={load} emptyMsg="Không có yêu cầu nào đang chờ" />}
    </div>
  )
}

export default ApprovalPage
