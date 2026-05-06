import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { productAPI } from "../../services/api";
import toast from "react-hot-toast";

const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n || 0);

export default function AdminModeration() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const [rejectReason, setRejectReason] = useState({});

  const { data, isLoading } = useQuery({
    queryKey: ["moderation-products", tab],
    queryFn: () => productAPI.list({ status: tab, ordering: "-created_at" }).then((r) => r.data),
  });

  const moderateMutation = useMutation({
    mutationFn: ({ productId, action, reason }) =>
      productAPI.moderate ? productAPI.moderate(productId, { action, reason }) :
      fetch(`/api/v1/products/${productId}/moderate/`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("access_token")}` },
        body: JSON.stringify({ action, reason }),
      }).then((r) => r.json()),
    onSuccess: (_, vars) => {
      qc.invalidateQueries(["moderation-products"]);
      toast.success(vars.action === "approved" ? "✅ Đã duyệt sản phẩm" : "❌ Đã từ chối sản phẩm");
    },
    onError: () => toast.error("Thao tác thất bại"),
  });

  const TABS = [
    { key: "pending", label: "⏳ Chờ duyệt" },
    { key: "flagged", label: "⚠️ AI đánh dấu" },
    { key: "approved", label: "✅ Đã duyệt" },
    { key: "rejected", label: "❌ Đã từ chối" },
  ];

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 8 }}>Kiểm duyệt sản phẩm</h1>
      <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>
        AI tự động kiểm tra sản phẩm mới. Bạn có thể override quyết định của AI ở đây.
      </p>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, background: "#fff", padding: 6, borderRadius: 8, marginBottom: 20, width: "fit-content" }}>
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 600 : 400, background: tab === t.key ? "#1e293b" : "transparent", color: tab === t.key ? "#fff" : "#666" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Products list */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Đang tải...</div>
      ) : (data?.results || []).length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 8, padding: 60, textAlign: "center", color: "#888" }}>
          Không có sản phẩm nào trong mục này
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {(data?.results || []).map((product) => (
            <div key={product.id} style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
              <div style={{ display: "flex", gap: 16 }}>
                {/* Thumbnail */}
                <img
                  src={product.thumbnail || "/placeholder.png"}
                  alt={product.name}
                  style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 8, flexShrink: 0 }}
                />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{product.name}</span>
                    <span style={{ fontSize: 13, color: "#ee4d2d", fontWeight: 700 }}>₫{fmt(product.price)}</span>
                  </div>
                  <div style={{ fontSize: 12, color: "#64748b", marginBottom: 6 }}>
                    🏪 {product.shop_name} · 🏷️ {product.category_name}
                  </div>
                  <div style={{ fontSize: 12, color: "#888", marginBottom: 10 }}>
                    Đăng lúc: {new Date(product.created_at).toLocaleString("vi-VN")}
                    {product.ai_score !== null && (
                      <span style={{ marginLeft: 12, padding: "2px 8px", borderRadius: 10, background: product.ai_score >= 0.7 ? "#d1fae5" : "#fee2e2", color: product.ai_score >= 0.7 ? "#059669" : "#dc2626", fontWeight: 600 }}>
                        AI Score: {(product.ai_score * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>

                  {/* AI Flags */}
                  {product.ai_flags?.length > 0 && (
                    <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 6, padding: "8px 12px", marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "#92400e", marginBottom: 4 }}>⚠️ AI Flags:</div>
                      {product.ai_flags.map((flag, i) => (
                        <div key={i} style={{ fontSize: 12, color: "#78350f" }}>• {flag}</div>
                      ))}
                    </div>
                  )}

                  {/* Rejection reason nếu đã từ chối */}
                  {product.rejection_reason && (
                    <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 12, color: "#991b1b" }}>
                      Lý do từ chối: {product.rejection_reason}
                    </div>
                  )}

                  {/* Actions */}
                  {(tab === "pending" || tab === "flagged") && (
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                      <button
                        onClick={() => moderateMutation.mutate({ productId: product.id, action: "approved" })}
                        disabled={moderateMutation.isPending}
                        style={{ padding: "7px 18px", background: "#10b981", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                      >
                        ✓ Duyệt
                      </button>
                      <div style={{ display: "flex", gap: 6, flex: 1 }}>
                        <input
                          value={rejectReason[product.id] || ""}
                          onChange={(e) => setRejectReason((p) => ({ ...p, [product.id]: e.target.value }))}
                          placeholder="Lý do từ chối..."
                          style={{ flex: 1, padding: "7px 10px", border: "1px solid #fca5a5", borderRadius: 6, fontSize: 13, outline: "none" }}
                        />
                        <button
                          onClick={() => {
                            const reason = rejectReason[product.id];
                            if (!reason) return toast.error("Nhập lý do từ chối");
                            moderateMutation.mutate({ productId: product.id, action: "rejected", reason });
                          }}
                          disabled={moderateMutation.isPending}
                          style={{ padding: "7px 16px", background: "#fff0f0", color: "#dc2626", border: "1px solid #fca5a5", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                        >
                          ✕ Từ chối
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
