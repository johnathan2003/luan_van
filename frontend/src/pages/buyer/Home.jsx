import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { productAPI } from "../../services/api";
import useCartStore from "../../store/cartStore";

function ProductCard({ product }) {
  const { addItem } = useCartStore();
  const price = new Intl.NumberFormat("vi-VN").format(product.price);
  const original = product.original_price ? new Intl.NumberFormat("vi-VN").format(product.original_price) : null;

  return (
    <div style={{ background: "#fff", borderRadius: 8, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.08)", transition: "transform .15s", cursor: "pointer" }}
      onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px)"}
      onMouseLeave={e => e.currentTarget.style.transform = "none"}>
      <Link to={`/products/${product.id}`} style={{ textDecoration: "none", color: "inherit" }}>
        <div style={{ aspectRatio: "1", overflow: "hidden", background: "#f5f5f5" }}>
          <img src={product.thumbnail || "/placeholder.png"} alt={product.name}
            style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
        <div style={{ padding: "10px 12px" }}>
          <div style={{ fontSize: 13, color: "#333", marginBottom: 4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {product.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ color: "#ee4d2d", fontWeight: 700, fontSize: 15 }}>₫{price}</span>
            {original && <span style={{ color: "#aaa", fontSize: 11, textDecoration: "line-through" }}>₫{original}</span>}
          </div>
          {product.discount_percent > 0 && (
            <span style={{ background: "#ee4d2d", color: "#fff", fontSize: 10, padding: "2px 5px", borderRadius: 3 }}>-{product.discount_percent}%</span>
          )}
          <div style={{ marginTop: 4, fontSize: 12, color: "#888" }}>
            ⭐ {product.rating} · Đã bán {product.total_sold}
          </div>
        </div>
      </Link>
      <div style={{ padding: "0 12px 12px" }}>
        <button onClick={() => addItem(product.id)}
          style={{ width: "100%", padding: "7px", background: "#fff0ee", color: "#ee4d2d", border: "1px solid #ee4d2d", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 500 }}>
          + Giỏ hàng
        </button>
      </div>
    </div>
  );
}

export default function Home() {
  const [searchParams] = useSearchParams();
  const [filters, setFilters] = useState({
    search: searchParams.get("search") || "",
    ordering: "-total_sold",
    page: 1,
  });

  const { data, isLoading } = useQuery({
    queryKey: ["products", filters],
    queryFn: () => productAPI.list(filters).then(r => r.data),
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: () => productAPI.categories().then(r => r.data),
  });

  return (
    <div>
      {/* Categories */}
      <div style={{ background: "#fff", borderRadius: 8, padding: "16px 20px", marginBottom: 16, display: "flex", gap: 20, overflowX: "auto" }}>
        <button onClick={() => setFilters(p => ({ ...p, category: "" }))}
          style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #ee4d2d", background: !filters.category ? "#ee4d2d" : "#fff", color: !filters.category ? "#fff" : "#ee4d2d", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
          Tất cả
        </button>
        {(categories?.results || categories || []).map(cat => (
          <button key={cat.id} onClick={() => setFilters(p => ({ ...p, category: cat.slug }))}
            style={{ padding: "6px 14px", borderRadius: 20, border: "1px solid #ddd", background: filters.category === cat.slug ? "#ee4d2d" : "#fff", color: filters.category === cat.slug ? "#fff" : "#444", cursor: "pointer", fontSize: 13, whiteSpace: "nowrap" }}>
            {cat.name}
          </button>
        ))}
      </div>

      {/* Sort & Filter bar */}
      <div style={{ background: "#fff", borderRadius: 8, padding: "12px 20px", marginBottom: 16, display: "flex", gap: 12, alignItems: "center" }}>
        <span style={{ fontSize: 13, color: "#666" }}>Sắp xếp:</span>
        {[
          { label: "Bán chạy", value: "-total_sold" },
          { label: "Mới nhất", value: "-created_at" },
          { label: "Giá thấp", value: "price" },
          { label: "Giá cao", value: "-price" },
          { label: "Đánh giá", value: "-rating" },
        ].map(opt => (
          <button key={opt.value} onClick={() => setFilters(p => ({ ...p, ordering: opt.value }))}
            style={{ padding: "5px 12px", borderRadius: 4, border: "1px solid", borderColor: filters.ordering === opt.value ? "#ee4d2d" : "#ddd", background: filters.ordering === opt.value ? "#fff0ee" : "#fff", color: filters.ordering === opt.value ? "#ee4d2d" : "#444", cursor: "pointer", fontSize: 13 }}>
            {opt.label}
          </button>
        ))}
        <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
          <input type="number" placeholder="Giá từ" onChange={e => setFilters(p => ({ ...p, min_price: e.target.value }))}
            style={{ width: 90, padding: "5px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13 }} />
          <input type="number" placeholder="Đến" onChange={e => setFilters(p => ({ ...p, max_price: e.target.value }))}
            style={{ width: 90, padding: "5px 8px", border: "1px solid #ddd", borderRadius: 4, fontSize: 13 }} />
        </div>
      </div>

      {/* Products Grid */}
      {isLoading ? (
        <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Đang tải sản phẩm...</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 }}>
            {(data?.results || []).map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          {data?.results?.length === 0 && (
            <div style={{ textAlign: "center", padding: 60, color: "#888" }}>Không tìm thấy sản phẩm nào</div>
          )}
          {/* Pagination */}
          {data?.total_pages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 24 }}>
              {Array.from({ length: data.total_pages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setFilters(prev => ({ ...prev, page: p }))}
                  style={{ padding: "6px 12px", border: "1px solid", borderColor: filters.page === p ? "#ee4d2d" : "#ddd", background: filters.page === p ? "#ee4d2d" : "#fff", color: filters.page === p ? "#fff" : "#444", borderRadius: 4, cursor: "pointer" }}>
                  {p}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
