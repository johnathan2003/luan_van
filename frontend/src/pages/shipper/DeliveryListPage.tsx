import React, { useEffect, useState } from 'react'
import { toast } from 'react-toastify'
import DeliveryList from '../../components/shipper/DeliveryList'
import Loading from '../../components/common/Loading'
import { shipmentService } from '../../services/shipmentService'

const DeliveryListPage: React.FC = () => {
  const [deliveries, setDeliveries] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try { const r = await shipmentService.getMyDeliveries(); setDeliveries(r.data.deliveries) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [])

  const handlePickup = async (id: number) => {
    try { await shipmentService.pickup(id); toast.success('Đã xác nhận lấy hàng'); load() }
    catch { toast.error('Lỗi') }
  }

  const handleDeliver = async (id: number) => {
    try { await shipmentService.delivered(id); toast.success('Đã xác nhận giao hàng thành công!'); load() }
    catch { toast.error('Lỗi') }
  }

  return (
    <div>
      <h2 style={{ fontWeight: 700, fontSize: 20, marginBottom: 24 }}>Đơn giao hàng ({deliveries.length})</h2>
      {loading ? <Loading /> : <DeliveryList deliveries={deliveries} onPickup={handlePickup} onDeliver={handleDeliver} />}
    </div>
  )
}

export default DeliveryListPage
