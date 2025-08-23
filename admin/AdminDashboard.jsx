import React from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import './AdminDashboard.css'

const ADMIN_MODULES = [
  {
    title: 'Database Tables',
    description: 'Browse and edit all database tables',
    icon: 'database',
    path: '/admin/tables',
    color: 'blue'
  },
  {
    title: 'Data Ingestion',
    description: 'Import data from spreadsheets',
    icon: 'upload',
    path: '/admin/ingestion',
    color: 'green'
  },
  {
    title: 'User Management',
    description: 'Manage user accounts and permissions',
    icon: 'users',
    path: '/admin/users',
    color: 'purple'
  },
  {
    title: 'System Logs',
    description: 'View audit logs and system activity',
    icon: 'activity',
    path: '/admin/logs',
    color: 'orange'
  },
  {
    title: 'System Status',
    description: 'Monitor system health and performance',
    icon: 'heart',
    path: '/status',
    color: 'red'
  }
]

function AdminDashboard() {
  const { user } = useAuth()
  const navigate = useNavigate()

  // Check if user has admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-dashboard-page">
        <div className="access-denied">
          <Icon name="lock" size={48} />
          <h2>Access Denied</h2>
          <p>Administrative privileges required to access this page.</p>
          <Link to="/" className="back-home-btn">
            <Icon name="home" size={16} />
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-dashboard-page">
      <div className="admin-dashboard-header">
        <div className="header-content">
          <h1>
            <Icon name="shield" size={32} />
            Admin Dashboard
          </h1>
          <p>System administration and database management</p>
        </div>
        <div className="admin-user-info">
          <div className="user-badge">
            <Icon name="user" size={16} />
            <span>{user.name || user.email}</span>
            <span className="user-role">{user.role}</span>
          </div>
        </div>
      </div>

      <div className="admin-dashboard-content">
        <div className="admin-modules">
          {ADMIN_MODULES.map(module => (
            <Link
              key={module.path}
              to={module.path}
              className={`admin-module ${module.color}`}
            >
              <div className="module-icon">
                <Icon name={module.icon} size={24} />
              </div>
              <div className="module-content">
                <h3>{module.title}</h3>
                <p>{module.description}</p>
              </div>
              <div className="module-arrow">
                <Icon name="chevron-right" size={16} />
              </div>
            </Link>
          ))}
        </div>

        <div className="quick-stats">
          <div className="stats-header">
            <h2>Quick Stats</h2>
            <p>System overview at a glance</p>
          </div>
          
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon blue">
                <Icon name="database" size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-number">36</div>
                <div className="stat-label">Database Tables</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon green">
                <Icon name="users" size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-number">~</div>
                <div className="stat-label">Active Users</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon purple">
                <Icon name="card" size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-number">793K</div>
                <div className="stat-label">Total Cards</div>
              </div>
            </div>
            
            <div className="stat-card">
              <div className="stat-icon orange">
                <Icon name="user" size={20} />
              </div>
              <div className="stat-content">
                <div className="stat-number">6,965</div>
                <div className="stat-label">Players</div>
              </div>
            </div>
          </div>
        </div>

        <div className="recent-activity">
          <div className="activity-header">
            <h2>Recent Activity</h2>
            <Link to="/admin/logs" className="view-all-link">
              View All Logs
              <Icon name="arrow-right" size={14} />
            </Link>
          </div>
          <div className="activity-placeholder">
            <Icon name="activity" size={24} />
            <p>Activity logs will appear here</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AdminDashboard