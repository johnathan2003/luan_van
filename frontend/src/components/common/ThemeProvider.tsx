import React from 'react'
import { useTheme } from '../../hooks/useTheme'

/** Đồng bộ theme Redux ↔ document + tự đổi theo giờ khi chế độ Auto */
const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useTheme()
  return <>{children}</>
}

export default ThemeProvider
