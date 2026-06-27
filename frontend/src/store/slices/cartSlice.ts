import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { Cart } from '../../types/order'
import API from '../../services/api'

interface CartState {
  cart: Cart
  loading: boolean
  error: string | null
}

const initialState: CartState = {
  cart: { items: [], total: 0, item_count: 0 },
  loading: false,
  error: null,
}

export const fetchCart = createAsyncThunk('cart/fetch', async (_, { rejectWithValue }) => {
  try {
    const res = await API.get('/api/v1/carts')
    return res.data.data ?? res.data
  } catch (err: any) {
    return rejectWithValue(err.response?.data?.detail || 'Lỗi tải giỏ hàng')
  }
})

export const addToCart = createAsyncThunk(
  'cart/add',
  async (data: { product_id: number; quantity: number }, { dispatch, rejectWithValue }) => {
    try {
      await API.post('/api/v1/carts/items', data)
      dispatch(fetchCart())
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Thêm vào giỏ thất bại')
    }
  }
)

export const updateCartItem = createAsyncThunk(
  'cart/update',
  async (data: { cart_id: number; quantity: number }, { dispatch, rejectWithValue }) => {
    try {
      await API.put(`/api/v1/carts/items/${data.cart_id}`, { quantity: data.quantity })
      dispatch(fetchCart())
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail)
    }
  }
)

export const removeFromCart = createAsyncThunk(
  'cart/remove',
  async (cart_id: number, { dispatch, rejectWithValue }) => {
    try {
      await API.delete(`/api/v1/carts/items/${cart_id}`)
      dispatch(fetchCart())
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail)
    }
  }
)

export const clearCart = createAsyncThunk('cart/clear', async (_, { dispatch }) => {
  await API.delete('/api/v1/carts')
  dispatch(fetchCart())
})

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCart.pending, (state) => { state.loading = true })
      .addCase(fetchCart.fulfilled, (state, action) => {
        state.loading = false
        state.cart = action.payload
      })
      .addCase(fetchCart.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
  },
})

export default cartSlice.reducer
