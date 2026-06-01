import React, { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import Router from './Router.tsx'
import { ErrorBoundary } from './components/common/ErrorBoundary'
import ThemeProvider from './components/common/ThemeProvider'
import { useAppDispatch } from './store/hooks'
import { checkAuth } from './store/slices/authSlice'

const AppContent: React.FC = () => {
  const dispatch = useAppDispatch()

  useEffect(() => {
    dispatch(checkAuth())
  }, [dispatch])

  return <Router />
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
