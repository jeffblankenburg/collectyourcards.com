import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import Header from './Header'
import Footer from './Footer'
import './Layout.css'

function Layout({ children }) {
  const { user } = useAuth()
  
  // Check if user is an admin (used for conditional styling)
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  return (
    <div className="app-layout">
      <Header />
      <main className={`app-main ${isAdmin ? 'with-admin-nav' : ''}`}>
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default Layout