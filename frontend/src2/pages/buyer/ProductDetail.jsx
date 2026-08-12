import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productAPI } from "../../services/api";
import useCartStore from "../../store/cartStore";
import useAuthStore from "../../store/authStore";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const { isAuthenticated } = useAuthStore();
  const [qty, setQty] = useState(1);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [activeImg, setActiveImg] = useState(0);

  const { data: product, isLoading } = useQuery({
    queryKey: ["product", id],
    queryFn: () => productAPI.detail(id).then(r => r.data),
  });

  const { data: reviewsData } = useQuery({
    queryKey: ["reviews", id],
    queryFn: () => productAPI.reviews(id).then(r => r.data),
    enabled: !!product,
  });

  if (isLoading) return <div style={{ textAlign: "center", padding: 80 }}>Đang tải...</div>;
  if (!product) return <div>Không tìm thấy sản phẩm</div>;

  const images = [{ image: product.thumbnail }, ...(product.images || [])];
  const currentPrice = selectedVariant ? selectedVariant.price : product.price;
  const priceFormatted = new Intl.NumberFormat("vi-VN").format(currentPrice);

  const handleBuyNow = () => {
    if (!isAuthenticated) { navigate("/login"); return; }
    addItem(product.id, qty, selectedVariant?.id);
    navigate("/cart");
  };

  return (
    <div>
      {/* Product info */}
      <div style={{ background: "#fff", borderRadius: 8, padding: 24, display: "grid", gridTemplateColumns: "400px 1fr", gap: 32, marginBottom: 16 }}>
        {/* Images */}
        <div>
          <div style={{ aspectRatio: "1", background: "#f5f5f5", borderRadius: 8, overflow: "hidden", marginBottom: 12 }}>
            <img src={images[activeImg]?.image || "/placeholder.png"} alt={product.name}
              style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          </div>
          <div style={{ display: "flex", gap: 8, overflowX: "auto" }}>
            {images.map((img, i) => (
              <img key={i} src={img.image} alt="" onClick={() => setActiveImg(i)}
                style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 4, cursor: "pointer", border: activeImg === i ? "2px solid #ee4d2d" : "2px solid transparent" }} />
            ))}
          </div>
        </div>

        {/* Details */}
        <div>
          <div style={{ fontSize: 12, color: "#ee4d2d", marginBottom: 8 }}>{product.shop_name} · ⭐ {product.shop_rating}</div>
          <h1 style={{ fontSize: 20, fontWeight: 600, color: "#222", marginBottom: 12, lineHeight: 1.4 }}>{product.name}</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <span style={{ color: "#888", fontSize: 13 }}>⭐ {product.rating}</span>
            <span style={{ color: "#888", fontSize: 13 }}>|</span>
            <span style={{ color: "#888", fontSize: 13 }}>{product.total_reviews} đánh giá</span>
            <span style={{ color: "#888", fontSize: 13 }}>|</span>
            <span style={{ color: "#888", fontSize: 13 }}>Đã bán {product.total_sold}</span>
          </div>

          <div style={{ background: "#fafafa", borderRadius: 8, padding: "16px 20px", marginBottom: 20 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: "#ee4d2d" }}>₫{priceFormatted}</span>
            {product.original_price && (
              <span style={{ fontSize: 16, color: "#aaa", textDecoration: "line-through", marginLeft: 12 }}>
                ₫{new Intl.NumberFormat("vi-VN").format(product.original_price)}
              </span>
            )}
            {product.discount_percent > 0 && (
              <span style={{ background: "#ee4d2d", color: "#fff", fontSize: 12, padding: "3px 7px", borderRadius: 3, marginLeft: 10 }}>-{product.discount_percent}%</span>
            )}
          </div>

          {/* Variants */}
          {product.variants?.length > 0 && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 13, color: "#666", marginBottom: 8 }}>Phân loại:</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {product.variants.map(v => (
                  <button key={v.id} onClick={() => setSelectedVariant(v)}
                    style={{ padding: "6px 14px", border: "1px solid", borderColor: selectedVariant?.id === v.id ? "#ee4d2d" : "#ddd", borderRadius: 4, background: selectedVariant?.id === v.id ? "#fff0ee" : "#fff", color: selectedVariant?.id === v.id ? "#ee4d2d" : "#444", cursor: "pointer", fontSize: 13 }}>
                    {v.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <span style={{ fontSize: 13, color: "#666" }}>Số lượng:</span>
            <div style={{ display: "flex", alignItems: "center", border: "1px solid #ddd", borderRadius: 4 }}>
              <button onClick={() => setQty(q => Math.max(1, q - 1))} style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>−</button>
              <span style={{ width: 40, textAlign: "center", fontSize: 14 }}>{qty}</span>
              <button onClick={() => setQty(q => q + 1)} style={{ width: 32, height: 32, border: "none", background: "none", cursor: "pointer", fontSize: 16 }}>+</button>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: 12 }}>
            <button onClick={() => { if (!isAuthenticated) { navigate("/login"); return; } addItem(product.id, qty, selectedVariant?.id); }}
              style={{ flex: 1, padding: "13px", background: "#fff0ee", color: "#ee4d2d", border: "1px solid #ee4d2d", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              🛒 Thêm vào giỏ
            </button>
            <button onClick={handleBuyNow}
              style={{ flex: 1, padding: "13px", background: "#ee4d2d", color: "#fff", border: "none", borderRadius: 6, fontSize: 15, fontWeight: 600, cursor: "pointer" }}>
              Mua ngay
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      <div style={{ background: "#fff", borderRadius: 8, padding: 24, marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #eee" }}>MÔ TẢ SẢN PHẨM</h2>
        <p style={{ fontSize: 14, color: "#444", lineHeight: 1.7, whiteSpace: "pre-wrap" }}>{product.description}</p>
      </div>

      {/* Reviews */}
      <div style={{ background: "#fff", borderRadius: 8, padding: 24 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16, paddingBottom: 12, borderBottom: "1px solid #eee" }}>
          ĐÁNH GIÁ SẢN PHẨM ({product.total_reviews})
        </h2>
        {(reviewsData?.results || []).map(review => (
          <div key={review.id} style={{ padding: "16px 0", borderBottom: "1px solid #f5f5f5" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#ee4d2d", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 13, fontWeight: 600 }}>
                {review.user_name?.[0]}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{review.user_name}</div>
                <div style={{ fontSize: 12, color: "#ee4d2d" }}>{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</div>
              </div>
            </div>
            <p style={{ fontSize: 14, color: "#444", margin: 0 }}>{review.comment}</p>
          </div>
        ))}
        {!reviewsData?.results?.length && <p style={{ color: "#888", fontSize: 14 }}>Chưa có đánh giá nào.</p>}
      </div>
    </div>
  );
}
