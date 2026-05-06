from celery import shared_task
import logging

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=2)
def moderate_product(self, product_id):
    """
    AI kiểm duyệt sản phẩm sau khi seller đăng.
    Chạy async qua Celery.
    
    Giai đoạn 1 (MVP): Rule-based đơn giản
    Giai đoạn 3: Tích hợp model AI thật
    """
    try:
        from apps.products.models import Product

        product = Product.objects.get(id=product_id)
        flags = []
        score = 1.0

        # --- Rule-based checks (MVP) ---
        BANNED_KEYWORDS = ["súng", "ma túy", "vũ khí", "cấm", "giả mạo"]
        name_lower = product.name.lower()
        desc_lower = product.description.lower()

        for keyword in BANNED_KEYWORDS:
            if keyword in name_lower or keyword in desc_lower:
                flags.append(f"Chứa từ khoá bị cấm: {keyword}")
                score -= 0.5

        if product.price <= 0:
            flags.append("Giá sản phẩm không hợp lệ")
            score -= 0.3

        if len(product.description) < 20:
            flags.append("Mô tả sản phẩm quá ngắn")
            score -= 0.1

        # Cập nhật kết quả
        product.ai_score = max(0, score)
        product.ai_flags = flags

        if score <= 0:
            product.status = Product.Status.REJECTED
            product.rejection_reason = "AI phát hiện nội dung vi phạm: " + "; ".join(flags)
        elif flags:
            product.status = Product.Status.FLAGGED
        else:
            product.status = Product.Status.APPROVED

        product.save(update_fields=["status", "ai_score", "ai_flags", "rejection_reason"])
        logger.info(f"Product {product_id} moderated: {product.status}")

    except Exception as exc:
        logger.error(f"Moderation failed for {product_id}: {exc}")
        raise self.retry(exc=exc, countdown=120)


@shared_task
def moderate_review(review_id):
    """AI kiểm duyệt review trước khi hiển thị"""
    from apps.products.models import ProductReview

    review = ProductReview.objects.get(id=review_id)
    TOXIC_WORDS = ["đụ", "vcl", "đm", "spam", "scam"]
    comment_lower = review.comment.lower()

    is_toxic = any(word in comment_lower for word in TOXIC_WORDS)
    review.is_visible = not is_toxic
    review.save(update_fields=["is_visible"])


@shared_task
def update_recommendations():
    """
    Batch job chạy mỗi 6 tiếng để update recommendation cache.
    MVP: Dựa trên category và lượt mua.
    Giai đoạn 3: Collaborative filtering thật.
    """
    from django.core.cache import cache
    from apps.products.models import Product
    from apps.orders.models import OrderItem
    from django.db.models import Count

    # Top sản phẩm bán chạy theo category
    top_by_category = {}
    items = (
        OrderItem.objects.values("product__category_id")
        .annotate(total=Count("id"))
        .order_by("-total")[:100]
    )
    for item in Product.objects.filter(status="approved").order_by("-total_sold")[:50]:
        cat_id = str(item.category_id)
        if cat_id not in top_by_category:
            top_by_category[cat_id] = []
        top_by_category[cat_id].append(str(item.id))

    cache.set("recommendations:by_category", top_by_category, timeout=60 * 60 * 6)
    logger.info("Recommendations updated")


def get_recommendations_for_user(user, limit=10):
    """Lấy gợi ý sản phẩm cho user dựa trên lịch sử mua"""
    from django.core.cache import cache
    from apps.products.models import Product
    from apps.orders.models import OrderItem

    # Lấy category user hay mua
    user_categories = (
        OrderItem.objects.filter(order__buyer=user)
        .values_list("product__category_id", flat=True)
        .distinct()[:5]
    )

    top_by_category = cache.get("recommendations:by_category", {})

    product_ids = []
    for cat_id in user_categories:
        product_ids.extend(top_by_category.get(str(cat_id), [])[:3])

    if not product_ids:
        # Fallback: top sản phẩm toàn sàn
        return Product.objects.filter(status="approved").order_by("-total_sold")[:limit]

    return Product.objects.filter(id__in=product_ids, status="approved")[:limit]
