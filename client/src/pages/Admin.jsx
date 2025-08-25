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
          
          <Link to="/admin/sets" className="admin-card">
            <Icon name="layers" size={48} />
            <h3>Sets & Series</h3>
            <p>Hierarchical navigation: Years → Sets → Series</p>
          </Link>
          
          <Link to="/admin/import" className="admin-card">
            <Icon name="upload" size={48} />
            <h3>Spreadsheet Import</h3>
            <p>Import card checklists from Excel spreadsheets</p>
          </Link>
        </div>
      </div>
    </div>
  )
}

export default Admin