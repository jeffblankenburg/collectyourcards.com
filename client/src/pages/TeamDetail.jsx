import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import PlayerCard from '../components/cards/PlayerCard'
import { createLogger } from '../utils/logger'
import './TeamDetailScoped.css'

const log = createLogger('TeamDetail')

function TeamDetail() {
  const { teamSlug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()

  log.info('TeamDetail mounted', { teamSlug, isAuthenticated })
  const [team, setTeam] = useState(null)
  const [players, setPlayers] = useState([])
  const [filteredPlayers, setFilteredPlayers] = useState([])
  const [playerSearchTerm, setPlayerSearchTerm] = useState('')
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  useEffect(() => {
    fetchTeamData()
  }, [teamSlug])

  // Filter players based on search term
  useEffect(() => {
    if (!playerSearchTerm.trim()) {
      setFilteredPlayers(players)
    } else {
      const filtered = players.filter(player =>
        `${player.first_name} ${player.last_name}`.toLowerCase().includes(playerSearchTerm.toLowerCase()) ||
        (player.nick_name && player.nick_name.toLowerCase().includes(playerSearchTerm.toLowerCase()))
      )
      setFilteredPlayers(filtered)
    }
  }, [players, playerSearchTerm])

  // Set page title
  useEffect(() => {
    if (team) {
      document.title = `${team.name} - Collect Your Cards`
    } else {
      document.title = 'Team Details - Collect Your Cards'
    }
  }, [team])

  const fetchTeamData = async () => {
    try {
      setLoading(true)
      
      // Get team data from the teams list and find the matching one
      const response = await axios.get('/api/teams-list?limit=200')
      const teams = response.data.teams || []
      
      // Find team by slug (recreate slug logic from TeamsLanding)
      const foundTeam = teams.find(t => {
        if (!t.name) return false
        const slug = t.name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .trim()
        return slug === teamSlug
      })

      if (foundTeam) {
        setTeam(foundTeam)
        
        // Fetch players for this team
        const playersResponse = await axios.get(`/api/players-list?team_id=${foundTeam.team_id}&limit=100`)
        const teamPlayers = playersResponse.data.players || []
        setPlayers(teamPlayers)
        setFilteredPlayers(teamPlayers)
        
        // Calculate additional stats for the team
        const teamStats = {
          total_cards: foundTeam.card_count || 0,
          total_players: foundTeam.player_count || 0,
          rookie_cards: 0, // TODO: Calculate from API
          autograph_cards: 0, // TODO: Calculate from API
          relic_cards: 0, // TODO: Calculate from API
          numbered_cards: 0, // TODO: Calculate from API
        }
        setStats(teamStats)
        setError(null)
      } else {
        setError('Team not found')
      }
    } catch (err) {
      console.error('Error fetching team data:', err)
      setError('Failed to load team data')
    } finally {
      setLoading(false)
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

    navigate(`/players/${slug}`, {
      state: { selectedTeamId: team.team_id }
    })
  }

  const trackPlayerVisit = (player) => {
    try {
      // TODO: Implement player visit tracking
      console.log('Player visit tracked:', player.first_name, player.last_name)
    } catch (error) {
      console.error('Error tracking player visit:', error)
    }
  }

  const handleTeamClick = (teamId) => {
    // Navigate to team detail page  
    const teamSlug = team?.name
      ?.toLowerCase()
      ?.replace(/[^a-z0-9\s-]/g, '')
      ?.replace(/\s+/g, '-')
      ?.replace(/-+/g, '-')
      ?.trim()
    
    if (teamSlug) {
      navigate(`/teams/${teamSlug}`)
    }
  }

  if (loading) {
    return (
      <div className="team-detail-page">
        <div className="loading-container">
          <Icon name="activity" size={24} className="spinner" />
          <p>Loading team details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="team-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <p>{error}</p>
          <button onClick={fetchTeamData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!team) {
    return (
      <div className="team-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <p>Team not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="team-detail-page">
      <div className="team-detail-container">
        
        {/* Compact Team Header */}
        <header className="team-header-combined compact">
          <div className="team-header-layout">
            {/* Team Circle */}
            <div 
              className="team-circle-xl"
              style={{
                backgroundColor: team.primary_color || '#666',
                borderColor: team.secondary_color || '#999'
              }}
            >
              {team.abbreviation}
            </div>

            {/* Team Name */}
            <h1 className="team-name">{team.name}</h1>

            {/* Compact Stats */}
            <div className="team-stats-compact">
              <div className="stat-compact">
                <div className="stat-value">{stats.total_cards?.toLocaleString() || 0}</div>
                <div className="stat-label">Cards</div>
              </div>
              <div className="stat-compact">
                <div className="stat-value">{stats.total_players?.toLocaleString() || 0}</div>
                <div className="stat-label">Players</div>
              </div>
            </div>
          </div>
        </header>

      </div>

      {/* Players Search and Grid - Simple Right-Aligned Search */}
      {players.length > 0 && (
        <>
          <div className="players-search-container-grid-aligned">
            <div className="players-search-grid">
              <div className="players-search-content">
                <div className="players-search-box">
                  <Icon name="search" size={20} />
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={playerSearchTerm}
                    onChange={(e) => setPlayerSearchTerm(e.target.value)}
                    className="players-search-input"
                    autoFocus
                  />
                  {playerSearchTerm && (
                    <button 
                      onClick={() => setPlayerSearchTerm('')}
                      className="players-search-clear"
                      title="Clear search"
                    >
                      <Icon name="x" size={16} />
                    </button>
                  )}
                </div>
                {playerSearchTerm && (
                  <div className="players-search-results">
                    {filteredPlayers.length} of {players.length} players
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="players-grid-fullwidth">
            {filteredPlayers.map((player) => (
              <PlayerCard
                key={player.player_id}
                player={player}
                onTeamClick={handleTeamClick}
                customOnClick={() => handlePlayerClick(player)}
              />
            ))}
            {filteredPlayers.length === 0 && playerSearchTerm && (
              <div className="no-players-found">
                <Icon name="search" size={48} />
                <p>No players found matching "{playerSearchTerm}"</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Admin Edit Button */}
      {isAdmin && team && (
        <button 
          className="admin-edit-button"
          onClick={() => navigate(`/admin/teams?search=${encodeURIComponent(team.name)}`)}
          title="Edit team (Admin)"
        >
          <Icon name="edit" size={20} />
        </button>
      )}
    </div>
  )
}

export default TeamDetail