from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.middleware.auth import get_current_user, require_shop_owner
from app.models.user import User
from app.models.shop import ShopEmployee, Shop
from app.models.product import Product
from app.schemas.shop import ShopUpdate, EmployeeCreate, EmployeePermissionUpdate, VoucherCreate
from app.services.shop_service import (
    get_shop, update_shop, create_employee, update_employee_permissions,
    delete_employee, get_shop_analytics, create_voucher,
)
from app.services.order_service import get_shop_orders
from app.services.product_service import get_products

router = APIRouter()


def get_effective_shop_id(current_user: User, db: Session) -> int:
    """Trả về shop_id thực tế: chủ shop → user_id, nhân viên → shop_id trong shop_employees."""
    # Thử là chủ shop trước
    shop = db.query(Shop).filter(Shop.shop_id == current_user.user_id).first()
    if shop:
        return current_user.user_id
    # Thử là nhân viên
    emp = db.query(ShopEmployee).filter(
        ShopEmployee.user_id == current_user.user_id,
        ShopEmployee.status == "active",
    ).first()
    if emp:
        return emp.shop_id
    # Fallback
    return current_user.user_id


@router.get("/search")
def search_shops(
    q:     str            = Query("", description="Tên shop cần tìm"),
    page:  int            = Query(1, ge=1),
    limit: int            = Query(10, ge=1, le=50),
    db:    Session        = Depends(get_db),
):
    """Tìm shop theo tên — public, không cần auth."""
    query = db.query(Shop).filter(Shop.verification_status == "approved")
    if q.strip():
        query = query.filter(Shop.shop_name.ilike(f"%{q.strip()}%"))
    total = query.count()
    shops = query.order_by(Shop.rating.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "shops": [
            {
                "shop_id":   s.shop_id,
                "shop_name": s.shop_name,
                "avatar_url": s.avatar_url,
                "address":   s.address,
                "rating":    str(s.rating) if s.rating else "0.0",
                "total_orders": s.total_orders or 0,
            }
            for s in shops
        ],
        "total": total,
    }


