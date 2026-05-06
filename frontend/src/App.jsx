import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RequireAuth, RequireRole, GuestOnly } from "./router";

// Layouts
import BuyerLayout from "./components/layout/BuyerLayout";
import SellerLayout from "./components/layout/SellerLayout";
import ShipperLayout from "./components/layout/ShipperLayout";
import AdminLayout from "./components/layout/AdminLayout";

// Auth pages
import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

// Buyer pages
import Home from "./pages/buyer/Home";
import ProductDetail from "./pages/buyer/ProductDetail";
import Cart from "./pages/buyer/Cart";
import Checkout from "./pages/buyer/Checkout";
import OrderList from "./pages/buyer/OrderList";
import OrderDetail from "./pages/buyer/OrderDetail";
import TrackingPage from "./pages/buyer/TrackingPage";
import Profile from "./pages/buyer/Profile";

// Seller pages
import SellerDashboard from "./pages/seller/Dashboard";
import SellerProducts from "./pages/seller/Products";
import SellerProductForm from "./pages/seller/ProductForm";
import SellerOrders from "./pages/seller/Orders";
import SellerInventory from "./pages/seller/Inventory";

// Shipper pages
import ShipperDeliveries from "./pages/shipper/Deliveries";
import ShipperMap from "./pages/shipper/TrackingMap";
import ShipperEarnings from "./pages/shipper/Earnings";

// Admin pages
import AdminOverview from "./pages/admin/Overview";
import AdminUsers from "./pages/admin/Users";
import AdminShops from "./pages/admin/Shops";
import AdminModeration from "./pages/admin/Moderation";

import Unauthorized from "./pages/Unauthorized";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster position="top-right" />
        <Routes>
          {/* ─── Auth ─── */}
          <Route element={<GuestOnly />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* ─── Buyer (public + auth) ─── */}
          <Route element={<BuyerLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/products/:id" element={<ProductDetail />} />
            <Route element={<RequireAuth />}>
              <Route path="/cart" element={<Cart />} />
              <Route path="/checkout" element={<Checkout />} />
              <Route path="/orders" element={<OrderList />} />
              <Route path="/orders/:id" element={<OrderDetail />} />
              <Route path="/orders/:id/tracking" element={<TrackingPage />} />
              <Route path="/profile" element={<Profile />} />
            </Route>
          </Route>

          {/* ─── Seller ─── */}
          <Route element={<RequireRole roles={["seller"]} />}>
            <Route element={<SellerLayout />}>
              <Route path="/seller/dashboard" element={<SellerDashboard />} />
              <Route path="/seller/products" element={<SellerProducts />} />
              <Route path="/seller/products/new" element={<SellerProductForm />} />
              <Route path="/seller/products/:id/edit" element={<SellerProductForm />} />
              <Route path="/seller/orders" element={<SellerOrders />} />
              <Route path="/seller/inventory" element={<SellerInventory />} />
            </Route>
          </Route>

          {/* ─── Shipper ─── */}
          <Route element={<RequireRole roles={["shipper"]} />}>
            <Route element={<ShipperLayout />}>
              <Route path="/shipper/deliveries" element={<ShipperDeliveries />} />
              <Route path="/shipper/map/:deliveryId" element={<ShipperMap />} />
              <Route path="/shipper/earnings" element={<ShipperEarnings />} />
            </Route>
          </Route>

          {/* ─── Admin ─── */}
          <Route element={<RequireRole roles={["admin"]} />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin/overview" element={<AdminOverview />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/shops" element={<AdminShops />} />
              <Route path="/admin/moderation" element={<AdminModeration />} />
            </Route>
          </Route>

          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route path="*" element={<div>404 - Không tìm thấy trang</div>} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
