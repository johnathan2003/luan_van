import { useQuery } from "@tanstack/react-query";

const token = () => localStorage.getItem("access_token");
const apiFetch = (url) =>
  fetch(`/api/v1${url}`, { headers: { Authorization: `Bearer ${token()}` } }).then((r) => r.json());

const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n || 0);

export default function ShipperEarnings() {
  const { data, isLoading } = useQuery({
    queryKey: ["shipper-earnings"],
    queryFn: () => apiFetch("/delivery/earnings/"),
  });

  const history = data?.history || [];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Thu nhập của tôi</h1>

      {/* Summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
        <div style={{ background: "#1a1a2e", borderRadius: 12, padding: 24, color: "#fff" }}>
          <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 8 }}>Tổng thu nhập</div>
          <div style={{ fontSize: 28, fontWeight: 800 }}>₫{fmt(data?.total_earned)}</div>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 24, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
          <div style={{ fontSize: 13, color: "#888", marginBottom: 8 }}>Tổng đơn đã giao</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: "#10b981" }}>{data?.total_deliveries || 0}</div>
        </div>
      </div>

      {/* History */}
      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f0f0f0" }}>
          <h2 style={{ fontSize: 15, fontWeight: 600 }}>Lịch sử giao hàng</h2>
        </div>

        {isLoading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Đang tải...</div>
        ) : history.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#888" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <p>Chưa có lịch sử giao hàng</p>
          </div>
        ) : (
          <div>
            {history.map((delivery) => (
              <div key={delivery.id} style={{ padding: "16px 20px", borderBottom: "1px solid #f5f5f5", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#d1fae5", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                  ✅
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>#{delivery.order_number}</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>
                    📍 {delivery.shipping_address}
                  </div>
                  <div style={{ fontSize: 12, color: "#aaa", marginTop: 1 }}>
                    {delivery.delivered_at
                      ? new Date(delivery.delivered_at).toLocaleString("vi-VN")
                      : "—"}
                  </div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: 15, color: "#10b981" }}>
                    +₫{fmt(delivery.shipper_earn)}
                  </div>
                  <div style={{ fontSize: 11, color: "#aaa" }}>
                    Phí ship: ₫{fmt(delivery.fee)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
