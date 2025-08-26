import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import UniversalSearch from './UniversalSearch'
import AdminNavigation from './AdminNavigation'
import Icon from './Icon'
import './Header.css'

function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const { success } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const dropdownRef = useRef(null)
  const mobileMenuRef = useRef(null)

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowUserMenu(false)
      }
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target) && 
          !event.target.closest('.mobile-menu-toggle')) {
        setShowMobileMenu(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Close mobile menu on navigation
  useEffect(() => {
    setShowMobileMenu(false)
  }, [location.pathname])

  const handleLogout = async () => {
    await logout()
    setShowUserMenu(false)
    success('Logged out successfully')
    navigate('/')
  }

  const isActive = (path) => {
    return location.pathname === path
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

  const isAdminPage = () => {
    return location.pathname.startsWith('/admin')
  }

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Mobile Menu Toggle */}
        <button 
          className="mobile-menu-toggle"
          onClick={() => setShowMobileMenu(!showMobileMenu)}
          aria-label="Toggle menu"
        >
          <Icon name={showMobileMenu ? 'close' : 'menu'} size={24} />
        </button>

        {/* Logo Section */}
        <Link to="/" className="header-logo">
          <h1>🎴 Collect Your Cards</h1>
        </Link>

        {/* Desktop Navigation */}
        <nav className="header-nav desktop-nav">
          <Link 
            to="/players" 
            className={`nav-link ${location.pathname.startsWith('/players') ? 'active' : ''}`}
          >
            <Icon name="player" size={18} className="nav-icon" />
            <span className="nav-text">Players</span>
          </Link>
          <Link 
            to="/teams" 
            className={`nav-link ${location.pathname.startsWith('/teams') ? 'active' : ''}`}
          >
            <Icon name="team" size={18} className="nav-icon" />
            <span className="nav-text">Teams</span>
          </Link>
          <Link 
            to="/sets" 
            className={`nav-link ${location.pathname.startsWith('/sets') ? 'active' : ''}`}
          >
            <Icon name="series" size={18} className="nav-icon" />
            <span className="nav-text">Sets</span>
          </Link>
        </nav>

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <nav className="mobile-nav" ref={mobileMenuRef}>
            <Link 
              to="/players" 
              className={`mobile-nav-link ${location.pathname.startsWith('/players') ? 'active' : ''}`}
            >
              <Icon name="player" size={20} />
              <span>Players</span>
            </Link>
            <Link 
              to="/teams" 
              className={`mobile-nav-link ${location.pathname.startsWith('/teams') ? 'active' : ''}`}
            >
              <Icon name="team" size={20} />
              <span>Teams</span>
            </Link>
            <Link 
              to="/sets" 
              className={`mobile-nav-link ${location.pathname.startsWith('/sets') ? 'active' : ''}`}
            >
              <Icon name="series" size={20} />
              <span>Sets</span>
            </Link>
            {!isAuthenticated && (
              <>
                <div className="mobile-nav-divider"></div>
                <Link to="/auth/login" className="mobile-nav-link primary">
                  <Icon name="user" size={20} />
                  <span>Sign In</span>
                </Link>
              </>
            )}
          </nav>
        )}

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
                  {(user?.role === 'admin' || user?.role === 'superadmin') && (
                    <>
                      <div className="dropdown-divider"></div>
                      <Link 
                        to="/admin" 
                        className="dropdown-item admin-item"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Icon name="shield" size={16} className="dropdown-icon" />
                        Admin Dashboard
                      </Link>
                      <Link 
                        to="/admin/ingestion" 
                        className="dropdown-item admin-item"
                        onClick={() => setShowUserMenu(false)}
                      >
                        <Icon name="upload" size={16} className="dropdown-icon" />
                        Data Ingestion
                      </Link>
                    </>
                  )}
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
              <Link to="/auth/login" className="header-button primary">
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
      
      {/* Admin Navigation - Only show on admin pages for authorized users */}
      {isAdminPage() && isAuthenticated && (user?.role === 'admin' || user?.role === 'superadmin') && (
        <AdminNavigation />
      )}
    </header>
  )
}

export default Header