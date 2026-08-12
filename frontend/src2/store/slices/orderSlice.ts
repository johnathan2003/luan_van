import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import type { Order } from '../../types/order'
import API from '../../services/api'

interface OrderState {
  orders: Order[]
  selectedOrder: Order | null
  total: number
  pages: number
  loading: boolean
  error: string | null
}

const initialState: OrderState = {
  orders: [],
  selectedOrder: null,
  total: 0,
  pages: 0,
  loading: false,
  error: null,
}

export const fetchOrders = createAsyncThunk(
  'order/fetchAll',
  async (params: { page?: number; order_status?: string } = {}, { rejectWithValue }) => {
    try {
      const qs = new URLSearchParams()
      if (params.page) qs.set('page', String(params.page))
      if (params.order_status) qs.set('order_status', params.order_status)
      const res = await API.get(`/api/v1/orders/me?${qs}`)
      return res.data
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail)
    }
  }
)

export const fetchOrderById = createAsyncThunk(
  'order/fetchById',
  async (id: number, { rejectWithValue }) => {
    try {
      const res = await API.get(`/api/v1/orders/${id}`)
      return res.data
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail)
    }
  }
)

const orderSlice = createSlice({
  name: 'order',
  initialState,
  reducers: {
    clearSelectedOrder(state) { state.selectedOrder = null },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOrders.pending, (state) => { state.loading = true; state.error = null })
      .addCase(fetchOrders.fulfilled, (state, action) => {
        state.loading = false
        state.orders = action.payload.orders
        state.total = action.payload.total
        state.pages = action.payload.pages
      })
      .addCase(fetchOrders.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      .addCase(fetchOrderById.fulfilled, (state, action) => {
        state.selectedOrder = action.payload
      })
  },
})

export const { clearSelectedOrder } = orderSlice.actions
export default orderSlice.reducer
