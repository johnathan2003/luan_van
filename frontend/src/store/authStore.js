import { create } from "zustand";
import { authAPI } from "../services/api";

// Helper: lay current_role tu FastAPI response
function extractRole(user) {
  if (!user) return null;
  return user.current_role?.toLowerCase() || user.roles?.[0]?.role_name?.toLowerCase() || null;
}

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  isAuthenticated: !!localStorage.getItem("access_token"),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      // FastAPI tra ve: { access_token, refresh_token, user: { user_id, email, full_name, roles, current_role } }
      const { data } = await authAPI.login({ email, password });
      const userWithRole = { ...data.user, role: extractRole(data.user) };
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(userWithRole));
      set({ user: userWithRole, isAuthenticated: true, isLoading: false });
      return userWithRole;
    } catch (err) {
      const msg =
        err.response?.data?.detail || err.response?.data?.message || "Dang nhap that bai";
      set({ error: msg, isLoading: false });
      throw new Error(msg);
    }
  },

  register: async (formData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.register(formData);
      const userWithRole = { ...data.user, role: extractRole(data.user) };
      localStorage.setItem("access_token", data.access_token);
      localStorage.setItem("refresh_token", data.refresh_token);
      localStorage.setItem("user", JSON.stringify(userWithRole));
      set({ user: userWithRole, isAuthenticated: true, isLoading: false });
      return userWithRole;
    } catch (err) {
      const msg = err.response?.data?.detail || "Dang ky that bai";
      set({ error: msg, isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    try { await authAPI.logout(); } catch {}
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    localStorage.removeItem("user");
    set({ user: null, isAuthenticated: false, error: null });
  },

  updateUser: (user) => {
    const merged = { ...user, role: extractRole(user) };
    localStorage.setItem("user", JSON.stringify(merged));
    set({ user: merged });
  },

  // Role helpers
  getRole:   () => get().user?.role,
  isBuyer:   () => get().user?.role === "customer",
  isSeller:  () => ["shop_owner", "employee"].includes(get().user?.role),
  isShipper: () => get().user?.role === "shipper",
  isAdmin:   () => get().user?.role === "admin",
}));

export default useAuthStore;
