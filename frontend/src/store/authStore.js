import { create } from "zustand";
import { authAPI } from "../services/api";

const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem("user") || "null"),
  isAuthenticated: !!localStorage.getItem("access_token"),
  isLoading: false,
  error: null,

  login: async (email, password) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.login({ email, password });
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, isLoading: false });
      return data.user;
    } catch (err) {
      const error = err.response?.data?.non_field_errors?.[0] || "Đăng nhập thất bại";
      set({ error, isLoading: false });
      throw new Error(error);
    }
  },

  register: async (formData) => {
    set({ isLoading: true, error: null });
    try {
      const { data } = await authAPI.register(formData);
      localStorage.setItem("access_token", data.access);
      localStorage.setItem("refresh_token", data.refresh);
      localStorage.setItem("user", JSON.stringify(data.user));
      set({ user: data.user, isAuthenticated: true, isLoading: false });
      return data.user;
    } catch (err) {
      set({ error: "Đăng ký thất bại", isLoading: false });
      throw err;
    }
  },

  logout: async () => {
    const refresh = localStorage.getItem("refresh_token");
    try { await authAPI.logout(refresh); } catch {}
    localStorage.clear();
    set({ user: null, isAuthenticated: false });
  },

  updateUser: (user) => {
    localStorage.setItem("user", JSON.stringify(user));
    set({ user });
  },

  // Helpers
  isBuyer: () => get().user?.role === "buyer",
  isSeller: () => get().user?.role === "seller",
  isShipper: () => get().user?.role === "shipper",
  isAdmin: () => get().user?.role === "admin",
}));

export default useAuthStore;
