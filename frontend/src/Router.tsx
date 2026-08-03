import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'

// Layouts — mỗi thực thể có layout riêng
import { PublicLayout, UserLayout, AdminLayout, ShopLayout, ShipperLayout, AuthLayout } from './layouts'

// ── Auth pages ────────────────────────────────────────────────────────────────
import Login              from './pages/Login'
import Register           from './pages/Register'

// ── Public / chung ────────────────────────────────────────────────────────────
import Home               from './pages/Home.tsx'
import NotFoundPage       from './pages/NotFoundPage'
import ProfilePage        from './pages/ProfilePage'
import ShopRegistration   from './pages/ShopRegistration'
import ShipperRegistration from './pages/ShipperRegistration'
import TrackOrderPage     from './pages/TrackOrderPage'

// ── 👤 User (người mua) pages ─────────────────────────────────────────────────
import ProductListPage    from './pages/user/ProductListPage'
import ProductDetailPage  from './pages/user/ProductDetailPage'
import ShopProfilePage    from './pages/ShopProfilePage'
import CartPage           from './pages/user/CartPage'
import CheckoutPage       from './pages/user/CheckoutPage'
import PaymentResultPage  from './pages/user/PaymentResultPage'
import OrderHistoryPage   from './pages/user/OrderHistoryPage'
import OrderDetailPage    from './pages/user/OrderDetailPage'
import EventsPage         from './pages/user/EventsPage'
import MyDisputesPage     from './pages/user/MyDisputesPage'
import ChatPage           from './pages/user/ChatPage'

// ── 🏪 Shop (chủ shop / nhân viên shop) pages ─────────────────────────────────
import ShopChatPage             from './pages/shop/ChatPage'
import ShopOverviewPage         from './pages/shop/ShopOverviewPage'
import ProductManagementPage    from './pages/shop/ProductManagementPage'
import OrderManagementPage      from './pages/shop/OrderManagementPage'
import EmployeeManagementPage   from './pages/shop/EmployeeManagementPage'
import AnalyticsPage            from './pages/shop/AnalyticsPage'
import ShopRevenueDetailPage    from './pages/shop/ShopRevenueDetailPage'
import VoucherManagementPage    from './pages/shop/VoucherManagementPage'
import BuyZoMallRegisterPage    from './pages/shop/BuyZoMallRegisterPage'
import VoucherCenterPage        from './pages/VoucherCenterPage'

// ── 🏪 Shop lazy pages ────────────────────────────────────────────────────────
const BannerAuctionPage  = React.lazy(() => import('./pages/shop/BannerAuctionPage'))
const AuctionLivePage    = React.lazy(() => import('./pages/shop/AuctionLivePage'))
const WalletPage         = React.lazy(() => import('./pages/shop/WalletPage'))

// ── ⚙️ Admin pages (lazy — bundle lớn) ───────────────────────────────────────
const AdminOverviewPage          = React.lazy(() => import('./pages/admin/AdminOverviewPage'))
const UserManagementPage         = React.lazy(() => import('./pages/admin/UserManagementPage'))
const ApprovalPage               = React.lazy(() => import('./pages/admin/ApprovalPage'))
const DeletionApprovalPage       = React.lazy(() => import('./pages/admin/DeletionApprovalPage'))
const DisputeResolutionPage      = React.lazy(() => import('./pages/admin/DisputeResolutionPage'))
const SystemEmployeePage         = React.lazy(() => import('./pages/admin/SystemEmployeePage'))
const AuditLogsPage              = React.lazy(() => import('./pages/admin/AuditLogsPage'))
const ShopManagementPage         = React.lazy(() => import('./pages/admin/ShopManagementPage'))
const ProductAdminPage           = React.lazy(() => import('./pages/admin/ProductAdminPage'))
const OrderAdminPage             = React.lazy(() => import('./pages/admin/OrderAdminPage'))
const ShipperManagementPage      = React.lazy(() => import('./pages/admin/ShipperManagementPage'))
const WarehouseHierarchyPage     = React.lazy(() => import('./pages/admin/WarehouseHierarchyPage'))
const WarehouseAccountTreePage   = React.lazy(() => import('./pages/admin/WarehouseAccountTreePage'))
const VoucherAdminPage           = React.lazy(() => import('./pages/admin/VoucherAdminPage'))
const BannerAdminPage            = React.lazy(() => import('./pages/admin/BannerAdminPage'))
const FinancePage                = React.lazy(() => import('./pages/admin/FinancePage'))
const SystemNotificationPage     = React.lazy(() => import('./pages/admin/SystemNotificationPage'))
const ShippingConfigPage         = React.lazy(() => import('./pages/admin/ShippingConfigPage'))
const MallRequestsPage           = React.lazy(() => import('./pages/admin/MallRequestsPage'))
const ReportsPage                = React.lazy(() => import('./pages/admin/ReportsPage'))
const FeedbackPage               = React.lazy(() => import('./pages/admin/FeedbackPage'))
const ImageLibraryPage           = React.lazy(() => import('./pages/admin/ImageLibraryPage'))
const AuctionManagementPage      = React.lazy(() => import('./pages/admin/AuctionManagementPage'))

