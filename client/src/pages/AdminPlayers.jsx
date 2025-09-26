import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminPlayersScoped.css'

function AdminPlayers() {
  const [searchParams] = useSearchParams()
  const [players, setPlayers] = useState([])
  const [totalPlayers, setTotalPlayers] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [sortField, setSortField] = useState('player_id')
  const [sortDirection, setSortDirection] = useState('asc')
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editForm, setEditForm] = useState({})
  const [availableTeams, setAvailableTeams] = useState([])
  const [saving, setSaving] = useState(false)
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [teamToRemove, setTeamToRemove] = useState(null)
  const [reassignToTeam, setReassignToTeam] = useState('')
  const [reassigning, setReassigning] = useState(false)
  const [teamSearchTerm, setTeamSearchTerm] = useState('')
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [playerToDelete, setPlayerToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const addButtonRef = useRef(null)
  const { addToast } = useToast()

  useEffect(() => {
    document.title = 'Admin Players - Collect Your Cards'
    // Load with initial search if provided in URL
    loadPlayers(searchParams.get('search') || '')
  }, [])

  const loadPlayers = async (searchQuery = '') => {
    try {
      setLoading(!searchQuery) // Only show main loading for initial load
      setSearching(!!searchQuery) // Show search loading for searches
      
      const params = new URLSearchParams()
      params.append('limit', '100')
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      const response = await axios.get(`/api/admin/players?${params.toString()}`)
      const playersData = response.data.players || []
      
      // Check for duplicates in the API response
      const playerIds = playersData.map(p => p.player_id)
      const duplicateIds = playerIds.filter((id, index) => playerIds.indexOf(id) !== index)
      if (duplicateIds.length > 0) {
        console.warn('AdminPlayers: Duplicate player IDs detected from API:', [...new Set(duplicateIds)])
      }
      
      setPlayers(playersData)
      setLastUpdated(new Date())
      setIsSearchMode(!!searchQuery.trim())
      
      // Get total count from database if not searching
      if (!searchQuery.trim()) {
        try {
          const countResponse = await axios.get('/api/database/status')
          if (countResponse.data?.records?.players) {
            setTotalPlayers(countResponse.data.records.players)
          }
        } catch (error) {
          console.error('Failed to get total player count:', error)
        }
      }
      
    } catch (error) {
      console.error('Error loading players:', error)
      addToast(`Failed to load players: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }

  const handleSearch = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    
    // Debounce search
    clearTimeout(window.playerSearchTimeout)
    window.playerSearchTimeout = setTimeout(() => {
      loadPlayers(value)
    }, 300)
  }

  const handleRefresh = () => {
    if (isSearchMode) {
      loadPlayers(searchTerm)
    } else {
      loadPlayers()
    }
  }

  const handleSort = (field) => {
    let direction = 'asc'
    if (sortField === field && sortDirection === 'asc') {
      direction = 'desc'
    }
    setSortField(field)
    setSortDirection(direction)
  }

  const getSortedPlayers = () => {
    // Deduplicate players by player_id to prevent React key warnings
    const uniquePlayers = players.reduce((acc, player) => {
      const existingPlayer = acc.find(p => p.player_id === player.player_id)
      if (!existingPlayer) {
        acc.push(player)
      }
      return acc
    }, [])
    
    return [...uniquePlayers].sort((a, b) => {
      let aValue, bValue
      
      switch (sortField) {
        case 'player_id':
          aValue = a.player_id
          bValue = b.player_id
          break
        case 'name':
          aValue = `${a.first_name || ''} ${a.last_name || ''}`.trim().toLowerCase()
          bValue = `${b.first_name || ''} ${b.last_name || ''}`.trim().toLowerCase()
          break
        case 'card_count':
          aValue = a.card_count || 0
          bValue = b.card_count || 0
          break
        case 'is_hof':
          aValue = a.is_hof ? 1 : 0
          bValue = b.is_hof ? 1 : 0
          break
        case 'team_count':
          aValue = a.teams?.length || 0
          bValue = b.teams?.length || 0
          break
        default:
          return 0
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1
      }
      return 0
    })
  }

  const loadTeams = async () => {
    try {
      const response = await axios.get('/api/admin/teams')
      setAvailableTeams(response.data.teams || [])
    } catch (error) {
      console.error('Error loading teams:', error)
      addToast('Failed to load teams', 'error')
    }
  }

  const handleEditPlayer = async (player) => {
    setEditingPlayer(player)
    setEditForm({
      first_name: player.first_name || '',
      last_name: player.last_name || '',
      nick_name: player.nick_name || '',
      birthdate: player.birthdate ? player.birthdate.split('T')[0] : '',
      is_hof: player.is_hof || false
    })
    
    // Load teams if not already loaded
    if (availableTeams.length === 0) {
      await loadTeams()
    }
    
    // Load detailed team data with card counts for this player
    try {
      const response = await axios.get(`/api/admin/players/${player.player_id}/teams`)
      // Update the player object with detailed team data that includes card counts
      const updatedPlayer = {
        ...player,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)
    } catch (error) {
      console.error('Error loading player team details:', error)
      // Continue with existing team data if detailed load fails
    }
  }

  const handleCloseModal = () => {
    setEditingPlayer(null)
    setShowAddModal(false)
    setEditForm({})
    setSaving(false)
    setShowTeamDropdown(false)
    setShowReassignModal(false)
    setTeamToRemove(null)
    setReassignToTeam('')
    setReassigning(false)
    setTeamSearchTerm('')
    setPlayerToDelete(null)
    setDeleting(false)
  }

  const handleShowAddModal = async () => {
    // Reset form
    setEditForm({
      first_name: '',
      last_name: '',
      nick_name: '',
      birthdate: '',
      is_hof: false,
      teams: []
    })
    
    // Load teams if not already loaded
    if (availableTeams.length === 0) {
      await loadTeams()
    }
    
    setShowAddModal(true)
  }

  const handleAddTeamToNewPlayer = (teamId) => {
    const team = availableTeams.find(t => t.team_id === teamId)
    if (team) {
      setEditForm(prev => ({
        ...prev,
        teams: [...(prev.teams || []), team]
      }))
    }
    setShowTeamDropdown(false)
    setTeamSearchTerm('')
  }

  const handleRemoveTeamFromNewPlayer = (teamId) => {
    setEditForm(prev => ({
      ...prev,
      teams: (prev.teams || []).filter(t => t.team_id !== teamId)
    }))
  }

  const handleAddPlayer = async () => {
    try {
      setSaving(true)
      
      // First create the player
      const response = await axios.post('/api/admin/players', {
        first_name: editForm.first_name?.trim() || null,
        last_name: editForm.last_name?.trim() || null,
        nick_name: editForm.nick_name?.trim() || null,
        birthdate: editForm.birthdate || null,
        is_hof: editForm.is_hof || false
      })
      
      const newPlayerId = response.data.player?.player_id
      
      // Then add teams if any were selected
      if (newPlayerId && editForm.teams && editForm.teams.length > 0) {
        for (const team of editForm.teams) {
          try {
            await axios.post(`/api/admin/players/${newPlayerId}/teams`, {
              team_id: team.team_id
            })
          } catch (teamError) {
            console.error(`Error adding team ${team.name}:`, teamError)
            // Continue with other teams even if one fails
          }
        }
      }
      
      addToast('Player created successfully', 'success')
      
      // Refresh the players list
      await loadPlayers(searchTerm)
      
      // Close modal
      handleCloseModal()
    } catch (error) {
      console.error('Error creating player:', error)
      addToast(error.response?.data?.message || 'Failed to create player', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleReassignCards = async () => {
    if (!editingPlayer || !teamToRemove || !reassignToTeam) return
    
    try {
      setReassigning(true)
      
      // First reassign the cards
      await axios.post(`/api/admin/players/${editingPlayer.player_id}/reassign-cards`, {
        from_team_id: teamToRemove.team_id,
        to_team_id: parseInt(reassignToTeam)
      })
      
      // Then remove the team
      await axios.delete(`/api/admin/players/${editingPlayer.player_id}/teams/${teamToRemove.team_id}`)
      
      addToast(`Reassigned ${teamToRemove.card_count} cards and removed team successfully`, 'success')
      
      // Reload detailed team data with updated card counts
      const response = await axios.get(`/api/admin/players/${editingPlayer.player_id}/teams`)
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)
      
      // Close reassignment modal
      setShowReassignModal(false)
      setTeamToRemove(null)
      setReassignToTeam('')
      
      // Reload main players list to keep it in sync
      await loadPlayers()
      
    } catch (error) {
      console.error('Error reassigning cards:', error)
      addToast(error.response?.data?.message || 'Failed to reassign cards', 'error')
    } finally {
      setReassigning(false)
    }
  }

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddTeam = async (teamId) => {
    if (!editingPlayer || !teamId) return
    
    try {
      await axios.post(`/api/admin/players/${editingPlayer.player_id}/teams`, {
        team_id: parseInt(teamId)
      })
      
      addToast('Team added successfully', 'success')
      
      // Reload detailed team data with card counts
      const response = await axios.get(`/api/admin/players/${editingPlayer.player_id}/teams`)
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)
      
      // Reload main players list to keep it in sync
      await loadPlayers()
      
      // Clear search term and close dropdown
      setTeamSearchTerm('')
      setShowTeamDropdown(false)
    } catch (error) {
      console.error('Error adding team:', error)
      addToast(error.response?.data?.message || 'Failed to add team', 'error')
    }
  }

  const handleRemoveTeam = async (teamId, cardCount) => {
    if (!editingPlayer || !teamId) return
    
    const teamToRemoveObj = editingPlayer.teams.find(t => t.team_id === teamId)
    
    // If there are cards assigned to this team, show reassignment modal
    if (cardCount > 0) {
      const otherTeams = editingPlayer.teams.filter(t => t.team_id !== teamId)
      
      if (otherTeams.length === 0) {
        addToast('Cannot remove team: Player has cards assigned to this team and no other teams to reassign to. Add another team first.', 'error')
        return
      }
      
      // Show reassignment modal
      setTeamToRemove(teamToRemoveObj)
      setReassignToTeam('')
      setShowReassignModal(true)
      return
    }
    
    // If no cards, proceed with direct removal
    try {
      await axios.delete(`/api/admin/players/${editingPlayer.player_id}/teams/${teamId}`)
      
      addToast('Team removed successfully', 'success')
      
      // Reload detailed team data with card counts
      const response = await axios.get(`/api/admin/players/${editingPlayer.player_id}/teams`)
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)
      
      // Reload main players list to keep it in sync
      await loadPlayers()
    } catch (error) {
      console.error('Error removing team:', error)
      const errorMessage = error.response?.data?.message || 'Failed to remove team'
      addToast(errorMessage, 'error')
    }
  }

  const handleSavePlayer = async () => {
    if (!editingPlayer) return
    
    try {
      setSaving(true)
      
      await axios.put(`/api/admin/players/${editingPlayer.player_id}`, {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        nick_name: editForm.nick_name.trim() || null,
        birthdate: editForm.birthdate || null,
        is_hof: editForm.is_hof
      })
      
      addToast('Player updated successfully', 'success')
      handleCloseModal()
      
      // Reload players to get updated data
      loadPlayers()
    } catch (error) {
      console.error('Error updating player:', error)
      addToast(error.response?.data?.message || 'Failed to update player', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePlayer = async () => {
    if (!playerToDelete) return
    
    try {
      setDeleting(true)
      
      await axios.delete(`/api/admin/players/${playerToDelete.player_id}`)
      
      addToast(`Deleted player: ${getPlayerName(playerToDelete)}`, 'success')
      
      // Close delete modal
      setPlayerToDelete(null)
      
      // Reload players to get updated data
      await loadPlayers(searchTerm)
      
    } catch (error) {
      console.error('Error deleting player:', error)
      addToast(error.response?.data?.message || 'Failed to delete player', 'error')
    } finally {
      setDeleting(false)
    }
  }


  const getTeamCircles = (player) => {
    if (!player.teams || player.teams.length === 0) {
      return (
        <div 
          className="team-circle-base team-circle-sm no-teams" 
          title="No teams assigned"
        >
          —
        </div>
      )
    }
    
    // Remove duplicates based on team_id
    const uniqueTeams = player.teams.reduce((acc, team) => {
      if (!acc.some(t => t.team_id === team.team_id)) {
        acc.push(team)
      }
      return acc
    }, [])
    
    return (
      <div className="player-teams">
        {uniqueTeams.map(team => (
          <div
            key={team.team_id}
            className="team-circle-base team-circle-sm"
            style={{
              '--primary-color': team.primary_color || '#666',
              '--secondary-color': team.secondary_color || '#999'
            }}
            title={team.name || 'Unknown Team'}
          >
            {team.abbreviation || '?'}
          </div>
        ))}
      </div>
    )
  }

  const getPlayerName = (player) => {
    const firstName = player.first_name || ''
    const lastName = player.last_name || ''
    const nickname = player.nick_name || ''
    
    // If we have both first and last name, and a nickname, return JSX with styling
    if (firstName && lastName && nickname) {
      return (
        <span>
          {firstName} <span className="player-nickname-inline">"{nickname}"</span> {lastName}
        </span>
      )
    }
    
    // If we have first and last name but no nickname, format as "First Last"
    if (firstName && lastName) {
      return `${firstName} ${lastName}`
    }
    
    // If we only have nickname, use that
    if (nickname) {
      return nickname
    }
    
    // Fallback to any available name or unknown
    return `${firstName} ${lastName}`.trim() || 'Unknown Player'
  }

  return (
    <div className="admin-players-page">
      <div className="admin-header">
        <div className="admin-title">
          <Icon name="user" size={32} />
          <h1>{totalPlayers > 0 ? `${totalPlayers.toLocaleString()} Players` : 'Players'}</h1>
        </div>

        <div className="admin-controls">
          <button
            className="new-item-button"
            onClick={handleShowAddModal}
            title="Add new player"
          >
            <Icon name="plus" size={22} />
          </button>
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="Search players by name..."
              value={searchTerm}
              onChange={handleSearch}
              autoFocus
            />
            {searching && <div className="card-icon-spinner small"></div>}
          </div>
        </div>
      </div>

      <div className="players-content">
        {loading ? (
          <div className="loading-state">
            <div className="card-icon-spinner"></div>
            <span>Loading players...</span>
          </div>
        ) : (
          <div className="players-section">
            <div className="section-header">
              <div className="section-info">
                <h2>
                  {isSearchMode 
                    ? `Search Results (${players.length})` 
                    : `Most Recently Viewed Players (${players.length})`
                  }
                </h2>
              </div>
            </div>

            <div className="players-table">
              <div className="table-header">
                <div className="col-header center">Actions</div>
                <div 
                  className={`col-header sortable ${sortField === 'player_id' ? 'active' : ''}`}
                  onClick={() => handleSort('player_id')}
                >
                  ID
                  {sortField === 'player_id' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header sortable ${sortField === 'name' ? 'active' : ''}`}
                  onClick={() => handleSort('name')}
                >
                  Player
                  {sortField === 'name' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header center sortable ${sortField === 'card_count' ? 'active' : ''}`}
                  onClick={() => handleSort('card_count')}
                >
                  Cards
                  {sortField === 'card_count' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header center sortable ${sortField === 'is_hof' ? 'active' : ''}`}
                  onClick={() => handleSort('is_hof')}
                >
                  HOF
                  {sortField === 'is_hof' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
              </div>
              
              {getSortedPlayers().map(player => (
                <div 
                  key={player.player_id} 
                  className="player-row"
                  onDoubleClick={() => handleEditPlayer(player)}
                  title="Double-click to edit player"
                >
                  <div className="col-actions">
                    <button 
                      className="edit-btn"
                      title="Edit player"
                      onClick={() => handleEditPlayer(player)}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    {(player.card_count === 0) && (
                      <button 
                        className="delete-btn"
                        title="Delete player (only allowed for players with 0 cards)"
                        onClick={() => setPlayerToDelete(player)}
                      >
                        <Icon name="trash-2" size={16} />
                      </button>
                    )}
                  </div>
                  <div className="col-id">{player.player_id}</div>
                  <div className="col-player">
                    <div className="player-info">
                      <div className="player-name">{getPlayerName(player)}</div>
                      {getTeamCircles(player)}
                    </div>
                  </div>
                  <div className="col-cards">{(player.card_count || 0).toLocaleString()}</div>
                  <div className="col-hof">
                    {player.is_hof && (
                      <div className="hof-badge" title="Hall of Fame">
                        <Icon name="star" size={16} />
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {players.length === 0 && (
                <div className="empty-state">
                  <Icon name="search" size={48} />
                  <h3>No players found</h3>
                  <p>
                    {isSearchMode 
                      ? `No players match "${searchTerm}". Try a different search term.`
                      : 'No recently viewed players found. Players will appear here after users visit their detail pages.'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Edit Player Modal */}
      {editingPlayer && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="user" size={20} />
                Edit Player #{editingPlayer.player_id}
              </h3>
              <button 
                className="modal-close-btn" 
                onClick={handleCloseModal}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.first_name || ''}
                    onChange={(e) => handleFormChange('first_name', e.target.value)}
                    placeholder="First name"
                  />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.last_name || ''}
                    onChange={(e) => handleFormChange('last_name', e.target.value)}
                    placeholder="Last name"
                  />
                </div>

                <div className="form-group">
                  <label>Nickname</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.nick_name || ''}
                    onChange={(e) => handleFormChange('nick_name', e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-group">
                  <label>Birthdate</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.birthdate || ''}
                    onChange={(e) => handleFormChange('birthdate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Hall of Fame</label>
                  <button
                    type="button"
                    className={`hof-toggle ${editForm.is_hof ? 'hof-active' : ''}`}
                    onClick={() => handleFormChange('is_hof', !editForm.is_hof)}
                  >
                    <Icon name="star" size={16} />
                    <span>Hall of Fame</span>
                    {editForm.is_hof && <Icon name="check" size={16} className="hof-check" />}
                  </button>
                </div>

                {/* Teams Section */}
                <div className="teams-section">
                  <div className="teams-header">
                    <h4>Teams ({editingPlayer.teams?.length || 0})</h4>
                    <div className="add-team-container">
                      <button
                        ref={addButtonRef}
                        type="button"
                        className={`add-team-btn ${showTeamDropdown ? 'active' : ''}`}
                        onClick={(e) => {
                          if (!showTeamDropdown) {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setDropdownPosition({
                              top: rect.bottom + 8,
                              left: rect.left
                            })
                          }
                          setShowTeamDropdown(!showTeamDropdown)
                        }}
                      >
                        <Icon name={showTeamDropdown ? 'x' : 'plus'} size={16} />
                      </button>
                      
                      {showTeamDropdown && createPortal(
                        <div className="team-dropdown" style={{
                          position: 'fixed',
                          top: `${dropdownPosition.top}px`,
                          left: `${dropdownPosition.left}px`,
                          zIndex: 10000,
                          maxHeight: '400px',
                          width: '300px'
                        }}>
                          <div className="team-search-box">
                            <Icon name="search" size={16} />
                            <input
                              type="text"
                              placeholder="Search teams..."
                              value={teamSearchTerm}
                              onChange={(e) => setTeamSearchTerm(e.target.value)}
                              className="team-search-input"
                              autoFocus
                            />
                          </div>
                          <div className="team-options-list">
                            {availableTeams
                              .filter(team => !editingPlayer.teams?.some(pt => pt.team_id === team.team_id))
                              .filter(team => 
                                !teamSearchTerm.trim() || 
                                team.name?.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
                                team.city?.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
                                team.abbreviation?.toLowerCase().includes(teamSearchTerm.toLowerCase())
                              )
                              .map(team => (
                                <button
                                  key={team.team_id}
                                  type="button"
                                  className="team-option"
                                  onClick={() => {
                                    handleAddTeam(team.team_id)
                                  }}
                                >
                                  <div
                                    className="team-circle-base team-circle-xs"
                                    style={{
                                      '--primary-color': team.primary_color || '#666',
                                      '--secondary-color': team.secondary_color || '#999'
                                    }}
                                  >
                                    {team.abbreviation}
                                  </div>
                                  <span>{team.name}</span>
                                </button>
                              ))
                            }
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                  
                  <div className="team-warning">
                    <Icon name="warning" size={16} />
                    <span>WARNING: Changes to the team list happen immediately.</span>
                  </div>
                  
                  <div className="teams-list">
                    {editingPlayer.teams && editingPlayer.teams.length > 0 ? (
                      editingPlayer.teams.map(team => (
                        <div key={team.team_id} className="team-item">
                          <div
                            className="team-circle-base team-circle-sm"
                            style={{
                              '--primary-color': team.primary_color || '#666',
                              '--secondary-color': team.secondary_color || '#999'
                            }}
                            title={team.name}
                          >
                            {team.abbreviation}
                          </div>
                          <div className="team-info">
                            <span className="team-name">
                              {team.name}
                              {team.card_count > 0 && (
                                <>
                                  {' '}
                                  <span style={{
                                    fontSize: '0.65rem',
                                    color: 'rgba(156, 163, 175, 0.9)',
                                    fontWeight: '500',
                                    backgroundColor: 'rgba(156, 163, 175, 0.15)',
                                    padding: '2px 6px',
                                    borderRadius: '10px',
                                    display: 'inline-block'
                                  }}>
                                    {team.card_count}
                                  </span>
                                </>
                              )}
                            </span>
                          </div>
                          <button
                            type="button"
                            className="remove-team-btn"
                            onClick={() => handleRemoveTeam(team.team_id, team.card_count || 0)}
                            title={`Remove ${team.name}${team.card_count > 0 ? ` (${team.card_count} cards will need reassignment)` : ''}`}
                          >
                            <Icon name="minus" size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="no-teams-message">
                        No teams assigned
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                  <button 
                    type="button" 
                    className="btn-cancel" 
                    onClick={handleCloseModal}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button 
                    type="button" 
                    className="btn-primary" 
                    onClick={handleSavePlayer}
                    disabled={saving || (!editForm.first_name?.trim() && !editForm.last_name?.trim() && !editForm.nick_name?.trim())}
                  >
                    {saving ? (
                      <>
                        <div className="spinner"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Icon name="check" size={16} />
                        Save Changes
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
      )}

      {/* Card Reassignment Modal */}
      {showReassignModal && teamToRemove && (
        <div className="modal-overlay" onClick={() => setShowReassignModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="refresh-cw" size={20} />
                Reassign Cards
              </h3>
              <button 
                className="modal-close-btn" 
                onClick={() => setShowReassignModal(false)}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
              <div className="form-group">
                <div className="reassign-info">
                  <p>
                    <strong>{editingPlayer.first_name} {editingPlayer.last_name}</strong> has{' '}
                    <span className="card-count">{teamToRemove.card_count} cards</span>{' '}
                    assigned to <strong>{teamToRemove.name}</strong>.
                  </p>
                  <p>
                    Before removing this team, you must reassign these cards to another team that {editingPlayer.first_name} {editingPlayer.last_name} is already assigned to.
                  </p>
                </div>
              </div>

              <div className="form-group">
                <label>Reassign cards to:</label>
                <select 
                  className="form-input"
                  value={reassignToTeam}
                  onChange={(e) => setReassignToTeam(e.target.value)}
                  disabled={reassigning}
                >
                  <option value="">Select a team...</option>
                  {editingPlayer.teams
                    .filter(team => team.team_id !== teamToRemove.team_id)
                    .map(team => (
                      <option key={team.team_id} value={team.team_id}>
                        {team.name} ({team.card_count} cards)
                      </option>
                    ))
                  }
                </select>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setShowReassignModal(false)}
                  disabled={reassigning}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleReassignCards}
                  disabled={reassigning || !reassignToTeam}
                >
                  {reassigning ? (
                    <>
                      <div className="spinner"></div>
                      Reassigning...
                    </>
                  ) : (
                    <>
                      <Icon name="refresh-cw" size={16} />
                      Reassign {teamToRemove.card_count} Cards & Remove Team
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Player Confirmation Modal */}
      {playerToDelete && (
        <div className="modal-overlay" onClick={() => setPlayerToDelete(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="trash-2" size={20} />
                Delete Player
              </h3>
              <button 
                className="modal-close-btn" 
                onClick={() => setPlayerToDelete(null)}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
              <div className="form-group">
                <div className="delete-warning">
                  <Icon name="alert-triangle" size={24} className="warning-icon" />
                  <div className="warning-content">
                    <p>
                      <strong>Are you sure you want to delete this player?</strong>
                    </p>
                    <p>
                      Player: <strong>{getPlayerName(playerToDelete)}</strong> (ID: {playerToDelete.player_id})
                    </p>
                    <p>
                      Cards: <strong>{playerToDelete.card_count || 0}</strong>
                    </p>
                    {playerToDelete.card_count > 0 ? (
                      <p className="error-text">
                        <strong>Cannot delete:</strong> This player has {playerToDelete.card_count} cards. 
                        Only players with 0 cards can be deleted.
                      </p>
                    ) : (
                      <p className="success-text">
                        This player has no cards and can be safely deleted. 
                        This will also remove all player-team relationships.
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={() => setPlayerToDelete(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-danger" 
                  onClick={handleDeletePlayer}
                  disabled={deleting || playerToDelete.card_count > 0}
                >
                  {deleting ? (
                    <>
                      <div className="spinner"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Icon name="trash-2" size={16} />
                      Delete Player
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>
                <Icon name="user-plus" size={20} />
                Add New Player
              </h3>
              <button 
                className="modal-close-btn" 
                onClick={handleCloseModal}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-form">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.first_name || ''}
                    onChange={(e) => handleFormChange('first_name', e.target.value)}
                    placeholder="First name"
                  />
                </div>

                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.last_name || ''}
                    onChange={(e) => handleFormChange('last_name', e.target.value)}
                    placeholder="Last name"
                  />
                </div>

                <div className="form-group">
                  <label>Nickname</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.nick_name || ''}
                    onChange={(e) => handleFormChange('nick_name', e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-group">
                  <label>Birthdate</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editForm.birthdate || ''}
                    onChange={(e) => handleFormChange('birthdate', e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label>Hall of Fame</label>
                  <button
                    type="button"
                    className={`hof-toggle ${editForm.is_hof ? 'hof-active' : ''}`}
                    onClick={() => handleFormChange('is_hof', !editForm.is_hof)}
                  >
                    <Icon name="star" size={16} />
                    <span>Hall of Fame</span>
                    {editForm.is_hof && <Icon name="check" size={16} className="hof-check" />}
                  </button>
                </div>

                {/* Teams Section for Add Modal */}
                <div className="teams-section">
                  <div className="teams-header">
                    <h4>Teams ({(editForm.teams || []).length})</h4>
                    <div className="add-team-container">
                      <button
                        ref={addButtonRef}
                        type="button"
                        className={`add-team-btn ${showTeamDropdown ? 'active' : ''}`}
                        onClick={(e) => {
                          if (!showTeamDropdown) {
                            const rect = e.currentTarget.getBoundingClientRect()
                            setDropdownPosition({
                              top: rect.bottom + 8,
                              left: rect.left
                            })
                          }
                          setShowTeamDropdown(!showTeamDropdown)
                        }}
                      >
                        <Icon name={showTeamDropdown ? 'x' : 'plus'} size={16} />
                      </button>
                      
                      {showTeamDropdown && createPortal(
                        <div className="team-dropdown" style={{
                          position: 'fixed',
                          top: `${dropdownPosition.top}px`,
                          left: `${dropdownPosition.left}px`,
                          zIndex: 10000,
                          maxHeight: '400px',
                          width: '300px'
                        }}>
                          <div className="team-search-box">
                            <Icon name="search" size={16} />
                            <input
                              type="text"
                              placeholder="Search teams..."
                              value={teamSearchTerm}
                              onChange={(e) => setTeamSearchTerm(e.target.value)}
                              className="team-search-input"
                              autoFocus
                            />
                          </div>
                          <div className="team-options-list">
                            {availableTeams
                              .filter(team => !(editForm.teams || []).some(pt => pt.team_id === team.team_id))
                              .filter(team => 
                                !teamSearchTerm.trim() || 
                                team.name?.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
                                team.city?.toLowerCase().includes(teamSearchTerm.toLowerCase()) ||
                                team.abbreviation?.toLowerCase().includes(teamSearchTerm.toLowerCase())
                              )
                              .map(team => (
                                <button
                                  key={team.team_id}
                                  type="button"
                                  className="team-option"
                                  onClick={() => handleAddTeamToNewPlayer(team.team_id)}
                                >
                                  <div
                                    className="team-circle-base team-circle-xs"
                                    style={{
                                      '--primary-color': team.primary_color || '#666',
                                      '--secondary-color': team.secondary_color || '#999'
                                    }}
                                  >
                                    {team.abbreviation}
                                  </div>
                                  <span>{team.name}</span>
                                </button>
                              ))
                            }
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  </div>
                  
                  <div className="teams-list">
                    {(editForm.teams || []).length > 0 ? (
                      (editForm.teams || []).map(team => (
                        <div key={team.team_id} className="team-item">
                          <div
                            className="team-circle-base team-circle-sm"
                            style={{
                              '--primary-color': team.primary_color || '#666',
                              '--secondary-color': team.secondary_color || '#999'
                            }}
                            title={team.name}
                          >
                            {team.abbreviation}
                          </div>
                          <div className="team-info">
                            <span className="team-name">{team.name}</span>
                          </div>
                          <button
                            type="button"
                            className="remove-team-btn"
                            onClick={() => handleRemoveTeamFromNewPlayer(team.team_id)}
                            title={`Remove ${team.name}`}
                          >
                            <Icon name="minus" size={14} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="no-teams-message">
                        No teams assigned
                      </div>
                    )}
                  </div>
                </div>

                <div className="modal-actions">
                <button 
                  type="button" 
                  className="btn-cancel" 
                  onClick={handleCloseModal}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleAddPlayer}
                  disabled={saving || (!editForm.first_name?.trim() && !editForm.last_name?.trim() && !editForm.nick_name?.trim())}
                >
                  {saving ? (
                    <>
                      <div className="spinner"></div>
                      Creating...
                    </>
                  ) : (
                    <>
                      <Icon name="user-plus" size={16} />
                      Create Player
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPlayers