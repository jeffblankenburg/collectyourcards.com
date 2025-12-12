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
      const interval = setInterval(fetchNotificationCount, 300000) // Every 5 minutes
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
      const response = await axios.get('/api/notifications/unread-count', config)
      setUnreadNotifications(response.data.count || 0)
    } catch (err) {
      // Silent fail - notifications shouldn't break the app
      console.error('Error fetching notification count:', err)
      setUnreadNotifications(0)
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
      
      const response = await axios.get('/api/notifications?limit=10', config)
      
      // Check if response has the expected structure
      if (!response.data || !response.data.notifications) {
        console.error('Unexpected response structure:', response.data)
        setNotifications([])
        return
      }
      
      // Process notifications to add links based on type
      const processedNotifications = response.data.notifications.map(notif => {
        let link = null
        
        // Generate appropriate link based on notification type and context
        if (notif.notification_type === 'comment' && notif.item_type && notif.item_id) {
          // Link to the commented item
          if (notif.item_type === 'card') {
            link = `/card/${notif.item_id}` // You might need to fetch card details for full URL
          } else if (notif.item_type === 'series') {
            link = `/series/${notif.item_id}`
          } else if (notif.item_type === 'set') {
            link = `/sets/${notif.item_id}`
          }
        } else if (notif.notification_type === 'achievement') {
          link = '/achievements'
        } else if (notif.notification_type === 'collection') {
          link = '/collection'
        }
        
        return {
          ...notif,
          id: notif.notification_id,
          type: notif.notification_type,
          timestamp: new Date(notif.created_at),
          link
        }
      })
      
      setNotifications(processedNotifications)
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
      
      // Call real API
      await axios.put(`/api/notifications/${notificationId}/read`, {}, config)
      
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
      
      // Call real API
      await axios.put('/api/notifications/mark-all-read', {}, config)
      
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

        {/* Universal Search - Hidden on home page, moved from right side */}
        {!hideNavSearch() && (
          <div className="header-search">
            <UniversalSearch />
          </div>
        )}

        {/* Mobile Navigation Menu */}
        {showMobileMenu && (
          <nav className="mobile-nav" ref={mobileMenuRef}>
            {!isAuthenticated && (
              <>
                <Link to="/auth/login" className="mobile-nav-link primary">
                  <Icon name="user" size={20} />
                  <span>Sign In</span>
                </Link>
              </>
            )}
          </nav>
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
                      <Link 
                        to="/notifications" 
                        onClick={() => setShowUserMenu(false)}
                        className="notifications-title-link"
                      >
                        <h4>
                          <Icon name="bell" size={14} />
                          Notifications
                        </h4>
                      </Link>
                      {unreadNotifications > 0 && (
                        <button className="mark-all-read" onClick={markAllAsRead}>
                          Mark all read
                        </button>
                      )}
                    </div>
                    
                    {loadingNotifications ? (
                      <div className="notifications-loading">
                        <div className="card-icon-spinner small"></div>
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