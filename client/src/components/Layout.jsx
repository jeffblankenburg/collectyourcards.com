import React from 'react'
import { useAuth } from '../contexts/AuthContext'
import Header from './Header'
import Footer from './Footer/Footer'
import AdminNavigation from './AdminNavigation'
import UserNavigation from './UserNavigation'
import './Layout.css'

function Layout({ children }) {
  const { user } = useAuth()

  // Check if user is an admin (used for conditional styling)
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  return (
    <div className={`app-layout ${isAdmin ? 'has-admin-nav' : ''}`}>
      <Header />
      <UserNavigation />
      {isAdmin && <AdminNavigation />}
      <main className={`app-main ${isAdmin ? 'with-admin-nav with-user-nav' : 'with-user-nav'}`}>
        {children}
      </main>
      <Footer />
    </div>
  )
}

export default Layout