import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../hooks";

// ─── Login ─────────────────────────────────────────────────
export function Login() {
  const { loginAndRedirect, isLoading, error } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try { await loginAndRedirect(form.email, form.password); } catch {}
  };

  return (
    <div style={{ minHeight: "100vh", background: "#ee4d2d", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: 40, width: 400, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#ee4d2d", marginBottom: 8 }}>🛒 ShopVN</h1>
        <p style={{ color: "#666", marginBottom: 24, fontSize: 14 }}>Đăng nhập vào tài khoản của bạn</p>

        {error && <div style={{ background: "#fff0ee", color: "#ee4d2d", padding: "10px 12px", borderRadius: 6, marginBottom: 16, fontSize: 14 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 14, color: "#333", display: "block", marginBottom: 6 }}>Email</label>
            <input type="email" required value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="email@example.com"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, outline: "none" }} />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={{ fontSize: 14, color: "#333", display: "block", marginBottom: 6 }}>Mật khẩu</label>
            <input type="password" required value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
              placeholder="••••••••"
              style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, outline: "none" }} />
          </div>
          <button type="submit" disabled={isLoading}
            style={{ width: "100%", padding: "12px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? "Đang đăng nhập..." : "Đăng nhập"}
          </button>
        </form>

        <p style={{ marginTop: 20, textAlign: "center", fontSize: 14, color: "#666" }}>
          Chưa có tài khoản? <Link to="/register" style={{ color: "#ee4d2d", textDecoration: "none", fontWeight: 600 }}>Đăng ký ngay</Link>
        </p>
      </div>
    </div>
  );
}

// ─── Register ──────────────────────────────────────────────
export function Register() {
  const { register, isLoading, error } = useAuth();
  const [form, setForm] = useState({ email: "", full_name: "", phone: "", password: "", password_confirm: "", role: "buyer" });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (form.password !== form.password_confirm) return alert("Mật khẩu không khớp");
    try { await register(form); } catch {}
  };

  const field = (key, label, type = "text", placeholder = "") => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, color: "#333", display: "block", marginBottom: 5 }}>{label}</label>
      <input type={type} required value={form[key]} onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
        placeholder={placeholder}
        style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, outline: "none" }} />
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: "#ee4d2d", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ background: "#fff", borderRadius: 8, padding: 36, width: 440, boxShadow: "0 4px 20px rgba(0,0,0,0.1)" }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#ee4d2d", marginBottom: 6 }}>🛒 Tạo tài khoản</h1>
        <p style={{ color: "#666", marginBottom: 20, fontSize: 13 }}>Đăng ký để bắt đầu mua sắm</p>

        {error && <div style={{ background: "#fff0ee", color: "#ee4d2d", padding: "10px 12px", borderRadius: 6, marginBottom: 14, fontSize: 13 }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          {field("full_name", "Họ và tên", "text", "Nguyễn Văn A")}
          {field("email", "Email", "email", "email@example.com")}
          {field("phone", "Số điện thoại", "tel", "0901234567")}
          {field("password", "Mật khẩu", "password", "Ít nhất 8 ký tự")}
          {field("password_confirm", "Xác nhận mật khẩu", "password", "Nhập lại mật khẩu")}

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 13, color: "#333", display: "block", marginBottom: 5 }}>Tôi muốn</label>
            <select value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}
              style={{ width: "100%", padding: "9px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14 }}>
              <option value="buyer">Mua hàng</option>
              <option value="seller">Bán hàng (mở shop)</option>
              <option value="shipper">Giao hàng</option>
            </select>
          </div>

          <button type="submit" disabled={isLoading}
            style={{ width: "100%", padding: "11px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: isLoading ? "not-allowed" : "pointer", opacity: isLoading ? 0.7 : 1 }}>
            {isLoading ? "Đang đăng ký..." : "Đăng ký"}
          </button>
        </form>

        <p style={{ marginTop: 18, textAlign: "center", fontSize: 13, color: "#666" }}>
          Đã có tài khoản? <Link to="/login" style={{ color: "#ee4d2d", textDecoration: "none", fontWeight: 600 }}>Đăng nhập</Link>
        </p>
      </div>
    </div>
  );
}

export default Login;
