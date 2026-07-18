import React, { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import Router from './Router.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import ThemeProvider from './components/common/ThemeProvider'
import ThemeToggle from './components/common/ThemeToggle'
import { useAppDispatch, useAppSelector } from './store/hooks'
import { checkAuth } from './store/slices/authSlice'
import { setEventsEmail } from './utils/eventsStore'

import { setBannerDraftEmail, clearBase64Drafts } from './utils/bannerDraftStore'


const AppContent: React.FC = () => {
  const dispatch = useAppDispatch()
  const user = useAppSelector(s => s.auth.user)

  useEffect(() => {
    dispatch(checkAuth())
    clearBase64Drafts() // xóa base64 cũ, migrate sang path-based
  }, [dispatch])

  // Scope tất cả localStorage stores theo email tài khoản đang đăng nhập
  // → tránh rò rỉ dữ liệu giữa các tài khoản khác nhau trên cùng trình duyệt
  useEffect(() => {
    const email = user?.email ?? ''
    setEventsEmail(email)
    setBannerDraftEmail(email)
  }, [user?.email])

  return (
    <>
      <Router />
      <ThemeToggle />
    </>
  )
}

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
