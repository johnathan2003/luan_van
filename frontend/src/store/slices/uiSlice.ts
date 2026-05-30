import { createSlice, PayloadAction } from '@reduxjs/toolkit'

interface UIState {
  globalLoading: boolean
  sidebarOpen: boolean
  modalOpen: string | null
}

const initialState: UIState = {
  globalLoading: false,
  sidebarOpen: false,
  modalOpen: null,
}

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setGlobalLoading(state, action: PayloadAction<boolean>) { state.globalLoading = action.payload },
    toggleSidebar(state) { state.sidebarOpen = !state.sidebarOpen },
    setSidebarOpen(state, action: PayloadAction<boolean>) { state.sidebarOpen = action.payload },
    openModal(state, action: PayloadAction<string>) { state.modalOpen = action.payload },
    closeModal(state) { state.modalOpen = null },
  },
})

export const { setGlobalLoading, toggleSidebar, setSidebarOpen, openModal, closeModal } = uiSlice.actions
export default uiSlice.reducer
