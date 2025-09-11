import React, { useState, useEffect, useRef } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import UniversalSearch from './UniversalSearch'
// import AdminNavigation from './AdminNavigation' // Commented out for SeriesDetail page independence
import Icon from './Icon'
import axios from 'axios'
import './Header.css'

function Header() {
  const { isAuthenticated, user, logout } = useAuth()
  const { addToast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showMobileMenu, setShowMobileMenu] = useState(false)
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [loadingNotifications, setLoadingNotifications] = useState(false)
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

  // Fetch unread notifications count
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchNotificationCount()
      // Set up polling for updates
      const interval = setInterval(fetchNotificationCount, 30000) // Every 30 seconds
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, user])

  const fetchNotificationCount = async () => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      // For now, use a mock count since the API isn't implemented yet
      // const response = await axios.get('/api/notifications/unread-count', config)
      // setUnreadNotifications(response.data.count || 0)
      
      // Mock notification count for demonstration
      setUnreadNotifications(3)
    } catch (err) {
      // Silent fail - notifications shouldn't break the app
      console.error('Error fetching notification count:', err)
    }
  }

  const fetchNotifications = async () => {
    try {
      setLoadingNotifications(true)
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      // Mock notifications for demonstration
      const mockNotifications = [
        {
          id: 1,
          type: 'comment',
          title: 'New comment on your card',
          message: 'Someone commented on your 1992 Topps Derek Jeter',
          timestamp: new Date(Date.now() - 5 * 60 * 1000),
          is_read: false,
          link: '/card/1992-topps/98/derek-jeter'
        },
        {
          id: 2,
          type: 'collection',
          title: 'Card added to collection',
          message: 'You added 2023 Topps Chrome #123 to your collection',
          timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
          is_read: false,
          link: '/collection'
        },
        {
          id: 3,
          type: 'system',
          title: 'Collection milestone',
          message: 'You now have 500 cards in your collection!',
          timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000),
          is_read: true,
          link: '/collection'
        }
      ]
      
      setNotifications(mockNotifications)
      
      // Real API call when implemented:
      // const response = await axios.get('/api/notifications?limit=5', config)
      // setNotifications(response.data.notifications || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
      setNotifications([])
    } finally {
      setLoadingNotifications(false)
    }
  }

  const markNotificationAsRead = async (notificationId) => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      // Real API call when implemented:
      // await axios.put(`/api/notifications/${notificationId}/read`, {}, config)
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      )
      
      // Update unread count
      setUnreadNotifications(prev => Math.max(0, prev - 1))
    } catch (err) {
      console.error('Error marking notification as read:', err)
    }
  }

  const markAllAsRead = async () => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      // Real API call when implemented:
      // await axios.put('/api/notifications/mark-all-read', {}, config)
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, is_read: true }))
      )
      setUnreadNotifications(0)
      
      addToast('All notifications marked as read', 'success')
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
      addToast('Failed to mark notifications as read', 'error')
    }
  }

  const formatTimeAgo = (timestamp) => {
    const now = new Date()
    const time = new Date(timestamp)
    const diffMs = now - time
    const diffMins = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays < 7) return `${diffDays}d ago`
    
    return time.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric' 
    })
  }

  const handleUserMenuToggle = () => {
    setShowUserMenu(!showUserMenu)
    if (!showUserMenu && notifications.length === 0) {
      fetchNotifications()
    }
  }

  const handleLogout = async () => {
    await logout()
    setShowUserMenu(false)
    addToast('Logged out successfully', 'success')
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
                onClick={handleUserMenuToggle}
                title={user?.name || user?.first_name || 'User'}
              >
                <div className="user-avatar-small">
                  {user?.avatar_url ? (
                    <img 
                      src={user.avatar_url} 
                      alt="Profile" 
                      className="user-avatar-image"
                      onError={(e) => {
                        // Fallback to initials if image fails to load
                        e.target.style.display = 'none'
                        e.target.nextSibling.style.display = 'flex'
                      }}
                    />
                  ) : null}
                  <div className="user-avatar-fallback" style={{ display: user?.avatar_url ? 'none' : 'flex' }}>
                    {getUserInitials()}
                  </div>
                </div>
                {unreadNotifications > 0 && (
                  <span className="notification-badge">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
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
                  
                  {/* Notifications Section */}
                  <div className="dropdown-notifications">
                    <div className="notifications-header">
                      <h4>
                        <Icon name="bell" size={14} />
                        Notifications
                      </h4>
                      {unreadNotifications > 0 && (
                        <button className="mark-all-read" onClick={markAllAsRead}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    
                    {loadingNotifications ? (
                      <div className="notifications-loading">
                        <Icon name="activity" size={16} className="spinner" />
                        <span>Loading...</span>
                      </div>
                    ) : notifications.length > 0 ? (
                      <div className="notifications-list">
                        {notifications.slice(0, 3).map(notification => (
                          <div 
                            key={notification.id}
                            className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                            onClick={() => {
                              if (!notification.is_read) {
                                markNotificationAsRead(notification.id)
                              }
                              if (notification.link) {
                                navigate(notification.link)
                                setShowUserMenu(false)
                              }
                            }}
                          >
                            <div className="notification-content">
                              <div className="notification-title">{notification.title}</div>
                              <div className="notification-message">{notification.message}</div>
                              <div className="notification-time">{formatTimeAgo(notification.timestamp)}</div>
                            </div>
                            {!notification.is_read && (
                              <div className="notification-dot"></div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="notifications-empty">
                        <Icon name="inbox" size={20} />
                        <span>No notifications</span>
                      </div>
                    )}
                    
                    {notifications.length > 3 && (
                      <Link 
                        to="/notifications" 
                        className="view-all-notifications"
                        onClick={() => setShowUserMenu(false)}
                      >
                        View all notifications
                      </Link>
                    )}
                  </div>
                  
                  <div className="dropdown-divider"></div>
                  <Link 
                    to="/collection" 
                    className="dropdown-item"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Icon name="collections" size={16} className="dropdown-icon" />
                    My Collection
                  </Link>
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
      
      {/* Admin Navigation - Only show on admin pages for authorized admin users */}
      {/* {isAdminPage() && isAuthenticated && ['admin', 'superadmin', 'data_admin'].includes(user?.role) && (
        <AdminNavigation />
      )} */}
    </header>
  )
}

export default Header