@router.get("/public/{shop_id}")
def get_public_shop(shop_id: int, db: Session = Depends(get_db)):
    """Public shop profile — no auth required."""
    from app.models.product import Product
    from fastapi import HTTPException
    shop = db.query(Shop).filter(Shop.shop_id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    products = (
        db.query(Product)
        .filter(Product.shop_id == shop_id, Product.status == "active", Product.deleted_at.is_(None))
        .order_by(Product.sales_count.desc())
        .all()
    )
    return {
        "shop_id": shop.shop_id,
        "shop_name": shop.shop_name,
        "description": shop.description,
        "avatar_url": shop.avatar_url,
        "address": shop.address,
        "phone": shop.phone,
        "rating": str(shop.rating) if shop.rating else "0.0",
        "total_followers": shop.total_followers or 0,
        "total_orders": shop.total_orders or 0,
        "verification_status": shop.verification_status,
        "verified_at": str(shop.verified_at) if shop.verified_at else None,
        "created_at": str(shop.created_at) if shop.created_at else None,
        "products": [
            {
                "product_id": p.product_id,
                "product_name": p.product_name,
                "price": str(p.price),
                "image_urls": p.image_urls,
                "rating": str(p.rating) if p.rating else "0.0",
                "total_reviews": p.total_reviews or 0,
                "sales_count": p.sales_count or 0,
                "stock_quantity": p.stock_quantity,
                "category_id": p.category_id,
                "category_name": p.category.category_name if p.category else None,
            }
            for p in products
        ],
    }


@router.get("/me")
def my_shop(current_user: User = Depends(require_shop_owner), db: Session = Depends(get_db)):
    from sqlalchemy import text
    # Dùng raw SQL để lấy cả status/suspended_reason (cột có thể mới thêm)
    row = db.execute(
        text("""
            SELECT shop_id, shop_name, description, avatar_url, address, phone,
                   rating, total_followers, total_orders, verification_status,
                   COALESCE(status, 'active') AS status,
                   suspended_reason, suspended_at,
                   mall_request_status
            FROM shops WHERE shop_id = :sid
        """),
        {"sid": current_user.user_id}
    ).fetchone()
    if not row:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Shop not found")
    return {
        "shop_id":              row.shop_id,
        "shop_name":            row.shop_name,
        "description":          row.description,
        "avatar_url":           row.avatar_url,
        "address":              row.address,
        "phone":                row.phone,
        "rating":               row.rating,
        "total_followers":      row.total_followers,
        "total_orders":         row.total_orders,
        "verification_status":  row.verification_status,
        "status":               row.status,
        "suspended_reason":     row.suspended_reason,
        "suspended_at":         str(row.suspended_at) if row.suspended_at else None,
        "mall_request_status":  row.mall_request_status,
    }


@router.put("/me")
def update_my_shop(
    data: ShopUpdate,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    shop = update_shop(db, current_user.user_id, data)
    return {"message": "Shop updated", "shop_id": shop.shop_id}


@router.get("/products")
def shop_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    status: Optional[str] = None,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    from app.models.product import Product
    shop_id = get_effective_shop_id(current_user, db)
    query = db.query(Product).filter(Product.shop_id == shop_id, Product.deleted_at.is_(None))
    if status:
        query = query.filter(Product.status == status)
    products = query.order_by(Product.created_at.desc()).all()
    return {
        "products": [
            {
                "product_id": p.product_id,
                "product_name": p.product_name,
                "description": p.description,
                "price": p.price,
                "stock_quantity": p.stock_quantity,
                "status": p.status,
                "sales_count": p.sales_count,
                "image_urls": p.image_urls,
                "category_id": p.category_id,
                "category_name": p.category.category_name if p.category else None,
            }
            for p in products
        ]
    }


@router.get("/orders")
def shop_orders(
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1),
    order_status: Optional[str] = None,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    shop_id = get_effective_shop_id(current_user, db)
    items, total, pages = get_shop_orders(db, shop_id, page, limit, order_status)
    return {
        "orders": [
            {
                "order_id": o.order_id,
                "user_id": o.user_id,
                "user_name": o.recipient_name or (o.user.full_name if o.user else None),
                "phone": o.recipient_phone or (o.user.phone if o.user else None),
                "delivery_address": o.shipping_address,
                "final_price": o.final_price,
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
                "payment_trans_id": o.payment.trans_id if o.payment else None,
                "payment_confirmed_at": str(o.payment.updated_at) if o.payment and o.payment.status == "success" else None,
                "order_status": o.order_status,
                "created_at": str(o.created_at),
                "items": [
                    {
                        "product_name": i.product_name,
                        "quantity": i.quantity,
                        "price": float(i.price_at_order) if i.price_at_order is not None else 0,
                    }
                    for i in o.items
                ],
            }
            for o in items
        ],
        "total": total,
        "pages": pages,
    }


@router.get("/analytics")
def shop_analytics(
    days: int = 30,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    shop_id = get_effective_shop_id(current_user, db)
    return get_shop_analytics(db, shop_id, days)


@router.post("/employees", status_code=201)
def add_employee(
    data: EmployeeCreate,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    employee, plain_password = create_employee(db, current_user.user_id, current_user.user_id, data)
    resp: dict = {
        "message": "Employee added",
        "employee_id": employee.employee_id,
        "login_email": data.employee_email,
    }
    if plain_password:
        # Chỉ trả về 1 lần — backend không lưu plaintext
        resp["login_password"] = plain_password
        resp["note"] = "Lưu lại mật khẩu này ngay, hệ thống không hiển thị lại!"
    return resp


@router.get("/employees")
def list_employees(current_user: User = Depends(require_shop_owner), db: Session = Depends(get_db)):
    employees = db.query(ShopEmployee).filter(
        ShopEmployee.shop_id == current_user.user_id,
        ShopEmployee.status == "active",
    ).all()
    return {
        "employees": [
            {
                "employee_id": e.employee_id,
                "user_id": e.user_id,
                "employee_name": e.employee_name,
                "position": e.position,
                "status": e.status,
                "permissions": [p.permission_code for p in e.permissions],
            }
            for e in employees
        ]
    }


@router.put("/employees/{employee_id}/permissions")
def update_permissions(
    employee_id: int,
    data: EmployeePermissionUpdate,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    update_employee_permissions(db, employee_id, current_user.user_id, data)
    return {"message": "Permissions updated"}


@router.delete("/employees/{employee_id}")
def remove_employee(
    employee_id: int,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    delete_employee(db, employee_id, current_user.user_id)
    return {"message": "Employee removed"}


# ─── Mall tier ────────────────────────────────────────────────────────────────

@router.post("/me/request-mall")
def request_mall(
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Shop gửi yêu cầu lên Mall."""
    shop = db.query(Shop).filter(Shop.shop_id == current_user.user_id).first()
    if not shop:
        raise HTTPException(404, "Shop không tồn tại")
    if shop.is_mall:
        raise HTTPException(400, "Shop đã là BuyZo Mall")
    if shop.mall_request_status == "pending":
        raise HTTPException(400, "Đã có yêu cầu đang chờ duyệt")
    shop.mall_request_status = "pending"
    shop.mall_requested_at   = datetime.utcnow()
    db.commit()
    return {"message": "Đã gửi yêu cầu lên BuyZo Mall, chờ admin duyệt"}


# ─── Public: sản phẩm nổi bật & Mall ─────────────────────────────────────────

def _product_row(p) -> dict:
    return {
        "product_id":   p.product_id,
        "product_name": p.product_name,
        "price":        str(p.price),
        "image_urls":   p.image_urls,
        "rating":       str(p.rating) if p.rating else "0.0",
        "total_reviews": p.total_reviews or 0,
        "sales_count":  p.sales_count or 0,
        "shop_id":      p.shop_id,
        "shop_name":    p.shop.shop_name if p.shop else None,
    }


@router.get("/public/featured/products")
def featured_products(
    limit: int = Query(12, ge=1, le=40),
    db: Session = Depends(get_db),
):
    """Sản phẩm nổi bật (Flash Sale section) — top bán chạy đang active."""
    products = (
        db.query(Product)
        .filter(Product.status == "active", Product.deleted_at.is_(None))
        .order_by(Product.sales_count.desc(), Product.rating.desc())
        .limit(limit)
        .all()
    )
    return {"products": [_product_row(p) for p in products]}


@router.get("/public/new-products")
def new_products(
    limit: int = Query(12, ge=1, le=40),
    db: Session = Depends(get_db),
):
    """Sản phẩm mới được duyệt gần đây — sắp xếp theo approved_at DESC."""
    products = (
        db.query(Product)
        .filter(Product.status == "active", Product.deleted_at.is_(None), Product.approved_at.isnot(None))
        .order_by(Product.approved_at.desc())
        .limit(limit)
        .all()
    )
    return {"products": [_product_row(p) for p in products]}


@router.get("/public/mall/products")
def mall_products(
    limit: int = Query(12, ge=1, le=40),
    db: Session = Depends(get_db),
):
    """Sản phẩm từ các shop BuyZo Mall (is_mall=True)."""
    mall_shop_ids = [
        s.shop_id for s in db.query(Shop.shop_id).filter(Shop.is_mall == True).all()
    ]
    if not mall_shop_ids:
        return {"products": [], "has_mall": False}

    products = (
        db.query(Product)
        .filter(
            Product.shop_id.in_(mall_shop_ids),
            Product.status == "active",
            Product.deleted_at.is_(None),
        )
        .order_by(Product.sales_count.desc())
        .limit(limit)
        .all()
    )
    return {"products": [_product_row(p) for p in products], "has_mall": True}


@router.post("/vouchers", status_code=201)
def add_voucher(
    data: VoucherCreate,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    voucher = create_voucher(db, current_user.user_id, data)
    return {"message": "Voucher created", "voucher_id": voucher.voucher_id}


@router.get("/vouchers")
def list_vouchers(current_user: User = Depends(require_shop_owner), db: Session = Depends(get_db)):
    from app.models.voucher import Voucher
    # [V-4] filter theo shop_id, không phải created_by (owner đổi → vẫn thấy voucher)
    vouchers = db.query(Voucher).filter(
        Voucher.shop_id == current_user.user_id,
        Voucher.voucher_type == "shop",
    ).all()
    return {
        "vouchers": [
            {
                "voucher_id":     v.voucher_id,
                "code":           v.code,
                "discount_type":  v.discount_type,
                "discount_value": float(v.discount_value or 0),
                "min_order_value":float(v.min_order_value or 0) if v.min_order_value else None,
                "max_discount":   float(v.max_discount) if v.max_discount else None,
                "status":         v.status,
                "current_uses":   v.current_uses,
                "max_uses":       v.max_uses,
                "valid_from":     str(v.valid_from) if v.valid_from else None,
                "valid_to":       str(v.valid_to) if v.valid_to else None,
            }
            for v in vouchers
        ]
    }


# [V-7] Shop sửa voucher của mình
@router.put("/vouchers/{voucher_id}")
def update_voucher(
    voucher_id: int,
    data: dict,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    from app.models.voucher import Voucher
    v = db.query(Voucher).filter(
        Voucher.voucher_id == voucher_id,
        Voucher.shop_id == current_user.user_id,
        Voucher.voucher_type == "shop",
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Voucher không tìm thấy hoặc không thuộc shop này")
    allowed = {"discount_type", "discount_value", "min_order_value", "max_discount",
               "max_uses", "valid_from", "valid_to", "status"}
    for key, val in data.items():
        if key in allowed:
            setattr(v, key, val)
    db.commit()
    return {"message": "Đã cập nhật voucher"}


# [V-7] Shop xóa voucher của mình
@router.delete("/vouchers/{voucher_id}")
def delete_voucher(
    voucher_id: int,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    from app.models.voucher import Voucher
    v = db.query(Voucher).filter(
        Voucher.voucher_id == voucher_id,
        Voucher.shop_id == current_user.user_id,
        Voucher.voucher_type == "shop",
    ).first()
    if not v:
        raise HTTPException(status_code=404, detail="Voucher không tìm thấy hoặc không thuộc shop này")
    if v.current_uses > 0:
        # Không xóa nếu đã có người dùng — chỉ vô hiệu hóa
        v.status = "inactive"
        db.commit()
        return {"message": "Voucher đã được sử dụng, đã chuyển sang trạng thái inactive"}
    db.delete(v)
    db.commit()
    return {"message": "Đã xóa voucher"}
