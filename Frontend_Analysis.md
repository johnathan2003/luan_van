# Frontend Analysis: luan_van & luan_van333

## 📊 Project Overview

Both projects share **identical frontend architecture** with 193 TypeScript/TSX files each. They appear to be the same codebase deployed in two environments or versions.

---

## 🏗️ Architecture

### Tech Stack
- **Framework**: React 18.2.0 + TypeScript
- **State Management**: Redux Toolkit
- **Routing**: React Router v6
- **UI Library**: Material-UI (MUI) v5
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios
- **Real-time Communication**: Socket.io-client
- **Charts**: Recharts
- **Notifications**: React Toastify
- **Build Tool**: Vite
- **Styling**: Emotion (CSS-in-JS)

### Key Dependencies
```
@reduxjs/toolkit: ^2.0.1
react: ^18.2.0
react-router-dom: ^6.21.0
axios: ^1.16.1
date-fns: ^3.0.6
leaflet: ^1.9.4 (Maps)
socket.io-client: ^4.6.1
recharts: ^2.10.3
xlsx: ^0.18.5
```

---

## 📁 Folder Structure

```
frontend/
├── src/
│   ├── App.tsx                 # Root component with ErrorBoundary, Theme, Router
│   ├── main.tsx                # React entry point with Redux Provider
│   ├── Router.tsx              # 215 lines - Route configuration
│   ├── ProtectedRoute.tsx       # Role-based access control
│   │
│   ├── components/             # Reusable UI components
│   │   ├── admin/              # Admin-specific components
│   │   ├── auth/               # Login, Register, RoleSwitcher
│   │   ├── cart/               # CartItem, CartSummary
│   │   ├── common/             # Shared: Header, Footer, Modal, Navbar, etc.
│   │   ├── dispute/            # Dispute resolution UI
│   │   ├── events/             # Events components
│   │   ├── order/              # Order-related components
│   │   ├── product/            # Product display & management
│   │   ├── shipper/            # Shipper-specific components
│   │   └── shop/               # Shop management components
│   │
│   ├── pages/                  # Full-page components (42+ pages)
│   │   ├── Home.tsx            # Homepage (42KB)
│   │   ├── Login.tsx
│   │   ├── Register.tsx
│   │   ├── ProfilePage.tsx     # User profile (45KB)
│   │   ├── ShopProfilePage.tsx # Shop display (45KB)
│   │   ├── PoliciesPage.tsx
│   │   ├── VoucherCenterPage.tsx
│   │   ├── user/               # Buyer pages
│   │   │   ├── ProductListPage.tsx
│   │   │   ├── ProductDetailPage.tsx
│   │   │   ├── CartPage.tsx
│   │   │   ├── CheckoutPage.tsx
│   │   │   ├── PaymentResultPage.tsx
│   │   │   ├── OrderHistoryPage.tsx
│   │   │   ├── OrderDetailPage.tsx
│   │   │   ├── EventsPage.tsx
│   │   │   ├── MyDisputesPage.tsx
│   │   │   └── ChatPage.tsx
│   │   ├── shop/               # Shop owner pages
│   │   │   ├── ShopOverviewPage.tsx
│   │   │   ├── ProductManagementPage.tsx
│   │   │   ├── OrderManagementPage.tsx
│   │   │   ├── EmployeeManagementPage.tsx
│   │   │   ├── AnalyticsPage.tsx
│   │   │   ├── VoucherManagementPage.tsx
│   │   │   ├── BannerAuctionPage.tsx (lazy-loaded)
│   │   │   ├── ChatPage.tsx
│   │   │   └── BuyZoMallRegisterPage.tsx
│   │   ├── admin/              # Admin dashboard pages
│   │   │   ├── AdminOverviewPage.tsx
│   │   │   ├── UserManagementPage.tsx
│   │   │   ├── ApprovalPage.tsx
│   │   │   ├── DeletionApprovalPage.tsx
│   │   │   ├── DisputeResolutionPage.tsx
│   │   │   ├── ShopManagementPage.tsx
│   │   │   ├── ProductAdminPage.tsx
│   │   │   ├── OrderAdminPage.tsx
│   │   │   ├── ShipperManagementPage.tsx
│   │   │   ├── WarehouseManagerAdminPage.tsx
│   │   │   ├── VoucherAdminPage.tsx
│   │   │   ├── BannerAdminPage.tsx
│   │   │   ├── FinancePage.tsx
│   │   │   ├── SystemNotificationPage.tsx
│   │   │   ├── ShippingConfigPage.tsx
│   │   │   ├── MallRequestsPage.tsx
│   │   │   ├── ReportsPage.tsx
│   │   │   ├── FeedbackPage.tsx
│   │   │   ├── ImageLibraryPage.tsx
│   │   │   ├── AuditLogsPage.tsx
│   │   │   └── AuctionManagementPage.tsx (lazy-loaded)
│   │   ├── employee/           # Shop employee pages
│   │   │   ├── EmployeeDashboard.tsx
│   │   │   ├── EmployeeOrdersPage.tsx
│   │   │   ├── EmployeeProductsPage.tsx
│   │   │   └── EmployeeChatPage.tsx
│   │   ├── shipper/            # Delivery person pages
│   │   │   ├── ShipperOverviewPage.tsx
│   │   │   ├── DeliveryListPage.tsx
│   │   │   ├── EarningsPage.tsx
│   │   │   ├── WithdrawalPage.tsx
│   │   │   ├── IncidentsPage.tsx
│   │   │   ├── BenefitsPage.tsx
│   │   │   └── TrackingPage.tsx
│   │   ├── warehouse/          # Warehouse manager pages
│   │   │   ├── WarehouseManagerLayout.tsx
│   │   │   ├── WarehouseOverviewPage.tsx
│   │   │   ├── AllShipmentsPage.tsx
│   │   │   └── IncomingShipmentsPage.tsx
│   │   └── ShipperRegistration.tsx
│   │
│   ├── layouts/                # Layout wrappers
│   │   ├── PublicLayout.tsx
│   │   ├── UserLayout.tsx
│   │   ├── AdminLayout.tsx
│   │   ├── ShopLayout.tsx
│   │   ├── ShipperLayout.tsx
│   │   └── AuthLayout.tsx
│   │
│   ├── store/                  # Redux state management
│   │   ├── store.ts            # Store configuration
│   │   ├── hooks.ts            # useAppDispatch, useAppSelector
│   │   ├── slices/
│   │   │   ├── authSlice.ts
│   │   │   ├── cartSlice.ts
│   │   │   ├── productSlice.ts
│   │   │   ├── notificationSlice.ts
│   │   │   ├── orderSlice.ts
│   │   │   └── uiSlice.ts
│   │   ├── authStore.js
│   │   ├── cartStore.js
│   │   ├── notificationStore.js
│   │   ├── imageLibraryStore.ts
│   │   └── searchTrackingStore.ts
│   │
│   ├── services/               # API calls and business logic
│   │   └── (HTTP client integrations via Axios)
│   │
│   ├── hooks/                  # Custom React hooks
│   │
│   ├── utils/                  # Utility functions
│   │   ├── theme.ts
│   │   ├── eventsStore.ts      # Event data scoped by email
│   │   └── bannerDraftStore.ts # Banner drafts with base64→path migration
│   │
│   ├── types/                  # TypeScript interfaces
│   │
│   ├── mocks/                  # Mock data for testing
│   │
│   ├── styles/                 # Global styles
│   │   └── index.css
│   │
│   ├── super.d.ts              # Type declarations for superadmin
│   ├── vite-env.d.ts           # Vite type definitions
│   └── App main entry point
│
├── legacy/                     # Older versions kept for reference
│   ├── App.legacy.jsx
│   └── routeGuards.legacy.jsx
│
└── package.json

```

