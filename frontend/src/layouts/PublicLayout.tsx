/**
 * PublicLayout — dùng cho trang công khai: Home, ProductList, ProductDetail
 * Gồm: Navbar + main content + Footer
 */
import React from 'react'
import Navbar from '../components/common/Navbar'
import Footer from '../components/common/Footer'
import ChatbotWidget from '../components/common/ChatbotWidget'
import ChatWidget from '../components/common/ChatWidget'

interface Props {
  children: React.ReactNode
  /** Ẩn footer (vd: trang map full-screen) */
  noFooter?: boolean
}

const PublicLayout: React.FC<Props> = ({ children, noFooter }) => (
  <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-page)' }}>
    <Navbar />
    <main style={{ flex: 1 }}>
      {children}
    </main>
    {!noFooter && <Footer />}
    <ChatWidget />
    <ChatbotWidget />
  </div>
)

export default PublicLayout
