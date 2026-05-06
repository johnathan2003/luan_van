import { useNavigate } from "react-router-dom";
import useAuthStore from "../store/authStore";

export default function Unauthorized() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const redirectMap = {
    buyer: "/",
    seller: "/seller/dashboard",
    shipper: "/shipper/deliveries",
    admin: "/admin/overview",
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5" }}>
      <div style={{ textAlign: "center", background: "#fff", padding: 48, borderRadius: 12, boxShadow: "0 2px 12px rgba(0,0,0,0.08)", maxWidth: 400 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>🚫</div>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#222", marginBottom: 8 }}>Không có quyền truy cập</h1>
        <p style={{ color: "#888", fontSize: 14, marginBottom: 28, lineHeight: 1.6 }}>
          Bạn không có quyền truy cập trang này.<br />
          Vui lòng quay lại trang phù hợp với vai trò của bạn.
        </p>
        <button
          onClick={() => navigate(user ? redirectMap[user.role] || "/" : "/login")}
          style={{ padding: "11px 28px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
        >
          {user ? "Về trang chính" : "Đăng nhập"}
        </button>
      </div>
    </div>
  );
}
