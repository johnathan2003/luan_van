import React, { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { shipmentService } from '../../services/shipmentService'
import { toast } from 'react-toastify'
import Loading from '../../components/common/Loading'

const TrackingPage: React.FC = () => {
  const { shipmentId } = useParams<{ shipmentId: string }>()
  const [shipment, setShipment] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tracking, setTracking] = useState(false)
  const intervalRef = useRef<any>(null)

  const loadShipment = async () => {
    try { const r = await shipmentService.getShipment(Number(shipmentId)); setShipment(r.data) }
    catch { toast.error('Không tìm thấy shipment') }
    finally { setLoading(false) }
  }

  useEffect(() => { loadShipment() }, [shipmentId])

  const startTracking = () => {
    setTracking(true)
    intervalRef.current = setInterval(() => {
      if (!navigator.geolocation) return
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            await shipmentService.updateLocation(Number(shipmentId), pos.coords.latitude, pos.coords.longitude)
          } catch {}
        },
        () => {}
      )
    }, 10000)
    toast.info('Bắt đầu cập nhật vị trí')
  }

  const stopTracking = () => {
    clearInterval(intervalRef.current)
    setTracking(false)
    toast.info('Đã dừng cập nhật vị trí')
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  if (loading) return (<Loading />)

  return (
    <div className="page-wrapper">
      
      <div className="container" style={{ paddingTop: 32, paddingBottom: 40 }}>
        <h1 style={{ fontWeight: 700, fontSize: 22, marginBottom: 24 }}>Theo dõi đơn giao hàng #{shipmentId}</h1>
        {shipment && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
            {/* Map placeholder */}
            <div className="card" style={{ height: 450, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--gray-100)', color: 'var(--gray-400)', flexDirection: 'column', gap: 12 }}>
              <div style={{ fontSize: 48 }}>🗺️</div>
              <p style={{ fontSize: 14 }}>Bản đồ theo dõi thời gian thực</p>
              {shipment.current_location && (
                <p style={{ fontSize: 13, fontWeight: 600 }}>
                  📍 {shipment.current_location.lat?.toFixed(4)}, {shipment.current_location.lng?.toFixed(4)}
                </p>
              )}
            </div>
            {/* Controls */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="card" style={{ padding: 20 }}>
                <h3 style={{ fontWeight: 700, marginBottom: 14 }}>Trạng thái</h3>
                <p style={{ fontSize: 14, marginBottom: 8 }}>Đơn hàng: <strong>#{shipment.order_id}</strong></p>
                <p style={{ fontSize: 14, marginBottom: 16 }}>Trạng thái: <strong>{shipment.status}</strong></p>
                {!tracking ? (
                  <button onClick={startTracking} className="btn btn-primary w-full">📍 Bắt đầu theo dõi</button>
                ) : (
                  <button onClick={stopTracking} className="btn btn-danger w-full">⏹ Dừng theo dõi</button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default TrackingPage
