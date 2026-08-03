
import json as _json
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, UploadFile, File, Body

from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user, require_shop_owner, get_current_user_optional
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, DeletionRequestCreate, CategoryCreate
from app.services.product_service import (
    get_products, get_product_by_id, create_product, update_product,
    delete_product_direct, approve_product, reject_product, activate_product,
    create_deletion_request, get_categories, create_category,
)
from app.utils.upload_service import save_upload_file

router = APIRouter()


@router.get("")
def list_products(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    category_id: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    shop_id: Optional[int] = None,
    search: Optional[str] = None,
    sort: str = "newest",
    db: Session = Depends(get_db),
):
    items, total, pages = get_products(db, page, limit, category_id, min_price, max_price, shop_id, search, sort)
    return {
        "products": [
            {
                "product_id": p.product_id,
                "shop_id": p.shop_id,
                "product_name": p.product_name,
                "price": p.price,
                "stock_quantity": p.stock_quantity,
                "image_urls": p.image_urls,
                "rating": p.rating,
                "sales_count": p.sales_count,
                "category_id": p.category_id,
                "status": p.status,
            }
            for p in items
        ],
        "total": total,
        "page": page,
        "pages": pages,
    }


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)):
    cats = get_categories(db)
    return {"categories": [{"category_id": c.category_id, "category_name": c.category_name, "icon_url": c.icon_url} for c in cats]}


@router.get("/{product_id}")
def get_product(product_id: int, db: Session = Depends(get_db)):
    product = get_product_by_id(db, product_id)
    shop = product.shop if hasattr(product, 'shop') else None
    return {
        "product_id": product.product_id,
        "shop_id": product.shop_id,
        "shop_name": shop.shop_name if shop else None,
        "shop_rating": str(shop.rating) if shop and shop.rating else None,
        "product_name": product.product_name,
        "description": product.description,
        "price": product.price,
        "cost": product.cost,
        "stock_quantity": product.stock_quantity,
        "image_urls": product.image_urls,
        "status": product.status,
        "rating": product.rating,
        "total_reviews": product.total_reviews,
        "views_count": product.views_count,
        "sales_count": product.sales_count,
        "category_id": product.category_id,
        "category_name": product.category.category_name if product.category else None,
        "created_at": str(product.created_at) if product.created_at else None,
        "variants": [
            {
                "variant_id": v.variant_id,
                "variant_name": v.variant_name,
                "sku": v.sku,
                "price": str(v.price),
                "stock": v.stock,
                "image_url": v.image_url,
                "attrs": _json.loads(v.attrs_json) if v.attrs_json else [],
            }
            for v in (product.variants or [])
        ],
    }


