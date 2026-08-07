/**
 * super/frontend/pages/SystemDocsPage.tsx
 * -----------------------------------------
 * Trang tài liệu hệ thống cho Superadmin.
 * Giải thích kiến trúc + luồng hoạt động code với code snippets thật.
 * Dùng để trình bày với giảng viên.
 */
import React, { useState } from 'react'

// ── Types ─────────────────────────────────────────────────────────────────────

type Layer = 'user' | 'frontend' | 'backend' | 'db' | 'external'

interface Step {
  id: string
  title: string
  desc: string
  layer: Layer
  file?: string
  code?: string
}

interface Topic {
  id: string
  icon: string
  title: string
  desc: string
  steps: Step[]
}

// ── Color map ─────────────────────────────────────────────────────────────────

const LAYER_COLOR: Record<Layer, { bg: string; text: string; label: string }> = {
  user:     { bg: '#7c3aed22', text: '#a78bfa', label: '👤 User' },
  frontend: { bg: '#0369a122', text: '#38bdf8', label: '⚛️  Frontend' },
  backend:  { bg: '#15803d22', text: '#4ade80', label: '🐍 Backend' },
  db:       { bg: '#92400022', text: '#fbbf24', label: '🗄️  Database' },
  external: { bg: '#9f123422', text: '#fb7185', label: '🌐 External' },
}

// ── Topics Data ───────────────────────────────────────────────────────────────

