from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from typing import Optional

from app.database import get_db
from app.middleware.auth import require_admin
from app.models.user import User
from app.services.admin_service import (
    get_all_users, ban_user, unban_user,
    get_shop_registrations, approve_shop_registration, reject_shop_registration,
    get_shipper_registrations, approve_shipper_registration, reject_shipper_registration,
    get_deletion_requests, resolve_dispute, get_admin_dashboard, create_system_employee,
)
from app.services.product_service import approve_product, reject_product, get_pending_products
from app.services.notification_service import create_notification

router = APIRouter()


@router.get("/dashboard")
def dashboard(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    return get_admin_dashboard(db)


# ─── Users ─────────────────────────────────────────────────────────────────────

@router.get("/users")
def list_users(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1),
    user_status: Optional[str] = None,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    items, total, pages = get_all_users(db, page, limit, user_status=user_status)
    return {
        "users": [
            {
                "user_id": u.user_id,
                "email": u.email,
                "full_name": u.full_name,
                "status": u.status,
                "created_at": str(u.created_at),
                "roles": [ur.role.role_name for ur in u.user_roles if ur.status == "active"],
            }
            for u in items
        ],
        "total": total,
        "pages": pages,
    }


@router.put("/users/{user_id}/ban")
def ban(user_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = ban_user(db, current_user.user_id, user_id)
    return {"message": "User banned", "user_id": user.user_id}


@router.put("/users/{user_id}/unban")
def unban(user_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    user = unban_user(db, current_user.user_id, user_id)
    return {"message": "User unbanned", "user_id": user.user_id}


# ─── Shop Registrations ─────────────────────────────────────────────────────────

@router.get("/shop-registrations")
def shop_regs(
    page: int = 1, limit: int = 20, status: str = "pending",
    current_user: User = Depends(require_admin), db: Session = Depends(get_db),
):
    items, total, pages = get_shop_registrations(db, page, limit, status)
    return {
        "registrations": [
            {"reg_id": r.reg_id, "user_id": r.user_id, "shop_name": r.shop_name, "status": r.status, "created_at": str(r.created_at)}
            for r in items
        ],
        "total": total,
    }


@router.put("/shop-registrations/{reg_id}/approve")
def approve_shop(reg_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    shop = approve_shop_registration(db, current_user.user_id, reg_id)
    return {"message": "Shop approved", "shop_id": shop.shop_id}


@router.put("/shop-registrations/{reg_id}/reject")
def reject_shop(reg_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    reject_shop_registration(db, current_user.user_id, reg_id, data.get("reason", ""))
    return {"message": "Shop registration rejected"}


# ─── Shipper Registrations ────────────────────────────────────────────────────

@router.get("/shipper-registrations")
def shipper_regs(
    page: int = 1, limit: int = 20, status: str = "pending",
    current_user: User = Depends(require_admin), db: Session = Depends(get_db),
):
    items, total, pages = get_shipper_registrations(db, page, limit, status)
    return {
        "registrations": [
            {"reg_id": r.reg_id, "user_id": r.user_id, "vehicle_type": r.vehicle_type, "status": r.status}
            for r in items
        ],
        "total": total,
    }


@router.put("/shipper-registrations/{reg_id}/approve")
def approve_shipper(reg_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    shipper = approve_shipper_registration(db, current_user.user_id, reg_id)
    return {"message": "Shipper approved", "shipper_id": shipper.shipper_id}


@router.put("/shipper-registrations/{reg_id}/reject")
def reject_shipper(reg_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    reject_shipper_registration(db, current_user.user_id, reg_id, data.get("reason", ""))
    return {"message": "Shipper registration rejected"}


# ─── Products ────────────────────────────────────────────────────────────────

@router.get("/products/pending")
def pending_products(page: int = 1, limit: int = 20, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    items, total, pages = get_pending_products(db, page, limit)
    return {
        "products": [{"product_id": p.product_id, "product_name": p.product_name, "shop_id": p.shop_id, "status": p.status} for p in items],
        "total": total,
    }


@router.put("/products/{product_id}/approve")
def approve_prod(product_id: int, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    product = approve_product(db, product_id, current_user.user_id)
    create_notification(db, product.shop_id, "Sản phẩm được duyệt", f"Sản phẩm '{product.product_name}' đã được duyệt", "product_approved", "product", product_id)
    return {"message": "Product approved"}


@router.put("/products/{product_id}/reject")
def reject_prod(product_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    product = reject_product(db, product_id, data.get("reason", ""))
    return {"message": "Product rejected"}


# ─── Deletion Requests ───────────────────────────────────────────────────────

@router.get("/deletion-requests")
def deletion_reqs(page: int = 1, limit: int = 20, status: str = "pending", current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    items, total, pages = get_deletion_requests(db, page, limit, status)
    return {
        "requests": [
            {"deletion_req_id": r.deletion_req_id, "product_id": r.product_id, "reason": r.reason, "status": r.status}
            for r in items
        ],
        "total": total,
    }


# ─── Disputes ────────────────────────────────────────────────────────────────

@router.get("/disputes")
def list_disputes(page: int = 1, limit: int = 20, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.dispute import Dispute
    from app.utils.helpers import paginate
    items, total, pages = paginate(db.query(Dispute).filter(Dispute.status == "open"), page, limit)
    return {
        "disputes": [
            {"dispute_id": d.dispute_id, "order_id": d.order_id, "initiated_party": d.initiated_party, "status": d.status}
            for d in items
        ],
        "total": total,
    }


@router.put("/disputes/{dispute_id}/resolve")
def resolve_disp(dispute_id: int, data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    resolve_dispute(db, current_user.user_id, dispute_id, data.get("decision"), data.get("resolution_details", ""))
    return {"message": "Dispute resolved"}


# ─── System Employees ─────────────────────────────────────────────────────────

@router.post("/system-employees", status_code=201)
def add_sys_employee(data: dict, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    emp = create_system_employee(
        db, current_user.user_id,
        data["employee_email"], data["employee_name"],
        data.get("role_name", "general"),
        data.get("permissions", []),
    )
    return {"message": "System employee created", "emp_id": emp.emp_id}


@router.get("/system-employees")
def list_sys_employees(current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.shop import SystemEmployee
    employees = db.query(SystemEmployee).filter(SystemEmployee.status == "active").all()
    return {
        "employees": [
            {"emp_id": e.emp_id, "user_id": e.user_id, "emp_name": e.emp_name, "role_name": e.role_name}
            for e in employees
        ]
    }


@router.get("/logs")
def admin_logs(page: int = 1, limit: int = 50, current_user: User = Depends(require_admin), db: Session = Depends(get_db)):
    from app.models.logs import AdminLog
    from app.utils.helpers import paginate
    items, total, pages = paginate(db.query(AdminLog).order_by(AdminLog.created_at.desc()), page, limit)
    return {
        "logs": [
            {"log_id": l.log_id, "admin_id": l.admin_id, "action": l.action, "target_type": l.target_type, "created_at": str(l.created_at)}
            for l in items
        ],
        "total": total,
    }
