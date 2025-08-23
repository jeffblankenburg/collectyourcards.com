import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminTeams.css'

function AdminTeams() {
  const [teams, setTeams] = useState([])
  const [filteredTeams, setFilteredTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    city: '',
    mascot: '',
    abbreviation: '',
    primary_color: '',
    secondary_color: ''
  })
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    loadTeams()
  }, [])

  useEffect(() => {
    // Filter teams based on search term
    if (!searchTerm.trim()) {
      setFilteredTeams(teams)
    } else {
      const filtered = teams.filter(team => 
        team.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.mascot?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.abbreviation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.organization?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
      setFilteredTeams(filtered)
    }
  }, [teams, searchTerm])

  const loadTeams = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/teams')
      setTeams(response.data.teams || [])
    } catch (error) {
      console.error('Error loading teams:', error)
      addToast(`Failed to load teams: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleEditTeam = (team) => {
    setEditingTeam(team)
    setEditForm({
      name: team.name || '',
      city: team.city || '',
      mascot: team.mascot || '',
      abbreviation: team.abbreviation || '',
      primary_color: team.primary_color || '',
      secondary_color: team.secondary_color || ''
    })
    setShowEditModal(true)
  }

  const handleCloseModal = () => {
    setShowEditModal(false)
    setEditingTeam(null)
    setEditForm({
      name: '',
      city: '',
      mascot: '',
      abbreviation: '',
      primary_color: '',
      secondary_color: ''
    })
    setSaving(false)
  }

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSaveTeam = async () => {
    if (!editingTeam) return

    try {
      setSaving(true)
      
      const updateData = {
        name: editForm.name.trim(),
        city: editForm.city.trim(),
        mascot: editForm.mascot.trim(),
        abbreviation: editForm.abbreviation.trim(),
        primary_color: editForm.primary_color.trim(),
        secondary_color: editForm.secondary_color.trim()
      }

      const response = await axios.put(`/api/admin/teams/${editingTeam.team_id}`, updateData)
      
      // Update the teams list with the new data
      setTeams(prevTeams => 
        prevTeams.map(t => 
          t.team_id === editingTeam.team_id 
            ? { ...t, ...updateData }
            : t
        )
      )

      addToast('Team updated successfully', 'success')
      handleCloseModal()
      
    } catch (error) {
      console.error('Error updating team:', error)
      addToast(`Failed to update team: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getColorPreview = (color) => {
    if (!color) return null
    return (
      <div 
        className="color-preview" 
        style={{ backgroundColor: color }}
        title={color}
      />
    )
  }

  return (
    <div className="admin-teams-page">
      <div className="admin-header">
        <div className="admin-title">
          <Icon name="shield" size={32} />
          <h1>Team Administration</h1>
        </div>
        
        <div className="admin-stats">
          <div className="stat">
            <span className="stat-number">{teams.length}</span>
            <span className="stat-label">Total Teams</span>
          </div>
          <div className="stat">
            <span className="stat-number">{filteredTeams.length}</span>
            <span className="stat-label">Filtered</span>
          </div>
        </div>
      </div>

      <div className="admin-controls">
        <div className="search-box">
          <Icon name="search" size={20} />
          <input
            type="text"
            placeholder="Search teams by name, city, mascot, abbreviation, or organization..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="teams-content">
        {loading ? (
          <div className="loading-state">
            <Icon name="activity" size={24} className="spinning" />
            <span>Loading teams...</span>
          </div>
        ) : (
          <div className="teams-table">
            <div className="table-header">
              <div className="col-id">ID</div>
              <div className="col-name">Name</div>
              <div className="col-city">City</div>
              <div className="col-mascot">Mascot</div>
              <div className="col-abbrev">Abbrev</div>
              <div className="col-organization">Org</div>
              <div className="col-colors">Colors</div>
              <div className="col-cards">Cards</div>
              <div className="col-created">Created</div>
              <div className="col-actions">Actions</div>
            </div>
            
            {filteredTeams.map(team => (
              <div 
                key={team.team_id} 
                className="team-row"
                onDoubleClick={() => handleEditTeam(team)}
                title="Double-click to edit team"
              >
                <div className="col-id">{team.team_id}</div>
                <div className="col-name">
                  <div className="team-name">{team.name}</div>
                </div>
                <div className="col-city">{team.city}</div>
                <div className="col-mascot">{team.mascot}</div>
                <div className="col-abbrev">
                  {team.abbreviation && (
                    <span className="abbrev-badge">{team.abbreviation}</span>
                  )}
                </div>
                <div className="col-organization">{team.organization}</div>
                <div className="col-colors">
                  <div className="color-group">
                    {getColorPreview(team.primary_color)}
                    {getColorPreview(team.secondary_color)}
                  </div>
                </div>
                <div className="col-cards">{team.card_count || 0}</div>
                <div className="col-created">{formatDate(team.created)}</div>
                <div className="col-actions">
                  <button 
                    className="edit-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleEditTeam(team)
                    }}
                    title="Edit team"
                  >
                    <Icon name="edit" size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Team Modal */}
      {showEditModal && editingTeam && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-team-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Team</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                
                <div className="form-row">
                  <label className="form-label">ID</label>
                  <span className="form-value">{editingTeam.team_id}</span>
                </div>

                <div className="form-row">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.name}
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    placeholder="Team name"
                    required
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.city}
                    onChange={(e) => handleFormChange('city', e.target.value)}
                    placeholder="City"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Mascot</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.mascot}
                    onChange={(e) => handleFormChange('mascot', e.target.value)}
                    placeholder="Mascot"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Abbreviation</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.abbreviation}
                    onChange={(e) => handleFormChange('abbreviation', e.target.value)}
                    placeholder="e.g., NYY"
                    maxLength={5}
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Colors</label>
                  <div className="color-inputs">
                    <div className="color-field">
                      <div 
                        className="color-preview" 
                        style={{ backgroundColor: editForm.primary_color }}
                        onClick={() => document.getElementById('primary-color-picker').click()}
                        title="Primary color"
                      />
                      <input
                        id="primary-color-picker"
                        type="color"
                        style={{ display: 'none' }}
                        value={editForm.primary_color || '#000000'}
                        onChange={(e) => handleFormChange('primary_color', e.target.value)}
                      />
                      <input
                        type="text"
                        className="color-text-input"
                        value={editForm.primary_color || ''}
                        onChange={(e) => handleFormChange('primary_color', e.target.value)}
                        placeholder="#000000"
                        maxLength={7}
                      />
                    </div>
                    <div className="color-field">
                      <div 
                        className="color-preview" 
                        style={{ backgroundColor: editForm.secondary_color }}
                        onClick={() => document.getElementById('secondary-color-picker').click()}
                        title="Secondary color"
                      />
                      <input
                        id="secondary-color-picker"
                        type="color"
                        style={{ display: 'none' }}
                        value={editForm.secondary_color || '#000000'}
                        onChange={(e) => handleFormChange('secondary_color', e.target.value)}
                      />
                      <input
                        type="text"
                        className="color-text-input"
                        value={editForm.secondary_color || ''}
                        onChange={(e) => handleFormChange('secondary_color', e.target.value)}
                        placeholder="#000000"
                        maxLength={7}
                      />
                    </div>
                  </div>
                </div>
                
              </form>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleSaveTeam}
                disabled={saving}
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
    </div>
  )
}

export default AdminTeams