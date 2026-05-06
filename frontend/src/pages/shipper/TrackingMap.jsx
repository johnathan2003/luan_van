import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useShipperTracking } from "../../hooks/useWebSocket";

const token = () => localStorage.getItem("access_token");
const apiFetch = (url) =>
  fetch(`/api/v1${url}`, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());

export default function ShipperMap() {
  const { deliveryId } = useParams();
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef({});
  const { startTracking, stopTracking, isTracking } = useShipperTracking(deliveryId);
  const [currentPos, setCurrentPos] = useState(null);

  const { data: delivery } = useQuery({
    queryKey: ["delivery-detail", deliveryId],
    queryFn: () => apiFetch(`/delivery/${deliveryId}/`),
  });

  // Init Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;

    // Load leaflet dynamically
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = () => {
      const L = window.L;
      const map = L.map(mapRef.current).setView([10.762622, 106.660172], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);
      mapInstanceRef.current = map;

      // Add shop marker if available
      if (delivery?.shop_lat && delivery?.shop_lng) {
        L.marker([parseFloat(delivery.shop_lat), parseFloat(delivery.shop_lng)], {
          icon: L.divIcon({ html: "🏪", className: "", iconSize: [28, 28] }),
        })
          .addTo(map)
          .bindPopup(`<b>Shop:</b> ${delivery.shop_name}`);
      }

      // Add buyer marker
      if (delivery?.shipping_lat && delivery?.shipping_lng) {
        L.marker([parseFloat(delivery.shipping_lat), parseFloat(delivery.shipping_lng)], {
          icon: L.divIcon({ html: "📍", className: "", iconSize: [28, 28] }),
        })
          .addTo(map)
          .bindPopup(`<b>Giao đến:</b> ${delivery.shipping_address}`);
      }
    };
    document.head.appendChild(script);
  }, [delivery]);

  // Watch GPS và update marker khi tracking
  useEffect(() => {
    if (!isTracking) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setCurrentPos({ lat, lng });

        const L = window.L;
        const map = mapInstanceRef.current;
        if (!L || !map) return;

        const position = [lat, lng];
        if (markersRef.current.shipper) {
          markersRef.current.shipper.setLatLng(position);
        } else {
          markersRef.current.shipper = L.marker(position, {
            icon: L.divIcon({ html: "🚚", className: "", iconSize: [30, 30] }),
          })
            .addTo(map)
            .bindPopup("Vị trí của bạn");
        }
        map.panTo(position);
      },
      (err) => console.error("GPS error:", err),
      { enableHighAccuracy: true, maximumAge: 5000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTracking]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      {/* Header */}
      <div style={{ background: "#1a1a2e", color: "#fff", padding: "12px 20px", display: "flex", alignItems: "center", gap: 14 }}>
        <button onClick={() => { stopTracking(); navigate(-1); }}
          style={{ background: "rgba(255,255,255,0.1)", border: "none", color: "#fff", padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
          ← Quay lại
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>#{delivery?.order_number}</div>
          <div style={{ fontSize: 12, color: "#94a3b8" }}>{delivery?.buyer_name} · {delivery?.buyer_phone}</div>
        </div>
        <div style={{ fontSize: 12, padding: "4px 10px", borderRadius: 20, background: isTracking ? "#064e3b" : "#1e1b4b", color: isTracking ? "#6ee7b7" : "#a5b4fc" }}>
          {isTracking ? "● GPS đang hoạt động" : "○ GPS tắt"}
        </div>
      </div>

      {/* Map */}
      <div ref={mapRef} style={{ flex: 1, background: "#e8f4f8" }}>
        {!window.L && (
          <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 10, color: "#64748b" }}>
            <div style={{ fontSize: 48 }}>🗺️</div>
            <p style={{ fontSize: 14 }}>Đang tải bản đồ...</p>
            {currentPos && (
              <p style={{ fontSize: 13, color: "#10b981" }}>
                GPS: {currentPos.lat.toFixed(5)}, {currentPos.lng.toFixed(5)}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Info panel */}
      <div style={{ background: "#fff", padding: 20, borderTop: "1px solid #e2e8f0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>🏪 LẤY HÀNG</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{delivery?.shop_name}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{delivery?.shop_address}</div>
          </div>
          <div style={{ background: "#f8fafc", borderRadius: 8, padding: 12 }}>
            <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>📍 GIAO ĐẾN</div>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{delivery?.buyer_name}</div>
            <div style={{ fontSize: 12, color: "#666" }}>{delivery?.shipping_address}</div>
          </div>
        </div>

        {/* GPS Toggle button */}
        <button
          onClick={() => (isTracking ? stopTracking() : startTracking())}
          style={{
            width: "100%", padding: "13px", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: "pointer",
            background: isTracking ? "#dc2626" : "#10b981",
            color: "#fff",
          }}
        >
          {isTracking ? "⏹ Dừng gửi vị trí GPS" : "▶ Bắt đầu gửi vị trí GPS"}
        </button>
        {currentPos && (
          <p style={{ textAlign: "center", fontSize: 12, color: "#888", marginTop: 8 }}>
            Tọa độ hiện tại: {currentPos.lat.toFixed(6)}, {currentPos.lng.toFixed(6)}
          </p>
        )}
      </div>
    </div>
  );
}
