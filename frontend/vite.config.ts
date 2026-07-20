import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@':     resolve(__dirname, './src'),
      '@super': resolve(__dirname, '../super/frontend'),
    },
    extensions: ['.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      onwarn(warning, warn) {
        if (warning.code === 'UNRESOLVED_IMPORT') return
        warn(warning)
      },
      output: {
        manualChunks: {
          // React ecosystem
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // State management
          'vendor-redux': ['@reduxjs/toolkit', 'react-redux'],
          // Charts
          'vendor-charts': ['recharts'],
          // Socket + HTTP
          'vendor-socket': ['socket.io-client'],
          'vendor-axios': ['axios'],
          // Toast
          'vendor-toast': ['react-toastify'],
          // MUI (rất nặng)
          'vendor-mui': ['@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled'],
          // Date / Utils
          'vendor-utils': ['date-fns', 'lodash', 'zod', '@hookform/resolvers', 'react-hook-form'],
          // Maps
          'vendor-maps': ['leaflet', 'react-leaflet'],
          // Excel
          'vendor-xlsx': ['xlsx'],
        },
      },
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': { target: 'http://localhost:8000', changeOrigin: true },
      '/uploads': { target: 'http://localhost:8000', changeOrigin: true },
    },
  },
})
