import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import './SetCard.css'

function SetCard({ set, showBadge = false, customOnClick = null, onEditClick = null }) {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuth()

  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  const handleSetClick = () => {
    if (customOnClick) {
      customOnClick()
    } else {
      navigate(`/sets/${set.year}/${set.set_id}`)
    }
  }

  // Determine thumbnail size based on title length
  const getThumbnailSize = () => {
    if (!set.name) return null
    if (set.name.length <= 20) return 'large' // ~1 line = 90px
    if (set.name.length <= 40) return 'small' // ~2 lines = 60px
    return null // No thumbnail for longer titles
  }

  const thumbnailSize = getThumbnailSize()
  const showThumbnail = thumbnailSize !== null

  // Get sport icon based on sport or organization
  const getSportIcon = () => {
    const sport = set.sport || 'other'
    if (sport === 'baseball') return 'baseball'
    if (sport === 'football') return 'football'
    if (sport === 'basketball') return 'basketball'
    if (sport === 'hockey') return 'hockey'
    if (sport === 'soccer') return 'soccer'
    return 'layers'
  }

  return (
    <div
      className="setcard-container"
      onClick={handleSetClick}
    >
      {/* Coming Soon Ribbon for sets with 0 cards */}
      {set.card_count === 0 && (
        <div className="setcard-coming-soon-ribbon">
          <span>Coming Soon</span>
        </div>
      )}

      {showBadge && (
        <div className="setcard-result-type-badge setcard-result-type-badge-set">
          <Icon name="layers" size={14} />
          Set
        </div>
      )}
      
      <div className="setcard-content">
        <div className="setcard-name-section">
          <div className="setcard-sport-icon">
            <Icon name={getSportIcon()} size={22} />
          </div>
          <h3 className="setcard-name">{set.name}</h3>
        </div>
        
        <div className="setcard-middle-space">
          {showThumbnail && set.thumbnail && (
            <div className={`setcard-thumbnail setcard-thumbnail-${thumbnailSize}`}>
              <img src={set.thumbnail} alt={`${set.name} thumbnail`} />
            </div>
          )}
        </div>

        <div className="setcard-stats">
          <div className="setcard-count">
            <span className="setcard-count-number">{(set.card_count || 0).toLocaleString()}</span>
            <span className="setcard-count-label">Cards</span>
          </div>
          <div className="setcard-series-count">
            <span className="setcard-series-count-number">{(set.series_count || 0).toLocaleString()}</span>
            <span className="setcard-series-count-label">Series</span>
          </div>
        </div>
      </div>
      
      {/* Edit Button - shown for all authenticated users */}
      {isAuthenticated && (
        <button
          className="setcard-edit-btn"
          onClick={(e) => {
            e.stopPropagation()
            if (onEditClick) {
              onEditClick(set)
            }
          }}
          title={isAdmin ? 'Edit set' : 'Suggest set update'}
        >
          <Icon name="edit" size={14} />
        </button>
      )}
    </div>
  )
}

export default SetCard