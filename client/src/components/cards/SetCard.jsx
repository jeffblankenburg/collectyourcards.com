import React from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import './SetCard.css'

function SetCard({ set, showBadge = false, customOnClick = null }) {
  const navigate = useNavigate()

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
          {/* Empty space - background image handles the visual */}
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
    </div>
  )
}

export default SetCard