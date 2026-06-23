from typing import Optional
from fastapi import APIRouter, Depends, Query, UploadFile, File
from sqlalchemy.orm import Session

from app.database import get_db
from app.middleware.auth import get_current_user, require_shop_owner, get_current_user_optional
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, DeletionRequestCreate, CategoryCreate
from app.services.product_service import (
    get_products, get_product_by_id, create_product, update_product,
    delete_product_direct, approve_product, reject_product,
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


@router.post("/upload-image")
async def upload_product_image(file: UploadFile = File(...)):
    url = await save_upload_file(file, "products")
    return {"url": url}
