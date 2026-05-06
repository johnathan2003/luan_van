import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { authAPI } from "../../services/api";
import useAuthStore from "../../store/authStore";
import toast from "react-hot-toast";

export default function Profile() {
  const { user, updateUser } = useAuthStore();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ full_name: user?.full_name || "", phone: user?.phone || "" });

  const mutation = useMutation({
    mutationFn: (data) => authAPI.updateProfile(data).then(r => r.data),
    onSuccess: (data) => {
      updateUser(data);
      setEditing(false);
      toast.success("Cập nhật thành công!");
    },
    onError: () => toast.error("Cập nhật thất bại"),
  });

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 20 }}>👤 Hồ sơ cá nhân</h1>

      <div style={{ background: "#fff", borderRadius: 8, padding: 28 }}>
        {/* Avatar */}
        <div style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid #f0f0f0" }}>
          <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#ee4d2d", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 28, fontWeight: 700 }}>
            {user?.full_name?.[0]?.toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>{user?.full_name}</div>
            <div style={{ fontSize: 13, color: "#888", marginTop: 2 }}>{user?.email}</div>
            <div style={{ fontSize: 12, background: "#fff0ee", color: "#ee4d2d", padding: "2px 8px", borderRadius: 10, display: "inline-block", marginTop: 6 }}>
              {user?.role === "buyer" ? "Người mua" : user?.role === "seller" ? "Người bán" : user?.role}
            </div>
          </div>
        </div>

        {editing ? (
          <div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}>Họ và tên</label>
              <input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, outline: "none" }} />
            </div>
            <div style={{ marginBottom: 24 }}>
              <label style={{ fontSize: 13, color: "#555", display: "block", marginBottom: 6 }}>Số điện thoại</label>
              <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", border: "1px solid #ddd", borderRadius: 6, fontSize: 14, outline: "none" }} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={() => mutation.mutate(form)} disabled={mutation.isPending}
                style={{ padding: "10px 24px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
                {mutation.isPending ? "Đang lưu..." : "Lưu"}
              </button>
              <button onClick={() => setEditing(false)}
                style={{ padding: "10px 20px", background: "#f5f5f5", color: "#444", border: "none", borderRadius: 6, cursor: "pointer" }}>
                Huỷ
              </button>
            </div>
          </div>
        ) : (
          <div>
            {[
              { label: "Email", value: user?.email },
              { label: "Họ và tên", value: user?.full_name },
              { label: "Số điện thoại", value: user?.phone || "Chưa cập nhật" },
            ].map(row => (
              <div key={row.label} style={{ display: "flex", justifyContent: "space-between", padding: "12px 0", borderBottom: "1px solid #f5f5f5" }}>
                <span style={{ fontSize: 13, color: "#888" }}>{row.label}</span>
                <span style={{ fontSize: 14, color: "#333" }}>{row.value}</span>
              </div>
            ))}
            <button onClick={() => setEditing(true)}
              style={{ marginTop: 20, padding: "10px 24px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontWeight: 600 }}>
              Chỉnh sửa hồ sơ
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
