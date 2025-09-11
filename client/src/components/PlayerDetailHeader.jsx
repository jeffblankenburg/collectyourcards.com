import React from 'react'
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
 * - Placeholder card photos
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
  if (!player) return null

  return (
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
              Born: {new Date(player.birthdate).toLocaleDateString()}
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

        {/* Card Photos */}
        <div className="card-photo-placeholder">
          <div className="card-placeholder">
            <Icon name="layers" size={48} className="card-icon" />
            <span>Card Photo 1</span>
          </div>
        </div>

        <div className="card-photo-placeholder">
          <div className="card-placeholder">
            <Icon name="layers" size={48} className="card-icon" />
            <span>Card Photo 2</span>
          </div>
        </div>

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
  )
}

export default PlayerDetailHeader