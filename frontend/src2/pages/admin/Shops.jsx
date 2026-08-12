import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const token = () => localStorage.getItem("access_token");
const apiFetch = (url, opts = {}) =>
  fetch(`/api/v1${url}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...opts.headers },
    ...opts,
  }).then((r) => r.json());

const STATUS_BADGE = {
  pending: { label: "Chờ duyệt", color: "#f59e0b" },
  active: { label: "Hoạt động", color: "#10b981" },
  suspended: { label: "Đình chỉ", color: "#ef4444" },
  closed: { label: "Đã đóng", color: "#9ca3af" },
};

export default function AdminShops() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("pending");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-shops", statusFilter],
    queryFn: () => apiFetch(`/shops/?status=${statusFilter}`),
  });

  const approveMutation = useMutation({
    mutationFn: (shopId) => apiFetch(`/shops/${shopId}/approve/`, { method: "POST" }),
    onSuccess: () => { qc.invalidateQueries(["admin-shops"]); toast.success("Đã duyệt shop"); },
  });

  const suspendMutation = useMutation({
    mutationFn: ({ shopId, reason }) =>
      apiFetch(`/shops/${shopId}/suspend/`, { method: "POST", body: JSON.stringify({ reason }) }),
    onSuccess: () => { qc.invalidateQueries(["admin-shops"]); toast.success("Đã đình chỉ shop"); },
  });

  const STATUS_TABS = [
    { key: "pending", label: "⏳ Chờ duyệt" },
    { key: "active", label: "✅ Hoạt động" },
    { key: "suspended", label: "🚫 Đình chỉ" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Quản lý Shop</h1>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#fff", padding: 6, borderRadius: 8, marginBottom: 20, width: "fit-content" }}>
        {STATUS_TABS.map((t) => (
          <button key={t.key} onClick={() => setStatusFilter(t.key)}
            style={{ padding: "8px 18px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: statusFilter === t.key ? 600 : 400, background: statusFilter === t.key ? "#1e293b" : "transparent", color: statusFilter === t.key ? "#fff" : "#666" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Shop list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {isLoading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Đang tải...</div>
        ) : (data?.results || []).length === 0 ? (
          <div style={{ background: "#fff", borderRadius: 8, padding: 60, textAlign: "center", color: "#888" }}>
            Không có shop nào
          </div>
        ) : (data?.results || []).map((shop) => {
          const s = STATUS_BADGE[shop.status] || { label: shop.status, color: "#888" };
          return (
            <div key={shop.id} style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                {/* Logo */}
                <div style={{ width: 56, height: 56, borderRadius: 8, background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>
                  🏪
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: 16 }}>{shop.name}</span>
                      <span style={{ marginLeft: 10, fontSize: 12, padding: "2px 8px", borderRadius: 10, background: s.color + "18", color: s.color, fontWeight: 600 }}>{s.label}</span>
                    </div>
                    <span style={{ fontSize: 12, color: "#888" }}>{new Date(shop.created_at).toLocaleDateString("vi-VN")}</span>
                  </div>
                  <div style={{ fontSize: 13, color: "#64748b", marginBottom: 4 }}>
                    👤 {shop.owner_name} · 📍 {shop.province}, {shop.district}
                  </div>
                  {shop.description && (
                    <div style={{ fontSize: 13, color: "#888", marginBottom: 10, maxWidth: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {shop.description}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 8 }}>
                    {shop.status === "pending" && (
                      <button
                        onClick={() => approveMutation.mutate(shop.id)}
                        disabled={approveMutation.isPending}
                        style={{ padding: "7px 18px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                      >
                        ✓ Duyệt shop
                      </button>
                    )}
                    {shop.status === "active" && (
                      <button
                        onClick={() => { const r = window.prompt("Lý do đình chỉ:"); if (r) suspendMutation.mutate({ shopId: shop.id, reason: r }); }}
                        style={{ padding: "7px 18px", background: "#fff0f0", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                      >
                        🚫 Đình chỉ
                      </button>
                    )}
                    {shop.status === "suspended" && (
                      <button
                        onClick={() => approveMutation.mutate(shop.id)}
                        style={{ padding: "7px 18px", background: "#f0fdf4", color: "#16a34a", border: "1px solid #86efac", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                      >
                        🔓 Mở lại
                      </button>
                    )}
                    <div style={{ display: "flex", gap: 16, alignItems: "center", marginLeft: 8, fontSize: 12, color: "#888" }}>
                      <span>⭐ {shop.rating}</span>
                      <span>📦 {shop.total_sales} đơn</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
