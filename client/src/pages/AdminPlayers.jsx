import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminTeams.css' // Reuse existing admin styles
import './AdminPlayers.css' // Additional styles for players

function AdminPlayers() {
  const [players, setPlayers] = useState([])
  const [filteredPlayers, setFilteredPlayers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [showTeamModal, setShowTeamModal] = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    nick_name: '',
    is_hof: false
  })
  const [playerTeams, setPlayerTeams] = useState([])
  const [availableTeams, setAvailableTeams] = useState([])
  const [reassignForm, setReassignForm] = useState({
    from_team_id: '',
    to_team_id: ''
  })
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    loadPlayers()
    loadAvailableTeams()
  }, [])

  useEffect(() => {
    // Filter players based on search term
    if (!searchTerm.trim()) {
      setFilteredPlayers(players)
    } else {
      const filtered = players.filter(player => 
        player.first_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.last_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        player.nick_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        `${player.first_name} ${player.last_name}`.toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredPlayers(filtered)
    }
  }, [players, searchTerm])

  const loadPlayers = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/players?limit=100')
      setPlayers(response.data.players || [])
    } catch (error) {
      console.error('Error loading players:', error)
      addToast('Failed to load players', 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadAvailableTeams = async () => {
    try {
      const response = await axios.get('/api/teams-list?limit=200')
      setAvailableTeams(response.data.teams || [])
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const loadPlayerTeams = async (playerId) => {
    try {
      const response = await axios.get(`/api/admin/players/${playerId}/teams`)
      setPlayerTeams(response.data.teams || [])
    } catch (error) {
      console.error('Error loading player teams:', error)
      addToast('Failed to load player teams', 'error')
    }
  }

  const handleEditPlayer = (player) => {
    setEditingPlayer(player)
    setEditForm({
      first_name: player.first_name || '',
      last_name: player.last_name || '',
      nick_name: player.nick_name || '',
      is_hof: player.is_hof || false
    })
    setShowEditModal(true)
  }

  const handleAddPlayer = () => {
    setEditingPlayer(null)
    setEditForm({
      first_name: '',
      last_name: '',
      nick_name: '',
      is_hof: false
    })
    setShowAddModal(true)
  }

  const handleManageTeams = async (player) => {
    setEditingPlayer(player)
    await loadPlayerTeams(player.player_id)
    setShowTeamModal(true)
  }

  const handleReassignCards = (player) => {
    setEditingPlayer(player)
    setReassignForm({
      from_team_id: '',
      to_team_id: ''
    })
    setShowReassignModal(true)
  }

  const handleCloseModal = () => {
    setShowEditModal(false)
    setShowAddModal(false)
    setShowTeamModal(false)
    setShowReassignModal(false)
    setEditingPlayer(null)
    setEditForm({
      first_name: '',
      last_name: '',
      nick_name: '',
      is_hof: false
    })
    setPlayerTeams([])
    setReassignForm({
      from_team_id: '',
      to_team_id: ''
    })
    setSaving(false)
  }

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    if (!editForm.first_name.trim() || !editForm.last_name.trim()) {
      addToast('First name and last name are required', 'error')
      return
    }

    try {
      setSaving(true)
      
      const playerData = {
        first_name: editForm.first_name.trim(),
        last_name: editForm.last_name.trim(),
        nick_name: editForm.nick_name.trim() || null,
        is_hof: editForm.is_hof
      }

      if (editingPlayer) {
        // Update existing player
        await axios.put(`/api/admin/players/${editingPlayer.player_id}`, playerData)
        addToast('Player updated successfully', 'success')
      } else {
        // Create new player
        await axios.post('/api/admin/players', playerData)
        addToast('Player created successfully', 'success')
      }
      
      await loadPlayers()
      handleCloseModal()
      
    } catch (error) {
      console.error('Error saving player:', error)
      addToast(`Failed to ${editingPlayer ? 'update' : 'create'} player: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleAddTeamToPlayer = async (teamId) => {
    try {
      await axios.post(`/api/admin/players/${editingPlayer.player_id}/teams`, {
        team_id: parseInt(teamId)
      })
      addToast('Team added to player', 'success')
      await loadPlayerTeams(editingPlayer.player_id)
    } catch (error) {
      console.error('Error adding team:', error)
      addToast('Failed to add team', 'error')
    }
  }

  const handleRemoveTeamFromPlayer = async (teamId) => {
    try {
      await axios.delete(`/api/admin/players/${editingPlayer.player_id}/teams/${teamId}`)
      addToast('Team removed from player', 'success')
      await loadPlayerTeams(editingPlayer.player_id)
    } catch (error) {
      console.error('Error removing team:', error)
      addToast('Failed to remove team', 'error')
    }
  }

  const handleReassignCardsSubmit = async () => {
    // Validate form inputs
    if (!reassignForm.from_team_id || !reassignForm.to_team_id) {
      addToast('Please select both source and destination teams', 'error')
      return
    }

    if (reassignForm.from_team_id === reassignForm.to_team_id) {
      addToast('Source and destination teams cannot be the same', 'error')
      return
    }

    try {
      setSaving(true)
      const response = await axios.post(`/api/admin/players/${editingPlayer.player_id}/reassign-cards`, {
        from_team_id: parseInt(reassignForm.from_team_id),
        to_team_id: parseInt(reassignForm.to_team_id)
      })
      
      const { cardsReassigned } = response.data
      addToast(`Successfully reassigned ${cardsReassigned} cards`, 'success')
      handleCloseModal()
      
    } catch (error) {
      console.error('Error reassigning cards:', error)
      addToast(`Failed to reassign cards: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="admin-teams-page">
        <div className="loading-state">
          <Icon name="activity" size={24} className="spinning" />
          <span>Loading players...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-teams-page">
      <div className="admin-header">
        <div className="admin-title">
          <Icon name="users" size={32} />
          <h1>Player Management</h1>
        </div>
        
        <div className="header-actions">
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="Search players..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <button 
            className="add-btn"
            onClick={handleAddPlayer}
          >
            <Icon name="plus" size={20} />
            Add Player
          </button>
        </div>
      </div>

      <div className="content-area">
        <div className="stats-summary">
          <div className="stat-item">
            <span className="stat-number">{filteredPlayers.length}</span>
            <span className="stat-label">Players Shown</span>
          </div>
          <div className="stat-item">
            <span className="stat-number">{players.length}</span>
            <span className="stat-label">Total Players</span>
          </div>
        </div>

        <div className="teams-table-container">
          <table className="teams-table">
            <thead>
              <tr>
                <th style={{width: '80px'}}>ID</th>
                <th style={{width: '200px'}}>Name</th>
                <th style={{width: '150px'}}>Nickname</th>
                <th style={{width: '80px'}}>HOF</th>
                <th style={{width: '100px'}}>Card Count</th>
                <th style={{width: '120px'}}>Team Count</th>
                <th style={{width: '200px'}}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredPlayers.map(player => (
                <tr key={player.player_id}>
                  <td className="center">{player.player_id}</td>
                  <td>
                    <div className="player-name">
                      {player.first_name} {player.last_name}
                      {player.is_hof && <Icon name="trophy" size={16} className="hof-icon" title="Hall of Fame" />}
                    </div>
                  </td>
                  <td>{player.nick_name || '-'}</td>
                  <td className="center">
                    {player.is_hof ? 
                      <Icon name="check" size={16} className="success-icon" /> : 
                      <span className="muted">-</span>
                    }
                  </td>
                  <td className="center">{player.card_count?.toLocaleString() || 0}</td>
                  <td className="center">{player.team_count || 0}</td>
                  <td className="action-cell">
                    <button
                      className="edit-btn"
                      onClick={() => handleEditPlayer(player)}
                      title="Edit player"
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button
                      className="teams-btn"
                      onClick={() => handleManageTeams(player)}
                      title="Manage teams"
                    >
                      <Icon name="shield" size={16} />
                    </button>
                    <button
                      className="reassign-btn"
                      onClick={() => handleReassignCards(player)}
                      title="Reassign cards"
                      disabled={!player.card_count}
                    >
                      <Icon name="shuffle" size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          {filteredPlayers.length === 0 && !loading && (
            <div className="empty-state">
              <Icon name="users" size={48} />
              <p>No players found</p>
              {searchTerm && <p>Try adjusting your search criteria</p>}
            </div>
          )}
        </div>
      </div>

      {/* Add Player Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Player</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-row">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.first_name}
                    onChange={(e) => handleFormChange('first_name', e.target.value)}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                
                <div className="form-row">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.last_name}
                    onChange={(e) => handleFormChange('last_name', e.target.value)}
                    placeholder="Enter last name"
                    required
                  />
                </div>
                
                <div className="form-row">
                  <label className="form-label">Nickname</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.nick_name}
                    onChange={(e) => handleFormChange('nick_name', e.target.value)}
                    placeholder="Enter nickname (optional)"
                  />
                </div>

                <div className="form-row">
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={editForm.is_hof}
                      onChange={(e) => handleFormChange('is_hof', e.target.checked)}
                    />
                    <span>Hall of Fame</span>
                  </label>
                </div>
              </form>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleSave}
                disabled={saving || !editForm.first_name.trim() || !editForm.last_name.trim()}
              >
                {saving ? (
                  <>
                    <Icon name="activity" size={16} className="spinning" />
                    Creating...
                  </>
                ) : (
                  <>
                    <Icon name="plus" size={16} />
                    Add Player
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Player Modal */}
      {showEditModal && editingPlayer && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Player</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-row">
                  <label className="form-label">Player ID</label>
                  <span className="form-value">{editingPlayer.player_id}</span>
                </div>

                <div className="form-row">
                  <label className="form-label">First Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.first_name}
                    onChange={(e) => handleFormChange('first_name', e.target.value)}
                    placeholder="Enter first name"
                    required
                  />
                </div>
                
                <div className="form-row">
                  <label className="form-label">Last Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.last_name}
                    onChange={(e) => handleFormChange('last_name', e.target.value)}
                    placeholder="Enter last name"
                    required
                  />
                </div>
                
                <div className="form-row">
                  <label className="form-label">Nickname</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.nick_name}
                    onChange={(e) => handleFormChange('nick_name', e.target.value)}
                    placeholder="Enter nickname (optional)"
                  />
                </div>

                <div className="form-row">
                  <label className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={editForm.is_hof}
                      onChange={(e) => handleFormChange('is_hof', e.target.checked)}
                    />
                    <span>Hall of Fame</span>
                  </label>
                </div>
              </form>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleSave}
                disabled={saving || !editForm.first_name.trim() || !editForm.last_name.trim()}
              >
                {saving ? (
                  <>
                    <Icon name="activity" size={16} className="spinning" />
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
      )}

      {/* Manage Teams Modal */}
      {showTeamModal && editingPlayer && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-modal large-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Manage Teams - {editingPlayer.first_name} {editingPlayer.last_name}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="teams-section">
                <h4>Current Teams</h4>
                <div className="current-teams">
                  {playerTeams.length === 0 ? (
                    <p className="muted">No teams assigned</p>
                  ) : (
                    playerTeams.map(team => (
                      <div key={team.team_id} className="team-item">
                        <div 
                          className="mini-team-circle"
                          style={{ 
                            '--primary-color': team.primary_color,
                            '--secondary-color': team.secondary_color 
                          }}
                        >
                          {team.abbreviation}
                        </div>
                        <span className="team-name">{team.name}</span>
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveTeamFromPlayer(team.team_id)}
                          title="Remove team"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="teams-section">
                <h4>Add Team</h4>
                <div className="available-teams">
                  {availableTeams
                    .filter(team => !playerTeams.some(pt => pt.team_id === team.team_id))
                    .map(team => (
                      <button
                        key={team.team_id}
                        className="team-add-btn"
                        onClick={() => handleAddTeamToPlayer(team.team_id)}
                      >
                        <div 
                          className="mini-team-circle"
                          style={{ 
                            '--primary-color': team.primary_color,
                            '--secondary-color': team.secondary_color 
                          }}
                        >
                          {team.abbreviation}
                        </div>
                        <span className="team-name">{team.name}</span>
                        <Icon name="plus" size={16} />
                      </button>
                    ))}
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseModal}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Cards Modal */}
      {showReassignModal && editingPlayer && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Reassign Cards - {editingPlayer.first_name} {editingPlayer.last_name}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="reassign-info">
                <p>This will reassign ALL cards for this player from one team to another.</p>
                <p className="warning">⚠️ This action cannot be undone!</p>
              </div>

              <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                <div className="form-row">
                  <label className="form-label">From Team *</label>
                  <select
                    className="form-input"
                    value={reassignForm.from_team_id}
                    onChange={(e) => setReassignForm(prev => ({ ...prev, from_team_id: e.target.value }))}
                    required
                  >
                    <option value="">Select source team...</option>
                    {availableTeams.map(team => (
                      <option key={team.team_id} value={team.team_id}>
                        {team.name} ({team.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="form-row">
                  <label className="form-label">To Team *</label>
                  <select
                    className="form-input"
                    value={reassignForm.to_team_id}
                    onChange={(e) => setReassignForm(prev => ({ ...prev, to_team_id: e.target.value }))}
                    required
                  >
                    <option value="">Select destination team...</option>
                    {availableTeams.map(team => (
                      <option key={team.team_id} value={team.team_id}>
                        {team.name} ({team.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>
              </form>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="save-btn danger-btn" 
                onClick={handleReassignCardsSubmit}
                disabled={saving || !reassignForm.from_team_id || !reassignForm.to_team_id}
              >
                {saving ? (
                  <>
                    <Icon name="activity" size={16} className="spinning" />
                    Reassigning...
                  </>
                ) : (
                  <>
                    <Icon name="move" size={16} />
                    Reassign Cards
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminPlayers