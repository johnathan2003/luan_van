"""
Public endpoints — không cần auth:
  GET /api/v1/shipping/size-tiers   — shop/shipper đọc bảng phí kích thước
  GET /api/v1/system/revenue-config — shop/shipper đọc % phân chia doanh thu
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.database import get_db

router = APIRouter()


@router.get("/shipping/size-tiers")
def public_size_tiers(db: Session = Depends(get_db)):
    """Trả 5 bậc kích thước + bậc quá khổ (tier 6 synthetic)."""
    from app.models.admin_config import ShippingSizeTier
    tiers = db.query(ShippingSizeTier).order_by(ShippingSizeTier.tier_level).all()
    result = [
        {
            "tier_level":    t.tier_level,
            "label":         t.label,
            "max_length_cm": t.max_length_cm,
            "max_width_cm":  t.max_width_cm,
            "max_height_cm": t.max_height_cm,
            "max_weight_kg": float(t.max_weight_kg),
            "extra_fee":     t.extra_fee,
        }
        for t in tiers
    ]
    # Thêm bậc 6 (quá khổ) synthetic để frontend dùng
    result.append({
        "tier_level":    6,
        "label":         "Quá khổ",
        "max_length_cm": None,
        "max_width_cm":  None,
        "max_height_cm": None,
        "max_weight_kg": None,
        "extra_fee":     200000,
    })
    return {"tiers": result}


@router.get("/system/revenue-config")
def public_revenue_config(db: Session = Depends(get_db)):
    """Trả cấu hình % doanh thu đang active."""
    from app.models.admin_config import RevenueConfig
    cfg = (
        db.query(RevenueConfig)
        .filter(RevenueConfig.is_active == True)
        .order_by(RevenueConfig.config_id.desc())
        .first()
    )
    if not cfg:
        # Fallback mặc định nếu chưa có DB row
        return {"shop_rate": 70.0, "admin_rate": 15.0, "shipper_rate": 5.0, "vat_rate": 10.0}
    return {
        "shop_rate":    float(cfg.shop_rate),
        "admin_rate":   float(cfg.admin_rate),
        "shipper_rate": float(cfg.shipper_rate),
        "vat_rate":     float(cfg.vat_rate),
    }
