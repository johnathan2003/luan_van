from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user
from app.models.user import User
from app.services import voucher_service

router = APIRouter()


@router.get("/platform")
def get_platform_vouchers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"vouchers": voucher_service.list_platform_vouchers(db, current_user.user_id)}


@router.get("/shop")
def get_shop_vouchers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"vouchers": voucher_service.list_shop_vouchers(db, current_user.user_id)}


@router.get("/my")
def get_my_vouchers(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return {"vouchers": voucher_service.list_my_collected_vouchers(db, current_user.user_id)}


@router.post("/{voucher_id}/collect", status_code=201)
def collect_voucher(voucher_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    voucher_service.collect_voucher(db, current_user.user_id, voucher_id)
    return {"message": "Đã thu thập voucher"}
