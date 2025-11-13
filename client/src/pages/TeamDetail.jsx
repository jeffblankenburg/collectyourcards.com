import React, { useState, useEffect, useRef } from 'react'
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
  const [playerSearchTerm, setPlayerSearchTerm] = useState('')
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [playersLoading, setPlayersLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalPlayers, setTotalPlayers] = useState(0)
  const searchDebounceRef = useRef(null)

  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  useEffect(() => {
    fetchTeamData()
  }, [teamSlug])

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

        // Fetch players for this team
        await fetchPlayers(foundTeam, 1, '', false)
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

  const fetchPlayers = async (teamData, page = 1, search = '', append = false) => {
    try {
      setPlayersLoading(true)

      // Build query params
      const params = {
        team_id: teamData.team_id,
        limit: 100,
        page
      }

      // Add search if provided
      if (search.trim()) {
        params.search = search.trim()
      }

      const response = await axios.get('/api/players-list', { params })

      const newPlayers = response.data.players || []

      // Append to existing players or replace
      if (append) {
        setPlayers(prevPlayers => [...prevPlayers, ...newPlayers])
      } else {
        setPlayers(newPlayers)
      }

      setHasMore(response.data.hasMore || false)
      setTotalPlayers(response.data.total || newPlayers.length)
      setCurrentPage(page)
    } catch (err) {
      console.error('Error fetching players:', err)
      if (!append) {
        setPlayers([])
      }
    } finally {
      setPlayersLoading(false)
    }
  }

  // Handle search from search input
  const handleSearch = async (query) => {
    if (!team) return
    setPlayerSearchTerm(query)
    await fetchPlayers(team, 1, query, false)
  }

  // Load more players (infinite scroll)
  const loadMorePlayers = async () => {
    if (!team || !hasMore || playersLoading) return
    await fetchPlayers(team, currentPage + 1, playerSearchTerm, true)
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
          <div className="card-icon-spinner"></div>
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

      {/* Players Search and Grid */}
      {(players.length > 0 || playerSearchTerm) && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, 270px)',
            gap: '0.5rem',
            justifyContent: 'center',
            padding: '0 2rem',
            margin: '1rem 0'
          }}>
            <div style={{ gridColumn: '-5 / -1', justifySelf: 'end' }}>
              <div className="players-search-box" style={{ width: '540px', maxWidth: 'none' }}>
                <Icon name="search" size={20} />
                <input
                  type="text"
                  placeholder="Search all players on this team..."
                  value={playerSearchTerm}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setPlayerSearchTerm(newValue)

                    // Debounce search
                    if (searchDebounceRef.current) {
                      clearTimeout(searchDebounceRef.current)
                    }

                    searchDebounceRef.current = setTimeout(() => {
                      handleSearch(newValue)
                    }, 300)
                  }}
                  onKeyDown={(e) => {
                    // Allow Enter key to trigger immediate search
                    if (e.key === 'Enter') {
                      if (searchDebounceRef.current) {
                        clearTimeout(searchDebounceRef.current)
                      }
                      handleSearch(e.target.value)
                    }
                  }}
                  className="players-search-input"
                  autoFocus
                />
                {playerSearchTerm && (
                  <button
                    onClick={() => {
                      setPlayerSearchTerm('')
                      handleSearch('')
                    }}
                    className="players-search-clear"
                    title="Clear search"
                  >
                    <Icon name="x" size={16} />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="players-grid">
            {players.map((player) => (
              <PlayerCard
                key={player.player_id}
                player={player}
                onTeamClick={handleTeamClick}
                customOnClick={() => handlePlayerClick(player)}
              />
            ))}
            {players.length === 0 && !playersLoading && playerSearchTerm && (
              <div className="no-players-found">
                <Icon name="search" size={48} />
                <p>No players found matching "{playerSearchTerm}"</p>
              </div>
            )}
            {hasMore && !playersLoading && (
              <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
                <button
                  onClick={loadMorePlayers}
                  className="load-more-button"
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#007bff',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  Load More Players
                </button>
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
