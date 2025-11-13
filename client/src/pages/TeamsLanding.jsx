import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import Icon from '../components/Icon'
import { TeamCard } from '../components/cards'
import { createLogger } from '../utils/logger'
import './TeamsLandingScoped.css'

const log = createLogger('TeamsLanding')

function TeamsLanding() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()

  log.info('TeamsLanding mounted', { isAuthenticated })

  const [teams, setTeams] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [loading, setLoading] = useState(true)
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [totalTeams, setTotalTeams] = useState(0)
  const searchDebounceRef = useRef(null)

  useEffect(() => {
    loadTeamsData()
    document.title = 'All Teams - Collect Your Cards'
  }, [isAuthenticated])

  const loadTeamsData = async (page = 1, search = '', append = false) => {
    try {
      if (append) {
        setTeamsLoading(true)
      } else {
        setLoading(true)
      }

      // Build query params
      const params = {
        limit: 100,
        page
      }

      // Add search if provided
      if (search.trim()) {
        params.search = search.trim()
      }

      // Include auth header if authenticated - backend will automatically include recently viewed
      const config = { params }
      if (isAuthenticated) {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers = {
            'Authorization': `Bearer ${token}`
          }
        }
      }

      const response = await axios.get('/api/teams-list', config)
      const newTeams = response.data.teams || []

      // Append to existing teams or replace
      if (append) {
        setTeams(prevTeams => [...prevTeams, ...newTeams])
      } else {
        setTeams(newTeams)
      }

      setHasMore(response.data.hasMore || false)
      setTotalTeams(response.data.total || newTeams.length)
      setCurrentPage(page)
      setError(null)
    } catch (err) {
      console.error('Error loading teams:', err)
      setError('Failed to load teams data')
      if (!append) {
        setTeams([])
      }
    } finally {
      if (append) {
        setTeamsLoading(false)
      } else {
        setLoading(false)
      }
    }
  }

  // Handle search
  const handleSearch = async (query) => {
    setSearchTerm(query)
    await loadTeamsData(1, query, false)
  }

  // Load more teams
  const loadMoreTeams = async () => {
    if (!hasMore || teamsLoading || loading) return
    await loadTeamsData(currentPage + 1, searchTerm, true)
  }

  const handleTeamClick = (team) => {
    const slug = `${team.name}`
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    // Track visit for logged-in users
    if (isAuthenticated) {
      trackTeamVisit({
        ...team,
        slug
      })
    }

    navigate(`/teams/${slug}`)
  }

  const trackTeamVisit = async (team) => {
    try {
      // Track visit on backend
      await axios.post('/api/teams/track-visit', {
        team_id: team.team_id
      })

      // For authenticated users, also update localStorage but DON'T reload the list
      // The list will be updated on next page load to avoid grid shifting
      if (isAuthenticated) {
        const recent = JSON.parse(localStorage.getItem('recentTeamVisits') || '[]')
        
        // Remove if already exists
        const filtered = recent.filter(t => t.team_id !== team.team_id)
        
        // Add to front
        const updated = [team, ...filtered].slice(0, 20) // Keep max 20
        
        localStorage.setItem('recentTeamVisits', JSON.stringify(updated))
      }
    } catch (err) {
      console.error('Error tracking visit:', err)
      
      // Fallback to localStorage tracking for authenticated users if API fails
      if (isAuthenticated) {
        try {
          const recent = JSON.parse(localStorage.getItem('recentTeamVisits') || '[]')
          const filtered = recent.filter(t => t.team_id !== team.team_id)
          const updated = [team, ...filtered].slice(0, 20)
          localStorage.setItem('recentTeamVisits', JSON.stringify(updated))
        } catch (localErr) {
          console.error('Error with localStorage fallback:', localErr)
        }
      }
    }
  }

  // Custom TeamCard wrapper that handles tracking
  const TeamCardWithTracking = ({ team }) => {
    // Create a custom onClick handler that includes tracking
    const handleCustomTeamClick = () => {
      handleTeamClick(team)
    }

    // Pass the custom onClick handler to the unified component
    return (
      <TeamCard 
        team={team}
        customOnClick={handleCustomTeamClick}
      />
    )
  }

  if (loading) {
    return (
      <div className="teams-landing-page">
        <div className="loading-container">
          <div className="card-icon-spinner"></div>
          <p>Loading teams...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="teams-landing-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <p>{error}</p>
          <button onClick={loadTeamsData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="teams-landing-page">
      <div className="teams-landing-grid">
        {/* Header as grid items */}
        <div className="grid-header-title">
          <Icon name="shield" size={32} />
          <h1>Teams</h1>
        </div>
        <div className="grid-header-search">
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="Search all teams..."
              value={searchTerm}
              onChange={(e) => {
                const newValue = e.target.value
                setSearchTerm(newValue)

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
              autoFocus
            />
            {searchTerm && (
              <button
                onClick={() => {
                  setSearchTerm('')
                  handleSearch('')
                }}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px'
                }}
                title="Clear search"
              >
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
        </div>
        {/* Force new row after header */}
        <div className="grid-row-break"></div>

        {/* Team cards */}
        {teams.map(team => (
          <TeamCardWithTracking key={team.team_id} team={team} />
        ))}
        {teams.length === 0 && !loading && searchTerm && (
          <div className="empty-state">
            <Icon name="search" size={48} />
            <p>No teams found matching "{searchTerm}"</p>
          </div>
        )}

        {/* Load More button */}
        {hasMore && !loading && !teamsLoading && (
          <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '20px' }}>
            <button
              onClick={loadMoreTeams}
              style={{
                padding: '10px 20px',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Load More Teams
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default TeamsLanding