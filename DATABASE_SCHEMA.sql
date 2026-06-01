-- ============================================================================
-- E-Commerce Platform — DATABASE SCHEMA (MySQL 8.0)
-- Đồng bộ với Prisma schema (prisma/schema.prisma)
-- Cập nhật: thêm product_variants, product_reviews; sửa price→DECIMAL; thêm order_number, shipping_fee
-- ============================================================================

SET FOREIGN_KEY_CHECKS = 0;

-- ============================================================================
-- PART 1: USER & ROLE MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS users (
    user_id     INT PRIMARY KEY AUTO_INCREMENT,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name   VARCHAR(255),
    phone       VARCHAR(20),
    address     TEXT,
    avatar_url  VARCHAR(500),
    status      ENUM('active','inactive','banned') DEFAULT 'active',
    last_login  DATETIME,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_email (email),
    INDEX idx_status (status),
    INDEX idx_created (created_at DESC)
);

CREATE TABLE IF NOT EXISTS roles (
    role_id     INT PRIMARY KEY AUTO_INCREMENT,
    role_name   VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO roles (role_name, description) VALUES
('user',     'Regular customer'),
('shop',     'Shop owner'),
('shipper',  'Delivery driver'),
('admin',    'Administrator'),
('employee', 'Shop employee');

CREATE TABLE IF NOT EXISTS user_roles (
    user_role_id INT PRIMARY KEY AUTO_INCREMENT,
    user_id      INT NOT NULL,
    role_id      INT NOT NULL,
    status       ENUM('active','inactive') DEFAULT 'active',
    current_role BOOLEAN DEFAULT FALSE,
    assigned_by  INT,
    assigned_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_role (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (assigned_by) REFERENCES users(user_id),
    INDEX idx_current_role (user_id, current_role)
);

CREATE TABLE IF NOT EXISTS permissions (
    permission_id   INT PRIMARY KEY AUTO_INCREMENT,
    permission_code VARCHAR(100) UNIQUE NOT NULL,
    description     TEXT,
    category        VARCHAR(50),
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO permissions (permission_code, category, description) VALUES
('product:create',  'product',  'Create product'),
('product:read',    'product',  'View products'),
('product:update',  'product',  'Edit product'),
('product:delete',  'product',  'Delete product'),
('product:approve', 'product',  'Approve product'),
('order:create',    'order',    'Create order'),
('order:read',      'order',    'View orders'),
('order:confirm',   'order',    'Confirm order'),
('order:cancel',    'order',    'Cancel order'),
('order:update',    'order',    'Update order'),
('shop:manage',     'shop',     'Manage shop'),
('shop:analytics',  'shop',     'View analytics'),
('shop:employees',  'shop',     'Manage employees'),
('message:read',    'message',  'Read messages'),
('message:send',    'message',  'Send messages'),
('user:manage',     'user',     'Manage users'),
('user:ban',        'user',     'Ban users'),
('dispute:resolve', 'dispute',  'Resolve disputes'),
('payment:process', 'payment',  'Process payment'),
('shipment:read',   'shipment', 'View shipments'),
('shipment:assign', 'shipment', 'Assign shipper');

CREATE TABLE IF NOT EXISTS role_permissions (
    role_perm_id INT PRIMARY KEY AUTO_INCREMENT,
    role_id      INT NOT NULL,
    permission_id INT NOT NULL,
    UNIQUE KEY unique_role_permission (role_id, permission_id),
    FOREIGN KEY (role_id) REFERENCES roles(role_id),
    FOREIGN KEY (permission_id) REFERENCES permissions(permission_id)
);

-- ============================================================================
-- PART 2: SHOP MANAGEMENT
-- ============================================================================

CREATE TABLE IF NOT EXISTS shops (
    shop_id             INT PRIMARY KEY,
    shop_name           VARCHAR(255) NOT NULL,
    description         TEXT,
    avatar_url          VARCHAR(500),
    address             TEXT NOT NULL,
    phone               VARCHAR(20),
    rating              DECIMAL(3,2) DEFAULT 0,
    total_followers     INT DEFAULT 0,
    total_orders        INT DEFAULT 0,
    verification_status ENUM('pending','approved','rejected') DEFAULT 'pending',
    verified_at         DATETIME,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_verification (verification_status)
);

CREATE TABLE IF NOT EXISTS shop_registrations (
    reg_id           INT PRIMARY KEY AUTO_INCREMENT,
    user_id          INT NOT NULL UNIQUE,
    shop_name        VARCHAR(255) NOT NULL,
    description      TEXT,
    address          TEXT NOT NULL,
    cmnd_url         VARCHAR(500),
    cmnd_back_url    VARCHAR(500),
    business_reg_url VARCHAR(500),
    status           ENUM('pending','approved','rejected') DEFAULT 'pending',
    rejection_reason TEXT,
    reviewed_by      INT,
    reviewed_at      DATETIME,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(user_id),
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id),
    INDEX idx_status  (status),
    INDEX idx_created (created_at DESC)
);

CREATE TABLE IF NOT EXISTS shop_employees (
    employee_id   INT PRIMARY KEY AUTO_INCREMENT,
    user_id       INT NOT NULL UNIQUE,
    shop_id       INT NOT NULL,
    employee_name VARCHAR(255),
    position      VARCHAR(100),
    status        ENUM('active','inactive','suspended') DEFAULT 'active',
    hired_date    DATE,
    created_by    INT NOT NULL,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(user_id),
    FOREIGN KEY (shop_id)    REFERENCES shops(shop_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_shop   (shop_id),
    INDEX idx_status (status)
);

-- Prisma: EmployeeRolePermission — FK đến permissions.permission_code
CREATE TABLE IF NOT EXISTS employee_role_permissions (
    emp_perm_id     INT PRIMARY KEY AUTO_INCREMENT,
    employee_id     INT NOT NULL,
    permission_code VARCHAR(100) NOT NULL,
    granted_by      INT NOT NULL,
    granted_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id)     REFERENCES shop_employees(employee_id) ON DELETE CASCADE,
    FOREIGN KEY (granted_by)      REFERENCES users(user_id),
    FOREIGN KEY (permission_code) REFERENCES permissions(permission_code),
    INDEX idx_employee (employee_id)
);

CREATE TABLE IF NOT EXISTS system_employees (
    emp_id     INT PRIMARY KEY AUTO_INCREMENT,
    user_id    INT NOT NULL UNIQUE,
    emp_name   VARCHAR(255),
    role_name  VARCHAR(50),
    status     ENUM('active','inactive','suspended') DEFAULT 'active',
    created_by INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)    REFERENCES users(user_id),
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS system_employee_permissions (
    emp_perm_id     INT PRIMARY KEY AUTO_INCREMENT,
    emp_id          INT NOT NULL,
    permission_code VARCHAR(100),
    scope           ENUM('admin','shop','both') DEFAULT 'admin',
    granted_by      INT NOT NULL,
    granted_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (emp_id)          REFERENCES system_employees(emp_id),
    FOREIGN KEY (granted_by)      REFERENCES users(user_id),
    FOREIGN KEY (permission_code) REFERENCES permissions(permission_code),
    INDEX idx_emp (emp_id)
);

-- ============================================================================
-- PART 3: PRODUCT MANAGEMENT (cập nhật theo Prisma)
-- ============================================================================

CREATE TABLE IF NOT EXISTS product_categories (
    category_id   INT PRIMARY KEY AUTO_INCREMENT,
    category_name VARCHAR(255) NOT NULL UNIQUE,
    description   TEXT,
    icon_url      VARCHAR(500),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS products (
    product_id    INT PRIMARY KEY AUTO_INCREMENT,
    shop_id       INT NOT NULL,
    category_id   INT,
    product_name  VARCHAR(255) NOT NULL,
    description   TEXT,
    price         DECIMAL(10,2) NOT NULL,   -- Prisma: Decimal(10,2)
    cost          DECIMAL(10,2),
    stock_quantity INT DEFAULT 0,
    image_urls    JSON,
    status        ENUM('active','pending','rejected','archived') DEFAULT 'pending',
    rating        DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INT DEFAULT 0,
    views_count   INT DEFAULT 0,
    sales_count   INT DEFAULT 0,
    approved_at   DATETIME,                  -- Prisma: approvedAt
    deleted_at    DATETIME,
    deleted_by    INT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shop_id)     REFERENCES shops(shop_id),
    FOREIGN KEY (category_id) REFERENCES product_categories(category_id),
    FOREIGN KEY (deleted_by)  REFERENCES users(user_id),
    INDEX idx_shop     (shop_id),
    INDEX idx_status   (status),
    INDEX idx_category (category_id),
    INDEX idx_created  (created_at DESC)
);

-- ── Prisma: ProductVariant (bảng mới) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_variants (
    variant_id   INT PRIMARY KEY AUTO_INCREMENT,
    product_id   INT NOT NULL,
    variant_name VARCHAR(255) NOT NULL,
    sku          VARCHAR(100) NOT NULL,
    price        DECIMAL(10,2) NOT NULL,
    stock        INT DEFAULT 0,
    image_url    VARCHAR(500),
    created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    INDEX idx_variant_product (product_id),
    INDEX idx_sku (sku)
);

-- ── Prisma: ProductReview (bảng mới) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_reviews (
    review_id  INT PRIMARY KEY AUTO_INCREMENT,
    product_id INT NOT NULL,
    user_id    INT NOT NULL,
    rating     TINYINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    title      VARCHAR(255),
    content    TEXT,
    verified   BOOLEAN DEFAULT FALSE,
    helpful    INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (user_id)    REFERENCES users(user_id),
    INDEX idx_review_product (product_id),
    INDEX idx_review_user    (user_id)
);

-- Giữ lại: ProductDeletionRequest & AuditLog (không có trong Prisma nhưng workflow cần)
CREATE TABLE IF NOT EXISTS product_deletion_requests (
    deletion_req_id INT PRIMARY KEY AUTO_INCREMENT,
    product_id      INT NOT NULL,
    shop_id         INT,
    requested_by    INT NOT NULL,
    reason          TEXT,
    status          ENUM('pending','approved','rejected') DEFAULT 'pending',
    reviewed_by     INT,
    reviewed_at     DATETIME,
    review_reason   TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id)   REFERENCES products(product_id),
    FOREIGN KEY (shop_id)      REFERENCES users(user_id),
    FOREIGN KEY (requested_by) REFERENCES users(user_id),
    FOREIGN KEY (reviewed_by)  REFERENCES users(user_id),
    INDEX idx_status  (status),
    INDEX idx_created (created_at DESC)
);

-- ============================================================================
-- PART 4: VOUCHERS (trước ORDERS vì orders FK vào vouchers)
-- ============================================================================

CREATE TABLE IF NOT EXISTS vouchers (
    voucher_id    INT PRIMARY KEY AUTO_INCREMENT,
    code          VARCHAR(50) UNIQUE NOT NULL,
    discount_type ENUM('percentage','fixed') DEFAULT 'percentage',
    discount_value DECIMAL(10,2) NOT NULL,    -- Prisma: Decimal(10,2)
    min_order_value DECIMAL(10,2),
    max_discount  DECIMAL(10,2),
    max_uses      INT,
    current_uses  INT DEFAULT 0,
    status        ENUM('active','inactive','expired') DEFAULT 'active',
    valid_from    DATETIME,
    valid_to      DATETIME,
    created_by    INT,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(user_id),
    INDEX idx_code   (code),
    INDEX idx_status (status)
);

-- ============================================================================
-- PART 5: ORDERS (cập nhật theo Prisma)
-- ============================================================================

CREATE TABLE IF NOT EXISTS carts (
    cart_id    INT PRIMARY KEY AUTO_INCREMENT,
    user_id    INT NOT NULL,
    product_id INT NOT NULL,
    quantity   INT NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_user_product (user_id, product_id),
    FOREIGN KEY (user_id)    REFERENCES users(user_id),
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_cart_user (user_id)
);

CREATE TABLE IF NOT EXISTS orders (
    order_id        INT PRIMARY KEY AUTO_INCREMENT,
    order_number    VARCHAR(50) UNIQUE,                     -- Prisma: orderNumber
    user_id         INT NOT NULL,
    shop_id         INT,
    shipper_id      INT,
    total_price     DECIMAL(10,2) NOT NULL,                 -- Prisma: Decimal(10,2)
    discount_amount DECIMAL(10,2) DEFAULT 0,                -- Prisma: discountAmount
    final_price     DECIMAL(10,2) NOT NULL,
    shipping_fee    DECIMAL(10,2) DEFAULT 0,                -- Prisma: shippingFee (mới)
    payment_method  ENUM('momo','cod','vnpay','credit_card') DEFAULT 'cod',
    payment_status  ENUM('unpaid','paid','failed','refunded') DEFAULT 'unpaid',
    -- Prisma enums: PENDING,CONFIRMED,PAID,SHIPPED,DELIVERED,CANCELLED,RETURNED
    -- + giữ ready_to_ship, completed cho workflow
    order_status    ENUM('pending','confirmed','paid','ready_to_ship','shipped','delivered','completed','cancelled','returned') DEFAULT 'pending',
    shipping_address TEXT,
    recipient_name  VARCHAR(255),
    recipient_phone VARCHAR(20),
    notes           TEXT,                                    -- Prisma: notes
    voucher_id      INT,                                    -- Prisma: FK trực tiếp
    voucher_code    VARCHAR(50),
    confirmed_by    INT,
    confirmed_at    DATETIME,
    prepared_by     INT,
    prepared_at     DATETIME,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)      REFERENCES users(user_id),
    FOREIGN KEY (shop_id)      REFERENCES shops(shop_id),
    FOREIGN KEY (shipper_id)   REFERENCES users(user_id),
    FOREIGN KEY (voucher_id)   REFERENCES vouchers(voucher_id),
    FOREIGN KEY (confirmed_by) REFERENCES users(user_id),
    FOREIGN KEY (prepared_by)  REFERENCES users(user_id),
    INDEX idx_order_user    (user_id),
    INDEX idx_order_shop    (shop_id),
    INDEX idx_order_status  (order_status),
    INDEX idx_order_created (created_at DESC),
    INDEX idx_order_number  (order_number)
);

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id INT PRIMARY KEY AUTO_INCREMENT,
    order_id      INT NOT NULL,
    product_id    INT NOT NULL,
    quantity      INT NOT NULL,
    price_at_order DECIMAL(10,2) NOT NULL,                  -- Prisma: Decimal(10,2)
    product_name  VARCHAR(255),
    product_image VARCHAR(500),
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)   REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id),
    INDEX idx_order_item (order_id)
);

-- ============================================================================
-- PART 6: PAYMENTS & SHIPMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS payments (
    payment_id    INT PRIMARY KEY AUTO_INCREMENT,
    order_id      INT NOT NULL UNIQUE,
    trans_id      VARCHAR(255),
    amount        DECIMAL(10,2) NOT NULL,                   -- Prisma: Decimal(10,2)
    method        ENUM('momo','cod','vnpay','credit_card'),
    status        ENUM('pending','success','failed') DEFAULT 'pending',
    momo_request_id VARCHAR(255),
    momo_response JSON,
    vnpay_txn_ref VARCHAR(100),
    vnpay_response JSON,
    cod_collected_at DATETIME,
    created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id),
    INDEX idx_payment_status  (status),
    INDEX idx_payment_created (created_at DESC)
);

CREATE TABLE IF NOT EXISTS shippers (
    shipper_id      INT PRIMARY KEY,
    vehicle_type    VARCHAR(50),
    license_plate   VARCHAR(20),
    current_location JSON,
    status          ENUM('available','on_delivery','offline') DEFAULT 'offline',
    rating          DECIMAL(3,2) DEFAULT 0,
    total_deliveries INT DEFAULT 0,
    verified_at     DATETIME,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (shipper_id) REFERENCES users(user_id),
    INDEX idx_shipper_status (status)
);

CREATE TABLE IF NOT EXISTS shipper_registrations (
    reg_id           INT PRIMARY KEY AUTO_INCREMENT,
    user_id          INT NOT NULL UNIQUE,
    vehicle_type     VARCHAR(50),
    license_plate    VARCHAR(20),
    license_url      VARCHAR(500),
    registration_url VARCHAR(500),
    id_card_url      VARCHAR(500),
    status           ENUM('pending','approved','rejected') DEFAULT 'pending',
    rejection_reason VARCHAR(500),
    reviewed_by      INT,
    reviewed_at      DATETIME,
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id)     REFERENCES users(user_id),
    FOREIGN KEY (reviewed_by) REFERENCES users(user_id),
    INDEX idx_shipper_reg_status (status)
);

CREATE TABLE IF NOT EXISTS shipments (
    shipment_id      INT PRIMARY KEY AUTO_INCREMENT,
    order_id         INT NOT NULL UNIQUE,
    shipper_id       INT,
    pickup_location  VARCHAR(500),
    delivery_location VARCHAR(500),
    status           ENUM('pending','assigned','picked_up','in_transit','delivered','failed') DEFAULT 'pending',
    pickup_time      DATETIME,
    delivery_time    DATETIME,
    current_location JSON,
    route            JSON,
    failure_reason   VARCHAR(500),
    created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id)   REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (shipper_id) REFERENCES shippers(shipper_id),
    INDEX idx_shipment_status  (status),
    INDEX idx_shipment_shipper (shipper_id),
    INDEX idx_shipment_created (created_at DESC)
);

-- ============================================================================
-- PART 7: NOTIFICATIONS & LOGGING
-- ============================================================================

CREATE TABLE IF NOT EXISTS notifications (
    notification_id    INT PRIMARY KEY AUTO_INCREMENT,
    user_id            INT NOT NULL,
    title              VARCHAR(255) NOT NULL,
    message            TEXT NOT NULL,
    type               VARCHAR(50),
    related_entity_type VARCHAR(50),
    related_entity_id  INT,
    is_read            BOOLEAN DEFAULT FALSE,
    read_at            DATETIME,
    action_url         VARCHAR(500),
    data               JSON,
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    INDEX idx_notif_user_created (user_id, created_at DESC),
    INDEX idx_notif_user_read    (user_id, is_read)
);

CREATE TABLE IF NOT EXISTS notification_preferences (
    pref_id             INT PRIMARY KEY AUTO_INCREMENT,
    user_id             INT NOT NULL UNIQUE,
    email_notifications BOOLEAN DEFAULT TRUE,
    sms_notifications   BOOLEAN DEFAULT FALSE,
    push_notifications  BOOLEAN DEFAULT TRUE,
    notification_types  JSON,
    quiet_hours_start   TIME,
    quiet_hours_end     TIME,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS employee_activity_logs (
    log_id      INT PRIMARY KEY AUTO_INCREMENT,
    employee_id INT,
    action      VARCHAR(100),
    entity_type VARCHAR(50),
    entity_id   INT,
    details     JSON,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_emp_log_employee (employee_id),
    INDEX idx_emp_log_created  (created_at DESC)
);

CREATE TABLE IF NOT EXISTS admin_logs (
    log_id      INT PRIMARY KEY AUTO_INCREMENT,
    admin_id    INT NOT NULL,
    action      VARCHAR(100),
    target_type VARCHAR(50),
    target_id   INT,
    details     JSON,
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES users(user_id),
    INDEX idx_admin_log_admin   (admin_id),
    INDEX idx_admin_log_created (created_at DESC)
);

CREATE TABLE IF NOT EXISTS system_logs (
    log_id     INT PRIMARY KEY AUTO_INCREMENT,
    level      ENUM('info','warning','error','critical'),
    message    TEXT,
    context    JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_sys_log_level   (level),
    INDEX idx_sys_log_created (created_at DESC)
);

-- ============================================================================
-- PART 8: DISPUTES
-- ============================================================================

CREATE TABLE IF NOT EXISTS disputes (
    dispute_id         INT PRIMARY KEY AUTO_INCREMENT,
    order_id           INT NOT NULL,
    initiated_by       INT NOT NULL,
    initiated_party    ENUM('user','shop','shipper'),
    reason             TEXT,
    evidence_urls      TEXT,
    status             ENUM('open','resolved','escalated') DEFAULT 'open',
    resolved_by        INT,
    resolution_details TEXT,
    refund_amount      DECIMAL(10,2),
    created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    resolved_at        DATETIME,
    FOREIGN KEY (order_id)     REFERENCES orders(order_id),
    FOREIGN KEY (initiated_by) REFERENCES users(user_id),
    FOREIGN KEY (resolved_by)  REFERENCES users(user_id),
    INDEX idx_dispute_status  (status),
    INDEX idx_dispute_created (created_at DESC)
);

SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================================
-- VERIFY
-- ============================================================================
-- SHOW TABLES;
-- SELECT COUNT(*) as total_tables FROM information_schema.tables WHERE table_schema = DATABASE();
-- Expected: 35 tables (bao gồm product_variants, product_reviews)
