import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import Header from './Header'
import Footer from './Footer/Footer'
import AdminNavigation from './AdminNavigation'
// import './Layout.css' // Commented out for SeriesDetail page independence

function Layout({ children }) {
  const { user } = useAuth()
  
  // Check if user is an admin (used for conditional styling)
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  return (
    <div className="app-layout">
      <Header />
      {isAdmin && <AdminNavigation />}
      <main className={`app-main ${isAdmin ? 'with-admin-nav' : ''}`}>
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default Layout