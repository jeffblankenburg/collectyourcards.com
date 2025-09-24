import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import Icon from './Icon'
import './AdminNavigation.css'

function AdminNavigation() {
  const location = useLocation()
  
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
        
        <div className="admin-zone-label">
          <span>Admin Zone</span>
          <Icon name="warning" size={16} />
        </div>
      </div>
    </nav>
  )
}

export default AdminNavigation