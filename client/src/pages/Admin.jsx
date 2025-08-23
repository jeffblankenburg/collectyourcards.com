import React from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './Admin.css'

function Admin() {
  const { user } = useAuth()

  // Check if user has admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-page">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>You need administrator privileges to access this page.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-page">
      <div className="admin-content">
        <h1>Administration</h1>
        <p>Choose an administrative function:</p>
        
        <div className="admin-menu">
          <Link to="/admin/users" className="admin-card">
            <Icon name="users" size={48} />
            <h3>User Management</h3>
            <p>View and manage user accounts</p>
          </Link>
          
          <Link to="/admin/teams" className="admin-card">
            <Icon name="shield" size={48} />
            <h3>Team Management</h3>
            <p>View and manage team information</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Admin