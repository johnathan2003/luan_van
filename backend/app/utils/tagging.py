"""
app/utils/tagging.py
------------------------
Tự sinh tag cho sản phẩm từ category + tên sản phẩm (dùng chung toàn hệ
thống, không riêng gì top slot) — gọi mỗi khi tạo/sửa sản phẩm.

Tag dùng để:
  - Hiển thị / lọc (tương lai).
  - Đối chiếu với sản phẩm đang được "boost" (product_boosts, sinh ra khi 1
    top_slot_auctions thắng và lên hệ thống) — xem app/services/product_
    service.py::get_products() để biết cách boost áp dụng vào tìm kiếm /
    danh mục / sản phẩm liên quan.
"""
import re
import unicodedata
from sqlalchemy.orm import Session

_STOPWORDS = {
    "va", "cho", "voi", "loai", "hang", "cua", "la", "cac", "nhung",
    "mot", "hai", "ba", "the", "and", "for", "with", "the", "of",
}


def _normalize(s: str) -> str:
    """Bỏ dấu tiếng Việt, lowercase, gọn khoảng trắng."""
    if not s:
        return ""
    nfkd = unicodedata.normalize("NFD", s)
    no_accent = "".join(c for c in nfkd if unicodedata.category(c) != "Mn")
    no_accent = no_accent.replace("đ", "d").replace("Đ", "D")
    return re.sub(r"\s+", " ", no_accent.lower()).strip()


def sync_product_tags(db: Session, product) -> None:
    """Sinh lại toàn bộ tag của 1 sản phẩm — gọi sau khi tạo/sửa sản phẩm
    (product đã có product_id, category_id, product_name).

    Tag gồm: tên category (chuẩn hoá), tên sản phẩm đầy đủ (chuẩn hoá), và
    từng từ có nghĩa trong tên sản phẩm. Không tự commit thêm lần nữa nếu
    caller đã trong 1 transaction — hàm này tự commit ở cuối cho gọn, giống
    cách save_upload_file() ghi MediaAsset."""
    from app.models.slot_auctions import ProductTag, ProductTagMap
    from app.models.product import ProductCategory

    tags: set[str] = set()

    if getattr(product, "category_id", None):
        cat = db.query(ProductCategory).filter(
            ProductCategory.category_id == product.category_id
        ).first()
        if cat and cat.category_name:
            norm_cat = _normalize(cat.category_name)
            if norm_cat:
                tags.add(norm_cat)
                tags.update(w for w in norm_cat.split() if len(w) >= 2 and w not in _STOPWORDS)

    name = getattr(product, "product_name", None)
    if name:
        norm_name = _normalize(name)
        if norm_name:
            tags.add(norm_name)
            tags.update(w for w in norm_name.split() if len(w) >= 2 and w not in _STOPWORDS)

    tags.discard("")
    if not tags:
        return

    try:
        tag_ids = []
        for t in tags:
            tag = db.query(ProductTag).filter(ProductTag.tag_name == t).first()
            if not tag:
                tag = ProductTag(tag_name=t)
                db.add(tag)
                db.flush()
            tag_ids.append(tag.tag_id)

        db.query(ProductTagMap).filter(ProductTagMap.product_id == product.product_id).delete()
        for tid in tag_ids:
            db.add(ProductTagMap(product_id=product.product_id, tag_id=tid))
        db.commit()
    except Exception:
        # Best-effort — sinh tag lỗi không được làm hỏng luồng tạo/sửa sản phẩm.
        db.rollback()
