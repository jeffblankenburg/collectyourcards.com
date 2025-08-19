import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

function ProtectedRoute({ children, requireRole = null }) {
  const { isAuthenticated, user, loading } = useAuth()
  const location = useLocation()

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        fontSize: '1.5rem'
      }}>
        🔄 Loading...
      </div>
    )
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Check role requirements if specified
  if (requireRole) {
    const userRole = user?.role
    const roleHierarchy = {
      'user': 1,
      'data_admin': 2,
      'admin': 3,
      'superadmin': 4
    }

    const requiredLevel = roleHierarchy[requireRole] || 1
    const userLevel = roleHierarchy[userRole] || 1

    if (userLevel < requiredLevel) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          textAlign: 'center',
          padding: '2rem'
        }}>
          <h1>🚫 Access Denied</h1>
          <p>You don't have permission to access this page.</p>
          <p>Required role: {requireRole}</p>
          <p>Your role: {userRole}</p>
        </div>
      )
    }
  }

  return children
}

export default ProtectedRoute