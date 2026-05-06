// ─── Cart ──────────────────────────────────────────────────
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import useCartStore from "../../store/cartStore";
import { orderAPI } from "../../services/api";

export function Cart() {
  const { cart, removeItem, isLoading } = useCartStore();
  const navigate = useNavigate();

  if (isLoading) return <div style={{ textAlign: "center", padding: 60 }}>Đang tải giỏ hàng...</div>;

  const items = cart?.items || [];
  const total = cart?.total_price || 0;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>🛒 Giỏ hàng ({items.length} sản phẩm)</h1>
      {items.length === 0 ? (
        <div style={{ background: "#fff", borderRadius: 8, padding: 60, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🛒</div>
          <p style={{ color: "#888" }}>Giỏ hàng đang trống</p>
          <button onClick={() => navigate("/")} style={{ marginTop: 16, padding: "10px 24px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Tiếp tục mua sắm
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 16 }}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 20 }}>
            {items.map(item => (
              <div key={item.id} style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: "1px solid #f5f5f5" }}>
                <img src={item.product_thumbnail || "/placeholder.png"} alt={item.product_name}
                  style={{ width: 80, height: 80, objectFit: "cover", borderRadius: 6 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, color: "#333", marginBottom: 4 }}>{item.product_name}</div>
                  {item.variant_name && <div style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>Phân loại: {item.variant_name}</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ color: "#ee4d2d", fontWeight: 700 }}>₫{new Intl.NumberFormat("vi-VN").format(item.product_price)}</span>
                    <span style={{ fontSize: 13, color: "#666" }}>x{item.quantity}</span>
                    <span style={{ fontWeight: 600 }}>₫{new Intl.NumberFormat("vi-VN").format(item.subtotal)}</span>
                    <button onClick={() => removeItem(item.product)} style={{ color: "#ee4d2d", background: "none", border: "none", cursor: "pointer", fontSize: 13 }}>Xoá</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div>
            <div style={{ background: "#fff", borderRadius: 8, padding: 20, position: "sticky", top: 80 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontSize: 14 }}>
                <span style={{ color: "#666" }}>Tạm tính:</span>
                <span>₫{new Intl.NumberFormat("vi-VN").format(total)}</span>
              </div>
              <div style={{ borderTop: "1px solid #eee", paddingTop: 12, display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
                <span style={{ fontWeight: 600 }}>Tổng cộng:</span>
                <span style={{ color: "#ee4d2d", fontWeight: 700, fontSize: 18 }}>₫{new Intl.NumberFormat("vi-VN").format(total)}</span>
              </div>
              <button onClick={() => navigate("/checkout")}
                style={{ width: "100%", padding: "13px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
                Đặt hàng ({items.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── OrderList ─────────────────────────────────────────────
export function OrderList() {
  const { data, isLoading } = useQuery({
    queryKey: ["orders"],
    queryFn: () => orderAPI.list().then(r => r.data),
  });
  const navigate = useNavigate();

  const STATUS_LABELS = {
    pending: { label: "Chờ xác nhận", color: "#f59e0b" },
    confirmed: { label: "Đã xác nhận", color: "#3b82f6" },
    in_transit: { label: "Đang giao", color: "#8b5cf6" },
    delivered: { label: "Đã giao", color: "#10b981" },
    cancelled: { label: "Đã huỷ", color: "#ef4444" },
  };

  if (isLoading) return <div style={{ textAlign: "center", padding: 60 }}>Đang tải...</div>;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>📦 Đơn hàng của tôi</h1>
      {(data?.results || []).map(order => {
        const s = STATUS_LABELS[order.status] || { label: order.status, color: "#888" };
        return (
          <div key={order.id} onClick={() => navigate(`/orders/${order.id}`)}
            style={{ background: "#fff", borderRadius: 8, padding: 20, marginBottom: 12, cursor: "pointer", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: "#888" }}>🏪 {order.shop_name}</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: s.color, background: s.color + "18", padding: "3px 10px", borderRadius: 20 }}>{s.label}</span>
            </div>
            {order.first_item && (
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <img src={order.first_item.image || "/placeholder.png"} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
                <div>
                  <div style={{ fontSize: 14 }}>{order.first_item.name}</div>
                  <div style={{ fontSize: 12, color: "#888" }}>x{order.first_item.quantity} {order.item_count > 1 ? `+ ${order.item_count - 1} sản phẩm khác` : ""}</div>
                </div>
              </div>
            )}
            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", borderTop: "1px solid #f5f5f5", paddingTop: 12 }}>
              <span style={{ fontSize: 12, color: "#888" }}>#{order.order_number}</span>
              <span style={{ fontWeight: 700, color: "#ee4d2d" }}>₫{new Intl.NumberFormat("vi-VN").format(order.total)}</span>
            </div>
          </div>
        );
      })}
      {!data?.results?.length && <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Chưa có đơn hàng nào</div>}
    </div>
  );
}

// ─── OrderDetail ───────────────────────────────────────────
export function OrderDetail() {
  const { id } = { id: window.location.pathname.split("/")[2] };
  const navigate = useNavigate();
  const { data: order, isLoading } = useQuery({
    queryKey: ["order", id],
    queryFn: () => orderAPI.detail(id).then(r => r.data),
  });

  if (isLoading) return <div style={{ textAlign: "center", padding: 60 }}>Đang tải...</div>;
  if (!order) return <div>Không tìm thấy đơn hàng</div>;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
        <button onClick={() => navigate("/orders")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20 }}>←</button>
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>Đơn hàng #{order.order_number}</h1>
      </div>
      <div style={{ background: "#fff", borderRadius: 8, padding: 24, marginBottom: 12 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#888" }}>TRẠNG THÁI ĐƠN HÀNG</h3>
        {(order.status_history || []).map((h, i) => (
          <div key={i} style={{ display: "flex", gap: 12, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#ee4d2d", marginTop: 4, flexShrink: 0 }}></div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{h.status}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{new Date(h.created_at).toLocaleString("vi-VN")}</div>
            </div>
          </div>
        ))}
        {order.status === "in_transit" && (
          <button onClick={() => navigate(`/orders/${id}/tracking`)}
            style={{ marginTop: 12, padding: "8px 16px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>
            🗺️ Xem vị trí shipper
          </button>
        )}
      </div>
      <div style={{ background: "#fff", borderRadius: 8, padding: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#888" }}>SẢN PHẨM</h3>
        {(order.items || []).map(item => (
          <div key={item.id} style={{ display: "flex", gap: 12, marginBottom: 12, paddingBottom: 12, borderBottom: "1px solid #f5f5f5" }}>
            <img src={item.product_image || "/placeholder.png"} alt="" style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 6 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14 }}>{item.product_name}</div>
              <div style={{ fontSize: 12, color: "#888" }}>x{item.quantity} · ₫{new Intl.NumberFormat("vi-VN").format(item.unit_price)}</div>
            </div>
            <div style={{ fontWeight: 600 }}>₫{new Intl.NumberFormat("vi-VN").format(item.total_price)}</div>
          </div>
        ))}
        <div style={{ borderTop: "1px solid #eee", paddingTop: 12, display: "flex", justifyContent: "space-between" }}>
          <span style={{ fontWeight: 600 }}>Tổng cộng:</span>
          <span style={{ fontWeight: 700, color: "#ee4d2d", fontSize: 16 }}>₫{new Intl.NumberFormat("vi-VN").format(order.total)}</span>
        </div>
      </div>
    </div>
  );
}

export default Cart;
