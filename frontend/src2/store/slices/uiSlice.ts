import { createSlice, PayloadAction } from '@reduxjs/toolkit'
import type { ThemeMode, ResolvedTheme } from '../../utils/theme'
import {
  loadThemeMode,
  resolveThemeFromMode,
  saveThemeMode,
  getAutoTheme,
} from '../../utils/theme'

interface UIState {
  globalLoading: boolean
  sidebarOpen: boolean
  modalOpen: string | null
  themeMode: ThemeMode
  resolvedTheme: ResolvedTheme
}

const initialThemeMode = loadThemeMode()

const initialState: UIState = {
  globalLoading: false,
  sidebarOpen: false,
  modalOpen: null,
  themeMode: initialThemeMode,
  resolvedTheme: resolveThemeFromMode(initialThemeMode),
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
    setThemeMode(state, action: PayloadAction<ThemeMode>) {
      state.themeMode = action.payload
      state.resolvedTheme = resolveThemeFromMode(action.payload)
      saveThemeMode(action.payload)
    },
    cycleThemeMode(state) {
      const order: ThemeMode[] = ['auto', 'light', 'dark']
      const next = order[(order.indexOf(state.themeMode) + 1) % order.length]
      state.themeMode = next
      state.resolvedTheme = resolveThemeFromMode(next)
      saveThemeMode(next)
    },
    syncAutoTheme(state) {
      if (state.themeMode === 'auto') {
        state.resolvedTheme = getAutoTheme()
      }
    },
  },
})

export const {
  setGlobalLoading,
  toggleSidebar,
  setSidebarOpen,
  openModal,
  closeModal,
  setThemeMode,
  cycleThemeMode,
  syncAutoTheme,
} = uiSlice.actions
export default uiSlice.reducer
