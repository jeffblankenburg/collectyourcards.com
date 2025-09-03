import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import Icon from '../components/Icon'
import { PlayerCard } from '../components/cards'
import './PlayersLandingScoped.css'

function PlayersLanding() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [players, setPlayers] = useState([])
  const [filteredPlayers, setFilteredPlayers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadPlayersData()
    document.title = 'All Players - Collect Your Cards'
  }, [isAuthenticated])

  // Filter players based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredPlayers(players)
    } else {
      const filtered = players.filter(player =>
        `${player.first_name} ${player.last_name}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (player.nick_name && player.nick_name.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredPlayers(filtered)
    }
  }, [players, searchTerm])

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
      setFilteredPlayers(playersList)
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

  const handleTeamClick = (teamId) => {
    // Find the player and handle click with team filter
    // This is called from within PlayerCard when team circle is clicked
    const currentPlayer = players.find(p => p.teams?.some(t => t.team_id === teamId))
    if (currentPlayer) {
      handlePlayerClick(currentPlayer, teamId)
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

  // Custom PlayerCard wrapper that handles tracking
  const PlayerCardWithTracking = ({ player }) => {
    // Create a custom onClick handler that includes tracking
    const handleCustomPlayerClick = () => {
      handlePlayerClick(player)
    }

    // Pass the custom onClick and team click handler to the unified component
    return (
      <PlayerCard 
        player={player}
        onTeamClick={handleTeamClick}
        customOnClick={handleCustomPlayerClick}
      />
    )
  }

  if (loading) {
    return (
      <div className="players-landing-page">
        <div className="loading-container">
          <Icon name="activity" size={24} className="spinner" />
          <p>Loading players...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="players-landing-page">
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
    <div className="players-landing-page">
      <div className="players-landing-grid">
        {/* Header as grid items */}
        <div className="grid-header-title">
          <Icon name="users" size={32} />
          <h1>Players</h1>
        </div>
        <div className="grid-header-search">
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>
        {/* Force new row after header */}
        <div className="grid-row-break"></div>
        {/* Player cards */}
        {filteredPlayers.map(player => (
          <PlayerCardWithTracking key={player.player_id} player={player} />
        ))}
        {filteredPlayers.length === 0 && players.length > 0 && (
          <div className="empty-state">
            <Icon name="search" size={48} />
            <p>No players found matching "{searchTerm}"</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlayersLanding