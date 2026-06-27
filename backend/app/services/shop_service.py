from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException

from app.models.shop import Shop, ShopEmployee, EmployeeRolePermission
from app.models.user import User, Role, UserRole
from app.models.order import Order
from app.models.product import Product
from app.models.voucher import Voucher
from app.schemas.shop import ShopUpdate, EmployeeCreate, EmployeePermissionUpdate, VoucherCreate
from app.utils.security import hash_password
import random
import string


def get_shop(db: Session, shop_id: int) -> Shop:
    shop = db.query(Shop).filter(Shop.shop_id == shop_id).first()
    if not shop:
        raise HTTPException(status_code=404, detail="Shop not found")
    return shop


def update_shop(db: Session, shop_id: int, data: ShopUpdate) -> Shop:
    shop = get_shop(db, shop_id)
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(shop, field, value)
    db.commit()
    db.refresh(shop)
    return shop


def create_employee(db: Session, shop_id: int, owner_id: int, data: EmployeeCreate) -> tuple:
    """Trả về (ShopEmployee, plain_password | None).
    plain_password != None chỉ khi tạo account mới hoặc shop tự đặt mật khẩu.
    """
    # Find or create user by email
    user = db.query(User).filter(User.email == data.employee_email).first()
    plain_password: str | None = None
    if not user:
        # Dùng mật khẩu shop đặt, hoặc tự sinh nếu không có
        plain_password = data.password or "".join(
            random.choices(string.ascii_letters + string.digits, k=12)
        )
        user = User(
            email=data.employee_email,
            password_hash=hash_password(plain_password),
            full_name=data.employee_name,
            status="active",
        )
        db.add(user)
        db.flush()
    else:
        # Tài khoản đã tồn tại — nếu shop muốn đặt lại pass thì cho phép
        if data.password:
            plain_password = data.password
            user.password_hash = hash_password(data.password)

    # Check not already employee
    existing = db.query(ShopEmployee).filter(
        ShopEmployee.user_id == user.user_id,
        ShopEmployee.shop_id == shop_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="User is already an employee of this shop")

    employee = ShopEmployee(
        user_id=user.user_id,
        shop_id=shop_id,
        employee_name=data.employee_name,
        position=data.position,
        hired_date=data.hired_date,
        created_by=owner_id,
    )
    db.add(employee)
    db.flush()

    # Assign employee role — current_role=True cho account mới tạo
    is_new_account = plain_password is not None
    emp_role = db.query(Role).filter(Role.role_name == "employee").first()
    if emp_role:
        existing_role = db.query(UserRole).filter(
            UserRole.user_id == user.user_id,
            UserRole.role_id == emp_role.role_id,
        ).first()
        if not existing_role:
            db.add(UserRole(
                user_id=user.user_id,
                role_id=emp_role.role_id,
                assigned_by=owner_id,
                current_role=is_new_account,  # True → login sẽ vào employee dashboard
                status="active",
            ))

    # Assign permissions
    for perm_code in data.permissions:
        db.add(EmployeeRolePermission(
            employee_id=employee.employee_id,
            permission_code=perm_code,
            granted_by=owner_id,
        ))

    db.commit()
    db.refresh(employee)
    return employee, plain_password


def update_employee_permissions(db: Session, employee_id: int, shop_id: int, data: EmployeePermissionUpdate):
    employee = db.query(ShopEmployee).filter(
        ShopEmployee.employee_id == employee_id,
        ShopEmployee.shop_id == shop_id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    # Remove old permissions
    db.query(EmployeeRolePermission).filter(
        EmployeeRolePermission.employee_id == employee_id
    ).delete()

    # Add new permissions
    for perm_code in data.permissions:
        db.add(EmployeeRolePermission(
            employee_id=employee_id,
            permission_code=perm_code,
            granted_by=employee.shop_id,
        ))

    db.commit()


def delete_employee(db: Session, employee_id: int, shop_id: int):
    employee = db.query(ShopEmployee).filter(
        ShopEmployee.employee_id == employee_id,
        ShopEmployee.shop_id == shop_id,
    ).first()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")
    employee.status = "inactive"
    db.commit()


def get_shop_analytics(db: Session, shop_id: int, days: int = 30) -> dict:
    from datetime import datetime, timedelta
    start_date = datetime.utcnow() - timedelta(days=days)

    orders = db.query(Order).filter(
        Order.shop_id == shop_id,
        Order.order_status.in_(["completed", "delivered"]),
        Order.created_at >= start_date,
    ).all()

    total_revenue = sum(float(o.final_price) for o in orders)
    total_orders = len(orders)

    top_products = db.query(
        Product.product_id,
        Product.product_name,
        Product.sales_count,
        Product.rating,
    ).filter(
        Product.shop_id == shop_id,
        Product.deleted_at.is_(None),
    ).order_by(Product.sales_count.desc()).limit(5).all()

    return {
        "total_revenue": total_revenue,
        "total_orders": total_orders,
        "total_products": db.query(Product).filter(Product.shop_id == shop_id, Product.deleted_at.is_(None)).count(),
        "top_products": [
            {"product_id": p.product_id, "product_name": p.product_name, "sales": p.sales_count, "rating": p.rating}
            for p in top_products
        ],
        "daily_revenue": [],
        "order_status_counts": {
            status: db.query(Order).filter(Order.shop_id == shop_id, Order.order_status == status).count()
            for status in ["pending", "confirmed", "shipping", "completed", "cancelled"]
        },
    }


def create_voucher(db: Session, created_by: int, data: VoucherCreate) -> Voucher:
    existing = db.query(Voucher).filter(Voucher.code == data.code).first()
    if existing:
        raise HTTPException(status_code=400, detail="Voucher code already exists")

    voucher = Voucher(
        code=data.code,
        discount_type=data.discount_type,
        discount_value=str(data.discount_value),
        min_order_value=str(data.min_order_value) if data.min_order_value else None,
        max_discount=str(data.max_discount) if data.max_discount else None,
        max_uses=data.max_uses,
        valid_from=data.valid_from,
        valid_to=data.valid_to,
        created_by=created_by,
    )
    db.add(voucher)
    db.commit()
    db.refresh(voucher)
    return voucher