---

## 🔐 Authentication & Authorization

### ProtectedRoute System
```typescript
// Role-based routing
<Route element={<ProtectedRoute requiredRole="shop" />}>
  {/* Shop owner routes */}
</Route>

<Route element={<ProtectedRoute requiredRole="admin" />}>
  {/* Admin routes */}
</Route>
```

### User Roles Supported
- **Public** (unauthenticated)
- **User** (buyer)
- **Shop** (shop owner)
- **Employee** (shop staff)
- **Admin** (platform admin)
- **Shipper** (delivery person)
- **Warehouse Manager** (warehouse staff)
- **Superadmin** (system administrator - in `/super/*` routes)

---

## 🛣️ Routing Structure

### Public Routes
```
/                    → Home
/products            → Product listing
/products/:id        → Product detail
/shops/:shopId       → Shop profile
/login               → Login page
/register            → Registration page
/policies            → Policies page
```

### User Routes (authenticated)
```
/profile             → User profile
/cart                → Shopping cart
/checkout            → Checkout
/payment/result      → Payment result
/orders              → Order history
/orders/:id          → Order detail
/vouchers            → Voucher center
/events              → Events
/complaints          → Disputes
/chat                → Messaging
/register-shop       → Shop registration
/register-shipper    → Shipper registration
```

### Shop Routes
```
/shop                → Overview
/shop/products       → Product management
/shop/orders         → Order management
/shop/employees      → Staff management
/shop/analytics      → Analytics
/shop/vouchers       → Voucher management
/shop/auction        → Banner auction (lazy-loaded)
/shop/chat           → Customer chat
/shop/mall           → Mall registration
```

