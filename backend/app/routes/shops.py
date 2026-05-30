from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.middleware.auth import get_current_user, require_shop_owner
from app.models.user import User
from app.models.shop import ShopEmployee, Shop
from app.schemas.shop import ShopUpdate, EmployeeCreate, EmployeePermissionUpdate, VoucherCreate
from app.services.shop_service import (
    get_shop, update_shop, create_employee, update_employee_permissions,
    delete_employee, get_shop_analytics, create_voucher,
)
from app.services.order_service import get_shop_orders
from app.services.product_service import get_products

router = APIRouter()


@router.get("/me")
def my_shop(current_user: User = Depends(require_shop_owner), db: Session = Depends(get_db)):
    shop = get_shop(db, current_user.user_id)
    return {
        "shop_id": shop.shop_id,
        "shop_name": shop.shop_name,
        "description": shop.description,
        "avatar_url": shop.avatar_url,
        "address": shop.address,
        "phone": shop.phone,
        "rating": shop.rating,
        "total_followers": shop.total_followers,
        "total_orders": shop.total_orders,
        "verification_status": shop.verification_status,
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
    query = db.query(Product).filter(Product.shop_id == current_user.user_id, Product.deleted_at.is_(None))
    if status:
        query = query.filter(Product.status == status)
    products = query.order_by(Product.created_at.desc()).all()
    return {
        "products": [
            {
                "product_id": p.product_id,
                "product_name": p.product_name,
                "price": p.price,
                "stock_quantity": p.stock_quantity,
                "status": p.status,
                "sales_count": p.sales_count,
                "image_urls": p.image_urls,
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
    items, total, pages = get_shop_orders(db, current_user.user_id, page, limit, order_status)
    return {
        "orders": [
            {
                "order_id": o.order_id,
                "user_id": o.user_id,
                "final_price": o.final_price,
                "payment_method": o.payment_method,
                "payment_status": o.payment_status,
                "order_status": o.order_status,
                "created_at": str(o.created_at),
                "items": [{"product_name": i.product_name, "quantity": i.quantity} for i in o.items],
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
    return get_shop_analytics(db, current_user.user_id, days)


@router.post("/employees", status_code=201)
def add_employee(
    data: EmployeeCreate,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    employee = create_employee(db, current_user.user_id, current_user.user_id, data)
    return {"message": "Employee added", "employee_id": employee.employee_id}


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
    vouchers = db.query(Voucher).filter(Voucher.created_by == current_user.user_id).all()
    return {
        "vouchers": [
            {
                "voucher_id": v.voucher_id,
                "code": v.code,
                "discount_type": v.discount_type,
                "discount_value": v.discount_value,
                "status": v.status,
                "current_uses": v.current_uses,
                "max_uses": v.max_uses,
            }
            for v in vouchers
        ]
    }
