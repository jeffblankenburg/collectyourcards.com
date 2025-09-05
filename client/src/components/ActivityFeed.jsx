import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Icon from './Icon'
import './ActivityFeed.css'

function ActivityFeed({ setId, title = "Recent Activity" }) {
  const [activities, setActivities] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    if (setId) {
      fetchActivities(1, true)
    }
  }, [setId])

  const fetchActivities = async (pageNum = 1, reset = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true)
        setError('')
      } else {
        setLoadingMore(true)
      }

      const response = await axios.get(`/api/comments/set/${setId}/activity`, {
        params: { page: pageNum, limit: 20 }
      })

      const newActivities = response.data.activities || []
      const pagination = response.data.pagination || {}

      if (reset) {
        setActivities(newActivities)
      } else {
        setActivities(prev => [...prev, ...newActivities])
      }

      setPage(pageNum)
      setHasMore(pagination.page < pagination.totalPages)

    } catch (err) {
      console.error('Error fetching activity feed:', err)
      setError('Failed to load activity feed')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  const loadMore = () => {
    if (!loadingMore && hasMore) {
      fetchActivities(page + 1, false)
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
      day: 'numeric',
      year: time.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  const getActivityTypeIcon = (activityType) => {
    switch (activityType) {
      case 'series':
        return 'layers'
      case 'card':
        return 'credit-card'
      default:
        return 'message-square'
    }
  }

  const getActivityTypeLabel = (activityType) => {
    switch (activityType) {
      case 'series':
        return 'commented on series'
      case 'card':
        return 'commented on card'
      default:
        return 'commented'
    }
  }

  if (loading) {
    return (
      <div className="activity-feed">
        <div className="activity-header">
          <h3>
            <Icon name="activity" size={20} />
            {title}
          </h3>
        </div>
        <div className="activity-loading">
          <Icon name="activity" size={24} className="spinner" />
          <span>Loading activity...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="activity-feed">
        <div className="activity-header">
          <h3>
            <Icon name="activity" size={20} />
            {title}
          </h3>
        </div>
        <div className="activity-error">
          <Icon name="alert-circle" size={24} />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  if (activities.length === 0) {
    return (
      <div className="activity-feed">
        <div className="activity-header">
          <h3>
            <Icon name="activity" size={20} />
            {title}
          </h3>
        </div>
        <div className="activity-empty">
          <Icon name="message-square" size={32} />
          <span>No recent activity</span>
          <p>Comments on cards and series in this set will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div className="activity-feed">
      <div className="activity-header">
        <h3>
          <Icon name="activity" size={20} />
          {title}
        </h3>
        <span className="activity-count">{activities.length} recent items</span>
      </div>

      <div className="activity-list">
        {activities.map((activity) => (
          <div key={activity.comment_id} className="activity-item">
            <div className="activity-avatar">
              {activity.user.avatar_url ? (
                <img 
                  src={activity.user.avatar_url} 
                  alt={activity.user.username}
                  className="user-avatar"
                />
              ) : (
                <div className="default-avatar">
                  <Icon name="user" size={16} />
                </div>
              )}
            </div>

            <div className="activity-content">
              <div className="activity-meta">
                <a 
                  href={`/${activity.user.username}`}
                  className="user-link"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {activity.user.username}
                </a>
                <Icon 
                  name={getActivityTypeIcon(activity.activity_type)} 
                  size={14} 
                  className="activity-type-icon"
                />
                <span className="activity-type">
                  {getActivityTypeLabel(activity.activity_type)}
                </span>
                <span className="activity-target">
                  {activity.context_name}
                </span>
                <span className="activity-time">
                  {formatTimeAgo(activity.created_at)}
                </span>
                {activity.is_edited && (
                  <span className="edited-indicator">
                    <Icon name="edit-3" size={12} />
                    edited
                  </span>
                )}
              </div>

              <div className="activity-comment">
                {activity.comment_text}
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="activity-load-more">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="load-more-btn"
          >
            {loadingMore ? (
              <>
                <Icon name="activity" size={16} className="spinner" />
                Loading more...
              </>
            ) : (
              <>
                <Icon name="chevron-down" size={16} />
                Load more activity
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

export default ActivityFeed