### Admin Routes (20+ pages)
```
/admin               → Dashboard overview
/admin/users         → User management
/admin/shops         → Shop management & approvals
/admin/products      → Product management
/admin/orders        → Order management
/admin/disputes      → Dispute resolution
/admin/finance       → Financial reports
/admin/vouchers      → Voucher management
/admin/banners       → Banner management
/admin/notifications → System notifications
/admin/shippers      → Shipper management
/admin/warehouse-managers → Warehouse staff
/admin/shipping-config    → Shipping configuration
/admin/system-employees   → System employees
/admin/mall-requests      → Mall requests
/admin/reports       → Reports
/admin/feedback      → User feedback
/admin/logs          → Audit logs
/admin/auction       → Auction management (lazy-loaded)
/admin/images        → Image library
```

### Employee Routes
```
/employee            → Dashboard
/employee/orders     → Order management
/employee/products   → Product management
/employee/messages   → Chat
```

### Shipper Routes
```
/shipper/deliveries  → Active deliveries
/shipper/earnings    → Earnings tracking
/shipper/withdrawal  → Withdrawal requests
/shipper/incidents   → Incident reports
/shipper/benefits    → Benefits info
/shipper/tracking/:shipmentId → Tracking
```

### Warehouse Manager Routes
```
/warehouse           → Dashboard
/warehouse/shipments → All shipments
/warehouse/incoming  → Incoming shipments
```

### Superadmin Routes
```
/super/*             → Separate router (not logged)
```

---

## 🎨 Layout System

Each role has a dedicated layout:
- **AuthLayout** - For login/register
- **PublicLayout** - For public pages (with header, footer)
- **UserLayout** - For buyer pages
- **ShopLayout** - For shop owner pages
- **AdminLayout** - For admin pages
- **ShipperLayout** - For delivery person pages
- **WarehouseManagerLayout** - For warehouse staff

---

## 📦 State Management (Redux)

### Store Structure
```typescript
{
  auth: authReducer,              // Authentication state
  cart: cartReducer,              // Shopping cart
  product: productReducer,        // Product data
  notification: notificationReducer, // UI notifications
  order: orderReducer,            // Order state
  ui: uiReducer                   // UI state
}
```

### Hooks
```typescript
useAppDispatch()   // Typed dispatch
useAppSelector()   // Typed selector
```

---

## 🌐 Data Persistence

### localStorage Scoping (by email)
- **Events Store** - Event data scoped to current user
- **Banner Draft Store** - Banner drafts scoped to current user
  - Migrating from base64 to path-based storage

---

## 🎯 Key Features

### Multi-role E-commerce Platform
1. **Buyer experience** - Browse, search, checkout
2. **Shop management** - Product/order/employee management
3. **Analytics** - Dashboard for shops & admins
4. **Disputes** - Resolution system
5. **Chat** - Real-time messaging (Socket.io)
6. **Shipping** - Shipper tracking & management
7. **Warehouse** - Shipment management
8. **Content** - Banner auctions, system notifications
9. **Payments** - Integration support
10. **Vouchers** - Promotion management

---

## 🔄 Data Flow

```
App (ErrorBoundary + Theme)
  ↓
BrowserRouter
  ↓
AppContent (checkAuth + localStorage scoping)
  ↓
Router (route matching + ProtectedRoute)
  ↓
Layout (role-specific)
  ↓
Page Component
  ↓
Reusable Components
  ↓
Redux State Management
  ↓
Axios API Calls
```

---

## ⚡ Performance Optimizations

- **Lazy loading** - BannerAuctionPage, AuctionManagementPage use React.lazy()
- **Suspense** - Loading state while pages load
- **Code splitting** - Vite bundling

---

## 🔗 Integration Points

- **Backend API** - Axios for HTTP calls
- **Real-time** - Socket.io for chat & notifications
- **Maps** - Leaflet for location services
- **Charts** - Recharts for analytics
- **Spreadsheets** - XLSX for exports

---

## 📋 Differences Between Projects

**None identified** - Both `luan_van` and `luan_van333` have:
- Same 193 TypeScript/TSX files
- Identical folder structures
- Same dependencies
- Same routing configuration

Minor date differences suggest `luan_van` is slightly more recent (Jul 20) vs `luan_van333` (Jul 19).

---

## 🚀 Development Commands

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run lint     # Run ESLint
npm run preview  # Preview production build
```

---

## 📝 Notes

- Vietnamese language UI (comments, routes, labels)
- Complex role-based architecture (7 user types)
- Comprehensive admin panel with 20+ management pages
- Multi-layout system for different user experiences
- Migration strategy for localStorage (base64 → path-based)