@router.post("", status_code=201)
def add_product(
    data: ProductCreate,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    product = create_product(db, current_user.user_id, data)
    return {"message": "Product created, pending approval", "product_id": product.product_id, "status": product.status}


@router.put("/{product_id}")
def edit_product(
    product_id: int,
    data: ProductUpdate,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    product = update_product(db, product_id, current_user.user_id, data)
    return {"message": "Product updated", "product_id": product.product_id}


@router.delete("/{product_id}")
def remove_product(
    product_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    user_roles = {ur.role.role_name for ur in current_user.user_roles if ur.status == "active"}
    if "admin" not in user_roles and "shop" not in user_roles:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Insufficient permission")
    delete_product_direct(db, product_id, current_user.user_id)
    return {"message": "Product deleted"}


@router.post("/{product_id}/activate")
def publish_product(
    product_id: int,
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Shop bấm Đăng bán — chuyển từ approved → active."""
    product = activate_product(db, product_id)
    return {"message": "Product is now active", "product_id": product.product_id, "status": product.status}


@router.post("/{product_id}/deletion-request", status_code=201)
def request_deletion(
    product_id: int,
    data: DeletionRequestCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.models.product import Product
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Product not found")
    req = create_deletion_request(db, product_id, product.shop_id, current_user.user_id, data)
    return {"message": "Deletion request submitted", "request_id": req.deletion_req_id}


@router.post("/categories", status_code=201)
def add_category(data: CategoryCreate, db: Session = Depends(get_db)):
    cat = create_category(db, data)
    return {"message": "Category created", "category_id": cat.category_id}


@router.post("/{product_id}/variants/sync")
def sync_product_variants(
    product_id: int,
    variants: List[dict] = Body(...),
    current_user: User = Depends(require_shop_owner),
    db: Session = Depends(get_db),
):
    """Đồng bộ variants (bao gồm attrs) từ localStorage lên DB."""
    from sqlalchemy import text
    from app.models.product import Product as ProductModel
    from fastapi import HTTPException
    product = db.query(ProductModel).filter(ProductModel.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    # Check ownership (owner or employee)
    if product.shop_id != current_user.user_id:
        from app.models.shop import ShopEmployee
        emp = db.query(ShopEmployee).filter(
            ShopEmployee.user_id == current_user.user_id,
            ShopEmployee.shop_id == product.shop_id,
            ShopEmployee.status == "active",
        ).first()
        if not emp:
            raise HTTPException(status_code=403, detail="Not authorized")
    # Replace all variants
    db.execute(text("DELETE FROM product_variants WHERE product_id = :pid"), {"pid": product_id})
    for v in variants:
        img_list = v.get("image_urls") or []
        image_url = img_list[0] if img_list else v.get("image_url")
        db.execute(text("""
            INSERT INTO product_variants (product_id, variant_name, sku, price, stock, image_url, attrs_json)
            VALUES (:pid, :name, :sku, :price, :stock, :image_url, :attrs_json)
        """), {
            "pid": product_id,
            "name": v.get("name", ""),
            "sku": str(v.get("id", "")),
            "price": float(v.get("price", 0)),
            "stock": int(v.get("stock", 0)),
            "image_url": image_url,
            "attrs_json": _json.dumps(v.get("attrs", [])),
        })
    db.commit()
    return {"message": "Variants synced", "count": len(variants)}


@router.post("/upload-image")
async def upload_product_image(file: UploadFile = File(...)):
    url = await save_upload_file(file, "products")
    return {"url": url}


# ─── Product Reviews [S-4] ───────────────────────────────────────────────────

@router.get("/{product_id}/reviews")
def list_product_reviews(
    product_id: int,
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Xem danh sách review của sản phẩm (public)."""
    from app.models.product import ProductReview
    q = db.query(ProductReview).filter(ProductReview.product_id == product_id)
    total = q.count()
    items = q.order_by(ProductReview.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "reviews": [
            {
                "review_id":  r.review_id,
                "user_id":    r.user_id,
                "user_name":  r.user.full_name if r.user else "Ẩn danh",
                "rating":     r.rating,
                "title":      r.title,
                "content":    r.content,
                "verified":   r.verified,
                "helpful":    r.helpful,
                "created_at": str(r.created_at),
            }
            for r in items
        ],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit,
    }


@router.post("/{product_id}/reviews", status_code=201)
def create_product_review(
    product_id: int,
    data: dict,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """[S-4] User đã mua sản phẩm có thể gửi review."""
    from app.models.product import Product, ProductReview
    from app.models.order import Order, OrderItem
    from sqlalchemy import func as sqlfunc

    # Kiểm tra sản phẩm tồn tại
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Sản phẩm không tồn tại")

    rating = data.get("rating")
    if not isinstance(rating, int) or not (1 <= rating <= 5):
        raise HTTPException(status_code=400, detail="Rating phải từ 1 đến 5")

    # Xác nhận user đã từng mua và đơn completed
    purchased = (
        db.query(OrderItem)
        .join(Order, Order.order_id == OrderItem.order_id)
        .filter(
            OrderItem.product_id == product_id,
            Order.user_id == current_user.user_id,
            Order.order_status == "completed",
        )
        .first()
    )

    # Kiểm tra đã review chưa
    existing = db.query(ProductReview).filter(
        ProductReview.product_id == product_id,
        ProductReview.user_id == current_user.user_id,
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Bạn đã đánh giá sản phẩm này rồi")

    review = ProductReview(
        product_id=product_id,
        user_id=current_user.user_id,
        rating=rating,
        title=data.get("title", "").strip() or None,
        content=data.get("content", "").strip() or None,
        verified=bool(purchased),   # True nếu đã mua
    )
    db.add(review)
    db.flush()

    # Cập nhật avg rating và total_reviews
    agg = db.query(
        sqlfunc.avg(ProductReview.rating).label("avg_rating"),
        sqlfunc.count(ProductReview.review_id).label("count"),
    ).filter(ProductReview.product_id == product_id).first()
    product.rating = round(float(agg.avg_rating or 0), 2)
    product.total_reviews = agg.count or 0

    db.commit()
    return {"message": "Cảm ơn bạn đã đánh giá!", "review_id": review.review_id}
