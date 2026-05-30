import React, { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import Router from './Router'
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
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App
