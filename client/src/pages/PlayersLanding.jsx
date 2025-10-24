import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import Icon from '../components/Icon'
import { PlayerCard } from '../components/cards'
import { createLogger } from '../utils/logger'
import './PlayersLandingScoped.css'

const log = createLogger('PlayersLanding')

function PlayersLanding() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  log.info('PlayersLanding mounted', { isAuthenticated })
  
  const [players, setPlayers] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState(null)
  const [hasMore, setHasMore] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const searchTimeoutRef = useRef(null)

  useEffect(() => {
    document.title = 'All Players - Collect Your Cards'
  }, [])

  // Initial load
  useEffect(() => {
    if (!searchTerm) {
      loadPlayersData()
    }
  }, [isAuthenticated])

  // Handle search with debouncing
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search if term is empty
    if (!searchTerm.trim()) {
      // Reset to initial data if search is cleared
      loadPlayersData()
      return
    }

    // Set searching state immediately for user feedback
    setSearching(true)

    // Debounce the search
    searchTimeoutRef.current = setTimeout(() => {
      loadPlayersData(searchTerm)
    }, 300) // 300ms debounce delay

    // Cleanup function
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchTerm])

  const loadPlayersData = async (search = '') => {
    try {
      // Set appropriate loading state
      if (search) {
        setSearching(true)
      } else {
        setLoading(true)
      }
      
      // Build API URL with search parameter
      let apiUrl = '/api/players-list?limit=100'
      if (search && search.trim()) {
        apiUrl += `&search=${encodeURIComponent(search.trim())}`
      }
      
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
      const pagination = response.data.pagination || {}
      
      // Backend automatically includes recently viewed players at the top for authenticated users
      // Non-authenticated users see players sorted by card count (default)
      
      setPlayers(playersList)
      setHasMore(pagination.has_more || false)
      setCurrentPage(pagination.current_page || 1)
      setError(null)
    } catch (err) {
      console.error('Error loading players:', err)
      setError('Failed to load players data')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }

  const handlePlayerClick = (player, teamId = null) => {
    // Handle null/empty last names
    const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim()
    const slug = fullName
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
    // Navigate directly to the team page - this makes more sense when clicking a team circle
    const teams = []
    players.forEach(p => p.teams?.forEach(t => teams.push(t)))
    const team = teams.find(t => t.team_id === teamId)
    
    if (team) {
      const teamSlug = team.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      navigate(`/teams/${teamSlug}`)
    }
  }

  const createPlayerSpecificTeamHandler = (player) => (teamId) => {
    // Navigate to player page with team filter
    const team = player.teams?.find(t => t.team_id === teamId)
    if (team) {
      // Handle null/empty last names
      const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim()
      const playerSlug = fullName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      
      const teamSlug = team.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      
      // Track visit for logged-in users
      if (isAuthenticated) {
        trackPlayerVisit({
          ...player,
          slug: playerSlug
        })
      }
      
      navigate(`/players/${playerSlug}/${teamSlug}`)
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

    // Create a player-specific team click handler
    const playerTeamClickHandler = createPlayerSpecificTeamHandler(player)

    // Pass the custom onClick and player-specific team click handler to the unified component
    return (
      <PlayerCard 
        player={player}
        onTeamClick={playerTeamClickHandler}
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
            {searching && (
              <div className="search-loading">
                <Icon name="activity" size={16} className="spinner" />
              </div>
            )}
          </div>
        </div>
        {/* Force new row after header */}
        <div className="grid-row-break"></div>
        {/* Player cards */}
        {players.map(player => (
          <PlayerCardWithTracking key={player.player_id} player={player} />
        ))}
        {players.length === 0 && !loading && !searching && searchTerm && (
          <div className="empty-state">
            <Icon name="search" size={48} />
            <p>No players found matching "{searchTerm}"</p>
          </div>
        )}
        {players.length === 0 && !loading && !searching && !searchTerm && (
          <div className="empty-state">
            <Icon name="users" size={48} />
            <p>No players available</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default PlayersLanding