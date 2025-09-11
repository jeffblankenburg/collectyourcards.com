import React from 'react'
import Icon from '../Icon'
import './GalleryCard.css'

/**
 * GalleryCard - A card component focused on displaying card images
 * Used in gallery views for collections, search results, etc.
 * 
 * @param {Object} card - The card data object
 * @param {Function} onClick - Click handler for the card
 * @param {Function} onFavoriteToggle - Handler for favorite star toggle
 * @param {boolean} showFavorite - Whether to show the favorite star
 * @param {boolean} isFavorite - Whether the card is favorited
 * @param {string} imageUrl - URL for the card image
 * @param {string} placeholderImage - Fallback image if no image available
 */
const GalleryCard = ({ 
  card, 
  onClick, 
  onFavoriteToggle,
  showFavorite = false,
  isFavorite = false,
  imageUrl = null,
  placeholderImage = null
}) => {
  // Get the first player/team for display
  const primaryPlayer = card.card_player_teams?.[0]?.player || card.player
  const primaryTeam = card.card_player_teams?.[0]?.team || card.team
  
  // Format player name
  const playerName = primaryPlayer ? 
    `${primaryPlayer.first_name || ''} ${primaryPlayer.last_name || ''}`.trim() : 
    'Unknown Player'
  
  // Get series name
  const seriesName = card.series_rel?.name || card.series_name || ''
  
  // Get card image - could be from user_card photos or card/series default images
  const cardImage = imageUrl || 
    card.primary_photo_url || 
    card.front_image_url || 
    card.front_image_path ||
    card.series_rel?.front_image_path ||
    card.image_url ||
    placeholderImage
    
  const hasImage = !!cardImage

  return (
    <div 
      className="gallery-card"
      onClick={onClick}
      style={{
        '--primary-color': primaryTeam?.primary_color || '#333',
        '--secondary-color': primaryTeam?.secondary_color || '#666'
      }}
    >
      {/* Card Image - No obstructions */}
      <div className="gallery-card-image-container">
        {hasImage ? (
          <img 
            src={cardImage} 
            alt={`${playerName} - ${card.card_number}`}
            className="gallery-card-image"
          />
        ) : (
          <div className="gallery-card-placeholder">
            <div className="gallery-placeholder-content">
              <Icon name="camera" size={32} className="gallery-placeholder-icon" />
              <div className="gallery-placeholder-upload-text">Upload Photo</div>
              <div className="gallery-placeholder-number">#{card.card_number}</div>
              <div className="gallery-placeholder-player">{playerName}</div>
              <div className="gallery-placeholder-series">{seriesName}</div>
            </div>
          </div>
        )}
      </div>

      {/* Simplified Card Info */}
      <div className="gallery-card-info">
        <div className="gallery-card-header">
          <span className="gallery-card-number">#{card.card_number}</span>
          {primaryTeam && (
            <div 
              className="team-circle-base team-circle-sm"
              style={{
                '--primary-color': primaryTeam.primary_color || '#333',
                '--secondary-color': primaryTeam.secondary_color || '#666'
              }}
            >
              {primaryTeam.abbreviation}
            </div>
          )}
        </div>
        
        <div className="gallery-player-name">{playerName}</div>
        <div className="gallery-series-name">{seriesName}</div>
        
        {/* Location tag row */}
        <div className="gallery-card-tags">
          {card.location_name && (
            <span className="collection-table-location-tag">{card.location_name}</span>
          )}
        </div>
        
        {/* Card attribute tags row */}
        <div className="gallery-card-tags">
          {card.is_rookie && <span className="cardcard-tag cardcard-rc">RC</span>}
          {card.is_autograph && <span className="cardcard-tag cardcard-insert">AUTO</span>}
          {card.is_relic && <span className="cardcard-tag cardcard-relic">RELIC</span>}
          {card.serial_number && card.print_run && (
            <span className="cardcard-tag cardcard-serial">{card.serial_number}/{card.print_run}</span>
          )}
        </div>
      </div>
    </div>
  )
}

export default GalleryCard