const TOPICS: Topic[] = [
  // ── 1. Architecture ───────────────────────────────────────────────────────
  {
    id: 'arch',
    icon: '🏗️',
    title: 'Kiến trúc tổng quan',
    desc: 'Tech stack, cấu trúc thư mục, các lớp hệ thống',
    steps: [
      {
        id: 'fe', title: 'Frontend — React SPA', layer: 'frontend',
        file: 'frontend/src/main.tsx',
        desc: 'Single Page Application dùng React 18 + TypeScript + Vite. Code-splitting theo route. Axios API client với JWT interceptor tự động. State management qua Zustand stores và React Context.',
        code:
`// frontend/src/main.tsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />           // ← Router + ThemeProvider + NotificationProvider
  </React.StrictMode>
)

// Cấu trúc thư mục frontend/src/
// ├── pages/          ← 40+ trang theo role (user/, admin/, shop/, shipper/)
// ├── components/     ← UI components tái sử dụng
// ├── layouts/        ← Layout riêng cho từng role
// ├── hooks/          ← useAuth, useCart, useNotifications...
// ├── services/api.ts ← Axios instance + interceptors
// └── utils/          ← localStorage, constants, helpers`,
      },
      {
        id: 'be', title: 'Backend — FastAPI', layer: 'backend',
        file: 'backend/app/main.py',
        desc: 'Python FastAPI + Uvicorn ASGI server. Route groups theo tính năng. Middleware stack: CORS, logging, error handling. WebSocket qua Socket.IO (python-socketio). Tích hợp Cloudinary cho upload ảnh.',
        code:
`# backend/app/main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from socketio import ASGIApp

app = FastAPI(title="E-Commerce API")
app.add_middleware(CORSMiddleware, allow_origins=["*"])

# Route groups
app.include_router(auth_router,      prefix="/api/v1/auth")
app.include_router(products_router,  prefix="/api/v1/products")
app.include_router(orders_router,    prefix="/api/v1/orders")
app.include_router(chat_router,      prefix="/api/v1/chat")
app.include_router(wallet_router,    prefix="/api/v1/wallet")
# ... 15 route groups

# Cấu trúc backend/app/
// ├── models/    ← SQLAlchemy ORM models (24 files)
// ├── routes/    ← FastAPI route handlers
// ├── services/  ← Business logic layer
// ├── schemas/   ← Pydantic request/response models
// ├── middleware/ ← auth.py, permission.py, logging.py
// └── websocket/ ← Socket.IO connection manager + handlers`,
      },
      {
        id: 'db', title: 'Database — PostgreSQL', layer: 'db',
        file: 'backend/app/database.py',
        desc: 'PostgreSQL với SQLAlchemy 2.0 ORM. Connection pool size=10, max_overflow=20. 55+ bảng phủ toàn bộ nghiệp vụ: users, products, orders, chat, wallet, banners, warehouses, shipments...',
        code:
`# backend/app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,    # ← tự reconnect nếu connection chết
    pool_recycle=300,      # ← recycle sau 5 phút
    pool_size=10,          # ← tối đa 10 connection đồng thời
    max_overflow=20,       # ← cho phép thêm 20 khi bận
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def get_db():
    """FastAPI dependency — inject DB session vào mọi route."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()  # ← luôn đóng sau request`,
      },
      {
        id: 'super', title: 'Superadmin — Tách biệt hoàn toàn', layer: 'backend',
        file: 'super/',
        desc: 'Khu vực superadmin ở thư mục riêng super/. Auth riêng không dùng DB user. Backend Python package riêng mount vào FastAPI chính. Frontend React cũng tách biệt.',
        code:
`// Cấu trúc super/
// ├── frontend/
// │   ├── SuperRouter.tsx     ← Routes /super/*
// │   ├── SuperLayout.tsx     ← Dark sidebar layout
// │   ├── superApi.ts         ← Axios với super_token
// │   └── pages/
// │       ├── SuperDashboard.tsx
// │       ├── DBViewerPage.tsx  ← MySQL-like table viewer
// │       ├── ERDPage.tsx       ← Interactive ERD diagram
// │       └── SystemDocsPage.tsx ← Trang này
// └── backend/
//     ├── auth.py             ← Login riêng
//     ├── middleware.py       ← require_super()
//     ├── router.py           ← Mount tất cả super routes
//     └── routes/
//         ├── db_viewer.py    ← inspect(engine) — đọc schema thật
//         ├── products.py
//         ├── users.py
//         └── orders.py`,
      },
    ],
  },

  // ── 2. Auth ───────────────────────────────────────────────────────────────
  {
    id: 'auth',
    icon: '🔐',
    title: 'Xác thực (JWT)',
    desc: 'Đăng ký → Đăng nhập → JWT access/refresh token → Auto-refresh',
    steps: [
      {
        id: '1', title: '1. User gửi credentials', layer: 'frontend',
        file: 'frontend/src/components/auth/LoginForm.tsx',
        desc: 'User nhập email + password. Component gọi API.post() đến endpoint login. Sau khi nhận token → lưu vào localStorage và cập nhật auth state.',
        code:
`// LoginForm.tsx
const handleLogin = async (e: FormEvent) => {
  e.preventDefault()
  const res = await API.post('/api/v1/auth/login', { email, password })

  // Lưu token vào localStorage
  setToken(res.data.access_token)
  setRefreshToken(res.data.refresh_token)

  // Cập nhật global auth state
  setUser(res.data.user)

  // Điều hướng theo role hiện tại
  const role = res.data.user.current_role
  navigate(role === 'admin' ? '/admin' : role === 'shop_owner' ? '/shop' : '/')
}`,
      },
      {
        id: '2', title: '2. Backend verify & tạo JWT', layer: 'backend',
        file: 'backend/app/routes/auth.py + services/auth_service.py',
        desc: 'FastAPI nhận request. auth_service.login_user() kiểm tra email tồn tại, verify bcrypt hash. Tạo JWT access_token (15 phút) + refresh_token (7 ngày). Trả về user info + roles.',
        code:
`# routes/auth.py
@router.post("/login")
def login(data: UserLogin, db: Session = Depends(get_db)):
    result = login_user(db, data)   # ← services/auth_service.py
    user = result["user"]
    return {
        "access_token":  result["access_token"],   # expires 15 min
        "refresh_token": result["refresh_token"],  # expires 7 days
        "user": {
            "user_id":      user.user_id,
            "email":        user.email,
            "roles":        [...],   # all roles user owns
            "current_role": "user",  # active role
        }
    }

# services/auth_service.py
def login_user(db, data: UserLogin):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(401, "Email hoặc mật khẩu không đúng")
    return {
        "user":          user,
        "access_token":  create_access_token({"sub": str(user.user_id)}),
        "refresh_token": create_refresh_token({"sub": str(user.user_id)}),
    }`,
      },
      {
        id: '3', title: '3. Axios interceptor tự động đính token', layer: 'frontend',
        file: 'frontend/src/services/api.ts',
        desc: 'Mọi HTTP request từ frontend đều tự động đính Bearer token. Nếu nhận 401 (token hết hạn) → tự gọi /refresh-token rồi retry request gốc. Nếu refresh cũng fail → logout.',
        code:
`// frontend/src/services/api.ts
const API = axios.create({ baseURL: 'http://localhost:8000' })

// ① Đính token vào MỌI request
API.interceptors.request.use((config) => {
  const token = getToken()  // localStorage.getItem('token')
  if (token) config.headers.Authorization = \`Bearer \${token}\`
  return config
})

// ② Auto-refresh khi nhận 401
API.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true
      const refreshToken = getRefreshToken()
      const res = await axios.post('/api/v1/auth/refresh-token',
                                   { refresh_token: refreshToken })
      setToken(res.data.access_token)
      original.headers.Authorization = \`Bearer \${res.data.access_token}\`
      return API(original)   // ← retry request gốc với token mới
    }
    return Promise.reject(error)
  }
)`,
      },
      {
        id: '4', title: '4. Backend guard — require_role()', layer: 'backend',
        file: 'backend/app/middleware/auth.py',
        desc: 'Mọi route cần xác thực đều dùng Depends(get_current_user). Các route cần role cụ thể dùng Depends(require_role("admin")). Decorator kiểm tra user_roles trước khi vào handler.',
        code:
`# backend/app/middleware/auth.py
security = HTTPBearer()

def get_current_user(
    credentials = Depends(security),
    db: Session = Depends(get_db)
) -> User:
    token = credentials.credentials
    payload = decode_token(token)           # verify JWT signature + expiry
    if not payload or payload.get("type") != "access":
        raise HTTPException(401, "Token không hợp lệ hoặc đã hết hạn")

    user = db.query(User).filter(User.user_id == int(payload["sub"])).first()
    if not user:
        raise HTTPException(401, "Không tìm thấy user")
    return user

def require_role(*roles: str):
    """Factory tạo dependency check role."""
    def _checker(user: User = Depends(get_current_user)) -> User:
        user_roles = {ur.role.role_name for ur in user.user_roles if ur.status == "active"}
        if not any(role in user_roles for role in roles):
            raise HTTPException(403, f"Cần role: {', '.join(roles)}")
        return user
    return _checker

# Dùng trong route:
@router.get("/admin/stats")
def get_stats(user = Depends(require_role("admin", "superadmin"))):
    ...`,
      },
      {
        id: '5', title: '5. Frontend ProtectedRoute', layer: 'frontend',
        file: 'frontend/src/ProtectedRoute.tsx',
        desc: 'React component bọc các route cần đăng nhập. Kiểm tra token + role từ auth state. Redirect đến /login nếu chưa đăng nhập, /unauthorized nếu sai role.',
        code:
`// frontend/src/ProtectedRoute.tsx
const ProtectedRoute: React.FC<{ requiredRole?: string }> = ({ requiredRole }) => {
  const user = useAuthStore(s => s.user)

  // Chưa đăng nhập → về login
  if (!user) return <Navigate to="/login" replace />

  // Sai role → unauthorized
  if (requiredRole) {
    const hasRole = user.roles.some(r => r.role_name === requiredRole)
    if (!hasRole) return <Navigate to="/unauthorized" replace />
  }

  return <Outlet />   // ← render children routes
}

// Router.tsx dùng như sau:
<Route element={<ProtectedRoute requiredRole="admin" />}>
  <Route path="/admin/*" element={<AdminLayout />} />
</Route>`,
      },
    ],
  },

  // ── 3. Order ──────────────────────────────────────────────────────────────
  {
    id: 'order',
    icon: '🛍️',
    title: 'Luồng đặt hàng',
    desc: 'Xem sản phẩm → Giỏ hàng → Đặt hàng → Thanh toán → Giao hàng',
    steps: [
      {
        id: '1', title: '1. Xem sản phẩm & thêm vào giỏ', layer: 'frontend',
        file: 'frontend/src/pages/user/ProductDetailPage.tsx',
        desc: 'ProductDetailPage hiển thị gallery ảnh nhiều ảnh với zoom lens (scale 4x). User chọn số lượng rồi click "Thêm vào giỏ". trackViewedProduct() ghi lại lịch sử xem để gợi ý.',
        code:
`// ProductDetailPage.tsx
// Zoom lens — ZOOM_SCALE=4, LENS_SIZE=200px
const handleMouseMove = (e: React.MouseEvent) => {
  const rect = imgContainerRef.current!.getBoundingClientRect()
  const x = ((e.clientX - rect.left) / rect.width) * 100
  const y = ((e.clientY - rect.top) / rect.height) * 100
  setLensPos({ x, y })
}

// Thêm vào giỏ
const handleAddToCart = async () => {
  await API.post('/api/v1/carts', {
    product_id: product.product_id,
    quantity
  })
  toast.success('Đã thêm vào giỏ hàng!')
}

// Track xem để gợi ý
useEffect(() => {
  trackViewedProduct(Number(id))      // ← searchTrackingStore.ts
  trackMissionEvent('view_product')   // ← gamification
}, [id])`,
      },
      {
        id: '2', title: '2. Checkout & tạo đơn hàng', layer: 'backend',
        file: 'backend/app/routes/orders.py',
        desc: 'POST /api/v1/orders → create_order() tạo Order record + OrderItems từ giỏ hàng. Tính final_price sau khi áp voucher. Lưu địa chỉ giao hàng. Thông báo shop ngay lập tức.',
        code:
`# backend/app/routes/orders.py
@router.post("", status_code=201)
def place_order(
    data: OrderCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    order = create_order(db, current_user.user_id, data)
    # ↑ services/order_service.py:
    #   - Tạo Order + OrderItems từ cart items
    #   - Tính total_price, áp discount/voucher → final_price
    #   - Lưu delivery_address snapshot

    # Thông báo shop ngay
    create_notification(db, order.shop_id,
        title="Đơn hàng mới",
        content=f"Bạn có đơn hàng mới #{order.order_id}",
        type="new_order"
    )
    return {"order_id": order.order_id, "final_price": order.final_price}`,
      },
      {
        id: '3', title: '3. Tích hợp thanh toán MoMo/VNPay', layer: 'backend',
        file: 'backend/app/routes/orders.py + services/payment_service.py',
        desc: 'Nếu user chọn thanh toán online → gọi payment service → nhận payment_url → redirect user đến trang thanh toán của cổng. Callback URL verify signature rồi cập nhật payment_status.',
        code:
`# Trong place_order() — sau khi tạo order:
result = {"order_id": order.order_id, "status": order.order_status}

if data.payment_method == "momo":
    momo = create_momo_payment(db, order.order_id, int(order.final_price))
    result["payment_url"] = momo.get("payUrl")
    # → User được redirect đến trang MoMo để quét QR

elif data.payment_method == "vnpay":
    result["payment_url"] = create_vnpay_url(order.order_id, int(order.final_price))
    # → User được redirect đến trang VNPay

# Sau khi thanh toán thành công, cổng callback về:
# POST /api/v1/payments/momo/callback hoặc /vnpay/callback
# → verify signature → update order.payment_status = "paid"
# → WebSocket notify user: "Thanh toán thành công!"`,
      },
      {
        id: '4', title: '4. WebSocket realtime notification', layer: 'backend',
        file: 'backend/app/websocket/handlers.py',
        desc: 'send_to_user() emit Socket.IO event đến room = user_id. Cả user và shop nhận notification ngay lập tức. Frontend lắng nghe event "notification" để hiển thị toast.',
        code:
`# backend/app/websocket/handlers.py
async def notify_order_created(user_id: int, shop_id: int, order_data: dict):
    # Thông báo cho user
    await send_to_user(user_id, "notification", {
        "type":    "order_created",
        "title":   "Đơn hàng đã được đặt",
        "message": f"Đơn #{order_data['order_id']} tạo thành công",
        "data":    order_data,
    })
    # Thông báo cho shop
    await send_to_user(shop_id, "notification", {
        "type":    "new_order",
        "title":   "Đơn hàng mới",
        "message": f"Bạn có đơn hàng mới #{order_data['order_id']}",
    })

# connection_manager.py
async def send_to_user(user_id: int, event: str, data: dict):
    await sio.emit(event, data, room=str(user_id))
    # ↑ mỗi user join room = str(user_id) khi kết nối WS`,
      },
      {
        id: '5', title: '5. Shipper giao hàng & hoàn thành', layer: 'backend',
        file: 'backend/app/routes/shipments.py + services/shipment_service.py',
        desc: 'Shipper nhận đơn → update status "in_transit" → WS notify user tracking. User confirm đã nhận → order status "completed" → đánh giá. Shop nhận tiền sau khi hoàn thành.',
        code:
`# Shipper update trạng thái giao hàng
@router.patch("/{shipment_id}/status")
def update_status(shipment_id, data, shipper = Depends(require_role("shipper")), db = Depends(get_db)):
    shipment = get_shipment(db, shipment_id)
    shipment.shipment_status = data.status  # picking → in_transit → delivered

    if data.status == "in_transit":
        await notify_order_shipping(order.user_id, shipper_id, order_id)

    db.commit()

# User xác nhận đã nhận hàng
@router.post("/{order_id}/confirm-received")
def confirm_received(order_id, user = Depends(get_current_user), db = Depends(get_db)):
    order = get_order(db, order_id)
    order.order_status = "completed"
    # → Shop có thể nhận thanh toán về ví
    db.commit()`,
      },
    ],
  },

  // ── 4. Chat ───────────────────────────────────────────────────────────────
  {
    id: 'chat',
    icon: '💬',
    title: 'Chat thời gian thực',
    desc: 'WebSocket — User ↔ Shop/Nhân viên, routing thông minh theo assignment',
    steps: [
      {
        id: '1', title: '1. Kết nối Socket.IO', layer: 'frontend',
        file: 'frontend/src/components/common/ChatWidget.tsx',
        desc: 'ChatWidget dùng socket.io-client. Khi mount → connect với Bearer token → join room theo user_id. Lắng nghe các events: new_message, new_chat_message, notification.',
        code:
`// ChatWidget.tsx
const socket = io(SOCKET_URL, {
  auth: { token: getToken() }
})

socket.on('connect', () => {
  socket.emit('join', { user_id: currentUser.user_id })
  // ↑ Backend join room = str(user_id)
})

socket.on('new_message', (msg: Message) => {
  setMessages(prev => [...prev, msg])
  scrollToBottom()
})

socket.on('new_chat_message', (data) => {
  // Nhân viên shop nhận được khi có user nhắn
  showNotificationBadge(data.conversation_id)
})`,
      },
      {
        id: '2', title: '2. Tạo/lấy conversation', layer: 'backend',
        file: 'backend/app/routes/chat.py',
        desc: 'POST /api/v1/chat/conversations → tìm conversation đã có giữa user và shop, hoặc tạo mới. Một cặp (user, shop) chỉ có 1 conversation. Trả về conversation_id để dùng cho các message.',
        code:
`# backend/app/routes/chat.py
@router.post("/conversations")
def create_or_get_conversation(
    data: CreateConvRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    conv = chat_service.get_or_create_conversation(
        db,
        user_id=current_user.user_id,
        shop_id=data.shop_id,
    )
    return ConversationOut.from_orm(conv)

# services/chat_service.py
def get_or_create_conversation(db, user_id, shop_id):
    existing = db.query(Conversation).filter_by(
        user_id=user_id, shop_id=shop_id
    ).first()
    if existing:
        return existing
    conv = Conversation(user_id=user_id, shop_id=shop_id)
    db.add(conv)
    db.commit()
    return conv`,
      },
      {
        id: '3', title: '3. Gửi tin nhắn + routing thông minh', layer: 'backend',
        file: 'backend/app/routes/chat.py',
        desc: 'Routing logic: nếu conversation chưa assign NV → thông báo TẤT CẢ NV có quyền message:read (emit to room). Nếu đã assign → chỉ đúng NV đó. Khi NV reply → auto-assign conversation cho NV đó.',
        code:
`# Routing logic trong chat.py (docstring đầu file):
# - User gửi, conv CHƯA có NV:
#     → thông báo owner 1 LẦN (owner_notified flag)
#     → socket new_chat_message → TẤT CẢ NV có quyền message:read
# - User gửi, conv ĐÃ có NV:
#     → socket new_chat_message → đúng NV đó
# - Shop/NV gửi cho khách:
#     → socket new_message → user
#     → Nếu người gửi là NV → auto-assign conversation

from app.websocket.connection_manager import send_to_user, send_to_room

# Notify tất cả NV:
await send_to_room(f"shop_{shop_id}_employees", "new_chat_message", {...})

# Notify đúng NV đã assign:
await send_to_user(assigned_employee_user_id, "new_chat_message", {...})`,
      },
      {
        id: '4', title: '4. WebSocket Connection Manager', layer: 'backend',
        file: 'backend/app/websocket/connection_manager.py',
        desc: 'Dùng python-socketio. Mỗi user join room = str(user_id). Nhân viên shop join thêm room "shop_{shop_id}_employees". send_to_user() và send_to_room() là 2 primitive cốt lõi.',
        code:
`# backend/app/websocket/connection_manager.py
import socketio
sio = socketio.AsyncServer(cors_allowed_origins="*", async_mode="asgi")

@sio.event
async def connect(sid, environ, auth):
    token = auth.get("token")
    user = verify_token_get_user(token)
    # Mỗi user join room theo user_id
    await sio.enter_room(sid, str(user.user_id))

    # Nhân viên join thêm room shop_employees
    if is_employee(user):
        shop_id = get_shop_id(user)
        await sio.enter_room(sid, f"shop_{shop_id}_employees")

async def send_to_user(user_id: int, event: str, data: dict):
    await sio.emit(event, data, room=str(user_id))

async def send_to_room(room: str, event: str, data: dict):
    await sio.emit(event, data, room=room)`,
      },
    ],
  },

  // ── 5. RBAC ───────────────────────────────────────────────────────────────
  {
    id: 'rbac',
    icon: '🔑',
    title: 'Phân quyền (RBAC)',
    desc: '6 roles, multi-role user, employee permissions chi tiết',
    steps: [
      {
        id: '1', title: '1. Hệ thống Role', layer: 'db',
        file: 'backend/app/models/user.py',
        desc: 'Hệ thống có 6 role: user, shop_owner, employee, shipper, admin, superadmin. Một user có thể giữ nhiều role cùng lúc (VD: vừa là user mua hàng vừa là shop_owner). current_role = role đang active trong session.',
        code:
`# backend/app/models/user.py

class Role(Base):
    __tablename__ = "roles"
    role_id   = Column(Integer, primary_key=True)
    role_name = Column(String)   # "user" | "shop_owner" | "employee"
                                 # "shipper" | "admin" | "superadmin"

class UserRole(Base):
    __tablename__ = "user_roles"
    user_id      = Column(Integer, ForeignKey("users.user_id"))
    role_id      = Column(Integer, ForeignKey("roles.role_id"))
    current_role = Column(Boolean, default=False)  # ← role đang dùng
    status       = Column(String, default="active")

# Ví dụ: user Nguyễn Văn A có thể có 2 rows:
# (user_id=5, role="user",       current_role=False)
# (user_id=5, role="shop_owner", current_role=True)  ← đang ở mode shop`,
      },
      {
        id: '2', title: '2. require_role() & require_permission()', layer: 'backend',
        file: 'backend/app/middleware/auth.py + permission.py',
        desc: 'require_role() check role-level (coarse-grained). Với nhân viên shop còn có require_permission() check từng quyền cụ thể như "message:read", "order:manage", "product:edit".',
        code:
`# middleware/auth.py — kiểm tra role
def require_role(*roles: str):
    def _checker(user: User = Depends(get_current_user)) -> User:
        user_roles = {ur.role.role_name for ur in user.user_roles if ur.status == "active"}
        if not any(role in user_roles for role in roles):
            raise HTTPException(403, f"Cần role: {', '.join(roles)}")
        return user
    return _checker

# Dùng trong route:
@router.delete("/products/{id}")  # chỉ admin hoặc shop_owner mới được xóa
def delete_product(id, user = Depends(require_role("admin", "shop_owner"))):
    ...

@router.get("/admin/users")       # chỉ admin
def list_users(user = Depends(require_role("admin"))):
    ...`,
      },
      {
        id: '3', title: '3. Employee Permission (fine-grained)', layer: 'db',
        file: 'backend/app/models/shop.py',
        desc: 'Nhân viên shop có quyền chi tiết hơn role. Shop owner chọn từng quyền khi tạo nhân viên: message:read, order:manage, product:edit... Mỗi endpoint check quyền trước khi thực thi.',
        code:
`# models/shop.py
class EmployeeRolePermission(Base):
    __tablename__ = "employee_role_permissions"
    employee_id     = Column(Integer, ForeignKey("shop_employees.employee_id"))
    permission_code = Column(String)   # "message:read" | "order:manage"
                                       # "product:edit" | "report:view"

# Kiểm tra trong route:
def _get_employee_for_shop(db, user_id, shop_id):
    emp = db.query(ShopEmployee).filter_by(
        user_id=user_id, shop_id=shop_id, status="active"
    ).first()
    # Check permission
    has_perm = db.query(EmployeeRolePermission).filter_by(
        employee_id=emp.employee_id,
        permission_code="message:read"
    ).first()
    return emp if has_perm else None`,
      },
      {
        id: '4', title: '4. Frontend RoleSwitcher', layer: 'frontend',
        file: 'frontend/src/components/auth/RoleSwitcher.tsx',
        desc: 'User đa role có thể switch role trong session mà không cần logout. Gọi API cập nhật current_role → đổi layout, sidebar, routes hiển thị theo role mới.',
        code:
`// RoleSwitcher.tsx
const handleSwitchRole = async (roleName: string) => {
  // Cập nhật current_role trên server
  await API.post('/api/v1/users/switch-role', { role: roleName })

  // Cập nhật local state
  updateCurrentRole(roleName)

  // Điều hướng đến dashboard của role mới
  const rolePaths: Record<string, string> = {
    user:        '/',
    shop_owner:  '/shop',
    admin:       '/admin',
    shipper:     '/shipper',
    employee:    '/employee',
  }
  navigate(rolePaths[roleName] ?? '/')
}

// Layouts riêng: AdminLayout, ShopLayout, UserLayout, ShipperLayout
// Mỗi layout có Sidebar + Header riêng phù hợp role`,
      },
    ],
  },

  // ── 6. Banner Auction ─────────────────────────────────────────────────────
  {
    id: 'auction',
    icon: '🏷️',
    title: 'Banner & Đấu giá',
    desc: 'Shop nộp banner → Admin duyệt → Live bidding WS → Ví nội bộ',
    steps: [
      {
        id: '1', title: '1. Shop nộp banner', layer: 'frontend',
        file: 'frontend/src/pages/admin/BannerAdminPage.tsx',
        desc: 'Shop upload ảnh banner lên Cloudinary rồi submit form gồm: title, mô tả, target URL, ảnh preview. Admin nhận notification và vào trang duyệt banner.',
        code:
`// BannerAdminPage.tsx — shop side
const handleSubmitBanner = async () => {
  // Upload ảnh lên Cloudinary trước
  const imageUrls = await uploadToCloudinary(selectedFiles)

  // Submit banner
  await API.post('/api/v1/banners/submissions', {
    title:       bannerTitle,
    description: bannerDesc,
    image_urls:  imageUrls,
    target_url:  targetUrl,
  })
}

// Admin nhận banner submissions:
// GET /api/v1/banners/submissions?status=pending
// PATCH /api/v1/banners/submissions/{id}/approve → tạo auction session`,
      },
      {
        id: '2', title: '2. Tạo phiên đấu giá', layer: 'backend',
        file: 'backend/app/routes/banners.py',
        desc: 'Admin approve banner → tự động tạo AuctionSession với thời gian bắt đầu/kết thúc, giá khởi điểm, giá bước nhảy. Tất cả shop được thông báo có phiên mới.',
        code:
`# backend/app/routes/banners.py
@router.post("/sessions")
def create_auction_session(
    data: AuctionSessionCreate,
    admin = Depends(require_role("admin")),
    db: Session = Depends(get_db),
):
    session = AuctionSession(
        banner_slot_id  = data.banner_slot_id,
        start_time      = data.start_time,
        end_time        = data.end_time,
        starting_price  = data.starting_price,  # giá khởi điểm
        min_bid_step    = data.min_bid_step,     # bước nhảy tối thiểu
        status          = "scheduled",
    )
    db.add(session)
    db.commit()
    # Notify tất cả shop_owner
    notify_all_shops("Phiên đấu giá banner mới sắp mở!")
    return session`,
      },
      {
        id: '3', title: '3. Live bidding — WebSocket', layer: 'backend',
        file: 'backend/app/routes/banners.py',
        desc: 'Shops kết nối WS room "auction_{session_id}". Đặt giá phải > current_price + min_bid_step. Server broadcast new_bid đến tất cả → tất cả shop thấy realtime giá cao nhất.',
        code:
`@router.post("/sessions/{session_id}/bids")
async def place_bid(
    session_id: int, data: BidCreate,
    user = Depends(require_role("shop_owner")),
    db: Session = Depends(get_db),
):
    session = get_active_session(db, session_id)
    if data.amount < session.current_price + session.min_bid_step:
        raise HTTPException(400, "Giá đặt phải cao hơn giá hiện tại")

    bid = create_bid(db, session_id, user.user_id, data.amount)
    session.current_price = data.amount  # cập nhật giá cao nhất

    # Broadcast đến TẤT CẢ người đang xem auction
    await sio.emit("new_bid", {
        "bidder_name":    user.full_name,
        "amount":         str(bid.bid_amount),
        "current_leader": user.full_name,
    }, room=f"auction_{session_id}")
    return bid`,
      },
      {
        id: '4', title: '4. Kết thúc & thu phí từ ví', layer: 'backend',
        file: 'backend/app/routes/wallet.py',
        desc: 'Khi auction kết thúc → winner trả phí từ ví nội bộ. Shop phải nạp ví trước (admin duyệt deposit). Nếu ví không đủ → banner không được active, auction rơi vào người kế tiếp.',
        code:
`# Khi auction kết thúc (cronjob hoặc manual):
winner_bid = get_highest_bid(db, session_id)
winner_wallet = db.query(ShopWallet).filter_by(
    shop_id=winner_bid.shop_id
).first()

if winner_wallet.balance >= session.current_price:
    # Trừ tiền từ ví
    winner_wallet.balance -= session.current_price
    session.winner_id   = winner_bid.shop_id
    session.status      = "completed"
    # Active banner
    banner.is_active    = True
    banner.display_from = session.start_display
    db.commit()
else:
    # Ví không đủ → next highest bidder
    ...`,
      },
    ],
  },

  // ── 7. Superadmin ─────────────────────────────────────────────────────────
  {
    id: 'superadmin',
    icon: '⚡',
    title: 'Superadmin',
    desc: 'Auth riêng → Direct DB → DB Viewer → ERD diagram → Tài liệu này',
    steps: [
      {
        id: '1', title: '1. Auth tách biệt hoàn toàn', layer: 'backend',
        file: 'super/backend/auth.py + middleware.py',
        desc: 'Superadmin login riêng qua /api/super/auth/login với username/password khác hoàn toàn hệ thống thường. Token lưu vào localStorage["super_token"]. Không chia sẻ auth state với app chính.',
        code:
`# super/backend/auth.py
@router.post("/login")
def super_login(data: SuperLoginRequest):
    if not verify_super_credentials(data.username, data.password):
        raise HTTPException(401, "Sai thông tin đăng nhập superadmin")
    token = create_super_token({"type": "super", "username": data.username})
    return {"token": token}

# super/middleware.py
def require_super(credentials = Depends(HTTPBearer()), db = Depends(get_db)):
    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "super":
        raise HTTPException(401, "Cần super token")
    return payload

# super/frontend/superApi.ts — Axios riêng
const superApi = axios.create({ baseURL: '/api/super' })
superApi.interceptors.request.use(cfg => {
  const token = localStorage.getItem('super_token')
  if (token) cfg.headers.Authorization = \`Bearer \${token}\`
  return cfg
})`,
      },
      {
        id: '2', title: '2. DB Viewer — SQLAlchemy inspect()', layer: 'backend',
        file: 'super/backend/routes/db_viewer.py',
        desc: 'Dùng SQLAlchemy inspect(engine) để đọc schema TRỰC TIẾP từ DB, không cần khai báo model. Hỗ trợ xem schema, dữ liệu phân trang, sort, filter ILIKE, và raw SELECT query.',
        code:
`# super/backend/routes/db_viewer.py
from sqlalchemy import inspect

insp = inspect(engine)

# Lấy tất cả bảng
tables = insp.get_table_names()   # → ["users", "products", "orders", ...]

# Schema của bảng
cols  = insp.get_columns("orders")         # tên, kiểu, nullable
pks   = insp.get_pk_constraint("orders")   # primary keys
fks   = insp.get_foreign_keys("orders")    # foreign keys + referred table

# Dữ liệu phân trang
rows = db.execute(text(
    'SELECT * FROM "orders" ORDER BY "order_id" DESC LIMIT :lim OFFSET :off'
), {"lim": 50, "off": 0}).mappings().all()`,
      },
      {
        id: '3', title: '3. ERD Diagram — GET /erd', layer: 'backend',
        file: 'super/backend/routes/db_viewer.py',
        desc: 'Endpoint /erd trả về toàn bộ 55+ bảng với columns info và tất cả FK relationships. Frontend dùng để vẽ ERD diagram tương tác.',
        code:
`@router.get("/erd")
def get_erd_schema(_ = Depends(require_super)):
    insp = inspect(engine)
    tables = {}
    relationships = []

    for tname in sorted(insp.get_table_names()):
        fks_raw = insp.get_foreign_keys(tname)
        cols = [{
            "name": c["name"], "type": str(c["type"]),
            "pk":   c["name"] in pk_cols,
            "fk":   fk_info,   # { to_table, to_col }
        } for c in insp.get_columns(tname)]
        tables[tname] = cols

        for fk in fks_raw:
            relationships.append({
                "from_table": tname,           "from_col": fk["constrained_columns"][0],
                "to_table":   fk["referred_table"], "to_col":   fk["referred_columns"][0],
            })

    return {"tables": tables, "relationships": relationships}`,
      },
      {
        id: '4', title: '4. ERD Frontend — SVG draggable', layer: 'frontend',
        file: 'super/frontend/pages/ERDPage.tsx',
        desc: 'React component vẽ ERD dùng SVG thuần. Table cards draggable. SVG Bezier curves cho FK lines. Click bảng → highlight related tables + dim others. Zoom bằng wheel, pan bằng drag. Auto-layout lưới.',
        code:
`// ERDPage.tsx — FK line as SVG Bezier curve
function fkLinePoints(fromPos, fromCols, fromColName, toPos, toCols, toColName) {
  const fy = fromPos.y + HEADER_H + fromRowIdx * ROW_H + ROW_H / 2
  const ty = toPos.y   + HEADER_H + toRowIdx   * ROW_H + ROW_H / 2
  const midX = (fx + tx) / 2
  return \`M\${fx},\${fy} C\${midX},\${fy} \${midX},\${ty} \${tx},\${ty}\`
}

// Draggable table card
const onCardMouseDown = (e, table) => {
  dragging.current = {
    table,
    startMouse: { x: e.clientX, y: e.clientY },
    startPos:   { ...positions[table] },
  }
}

// Trong onMouseMove:
const dx = (e.clientX - dragging.current.startMouse.x) / scale
setPositions(prev => ({ ...prev, [table]: { x: startPos.x + dx, y: ... }}))`,
      },
    ],
  },
]

