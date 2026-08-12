import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { orderAPI } from "../../services/api";
import { useOrderTracking } from "../../hooks/useWebSocket";

export default function TrackingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { location, isConnected } = useOrderTracking(id);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const mapInstanceRef = useRef(null);

  const { data: trackingData } = useQuery({
    queryKey: ["tracking", id],
    queryFn: () => orderAPI.tracking(id).then(r => r.data),
    refetchInterval: 15000,
  });

  // Init Leaflet map
  useEffect(() => {
    if (!mapRef.current || mapInstanceRef.current) return;
    const L = window.L;
    if (!L) return;

    const map = L.map(mapRef.current).setView([10.762622, 106.660172], 13);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "© OpenStreetMap"
    }).addTo(map);
    mapInstanceRef.current = map;
  }, []);

  // Update shipper marker khi nhận GPS
  useEffect(() => {
    const L = window.L;
    const map = mapInstanceRef.current;
    if (!L || !map || !location) return;

    const pos = [location.lat, location.lng];
    if (markerRef.current) {
      markerRef.current.setLatLng(pos);
    } else {
      markerRef.current = L.marker(pos, {
        icon: L.divIcon({ html: "🚚", className: "", iconSize: [30, 30] })
      }).addTo(map).bindPopup("Shipper đang ở đây");
    }
    map.panTo(pos);
  }, [location]);

  const shipper = trackingData?.shipper;
  const latest = trackingData?.tracking_points?.[0];

  return (
    <div>
      {/* Leaflet CSS */}
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
        <button onClick={() => navigate(-1)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>🗺️ Theo dõi đơn hàng</h1>
        <span style={{ marginLeft: "auto", fontSize: 12, padding: "3px 10px", borderRadius: 20, background: isConnected ? "#d1fae5" : "#fee2e2", color: isConnected ? "#059669" : "#dc2626" }}>
          {isConnected ? "● Đang theo dõi live" : "○ Đang kết nối..."}
        </span>
      </div>

      {/* Shipper info */}
      {shipper?.name && (
        <div style={{ background: "#fff", borderRadius: 8, padding: 16, marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#ee4d2d", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 20 }}>🚚</div>
          <div>
            <div style={{ fontWeight: 600 }}>{shipper.name}</div>
            <div style={{ fontSize: 13, color: "#888" }}>Shipper · {shipper.phone}</div>
          </div>
          <a href={`tel:${shipper.phone}`} style={{ marginLeft: "auto", padding: "8px 16px", background: "#ee4d2d", color: "#fff", borderRadius: 6, textDecoration: "none", fontSize: 13 }}>
            📞 Gọi
          </a>
        </div>
      )}

      {/* Map */}
      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", marginBottom: 16 }}>
        <div ref={mapRef} style={{ height: 400, background: "#f0f0f0" }}>
          {!window.L && (
            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#888", flexDirection: "column", gap: 8 }}>
              <div style={{ fontSize: 40 }}>🗺️</div>
              <p style={{ fontSize: 14 }}>
                {location ? `Shipper tại: ${location.lat?.toFixed(5)}, ${location.lng?.toFixed(5)}` : "Chờ cập nhật vị trí shipper..."}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Status timeline */}
      <div style={{ background: "#fff", borderRadius: 8, padding: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Trạng thái giao hàng</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[
            { label: "Đơn đã đặt", icon: "✅" },
            { label: "Shop đang chuẩn bị", icon: "📦" },
            { label: "Shipper đã lấy hàng", icon: "🚚" },
            { label: "Đang trên đường giao", icon: "🛣️" },
            { label: "Đã giao thành công", icon: "🎉" },
          ].map((step, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ fontSize: 18 }}>{step.icon}</span>
              <span style={{ fontSize: 14, color: "#333" }}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
