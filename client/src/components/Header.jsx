import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import UniversalSearch from './UniversalSearch'
import Icon from './Icon'
import './Header.css'

function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const { success } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  const handleLogout = async () => {
    await logout()
    setShowUserMenu(false)
    success('Logged out successfully')
    navigate('/')
  }

  const isActive = (path) => {
    return location.pathname === path || (path === '/dashboard' && location.pathname === '/')
  }

  // Hide nav search on pages that have their own prominent search
  const hideNavSearch = () => {
    const pagesWithSearch = ['/', '/home'] // Add more pages as needed
    return pagesWithSearch.includes(location.pathname)
  }

  const getUserInitials = () => {
    if (!user) return 'U'
    return (user.name || user.first_name || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase()
  }

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Logo Section */}
        <Link to="/" className="header-logo">
          <h1>🎴 Collect Your Cards</h1>
        </Link>

        {/* Navigation */}
        <nav className="header-nav">
          {isAuthenticated ? (
            <>
              <Link 
                to="/dashboard" 
                className={`nav-link ${isActive('/dashboard') ? 'active' : ''}`}
              >
                <Icon name="home" size={18} className="nav-icon" />
                Dashboard
              </Link>
              <Link 
                to="/collections" 
                className={`nav-link ${isActive('/collections') ? 'active' : ''}`}
              >
                <Icon name="collections" size={18} className="nav-icon" />
                Collections
              </Link>
              <Link 
                to="/import" 
                className={`nav-link ${isActive('/import') ? 'active' : ''}`}
              >
                <Icon name="import" size={18} className="nav-icon" />
                Import
              </Link>
              <Link 
                to="/analytics" 
                className={`nav-link ${isActive('/analytics') ? 'active' : ''}`}
              >
                <Icon name="analytics" size={18} className="nav-icon" />
                Analytics
              </Link>
            </>
          ) : (
            <>
              <Link 
                to="/" 
                className={`nav-link ${isActive('/') ? 'active' : ''}`}
              >
                Home
              </Link>
              <Link 
                to="/features" 
                className={`nav-link ${isActive('/features') ? 'active' : ''}`}
              >
                Features
              </Link>
              <Link 
                to="/pricing" 
                className={`nav-link ${isActive('/pricing') ? 'active' : ''}`}
              >
                Pricing
              </Link>
            </>
          )}
        </nav>

        {/* Universal Search - Hidden on pages with prominent search */}
        {!hideNavSearch() && (
          <div className="header-search">
            <UniversalSearch />
          </div>
        )}

        {/* User Section */}
        <div className="header-user">
          {isAuthenticated ? (
            <div className="user-menu" ref={dropdownRef}>
              <button 
                className="user-avatar-button"
                onClick={() => setShowUserMenu(!showUserMenu)}
                title={user?.name || user?.first_name || 'User'}
              >
                <div className="user-avatar-small">
                  {getUserInitials()}
                </div>
              </button>
              
              {showUserMenu && (
                <div className="user-dropdown">
                  <div className="dropdown-header">
                    <div className="dropdown-user-info">
                      <strong>{user?.name || user?.first_name || 'User'}</strong>
                      <span className="user-email">{user?.email}</span>
                      <span className="user-role">{user?.role}</span>
                    </div>
                  </div>
                  <div className="dropdown-divider"></div>
                  <Link 
                    to="/profile" 
                    className="dropdown-item"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Icon name="profile" size={16} className="dropdown-icon" />
                    Profile Settings
                  </Link>
                  <Link 
                    to="/help" 
                    className="dropdown-item"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Icon name="help" size={16} className="dropdown-icon" />
                    Help & Support
                  </Link>
                  <Link 
                    to="/status" 
                    className="dropdown-item"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Icon name="activity" size={16} className="dropdown-icon" />
                    System Status
                  </Link>
                  <div className="dropdown-divider"></div>
                  <button 
                    className="dropdown-item logout-item"
                    onClick={handleLogout}
                  >
                    <Icon name="logout" size={16} className="dropdown-icon" />
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="auth-buttons">
              <Link to="/login" className="header-button secondary">
                Sign In
              </Link>
              <Link to="/register" className="header-button primary">
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header