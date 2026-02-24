import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Icon from '../Icon'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import './SuggestPlayerEditModalScoped.css'

function SuggestPlayerEditModal({ isOpen, onClose, onSuccess, onDeleteSuccess, player, teams = [] }) {
  const { user } = useAuth()
  const { success, error: showError } = useToast()
  const [activeTab, setActiveTab] = useState('info')
  const [submitting, setSubmitting] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)
  const canDelete = isAdmin && player?.card_count === 0
  const [allTeams, setAllTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamSearch, setTeamSearch] = useState('')

  // Player info form state
  const [infoFormData, setInfoFormData] = useState({
    proposed_first_name: '',
    proposed_last_name: '',
    proposed_nick_name: '',
    proposed_birthdate: '',
    proposed_is_hof: false,
    submission_notes: ''
  })
  const [infoChangedFields, setInfoChangedFields] = useState({})

  // Alias form state
  const [aliasFormData, setAliasFormData] = useState({
    proposed_alias_name: '',
    proposed_alias_type: 'misspelling',
    submission_notes: ''
  })

  // Team form state
  const [teamFormData, setTeamFormData] = useState({
    team_id: null,
    action_type: 'add',
    submission_notes: ''
  })

  // Image/display card form state
  const [imageFormData, setImageFormData] = useState({
    selected_card_id: null,
    submission_notes: ''
  })
  const [playerCards, setPlayerCards] = useState([])
  const [cardsLoading, setCardsLoading] = useState(false)

  // Reset forms when player changes
  useEffect(() => {
    if (player) {
      setInfoFormData({
        proposed_first_name: player.first_name || '',
        proposed_last_name: player.last_name || '',
        proposed_nick_name: player.nick_name || '',
        proposed_birthdate: player.birthdate ? new Date(player.birthdate).toISOString().split('T')[0] : '',
        proposed_is_hof: player.is_hof || false,
        submission_notes: ''
      })
      setInfoChangedFields({})
      setAliasFormData({
        proposed_alias_name: '',
        proposed_alias_type: 'misspelling',
        submission_notes: ''
      })
      setTeamFormData({
        team_id: null,
        action_type: 'add',
        submission_notes: ''
      })
      setImageFormData({
        selected_card_id: null,
        submission_notes: ''
      })
      setPlayerCards([])
    }
  }, [player])

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

  const fetchPlayerCards = async () => {
    if (!player?.player_id) return
    try {
      setCardsLoading(true)
      const response = await axios.get(`/api/crowdsource/player/${player.player_id}/cards-with-images`)
      setPlayerCards(response.data.cards || [])
    } catch (err) {
      console.error('Error fetching player cards:', err)
    } finally {
      setCardsLoading(false)
    }
  }

  // Fetch cards when image tab is selected
  useEffect(() => {
    if (activeTab === 'image' && playerCards.length === 0 && player?.player_id) {
      fetchPlayerCards()
    }
  }, [activeTab, player?.player_id])

  const handleInfoFieldChange = (field, value) => {
    setInfoFormData(prev => ({ ...prev, [field]: value }))

    // Track if this field is different from original
    let originalValue
    switch (field) {
      case 'proposed_first_name':
        originalValue = player.first_name || ''
        break
      case 'proposed_last_name':
        originalValue = player.last_name || ''
        break
      case 'proposed_nick_name':
        originalValue = player.nick_name || ''
        break
      case 'proposed_birthdate':
        originalValue = player.birthdate ? new Date(player.birthdate).toISOString().split('T')[0] : ''
        break
      case 'proposed_is_hof':
        originalValue = player.is_hof || false
        break
      default:
        originalValue = ''
    }

    setInfoChangedFields(prev => ({
      ...prev,
      [field]: value !== originalValue
    }))
  }

  // Check which tabs have changes
  const hasInfoChanges = Object.values(infoChangedFields).some(changed => changed)
  const hasAliasChanges = aliasFormData.proposed_alias_name.trim().length > 0
  const hasTeamChanges = teamFormData.team_id !== null
  const hasImageChanges = imageFormData.selected_card_id !== null

  // Check if there are any changes across all tabs
  const hasAnyChanges = hasInfoChanges || hasAliasChanges || hasTeamChanges || hasImageChanges

  // Unified submit handler
  const handleSubmitAll = async () => {
    if (!hasAnyChanges) {
      showError('No changes detected. Please make at least one change.')
      return
    }

    setSubmitting(true)
    const results = { successes: [], errors: [] }
    let updatedPlayerData = { ...player }

    try {
      // Submit info changes if any
      if (hasInfoChanges) {
        try {
          const submissionData = { player_id: player.player_id }

          if (infoChangedFields.proposed_first_name) {
            submissionData.proposed_first_name = infoFormData.proposed_first_name
          }
          if (infoChangedFields.proposed_last_name) {
            submissionData.proposed_last_name = infoFormData.proposed_last_name
          }
          if (infoChangedFields.proposed_nick_name) {
            submissionData.proposed_nick_name = infoFormData.proposed_nick_name
          }
          if (infoChangedFields.proposed_birthdate) {
            submissionData.proposed_birthdate = infoFormData.proposed_birthdate
          }
          if (infoChangedFields.proposed_is_hof) {
            submissionData.proposed_is_hof = infoFormData.proposed_is_hof
          }

          if (infoFormData.submission_notes.trim()) {
            submissionData.submission_notes = infoFormData.submission_notes.trim()
          }

          const response = await axios.post('/api/crowdsource/player-edit', submissionData)

          if (response.data.auto_approved) {
            results.successes.push('Player info updated')
            if (infoChangedFields.proposed_first_name) {
              updatedPlayerData.first_name = infoFormData.proposed_first_name
            }
            if (infoChangedFields.proposed_last_name) {
              updatedPlayerData.last_name = infoFormData.proposed_last_name
            }
            if (infoChangedFields.proposed_nick_name) {
              updatedPlayerData.nick_name = infoFormData.proposed_nick_name
            }
            if (infoChangedFields.proposed_birthdate) {
              updatedPlayerData.birthdate = infoFormData.proposed_birthdate
            }
            if (infoChangedFields.proposed_is_hof) {
              updatedPlayerData.is_hof = infoFormData.proposed_is_hof
            }
          } else {
            results.successes.push('Player info submitted for review')
          }
        } catch (err) {
          console.error('Error submitting player info:', err)
          results.errors.push('Player info: ' + (err.response?.data?.message || 'Failed'))
        }
      }

      // Submit alias if any
      if (hasAliasChanges) {
        try {
          const submissionData = {
            player_id: player.player_id,
            proposed_alias_name: aliasFormData.proposed_alias_name.trim(),
            proposed_alias_type: aliasFormData.proposed_alias_type
          }

          if (aliasFormData.submission_notes.trim()) {
            submissionData.submission_notes = aliasFormData.submission_notes.trim()
          }

          await axios.post('/api/crowdsource/player-alias', submissionData)
          results.successes.push('Alias submitted for review')
        } catch (err) {
          console.error('Error submitting alias:', err)
          if (err.response?.data?.error === 'Duplicate') {
            results.errors.push('Alias: ' + err.response.data.message)
          } else {
            results.errors.push('Alias: ' + (err.response?.data?.message || 'Failed'))
          }
        }
      }

      // Submit team if any
      if (hasTeamChanges) {
        try {
          const submissionData = {
            player_id: player.player_id,
            team_id: teamFormData.team_id,
            action_type: teamFormData.action_type
          }

          if (teamFormData.submission_notes.trim()) {
            submissionData.submission_notes = teamFormData.submission_notes.trim()
          }

          await axios.post('/api/crowdsource/player-team', submissionData)
          results.successes.push('Team submitted for review')
        } catch (err) {
          console.error('Error submitting team:', err)
          if (err.response?.data?.error === 'Invalid action' || err.response?.data?.error === 'Duplicate') {
            results.errors.push('Team: ' + err.response.data.message)
          } else {
            results.errors.push('Team: ' + (err.response?.data?.message || 'Failed'))
          }
        }
      }

      // Submit image if any
      if (hasImageChanges) {
        try {
          const submissionData = {
            player_id: player.player_id,
            proposed_display_card: imageFormData.selected_card_id
          }

          if (imageFormData.submission_notes.trim()) {
            submissionData.submission_notes = imageFormData.submission_notes.trim()
          }

          const response = await axios.post('/api/crowdsource/player-edit', submissionData)

          if (response.data.auto_approved) {
            results.successes.push('Display image updated')
            const selectedCard = playerCards.find(c => c.card_id === imageFormData.selected_card_id)
            updatedPlayerData.display_card_front_image = selectedCard?.front_image_url
          } else {
            results.successes.push('Display image submitted for review')
          }
        } catch (err) {
          console.error('Error submitting display image:', err)
          results.errors.push('Display image: ' + (err.response?.data?.message || 'Failed'))
        }
      }

      // Show results
      if (results.successes.length > 0) {
        success(results.successes.join('. ') + '.')
      }
      if (results.errors.length > 0) {
        showError(results.errors.join('. ') + '.')
      }

      // Call onSuccess with updated data if we had any auto-approved changes
      if (results.successes.some(s => s.includes('updated'))) {
        onSuccess?.(updatedPlayerData)
      }

      // Close modal if all succeeded (or at least no errors)
      if (results.errors.length === 0) {
        onClose()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeletePlayer = async () => {
    if (!player) return

    setDeleting(true)

    try {
      await axios.delete(`/api/admin/players/${player.player_id}`)
      success(`Player "${player.first_name} ${player.last_name}" has been deleted`)
      const playerId = player.player_id
      if (onDeleteSuccess) {
        onDeleteSuccess(playerId)
      } else {
        onClose()
      }
    } catch (err) {
      console.error('Error deleting player:', err)
      showError(err.response?.data?.message || 'Failed to delete player')
      setDeleting(false)
    }
  }

  // Get current player team IDs
  const currentTeamIds = new Set((teams || []).map(t => t.team_id))

  // Filter teams - only show teams the player is NOT already on
  const filteredTeams = allTeams.filter(team => {
    const matchesSearch = teamSearch &&
      team.name.toLowerCase().includes(teamSearch.toLowerCase())

    // Only show teams player is NOT already on
    return matchesSearch && !currentTeamIds.has(team.team_id)
  })

  if (!isOpen) return null

  return (
    <div className="suggest-player-modal-overlay" onClick={onClose}>
      <div className="suggest-player-modal" onClick={e => e.stopPropagation()}>
        <div className="suggest-player-modal-header">
          <h2>
            <Icon name="user" size={20} />
            Suggest Player Update
          </h2>
          <button className="suggest-player-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="suggest-player-modal-player-info">
          <span className="suggest-player-name">{player?.first_name} {player?.last_name}</span>
          {player?.nick_name && <span className="suggest-player-nickname">"{player.nick_name}"</span>}
        </div>

        {/* Tabs with change indicators */}
        <div className="suggest-player-tabs">
          <button
            className={`suggest-player-tab ${activeTab === 'info' ? 'active' : ''}`}
            onClick={() => setActiveTab('info')}
          >
            <Icon name="edit" size={16} />
            Edit Info
            {hasInfoChanges && <span className="suggest-player-tab-badge" />}
          </button>
          <button
            className={`suggest-player-tab ${activeTab === 'alias' ? 'active' : ''}`}
            onClick={() => setActiveTab('alias')}
          >
            <Icon name="tag" size={16} />
            Add Alias
            {hasAliasChanges && <span className="suggest-player-tab-badge" />}
          </button>
          <button
            className={`suggest-player-tab ${activeTab === 'team' ? 'active' : ''}`}
            onClick={() => setActiveTab('team')}
          >
            <Icon name="users" size={16} />
            Teams
            {hasTeamChanges && <span className="suggest-player-tab-badge" />}
          </button>
          <button
            className={`suggest-player-tab ${activeTab === 'image' ? 'active' : ''}`}
            onClick={() => setActiveTab('image')}
          >
            <Icon name="image" size={16} />
            Image
            {hasImageChanges && <span className="suggest-player-tab-badge" />}
          </button>
        </div>

        {/* Tab Content */}
        <div className="suggest-player-tab-content">
          {/* Info Tab */}
          {activeTab === 'info' && (
            <div className="suggest-player-form">
              <div className="suggest-player-form-section">
                <h3>Player Information</h3>

                <div className="suggest-player-form-row">
                  <label>
                    First Name
                    {infoChangedFields.proposed_first_name && <span className="suggest-player-changed-indicator">Modified</span>}
                  </label>
                  <input
                    type="text"
                    value={infoFormData.proposed_first_name}
                    onChange={e => handleInfoFieldChange('proposed_first_name', e.target.value)}
                    placeholder="First name"
                  />
                </div>

                <div className="suggest-player-form-row">
                  <label>
                    Last Name
                    {infoChangedFields.proposed_last_name && <span className="suggest-player-changed-indicator">Modified</span>}
                  </label>
                  <input
                    type="text"
                    value={infoFormData.proposed_last_name}
                    onChange={e => handleInfoFieldChange('proposed_last_name', e.target.value)}
                    placeholder="Last name"
                  />
                </div>

                <div className="suggest-player-form-row">
                  <label>
                    Nickname
                    {infoChangedFields.proposed_nick_name && <span className="suggest-player-changed-indicator">Modified</span>}
                  </label>
                  <input
                    type="text"
                    value={infoFormData.proposed_nick_name}
                    onChange={e => handleInfoFieldChange('proposed_nick_name', e.target.value)}
                    placeholder="Optional nickname"
                  />
                </div>

                <div className="suggest-player-form-row">
                  <label>
                    Birthdate
                    {infoChangedFields.proposed_birthdate && <span className="suggest-player-changed-indicator">Modified</span>}
                  </label>
                  <input
                    type="date"
                    value={infoFormData.proposed_birthdate}
                    onChange={e => handleInfoFieldChange('proposed_birthdate', e.target.value)}
                  />
                </div>

                <div className="suggest-player-checkbox-group">
                  <label className={`suggest-player-checkbox ${infoChangedFields.proposed_is_hof ? 'changed' : ''}`}>
                    <input
                      type="checkbox"
                      checked={infoFormData.proposed_is_hof}
                      onChange={e => handleInfoFieldChange('proposed_is_hof', e.target.checked)}
                    />
                    <span className="suggest-player-checkbox-label">Hall of Fame</span>
                    {infoChangedFields.proposed_is_hof && <span className="suggest-player-changed-indicator">Modified</span>}
                  </label>
                </div>
              </div>

              <div className="suggest-player-form-section">
                <h3>Your Explanation</h3>
                <div className="suggest-player-form-row">
                  <label>Why should this be changed?</label>
                  <textarea
                    value={infoFormData.submission_notes}
                    onChange={e => setInfoFormData(prev => ({ ...prev, submission_notes: e.target.value }))}
                    placeholder="Help reviewers understand why you're suggesting this change. Include sources if available."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Alias Tab */}
          {activeTab === 'alias' && (
            <div className="suggest-player-form">
              <div className="suggest-player-form-section">
                <h3>Add Player Alias</h3>
                <p className="suggest-player-form-help">
                  Add alternate names or spellings for this player. This helps other collectors find this player even if the name is misspelled on a card.
                </p>

                <div className="suggest-player-form-row">
                  <label>Alias Name</label>
                  <input
                    type="text"
                    value={aliasFormData.proposed_alias_name}
                    onChange={e => setAliasFormData(prev => ({ ...prev, proposed_alias_name: e.target.value }))}
                    placeholder="e.g. Mike Trout, M. Trout, Trout Mike"
                  />
                </div>

                <div className="suggest-player-form-row">
                  <label>Alias Type</label>
                  <select
                    value={aliasFormData.proposed_alias_type}
                    onChange={e => setAliasFormData(prev => ({ ...prev, proposed_alias_type: e.target.value }))}
                  >
                    <option value="misspelling">Misspelling</option>
                    <option value="nickname">Nickname</option>
                    <option value="alternate_spelling">Alternate Spelling</option>
                    <option value="foreign_name">Foreign Name/Translation</option>
                    <option value="maiden_name">Maiden Name</option>
                  </select>
                </div>

                <div className="suggest-player-form-row">
                  <label>Explanation (optional)</label>
                  <textarea
                    value={aliasFormData.submission_notes}
                    onChange={e => setAliasFormData(prev => ({ ...prev, submission_notes: e.target.value }))}
                    placeholder="Where did you see this name? Which card set?"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Team Tab */}
          {activeTab === 'team' && (
            <div className="suggest-player-form">
              {/* Current Teams Display */}
              <div className="suggest-player-form-section">
                <h3>Current Teams</h3>
                {teams && teams.length > 0 ? (
                  <div className="suggest-player-current-teams">
                    {teams.map(team => (
                      <div key={team.team_id} className="suggest-player-current-team-item">
                        <div
                          className="suggest-player-team-circle"
                          style={{
                            '--primary-color': team.primary_color || '#333',
                            '--secondary-color': team.secondary_color || '#666'
                          }}
                        >
                          <div className="suggest-player-team-circle-inner">
                            <span>{team.abbreviation || team.name.substring(0, 3).toUpperCase()}</span>
                          </div>
                        </div>
                        <span className="suggest-player-current-team-name">{team.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="suggest-player-no-teams">No teams currently assigned</p>
                )}
              </div>

              {/* Add Team Section */}
              <div className="suggest-player-form-section">
                <h3>Add Team</h3>
                <p className="suggest-player-form-help">
                  Search for a team this player has played for that isn't listed above.
                </p>

                <div className="suggest-player-team-search-container">
                  <input
                    type="text"
                    value={teamSearch}
                    onChange={e => setTeamSearch(e.target.value)}
                    placeholder="Search teams..."
                  />

                  {/* Search Results - dropdown overlay */}
                  {teamSearch.trim().length > 0 && (
                    <div className="suggest-player-team-results">
                      {teamsLoading ? (
                        <div className="suggest-player-team-loading">Loading...</div>
                      ) : filteredTeams.length === 0 ? (
                        <div className="suggest-player-team-empty">No matching teams found</div>
                      ) : (
                        filteredTeams.slice(0, 8).map(team => (
                          <button
                            type="button"
                            key={team.team_id}
                            className={`suggest-player-team-result ${teamFormData.team_id === team.team_id ? 'selected' : ''}`}
                            onClick={() => {
                              setTeamFormData(prev => ({ ...prev, team_id: team.team_id, action_type: 'add' }))
                              setTeamSearch('')
                            }}
                          >
                            <div
                              className="suggest-player-team-circle"
                              style={{
                                '--primary-color': team.primary_color || '#333',
                                '--secondary-color': team.secondary_color || '#666'
                              }}
                            >
                              <div className="suggest-player-team-circle-inner">
                                <span>{team.abbreviation || team.name.substring(0, 3).toUpperCase()}</span>
                              </div>
                            </div>
                            <span className="suggest-player-team-result-name">{team.name}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>

                {/* Selected Team Display */}
                {teamFormData.team_id && (
                  <div className="suggest-player-selected-team">
                    {(() => {
                      const selectedTeam = allTeams.find(t => t.team_id === teamFormData.team_id)
                      if (!selectedTeam) return null
                      return (
                        <>
                          <div
                            className="suggest-player-team-circle"
                            style={{
                              '--primary-color': selectedTeam.primary_color || '#333',
                              '--secondary-color': selectedTeam.secondary_color || '#666'
                            }}
                          >
                            <div className="suggest-player-team-circle-inner">
                              <span>{selectedTeam.abbreviation || selectedTeam.name.substring(0, 3).toUpperCase()}</span>
                            </div>
                          </div>
                          <span className="suggest-player-selected-team-name">{selectedTeam.name}</span>
                          <button
                            type="button"
                            className="suggest-player-clear-selection"
                            onClick={() => setTeamFormData(prev => ({ ...prev, team_id: null }))}
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </>
                      )
                    })()}
                  </div>
                )}

                <div className="suggest-player-form-row">
                  <label>Explanation (optional)</label>
                  <textarea
                    value={teamFormData.submission_notes}
                    onChange={e => setTeamFormData(prev => ({ ...prev, submission_notes: e.target.value }))}
                    placeholder="When did they play for this team? Include years if known."
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Image Tab */}
          {activeTab === 'image' && (
            <div className="suggest-player-form">
              <div className="suggest-player-form-section">
                <h3>Select Display Image</h3>
                <p className="suggest-player-form-help">
                  Choose a card image to represent this player. This image will be shown on player listings and search results.
                </p>

                {cardsLoading ? (
                  <div className="suggest-player-cards-loading">
                    <span className="suggest-player-spinner"></span>
                    Loading cards with images...
                  </div>
                ) : playerCards.length === 0 ? (
                  <div className="suggest-player-no-cards">
                    <Icon name="image" size={24} />
                    <p>No cards with images available for this player.</p>
                  </div>
                ) : (
                  <div className="suggest-player-cards-grid">
                    {playerCards.map(card => (
                      <button
                        type="button"
                        key={card.card_id}
                        className={`suggest-player-card-option ${imageFormData.selected_card_id === card.card_id ? 'selected' : ''}`}
                        onClick={() => setImageFormData(prev => ({ ...prev, selected_card_id: card.card_id }))}
                      >
                        <img
                          src={card.front_image_url}
                          alt={`${card.series_year} ${card.series_name} #${card.card_number}`}
                          className="suggest-player-card-image"
                        />
                        <div className="suggest-player-card-info">
                          <span className="suggest-player-card-year">{card.series_year}</span>
                          <span className="suggest-player-card-series">{card.series_name}</span>
                          <span className="suggest-player-card-number">#{card.card_number}</span>
                        </div>
                        {imageFormData.selected_card_id === card.card_id && (
                          <div className="suggest-player-card-selected-badge">
                            <Icon name="check" size={16} />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="suggest-player-form-section">
                <div className="suggest-player-form-row">
                  <label>Explanation (optional)</label>
                  <textarea
                    value={imageFormData.submission_notes}
                    onChange={e => setImageFormData(prev => ({ ...prev, submission_notes: e.target.value }))}
                    placeholder="Why is this the best image for this player?"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Delete Warning Section - shows when delete button clicked */}
        {showDeleteConfirm && canDelete && (
          <div className="suggest-player-delete-section">
            <div className="suggest-player-delete-warning">
              <Icon name="alert-triangle" size={24} />
              <div className="suggest-player-delete-warning-content">
                <h4>Delete Player</h4>
                <p>
                  You are about to permanently delete the player:
                </p>
                <p className="suggest-player-delete-player-name">
                  <strong>{player?.first_name} {player?.last_name}</strong>
                  {player?.nick_name && <span> "{player.nick_name}"</span>}
                </p>
                <p>This will remove:</p>
                <ul>
                  <li>All team associations</li>
                  <li>All player aliases</li>
                  <li>All related submission history</li>
                </ul>
              </div>
            </div>
            <div className="suggest-player-delete-actions">
              <button
                type="button"
                className="suggest-player-cancel-btn"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="suggest-player-delete-confirm-btn"
                onClick={handleDeletePlayer}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <span className="suggest-player-spinner"></span>
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
        )}

        {/* Unified Form Actions - outside tab content */}
        {!showDeleteConfirm && (
          <div className="suggest-player-form-actions">
            {canDelete && (
              <button
                type="button"
                className="suggest-player-delete-btn"
                onClick={() => setShowDeleteConfirm(true)}
              >
                <Icon name="trash-2" size={16} />
                Delete
              </button>
            )}
            <div className="suggest-player-form-actions-right">
              <button type="button" onClick={onClose} className="suggest-player-cancel-btn">
                Cancel
              </button>
              <button
                type="button"
                className="suggest-player-submit-btn"
                onClick={handleSubmitAll}
                disabled={!hasAnyChanges || submitting}
              >
                {submitting ? (
                  <>
                    <span className="suggest-player-spinner"></span>
                    Submitting...
                  </>
                ) : (
                  <>
                    <Icon name="upload" size={16} />
                    Submit Changes
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Footer info banner */}
        <div className="suggest-player-info-banner">
          <Icon name="info" size={16} />
          <span>Your suggestion will be reviewed by our team. Approved changes help improve the database for everyone!</span>
        </div>
      </div>
    </div>
  )
}

export default SuggestPlayerEditModal
