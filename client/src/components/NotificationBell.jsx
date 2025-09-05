import React, { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from './Icon'
import './NotificationBell.css'

function NotificationBell() {
  const { isAuthenticated, user } = useAuth()
  const [showDropdown, setShowDropdown] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(false)
  const dropdownRef = useRef(null)

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  // Fetch initial unread count on mount
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUnreadCount()
      // Set up polling for real-time updates
      const interval = setInterval(fetchUnreadCount, 30000) // Every 30 seconds
      return () => clearInterval(interval)
    }
  }, [isAuthenticated, user])

  const fetchUnreadCount = async () => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      // Mock API endpoint - in real implementation this would fetch from user_notifications table
      const response = await axios.get('/api/notifications/unread-count', config)
      setUnreadCount(response.data.count || 0)
    } catch (err) {
      // Silent fail for now - notification bell should not break the app
      console.error('Error fetching notification count:', err)
    }
  }

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      // Mock API endpoint - in real implementation this would fetch recent notifications
      const response = await axios.get('/api/notifications?limit=10', config)
      const notificationData = response.data.notifications || []
      
      setNotifications(notificationData)
      setHasMore(response.data.pagination?.hasMore || false)
    } catch (err) {
      console.error('Error fetching notifications:', err)
      // Show mock notifications for now
      setNotifications(getMockNotifications())
    } finally {
      setLoading(false)
    }
  }

  const markAsRead = async (notificationId) => {
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.put(`/api/notifications/${notificationId}/read`, {}, config)
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      )
      
      // Update unread count
      setUnreadCount(prev => Math.max(0, prev - 1))
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
      
      await axios.put('/api/notifications/mark-all-read', {}, config)
      
      // Update local state
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, is_read: true }))
      )
      setUnreadCount(0)
    } catch (err) {
      console.error('Error marking all notifications as read:', err)
    }
  }

  const handleBellClick = () => {
    setShowDropdown(!showDropdown)
    if (!showDropdown) {
      fetchNotifications()
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

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'comment':
        return 'message-square'
      case 'collection':
        return 'plus-circle'
      case 'system':
        return 'info'
      case 'social':
        return 'users'
      default:
        return 'bell'
    }
  }

  // Mock notifications for demonstration (remove when real API is implemented)
  const getMockNotifications = () => [
    {
      id: 1,
      type: 'comment',
      title: 'New comment on your card',
      message: 'cardcollector commented on your 1992 Topps Derek Jeter rookie card',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      is_read: false,
      link: '/card/1992-topps/98/derek-jeter'
    },
    {
      id: 2,
      type: 'social',
      title: 'New follower',
      message: 'baseballfan99 started following your collection',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      is_read: false,
      link: '/profile/baseballfan99'
    },
    {
      id: 3,
      type: 'system',
      title: 'Collection milestone',
      message: 'Congratulations! You now have 500 cards in your collection',
      timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      is_read: true,
      link: '/collection'
    }
  ]

  if (!isAuthenticated) return null

  return (
    <div className="notification-bell-container" ref={dropdownRef}>
      <button 
        className="notification-bell-button"
        onClick={handleBellClick}
        aria-label={`${unreadCount} unread notifications`}
      >
        <Icon name="bell" size={20} />
        {unreadCount > 0 && (
          <span className="notification-badge">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h3>Notifications</h3>
            {unreadCount > 0 && (
              <button 
                className="mark-all-read-btn"
                onClick={markAllAsRead}
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="notification-list">
            {loading ? (
              <div className="notification-loading">
                <Icon name="activity" size={20} className="spinner" />
                <span>Loading notifications...</span>
              </div>
            ) : notifications.length > 0 ? (
              notifications.map(notification => (
                <div 
                  key={notification.id}
                  className={`notification-item ${notification.is_read ? 'read' : 'unread'}`}
                  onClick={() => {
                    if (!notification.is_read) {
                      markAsRead(notification.id)
                    }
                    setShowDropdown(false)
                    if (notification.link) {
                      // Navigate to notification link if available
                    }
                  }}
                >
                  <div className="notification-icon">
                    <Icon name={getNotificationIcon(notification.type)} size={16} />
                  </div>
                  <div className="notification-content">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">{formatTimeAgo(notification.timestamp)}</div>
                  </div>
                  {!notification.is_read && (
                    <div className="notification-unread-dot"></div>
                  )}
                </div>
              ))
            ) : (
              <div className="notification-empty">
                <Icon name="inbox" size={32} />
                <span>No notifications yet</span>
                <p>You'll see updates about your collection and activity here</p>
              </div>
            )}
          </div>

          {notifications.length > 0 && (
            <div className="notification-dropdown-footer">
              <Link 
                to="/notifications" 
                className="view-all-notifications"
                onClick={() => setShowDropdown(false)}
              >
                View all notifications
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default NotificationBell