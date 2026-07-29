# Mô hình dữ liệu mức ý niệm — BuyZo E-Commerce Platform

```mermaid
erDiagram
    USER {
        int UserID PK
        string username
        string email
        string phone
        string password
        string role
        string avatar
        string address
    }
    SHOP {
        int ShopID PK
        int UserID FK
        string name
        string description
        string logo
        float rating
        boolean isMall
        string status
    }
    EMPLOYEE {
        int EmployeeID PK
        int ShopID FK
        int UserID FK
        string role
        string status
    }
    CATEGORY {
        int CategoryID PK
        int parentID FK
        string name
        string image
    }
    PRODUCT {
        int ProductID PK
        int ShopID FK
        int CategoryID FK
        string name
        string description
        string images
        string status
    }
    PRODUCT_VARIANT {
        int VariantID PK
        int ProductID FK
        string size
        string color
        float price
        int stock
    }
    ORDER {
        int OrderID PK
        int UserID FK
        int ShopID FK
        int VoucherID FK
        float totalAmount
        string status
        string note
        datetime createdAt
    }
    ORDER_ITEM {
        int ItemID PK
        int OrderID FK
        int VariantID FK
        int quantity
        float unitPrice
    }
    PAYMENT {
        int PaymentID PK
        int OrderID FK
        string method
        float amount
        string status
        string transactionID
    }
    VOUCHER {
        int VoucherID PK
        int ShopID FK
        string code
        string discountType
        float discountValue
        float minOrderAmount
        int quantity
        datetime expiry
        string status
    }
    USER_VOUCHER {
        int UserID PK
        int VoucherID PK
        datetime collectedAt
        boolean isUsed
    }
    REVIEW {
        int ReviewID PK
        int UserID FK
        int ProductID FK
        int rating
        string content
        string images
        datetime createdAt
    }
    FLASH_SALE {
        int FlashSaleID PK
        int ShopID FK
        string name
        datetime startTime
        datetime endTime
        string status
    }
    FLASH_SALE_ITEM {
        int FlashSaleID PK
        int VariantID PK
        float salePrice
        int quantity
    }
    CONVERSATION {
        int ConversationID PK
        int UserID FK
        int ShopID FK
        datetime createdAt
        datetime lastMessageAt
    }
    MESSAGE {
        int MessageID PK
        int ConversationID FK
        int senderID FK
        string content
        string type
        datetime createdAt
        boolean isRead
    }
    NOTIFICATION {
        int NotificationID PK
        int UserID FK
        string content
        string type
        boolean isRead
        datetime createdAt
    }
    DISPUTE {
        int DisputeID PK
        int OrderID FK
        int UserID FK
        string reason
        string evidence
        string status
        datetime createdAt
    }
    REFUND {
        int RefundID PK
        int OrderID FK
        float amount
        string reason
        string status
        datetime processedAt
    }
    COMMISSION_SETTING {
        int CommissionID PK
        int ShopID FK
        float commissionRate
        datetime effectiveFrom
        datetime effectiveTo
    }
    SHIPPER {
        int ShipperID PK
        int UserID FK
        int WardID FK
        string vehicle
        string licenseNo
        string status
    }
    SHIPMENT {
        int ShipmentID PK
        int OrderID FK
        int ShipperID FK
        int WardID FK
        string trackingCode
        string status
        datetime deliveredAt
    }
    WAREHOUSE_HUB {
        int HubID PK
        int ManagerUserID FK
        string name
        string address
    }
    WAREHOUSE_DISTRICT {
        int DistrictID PK
        int HubID FK
        int ManagerUserID FK
        string name
        string address
    }
    WAREHOUSE_WARD {
        int WardID PK
        int DistrictID FK
        int ManagerUserID FK
        string name
        string address
    }

    USER ||--o{ SHOP : "sở hữu"
    USER ||--o{ ORDER : "đặt hàng"
    USER ||--o{ REVIEW : "viết"
    USER ||--o{ NOTIFICATION : "nhận"
    USER ||--o{ USER_VOUCHER : "thu thập"
    USER ||--o{ DISPUTE : "gửi"
    USER ||--o| SHIPPER : "đăng ký"

    SHOP ||--o{ PRODUCT : "có"
    SHOP ||--o{ VOUCHER : "tạo"
    SHOP ||--o{ FLASH_SALE : "tổ chức"
    SHOP ||--o{ EMPLOYEE : "có nhân viên"
    SHOP ||--o{ ORDER : "nhận"
    SHOP ||--o{ COMMISSION_SETTING : "áp dụng"
    SHOP ||--o{ CONVERSATION : "tham gia"

    EMPLOYEE }o--|| USER : "là tài khoản"

    PRODUCT }o--|| CATEGORY : "thuộc"
    PRODUCT ||--o{ PRODUCT_VARIANT : "có biến thể"
    PRODUCT ||--o{ REVIEW : "được đánh giá"

    CATEGORY }o--o| CATEGORY : "danh mục cha"

    ORDER ||--o{ ORDER_ITEM : "gồm"
    ORDER ||--|| PAYMENT : "thanh toán"
    ORDER ||--o| DISPUTE : "khiếu nại"
    ORDER ||--o| REFUND : "hoàn tiền"
    ORDER ||--|| SHIPMENT : "vận chuyển"
    ORDER }o--o| VOUCHER : "áp dụng"

    ORDER_ITEM }o--|| PRODUCT_VARIANT : "chứa"

    VOUCHER ||--o{ USER_VOUCHER : "được lưu"

    FLASH_SALE ||--o{ FLASH_SALE_ITEM : "gồm sản phẩm"
    FLASH_SALE_ITEM }o--|| PRODUCT_VARIANT : "tham chiếu"

    CONVERSATION }o--|| USER : "khách hàng"
    CONVERSATION ||--o{ MESSAGE : "gồm"

    SHIPMENT }o--|| SHIPPER : "giao bởi"
    SHIPMENT }o--|| WAREHOUSE_WARD : "thuộc kho phường"

    WAREHOUSE_HUB ||--o{ WAREHOUSE_DISTRICT : "quản lý"
    WAREHOUSE_DISTRICT ||--o{ WAREHOUSE_WARD : "quản lý"

    WAREHOUSE_HUB }o--|| USER : "quản lý bởi"
    WAREHOUSE_DISTRICT }o--|| USER : "quản lý bởi"
    WAREHOUSE_WARD }o--|| USER : "quản lý bởi"
    SHIPPER }o--|| WAREHOUSE_WARD : "thuộc kho phường"
```
