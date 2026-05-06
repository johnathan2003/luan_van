import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "http://localhost:8000/api/v1",
  headers: { "Content-Type": "application/json" },
});

// Gắn token vào mọi request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto refresh token khi 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("refresh_token");
        const { data } = await axios.post(`${api.defaults.baseURL}/auth/token/refresh/`, { refresh });
        localStorage.setItem("access_token", data.access);
        original.headers.Authorization = `Bearer ${data.access}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// --- Auth ---
export const authAPI = {
  register: (data) => api.post("/auth/register/", data),
  login: (data) => api.post("/auth/login/", data),
  logout: (refresh) => api.post("/auth/logout/", { refresh }),
  profile: () => api.get("/auth/profile/"),
  updateProfile: (data) => api.patch("/auth/profile/", data),
};

// --- Products ---
export const productAPI = {
  list: (params) => api.get("/products/", { params }),
  detail: (id) => api.get(`/products/${id}/`),
  create: (data) => api.post("/products/", data, { headers: { "Content-Type": "multipart/form-data" } }),
  update: (id, data) => api.patch(`/products/${id}/`, data),
  delete: (id) => api.delete(`/products/${id}/`),
  recommendations: () => api.get("/products/recommendations/"),
  reviews: (id) => api.get(`/products/${id}/reviews/`),
  addReview: (id, data) => api.post(`/products/${id}/reviews/`, data),
  categories: () => api.get("/products/categories/"),
};

// --- Cart ---
export const cartAPI = {
  get: () => api.get("/orders/cart/"),
  addItem: (data) => api.post("/orders/cart/add_item/", data),
  removeItem: (productId) => api.delete("/orders/cart/remove_item/", { data: { product_id: productId } }),
  clear: () => api.delete("/orders/cart/clear/"),
};

// --- Orders ---
export const orderAPI = {
  list: (params) => api.get("/orders/", { params }),
  detail: (id) => api.get(`/orders/${id}/`),
  create: (data) => api.post("/orders/", data),
  confirm: (id) => api.post(`/orders/${id}/confirm/`),
  cancel: (id, reason) => api.post(`/orders/${id}/cancel/`, { reason }),
  markDelivered: (id) => api.post(`/orders/${id}/mark_delivered/`),
  tracking: (id) => api.get(`/orders/${id}/tracking/`),
};

// --- Shops ---
export const shopAPI = {
  list: (params) => api.get("/shops/", { params }),
  detail: (id) => api.get(`/shops/${id}/`),
  create: (data) => api.post("/shops/", data),
  update: (id, data) => api.patch(`/shops/${id}/`, data),
  myShop: () => api.get("/shops/my_shop/"),
};

// --- Analytics ---
export const analyticsAPI = {
  sellerDashboard: () => api.get("/analytics/seller/dashboard/"),
  revenueChart: (days) => api.get("/analytics/seller/revenue/", { params: { days } }),
  adminOverview: () => api.get("/analytics/admin/overview/"),
};

// --- Notifications ---
export const notificationAPI = {
  list: () => api.get("/notifications/"),
  markRead: (id) => api.patch(`/notifications/${id}/`, { is_read: true }),
  markAllRead: () => api.post("/notifications/mark_all_read/"),
};