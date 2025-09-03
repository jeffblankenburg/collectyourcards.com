import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import './SetCard.css'

function SetCard({ set, showBadge = false, customOnClick = null }) {
  const navigate = useNavigate()
  const { user } = useAuth()
  
  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  const handleSetClick = () => {
    if (customOnClick) {
      customOnClick()
    } else {
      const slug = set.slug || set.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      navigate(`/sets/${set.year}/${slug}`)
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

  return (
    <div 
      className="setcard-container"
      onClick={handleSetClick}
    >
      {showBadge && (
        <div className="setcard-result-type-badge setcard-result-type-badge-set">
          <Icon name="layers" size={14} />
          Set
        </div>
      )}
      
      <div className="setcard-content">
        <div className="setcard-name-section">
          <h3 className="setcard-name">
            {set.name}
          </h3>
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
      
      {/* Admin Edit Button */}
      {isAdmin && (
        <button 
          className="setcard-admin-edit-btn"
          onClick={(e) => {
            e.stopPropagation()
            navigate(`/admin/sets?search=${encodeURIComponent(set.name)}`)
          }}
          title="Edit set (Admin)"
        >
          <Icon name="edit" size={14} />
        </button>
      )}
    </div>
  )
}

export default SetCard