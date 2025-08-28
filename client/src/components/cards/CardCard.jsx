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
      // Use new simple URL format: /card/:seriesSlug/:cardNumber/:playerName
      if (card.card_number && card.series_slug) {
        // Get player name from available data
        const playerName = card.player_name || card.player_names || card.title || 'unknown'
        
        // Create player slug
        const playerSlug = playerName
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
        
        navigate(`/card/${card.series_slug}/${card.card_number}/${playerSlug}`)
      } else if (card.set_slug && card.series_slug && card.card_slug) {
        // Fallback to complex URL if series_slug is missing but other data is available
        const year = card.set_year || card.year || new Date().getFullYear()
        navigate(`/sets/${year}/${card.set_slug}/${card.series_slug}/${card.card_slug}`)
      } else {
        // Final fallback to series page
        if (card.series_slug) {
          navigate(`/series/${card.series_slug}`)
        }
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
      {/* Color stripe for parallel cards */}
      {(card.is_parallel || card.color_name) && (
        <div 
          className="cardcard-color-stripe"
          style={{
            '--stripe-color': card.color_hex || '#ec4899',
            '--text-color': isLightColor(card.color_hex) ? '#000000' : '#ffffff'
          }}
        >
          <div className="cardcard-stripe-text">
            {card.color_name || 'Parallel'}
            {getPrintRunDisplay() && `  ${getPrintRunDisplay()}`}
          </div>
        </div>
      )}

      {/* Result Type Badge */}
      {showBadge && (
        <div className="cardcard-result-type-badge">
          <Icon name="card" size={14} />
          Card
        </div>
      )}

      <div className="cardcard-content">
        {/* Card Number as Title */}
        <div className="cardcard-header">
          <h3 className="cardcard-number">
            {card.card_number || 'N/A'}
          </h3>
        </div>

        {/* Player Name */}
        <div className="cardcard-player-line">
          <p className="cardcard-player-name">
            {card.player_name || card.title || 'Unknown'}
            {card.is_rookie && (
              <span className="cardcard-tag cardcard-rc cardcard-rc-inline"> RC</span>
            )}
          </p>
          {card.series_name && (
            <p className="cardcard-series-name">
              {card.series_name}
            </p>
          )}
        </div>

        {/* Team Circle and Tags */}
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
          {card.is_autograph && (
            <span className="cardcard-tag cardcard-auto">AUTO</span>
          )}
          {card.is_relic && (
            <span className="cardcard-tag cardcard-relic">RELIC</span>
          )}
          {card.is_insert && (
            <span className="cardcard-tag cardcard-insert">INSERT</span>
          )}
        </div>

        {/* Card Stats Section */}
        <div className="cardcard-stats">
          {/* Estimated Value */}
          <div className="cardcard-estimated-value">
            <div className="cardcard-estimated-value-number">
              ${card.estimated_value || '0.00'}
            </div>
            <div className="cardcard-estimated-value-label">
              Value
            </div>
          </div>
          
          {/* User Owned Count */}
          <div className="cardcard-user-count">
            <div className="cardcard-user-count-number">
              {card.user_count || 0}
            </div>
            <div className="cardcard-user-count-label">
              Owned
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CardCard