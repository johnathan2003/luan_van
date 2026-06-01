import React from 'react'

interface State {
  hasError: boolean
  message?: string
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { hasError: false }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 40, fontFamily: 'sans-serif', maxWidth: 560, margin: '40px auto' }}>
          <h1 style={{ color: '#c62828', marginBottom: 12 }}>Lỗi hiển thị trang</h1>
          <p style={{ color: '#555', marginBottom: 16 }}>{this.state.message || 'Đã xảy ra lỗi không mong muốn.'}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ padding: '10px 20px', background: '#ee4d2d', color: '#fff', border: 'none', borderRadius: 6, cursor: 'pointer' }}
          >
            Tải lại trang
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