// ── Sub-components ────────────────────────────────────────────────────────────

const LayerBadge: React.FC<{ layer: Layer }> = ({ layer }) => {
  const { bg, text, label } = LAYER_COLOR[layer]
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
      background: bg, color: text, fontSize: 10, fontWeight: 700,
      fontFamily: 'monospace', whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  )
}

const CodeBlock: React.FC<{ code: string; file?: string }> = ({ code, file }) => (
  <div style={{ marginTop: 12 }}>
    {file && (
      <div style={{
        padding: '5px 12px',
        background: '#0d1117', borderRadius: '6px 6px 0 0',
        borderBottom: '1px solid #1e1e2e',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ fontSize: 10, color: '#60a5fa', fontFamily: 'monospace' }}>
          📄 {file}
        </span>
      </div>
    )}
    <pre style={{
      margin: 0, padding: '14px 16px',
      background: '#0d1117',
      borderRadius: file ? '0 0 6px 6px' : 6,
      border: '1px solid #1e1e2e',
      borderTop: file ? 'none' : undefined,
      fontSize: 11.5, lineHeight: 1.7,
      color: '#c9d1d9',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      overflowX: 'auto',
      whiteSpace: 'pre',
    }}>
      {highlightCode(code)}
    </pre>
  </div>
)

