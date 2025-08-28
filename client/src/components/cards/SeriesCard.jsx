import React from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../Icon'
import './SeriesCard.css'

function SeriesCard({ series, showBadge = false, customOnClick = null }) {
  const navigate = useNavigate()

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

  const handleSeriesClick = () => {
    if (customOnClick) {
      customOnClick()
    } else {
      const seriesSlug = series.slug || series.series_id
      const setSlug = series.set_slug || 'unknown-set'
      const year = series.year || new Date().getFullYear()
      navigate(`/sets/${year}/${setSlug}/${seriesSlug}`)
    }
  }

  return (
    <div 
      className="seriescard-container"
      onClick={handleSeriesClick}
    >
      {/* Color stripe for parallel series */}
      {series.parallel_of && series.color_name && (
        <div 
          className="seriescard-color-stripe"
          style={{
            '--stripe-color': series.color_hex || '#ec4899',
            '--text-color': isLightColor(series.color_hex) ? '#000000' : '#ffffff'
          }}
        >
          <div className="seriescard-stripe-text">
            {series.color_name}{series.print_run_display ? `  ${series.print_run_display}` : ''}
          </div>
        </div>
      )}
      {showBadge && (
        <div className="seriescard-result-type-badge seriescard-result-type-badge-series">
          <Icon name="collection" size={14} />
          Series
        </div>
      )}
      
      <div className="seriescard-content">
        <div className="seriescard-name-section">
          <h3 className="seriescard-name">
            {series.name}
          </h3>
          <div className="seriescard-set-header">
            {series.set_name ? (
              <p className="seriescard-set-text">{series.set_name}</p>
            ) : (
              <p className="seriescard-set-text seriescard-set-placeholder">&nbsp;</p>
            )}
          </div>
        </div>
        
        <div className="seriescard-middle-space">
          {/* Empty space in middle */}
        </div>

        {/* Parallel parent name - shown above stats */}
        {series.parallel_parent_name && (
          <div className="seriescard-parallel-parent">
            {series.parallel_parent_name.replace(series.set_name || '', '').trim()}
          </div>
        )}

        <div className="seriescard-stats">
          <div className="seriescard-count">
            <span className="seriescard-count-number">{(series.card_count || 0).toLocaleString()}</span>
            <span className="seriescard-count-label">Cards</span>
          </div>
          <div className="seriescard-rc-count">
            <span className="seriescard-rc-count-number">{(series.rc_count || 0).toLocaleString()}</span>
            <span className="seriescard-rc-count-label">Rookies</span>
          </div>
          {series.parallel_count > 0 && (
            <div className="seriescard-parallel-count">
              <span className="seriescard-parallel-count-number">{series.parallel_count}</span>
              <span className="seriescard-parallel-count-label">Parallels</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default SeriesCard