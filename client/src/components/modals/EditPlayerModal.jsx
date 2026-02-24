import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './EditPlayerModal.css'

function EditPlayerModal({ player, isOpen, onClose, onSave, onDeleteSuccess }) {
  const [editForm, setEditForm] = useState({})
  const [editingPlayer, setEditingPlayer] = useState(null)
  const [availableTeams, setAvailableTeams] = useState([])
  const [showTeamDropdown, setShowTeamDropdown] = useState(false)
  const [teamSearchTerm, setTeamSearchTerm] = useState('')
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [teamToRemove, setTeamToRemove] = useState(null)
  const [reassignToTeam, setReassignToTeam] = useState('')
  const [saving, setSaving] = useState(false)
  const [reassigning, setReassigning] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const addButtonRef = useRef(null)
  const { user } = useAuth()
  const { addToast } = useToast()
  const isSuperAdmin = user?.role === 'superadmin'

  useEffect(() => {
    if (isOpen && player) {
      console.log('Modal opened with initial player data:', player)
      
      // Initialize with player data passed in
      setEditingPlayer(player)
      setEditForm({
        first_name: player.first_name || '',
        last_name: player.last_name || '',
        nick_name: player.nick_name || '',
        birthdate: player.birthdate ? player.birthdate.split('T')[0] : '',
        is_hof: player.is_hof || false
      })
      
      console.log('Initial form data:', {
        first_name: player.first_name || '',
        last_name: player.last_name || '',
        nick_name: player.nick_name || '',
        birthdate: player.birthdate ? player.birthdate.split('T')[0] : '',
        is_hof: player.is_hof || false
      })
      
      // Load available teams for the dropdown
      loadAvailableTeams()
      
      // Try to load full player details (this might fail due to auth, but that's ok)
      loadPlayerDetails()
    }
  }, [isOpen, player])

  const loadPlayerDetails = async () => {
    try {
      console.log('Loading player details for player_id:', player.player_id)
      
      // Load basic player details
      const playerResponse = await axios.get(`/api/admin/players/${player.player_id}`)
      const playerResponseData = playerResponse.data
      
      console.log('Player response received:', playerResponseData)
      
      // Extract player data from response (it's nested under 'player' key)
      const playerData = playerResponseData.player || playerResponseData
      
      console.log('Extracted player data:', playerData)
      
      // Load teams for this player
      const teamsResponse = await axios.get(`/api/admin/players/${player.player_id}/teams`)
      const teamsData = teamsResponse.data.teams || []
      
      console.log('Teams data received:', teamsData)
      
      // Combine player data with teams
      const completePlayerData = {
        ...playerData,
        teams: teamsData
      }
      
      console.log('Complete player data:', completePlayerData)
      
      // Update with full data including teams
      setEditingPlayer(completePlayerData)
      
      // Always update form with the complete data we received
      setEditForm({
        first_name: playerData.first_name || '',
        last_name: playerData.last_name || '',
        nick_name: playerData.nick_name || '',
        birthdate: playerData.birthdate ? playerData.birthdate.split('T')[0] : '',
        is_hof: playerData.is_hof || false
      })
      
      console.log('Updated editForm:', {
        first_name: playerData.first_name || '',
        last_name: playerData.last_name || '',
        nick_name: playerData.nick_name || '',
        birthdate: playerData.birthdate ? playerData.birthdate.split('T')[0] : '',
        is_hof: playerData.is_hof || false
      })
      
    } catch (error) {
      console.error('Error loading player details:', error)
      console.log('Error details:', error.response)
      // Show error toast so we know what's happening
      addToast('Failed to load complete player details', 'error')
      console.log('Using basic player data passed to modal:', player)
    }
  }

  const loadAvailableTeams = async () => {
    try {
      const response = await axios.get('/api/admin/teams')
      setAvailableTeams(response.data.teams || [])
    } catch (error) {
      console.error('Error loading teams:', error)
    }
  }

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleAddTeam = async (teamId) => {
    if (!editingPlayer) return
    
    try {
      const response = await axios.post(`/api/admin/players/${editingPlayer.player_id}/teams`, {
        team_id: teamId
      })
      
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)
      setShowTeamDropdown(false)
      setTeamSearchTerm('')
      
      addToast('Team added successfully', 'success')
    } catch (error) {
      console.error('Error adding team:', error)
      const errorMessage = error.response?.data?.message || 'Failed to add team'
      addToast(errorMessage, 'error')
    }
  }

  const handleRemoveTeam = async (teamId, cardCount) => {
    if (!editingPlayer) return
    
    if (cardCount > 0) {
      const team = editingPlayer?.teams?.find(t => t.team_id === teamId)
      setTeamToRemove({ ...team, card_count: cardCount })
      setShowReassignModal(true)
      setReassignToTeam('')
    } else {
      await removeTeamDirectly(teamId)
    }
  }

  const removeTeamDirectly = async (teamId) => {
    try {
      const response = await axios.delete(`/api/admin/players/${editingPlayer.player_id}/teams/${teamId}`)
      
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)
      
      addToast('Team removed successfully', 'success')
    } catch (error) {
      console.error('Error removing team:', error)
      const errorMessage = error.response?.data?.message || 'Failed to remove team'
      addToast(errorMessage, 'error')
    }
  }

  const handleReassignCards = async () => {
    if (!teamToRemove || !reassignToTeam) return
    
    try {
      setReassigning(true)
      
      const response = await axios.delete(
        `/api/admin/players/${editingPlayer.player_id}/teams/${teamToRemove.team_id}`,
        {
          data: { reassign_to_team_id: parseInt(reassignToTeam) }
        }
      )
      
      const updatedPlayer = {
        ...editingPlayer,
        teams: response.data.teams || []
      }
      setEditingPlayer(updatedPlayer)
      
      setShowReassignModal(false)
      setTeamToRemove(null)
      setReassignToTeam('')
      
      addToast(`${teamToRemove?.card_count || 0} cards reassigned successfully`, 'success')
    } catch (error) {
      console.error('Error reassigning cards:', error)
      const errorMessage = error.response?.data?.message || 'Failed to reassign cards'
      addToast(errorMessage, 'error')
    } finally {
      setReassigning(false)
    }
  }

  const handleSave = async () => {
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
      
      if (onSave) {
        onSave()
      }
      
      onClose()
    } catch (error) {
      console.error('Error updating player:', error)
      addToast(error.response?.data?.message || 'Failed to update player', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setShowDeleteConfirm(false)
    setDeleteConfirmText('')
    onClose()
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
    setDeleteConfirmText('')
  }

  const handleDeleteConfirm = async () => {
    if (!editingPlayer || deleteConfirmText !== 'DELETE') return

    try {
      setDeleting(true)
      await axios.delete(`/api/admin/players/${editingPlayer.player_id}`)
      addToast(`Player "${editingPlayer.first_name} ${editingPlayer.last_name}" has been permanently deleted`, 'success')
      handleClose()
      if (onDeleteSuccess) {
        onDeleteSuccess(editingPlayer.player_id)
      }
    } catch (error) {
      console.error('Error deleting player:', error)
      addToast(`Failed to delete player: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen) return null

  return (
    <>
      <div className="modal-overlay" onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }}>
        <div className="edit-player-modal" onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
        }}>
          <div className="modal-header">
            <h3>
              Edit Player #{editingPlayer?.player_id || player?.player_id || 'Unknown'}
              {(editingPlayer || player) && (
                <> - {editingPlayer?.first_name || player?.first_name || ''} {editingPlayer?.last_name || player?.last_name || ''}</>
              )}
            </h3>
            <button
              className="close-btn"
              onClick={onClose}
              type="button"
            >
              <Icon name="x" size={20} />
            </button>
          </div>

          <div className="modal-content">
            <div className="edit-form">
              {/* Player Details - Label/Input Layout */}
              <div className="player-details-form">
                <div className="form-field-row">
                  <label className="field-label">First Name</label>
                  <input
                    type="text"
                    className="field-input"
                    value={editForm.first_name || ''}
                    onChange={(e) => handleFormChange('first_name', e.target.value)}
                    placeholder="First name"
                  />
                </div>

                <div className="form-field-row">
                  <label className="field-label">Last Name</label>
                  <input
                    type="text"
                    className="field-input"
                    value={editForm.last_name || ''}
                    onChange={(e) => handleFormChange('last_name', e.target.value)}
                    placeholder="Last name"
                  />
                </div>

                <div className="form-field-row">
                  <label className="field-label">Nickname</label>
                  <input
                    type="text"
                    className="field-input"
                    value={editForm.nick_name || ''}
                    onChange={(e) => handleFormChange('nick_name', e.target.value)}
                    placeholder="Optional"
                  />
                </div>

                <div className="form-field-row">
                  <label className="field-label">Birthdate</label>
                  <input
                    type="date"
                    className="field-input"
                    value={editForm.birthdate || ''}
                    onChange={(e) => handleFormChange('birthdate', e.target.value)}
                  />
                </div>

                <div className="form-field-row">
                  <label className="field-label">Hall of Fame</label>
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
              </div>

              {/* Teams Section */}
              <div className="teams-section">
                <div className="teams-header">
                  <h4>Teams ({editingPlayer?.teams?.length || 0})</h4>
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
                            .filter(team => !editingPlayer?.teams?.some(pt => pt.team_id === team.team_id))
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
                                onClick={() => handleAddTeam(team.team_id)}
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
                  {editingPlayer?.teams && editingPlayer.teams.length > 0 ? (
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
            </div>
          </div>

          {/* Delete Confirmation Section - Superadmin Only */}
          {isSuperAdmin && showDeleteConfirm && (
            <div className="edit-player-delete-section">
              <div className="edit-player-delete-warning">
                <Icon name="alert-triangle" size={24} />
                <div className="edit-player-delete-warning-content">
                  <h4>DANGER: Permanent Deletion</h4>
                  <p>
                    You are about to <strong>permanently delete</strong> the player "{editingPlayer?.first_name} {editingPlayer?.last_name}" and ALL of their data:
                  </p>
                  <ul>
                    <li>All {editingPlayer?.card_count || 0} card associations</li>
                    <li>All team associations ({editingPlayer?.teams?.length || 0} teams)</li>
                    <li>All player aliases</li>
                    <li>All user collection data for their cards</li>
                  </ul>
                  <p className="edit-player-delete-irreversible">
                    This action is <strong>IRREVERSIBLE</strong>. There is no undo.
                  </p>
                </div>
              </div>
              <div className="edit-player-delete-confirm-input">
                <label>Type DELETE to confirm:</label>
                <input
                  type="text"
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type DELETE"
                  autoComplete="off"
                />
              </div>
              <div className="edit-player-delete-actions">
                <button
                  className="edit-player-delete-cancel"
                  onClick={() => {
                    setShowDeleteConfirm(false)
                    setDeleteConfirmText('')
                  }}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  className="edit-player-delete-confirm"
                  onClick={handleDeleteConfirm}
                  disabled={deleteConfirmText !== 'DELETE' || deleting}
                >
                  {deleting ? (
                    <>
                      <div className="card-icon-spinner small"></div>
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Icon name="trash-2" size={16} />
                      Permanently Delete Player
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          <div className="modal-actions">
            {isSuperAdmin && !showDeleteConfirm && (
              <button
                type="button"
                className="delete-btn"
                onClick={handleDeleteClick}
                disabled={saving}
              >
                <Icon name="trash-2" size={16} />
                Delete Player
              </button>
            )}
            <div className="modal-actions-right">
              <button
                type="button"
                className="cancel-btn"
                onClick={handleClose}
                disabled={saving || deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={handleSave}
                disabled={saving || showDeleteConfirm || (!editForm.first_name?.trim() && !editForm.last_name?.trim() && !editForm.nick_name?.trim())}
              >
                {saving ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Card Reassignment Modal */}
      {showReassignModal && teamToRemove && (
        <div className="modal-overlay">
          <div className="reassign-modal">
            <div className="modal-header">
              <h3>Reassign Cards</h3>
              <button 
                className="close-btn" 
                onClick={() => setShowReassignModal(false)}
                type="button"
              >
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="modal-content">
              <div className="reassign-info">
                <p>
                  <strong>{editingPlayer?.first_name} {editingPlayer?.last_name}</strong> has{' '}
                  <span className="card-count">{teamToRemove?.card_count} cards</span>{' '}
                  assigned to <strong>{teamToRemove?.name}</strong>.
                </p>
                <p>
                  Before removing this team, you must reassign these cards to another team that {editingPlayer?.first_name} {editingPlayer?.last_name} is already assigned to.
                </p>
              </div>

              <div className="reassign-form">
                <label className="reassign-label">Reassign cards to:</label>
                <select 
                  className="reassign-select"
                  value={reassignToTeam}
                  onChange={(e) => setReassignToTeam(e.target.value)}
                  disabled={reassigning}
                >
                  <option value="">Select a team...</option>
                  {(editingPlayer?.teams || [])
                    .filter(team => team.team_id !== teamToRemove?.team_id)
                    .map(team => (
                      <option key={team.team_id} value={team.team_id}>
                        {team.name} ({team.card_count} cards)
                      </option>
                    ))
                  }
                </select>
              </div>
            </div>

            <div className="modal-actions">
              <button 
                type="button" 
                className="cancel-btn" 
                onClick={() => setShowReassignModal(false)}
                disabled={reassigning}
              >
                Cancel
              </button>
              <button 
                type="button" 
                className="reassign-btn" 
                onClick={handleReassignCards}
                disabled={reassigning || !reassignToTeam}
              >
                {reassigning ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Reassigning...
                  </>
                ) : (
                  `Reassign ${teamToRemove?.card_count} Cards & Remove Team`
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default EditPlayerModal