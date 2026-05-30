import React, { useEffect, useState } from 'react'
import AnalyticsWidget from '../../components/shop/Analytics'
import Loading from '../../components/common/Loading'
import { shopService } from '../../services/shopService'
import type { Analytics } from '../../types/shop'

const AnalyticsPage: React.FC = () => {
  const [data, setData] = useState<Analytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)

  const load = async () => {
    setLoading(true)
    try { const res = await shopService.getAnalytics(days); setData(res.data) }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [days])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h2 style={{ fontWeight: 700, fontSize: 20 }}>Thống kê</h2>
        <select className="input" value={days} onChange={e => setDays(Number(e.target.value))} style={{ width: 'auto' }}>
          <option value={7}>7 ngày qua</option>
          <option value={30}>30 ngày qua</option>
          <option value={90}>90 ngày qua</option>
        </select>
      </div>
      {loading ? <Loading /> : data ? <AnalyticsWidget data={data} /> : null}
    </div>
  )
}

export default AnalyticsPage
