import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './SuggestNewPlayerModal.css'

// Calculate text color based on background brightness
const getContrastColor = (hexColor) => {
  if (!hexColor) return '#ffffff'
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  if (isNaN(r) || isNaN(g) || isNaN(b)) return '#ffffff'
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

function SuggestNewPlayerModal({ isOpen, onClose, onSuccess, preSelectedTeam = null }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [allTeams, setAllTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')

  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  // Form state
  const [formData, setFormData] = useState({
    proposed_first_name: '',
    proposed_last_name: '',
    proposed_nick_name: '',
    proposed_birthdate: '',
    proposed_is_hof: false,
    submission_notes: ''
  })

  // Selected teams state
  const [selectedTeams, setSelectedTeams] = useState([])

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        proposed_first_name: '',
        proposed_last_name: '',
        proposed_nick_name: '',
        proposed_birthdate: '',
        proposed_is_hof: false,
        submission_notes: ''
      })
      // If a team is pre-selected, add it
      if (preSelectedTeam) {
        setSelectedTeams([preSelectedTeam])
      } else {
        setSelectedTeams([])
      }
      setTeamSearch('')
    }
  }, [isOpen, preSelectedTeam])

  // Fetch all teams when modal opens
  useEffect(() => {
    if (isOpen && allTeams.length === 0) {
      fetchAllTeams()
    }
  }, [isOpen])

  const fetchAllTeams = async () => {
    try {
      setTeamsLoading(true)
      const response = await axios.get('/api/teams-list?limit=500')
      setAllTeams(response.data.teams || [])
    } catch (err) {
      console.error('Error fetching teams:', err)
    } finally {
      setTeamsLoading(false)
    }
  }

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleAddTeam = (team) => {
    if (!selectedTeams.find(t => t.team_id === team.team_id)) {
      setSelectedTeams(prev => [...prev, team])
    }
    setTeamSearch('')
  }

  const handleRemoveTeam = (teamId) => {
    setSelectedTeams(prev => prev.filter(t => t.team_id !== teamId))
  }

  // Filter teams based on search
  const selectedTeamIds = new Set(selectedTeams.map(t => t.team_id))
  const filteredTeams = allTeams.filter(team => {
    const matchesSearch = teamSearch.trim().length >= 2 &&
      team.name.toLowerCase().includes(teamSearch.toLowerCase())
    return matchesSearch && !selectedTeamIds.has(team.team_id)
  })

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.proposed_first_name.trim() || !formData.proposed_last_name.trim()) {
      addToast('First name and last name are required', 'error')
      return
    }

    setSubmitting(true)

    try {
      const submissionData = {
        proposed_first_name: formData.proposed_first_name.trim(),
        proposed_last_name: formData.proposed_last_name.trim()
      }

      if (formData.proposed_nick_name.trim()) {
        submissionData.proposed_nick_name = formData.proposed_nick_name.trim()
      }

      if (formData.proposed_birthdate) {
        submissionData.proposed_birthdate = formData.proposed_birthdate
      }

      if (formData.proposed_is_hof) {
        submissionData.proposed_is_hof = true
      }

      if (selectedTeams.length > 0) {
        submissionData.proposed_team_ids = selectedTeams.map(t => t.team_id)
      }

      if (formData.submission_notes.trim()) {
        submissionData.submission_notes = formData.submission_notes.trim()
      }

      const response = await axios.post('/api/crowdsource/player', submissionData)

      if (response.data.auto_approved) {
        addToast(`${formData.proposed_first_name} ${formData.proposed_last_name} added to database!`, 'success')
        if (onSuccess) {
          onSuccess({
            player_id: response.data.player_id,
            first_name: formData.proposed_first_name.trim(),
            last_name: formData.proposed_last_name.trim(),
            nick_name: formData.proposed_nick_name?.trim() || null,
            birthdate: formData.proposed_birthdate || null,
            is_hof: formData.proposed_is_hof,
            teams: selectedTeams
          })
        }
      } else {
        addToast('New player suggestion submitted for review!', 'success')
      }

      onClose()
    } catch (err) {
      console.error('Error submitting new player:', err)
      if (err.response?.data?.error === 'Duplicate') {
        addToast(err.response.data.message, 'error')
      } else {
        addToast(err.response?.data?.message || 'Failed to submit new player suggestion', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="suggest-new-player-modal-overlay" onClick={onClose}>
      <div className="suggest-new-player-modal" onClick={e => e.stopPropagation()}>
        <div className="suggest-new-player-modal-header">
          <h2>
            <Icon name="user-plus" size={20} />
            {isAdmin ? 'Add New Player' : 'Suggest New Player'}
          </h2>
          <button className="suggest-new-player-modal-close" onClick={onClose} type="button">
            <Icon name="x" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="suggest-new-player-form">
          <div className="suggest-new-player-modal-content">
            {/* Player Info Section */}
            <div className="suggest-new-player-form-section">
              <h3>Player Information</h3>

              <div className="suggest-new-player-form-row-group">
                <div className="suggest-new-player-form-row">
                  <label>First Name *</label>
                  <input
                    type="text"
                    value={formData.proposed_first_name}
                    onChange={e => handleFieldChange('proposed_first_name', e.target.value)}
                    placeholder="First name"
                    required
                    autoFocus
                  />
                </div>

                <div className="suggest-new-player-form-row">
                  <label>Last Name *</label>
                  <input
                    type="text"
                    value={formData.proposed_last_name}
                    onChange={e => handleFieldChange('proposed_last_name', e.target.value)}
                    placeholder="Last name"
                    required
                  />
                </div>
              </div>

              <div className="suggest-new-player-form-row">
                <label>Nickname</label>
                <input
                  type="text"
                  value={formData.proposed_nick_name}
                  onChange={e => handleFieldChange('proposed_nick_name', e.target.value)}
                  placeholder="Optional nickname (e.g., 'The Kid')"
                />
              </div>

              <div className="suggest-new-player-form-row-group">
                <div className="suggest-new-player-form-row">
                  <label>Birthdate</label>
                  <input
                    type="date"
                    value={formData.proposed_birthdate}
                    onChange={e => handleFieldChange('proposed_birthdate', e.target.value)}
                  />
                </div>

                <div className="suggest-new-player-form-row suggest-new-player-checkbox-container">
                  <label className="suggest-new-player-checkbox">
                    <input
                      type="checkbox"
                      checked={formData.proposed_is_hof}
                      onChange={e => handleFieldChange('proposed_is_hof', e.target.checked)}
                    />
                    <span className="suggest-new-player-checkbox-label">Hall of Fame</span>
                  </label>
                </div>
              </div>
            </div>

            {/* Teams Section */}
            <div className="suggest-new-player-form-section">
              <h3>Teams</h3>
              <p className="suggest-new-player-form-help">
                Add teams this player has played for. You can add multiple teams.
              </p>

              {/* Selected Teams */}
              {selectedTeams.length > 0 && (
                <div className="suggest-new-player-selected-teams">
                  {selectedTeams.map(team => (
                    <div key={team.team_id} className="suggest-new-player-selected-team">
                      <div
                        className="suggest-new-player-team-circle"
                        style={{
                          backgroundColor: team.primary_color || '#333',
                          borderColor: team.secondary_color || '#666',
                          color: getContrastColor(team.primary_color)
                        }}
                      >
                        <span>{team.abbreviation || team.name.substring(0, 3).toUpperCase()}</span>
                      </div>
                      <span className="suggest-new-player-selected-team-name">{team.name}</span>
                      <button
                        type="button"
                        className="suggest-new-player-remove-team"
                        onClick={() => handleRemoveTeam(team.team_id)}
                        title="Remove team"
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Team Search */}
              <div className="suggest-new-player-team-search-container">
                <div className="suggest-new-player-team-search-input-wrapper">
                  <Icon name="search" size={16} className="suggest-new-player-search-icon" />
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    placeholder="Search for a team to add..."
                    className="suggest-new-player-team-search-input"
                  />
                </div>

                {/* Search Results Dropdown */}
                {teamSearch.trim().length >= 2 && (
                  <div className="suggest-new-player-team-results">
                    {teamsLoading ? (
                      <div className="suggest-new-player-team-loading">Loading...</div>
                    ) : filteredTeams.length === 0 ? (
                      <div className="suggest-new-player-team-empty">No matching teams found</div>
                    ) : (
                      filteredTeams.slice(0, 8).map(team => (
                        <button
                          type="button"
                          key={team.team_id}
                          className="suggest-new-player-team-result"
                          onClick={() => handleAddTeam(team)}
                        >
                          <div
                            className="suggest-new-player-team-circle"
                            style={{
                              backgroundColor: team.primary_color || '#333',
                              borderColor: team.secondary_color || '#666',
                              color: getContrastColor(team.primary_color)
                            }}
                          >
                            <span>{team.abbreviation || team.name.substring(0, 3).toUpperCase()}</span>
                          </div>
                          <span className="suggest-new-player-team-result-name">{team.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Notes Section */}
            <div className="suggest-new-player-form-section">
              <h3>Additional Notes</h3>
              <div className="suggest-new-player-form-row">
                <label>Why should this player be added?</label>
                <textarea
                  value={formData.submission_notes}
                  onChange={e => handleFieldChange('submission_notes', e.target.value)}
                  placeholder="Include any relevant information like career highlights, years active, or where you found cards of this player."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="suggest-new-player-modal-footer">
            <div className={`suggest-new-player-info-banner ${isAdmin ? 'admin' : ''}`}>
              <Icon name={isAdmin ? 'zap' : 'info'} size={14} />
              <span>
                {isAdmin
                  ? 'Admin mode: The player will be added immediately.'
                  : 'Your suggestion will be reviewed by our team. Thank you for helping improve our database!'}
              </span>
            </div>
            <div className="suggest-new-player-form-actions">
              <button type="button" onClick={onClose} className="suggest-new-player-cancel-btn" disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="suggest-new-player-submit-btn"
                disabled={!formData.proposed_first_name.trim() || !formData.proposed_last_name.trim() || submitting}
              >
                {submitting ? (
                  <>
                    <div className="suggest-new-player-spinner"></div>
                    {isAdmin ? 'Adding...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <Icon name="user-plus" size={16} />
                    {isAdmin ? 'Add Player' : 'Submit Suggestion'}
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>,
    document.body
  )
}

export default SuggestNewPlayerModal
