import React, { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from './Icon'
import './AdminNavigation.css'

function AdminNavigation() {
  const location = useLocation()
  const [isVisible, setIsVisible] = useState(true)

  // Don't render if hidden
  if (!isVisible) return null

  const adminRoutes = [
    {
      path: '/admin',
      name: 'Dashboard',
      icon: 'home'
    },
    {
      path: '/admin/users',
      name: 'Users',
      icon: 'users'
    },
    {
      path: '/admin/teams',
      name: 'Teams',
      icon: 'shield'
    },
    {
      path: '/admin/players',
      name: 'Players',
      icon: 'user'
    },
    {
      path: '/admin/sets',
      name: 'Sets',
      icon: 'collection'
    },
    {
      path: '/admin/series',
      name: 'Series',
      icon: 'layers'
    },
    {
      path: '/admin/cards',
      name: 'Cards',
      icon: 'grid'
    },
    {
      path: '/admin/achievements',
      name: 'Achievements',
      icon: 'trophy'
    },
    {
      path: '/admin/query-tester',
      name: 'Query Tester',
      icon: 'search'
    }
  ]

  return (
    <nav className="admin-navigation">
      <div className="admin-nav-container">
        <div className="admin-zone-label">
          <Icon name="warning" size={16} />
          <span>Admin Zone</span>
        </div>

        <div className="admin-nav-items">
          {adminRoutes.map(route => (
            <Link
              key={route.path}
              to={route.path}
              className={`admin-nav-item ${location.pathname === route.path ? 'active' : ''}`}
            >
              <Icon name={route.icon} size={16} />
              <span>{route.name}</span>
            </Link>
          ))}
        </div>

        <div className="admin-zone-actions">
          <button
            className="admin-nav-close"
            onClick={() => setIsVisible(false)}
            aria-label="Hide admin navigation"
            title="Hide admin navigation (returns on page refresh)"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
    </nav>
  )
}

export default AdminNavigation