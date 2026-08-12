import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { Product, ProductFilters, Category } from '../../types/product'
import API from '../../services/api'

interface ProductState {
  products: Product[]
  selectedProduct: Product | null
  categories: Category[]
  total: number
  page: number
  pages: number
  filters: ProductFilters
  loading: boolean
  loadingMore: boolean
  loopLoading: boolean
  error: string | null
}

const initialState: ProductState = {
  products: [],
  selectedProduct: null,
  categories: [],
  total: 0,
  page: 1,
  pages: 0,
  filters: { page: 1, limit: 12, sort: 'popular' },
  loading: false,
  loadingMore: false,
  loopLoading: false,
  error: null,
}

export const fetchProducts = createAsyncThunk(
  'product/fetchAll',
  async (filters: ProductFilters, { rejectWithValue }) => {
    try {
      const params = new URLSearchParams()
      Object.entries(filters).forEach(([k, v]) => { if (v !== undefined && v !== null) params.set(k, String(v)) })
      const res = await API.get(`/api/v1/products?${params}`)
      return res.data
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Lỗi tải sản phẩm')
    }
  }
)

export const fetchProductById = createAsyncThunk(
  'product/fetchById',
  async (id: number, { rejectWithValue }) => {
    try {
      const res = await API.get(`/api/v1/products/${id}`)
      return res.data
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail)
    }
  }
)

export const fetchCategories = createAsyncThunk('product/fetchCategories', async () => {
  const res = await API.get('/api/v1/products/categories')
  return res.data.categories
})

const productSlice = createSlice({
  name: 'product',
  initialState,
  reducers: {
    setFilters(state, action: PayloadAction<Partial<ProductFilters>>) {
      state.filters = { ...state.filters, ...action.payload }
    },
    resetFilters(state, action: PayloadAction<Partial<ProductFilters> | undefined>) {
      state.filters = { page: 1, limit: 12, sort: 'popular', ...action.payload }
    },
    clearSelectedProduct(state) {
      state.selectedProduct = null
    },
    appendProducts(state, action: PayloadAction<{ products: Product[]; total: number; page: number; pages: number }>) {
      state.products = [...state.products, ...action.payload.products]
      state.total = action.payload.total
      state.page = action.payload.page
      state.pages = action.payload.pages
      state.loadingMore = false
    },
    resetProducts(state) {
      state.products = []
      state.page = 1
      state.pages = 0
      state.total = 0
    },
    setLoadingMore(state, action: PayloadAction<boolean>) {
      state.loadingMore = action.payload
    },
    setLoopLoading(state, action: PayloadAction<boolean>) {
      state.loopLoading = action.payload
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false
        state.products = action.payload.products
        state.total = action.payload.total
        state.page = action.payload.page
        state.pages = action.payload.pages
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchProductById.pending, (state) => { state.loading = true })
      .addCase(fetchProductById.fulfilled, (state, action) => {
        state.loading = false
        state.selectedProduct = action.payload
      })
      .addCase(fetchProductById.rejected, (state) => { state.loading = false })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories = action.payload
      })
  },
})

export const { setFilters, resetFilters, clearSelectedProduct, appendProducts, resetProducts, setLoadingMore, setLoopLoading } = productSlice.actions
export default productSlice.reducer
