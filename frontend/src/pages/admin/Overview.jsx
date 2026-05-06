import { useQuery } from "@tanstack/react-query";
import { analyticsAPI } from "../../services/api";

const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n || 0);

function StatCard({ icon, label, value, sub, color = "#3b82f6" }) {
  return (
    <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#aaa", marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

export default function AdminOverview() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: () => analyticsAPI.adminOverview().then((r) => r.data),
  });

  if (isLoading) return <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Đang tải...</div>;

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Tổng quan hệ thống</h1>

      {/* Users */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".05em" }}>
        Người dùng
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard icon="👥" label="Tổng người dùng" value={fmt(data?.users?.total)} color="#1e293b" />
        <StatCard icon="🛒" label="Người mua" value={fmt(data?.users?.buyers)} color="#3b82f6" />
        <StatCard icon="🏪" label="Người bán" value={fmt(data?.users?.sellers)} color="#8b5cf6" />
        <StatCard icon="🚚" label="Shipper" value={fmt(data?.users?.shippers)} color="#f59e0b" />
      </div>

      {/* Shops & Products */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".05em" }}>
        Shop & Sản phẩm
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        <StatCard icon="🏪" label="Tổng shop" value={fmt(data?.shops?.total)} color="#1e293b" />
        <StatCard icon="⏳" label="Shop chờ duyệt" value={fmt(data?.shops?.pending)} color="#f59e0b"
          sub={data?.shops?.pending > 0 ? "Cần xem xét" : "Không có"} />
        <StatCard icon="🏷️" label="Tổng sản phẩm" value={fmt(data?.products?.total)} color="#1e293b" />
        <StatCard icon="🛡️" label="Sản phẩm chờ duyệt" value={fmt(data?.products?.pending_review)} color="#ef4444"
          sub={`${data?.products?.flagged || 0} bị đánh dấu`} />
      </div>

      {/* Orders & Revenue */}
      <h2 style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8", marginBottom: 12, textTransform: "uppercase", letterSpacing: ".05em" }}>
        Đơn hàng & Doanh thu
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
        <StatCard icon="📦" label="Tổng đơn hàng" value={fmt(data?.orders?.total)} color="#1e293b" />
        <StatCard icon="📅" label="Đơn hôm nay" value={fmt(data?.orders?.today)} color="#10b981" />
        <StatCard icon="💰" label="Tổng doanh thu" value={`₫${fmt(data?.revenue)}`} color="#ee4d2d" />
      </div>
    </div>
  );
}
