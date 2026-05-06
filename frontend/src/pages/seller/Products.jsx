import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { productAPI, orderAPI } from "../../services/api";
import toast from "react-hot-toast";

const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n || 0);
const token = () => localStorage.getItem("access_token");

// ─── Products List ─────────────────────────────────────────
export function SellerProducts() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["seller-products"],
    queryFn: () => productAPI.list({ ordering: "-created_at" }).then(r => r.data),
  });
  const deleteMutation = useMutation({
    mutationFn: (id) => productAPI.delete(id),
    onSuccess: () => { qc.invalidateQueries(["seller-products"]); toast.success("Đã xoá sản phẩm"); },
  });
  const STATUS_BADGE = {
    approved: { label: "Đã duyệt", color: "#10b981" },
    pending: { label: "Chờ duyệt", color: "#f59e0b" },
    flagged: { label: "Cần xem xét", color: "#ef4444" },
    rejected: { label: "Từ chối", color: "#6b7280" },
    hidden: { label: "Đã ẩn", color: "#9ca3af" },
  };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Sản phẩm của tôi</h1>
        <button onClick={() => navigate("/seller/products/new")}
          style={{ padding: "10px 20px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
          + Thêm sản phẩm
        </button>
      </div>
      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              {["Sản phẩm", "Giá", "Đã bán", "Trạng thái", "Thao tác"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#666", fontWeight: 600, borderBottom: "1px solid #f0f0f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "#888" }}>Đang tải...</td></tr>
              : (data?.results || []).map(p => {
              const s = STATUS_BADGE[p.status] || { label: p.status, color: "#888" };
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <img src={p.thumbnail || "/placeholder.png"} alt="" style={{ width: 44, height: 44, objectFit: "cover", borderRadius: 4 }} />
                      <span style={{ fontSize: 13, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#ee4d2d", fontWeight: 600 }}>₫{fmt(p.price)}</td>
                  <td style={{ padding: "12px 16px", fontSize: 13 }}>{p.total_sold}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 10, background: s.color + "18", color: s.color, fontWeight: 600 }}>{s.label}</span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => navigate(`/seller/products/${p.id}/edit`)}
                        style={{ padding: "5px 12px", border: "1px solid #ddd", background: "#fff", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Sửa</button>
                      <button onClick={() => { if (window.confirm("Xoá sản phẩm này?")) deleteMutation.mutate(p.id); }}
                        style={{ padding: "5px 12px", border: "1px solid #fca5a5", background: "#fff0f0", color: "#ef4444", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>Xoá</button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Product Form ──────────────────────────────────────────
export function SellerProductForm() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: "", description: "", price: "", original_price: "", discount_percent: 0, category: "", tags: "", weight: "" });
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(false);
  const { data: categories } = useQuery({ queryKey: ["categories"], queryFn: () => productAPI.categories().then(r => r.data) });
  const f = (key, label, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}>{label}</label>
      <input type={type} value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, outline: "none" }} />
    </div>
  );
  const handleSubmit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const fd = new FormData();
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      if (thumbnail) fd.append("thumbnail", thumbnail);
      await productAPI.create(fd);
      toast.success("Đã đăng! Đang chờ AI duyệt...");
      qc.invalidateQueries(["seller-products"]);
      navigate("/seller/products");
    } catch { toast.error("Đăng sản phẩm thất bại"); }
    finally { setLoading(false); }
  };
  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <button onClick={() => navigate("/seller/products")} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18 }}>←</button>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Thêm sản phẩm mới</h1>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ background: "#fff", borderRadius: 8, padding: 24, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#555" }}>THÔNG TIN CƠ BẢN</h3>
          {f("name", "Tên sản phẩm *", "text", "Nhập tên sản phẩm...")}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}>Mô tả *</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} required
              placeholder="Mô tả chi tiết..." style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, resize: "vertical", minHeight: 100, outline: "none" }} />
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}>Danh mục *</label>
            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} required
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}>
              <option value="">-- Chọn danh mục --</option>
              {(categories?.results || categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 8, padding: 24, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#555" }}>GIÁ BÁN</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            {f("price", "Giá bán (₫) *", "number", "0")}
            {f("original_price", "Giá gốc (₫)", "number", "0")}
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 8, padding: 24, marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 16, color: "#555" }}>ẢNH ĐẠI DIỆN</h3>
          <input type="file" accept="image/*" required onChange={e => setThumbnail(e.target.files[0])} />
          {thumbnail && <img src={URL.createObjectURL(thumbnail)} alt="" style={{ width: 100, height: 100, objectFit: "cover", borderRadius: 6, marginTop: 10 }} />}
        </div>
        <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 13, color: "#92400e" }}>
          ⚡ Sản phẩm được AI kiểm duyệt tự động sau khi đăng. Thường mất 1–2 phút.
        </div>
        <button type="submit" disabled={loading}
          style={{ width: "100%", padding: "13px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: loading ? "not-allowed" : "pointer", opacity: loading ? 0.7 : 1 }}>
          {loading ? "Đang đăng..." : "Đăng sản phẩm"}
        </button>
      </form>
    </div>
  );
}

