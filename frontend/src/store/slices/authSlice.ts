import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit'
import type { User, AuthState, LoginRequest, RegisterRequest } from '../../types/user'
import { getToken, setToken, setRefreshToken, removeToken, storage, USER_KEY, REFRESH_TOKEN_KEY } from '../../utils/localStorage'
import API from '../../services/api'

const initialState: AuthState = {
  user: storage.get<User>(USER_KEY),
  access_token: getToken(),
  refresh_token: storage.get<string>(REFRESH_TOKEN_KEY),
  isAuthenticated: !!getToken(),
  loading: false,
  error: null,
}

export const login = createAsyncThunk(
  'auth/login',
  async (data: LoginRequest, { rejectWithValue }) => {
    try {
      const res = await API.post('/api/v1/auth/login', data)
      return res.data
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Đăng nhập thất bại')
    }
  }
)

export const register = createAsyncThunk(
  'auth/register',
  async (data: RegisterRequest, { rejectWithValue }) => {
    try {
      const res = await API.post('/api/v1/auth/register', data)
      return res.data
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Đăng ký thất bại')
    }
  }
)

export const checkAuth = createAsyncThunk('auth/checkAuth', async (_, { rejectWithValue }) => {
  try {
    const res = await API.get('/api/v1/users/me')
    return res.data
  } catch {
    return rejectWithValue('Not authenticated')
  }
})

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (data: Partial<User>, { rejectWithValue }) => {
    try {
      await API.put('/api/v1/users/me', data)
      const res = await API.get('/api/v1/users/me')
      return res.data
    } catch (err: any) {
      return rejectWithValue(err.response?.data?.detail || 'Cập nhật thất bại')
    }
  }
)

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    logout(state) {
      state.user = null
      state.access_token = null
      state.refresh_token = null
      state.isAuthenticated = false
      state.error = null
      removeToken()
      storage.remove(USER_KEY)
      storage.remove(REFRESH_TOKEN_KEY)
    },
    setCurrentRole(state, action: PayloadAction<string>) {
      if (state.user) {
        state.user.current_role = action.payload
        storage.set(USER_KEY, state.user)
      }
    },
    clearError(state) {
      state.error = null
    },
    updateTokens(state, action: PayloadAction<{ access_token: string; refresh_token: string }>) {
      state.access_token = action.payload.access_token
      state.refresh_token = action.payload.refresh_token
      setToken(action.payload.access_token)
      setRefreshToken(action.payload.refresh_token)
    },
  },
  extraReducers: (builder) => {
    builder
      // login
      .addCase(login.pending, (state) => { state.loading = true; state.error = null })
      .addCase(login.fulfilled, (state, action) => {
        state.loading = false
        state.user = action.payload.user
        state.access_token = action.payload.access_token
        state.refresh_token = action.payload.refresh_token
        state.isAuthenticated = true
        setToken(action.payload.access_token)
        setRefreshToken(action.payload.refresh_token)
        storage.set(USER_KEY, action.payload.user)
      })
      .addCase(login.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // register
      .addCase(register.pending, (state) => { state.loading = true; state.error = null })
      .addCase(register.fulfilled, (state) => { state.loading = false })
      .addCase(register.rejected, (state, action) => {
        state.loading = false
        state.error = action.payload as string
      })
      // checkAuth
      .addCase(checkAuth.fulfilled, (state, action) => {
        state.user = action.payload
        state.isAuthenticated = true
        storage.set(USER_KEY, action.payload)
      })
      .addCase(checkAuth.rejected, (state) => {
        // Nếu user bị banned thì KHÔNG logout — giữ token/session để hiện banner
        if (state.user?.status === 'banned') return
        state.user = null
        state.isAuthenticated = false
        removeToken()
      })
      // updateProfile
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.user = action.payload
        storage.set(USER_KEY, action.payload)
      })
  },
})

export const { logout, setCurrentRole, clearError, updateTokens } = authSlice.actions
export default authSlice.reducer
