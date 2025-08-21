import React from 'react'
import Header from './Header'
import Footer from './Footer'
import './Layout.css'

function Layout({ children }) {
  return (
    <div className="app-layout">
      <Header />
      <main className="app-main">
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default Layout