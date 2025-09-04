import React, { useState, useEffect, useMemo } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import UniversalCardTable from '../components/UniversalCardTable'
import TeamFilterCircles from '../components/TeamFilterCircles'
import PlayerStats from '../components/PlayerStats'
import Icon from '../components/Icon'
import EditPlayerModal from '../components/modals/EditPlayerModal'
import './PlayerDetailScoped.css'

function PlayerDetail() {
  const { playerSlug, teamSlug } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [player, setPlayer] = useState(null)
  const [cards, setCards] = useState([])
  const [teams, setTeams] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTeamIds, setSelectedTeamIds] = useState([])
  const [showEditModal, setShowEditModal] = useState(false)

  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  useEffect(() => {
    fetchPlayerData()
  }, [playerSlug])

  // Set page title
  useEffect(() => {
    if (player) {
      document.title = `${player.first_name} ${player.last_name}${player.nick_name ? ` "${player.nick_name}"` : ''} - Collect Your Cards`
    } else {
      document.title = 'Player Details - Collect Your Cards'
    }
  }, [player])

  // Track player visit when player data is loaded
  useEffect(() => {
    if (player) {
      trackPlayerVisit(player)
    }
  }, [player])

  // Apply team filter from URL or navigation state
  useEffect(() => {
    if (teams.length > 0) {
      // First check for teamSlug in URL
      if (teamSlug) {
        // Find team by matching slug
        const matchingTeam = teams.find(team => {
          const teamSlugGenerated = team.name
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
          return teamSlugGenerated === teamSlug
        })
        
        if (matchingTeam) {
          setSelectedTeamIds([matchingTeam.team_id])
        }
        // If teamSlug doesn't match any of the player's teams, ignore it (show all teams)
      } else if (location.state?.selectedTeamId) {
        // Fallback to navigation state
        const teamExists = teams.some(t => t.team_id === location.state.selectedTeamId)
        if (teamExists) {
          setSelectedTeamIds([location.state.selectedTeamId])
        }
      }
    }
  }, [teams, teamSlug, location.state])

  const fetchPlayerData = async () => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/players/by-slug/${playerSlug}`)
      
      const { player: playerData, cards: cardsData, teams: teamsData, stats: statsData } = response.data

      setPlayer(playerData)
      setCards(cardsData)
      setTeams(teamsData)
      setStats(statsData)
      setError(null)
    } catch (err) {
      console.error('Error fetching player data:', err)
      setError(err.response?.data?.error || 'Failed to load player data')
    } finally {
      setLoading(false)
    }
  }

  const trackPlayerVisit = async (player) => {
    try {
      // Track visit on backend
      await axios.post('/api/players/track-visit', {
        player_id: player.player_id
      })

      // For authenticated users, also update localStorage for immediate UI feedback
      if (isAuthenticated) {
        const recent = JSON.parse(localStorage.getItem('recentPlayerVisits') || '[]')
        
        // Remove if already exists
        const filtered = recent.filter(p => p.player_id !== player.player_id)
        
        // Add to front with slug for navigation
        const playerWithSlug = {
          ...player,
          slug: `${player.first_name}-${player.last_name}`
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-')
            .trim()
        }
        const updated = [playerWithSlug, ...filtered].slice(0, 20) // Keep max 20
        
        localStorage.setItem('recentPlayerVisits', JSON.stringify(updated))
      }
    } catch (err) {
      console.error('Error tracking visit:', err)
      
      // Fallback to localStorage tracking for authenticated users if API fails
      if (isAuthenticated) {
        try {
          const recent = JSON.parse(localStorage.getItem('recentPlayerVisits') || '[]')
          const filtered = recent.filter(p => p.player_id !== player.player_id)
          const playerWithSlug = {
            ...player,
            slug: `${player.first_name}-${player.last_name}`
              .toLowerCase()
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()
          }
          const updated = [playerWithSlug, ...filtered].slice(0, 20)
          localStorage.setItem('recentPlayerVisits', JSON.stringify(updated))
        } catch (localErr) {
          console.error('Error with localStorage fallback:', localErr)
        }
      }
    }
  }

  const handleTeamFilter = (teamIds) => {
    setSelectedTeamIds(teamIds)
  }

  const handleSeriesClick = (series) => {
    if (series?.name) {
      const slug = series.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()
      navigate(`/series/${slug}`)
    }
  }

  // Filter cards based on selected teams
  const filteredCards = selectedTeamIds.length > 0 
    ? cards.filter(card => 
        card.card_player_teams?.some(cpt => 
          cpt.team?.team_id && 
          selectedTeamIds.includes(cpt.team.team_id)
        )
      )
    : cards

  // Memoize the API endpoint (no team filter - we'll filter client-side)
  const apiEndpoint = useMemo(() => {
    if (!player) return null
    
    return `/api/cards?player_name=${encodeURIComponent(`${player.first_name} ${player.last_name}`)}`
  }, [player?.first_name, player?.last_name])


  if (loading) {
    return (
      <div className="player-detail-page">
        <div className="loading-container">
          <Icon name="activity" size={24} className="spinner" />
          <p>Loading player details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="player-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <h2>Player Not Found</h2>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (!player) {
    return (
      <div className="player-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <h2>Player Not Found</h2>
          <p>The requested player could not be found.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="player-detail-page">
      <div className="player-detail-container">
        
        {/* Combined Player Header with Stats and Card Photo Space */}
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
                    onTeamFilter={handleTeamFilter}
                    compact={true}
                  />
                </div>
              )}
            </div>

            {/* Card Photos */}
            <div className="card-photo-placeholder">
              <div className="card-placeholder">
                <Icon name="card" size={48} className="card-icon" />
                <span>Card Photo 1</span>
              </div>
            </div>

            <div className="card-photo-placeholder">
              <div className="card-placeholder">
                <Icon name="card" size={48} className="card-icon" />
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
                
                <div className="stat-item-inline">
                  <div className="stat-content-inline">
                    <span className="stat-value-inline">{stats.rookie_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label-inline">Rookie Cards</span>
                  </div>
                </div>
                
                <div className="stat-item-inline">
                  <div className="stat-content-inline">
                    <span className="stat-value-inline">{stats.autograph_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label-inline">Autographs</span>
                  </div>
                </div>
                
                <div className="stat-item-inline">
                  <div className="stat-content-inline">
                    <span className="stat-value-inline">{stats.relic_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label-inline">Relics</span>
                  </div>
                </div>
                
                <div className="stat-item-inline">
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


        {/* Cards Table */}
        <UniversalCardTable
          apiEndpoint={apiEndpoint}
          showPlayer={true}
          defaultSort="series_name"
          downloadFilename={`${player.first_name}-${player.last_name}-cards`}
          showSearch={true}
          selectedTeamIds={selectedTeamIds}
          onSeriesClick={handleSeriesClick}
        />

      </div>

      {/* Admin Edit Button */}
      {isAdmin && player && (
        <button 
          className="admin-edit-button"
          onClick={() => setShowEditModal(true)}
          title="Edit player (Admin)"
        >
          <Icon name="edit" size={20} />
        </button>
      )}
      
      {/* Edit Modal */}
      {showEditModal && player && (
        <EditPlayerModal
          player={player}
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSave={() => {
            setShowEditModal(false)
            fetchPlayerData() // Reload player data after save
          }}
        />
      )}
    </div>
  )
}

export default PlayerDetail