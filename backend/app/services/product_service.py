import re
import unicodedata
from difflib import SequenceMatcher
from typing import Optional
from sqlalchemy import or_, case, func
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.models.product import Product, ProductCategory, ProductDeletionRequest, ProductDeletionAuditLog
from app.models.shop import Shop
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, DeletionRequestCreate
from app.utils.helpers import paginate


def _normalize_name(name: str) -> str:
    """Chuẩn hoá tên sản phẩm để so khớp gần đúng: bỏ dấu tiếng Việt, lowercase,
    gọn khoảng trắng — để "Áo Thun Nam" và "ao thun nam" được coi là giống nhau."""
    if not name:
        return ""
    nfkd = unicodedata.normalize("NFD", name)
    no_accent = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")
    no_accent = no_accent.replace("đ", "d").replace("Đ", "D")
    return re.sub(r"\s+", " ", no_accent.lower()).strip()


def find_similar_products(
    db: Session,
    name: str,
    exclude_product_id: Optional[int] = None,
    limit: int = 5,
    threshold: float = 0.55,
):
    """Tìm sản phẩm có tên tương đồng với `name` (dùng khi shop thêm sản phẩm
    mới — gợi ý "sản phẩm này có thể đã tồn tại", và khi admin duyệt — cảnh
    báo có sản phẩm trùng lặp). So khớp gần đúng bằng tỉ lệ tương đồng chuỗi
    sau khi đã chuẩn hoá (bỏ dấu, lowercase), không chỉ khớp tuyệt đối.
    """
    norm_target = _normalize_name(name)
    if len(norm_target) < 3:
        return []

    # KHÔNG dùng ILIKE để prefilter: tên đã chuẩn hoá (bỏ dấu) trong khi
    # product_name trong DB vẫn còn dấu tiếng Việt, nên ILIKE trên chuỗi bỏ
    # dấu sẽ không khớp được với dữ liệu có dấu (vd tìm "ao" sẽ không khớp
    # "Áo"). Quy mô sản phẩm của hệ thống còn nhỏ nên quét trực tiếp một tập
    # ứng viên giới hạn (500 sản phẩm mới nhất) rồi tính similarity trong
    # Python là đủ nhanh và chính xác hơn.
    query = db.query(Product).filter(Product.deleted_at.is_(None))
    if exclude_product_id:
        query = query.filter(Product.product_id != exclude_product_id)
    candidates = query.order_by(Product.created_at.desc()).limit(500).all()

    scored = []
    for p in candidates:
        ratio = SequenceMatcher(None, norm_target, _normalize_name(p.product_name)).ratio()
        if ratio >= threshold:
            scored.append((ratio, p))
    scored.sort(key=lambda x: x[0], reverse=True)

    return [
        {
            "product_id": p.product_id,
            "product_name": p.product_name,
            "shop_id": p.shop_id,
            "shop_name": p.shop.shop_name if p.shop else None,
            "price": str(p.price),
            "image_urls": p.image_urls or [],
            "status": p.status,
            "similarity": round(ratio, 2),
        }
        for ratio, p in scored[:limit]
    ]


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

    # ── Boost (top slot đang thắng) — sản phẩm đang boost trồi lên đầu trong
    # MỌI danh sách đi qua hàm này: tìm kiếm (search), duyệt danh mục
    # (category_id), và widget "sản phẩm liên quan" ở trang chi tiết sản
    # phẩm (cũng gọi get_products với category_id) — 3 vị trí đã chốt với
    # người dùng. Không cần match tag tường minh vì sản phẩm boost chỉ nổi
    # lên khi nó ĐÃ khớp bộ lọc hiện tại (cùng category / khớp từ khoá).
    from app.models.slot_auctions import ProductBoost
    boosted_ids = db.query(ProductBoost.product_id).filter(ProductBoost.expires_at > func.now())
    query = query.order_by(case((Product.product_id.in_(boosted_ids), 0), else_=1))

    if category_id:
        query = query.filter(Product.category_id == category_id)
    if shop_id:
        query = query.filter(Product.shop_id == shop_id)
    if search:
        # Tìm theo nhiều trường thay vì chỉ product_name — vd tìm "kem đánh răng"
        # (tên category) hoặc "dior" (tên shop) vẫn phải ra đúng sản phẩm liên quan,
        # không chỉ khi từ khoá xuất hiện nguyên văn trong tên sản phẩm.
        like = f"%{search}%"
        query = (
            query
            .outerjoin(ProductCategory, Product.category_id == ProductCategory.category_id)
            .outerjoin(Shop, Product.shop_id == Shop.shop_id)
            .filter(or_(
                Product.product_name.ilike(like),
                Product.description.ilike(like),
                ProductCategory.category_name.ilike(like),
                Shop.shop_name.ilike(like),
            ))
        )
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

    from app.utils.tagging import sync_product_tags
    sync_product_tags(db, product)

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

    if "product_name" in data.model_dump(exclude_none=True) or "category_id" in data.model_dump(exclude_none=True):
        from app.utils.tagging import sync_product_tags
        sync_product_tags(db, product)

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
    """Admin duyệt sản phẩm → hiện luôn trên sàn (status='active').

    Trước đây set status='approved' và bắt shop phải tự bấm "Đăng bán"
    (activate_product) mới thật sự lên sàn — mâu thuẫn với thông báo gửi cho
    shop lúc duyệt ("đã được duyệt và đang được bày bán trên hệ thống").
    Nay duyệt xong là active ngay, không cần bước thủ công thứ hai.
    """
    from datetime import datetime
    product = db.query(Product).filter(Product.product_id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    product.status = "active"
    product.approved_at = datetime.utcnow()
    db.commit()
    db.refresh(product)
    return product


def activate_product(db: Session, product_id: int) -> Product:
    """Shop bấm Đăng bán — chuyển approved → active."""
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
