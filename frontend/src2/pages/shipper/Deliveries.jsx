import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const token = () => localStorage.getItem("access_token");
const apiFetch = (url, opts = {}) =>
  fetch(`/api/v1${url}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...opts.headers },
    ...opts,
  }).then((r) => r.json());

export default function ShipperDeliveries() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState("available");

  // Đơn sẵn sàng lấy trong khu vực
  const { data: available, isLoading: loadingAvailable } = useQuery({
    queryKey: ["available-deliveries"],
    queryFn: () => apiFetch("/delivery/available/"),
    enabled: tab === "available",
    refetchInterval: 20000,
  });

  // Đơn đang giao của shipper
  const { data: myDeliveries, isLoading: loadingMine } = useQuery({
    queryKey: ["my-deliveries"],
    queryFn: () => apiFetch("/delivery/"),
    enabled: tab === "mine",
  });

  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status }) =>
      apiFetch(`/delivery/${id}/update_status/`, {
        method: "POST",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      qc.invalidateQueries(["my-deliveries"]);
      toast.success("Đã cập nhật trạng thái");
    },
    onError: () => toast.error("Cập nhật thất bại"),
  });

  const STATUS_NEXT = {
    assigned: { next: "picking_up", label: "Bắt đầu lấy hàng", color: "#3b82f6" },
    picking_up: { next: "picked_up", label: "Đã lấy hàng xong", color: "#8b5cf6" },
    picked_up: { next: "in_transit", label: "Bắt đầu giao", color: "#f59e0b" },
    in_transit: { next: "delivered", label: "Xác nhận đã giao", color: "#10b981" },
  };

  const TABS = [
    { key: "available", label: "📋 Đơn trong khu vực" },
    { key: "mine", label: "🚚 Đơn đang giao" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Danh sách đơn hàng</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#fff", padding: 6, borderRadius: 8, marginBottom: 20, width: "fit-content" }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 18px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13,
              fontWeight: tab === t.key ? 600 : 400,
              background: tab === t.key ? "#1a1a2e" : "transparent",
              color: tab === t.key ? "#fff" : "#666",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Available orders */}
      {tab === "available" && (
        <div>
          {loadingAvailable ? (
            <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Đang tìm đơn gần bạn...</div>
          ) : (available || []).length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 8, padding: 60, textAlign: "center", color: "#888" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
              <p>Không có đơn nào trong khu vực của bạn</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(available || []).map((order) => (
                <div key={order.order_id} style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 14 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>#{order.order_number}</span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#10b981" }}>
                      +₫{new Intl.NumberFormat("vi-VN").format(order.shipper_earn)}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                    <div style={{ background: "#f8fafc", borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>🏪 LẤY HÀNG TẠI</div>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{order.shop_name}</div>
                      <div style={{ fontSize: 12, color: "#666", marginTop: 2 }}>{order.shop_address}</div>
                    </div>
                    <div style={{ background: "#f8fafc", borderRadius: 6, padding: 12 }}>
                      <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>📍 GIAO ĐẾN</div>
                      <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>{order.shipping_address}</div>
                    </div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, color: "#888" }}>
                      Phí ship: ₫{new Intl.NumberFormat("vi-VN").format(order.shipping_fee)}
                    </span>
                    <button
                      onClick={() => navigate(`/shipper/map/${order.order_id}`)}
                      style={{ padding: "9px 20px", background: "#1a1a2e", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                    >
                      ✓ Nhận đơn
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* My deliveries */}
      {tab === "mine" && (
        <div>
          {loadingMine ? (
            <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Đang tải...</div>
          ) : (myDeliveries?.results || []).length === 0 ? (
            <div style={{ background: "#fff", borderRadius: 8, padding: 60, textAlign: "center", color: "#888" }}>
              <div style={{ fontSize: 40, marginBottom: 12 }}>🚚</div>
              <p>Bạn chưa có đơn nào đang giao</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(myDeliveries?.results || []).map((delivery) => {
                const action = STATUS_NEXT[delivery.status];
                return (
                  <div key={delivery.id} style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 15 }}>#{delivery.order_number}</span>
                      <span style={{ fontSize: 12, padding: "3px 10px", borderRadius: 20, background: "#e0e7ff", color: "#4338ca", fontWeight: 600 }}>
                        {delivery.status}
                      </span>
                    </div>

                    <div style={{ fontSize: 13, color: "#555", marginBottom: 6 }}>
                      📦 {delivery.shop_name} → 📍 {delivery.shipping_address}
                    </div>
                    <div style={{ fontSize: 13, color: "#555", marginBottom: 16 }}>
                      👤 {delivery.buyer_name} · 📞 {delivery.buyer_phone}
                    </div>

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        onClick={() => navigate(`/shipper/map/${delivery.id}`)}
                        style={{ flex: 1, padding: "9px", background: "#f0f4ff", color: "#3b82f6", border: "1px solid #bfdbfe", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                      >
                        🗺️ Xem bản đồ
                      </button>
                      {action && (
                        <button
                          onClick={() => updateStatusMutation.mutate({ id: delivery.id, status: action.next })}
                          disabled={updateStatusMutation.isPending}
                          style={{ flex: 1, padding: "9px", background: action.color, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600, opacity: updateStatusMutation.isPending ? 0.7 : 1 }}
                        >
                          {action.label}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