/** Minimal syntax highlighting — no deps */
function highlightCode(code: string): React.ReactNode {
  const lines = code.split('\n')
  return lines.map((line, i) => {
    const isComment  = line.trimStart().startsWith('#') || line.trimStart().startsWith('//')
    const isImport   = /^(import|from|export)\s/.test(line.trimStart())
    const isDecorator = line.trimStart().startsWith('@')
    const isKeyword  = /\b(const|let|var|function|return|if|else|await|async|def|class|try|except|raise|for|in|not|and|or|from|import)\b/.test(line)

    let color = '#c9d1d9'
    if (isComment)   color = '#6a737d'
    else if (isImport)   color = '#79b8ff'
    else if (isDecorator) color = '#e1b570'

    return (
      <span key={i} style={{ display: 'block', color }}>
        {line}
      </span>
    )
  })
}

// ── Architecture Diagram (SVG) ────────────────────────────────────────────────

const ArchDiagram: React.FC = () => (
  <svg viewBox="0 0 780 340" style={{ width: '100%', maxWidth: 780, display: 'block', margin: '0 auto' }}>
    {/* Browser */}
    <rect x={20}  y={130} width={160} height={80} rx={10} fill="#0d1117" stroke="#38bdf8" strokeWidth={1.5} />
    <text x={100} y={162} textAnchor="middle" fill="#38bdf8" fontSize={12} fontWeight={700}>⚛️  Frontend</text>
    <text x={100} y={180} textAnchor="middle" fill="#64748b" fontSize={10}>React 18 + TypeScript</text>
    <text x={100} y={196} textAnchor="middle" fill="#64748b" fontSize={10}>Vite + Axios + Socket.IO</text>

    {/* Arrow FE → BE */}
    <line x1={180} y1={170} x2={290} y2={170} stroke="#334155" strokeWidth={1.5} markerEnd="url(#arr)" />
    <text x={235} y={160} textAnchor="middle" fill="#475569" fontSize={9}>HTTP/WS</text>

    {/* FastAPI */}
    <rect x={290} y={90}  width={200} height={160} rx={10} fill="#0d1117" stroke="#4ade80" strokeWidth={1.5} />
    <text x={390} y={118} textAnchor="middle" fill="#4ade80" fontSize={12} fontWeight={700}>🐍 Backend</text>
    <text x={390} y={136} textAnchor="middle" fill="#64748b" fontSize={10}>FastAPI + Uvicorn ASGI</text>
    <line x1={310} y1={148} x2={470} y2={148} stroke="#1e1e2e" strokeWidth={1} />
    <text x={390} y={164} textAnchor="middle" fill="#94a3b8" fontSize={10}>Routes (15 groups)</text>
    <text x={390} y={180} textAnchor="middle" fill="#94a3b8" fontSize={10}>Services (business logic)</text>
    <text x={390} y={196} textAnchor="middle" fill="#94a3b8" fontSize={10}>SQLAlchemy ORM</text>
    <text x={390} y={212} textAnchor="middle" fill="#94a3b8" fontSize={10}>JWT Auth + RBAC</text>
    <text x={390} y={228} textAnchor="middle" fill="#94a3b8" fontSize={10}>Socket.IO WebSocket</text>

    {/* Arrow BE → DB */}
    <line x1={490} y1={170} x2={590} y2={170} stroke="#334155" strokeWidth={1.5} markerEnd="url(#arr)" />
    <text x={540} y={160} textAnchor="middle" fill="#475569" fontSize={9}>SQLAlchemy</text>

    {/* PostgreSQL */}
    <rect x={590} y={110} width={160} height={120} rx={10} fill="#0d1117" stroke="#fbbf24" strokeWidth={1.5} />
    <text x={670} y={142} textAnchor="middle" fill="#fbbf24" fontSize={12} fontWeight={700}>🗄️  Database</text>
    <text x={670} y={160} textAnchor="middle" fill="#64748b" fontSize={10}>PostgreSQL 15</text>
    <text x={670} y={178} textAnchor="middle" fill="#94a3b8" fontSize={10}>55+ tables</text>
    <text x={670} y={196} textAnchor="middle" fill="#94a3b8" fontSize={10}>Connection pool</text>
    <text x={670} y={212} textAnchor="middle" fill="#94a3b8" fontSize={10}>size=10, overflow=20</text>

    {/* Cloudinary */}
    <rect x={290} y={270} width={200} height={50} rx={8} fill="#0d1117" stroke="#f97316" strokeWidth={1} />
    <text x={390} y={291} textAnchor="middle" fill="#f97316" fontSize={11} fontWeight={700}>☁️  Cloudinary</text>
    <text x={390} y={308} textAnchor="middle" fill="#64748b" fontSize={9}>Image upload & CDN</text>
    <line x1={390} y1={250} x2={390} y2={270} stroke="#f97316" strokeWidth={1} strokeDasharray="4,3" />

    {/* MoMo/VNPay */}
    <rect x={510} y={270} width={130} height={50} rx={8} fill="#0d1117" stroke="#a78bfa" strokeWidth={1} />
    <text x={575} y={291} textAnchor="middle" fill="#a78bfa" fontSize={11} fontWeight={700}>💳 Payment</text>
    <text x={575} y={308} textAnchor="middle" fill="#64748b" fontSize={9}>MoMo · VNPay</text>
    <line x1={490} y1={230} x2={545} y2={270} stroke="#a78bfa" strokeWidth={1} strokeDasharray="4,3" />

    {/* Superadmin */}
    <rect x={20}  y={20}  width={160} height={80} rx={10} fill="#0d1117" stroke="#dc2626" strokeWidth={1.5} />
    <text x={100} y={48}  textAnchor="middle" fill="#dc2626" fontSize={12} fontWeight={700}>⚡ Superadmin</text>
    <text x={100} y={66}  textAnchor="middle" fill="#64748b" fontSize={10}>Tách biệt /super/*</text>
    <text x={100} y={82}  textAnchor="middle" fill="#64748b" fontSize={10}>Auth riêng + DB inspect</text>
    <line x1={100} y1={100} x2={100} y2={130} stroke="#dc2626" strokeWidth={1} strokeDasharray="4,3" />

    <defs>
      <marker id="arr" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
        <path d="M0,0 L0,6 L8,3 z" fill="#334155" />
      </marker>
    </defs>
  </svg>
)

// ── Main Component ────────────────────────────────────────────────────────────

const SystemDocsPage: React.FC = () => {
  const [activeTopic, setActiveTopic]   = useState(TOPICS[0].id)
  const [activeStep,  setActiveStep]    = useState<string | null>(null)

  const topic = TOPICS.find(t => t.id === activeTopic)!
  const step  = topic.steps.find(s => s.id === activeStep) ?? null

  const handleTopicChange = (id: string) => {
    setActiveTopic(id)
    setActiveStep(null)
  }

  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 56px)', overflow: 'hidden', gap: 0 }}>

      {/* ── Left sidebar: topic list ── */}
      <aside style={{
        width: 210, flexShrink: 0,
        background: '#0d0d14',
        borderRight: '1px solid #1a1a2a',
        overflowY: 'auto',
        padding: '12px 0',
      }}>
        <div style={{ padding: '0 14px 10px', fontSize: 10, color: '#475569', fontWeight: 700, letterSpacing: 1 }}>
          LUỒNG HỆ THỐNG
        </div>
        {TOPICS.map(t => (
          <button
            key={t.id}
            onClick={() => handleTopicChange(t.id)}
            style={{
              width: '100%', textAlign: 'left',
              padding: '10px 14px', border: 'none', cursor: 'pointer',
              background: activeTopic === t.id ? 'rgba(220,38,38,0.12)' : 'transparent',
              borderLeft: `3px solid ${activeTopic === t.id ? '#dc2626' : 'transparent'}`,
              color: activeTopic === t.id ? '#fca5a5' : '#94a3b8',
              transition: 'all 0.15s',
            }}
          >
            <div style={{ fontSize: 13, fontWeight: activeTopic === t.id ? 700 : 500 }}>
              {t.icon} {t.title}
            </div>
            <div style={{ fontSize: 10, color: '#475569', marginTop: 2, lineHeight: 1.4 }}>
              {t.desc}
            </div>
          </button>
        ))}

        <div style={{ margin: '12px 14px 0', padding: '10px 0', borderTop: '1px solid #1a1a2a', fontSize: 10, color: '#334155', lineHeight: 1.5 }}>
          Click từng bước để xem code thật từ project.
        </div>
      </aside>

      {/* ── Right: content ── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Topic header */}
        <div style={{
          padding: '14px 20px',
          background: '#13131a', borderBottom: '1px solid #1e1e2e',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>
            {topic.icon} {topic.title}
          </div>
          <div style={{ fontSize: 12, color: '#64748b', marginTop: 3 }}>{topic.desc}</div>
        </div>

        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

          {/* Steps column */}
          <div style={{
            width: 300, flexShrink: 0,
            overflowY: 'auto', padding: 16,
            borderRight: '1px solid #1a1a2a',
          }}>
            {/* Architecture diagram for arch topic */}
            {activeTopic === 'arch' && (
              <div style={{ marginBottom: 16 }}>
                <ArchDiagram />
              </div>
            )}

            {topic.steps.map((s, i) => (
              <div key={s.id}>
                <button
                  onClick={() => setActiveStep(s.id === activeStep ? null : s.id)}
                  style={{
                    width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer',
                    borderRadius: 8, padding: '12px 14px', marginBottom: 4,
                    background: activeStep === s.id ? '#1a1a2e' : '#13131a',
                    outline: activeStep === s.id ? '1px solid #dc2626' : '1px solid #1e1e2e',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <LayerBadge layer={s.layer} />
                    {activeStep === s.id && (
                      <span style={{ fontSize: 10, color: '#dc2626' }}>▶ đang xem</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: activeStep === s.id ? '#fca5a5' : '#e2e8f0' }}>
                    {s.title}
                  </div>
                </button>

                {/* Arrow between steps */}
                {i < topic.steps.length - 1 && (
                  <div style={{ textAlign: 'center', color: '#1e3a5f', fontSize: 16, lineHeight: 1, marginBottom: 4 }}>
                    ↓
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Detail panel */}
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            {!step ? (
              <div style={{ color: '#334155', fontSize: 13, marginTop: 40, textAlign: 'center' }}>
                ← Click vào một bước để xem chi tiết code
              </div>
            ) : (
              <div>
                {/* Step header */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <LayerBadge layer={step.layer} />
                  <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f1f5f9' }}>
                    {step.title}
                  </h2>
                </div>

                {/* Description */}
                <p style={{
                  margin: '0 0 16px', fontSize: 13, color: '#94a3b8', lineHeight: 1.7,
                  background: '#13131a', padding: '12px 16px', borderRadius: 8,
                  border: '1px solid #1e1e2e',
                }}>
                  {step.desc}
                </p>

                {/* Code */}
                {step.code && <CodeBlock code={step.code} file={step.file} />}

                {/* Layer explanation */}
                <div style={{
                  marginTop: 16, padding: '10px 14px',
                  background: LAYER_COLOR[step.layer].bg,
                  borderRadius: 8, border: `1px solid ${LAYER_COLOR[step.layer].text}22`,
                }}>
                  <span style={{ fontSize: 11, color: LAYER_COLOR[step.layer].text, fontWeight: 600 }}>
                    {LAYER_COLOR[step.layer].label}
                  </span>
                  <span style={{ fontSize: 11, color: '#64748b', marginLeft: 8 }}>
                    {step.layer === 'frontend' && '— Chạy trên browser. React components, hooks, Axios calls.'}
                    {step.layer === 'backend'  && '— Chạy trên server. FastAPI routes, services, SQLAlchemy.'}
                    {step.layer === 'db'       && '— PostgreSQL. Tables, relations, constraints.'}
                    {step.layer === 'user'     && '— Hành động của người dùng thực.'}
                    {step.layer === 'external' && '— API bên ngoài: MoMo, VNPay, Cloudinary, Gemini AI.'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default SystemDocsPage
