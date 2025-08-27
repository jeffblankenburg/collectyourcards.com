import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import axios from 'axios'
import Icon from '../components/Icon'
import { TeamCard } from '../components/cards'
import './TeamsLanding.css'

function TeamsLanding() {
  const { isAuthenticated } = useAuth()
  const navigate = useNavigate()
  
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadTeamsData()
  }, [isAuthenticated])

  const loadTeamsData = async () => {
    try {
      setLoading(true)
      
      // Load teams list with authentication if available
      let apiUrl = '/api/teams-list?limit=100'
      
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
      let teamsList = response.data.teams || []
      
      // Backend automatically includes recently viewed teams at the top for authenticated users
      // Non-authenticated users see teams sorted by card count (default)
      
      setTeams(teamsList)
      setError(null)
    } catch (err) {
      console.error('Error loading teams:', err)
      setError('Failed to load teams data')
    } finally {
      setLoading(false)
    }
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
      <div className="teams-landing">
        <div className="loading-container">
          <Icon name="activity" size={24} className="spinner" />
          <p>Loading teams...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="teams-landing">
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
    <div className="teams-landing">
      <div className="grid-responsive grid-cards-md">
        {teams.map(team => (
          <TeamCardWithTracking key={team.team_id} team={team} />
        ))}
      </div>
    </div>
  )
}

export default TeamsLanding