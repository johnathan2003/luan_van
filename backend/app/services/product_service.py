from typing import Optional
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.product import Product, ProductCategory, ProductDeletionRequest, ProductDeletionAuditLog
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, DeletionRequestCreate
from app.utils.helpers import paginate


def get_products(
    db: Session,
    page: int = 1,
    limit: int = 20,
    category_id: Optional[int] = None,
    min_price: Optional[float] = None,
    max_price: Optional[float] = None,
    shop_id: Optional[int] = None,
    search: Optional[str] = None,
    sort: str = "newest",
):
    query = db.query(Product).filter(Product.status == "active", Product.deleted_at.is_(None))

    if category_id:
        query = query.filter(Product.category_id == category_id)
    if shop_id:
        query = query.filter(Product.shop_id == shop_id)
    if search:
        query = query.filter(Product.product_name.ilike(f"%{search}%"))
    if min_price is not None:
        query = query.filter(Product.price >= str(min_price))
    if max_price is not None:
        query = query.filter(Product.price <= str(max_price))

    if sort == "newest":
        query = query.order_by(Product.created_at.desc())
    elif sort == "price_asc":
        query = query.order_by(Product.price.asc())
    elif sort == "price_desc":
        query = query.order_by(Product.price.desc())
    elif sort == "popular":
        query = query.order_by(Product.sales_count.desc())
    elif sort == "rating":
        query = query.order_by(Product.rating.desc())

    items, total, pages = paginate(query, page, limit)
    return items, total, pages


def get_product_by_id(db: Session, product_id: int) -> Product:
    product = db.query(Product).filter(
        Product.product_id == product_id,
        Product.deleted_at.is_(None),
    ).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    # Increment view count
    product.views_count += 1
    db.commit()
    return product


def create_product(db: Session, shop_id: int, data: ProductCreate) -> Product:
    product = Product(
        shop_id=shop_id,
        product_name=data.product_name,
        description=data.description,
        price=str(data.price),
        cost=str(data.cost) if data.cost else None,
        stock_quantity=data.stock_quantity,
        category_id=data.category_id,
        image_urls=data.image_urls,
        status="pending",
    )
    db.add(product)
    db.commit()
    db.refresh(product)
    return product


def update_product(db: Session, product_id: int, shop_id: int, data: ProductUpdate) -> Product:
    product = db.query(Product).filter(
        Product.product_id == product_id,
        Product.shop_id == shop_id,
        Product.deleted_at.is_(None),
    ).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    for field, value in data.model_dump(exclude_none=True).items():
        if field == "price" and value is not None:
            setattr(product, field, str(value))
        elif field == "cost" and value is not None:
            setattr(product, field, str(value))
        else:
            setattr(product, field, value)

    db.commit()
    db.refresh(product)
    return product


def delete_product_direct(db: Session, product_id: int, deleted_by: int, reason: str = None):
    """Direct deletion by admin or shop owner."""
    from datetime import datetime
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

    product_name = product.product_name
    shop_id = product.shop_id

    product.deleted_at = datetime.utcnow()
    product.deleted_by = deleted_by
    product.status = "archived"

    audit = ProductDeletionAuditLog(
        product_id=product_id,
        product_name=product_name,
        shop_id=shop_id,
        deleted_by=deleted_by,
        deletion_type="direct",
        reason=reason,
    )
    db.add(audit)
    db.commit()


def approve_product(db: Session, product_id: int, reviewer_id: int) -> Product:
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.status = "active"
    db.commit()
    db.refresh(product)
    return product


def reject_product(db: Session, product_id: int, reason: str) -> Product:
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.status = "rejected"
    db.commit()
    db.refresh(product)
    return product


def create_deletion_request(db: Session, product_id: int, shop_id: int, requested_by: int, data: DeletionRequestCreate) -> ProductDeletionRequest:
    req = ProductDeletionRequest(
        product_id=product_id,
        shop_id=shop_id,
        requested_by=requested_by,
        reason=data.reason,
    )
    db.add(req)
    db.commit()
    db.refresh(req)
    return req


def get_pending_products(db: Session, page: int = 1, limit: int = 20):
    query = db.query(Product).filter(Product.status == "pending")
    return paginate(query, page, limit)


def get_categories(db: Session) -> list:
    return db.query(ProductCategory).all()


def create_category(db: Session, data) -> ProductCategory:
    cat = ProductCategory(
        category_name=data.category_name,
        description=data.description,
        icon_url=data.icon_url,
    )
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat
