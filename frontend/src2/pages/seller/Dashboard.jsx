import { useQuery } from "@tanstack/react-query";
import { analyticsAPI } from "../../services/api";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const fmt = (n) => new Intl.NumberFormat("vi-VN").format(n || 0);

function StatCard({ icon, label, value, sub, color = "#ee4d2d" }) {
  return (
    <div style={{ background: "#fff", borderRadius: 8, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.06)" }}>
      <div style={{ fontSize: 24, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, color }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#aaa", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function SellerDashboard() {
  const { data: dash, isLoading } = useQuery({ queryKey: ["seller-dashboard"], queryFn: () => analyticsAPI.sellerDashboard().then(r => r.data) });
  const { data: chart } = useQuery({ queryKey: ["revenue-chart"], queryFn: () => analyticsAPI.revenueChart(30).then(r => r.data) });
  if (isLoading) return <div style={{ textAlign: "center", padding: 60 }}>Đang tải...</div>;
  const growth = dash?.revenue?.growth_percent;
  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20 }}>Tổng quan</h1>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
        <StatCard icon="💰" label="Doanh thu tháng này" value={`₫${fmt(dash?.revenue?.this_month)}`} sub={growth !== undefined ? `${growth >= 0 ? "▲" : "▼"} ${Math.abs(growth)}% so tháng trước` : ""} />
        <StatCard icon="📦" label="Đơn chờ xác nhận" value={dash?.orders?.pending} color="#f59e0b" sub={`Hôm nay: ${dash?.orders?.today} đơn`} />
        <StatCard icon="🏷️" label="Sản phẩm đang bán" value={dash?.products?.approved} color="#10b981" sub={`${dash?.products?.pending} chờ duyệt`} />
        <StatCard icon="⭐" label="Rating shop" value={`${dash?.shop_rating}/5`} color="#f59e0b" />
      </div>
      <div style={{ background: "#fff", borderRadius: 8, padding: 24, marginBottom: 20 }}>
        <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 20 }}>Doanh thu 30 ngày qua</h2>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chart || []}>
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={v => `₫${fmt(v)}`} />
            <Bar dataKey="revenue" fill="#ee4d2d" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
        <div style={{ background: "#fff", borderRadius: 8, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16 }}>Sản phẩm bán chạy</h2>
          {(dash?.top_products || []).map((p, i) => (
            <div key={p.product_id} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
              <span style={{ width: 24, height: 24, borderRadius: "50%", background: i < 3 ? "#ee4d2d" : "#f0f0f0", color: i < 3 ? "#fff" : "#666", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{i + 1}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{p.product_name}</div>
                <div style={{ fontSize: 12, color: "#888" }}>Đã bán: {p.total_sold} · ₫{fmt(p.revenue)}</div>
              </div>
            </div>
          ))}
          {!dash?.top_products?.length && <p style={{ color: "#aaa", fontSize: 13 }}>Chưa có dữ liệu</p>}
        </div>
        <div style={{ background: "#fff", borderRadius: 8, padding: 24 }}>
          <h2 style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Gợi ý cải thiện</h2>
          <p style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>Nhiều lượt xem nhưng ít mua</p>
          {(dash?.low_conversion_products || []).map(p => (
            <div key={p.id} style={{ padding: "10px 0", borderBottom: "1px solid #f5f5f5" }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.name}</div>
              <div style={{ fontSize: 12, color: "#888" }}>{p.view_count} lượt xem · {p.total_sold} lượt mua</div>
              <div style={{ fontSize: 12, color: "#f59e0b", marginTop: 2 }}>→ Thử giảm giá hoặc cải thiện ảnh</div>
            </div>
          ))}
          {!dash?.low_conversion_products?.length && <p style={{ color: "#aaa", fontSize: 13 }}>Không có gợi ý</p>}
        </div>
      </div>
    </div>
  );
}
