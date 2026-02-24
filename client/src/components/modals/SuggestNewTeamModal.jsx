import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './SuggestNewTeamModal.css'

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

function SuggestNewTeamModal({ isOpen, onClose, onSuccess, preSelectedOrganization = null }) {
  const { user } = useAuth()
  const { addToast } = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [organizations, setOrganizations] = useState([])
  const [organizationsLoading, setOrganizationsLoading] = useState(false)

  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  // Form state
  const [formData, setFormData] = useState({
    proposed_name: '',
    proposed_city: '',
    proposed_mascot: '',
    proposed_abbreviation: '',
    proposed_organization_id: null,
    proposed_primary_color: '#333333',
    proposed_secondary_color: '#666666',
    submission_notes: ''
  })

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setFormData({
        proposed_name: '',
        proposed_city: '',
        proposed_mascot: '',
        proposed_abbreviation: '',
        proposed_organization_id: preSelectedOrganization?.organization_id || null,
        proposed_primary_color: '#333333',
        proposed_secondary_color: '#666666',
        submission_notes: ''
      })
    }
  }, [isOpen, preSelectedOrganization])

  // Fetch organizations when modal opens
  useEffect(() => {
    if (isOpen && organizations.length === 0) {
      fetchOrganizations()
    }
  }, [isOpen])

  const fetchOrganizations = async () => {
    try {
      setOrganizationsLoading(true)
      const response = await axios.get('/api/teams-list/organizations')
      setOrganizations(response.data.organizations || [])
    } catch (err) {
      console.error('Error fetching organizations:', err)
    } finally {
      setOrganizationsLoading(false)
    }
  }

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.proposed_name.trim()) {
      addToast('Team name is required', 'error')
      return
    }

    setSubmitting(true)

    try {
      const submissionData = {
        proposed_name: formData.proposed_name.trim()
      }

      if (formData.proposed_city.trim()) {
        submissionData.proposed_city = formData.proposed_city.trim()
      }

      if (formData.proposed_mascot.trim()) {
        submissionData.proposed_mascot = formData.proposed_mascot.trim()
      }

      if (formData.proposed_abbreviation.trim()) {
        submissionData.proposed_abbreviation = formData.proposed_abbreviation.trim().toUpperCase()
      }

      if (formData.proposed_organization_id) {
        submissionData.proposed_organization_id = formData.proposed_organization_id
      }

      if (formData.proposed_primary_color && formData.proposed_primary_color !== '#333333') {
        submissionData.proposed_primary_color = formData.proposed_primary_color
      }

      if (formData.proposed_secondary_color && formData.proposed_secondary_color !== '#666666') {
        submissionData.proposed_secondary_color = formData.proposed_secondary_color
      }

      if (formData.submission_notes.trim()) {
        submissionData.submission_notes = formData.submission_notes.trim()
      }

      const response = await axios.post('/api/crowdsource/team', submissionData)

      if (response.data.auto_approved) {
        addToast(`${formData.proposed_name} added to database!`, 'success')
        if (onSuccess) {
          onSuccess({
            team_id: response.data.team_id,
            name: formData.proposed_name.trim(),
            city: formData.proposed_city?.trim() || null,
            mascot: formData.proposed_mascot?.trim() || null,
            abbreviation: formData.proposed_abbreviation?.trim()?.toUpperCase() || null,
            organization: formData.proposed_organization_id,
            primary_color: formData.proposed_primary_color,
            secondary_color: formData.proposed_secondary_color
          })
        }
      } else {
        addToast('New team suggestion submitted for review!', 'success')
      }

      onClose()
    } catch (err) {
      console.error('Error submitting new team:', err)
      if (err.response?.data?.error === 'Duplicate') {
        addToast(err.response.data.message, 'error')
      } else {
        addToast(err.response?.data?.message || 'Failed to submit new team suggestion', 'error')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="suggest-new-team-modal-overlay" onClick={onClose}>
      <div className="suggest-new-team-modal" onClick={e => e.stopPropagation()}>
        <div className="suggest-new-team-modal-header">
          <h2>
            <Icon name="shield" size={20} />
            {isAdmin ? 'Add New Team' : 'Suggest New Team'}
          </h2>
          <button className="suggest-new-team-modal-close" onClick={onClose} type="button">
            <Icon name="x" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="suggest-new-team-form">
          <div className="suggest-new-team-modal-content">
            {/* Team Info Section */}
            <div className="suggest-new-team-form-section">
              <h3>Team Information</h3>

              <div className="suggest-new-team-form-row">
                <label>Team Name *</label>
                <input
                  type="text"
                  value={formData.proposed_name}
                  onChange={e => handleFieldChange('proposed_name', e.target.value)}
                  placeholder="Full team name (e.g., 'New York Yankees')"
                  required
                  autoFocus
                />
              </div>

              <div className="suggest-new-team-form-row-group">
                <div className="suggest-new-team-form-row">
                  <label>City</label>
                  <input
                    type="text"
                    value={formData.proposed_city}
                    onChange={e => handleFieldChange('proposed_city', e.target.value)}
                    placeholder="City (e.g., 'New York')"
                  />
                </div>

                <div className="suggest-new-team-form-row">
                  <label>Mascot</label>
                  <input
                    type="text"
                    value={formData.proposed_mascot}
                    onChange={e => handleFieldChange('proposed_mascot', e.target.value)}
                    placeholder="Mascot (e.g., 'Yankees')"
                  />
                </div>
              </div>

              <div className="suggest-new-team-form-row-group">
                <div className="suggest-new-team-form-row">
                  <label>Abbreviation</label>
                  <input
                    type="text"
                    value={formData.proposed_abbreviation}
                    onChange={e => handleFieldChange('proposed_abbreviation', e.target.value.toUpperCase())}
                    placeholder="e.g., 'NYY'"
                    maxLength={10}
                    style={{ textTransform: 'uppercase' }}
                  />
                </div>

                <div className="suggest-new-team-form-row">
                  <label>Organization</label>
                  <select
                    value={formData.proposed_organization_id || ''}
                    onChange={e => handleFieldChange('proposed_organization_id', e.target.value ? parseInt(e.target.value) : null)}
                    disabled={organizationsLoading}
                  >
                    <option value="">Select organization...</option>
                    {organizations.map(org => (
                      <option key={org.organization_id} value={org.organization_id}>
                        {org.name} {org.abbreviation ? `(${org.abbreviation})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Colors Section */}
            <div className="suggest-new-team-form-section">
              <h3>Team Colors</h3>
              <p className="suggest-new-team-form-help">
                Select the primary and secondary colors for this team.
              </p>

              <div className="suggest-new-team-form-row-group">
                <div className="suggest-new-team-form-row">
                  <label>Primary Color</label>
                  <div className="suggest-new-team-color-picker">
                    <input
                      type="color"
                      value={formData.proposed_primary_color}
                      onChange={e => handleFieldChange('proposed_primary_color', e.target.value)}
                    />
                    <input
                      type="text"
                      value={formData.proposed_primary_color}
                      onChange={e => {
                        const val = e.target.value
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                          handleFieldChange('proposed_primary_color', val)
                        }
                      }}
                      placeholder="#000000"
                      className="suggest-new-team-color-input"
                    />
                  </div>
                </div>

                <div className="suggest-new-team-form-row">
                  <label>Secondary Color</label>
                  <div className="suggest-new-team-color-picker">
                    <input
                      type="color"
                      value={formData.proposed_secondary_color}
                      onChange={e => handleFieldChange('proposed_secondary_color', e.target.value)}
                    />
                    <input
                      type="text"
                      value={formData.proposed_secondary_color}
                      onChange={e => {
                        const val = e.target.value
                        if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                          handleFieldChange('proposed_secondary_color', val)
                        }
                      }}
                      placeholder="#000000"
                      className="suggest-new-team-color-input"
                    />
                  </div>
                </div>
              </div>

              {/* Preview */}
              <div className="suggest-new-team-preview">
                <label>Preview:</label>
                <div
                  className="suggest-new-team-preview-circle"
                  style={{
                    backgroundColor: formData.proposed_primary_color || '#333',
                    borderColor: formData.proposed_secondary_color || '#666',
                    color: getContrastColor(formData.proposed_primary_color)
                  }}
                >
                  <span>{formData.proposed_abbreviation || 'ABC'}</span>
                </div>
              </div>
            </div>

            {/* Notes Section */}
            <div className="suggest-new-team-form-section">
              <h3>Additional Notes</h3>
              <div className="suggest-new-team-form-row">
                <label>Why should this team be added?</label>
                <textarea
                  value={formData.submission_notes}
                  onChange={e => handleFieldChange('submission_notes', e.target.value)}
                  placeholder="Include any relevant information like sport, league, years active, or where you found cards of this team."
                  rows={3}
                />
              </div>
            </div>
          </div>

          <div className="suggest-new-team-modal-footer">
            <div className={`suggest-new-team-info-banner ${isAdmin ? 'admin' : ''}`}>
              <Icon name={isAdmin ? 'zap' : 'info'} size={14} />
              <span>
                {isAdmin
                  ? 'Admin mode: The team will be added immediately.'
                  : 'Your suggestion will be reviewed by our team. Thank you for helping improve our database!'}
              </span>
            </div>
            <div className="suggest-new-team-form-actions">
              <button type="button" onClick={onClose} className="suggest-new-team-cancel-btn" disabled={submitting}>
                Cancel
              </button>
              <button
                type="submit"
                className="suggest-new-team-submit-btn"
                disabled={!formData.proposed_name.trim() || submitting}
              >
                {submitting ? (
                  <>
                    <div className="suggest-new-team-spinner"></div>
                    {isAdmin ? 'Adding...' : 'Submitting...'}
                  </>
                ) : (
                  <>
                    <Icon name="shield" size={16} />
                    {isAdmin ? 'Add Team' : 'Submit Suggestion'}
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

export default SuggestNewTeamModal
