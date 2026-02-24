import './CardPreviewTile.css'

/**
 * CardPreviewTile - Visual card tile for Add Card grid
 *
 * Displays card image, badges, and key info for visual matching.
 * Users compare this to their physical card to find matches.
 */
export default function CardPreviewTile({ card, onAddClick }) {
  // Get display image from front_image_path or reference photo
  const getCardImage = () => {
    if (card.front_image_path) {
      return card.front_image_path
    }
    // Reference user card photo would come from a separate lookup
    // For now, return null and show placeholder
    return null
  }

  const imageUrl = getCardImage()
  const hasOwned = card.user_card_count > 0

  // Build display text
  const setYear = card.set_rel?.year
  const setName = card.set_rel?.name || 'Unknown Set'
  const seriesName = card.series_rel?.name || ''
  const colorName = card.color_rel?.color || ''

  return (
    <div className={`card-preview-tile ${hasOwned ? 'card-preview-owned' : ''}`}>
      {/* Card Image */}
      <div className="card-preview-image-container">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={`Card #${card.card_number}`}
            className="card-preview-image"
            loading="lazy"
            onError={(e) => {
              e.target.style.display = 'none'
              e.target.nextSibling.style.display = 'flex'
            }}
          />
        ) : null}
        <div
          className="card-preview-placeholder"
          style={{ display: imageUrl ? 'none' : 'flex' }}
        >
          <span className="card-preview-placeholder-number">#{card.card_number}</span>
          <span className="card-preview-placeholder-text">No image</span>
        </div>

        {/* Badges overlay */}
        <div className="card-preview-badges">
          {card.is_rookie && <span className="card-badge card-badge-rc">RC</span>}
          {card.is_autograph && <span className="card-badge card-badge-auto">AUTO</span>}
          {card.is_relic && <span className="card-badge card-badge-relic">RELIC</span>}
          {card.is_short_print && <span className="card-badge card-badge-sp">SP</span>}
        </div>

        {/* Owned indicator */}
        {hasOwned && (
          <div className="card-preview-owned-badge">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
            <span>Owned ({card.user_card_count})</span>
          </div>
        )}
      </div>

      {/* Card Info */}
      <div className="card-preview-info">
        <div className="card-preview-number">#{card.card_number}</div>
        <div className="card-preview-set">
          {setYear && <span className="card-preview-year">{setYear}</span>}
          <span className="card-preview-set-name">{setName}</span>
        </div>
        {seriesName && seriesName.toLowerCase() !== 'base' && (
          <div className="card-preview-series">{seriesName}</div>
        )}
        {colorName && (
          <div className="card-preview-color">
            {card.color_rel?.hex_color && (
              <span
                className="card-preview-color-dot"
                style={{ backgroundColor: card.color_rel.hex_color }}
              ></span>
            )}
            <span>{colorName}</span>
            {card.print_run && <span className="card-preview-print-run">/{card.print_run}</span>}
          </div>
        )}
      </div>

      {/* Add Button */}
      <button
        type="button"
        className="card-preview-add-btn"
        onClick={() => onAddClick(card)}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14"></path>
        </svg>
        {hasOwned ? 'Add Another' : 'Add to Collection'}
      </button>
    </div>
  )
}
