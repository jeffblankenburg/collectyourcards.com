import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import Icon from '../components/Icon'
import './NotificationsScoped.css'

function Notifications() {
  const { isAuthenticated, user } = useAuth()
  const { addToast } = useToast()
  const navigate = useNavigate()
  
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [filter, setFilter] = useState('all') // 'all', 'unread', 'read'
  const [selectedNotifications, setSelectedNotifications] = useState(new Set())
  const [bulkAction, setBulkAction] = useState('')

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login')
      return
    }
    fetchNotifications()
  }, [isAuthenticated])

  const fetchNotifications = async () => {
    try {
      setLoading(true)
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      const response = await axios.get('/api/notifications?limit=100', config)
      
      // Check if response has the expected structure
      if (!response.data || !response.data.notifications) {
        console.error('Unexpected response structure:', response.data)
        setNotifications([])
        return
      }
      
      // Process notifications to add links
      const processedNotifications = response.data.notifications.map(notif => {
        let link = null
        
        if (notif.notification_type === 'comment' && notif.item_type && notif.item_id) {
          if (notif.item_type === 'card') {
            link = `/card/${notif.item_id}`
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
    } catch (error) {
      console.error('Error fetching notifications:', error)
      addToast('Failed to load notifications', 'error')
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
      
      setNotifications(prev => 
        prev.map(notif => 
          notif.id === notificationId ? { ...notif, is_read: true } : notif
        )
      )
    } catch (error) {
      console.error('Error marking notification as read:', error)
      addToast('Failed to mark notification as read', 'error')
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
      
      setNotifications(prev => 
        prev.map(notif => ({ ...notif, is_read: true }))
      )
      
      addToast('All notifications marked as read', 'success')
    } catch (error) {
      console.error('Error marking all as read:', error)
      addToast('Failed to mark all notifications as read', 'error')
    }
  }

  const deleteNotification = async (notificationId) => {
    try {
      setDeleting(true)
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.delete(`/api/notifications/${notificationId}`, config)
      
      setNotifications(prev => prev.filter(n => n.id !== notificationId))
      addToast('Notification deleted', 'success')
    } catch (error) {
      console.error('Error deleting notification:', error)
      addToast('Failed to delete notification', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const clearReadNotifications = async () => {
    if (!confirm('Are you sure you want to delete all read notifications?')) return
    
    try {
      setDeleting(true)
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      await axios.delete('/api/notifications/clear-read', config)
      
      setNotifications(prev => prev.filter(n => !n.is_read))
      addToast('Read notifications cleared', 'success')
    } catch (error) {
      console.error('Error clearing read notifications:', error)
      addToast('Failed to clear read notifications', 'error')
    } finally {
      setDeleting(false)
    }
  }

  const handleNotificationClick = async (notification) => {
    // Mark as read if not already
    if (!notification.is_read) {
      await markAsRead(notification.id)
    }
    
    // Navigate to the linked content if available
    if (notification.link) {
      navigate(notification.link)
    }
  }

  const handleBulkAction = async () => {
    if (selectedNotifications.size === 0) {
      addToast('No notifications selected', 'warning')
      return
    }

    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }

      if (bulkAction === 'mark-read') {
        for (const id of selectedNotifications) {
          await axios.put(`/api/notifications/${id}/read`, {}, config)
        }
        
        setNotifications(prev => 
          prev.map(notif => 
            selectedNotifications.has(notif.id) ? { ...notif, is_read: true } : notif
          )
        )
        addToast('Selected notifications marked as read', 'success')
      } else if (bulkAction === 'delete') {
        if (!confirm(`Are you sure you want to delete ${selectedNotifications.size} notifications?`)) return
        
        for (const id of selectedNotifications) {
          await axios.delete(`/api/notifications/${id}`, config)
        }
        
        setNotifications(prev => prev.filter(n => !selectedNotifications.has(n.id)))
        addToast('Selected notifications deleted', 'success')
      }
      
      setSelectedNotifications(new Set())
      setBulkAction('')
    } catch (error) {
      console.error('Error performing bulk action:', error)
      addToast('Failed to perform bulk action', 'error')
    }
  }

  const toggleSelectNotification = (id) => {
    const newSet = new Set(selectedNotifications)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    setSelectedNotifications(newSet)
  }

  const toggleSelectAll = () => {
    if (selectedNotifications.size === filteredNotifications.length) {
      setSelectedNotifications(new Set())
    } else {
      setSelectedNotifications(new Set(filteredNotifications.map(n => n.id)))
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
    return time.toLocaleDateString()
  }

  const getNotificationIcon = (type) => {
    switch (type) {
      case 'comment':
        return 'message-square'
      case 'achievement':
        return 'trophy'
      case 'collection':
        return 'folder'
      case 'system':
        return 'bell'
      default:
        return 'bell'
    }
  }

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read
    if (filter === 'read') return n.is_read
    return true
  })

  const unreadCount = notifications.filter(n => !n.is_read).length

  return (
    <div className="notifications-page">
      <div className="notifications-header">
        <h1>
          <Icon name="bell" size={32} />
          Notifications
        </h1>
        
        <div className="header-actions">
          {unreadCount > 0 && (
            <button 
              className="mark-all-btn"
              onClick={markAllAsRead}
            >
              <Icon name="check-circle" size={16} />
              Mark all read
            </button>
          )}
          
          <button 
            className="clear-read-btn"
            onClick={clearReadNotifications}
            disabled={deleting || notifications.filter(n => n.is_read).length === 0}
          >
            <Icon name="trash" size={16} />
            Clear read
          </button>
        </div>
      </div>

      <div className="notifications-controls">
        <div className="filter-tabs">
          <button 
            className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            All ({notifications.length})
          </button>
          <button 
            className={`filter-tab ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Unread ({unreadCount})
          </button>
          <button 
            className={`filter-tab ${filter === 'read' ? 'active' : ''}`}
            onClick={() => setFilter('read')}
          >
            Read ({notifications.length - unreadCount})
          </button>
        </div>

        {selectedNotifications.size > 0 && (
          <div className="bulk-actions">
            <select 
              value={bulkAction} 
              onChange={(e) => setBulkAction(e.target.value)}
              className="bulk-select"
            >
              <option value="">Select action...</option>
              <option value="mark-read">Mark as read</option>
              <option value="delete">Delete</option>
            </select>
            <button 
              className="apply-btn"
              onClick={handleBulkAction}
              disabled={!bulkAction}
            >
              Apply to {selectedNotifications.size} selected
            </button>
          </div>
        )}
      </div>

      <div className="notifications-container">
        {loading ? (
          <div className="loading-state">
            <Icon name="loader" size={32} className="spinner" />
            <p>Loading notifications...</p>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="empty-state">
            <Icon name="inbox" size={48} />
            <h3>No notifications</h3>
            <p>
              {filter === 'unread' 
                ? "You're all caught up!"
                : filter === 'read'
                ? "No read notifications"
                : "You don't have any notifications yet"}
            </p>
          </div>
        ) : (
          <div className="notifications-list">
            {filteredNotifications.length > 0 && (
              <div className="select-all-row">
                <input 
                  type="checkbox"
                  checked={selectedNotifications.size === filteredNotifications.length}
                  onChange={toggleSelectAll}
                />
                <span>Select all</span>
              </div>
            )}
            
            {filteredNotifications.map(notification => (
              <div 
                key={notification.id}
                className={`notification-item ${notification.is_read ? 'read' : 'unread'} ${
                  selectedNotifications.has(notification.id) ? 'selected' : ''
                }`}
              >
                <input 
                  type="checkbox"
                  checked={selectedNotifications.has(notification.id)}
                  onChange={() => toggleSelectNotification(notification.id)}
                  onClick={(e) => e.stopPropagation()}
                />
                
                <div 
                  className="notification-content"
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-icon">
                    <Icon name={getNotificationIcon(notification.type)} size={20} />
                  </div>
                  
                  <div className="notification-details">
                    <div className="notification-title">{notification.title}</div>
                    <div className="notification-message">{notification.message}</div>
                    <div className="notification-time">{formatTimeAgo(notification.timestamp)}</div>
                  </div>
                  
                  {!notification.is_read && (
                    <div className="unread-indicator"></div>
                  )}
                </div>
                
                <button 
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    deleteNotification(notification.id)
                  }}
                  disabled={deleting}
                  title="Delete notification"
                >
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default Notifications