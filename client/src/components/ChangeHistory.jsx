import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import axios from 'axios'
import Icon from './Icon'
import './ChangeHistoryScoped.css'

/**
 * ChangeHistory - Displays the edit history for an entity (card, series, set, player, team)
 *
 * Props:
 *   entityType: 'card' | 'series' | 'set' | 'player' | 'team'
 *   entityId: number - The ID of the entity
 *   title: string (optional) - Custom title for the section
 */
function ChangeHistory({ entityType, entityId, title }) {
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (entityId) {
      fetchHistory()
    }
  }, [entityType, entityId])

  const fetchHistory = async () => {
    try {
      setLoading(true)
      setError(null)

      // Build the API endpoint based on entity type
      let endpoint
      switch (entityType) {
        case 'card':
          endpoint = `/api/cards/${entityId}/history`
          break
        case 'series':
          endpoint = `/api/series-list/${entityId}/history`
          break
        case 'set':
          endpoint = `/api/sets-list/${entityId}/history`
          break
        case 'player':
          endpoint = `/api/players/${entityId}/history`
          break
        case 'team':
          endpoint = `/api/teams/${entityId}/history`
          break
        default:
          throw new Error(`Unknown entity type: ${entityType}`)
      }

      const response = await axios.get(endpoint)
      setHistory(response.data.history || [])
    } catch (err) {
      console.error('Failed to fetch history:', err)
      setError('Failed to load edit history')
    } finally {
      setLoading(false)
    }
  }

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffMs = now - date
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'just now'
    if (diffMins < 60) return `${diffMins} minute${diffMins !== 1 ? 's' : ''} ago`
    if (diffHours < 24) return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    if (diffDays < 7) return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    })
  }

  const getDefaultAvatar = (name) => {
    const initials = name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
    return initials
  }

  // Don't render anything if there's no history
  if (!loading && history.length === 0) {
    return null
  }

  return (
    <div className="change-history-container">
      <div
        className="change-history-header"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="change-history-title">
          <Icon name="clock" size={18} />
          <span>{title || 'Edit History'}</span>
          {!loading && <span className="change-history-count">({history.length})</span>}
        </div>
        <Icon
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={20}
          className="change-history-toggle"
        />
      </div>

      {expanded && (
        <div className="change-history-content">
          {loading ? (
            <div className="change-history-loading">
              <Icon name="loader" size={20} className="spinning" />
              <span>Loading history...</span>
            </div>
          ) : error ? (
            <div className="change-history-error">
              <Icon name="alert-circle" size={16} />
              <span>{error}</span>
            </div>
          ) : (
            <div className="change-history-list">
              {history.map((entry) => (
                <div key={entry.id} className="change-history-entry">
                  <div className="change-history-entry-header">
                    <div className="change-history-user">
                      {entry.user.username ? (
                        <Link to={`/profile/${entry.user.username}`} className="change-history-user-link">
                          {entry.user.avatar_url ? (
                            <img
                              src={entry.user.avatar_url}
                              alt={entry.user.name}
                              className="change-history-avatar"
                            />
                          ) : (
                            <div className="change-history-avatar-placeholder">
                              {getDefaultAvatar(entry.user.name)}
                            </div>
                          )}
                          <span className="change-history-username">{entry.user.name}</span>
                        </Link>
                      ) : (
                        <>
                          {entry.user.avatar_url ? (
                            <img
                              src={entry.user.avatar_url}
                              alt={entry.user.name}
                              className="change-history-avatar"
                            />
                          ) : (
                            <div className="change-history-avatar-placeholder">
                              {getDefaultAvatar(entry.user.name)}
                            </div>
                          )}
                          <span className="change-history-username">{entry.user.name}</span>
                        </>
                      )}
                      {entry.is_admin_edit && (
                        <span className="change-history-admin-badge" title="Admin edit">
                          <Icon name="shield" size={12} />
                        </span>
                      )}
                    </div>
                    <span className="change-history-timestamp" title={new Date(entry.timestamp).toLocaleString()}>
                      {formatTimestamp(entry.timestamp)}
                    </span>
                  </div>
                  <div className="change-history-changes">
                    {entry.changes.map((change, idx) => (
                      <div key={idx} className="change-history-change">
                        <span className="change-field">{change.field}:</span>
                        {/* Handle card links for Display Image changes */}
                        {change.from_card_id ? (
                          <Link to={`/cards/${change.from_card_id}`} className="change-from change-link">
                            {change.from}
                          </Link>
                        ) : (
                          <span className="change-from">{change.from}</span>
                        )}
                        <Icon name="arrow-right" size={14} className="change-arrow" />
                        {change.to_card_id ? (
                          <Link to={`/cards/${change.to_card_id}`} className="change-to change-link">
                            {change.to}
                          </Link>
                        ) : (
                          <span className="change-to">{change.to}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default ChangeHistory
