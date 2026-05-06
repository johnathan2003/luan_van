import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

const token = () => localStorage.getItem("access_token");
const apiFetch = (url, opts = {}) =>
  fetch(`/api/v1${url}`, {
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}`, ...opts.headers },
    ...opts,
  }).then((r) => r.json());

const ROLE_BADGE = {
  buyer: { label: "Người mua", color: "#3b82f6" },
  seller: { label: "Người bán", color: "#8b5cf6" },
  shipper: { label: "Shipper", color: "#f59e0b" },
  admin: { label: "Admin", color: "#ef4444" },
};

export default function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users", search, roleFilter],
    queryFn: () => {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (roleFilter) params.set("role", roleFilter);
      return apiFetch(`/users/?${params}`);
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ userId, isActive }) =>
      fetch(`/api/v1/users/${userId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token()}` },
        body: JSON.stringify({ is_active: isActive }),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries(["admin-users"]);
      toast.success("Đã cập nhật trạng thái tài khoản");
    },
  });

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 24 }}>Quản lý người dùng</h1>

      {/* Filters */}
      <div style={{ background: "#fff", borderRadius: 8, padding: "14px 20px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="🔍 Tìm theo tên, email..."
          style={{ flex: 1, padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, outline: "none" }}
        />
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          style={{ padding: "9px 12px", border: "1px solid #e2e8f0", borderRadius: 6, fontSize: 14, minWidth: 140 }}
        >
          <option value="">Tất cả role</option>
          <option value="buyer">Người mua</option>
          <option value="seller">Người bán</option>
          <option value="shipper">Shipper</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {/* Table */}
      <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#f8fafc" }}>
              {["Người dùng", "Role", "Trạng thái", "Ngày tạo", "Thao tác"].map((h) => (
                <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontSize: 13, color: "#64748b", fontWeight: 600, borderBottom: "1px solid #f0f0f0" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} style={{ textAlign: "center", padding: 40, color: "#888" }}>Đang tải...</td></tr>
            ) : (data?.results || []).map((user) => {
              const role = ROLE_BADGE[user.role] || { label: user.role, color: "#888" };
              return (
                <tr key={user.id} style={{ borderBottom: "1px solid #f5f5f5" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, color: "#4338ca", fontSize: 14 }}>
                        {user.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>{user.full_name}</div>
                        <div style={{ fontSize: 12, color: "#888" }}>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 10, fontWeight: 600, background: role.color + "18", color: role.color }}>
                      {role.label}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{ fontSize: 12, padding: "3px 9px", borderRadius: 10, fontWeight: 600, background: user.is_active ? "#d1fae5" : "#fee2e2", color: user.is_active ? "#059669" : "#dc2626" }}>
                      {user.is_active ? "Hoạt động" : "Đã khoá"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 13, color: "#64748b" }}>
                    {new Date(user.created_at).toLocaleDateString("vi-VN")}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => toggleMutation.mutate({ userId: user.id, isActive: !user.is_active })}
                      style={{
                        padding: "5px 12px", border: "1px solid", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600,
                        borderColor: user.is_active ? "#fca5a5" : "#86efac",
                        background: user.is_active ? "#fff0f0" : "#f0fdf4",
                        color: user.is_active ? "#dc2626" : "#16a34a",
                      }}
                    >
                      {user.is_active ? "🔒 Khoá" : "🔓 Mở khoá"}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!isLoading && !data?.results?.length && (
          <div style={{ textAlign: "center", padding: 48, color: "#888" }}>Không tìm thấy người dùng</div>
        )}
      </div>
    </div>
  );
}
