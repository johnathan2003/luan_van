import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { orderAPI } from "../../services/api";
import useCartStore from "../../store/cartStore";
import useAuthStore from "../../store/authStore";
import toast from "react-hot-toast";

export default function Checkout() {
  const { cart, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    receiver_name: user?.full_name || "",
    phone: user?.phone || "",
    province: "",
    district: "",
    ward: "",
    street: "",
    payment_method: "cod",
    note: "",
  });

  const items = cart?.items || [];
  const total = cart?.total_price || 0;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!items.length) return;
    setLoading(true);
    try {
      // Group items by shop (giả sử 1 shop)
      const shopId = items[0]?.product; // cần lấy shop từ product
      const payload = {
        shop_id: shopId,
        items: items.map(item => ({
          product_id: item.product,
          variant_id: item.variant || null,
          product_name: item.product_name,
          product_image: item.product_thumbnail || "",
          quantity: item.quantity,
          unit_price: item.product_price,
        })),
        address: {
          receiver_name: form.receiver_name,
          phone: form.phone,
          full_address: `${form.street}, ${form.ward}, ${form.district}, ${form.province}`,
          province: form.province,
        },
        payment_method: form.payment_method,
        note: form.note,
      };
      const { data } = await orderAPI.create(payload);
      await clearCart();
      toast.success("Đặt hàng thành công!");
      navigate(`/orders/${data.id}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Đặt hàng thất bại");
    } finally {
      setLoading(false);
    }
  };

  const field = (key, label, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 5 }}>{label}</label>
      <input type={type} required value={form[key]}
        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, outline: "none" }} />
    </div>
  );

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>Đặt hàng</h1>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20 }}>
        <form onSubmit={handleSubmit}>
          <div style={{ background: "#fff", borderRadius: 8, padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>📍 Địa chỉ nhận hàng</h3>
            {field("receiver_name", "Họ và tên người nhận")}
            {field("phone", "Số điện thoại", "tel")}
            {field("province", "Tỉnh / Thành phố")}
            {field("district", "Quận / Huyện")}
            {field("ward", "Phường / Xã")}
            {field("street", "Địa chỉ chi tiết (số nhà, tên đường)")}
          </div>

          <div style={{ background: "#fff", borderRadius: 8, padding: 24, marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>💳 Phương thức thanh toán</h3>
            {[
              { value: "cod", label: "💵 Thanh toán khi nhận hàng (COD)" },
              { value: "momo", label: "📱 Ví MoMo" },
              { value: "vnpay", label: "🏦 VNPay" },
            ].map(opt => (
              <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, cursor: "pointer" }}>
                <input type="radio" name="payment" value={opt.value}
                  checked={form.payment_method === opt.value}
                  onChange={() => setForm(p => ({ ...p, payment_method: opt.value }))} />
                <span style={{ fontSize: 14 }}>{opt.label}</span>
              </label>
            ))}
          </div>

          <div style={{ background: "#fff", borderRadius: 8, padding: 24 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>📝 Ghi chú</h3>
            <textarea value={form.note} onChange={e => setForm(p => ({ ...p, note: e.target.value }))}
              placeholder="Ghi chú cho người bán hoặc shipper..."
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, resize: "vertical", minHeight: 80, outline: "none" }} />
          </div>

          <button type="submit" disabled={loading}
            style={{ width: "100%", marginTop: 16, padding: "14px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
            {loading ? "Đang đặt hàng..." : `Đặt hàng — ₫${new Intl.NumberFormat("vi-VN").format(total)}`}
          </button>
        </form>

        {/* Order summary */}
        <div style={{ background: "#fff", borderRadius: 8, padding: 20, alignSelf: "start", position: "sticky", top: 80 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16 }}>Tóm tắt đơn hàng</h3>
          {items.map(item => (
            <div key={item.id} style={{ display: "flex", gap: 10, marginBottom: 12 }}>
              <img src={item.product_thumbnail || "/placeholder.png"} alt=""
                style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 4 }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, lineHeight: 1.4 }}>{item.product_name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>x{item.quantity}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>₫{new Intl.NumberFormat("vi-VN").format(item.subtotal)}</div>
            </div>
          ))}
          <div style={{ borderTop: "1px solid #eee", paddingTop: 12, marginTop: 4 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: "#666" }}>Tạm tính</span>
              <span>₫{new Intl.NumberFormat("vi-VN").format(total)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: "#666" }}>Phí vận chuyển</span>
              <span>₫15.000 – ₫30.000</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 15, color: "#ee4d2d" }}>
              <span>Tổng</span>
              <span>₫{new Intl.NumberFormat("vi-VN").format(total)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
