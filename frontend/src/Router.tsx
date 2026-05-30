import React from 'react'
import { Routes, Route } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

// Layouts — mỗi thực thể có layout riêng
import { PublicLayout, UserLayout, AdminLayout, ShopLayout, ShipperLayout, AuthLayout } from './layouts'

// ── Auth pages ────────────────────────────────────────────────────────────────
import Login              from './pages/Login'
import Register           from './pages/Register'

// ── Public / chung ────────────────────────────────────────────────────────────
import Home               from './pages/Home'
import NotFoundPage       from './pages/NotFoundPage'
import ProfilePage        from './pages/ProfilePage'
import ShopRegistration   from './pages/ShopRegistration'
import ShipperRegistration from './pages/ShipperRegistration'

// ── 👤 User (người mua) pages ─────────────────────────────────────────────────
import ProductListPage    from './pages/user/ProductListPage'
import ProductDetailPage  from './pages/user/ProductDetailPage'
import CartPage           from './pages/user/CartPage'
import CheckoutPage       from './pages/user/CheckoutPage'
import PaymentResultPage  from './pages/user/PaymentResultPage'
import OrderHistoryPage   from './pages/user/OrderHistoryPage'
import OrderDetailPage    from './pages/user/OrderDetailPage'

// ── 🏪 Shop (chủ shop / nhân viên shop) pages ─────────────────────────────────
import ShopOverviewPage         from './pages/shop/ShopOverviewPage'
import ProductManagementPage    from './pages/shop/ProductManagementPage'
import OrderManagementPage      from './pages/shop/OrderManagementPage'
import EmployeeManagementPage   from './pages/shop/EmployeeManagementPage'
import AnalyticsPage            from './pages/shop/AnalyticsPage'
import VoucherManagementPage    from './pages/shop/VoucherManagementPage'

// ── ⚙️ Admin pages ────────────────────────────────────────────────────────────
import AdminOverviewPage        from './pages/admin/AdminOverviewPage'
import UserManagementPage       from './pages/admin/UserManagementPage'
import ApprovalPage             from './pages/admin/ApprovalPage'
import DeletionApprovalPage     from './pages/admin/DeletionApprovalPage'
import DisputeResolutionPage    from './pages/admin/DisputeResolutionPage'
import SystemEmployeePage       from './pages/admin/SystemEmployeePage'
import AuditLogsPage            from './pages/admin/AuditLogsPage'

// ── 🚚 Shipper pages ──────────────────────────────────────────────────────────
import ShipperOverviewPage from './pages/shipper/ShipperOverviewPage'
import DeliveryListPage    from './pages/shipper/DeliveryListPage'
import TrackingPage        from './pages/shipper/TrackingPage'

// ── Helper: bọc page trong layout ─────────────────────────────────────────────
const inPublic  = (el: React.ReactNode) => <PublicLayout>{el}</PublicLayout>
const inUser    = (el: React.ReactNode, sub?: string) => <UserLayout subtitle={sub}>{el}</UserLayout>
const inAdmin   = (el: React.ReactNode) => <AdminLayout>{el}</AdminLayout>
const inShop    = (el: React.ReactNode) => <ShopLayout>{el}</ShopLayout>
const inShipper = (el: React.ReactNode) => <ShipperLayout>{el}</ShipperLayout>

const Router: React.FC = () => (
  <Routes>
    {/* ── Auth (không layout) ─────────────────────────────────────────────── */}
    <Route path="/login"    element={<AuthLayout title="Đăng nhập"    subtitle="Chào mừng bạn quay trở lại"><Login /></AuthLayout>} />
    <Route path="/register" element={<AuthLayout title="Tạo tài khoản" subtitle="Mua sắm không giới hạn"><Register /></AuthLayout>} />

    {/* ── Public ──────────────────────────────────────────────────────────── */}
    <Route path="/"             element={inPublic(<Home />)} />
    <Route path="/products"     element={inPublic(<ProductListPage />)} />
    <Route path="/products/:id" element={inPublic(<ProductDetailPage />)} />

    {/* ── 👤 User (đăng nhập) ─────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute />}>
      <Route path="/profile"          element={inUser(<ProfilePage />,         'Hồ sơ cá nhân')} />
      <Route path="/cart"             element={inUser(<CartPage />,            'Giỏ hàng')} />
      <Route path="/checkout"         element={inUser(<CheckoutPage />,        'Thanh toán')} />
      <Route path="/payment/result"   element={inUser(<PaymentResultPage />)} />
      <Route path="/orders"           element={inUser(<OrderHistoryPage />,    'Đơn hàng của tôi')} />
      <Route path="/orders/:id"       element={inUser(<OrderDetailPage />,     'Chi tiết đơn hàng')} />
      <Route path="/register-shop"    element={inUser(<ShopRegistration />,    'Đăng ký mở shop')} />
      <Route path="/register-shipper" element={inUser(<ShipperRegistration />, 'Đăng ký làm shipper')} />
    </Route>

    {/* ── 🏪 Shop ─────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="shop" />}>
      <Route path="/shop"              element={inShop(<ShopOverviewPage />)} />
      <Route path="/shop/products"     element={inShop(<ProductManagementPage />)} />
      <Route path="/shop/orders"       element={inShop(<OrderManagementPage />)} />
      <Route path="/shop/employees"    element={inShop(<EmployeeManagementPage />)} />
      <Route path="/shop/analytics"    element={inShop(<AnalyticsPage />)} />
      <Route path="/shop/vouchers"     element={inShop(<VoucherManagementPage />)} />
    </Route>

    {/* ── ⚙️ Admin ─────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="admin" />}>
      <Route path="/admin"                    element={inAdmin(<AdminOverviewPage />)} />
      <Route path="/admin/users"              element={inAdmin(<UserManagementPage />)} />
      <Route path="/admin/approvals"          element={inAdmin(<ApprovalPage />)} />
      <Route path="/admin/deletion-requests"  element={inAdmin(<DeletionApprovalPage />)} />
      <Route path="/admin/disputes"           element={inAdmin(<DisputeResolutionPage />)} />
      <Route path="/admin/system-employees"   element={inAdmin(<SystemEmployeePage />)} />
      <Route path="/admin/logs"               element={inAdmin(<AuditLogsPage />)} />
    </Route>

    {/* ── 🚚 Shipper ──────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="shipper" />}>
      <Route path="/shipper"                       element={inShipper(<ShipperOverviewPage />)} />
      <Route path="/shipper/deliveries"            element={inShipper(<DeliveryListPage />)} />
      <Route path="/shipper/tracking/:shipmentId"  element={inShipper(<TrackingPage />)} />
    </Route>

    <Route path="*" element={inPublic(<NotFoundPage />)} />
  </Routes>
)

export default Router