// ─── Seller Orders ─────────────────────────────────────────
export function SellerOrders() {
  const qc = useQueryClient();
  const [tab, setTab] = useState("pending");
  const { data, isLoading } = useQuery({ queryKey: ["seller-orders", tab], queryFn: () => orderAPI.list({ status: tab }).then(r => r.data) });
  const confirmMutation = useMutation({ mutationFn: (id) => orderAPI.confirm(id), onSuccess: () => { qc.invalidateQueries(["seller-orders"]); toast.success("Đã xác nhận"); } });
  const TABS = [{ key: "pending", label: "Chờ xác nhận" }, { key: "confirmed", label: "Đã xác nhận" }, { key: "in_transit", label: "Đang giao" }, { key: "delivered", label: "Đã giao" }];
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Quản lý đơn hàng</h1>
      <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "#fff", padding: 6, borderRadius: 8, width: "fit-content" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{ padding: "8px 16px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: tab === t.key ? 600 : 400, background: tab === t.key ? "#ee4d2d" : "transparent", color: tab === t.key ? "#fff" : "#666" }}>
            {t.label}
          </button>
        ))}
      </div>
      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        {isLoading ? <div style={{ textAlign: "center", padding: 40 }}>Đang tải...</div>
          : (data?.results || []).map(order => (
          <div key={order.id} style={{ padding: "16px 20px", borderBottom: "1px solid #f5f5f5" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontWeight: 600, fontSize: 14 }}>#{order.order_number}</span>
              <span style={{ fontSize: 12, color: "#888" }}>{new Date(order.created_at).toLocaleString("vi-VN")}</span>
            </div>
            <div style={{ fontSize: 13, color: "#666", marginBottom: 10 }}>👤 {order.buyer_name} · {order.item_count} sản phẩm · {order.payment_method?.toUpperCase()}</div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "#ee4d2d" }}>₫{fmt(order.total)}</span>
              {tab === "pending" && (
                <div style={{ display: "flex", gap: 8 }}>
                  <button onClick={() => confirmMutation.mutate(order.id)}
                    style={{ padding: "7px 16px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>✓ Xác nhận</button>
                  <button onClick={() => orderAPI.cancel(order.id, "Shop từ chối").then(() => qc.invalidateQueries(["seller-orders"]))}
                    style={{ padding: "7px 14px", background: "#f5f5f5", color: "#666", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}>Từ chối</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {!isLoading && !data?.results?.length && <div style={{ textAlign: "center", padding: 40, color: "#888" }}>Không có đơn hàng nào</div>}
      </div>
    </div>
  );
}

// ─── Seller Inventory ──────────────────────────────────────
export function SellerInventory() {
  const qc = useQueryClient();
  const [importing, setImporting] = useState(null);
  const [importQty, setImportQty] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => fetch("/api/v1/inventory/", { headers: { Authorization: `Bearer ${token()}` } }).then(r => r.json()),
  });
  const handleImport = async (invId) => {
    if (!importQty || parseInt(importQty) <= 0) return toast.error("Nhập số lượng hợp lệ");
    try {
      await fetch(`/api/v1/inventory/${invId}/import_stock/`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ quantity: parseInt(importQty) }),
      });
      toast.success("Đã nhập hàng thành công");
      setImporting(null); setImportQty("");
      qc.invalidateQueries(["inventory"]);
    } catch { toast.error("Nhập hàng thất bại"); }
  };
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Quản lý kho hàng</h1>
      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa" }}>
              {["Sản phẩm", "Tổng kho", "Đã giữ", "Có thể bán", "Tình trạng", "Thao tác"].map(h => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#666", fontWeight: 600, borderBottom: "1px solid #f0f0f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} style={{ textAlign: "center", padding: 40 }}>Đang tải...</td></tr>
              : (data?.results || []).map(inv => (
              <tr key={inv.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                <td style={{ padding: "12px 16px" }}>
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <img src={inv.product_thumbnail || "/placeholder.png"} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 4 }} />
                    <span style={{ fontSize: 13 }}>{inv.product_name}</span>
                  </div>
                </td>
                <td style={{ padding: "12px 16px", fontSize: 13 }}>{inv.quantity}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, color: "#f59e0b" }}>{inv.reserved_quantity}</td>
                <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 600 }}>{inv.available_quantity}</td>
                <td style={{ padding: "12px 16px" }}>
                  <span style={{ fontSize: 12, padding: "3px 8px", borderRadius: 10, fontWeight: 600,
                    background: inv.is_out_of_stock ? "#fee2e2" : inv.is_low_stock ? "#fef3c7" : "#d1fae5",
                    color: inv.is_out_of_stock ? "#dc2626" : inv.is_low_stock ? "#d97706" : "#059669" }}>
                    {inv.is_out_of_stock ? "Hết hàng" : inv.is_low_stock ? "Sắp hết" : "Còn hàng"}
                  </span>
                </td>
                <td style={{ padding: "12px 16px" }}>
                  {importing === inv.id ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <input type="number" value={importQty} onChange={e => setImportQty(e.target.value)} placeholder="SL"
                        style={{ width: 72, padding: "5px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13 }} />
                      <button onClick={() => handleImport(inv.id)} style={{ padding: "5px 10px", background: "#10b981", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>OK</button>
                      <button onClick={() => setImporting(null)} style={{ padding: "5px 10px", background: "#f5f5f5", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>✕</button>
                    </div>
                  ) : (
                    <button onClick={() => setImporting(inv.id)} style={{ padding: "5px 12px", border: "1px solid #ddd", background: "#fff", borderRadius: 4, cursor: "pointer", fontSize: 12 }}>+ Nhập hàng</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default SellerProducts;
