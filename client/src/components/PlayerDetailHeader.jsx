import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import TeamFilterCircles from './TeamFilterCircles'
import './PlayerDetailHeader.css'

/**
 * PlayerDetailHeader - Reusable header component for player detail pages
 *
 * Features:
 * - Player name with HOF icon
 * - Nickname and birthdate
 * - Team filter circles
 * - Display card photo with zoom
 * - Interactive stats with filtering
 */
const PlayerDetailHeader = ({
  player,
  teams = [],
  stats = {},
  selectedTeamIds = [],
  onTeamFilter = null,
  activeStatFilter = null,
  onStatFilter = null
}) => {
  const [showImageViewer, setShowImageViewer] = useState(false)

  // Keyboard navigation for image viewer
  useEffect(() => {
    if (!showImageViewer) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowImageViewer(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [showImageViewer])

  if (!player) return null

  return (
    <>
    <header className="player-header-combined">
      <div className="player-header-layout">
        {/* Left side - Player Info */}
        <div className="player-identity">
          <h1 className="player-header-name">
            {player.first_name} {player.last_name}
            {player.is_hof && <Icon name="trophy" size={20} className="hof-icon" title="Hall of Fame" />}
          </h1>
          {player.nick_name && (
            <p className="player-nickname">"{player.nick_name}"</p>
          )}
          {player.birthdate && (
            <p className="player-birthdate">
              Born: {new Date(player.birthdate + 'T00:00:00').toLocaleDateString()}
            </p>
          )}
          
          {/* Team Circles in Header */}
          {teams.length > 0 && (
            <div className="header-teams">
              <TeamFilterCircles 
                teams={teams}
                selectedTeamIds={selectedTeamIds}
                onTeamFilter={onTeamFilter}
                compact={true}
              />
            </div>
          )}
        </div>

        {/* Display Card Photo */}
        {player.display_card_front_image ? (
          <div className="card-photo-display">
            <img
              src={player.display_card_front_image}
              alt={`${player.first_name} ${player.last_name}`}
              className="display-card-image clickable"
              onClick={() => setShowImageViewer(true)}
              title="Click to view full size"
            />
          </div>
        ) : (
          <div className="card-photo-placeholder">
            <div className="card-placeholder">
              <Icon name="layers" size={48} className="card-icon" />
              <span>No Card Image</span>
            </div>
          </div>
        )}

        {/* Right side - Stats */}
        <div className="player-stats-inline">
          <div className="stats-grid-inline">
            <div className="stat-item-inline">
              <div className="stat-content-inline">
                <span className="stat-value-inline">{stats.total_cards?.toLocaleString() || 0}</span>
                <span className="stat-label-inline">Total Cards</span>
              </div>
            </div>
            
            <div 
              className={`stat-item-inline clickable ${activeStatFilter === 'rookie' ? 'active' : ''}`}
              onClick={() => onStatFilter?.('rookie')}
              title="Click to filter by rookie cards"
            >
              <div className="stat-content-inline">
                <span className="stat-value-inline">{stats.rookie_cards?.toLocaleString() || 0}</span>
                <span className="stat-label-inline">Rookie Cards</span>
              </div>
            </div>
            
            <div 
              className={`stat-item-inline clickable ${activeStatFilter === 'autograph' ? 'active' : ''}`}
              onClick={() => onStatFilter?.('autograph')}
              title="Click to filter by autograph cards"
            >
              <div className="stat-content-inline">
                <span className="stat-value-inline">{stats.autograph_cards?.toLocaleString() || 0}</span>
                <span className="stat-label-inline">Autographs</span>
              </div>
            </div>
            
            <div 
              className={`stat-item-inline clickable ${activeStatFilter === 'relic' ? 'active' : ''}`}
              onClick={() => onStatFilter?.('relic')}
              title="Click to filter by relic cards"
            >
              <div className="stat-content-inline">
                <span className="stat-value-inline">{stats.relic_cards?.toLocaleString() || 0}</span>
                <span className="stat-label-inline">Relics</span>
              </div>
            </div>
            
            <div 
              className={`stat-item-inline clickable ${activeStatFilter === 'numbered' ? 'active' : ''}`}
              onClick={() => onStatFilter?.('numbered')}
              title="Click to filter by numbered cards"
            >
              <div className="stat-content-inline">
                <span className="stat-value-inline">{stats.numbered_cards?.toLocaleString() || 0}</span>
                <span className="stat-label-inline">Numbered</span>
              </div>
            </div>
            
            <div className="stat-item-inline">
              <div className="stat-content-inline">
                <span className="stat-value-inline">{stats.unique_series?.toLocaleString() || 0}</span>
                <span className="stat-label-inline">Series</span>
              </div>
            </div>
          </div>
        </div>
      </div>

    </header>

    {/* Full-screen Image Viewer - Rendered as Portal */}
    {showImageViewer && player.display_card_front_image && createPortal(
      <div
        className="player-image-viewer-overlay"
        onClick={() => setShowImageViewer(false)}
      >
        <div className="player-image-viewer-content" onClick={(e) => e.stopPropagation()}>
          <button
            className="player-image-viewer-close"
            onClick={() => setShowImageViewer(false)}
            title="Close (Esc)"
          >
            <Icon name="x" size={24} />
          </button>
          <img
            src={player.display_card_front_image}
            alt={`${player.first_name} ${player.last_name}`}
            className="player-image-viewer-image"
          />
        </div>
      </div>,
      document.body
    )}
  </>
  )
}

export default PlayerDetailHeader