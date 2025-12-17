import React from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import './CardCard.css'

function CardCard({ card, showBadge = false, customOnClick = null }) {
  const navigate = useNavigate()

  const handleCardClick = () => {
    if (customOnClick) {
      customOnClick()
    } else {
      // Navigate to card detail page by ID
      if (card.card_id) {
        navigate(`/cards/${card.card_id}`)
      } else if (card.series_id) {
        // Fallback to series page if no card_id
        navigate(`/series/${card.series_id}`)
      }
    }
  }

  // Function to determine if a color is light or dark
  const isLightColor = (hex) => {
    if (!hex) return false
    // Remove # if present
    hex = hex.replace('#', '')
    // Convert to RGB
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  // Format print run display
  const getPrintRunDisplay = () => {
    if (card.serial_number && card.print_run) {
      return `${card.serial_number}/${card.print_run}`
    } else if (card.print_run) {
      return `/${card.print_run}`
    }
    return null
  }

  return (
    <div 
      className="cardcard-container"
      onClick={handleCardClick}
    >
      {/* Color stripe */}
      {(card.is_parallel || card.color_name) && (
        <div
          className="cardcard-color-stripe"
          style={{
            '--stripe-color': card.color_hex || '#808080',
            '--text-color': isLightColor(card.color_hex) ? '#000000' : '#ffffff'
          }}
        >
          <div className="cardcard-stripe-text">
            {card.color_name || 'Parallel'}
            {getPrintRunDisplay() && ` ${getPrintRunDisplay()}`}
          </div>
        </div>
      )}

      {/* Result Type Badge */}
      {showBadge && (
        <div className="cardcard-result-type-badge">
          <Icon name="layers" size={14} />
          Card
        </div>
      )}

      <div className="cardcard-content">
        <div className="cardcard-header">
          <h3 className="cardcard-number">
            {card.card_number || 'N/A'}
            {card.is_autograph && (
              <span className="cardcard-tag cardcard-insert cardcard-rc-inline">AUTO</span>
            )}
            {card.is_relic && (
              <span className="cardcard-tag cardcard-relic cardcard-rc-inline">RELIC</span>
            )}
            {card.is_short_print && (
              <span className="cardcard-tag cardcard-sp cardcard-rc-inline">SP</span>
            )}
          </h3>
        </div>

        <div className="cardcard-player-line">
          <p className="cardcard-player-name">
            {card.player_name || card.title || 'Unknown'}
            {card.is_rookie && (
              <span className="cardcard-tag cardcard-rc cardcard-rc-inline"> RC</span>
            )}
          </p>
          <p className="cardcard-series-name">{card.series_name}</p>
        </div>

        <div className="cardcard-tags-line">
          {card.team_name && (
            <div 
              className="cardcard-team-circle"
              style={{
                '--team-primary': card.team_primary_color || '#333',
                '--team-secondary': card.team_secondary_color || '#666'
              }}
              title={card.team_name}
            >
              <span>{card.team_abbreviation || card.team_name.substring(0, 3).toUpperCase()}</span>
            </div>
          )}
        </div>

        <div className="cardcard-stats">
          <div className="cardcard-estimated-value">
            <div className="cardcard-estimated-value-number">${card.estimated_value || '0.00'}</div>
            <div className="cardcard-estimated-value-label">Value</div>
          </div>
          <div className="cardcard-user-count">
            <div className="cardcard-user-count-number">{card.user_count || 0}</div>
            <div className="cardcard-user-count-label">Owned</div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CardCard