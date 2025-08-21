import React, { useState, useEffect, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import axios from 'axios'
import UniversalCardTable from '../components/UniversalCardTable'
import TeamFilterCircles from '../components/TeamFilterCircles'
import PlayerStats from '../components/PlayerStats'
import Icon from '../components/Icon'
import './PlayerDetail.css'

function PlayerDetail() {
  const { playerSlug } = useParams()
  const [player, setPlayer] = useState(null)
  const [cards, setCards] = useState([])
  const [teams, setTeams] = useState([])
  const [stats, setStats] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedTeamIds, setSelectedTeamIds] = useState([])

  useEffect(() => {
    fetchPlayerData()
  }, [playerSlug])

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

  const handleTeamFilter = (teamIds) => {
    setSelectedTeamIds(teamIds)
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
              <h1 className="player-name">
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

            {/* Center - Card Photo Placeholder */}
            <div className="card-photo-placeholder">
              <div className="card-placeholder">
                <Icon name="card" size={48} className="card-icon" />
                <span>Card Photo</span>
              </div>
            </div>

            {/* Right side - Stats */}
            <div className="player-stats-inline">
              <div className="stats-grid-inline">
                <div className="stat-item-inline">
                  <Icon name="layers" size={16} className="stat-icon-inline" />
                  <div className="stat-content-inline">
                    <span className="stat-value-inline">{stats.total_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label-inline">Total Cards</span>
                  </div>
                </div>
                
                <div className="stat-item-inline">
                  <Icon name="star" size={16} className="stat-icon-inline" />
                  <div className="stat-content-inline">
                    <span className="stat-value-inline">{stats.rookie_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label-inline">Rookies</span>
                  </div>
                </div>
                
                <div className="stat-item-inline">
                  <Icon name="edit" size={16} className="stat-icon-inline" />
                  <div className="stat-content-inline">
                    <span className="stat-value-inline">{stats.autograph_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label-inline">Autographs</span>
                  </div>
                </div>
                
                <div className="stat-item-inline">
                  <Icon name="shield" size={16} className="stat-icon-inline" />
                  <div className="stat-content-inline">
                    <span className="stat-value-inline">{stats.relic_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label-inline">Relics</span>
                  </div>
                </div>
                
                <div className="stat-item-inline">
                  <Icon name="hash" size={16} className="stat-icon-inline" />
                  <div className="stat-content-inline">
                    <span className="stat-value-inline">{stats.numbered_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label-inline">Numbered</span>
                  </div>
                </div>
                
                <div className="stat-item-inline">
                  <Icon name="collection" size={16} className="stat-icon-inline" />
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
        />

      </div>
    </div>
  )
}

export default PlayerDetail