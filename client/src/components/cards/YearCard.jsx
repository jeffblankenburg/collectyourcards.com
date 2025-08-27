import React from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import './YearCard.css'

function YearCard({ year, showBadge = false, customOnClick = null }) {
  const navigate = useNavigate()

  const handleYearClick = () => {
    if (customOnClick) {
      customOnClick()
    } else {
      navigate(`/sets/${year.year}`)
    }
  }

  return (
    <div 
      className="yearcard-container"
      onClick={handleYearClick}
    >
      {showBadge && (
        <div className="yearcard-result-type-badge yearcard-result-type-badge-year">
          <Icon name="calendar" size={14} />
          Year
        </div>
      )}
      
      <div className="yearcard-content">
        
        <div className="yearcard-middle-space">
          <h3 className="yearcard-name">
            {year.year}
          </h3>
        </div>

        <div className="yearcard-stats">
          <div className="yearcard-count">
            <span className="yearcard-count-number">{(year.card_count || 0).toLocaleString()}</span>
            <span className="yearcard-count-label">Cards</span>
          </div>
          <div className="yearcard-set-count">
            <span className="yearcard-set-count-number">{(year.set_count || 0).toLocaleString()}</span>
            <span className="yearcard-set-count-label">Sets</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default YearCard