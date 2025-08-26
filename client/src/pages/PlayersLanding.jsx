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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadPlayersData()
  }, [isAuthenticated])

  const loadPlayersData = async () => {
    try {
      setLoading(true)
      
      // Load players list with authentication if available
      let apiUrl = '/api/players-list?limit=100'
      
      // Include auth header if authenticated - backend will automatically include recently viewed
      const config = {}
      if (isAuthenticated) {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers = {
            'Authorization': `Bearer ${token}`
          }
        }
      }
      
      const response = await axios.get(apiUrl, config)
      let playersList = response.data.players || []
      
      // Backend automatically includes recently viewed players at the top for authenticated users
      // Non-authenticated users see players sorted by card count (default)
      
      setPlayers(playersList)
      setError(null)
    } catch (err) {
      console.error('Error loading players:', err)
      setError('Failed to load players data')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayerClick = (player, teamId = null) => {
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

    // Navigate with optional team filter
    const url = `/players/${slug}`
    if (teamId) {
      navigate(url, { state: { selectedTeamId: teamId } })
    } else {
      navigate(url)
    }
  }

  const trackPlayerVisit = async (player) => {
    try {
      // Track visit on backend
      await axios.post('/api/players/track-visit', {
        player_id: player.player_id
      })

      // For authenticated users, also update localStorage but DON'T reload the list
      // The list will be updated on next page load to avoid grid shifting
      if (isAuthenticated) {
        const recent = JSON.parse(localStorage.getItem('recentPlayerVisits') || '[]')
        
        // Remove if already exists
        const filtered = recent.filter(p => p.player_id !== player.player_id)
        
        // Add to front
        const updated = [player, ...filtered].slice(0, 20) // Keep max 20
        
        localStorage.setItem('recentPlayerVisits', JSON.stringify(updated))
      }
    } catch (err) {
      console.error('Error tracking visit:', err)
      
      // Fallback to localStorage tracking for authenticated users if API fails
      if (isAuthenticated) {
        try {
          const recent = JSON.parse(localStorage.getItem('recentPlayerVisits') || '[]')
          const filtered = recent.filter(p => p.player_id !== player.player_id)
          const updated = [player, ...filtered].slice(0, 20)
          localStorage.setItem('recentPlayerVisits', JSON.stringify(updated))
        } catch (localErr) {
          console.error('Error with localStorage fallback:', localErr)
        }
      }
    }
  }

  const PlayerCard = ({ player }) => {
    const handleTeamClick = (e, teamId) => {
      e.stopPropagation()
      handlePlayerClick(player, teamId)
    }

    return (
      <div 
        className="card-base card-interactive card-hover-effect"
        onClick={() => handlePlayerClick(player)}
      >
        <div className="player-card-content">
          <div className="player-info">
            <h3 className="player-name">
              {player.first_name} {player.last_name}
              {player.is_hof && <Icon name="trophy" size={16} className="hof-icon" />}
            </h3>
          </div>
          
          <div className="player-teams">
            {player.teams?.map(team => (
              <div
                key={team.team_id}
                className="team-circle-base team-circle-sm team-circle-clickable"
                style={{
                  '--primary-color': team.primary_color || '#666',
                  '--secondary-color': team.secondary_color || '#999'
                }}
                title={`${team.name} (${team.card_count} cards)`}
                onClick={(e) => handleTeamClick(e, team.team_id)}
              >
                {team.abbreviation}
              </div>
            ))}
          </div>

          <div className="player-stats">
            {player.nick_name && (
              <div className="nickname-section">
                <p className="player-nickname">"{player.nick_name}"</p>
              </div>
            )}
            <div className="card-count">
              <span className="count-number">{player.card_count.toLocaleString()}</span>
              <span className="count-label">Cards</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="players-landing">
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
      <div className="grid-responsive grid-cards-md">
        {players.map(player => (
          <PlayerCard key={player.player_id} player={player} />
        ))}
      </div>
    </div>
  )
}

export default PlayersLanding