// ── ⚡ Superadmin (nằm ngoài hệ thống, không ghi log) ────────────────────────
import SuperRouter from '@super/SuperRouter'

// ── 👷 Employee pages ─────────────────────────────────────────────────────────
import EmployeeDashboard     from './pages/employee/EmployeeDashboard'
import EmployeeOrdersPage    from './pages/employee/EmployeeOrdersPage'
import EmployeeProductsPage  from './pages/employee/EmployeeProductsPage'
import EmployeeChatPage      from './pages/employee/EmployeeChatPage'

// ── 🚚 Shipper pages ──────────────────────────────────────────────────────────
import ShipperOverviewPage from './pages/shipper/ShipperOverviewPage'
import DeliveryListPage    from './pages/shipper/DeliveryListPage'
import EarningsPage        from './pages/shipper/EarningsPage'
import WithdrawalPage      from './pages/shipper/WithdrawalPage'
import IncidentsPage       from './pages/shipper/IncidentsPage'
import BenefitsPage        from './pages/shipper/BenefitsPage'
import TrackingPage        from './pages/shipper/TrackingPage'

// ── 🏭 Warehouse Manager pages (cũ — tier tổng hợp) ────────────────────────
import WarehouseManagerLayout   from './pages/warehouse/WarehouseManagerLayout'
import WarehouseOverviewPage    from './pages/warehouse/WarehouseOverviewPage'
import WarehouseAccountsPage    from './pages/warehouse/WarehouseAccountsPage'
import AllShipmentsPage         from './pages/warehouse/AllShipmentsPage'
import IncomingShipmentsPage    from './pages/warehouse/IncomingShipmentsPage'

// ── 🏢 Hub Manager (cấp 1 — kho tổng) ────────────────────────────────────
import HubManagerLayout   from './pages/hub/HubManagerLayout'
import HubDashboardPage   from './pages/hub/HubDashboardPage'
import HubDistrictsPage   from './pages/hub/HubDistrictsPage'
import HubShipmentsPage   from './pages/hub/HubShipmentsPage'
import HubAccountsPage    from './pages/hub/HubAccountsPage'
import HubBundlesPage     from './pages/hub/HubBundlesPage'

// ── 🏘️ District Manager (cấp 2 — kho quận) ──────────────────────────────
import DistrictManagerLayout from './pages/district/DistrictManagerLayout'
import DistrictDashboardPage from './pages/district/DistrictDashboardPage'
import DistrictWardsPage     from './pages/district/DistrictWardsPage'
import DistrictShipmentsPage from './pages/district/DistrictShipmentsPage'

// ── 🏠 Ward Manager (cấp 3 — kho phường) ─────────────────────────────────
import WardManagerLayout from './pages/ward/WardManagerLayout'
import WardDashboardPage from './pages/ward/WardDashboardPage'
import WardShippersPage  from './pages/ward/WardShippersPage'
import WardOrdersPage    from './pages/ward/WardOrdersPage'

// ── Helper: bọc page trong layout ─────────────────────────────────────────────
const inPublic   = (el: React.ReactNode) => <PublicLayout>{el}</PublicLayout>
const inUser     = (el: React.ReactNode, sub?: string) => <UserLayout subtitle={sub}>{el}</UserLayout>
const inAdmin    = (el: React.ReactNode) => <AdminLayout>{el}</AdminLayout>
const inShop     = (el: React.ReactNode) => <ShopLayout>{el}</ShopLayout>
const inShipper  = (el: React.ReactNode) => <ShipperLayout>{el}</ShipperLayout>

const Router: React.FC = () => (
  <React.Suspense fallback={<div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontSize:16 }}>Đang tải...</div>}>
  <Routes>
    {/* ── Auth (không layout) ─────────────────────────────────────────────── */}
    <Route path="/login"    element={<AuthLayout title="Đăng nhập"    subtitle="Chào mừng bạn quay trở lại"><Login /></AuthLayout>} />
    <Route path="/register" element={<AuthLayout title="Tạo tài khoản" subtitle="Mua sắm không giới hạn"><Register /></AuthLayout>} />
    <Route path="/track"    element={<TrackOrderPage />} />
    <Route path="/track/:code" element={<TrackOrderPage />} />

    {/* ── Public ──────────────────────────────────────────────────────────── */}
    <Route path="/"             element={inPublic(<Home />)} />
    <Route path="/products"        element={inPublic(<ProductListPage />)} />
    <Route path="/products/:id"   element={inPublic(<ProductDetailPage />)} />
    <Route path="/shops/:shopId"  element={inPublic(<ShopProfilePage />)} />

    {/* ── 👤 User (đăng nhập) ─────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute />}>
      <Route path="/profile"          element={inUser(<ProfilePage />,         'Hồ sơ cá nhân')} />
      <Route path="/cart"             element={inUser(<CartPage />,            'Giỏ hàng')} />
      <Route path="/checkout"         element={inUser(<CheckoutPage />,        'Thanh toán')} />
      <Route path="/payment/result"   element={inUser(<PaymentResultPage />)} />
      <Route path="/orders"           element={inUser(<OrderHistoryPage />,    'Đơn hàng của tôi')} />
      <Route path="/vouchers"         element={inUser(<VoucherCenterPage />,   'Trung tâm voucher')} />
      <Route path="/orders/:id"       element={inUser(<OrderDetailPage />,     'Chi tiết đơn hàng')} />
      <Route path="/events"           element={inUser(<EventsPage />,          'Sự kiện')} />
      <Route path="/complaints"       element={inUser(<MyDisputesPage />,      'Khiếu nại của tôi')} />
      <Route path="/chat"             element={inUser(<ChatPage />,            'Tin nhắn')} />
      <Route path="/register-shop"    element={<AuthLayout title="Đăng ký mở shop" maxWidth={560} bgImage="/background_DKshop.png" align="center" backTo="/"><ShopRegistration /></AuthLayout>} />
      <Route path="/register-shipper" element={<AuthLayout title="Đăng ký làm Shipper" maxWidth={560} bgImage="/background_DKshipper.png" align="center" backTo="/" backColor="#D97706"><ShipperRegistration /></AuthLayout>} />
    </Route>

    {/* ── 🏪 Shop ─────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="shop" />}>
      <Route path="/shop"                  element={inShop(<ShopOverviewPage />)} />
      <Route path="/shop/products"         element={inShop(<ProductManagementPage />)} />
      <Route path="/shop/orders"           element={inShop(<OrderManagementPage />)} />
      <Route path="/shop/employees"        element={inShop(<EmployeeManagementPage />)} />
      <Route path="/shop/analytics"        element={inShop(<AnalyticsPage />)} />
      <Route path="/shop/revenue"          element={inShop(<ShopRevenueDetailPage />)} />
      <Route path="/shop/wallet"           element={inShop(<WalletPage />)} />
      <Route path="/shop/vouchers"         element={inShop(<VoucherManagementPage />)} />
      <Route path="/shop/auction"          element={inShop(<BannerAuctionPage />)} />
      <Route path="/shop/auction-live"     element={inShop(<AuctionLivePage />)} />
      <Route path="/shop/chat"             element={inShop(<ShopChatPage />)} />
      <Route path="/shop/mall"             element={inShop(<BuyZoMallRegisterPage />)} />
      <Route path="/shop/complaints"       element={inShop(<MyDisputesPage />)} />
    </Route>

    {/* ── ⚙️ Admin ─────────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="admin" />}>
      {/* Tổng quan */}
      <Route path="/admin"                       element={inAdmin(<AdminOverviewPage />)} />
      {/* Người dùng */}
      <Route path="/admin/users"                 element={inAdmin(<UserManagementPage />)} />
      <Route path="/admin/users/roles"           element={inAdmin(<UserManagementPage />)} />
      <Route path="/admin/system-employees"      element={inAdmin(<SystemEmployeePage />)} />
      {/* Cửa hàng */}
      <Route path="/admin/shops"                 element={inAdmin(<ShopManagementPage />)} />
      <Route path="/admin/approvals"             element={inAdmin(<ApprovalPage />)} />
      <Route path="/admin/mall-requests"         element={inAdmin(<MallRequestsPage />)} />
      {/* Sản phẩm */}
      <Route path="/admin/products"              element={inAdmin(<ProductAdminPage />)} />
      <Route path="/admin/deletion-requests"     element={inAdmin(<DeletionApprovalPage />)} />
      {/* Đơn hàng */}
      <Route path="/admin/orders"                element={inAdmin(<OrderAdminPage />)} />
      <Route path="/admin/disputes"              element={inAdmin(<DisputeResolutionPage />)} />
      {/* Tài chính */}
      <Route path="/admin/finance"               element={inAdmin(<FinancePage />)} />
      <Route path="/admin/vouchers"              element={inAdmin(<VoucherAdminPage />)} />
      {/* Nội dung / Marketing */}
      <Route path="/admin/banners"               element={inAdmin(<BannerAdminPage />)} />
      <Route path="/admin/auction"               element={inAdmin(<AuctionManagementPage />)} />
      <Route path="/admin/images"                element={inAdmin(<ImageLibraryPage />)} />
      <Route path="/admin/notifications"         element={inAdmin(<SystemNotificationPage />)} />
      {/* Vận hành */}
      <Route path="/admin/shippers"              element={inAdmin(<ShipperManagementPage />)} />
      <Route path="/admin/warehouse-hierarchy"    element={inAdmin(<WarehouseHierarchyPage />)} />
      <Route path="/admin/warehouse-account-tree" element={inAdmin(<WarehouseAccountTreePage />)} />
      <Route path="/admin/shipping-config"       element={inAdmin(<ShippingConfigPage />)} />
      {/* Báo cáo & Log */}
      <Route path="/admin/reports"               element={inAdmin(<ReportsPage />)} />
      <Route path="/admin/feedback"              element={inAdmin(<FeedbackPage />)} />
      <Route path="/admin/logs"                  element={inAdmin(<AuditLogsPage />)} />
    </Route>

    {/* ── 👷 Employee (nhân viên shop) ────────────────────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="employee" />}>
      <Route path="/employee"          element={<EmployeeDashboard />} />
      <Route path="/employee/orders"   element={<EmployeeOrdersPage />} />
      <Route path="/employee/products" element={<EmployeeProductsPage />} />
      <Route path="/employee/messages" element={<EmployeeChatPage />} />
    </Route>

    {/* ── 🚚 Shipper ──────────────────────────────────────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="shipper" />}>
      <Route path="/shipper"                       element={<Navigate to="/shipper/deliveries" replace />} />
      <Route path="/shipper/deliveries"            element={inShipper(<DeliveryListPage />)} />
      <Route path="/shipper/earnings"              element={inShipper(<EarningsPage />)} />
      <Route path="/shipper/withdrawal"            element={inShipper(<WithdrawalPage />)} />
      <Route path="/shipper/incidents"             element={inShipper(<IncidentsPage />)} />
      <Route path="/shipper/benefits"              element={inShipper(<BenefitsPage />)} />
      <Route path="/shipper/tracking/:shipmentId"  element={inShipper(<TrackingPage />)} />
    </Route>

    {/* ── 🏭 Warehouse Manager (cũ — tổng hợp) ────────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="warehouse_manager" />}>
      <Route path="/warehouse" element={<WarehouseManagerLayout />}>
        <Route index element={<WarehouseOverviewPage />} />
        <Route path="shipments" element={<AllShipmentsPage />} />
        <Route path="incoming"  element={<IncomingShipmentsPage />} />
        <Route path="accounts"  element={<WarehouseAccountsPage />} />
      </Route>
    </Route>

    {/* ── 🏢 Hub Manager — kho tổng cấp 1 ──────────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="warehouse_hub_manager|admin" />}>
      <Route path="/hub" element={<HubManagerLayout />}>
        <Route index            element={<HubDashboardPage />} />
        <Route path="districts" element={<HubDistrictsPage />} />
        <Route path="bundles"   element={<HubBundlesPage />} />
        <Route path="shipments" element={<HubShipmentsPage />} />
        <Route path="accounts"  element={<HubAccountsPage />} />
      </Route>
    </Route>

    {/* ── 🏘️ District Manager — kho quận cấp 2 ──────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="warehouse_district_manager|admin" />}>
      <Route path="/district" element={<DistrictManagerLayout />}>
        <Route index            element={<DistrictDashboardPage />} />
        <Route path="wards"     element={<DistrictWardsPage />} />
        <Route path="shipments" element={<DistrictShipmentsPage />} />
      </Route>
    </Route>

    {/* ── 🏠 Ward Manager — kho phường cấp 3 ───────────────────────── */}
    <Route element={<ProtectedRoute requiredRole="warehouse_ward_manager|admin" />}>
      <Route path="/ward" element={<WardManagerLayout />}>
        <Route index            element={<WardDashboardPage />} />
        <Route path="shippers"  element={<WardShippersPage />} />
        <Route path="orders"    element={<WardOrdersPage />} />
      </Route>
    </Route>

    {/* ── ⚡ Superadmin — tách biệt, layout riêng ───────────────────────── */}
    <Route path="/super/*" element={<SuperRouter />} />

    {/* ── 404 ─────────────────────────────────────────────────────────────── */}
    <Route path="*" element={<NotFoundPage />} />
  </Routes>
  </React.Suspense>
)

export default Router
