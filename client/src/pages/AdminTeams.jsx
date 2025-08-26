import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminTeams.css'

function AdminTeams() {
  const [teams, setTeams] = useState([])
  const [filteredTeams, setFilteredTeams] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [columnWidths, setColumnWidths] = useState({
    id: '80px',
    name: '2fr',
    city: '1.5fr',
    mascot: '1.5fr',
    abbreviation: '100px',
    organization: '1fr',
    colors: '120px',
    cards: '100px',
    actions: '100px'
  })
  const [showEditModal, setShowEditModal] = useState(false)
  const [showNewModal, setShowNewModal] = useState(false)
  const [editingTeam, setEditingTeam] = useState(null)
  const [editForm, setEditForm] = useState({
    name: '',
    city: '',
    mascot: '',
    abbreviation: '',
    organization_id: '',
    primary_color: '',
    secondary_color: ''
  })
  const [newTeamForm, setNewTeamForm] = useState({
    name: '',
    city: '',
    mascot: '',
    abbreviation: '',
    organization_id: '',
    primary_color: '',
    secondary_color: ''
  })
  const [saving, setSaving] = useState(false)
  const { addToast } = useToast()

  useEffect(() => {
    loadTeams()
    loadOrganizations()
  }, [])

  useEffect(() => {
    // Filter and sort teams
    let filtered = teams
    
    // Apply search filter
    if (searchTerm.trim()) {
      filtered = teams.filter(team => 
        team.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.mascot?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.abbreviation?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        team.organization?.toString().toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Apply sorting
    const sorted = [...filtered].sort((a, b) => {
      let aValue = a[sortField]
      let bValue = b[sortField]
      
      // Handle null/undefined values
      if (aValue == null) aValue = ''
      if (bValue == null) bValue = ''
      
      // Handle numeric fields
      if (sortField === 'team_id' || sortField === 'card_count') {
        aValue = Number(aValue) || 0
        bValue = Number(bValue) || 0
      } else {
        // Convert to string for comparison
        aValue = String(aValue).toLowerCase()
        bValue = String(bValue).toLowerCase()
      }
      
      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })
    
    setFilteredTeams(sorted)
  }, [teams, searchTerm, sortField, sortDirection])

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

  const loadOrganizations = async () => {
    try {
      const response = await axios.get('/api/admin/organizations')
      setOrganizations(response.data.organizations || [])
    } catch (error) {
      console.error('Error loading organizations:', error)
      addToast('Failed to load organizations', 'error')
    }
  }

  const handleEditTeam = (team) => {
    setEditingTeam(team)
    setEditForm({
      name: team.name || '',
      city: team.city || '',
      mascot: team.mascot || '',
      abbreviation: team.abbreviation || '',
      organization_id: team.organization_id || '',
      primary_color: team.primary_color || '',
      secondary_color: team.secondary_color || ''
    })
    setShowEditModal(true)
  }

  const handleNewTeam = () => {
    setNewTeamForm({
      name: '',
      city: '',
      mascot: '',
      abbreviation: '',
      organization_id: '',
      primary_color: '',
      secondary_color: ''
    })
    setShowNewModal(true)
  }

  const handleCloseModal = () => {
    setShowEditModal(false)
    setShowNewModal(false)
    setEditingTeam(null)
    setEditForm({
      name: '',
      city: '',
      mascot: '',
      abbreviation: '',
      organization_id: '',
      primary_color: '',
      secondary_color: ''
    })
    setNewTeamForm({
      name: '',
      city: '',
      mascot: '',
      abbreviation: '',
      organization_id: '',
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

  const handleNewTeamFormChange = (field, value) => {
    setNewTeamForm(prev => ({
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
        organization_id: editForm.organization_id || null,
        primary_color: editForm.primary_color.trim(),
        secondary_color: editForm.secondary_color.trim()
      }

      const response = await axios.put(`/api/admin/teams/${editingTeam.team_id}`, updateData)
      
      // Find the organization abbreviation from the organizations list
      const selectedOrg = organizations.find(org => org.organization_id === parseInt(updateData.organization_id))
      const updatedTeam = {
        ...updateData,
        organization: selectedOrg ? selectedOrg.abbreviation : ''
      }
      
      // Update the teams list with the new data
      setTeams(prevTeams => 
        prevTeams.map(t => 
          t.team_id === editingTeam.team_id 
            ? { ...t, ...updatedTeam }
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

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleColumnResize = (column, newWidth) => {
    setColumnWidths(prev => ({
      ...prev,
      [column]: `${Math.max(50, newWidth)}px` // Convert to px and set minimum width of 50px
    }))
  }

  const handleResizeStart = (e, column) => {
    e.preventDefault()
    e.stopPropagation()
    
    const startX = e.clientX
    // Get the actual rendered width of the column element
    const columnElement = e.target.closest('.col-header')
    const startWidth = columnElement ? columnElement.offsetWidth : 100
    
    const handleMouseMove = (e) => {
      const diff = e.clientX - startX
      const newWidth = startWidth + diff
      handleColumnResize(column, newWidth)
    }
    
    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  const handleCreateTeam = async () => {
    try {
      setSaving(true)
      
      const newTeamData = {
        name: newTeamForm.name.trim(),
        city: newTeamForm.city.trim(),
        mascot: newTeamForm.mascot.trim(),
        abbreviation: newTeamForm.abbreviation.trim(),
        organization_id: newTeamForm.organization_id || null,
        primary_color: newTeamForm.primary_color.trim(),
        secondary_color: newTeamForm.secondary_color.trim()
      }

      // Validate required fields
      if (!newTeamData.name || !newTeamData.abbreviation || !newTeamData.organization_id) {
        addToast('Team name, abbreviation, and organization are required', 'error')
        return
      }

      const response = await axios.post('/api/admin/teams', newTeamData)
      
      // Find the organization abbreviation from the organizations list
      const selectedOrg = organizations.find(org => org.organization_id === parseInt(newTeamData.organization_id))
      const newTeam = {
        ...response.data.team,
        organization: selectedOrg ? selectedOrg.abbreviation : ''
      }
      
      // Add the new team to the list
      setTeams(prevTeams => [...prevTeams, newTeam])

      addToast('Team created successfully', 'success')
      handleCloseModal()
      
    } catch (error) {
      console.error('Error creating team:', error)
      addToast(`Failed to create team: ${error.response?.data?.message || error.message}`, 'error')
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
          <h1>{teams.length} Teams</h1>
        </div>

        <div className="admin-controls">
          <button 
            className="new-item-button"
            onClick={handleNewTeam}
            title="Add new team"
          >
            <Icon name="plus" size={24} />
          </button>
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
      </div>

      <div className="teams-content">
        {loading ? (
          <div className="loading-state">
            <Icon name="activity" size={24} className="spinning" />
            <span>Loading teams...</span>
          </div>
        ) : (
          <div className="teams-table">
            <div className="table-header" style={{
              gridTemplateColumns: `${columnWidths.id} ${columnWidths.name} ${columnWidths.city} ${columnWidths.mascot} ${columnWidths.abbreviation} ${columnWidths.organization} ${columnWidths.colors} ${columnWidths.cards} ${columnWidths.actions}`
            }}>
              <div className="col-header sortable" onClick={() => handleSort('team_id')}>
                ID
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'id')} />
              </div>
              <div className="col-header sortable" onClick={() => handleSort('name')}>
                Name
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'name')} />
              </div>
              <div className="col-header sortable" onClick={() => handleSort('city')}>
                City
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'city')} />
              </div>
              <div className="col-header sortable" onClick={() => handleSort('mascot')}>
                Mascot
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'mascot')} />
              </div>
              <div className="col-header sortable" onClick={() => handleSort('abbreviation')}>
                Abbrev
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'abbreviation')} />
              </div>
              <div className="col-header sortable" onClick={() => handleSort('organization')}>
                Org
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'organization')} />
              </div>
              <div className="col-header sortable" onClick={() => handleSort('primary_color')}>
                Colors
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'colors')} />
              </div>
              <div className="col-header sortable" onClick={() => handleSort('card_count')}>
                Cards
                <div className="resize-handle" onMouseDown={(e) => handleResizeStart(e, 'cards')} />
              </div>
              <div className="col-header">
                Actions
              </div>
            </div>
            
            {filteredTeams.map(team => (
              <div 
                key={team.team_id} 
                className="team-row"
                style={{
                  gridTemplateColumns: `${columnWidths.id} ${columnWidths.name} ${columnWidths.city} ${columnWidths.mascot} ${columnWidths.abbreviation} ${columnWidths.organization} ${columnWidths.colors} ${columnWidths.cards} ${columnWidths.actions}`
                }}
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
              <h3>Edit Team #{editingTeam.team_id}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                

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
                  <label className="form-label">Organization</label>
                  <select
                    className="form-select"
                    value={editForm.organization_id || ''}
                    onChange={(e) => handleFormChange('organization_id', e.target.value)}
                  >
                    <option value="">Select organization...</option>
                    {organizations.map(org => (
                      <option key={org.organization_id} value={org.organization_id}>
                        {org.name} ({org.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label className="form-label">Team Colors</label>
                  <div className="color-inputs">
                    <div className="color-field">
                      <label className="color-field-label">Darker Color</label>
                      <div className="color-field-controls">
                        <div 
                          className="color-preview" 
                          style={{ backgroundColor: editForm.primary_color }}
                          onClick={() => document.getElementById('primary-color-picker').click()}
                          title="Primary (darker) color"
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
                    </div>
                    <div className="color-field">
                      <label className="color-field-label">Lighter Color</label>
                      <div className="color-field-controls">
                        <div 
                          className="color-preview" 
                          style={{ backgroundColor: editForm.secondary_color }}
                          onClick={() => document.getElementById('secondary-color-picker').click()}
                          title="Secondary (lighter) color"
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
                  'Save Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Team Modal */}
      {showNewModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-team-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>New Team</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                
                <div className="form-row">
                  <label className="form-label">Name *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newTeamForm.name}
                    onChange={(e) => handleNewTeamFormChange('name', e.target.value)}
                    placeholder="Team name"
                    required
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">City</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newTeamForm.city}
                    onChange={(e) => handleNewTeamFormChange('city', e.target.value)}
                    placeholder="City"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Mascot</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newTeamForm.mascot}
                    onChange={(e) => handleNewTeamFormChange('mascot', e.target.value)}
                    placeholder="Mascot"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Abbreviation *</label>
                  <input
                    type="text"
                    className="form-input"
                    value={newTeamForm.abbreviation}
                    onChange={(e) => handleNewTeamFormChange('abbreviation', e.target.value)}
                    placeholder="e.g., NYY"
                    maxLength={5}
                    required
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Organization *</label>
                  <select
                    className="form-select"
                    value={newTeamForm.organization_id || ''}
                    onChange={(e) => handleNewTeamFormChange('organization_id', e.target.value)}
                  >
                    <option value="">Select organization...</option>
                    {organizations.map(org => (
                      <option key={org.organization_id} value={org.organization_id}>
                        {org.name} ({org.abbreviation})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-row">
                  <label className="form-label">Team Colors</label>
                  <div className="color-inputs">
                    <div className="color-field">
                      <label className="color-field-label">Darker Color</label>
                      <div className="color-field-controls">
                        <div 
                          className="color-preview" 
                          style={{ backgroundColor: newTeamForm.primary_color }}
                          onClick={() => document.getElementById('new-primary-color-picker').click()}
                          title="Primary (darker) color"
                        />
                        <input
                          id="new-primary-color-picker"
                          type="color"
                          style={{ display: 'none' }}
                          value={newTeamForm.primary_color || '#000000'}
                          onChange={(e) => handleNewTeamFormChange('primary_color', e.target.value)}
                        />
                        <input
                          type="text"
                          className="color-text-input"
                          value={newTeamForm.primary_color || ''}
                          onChange={(e) => handleNewTeamFormChange('primary_color', e.target.value)}
                          placeholder="#000000"
                          maxLength={7}
                        />
                      </div>
                    </div>
                    <div className="color-field">
                      <label className="color-field-label">Lighter Color</label>
                      <div className="color-field-controls">
                        <div 
                          className="color-preview" 
                          style={{ backgroundColor: newTeamForm.secondary_color }}
                          onClick={() => document.getElementById('new-secondary-color-picker').click()}
                          title="Secondary (lighter) color"
                        />
                        <input
                          id="new-secondary-color-picker"
                          type="color"
                          style={{ display: 'none' }}
                          value={newTeamForm.secondary_color || '#000000'}
                          onChange={(e) => handleNewTeamFormChange('secondary_color', e.target.value)}
                        />
                        <input
                          type="text"
                          className="color-text-input"
                          value={newTeamForm.secondary_color || ''}
                          onChange={(e) => handleNewTeamFormChange('secondary_color', e.target.value)}
                          placeholder="#000000"
                          maxLength={7}
                        />
                      </div>
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
                onClick={handleCreateTeam}
                disabled={saving || !newTeamForm.name.trim() || !newTeamForm.abbreviation.trim() || !newTeamForm.organization_id}
              >
                {saving ? (
                  <>
                    <Icon name="activity" size={16} className="spinning" />
                    Creating...
                  </>
                ) : (
                  'Create Team'
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