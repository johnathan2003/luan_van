import axios from "axios";

// Vite dung VITE_ prefix, khong phai REACT_APP_
const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 15000,
});

// Attach JWT token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Auto refresh khi 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refresh = localStorage.getItem("refresh_token");
        const { data } = await axios.post(`${BASE_URL}/api/v1/auth/refresh-token`, {
          refresh_token: refresh,
        });
        localStorage.setItem("access_token", data.access_token);
        original.headers.Authorization = `Bearer ${data.access_token}`;
        return api(original);
      } catch {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// --- Auth (FastAPI endpoints, no trailing slash) ---
export const authAPI = {
  register:      (data)    => api.post("/auth/register", data),
  login:         (data)    => api.post("/auth/login", data),
  logout:        ()        => api.post("/auth/logout"),
  me:            ()        => api.get("/auth/me"),
  refreshToken:  (token)   => api.post("/auth/refresh-token", { refresh_token: token }),
  forgotPassword:(email)   => api.post("/auth/forgot-password", { email }),
};

// --- Users ---
export const userAPI = {
  getProfile:    ()        => api.get("/users/me"),
  updateProfile: (data)    => api.put("/users/me", data),
  uploadAvatar:  (form)    => api.post("/users/me/avatar", form, { headers: { "Content-Type": "multipart/form-data" } }),
};

// --- Products ---
export const productAPI = {
  list:          (params)  => api.get("/products", { params }),
  detail:        (id)      => api.get(`/products/${id}`),
  create:        (data)    => api.post("/products", data, { headers: { "Content-Type": "multipart/form-data" } }),
  update:        (id, data)=> api.put(`/products/${id}`, data),
  delete:        (id)      => api.delete(`/products/${id}`),
  reviews:       (id)      => api.get(`/products/${id}/reviews`),
  addReview:     (id, data)=> api.post(`/products/${id}/reviews`, data),
  categories:    ()        => api.get("/products/categories"),
};

// --- Cart ---
export const cartAPI = {
  get:           ()        => api.get("/carts"),
  addItem:       (data)    => api.post("/carts/items", data),
  updateItem:    (id, qty) => api.put(`/carts/items/${id}`, { quantity: qty }),
  removeItem:    (id)      => api.delete(`/carts/items/${id}`),
  clear:         ()        => api.delete("/carts"),
};

// --- Orders ---
export const orderAPI = {
  list:          (params)  => api.get("/orders", { params }),
  detail:        (id)      => api.get(`/orders/${id}`),
  create:        (data)    => api.post("/orders", data),
  cancel:        (id, reason) => api.post(`/orders/${id}/cancel`, { reason }),
  tracking:      (id)      => api.get(`/shipments/order/${id}`),
};

// --- Shops ---
export const shopAPI = {
  list:          (params)  => api.get("/shop", { params }),
  detail:        (id)      => api.get(`/shop/${id}`),
  myShop:        ()        => api.get("/shop/me"),
  update:        (data)    => api.put("/shop/me", data),
  orders:        (params)  => api.get("/shop/me/orders", { params }),
  confirm:       (id)      => api.post(`/shop/me/orders/${id}/confirm`),
  analytics:     ()        => api.get("/shop/me/analytics"),
};

// --- Payments ---
export const paymentAPI = {
  createMomo:    (data)    => api.post("/payments/momo/create", data),
  createCOD:     (data)    => api.post("/payments/cod/create", data),
  status:        (id)      => api.get(`/payments/${id}`),
};

// --- Shipments ---
export const shipmentAPI = {
  myDeliveries:  ()        => api.get("/shipments/shipper/me"),
  updateStatus:  (id, status) => api.patch(`/shipments/${id}/status`, { status }),
  trackOrder:    (orderId) => api.get(`/shipments/order/${orderId}`),
};

// --- Notifications ---
export const notificationAPI = {
  list:          ()        => api.get("/notifications"),
  markRead:      (id)      => api.patch(`/notifications/${id}/read`),
  markAllRead:   ()        => api.post("/notifications/read-all"),
};

// --- Admin ---
export const adminAPI = {
  overview:      ()        => api.get("/admin/overview"),
  users:         (params)  => api.get("/admin/users", { params }),
  shops:         (params)  => api.get("/admin/shops", { params }),
  pendingShops:  ()        => api.get("/admin/shops/pending"),
  approveShop:   (id)      => api.post(`/admin/shops/${id}/approve`),
  rejectShop:    (id, reason) => api.post(`/admin/shops/${id}/reject`, { reason }),
  pendingShippers: ()      => api.get("/admin/shippers/pending"),
  approveShipper: (id)     => api.post(`/admin/shippers/${id}/approve`),
  auditLogs:     (params)  => api.get("/admin/logs", { params }),
  disputes:      ()        => api.get("/admin/disputes"),
  resolveDispute:(id, data)=> api.post(`/admin/disputes/${id}/resolve`, data),
};
