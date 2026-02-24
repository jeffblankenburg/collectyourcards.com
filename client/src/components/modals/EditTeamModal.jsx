import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './EditTeamModal.css'

function EditTeamModal({ team, isOpen, onClose, onSave, onDeleteSuccess }) {
  const [editForm, setEditForm] = useState({})
  const [organizations, setOrganizations] = useState([])
  const [saving, setSaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const { user } = useAuth()
  const { addToast } = useToast()

  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)
  const isSuperAdmin = user?.role === 'superadmin'

  useEffect(() => {
    if (isOpen && team) {
      setEditForm({
        name: team.name || '',
        city: team.city || '',
        mascot: team.mascot || '',
        abbreviation: team.abbreviation || '',
        organization_id: team.organization_id || team.organization || '',
        primary_color: team.primary_color || '#000000',
        secondary_color: team.secondary_color || '#FFFFFF'
      })

      loadOrganizations()
    }
  }, [isOpen, team])

  const loadOrganizations = async () => {
    try {
      const response = await axios.get('/api/teams-list/organizations')
      setOrganizations(response.data.organizations || [])
    } catch (error) {
      console.error('Error loading organizations:', error)
    }
  }

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = async () => {
    if (!team) return

    try {
      setSaving(true)

      // Build the updated team object to return
      const updatedTeamData = {
        team_id: team.team_id,
        name: editForm.name.trim(),
        city: editForm.city?.trim() || null,
        mascot: editForm.mascot?.trim() || null,
        abbreviation: editForm.abbreviation?.trim() || null,
        organization_id: editForm.organization_id ? Number(editForm.organization_id) : null,
        primary_color: editForm.primary_color || null,
        secondary_color: editForm.secondary_color || null,
        // Find org name/abbreviation from loaded organizations
        organization_name: organizations.find(o => o.organization_id === Number(editForm.organization_id))?.name || null,
        organization_abbreviation: organizations.find(o => o.organization_id === Number(editForm.organization_id))?.abbreviation || null
      }

      if (isAdmin) {
        // Admin: Use admin endpoint for direct updates
        await axios.put(`/api/admin/teams/${team.team_id}`, {
          name: editForm.name.trim(),
          city: editForm.city?.trim() || null,
          mascot: editForm.mascot?.trim() || null,
          abbreviation: editForm.abbreviation?.trim() || null,
          organization_id: editForm.organization_id || null,
          primary_color: editForm.primary_color || null,
          secondary_color: editForm.secondary_color || null
        })

        addToast('Team updated successfully', 'success')

        // Pass updated data back to parent
        if (onSave) {
          onSave(updatedTeamData)
        }
      } else {
        // Non-admin: Use crowdsource endpoint for suggested edits
        const submissionData = {
          team_id: team.team_id
        }

        // Only include changed fields
        if (editForm.name.trim() !== team.name) {
          submissionData.proposed_name = editForm.name.trim()
        }
        if ((editForm.city?.trim() || null) !== (team.city || null)) {
          submissionData.proposed_city = editForm.city?.trim() || null
        }
        if ((editForm.mascot?.trim() || null) !== (team.mascot || null)) {
          submissionData.proposed_mascot = editForm.mascot?.trim() || null
        }
        if ((editForm.abbreviation?.trim() || null) !== (team.abbreviation || null)) {
          submissionData.proposed_abbreviation = editForm.abbreviation?.trim() || null
        }
        if ((editForm.primary_color || null) !== (team.primary_color || null)) {
          submissionData.proposed_primary_color = editForm.primary_color || null
        }
        if ((editForm.secondary_color || null) !== (team.secondary_color || null)) {
          submissionData.proposed_secondary_color = editForm.secondary_color || null
        }

        const response = await axios.post('/api/crowdsource/team-edit', submissionData)

        if (response.data.auto_approved) {
          addToast('Team updated successfully', 'success')
          // Pass updated data back to parent
          if (onSave) {
            onSave(updatedTeamData)
          }
        } else {
          addToast('Team edit suggestion submitted! It will be reviewed by our team.', 'success')
          // Don't update UI for pending submissions
          if (onSave) {
            onSave(null)
          }
        }
      }

      onClose()
    } catch (error) {
      console.error('Error updating team:', error)
      addToast(error.response?.data?.message || 'Failed to update team', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setShowDeleteConfirm(false)
    onClose()
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
  }

  const handleDeleteConfirm = async () => {
    if (!team) return

    try {
      setDeleting(true)
      await axios.delete(`/api/admin/teams/${team.team_id}`)
      addToast(`Team "${team.name}" has been permanently deleted`, 'success')
      handleClose()
      if (onDeleteSuccess) {
        onDeleteSuccess(team.team_id)
      }
    } catch (error) {
      console.error('Error deleting team:', error)
      addToast(`Failed to delete team: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay" onClick={handleClose}>
      <div className="edit-team-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {isAdmin ? 'Edit Team' : 'Suggest Team Update'}
            {team && <> - {team.name}</>}
          </h3>
          <button
            className="close-btn"
            onClick={handleClose}
            type="button"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="edit-form">
            {/* Team Preview */}
            <div className="team-preview">
              <div
                className="team-circle-preview"
                style={{
                  backgroundColor: editForm.primary_color || '#666',
                  borderColor: editForm.secondary_color || '#999'
                }}
              >
                {editForm.abbreviation || '???'}
              </div>
            </div>

            {/* Team Details Form */}
            <div className="team-details-form">
              <div className="form-field-row">
                <label className="field-label">Team Name *</label>
                <input
                  type="text"
                  className="field-input"
                  value={editForm.name || ''}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g., New York Yankees"
                />
              </div>

              <div className="form-field-row">
                <label className="field-label">City</label>
                <input
                  type="text"
                  className="field-input"
                  value={editForm.city || ''}
                  onChange={(e) => handleFormChange('city', e.target.value)}
                  placeholder="e.g., New York"
                />
              </div>

              <div className="form-field-row">
                <label className="field-label">Mascot</label>
                <input
                  type="text"
                  className="field-input"
                  value={editForm.mascot || ''}
                  onChange={(e) => handleFormChange('mascot', e.target.value)}
                  placeholder="e.g., Yankees"
                />
              </div>

              <div className="form-field-row">
                <label className="field-label">Abbreviation</label>
                <input
                  type="text"
                  className="field-input"
                  value={editForm.abbreviation || ''}
                  onChange={(e) => handleFormChange('abbreviation', e.target.value.toUpperCase())}
                  placeholder="e.g., NYY"
                  maxLength={5}
                />
              </div>

              <div className="form-field-row">
                <label className="field-label">Organization</label>
                <select
                  className="field-input"
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

              <div className="form-field-row color-row">
                <div className="color-field">
                  <label className="field-label">Primary Color</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      className="color-picker"
                      value={editForm.primary_color || '#000000'}
                      onChange={(e) => handleFormChange('primary_color', e.target.value)}
                    />
                    <input
                      type="text"
                      className="color-text"
                      value={editForm.primary_color || ''}
                      onChange={(e) => handleFormChange('primary_color', e.target.value)}
                      placeholder="#000000"
                    />
                  </div>
                </div>
                <div className="color-field">
                  <label className="field-label">Secondary Color</label>
                  <div className="color-input-group">
                    <input
                      type="color"
                      className="color-picker"
                      value={editForm.secondary_color || '#FFFFFF'}
                      onChange={(e) => handleFormChange('secondary_color', e.target.value)}
                    />
                    <input
                      type="text"
                      className="color-text"
                      value={editForm.secondary_color || ''}
                      onChange={(e) => handleFormChange('secondary_color', e.target.value)}
                      placeholder="#FFFFFF"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Section - Admin only, when team has no players/cards */}
        {showDeleteConfirm && isAdmin && (
          <div className="edit-team-delete-section">
            <div className="edit-team-delete-warning">
              <Icon name="alert-triangle" size={24} />
              <div className="edit-team-delete-warning-content">
                <h4>Delete Team</h4>
                <p>
                  You are about to <strong>permanently delete</strong> the team "{team?.name}".
                </p>
                <p className="edit-team-delete-irreversible">
                  This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="edit-team-delete-actions">
              <button
                className="edit-team-delete-cancel"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="edit-team-delete-confirm"
                onClick={handleDeleteConfirm}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Icon name="trash-2" size={16} />
                    Delete Team
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <div className={`review-notice ${isAdmin ? 'admin' : ''}`}>
            <Icon name={isAdmin ? 'zap' : 'info'} size={14} />
            <span>
              {isAdmin
                ? 'Admin mode: Your changes will take effect immediately.'
                : "Thanks for helping improve our data! We'll review your changes and let you know when they're live."}
            </span>
          </div>
          <div className="modal-actions">
            {/* Delete button - only for admins when team has no players/cards and not in delete confirm mode */}
            {isAdmin && !showDeleteConfirm && team?.card_count === 0 && team?.player_count === 0 && (
              <button
                type="button"
                className="delete-btn"
                onClick={handleDeleteClick}
                disabled={saving}
              >
                <Icon name="trash-2" size={16} />
                Delete Team
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
                disabled={saving || showDeleteConfirm || !editForm.name?.trim()}
              >
                {saving ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    {isAdmin ? 'Applying...' : 'Submitting...'}
                  </>
                ) : (
                  isAdmin ? 'Apply Changes' : 'Submit Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EditTeamModal
