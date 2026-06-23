export interface Category {
  category_id: number
  category_name: string
  icon_url?: string
  description?: string
}

export interface Product {
  product_id: number
  shop_id: number
  shop_name?: string
  shop_rating?: string
  category_id?: number
  category_name?: string
  product_name: string
  description?: string
  price: string
  cost?: string
  stock_quantity: number
  image_urls?: string[]
  status: 'active' | 'pending' | 'rejected' | 'archived'
  rating: string
  total_reviews: number
  views_count: number
  sales_count: number
  category?: Category
  created_at?: string
}

export interface ProductCreate {
  product_name: string
  description?: string
  price: number
  cost?: number
  stock_quantity: number
  category_id?: number
  image_urls?: string[]
}

export interface ProductUpdate {
  product_name?: string
  description?: string
  price?: number
  stock_quantity?: number
  category_id?: number
  image_urls?: string[]
}

export interface ProductListResponse {
  products: Product[]
  total: number
  page: number
  pages: number
}

export interface ProductFilters {
  page?: number
  limit?: number
  category_id?: number
  min_price?: number
  max_price?: number
  shop_id?: number
  search?: string
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'popular' | 'rating'
}
