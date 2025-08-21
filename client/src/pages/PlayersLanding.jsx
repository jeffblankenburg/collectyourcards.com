import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './PlayersLanding.css'

function PlayersLanding() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [players, setPlayers] = useState([])
  const [recentPlayers, setRecentPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadPlayersData()
    if (isAuthenticated) {
      loadRecentVisits()
    }
  }, [isAuthenticated])

  const loadPlayersData = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/players-list?limit=50')
      setPlayers(response.data.players || [])
      setError(null)
    } catch (err) {
      console.error('Error loading players:', err)
      setError('Failed to load players data')
    } finally {
      setLoading(false)
    }
  }

  const loadRecentVisits = () => {
    try {
      const recent = localStorage.getItem('recentPlayerVisits')
      if (recent) {
        setRecentPlayers(JSON.parse(recent).slice(0, 6)) // Show max 6 recent
      }
    } catch (err) {
      console.error('Error loading recent visits:', err)
    }
  }

  const handlePlayerClick = (player) => {
    const slug = `${player.first_name}-${player.last_name}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Track visit for logged-in users
    if (isAuthenticated) {
      trackPlayerVisit({
        ...player,
        slug
      })
    }

    navigate(`/players/${slug}`)
  }

  const trackPlayerVisit = (player) => {
    try {
      const recent = JSON.parse(localStorage.getItem('recentPlayerVisits') || '[]')
      
      // Remove if already exists
      const filtered = recent.filter(p => p.player_id !== player.player_id)
      
      // Add to front
      const updated = [player, ...filtered].slice(0, 20) // Keep max 20
      
      localStorage.setItem('recentPlayerVisits', JSON.stringify(updated))
      setRecentPlayers(updated.slice(0, 6))
    } catch (err) {
      console.error('Error tracking visit:', err)
    }
  }

  const PlayerCard = ({ player, isRecent = false }) => (
    <div 
      className={`player-card ${isRecent ? 'recent' : ''}`}
      onClick={() => handlePlayerClick(player)}
    >
      <div className="player-card-content">
        <div className="player-info">
          <h3 className="player-name">
            {player.first_name} {player.last_name}
            {player.is_hof && <Icon name="trophy" size={16} className="hof-icon" />}
          </h3>
          {player.nick_name && (
            <p className="player-nickname">"{player.nick_name}"</p>
          )}
        </div>
        
        <div className="player-stats">
          <div className="card-count">
            <span className="count-number">{player.card_count.toLocaleString()}</span>
            <span className="count-label">Cards</span>
          </div>
        </div>

        <div className="player-teams">
          {player.teams?.slice(0, 4).map(team => (
            <div
              key={team.team_id}
              className="mini-team-circle"
              style={{
                '--primary-color': team.primary_color || '#666',
                '--secondary-color': team.secondary_color || '#999'
              }}
              title={`${team.name} (${team.card_count} cards)`}
            >
              {team.abbreviation}
            </div>
          ))}
          {player.teams?.length > 4 && (
            <div className="more-teams">+{player.teams.length - 4}</div>
          )}
        </div>
      </div>
    </div>
  )

  if (loading) {
    return (
      <div className="players-landing">
        <div className="landing-header">
          <h1>Players</h1>
        </div>
        <div className="loading-container">
          <Icon name="activity" size={24} className="spinner" />
          <p>Loading players...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="players-landing">
        <div className="landing-header">
          <h1>Players</h1>
        </div>
        <div className="error-container">
          <Icon name="error" size={24} />
          <p>{error}</p>
          <button onClick={loadPlayersData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="players-landing">
      <div className="landing-header">
        <h1>Players</h1>
        <p>Discover players and their card collections</p>
      </div>

      {isAuthenticated && recentPlayers.length > 0 && (
        <section className="recent-section">
          <h2>Recently Viewed</h2>
          <div className="players-grid recent-grid">
            {recentPlayers.map(player => (
              <PlayerCard 
                key={`recent-${player.player_id}`} 
                player={player} 
                isRecent={true} 
              />
            ))}
          </div>
        </section>
      )}

      <section className="top-players-section">
        <h2>Top Players by Card Count</h2>
        <div className="players-grid">
          {players.map(player => (
            <PlayerCard key={player.player_id} player={player} />
          ))}
        </div>
      </section>
    </div>
  )
}

export default PlayersLanding