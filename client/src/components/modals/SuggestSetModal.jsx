import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Icon from '../Icon'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import './SuggestSetModalScoped.css'

function SuggestSetModal({ isOpen, onClose, onSuccess, preselectedYear = null, yearEditable = false, editSet = null }) {
  const { success, error: showError } = useToast()
  const { user } = useAuth()
  const [submitting, setSubmitting] = useState(false)
  const [manufacturers, setManufacturers] = useState([])
  const [manufacturersLoading, setManufacturersLoading] = useState(false)

  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)
  const isEditMode = !!editSet

  const sports = ['Baseball', 'Football', 'Basketball', 'Hockey', 'Soccer', 'Other']
  const currentYear = new Date().getFullYear()
  const minYear = 1887 // Earliest known sports card

  const [formData, setFormData] = useState({
    proposed_name: '',
    proposed_year: preselectedYear || currentYear,
    proposed_sport: 'Baseball',
    proposed_manufacturer: '',
    proposed_description: '',
    submission_notes: ''
  })

  // Fetch manufacturers when modal opens
  useEffect(() => {
    if (isOpen && manufacturers.length === 0) {
      fetchManufacturers()
    }
  }, [isOpen])

  const fetchManufacturers = async () => {
    try {
      setManufacturersLoading(true)
      const response = await axios.get('/api/manufacturers-list')
      setManufacturers(response.data.manufacturers || [])
    } catch (err) {
      console.error('Error fetching manufacturers:', err)
    } finally {
      setManufacturersLoading(false)
    }
  }

  // Determine sport from organization name
  const getSportFromOrganization = (orgName) => {
    if (!orgName) return 'Other'
    const name = orgName.toLowerCase()
    if (name.includes('baseball') || name.includes('mlb')) return 'Baseball'
    if (name.includes('football') || name.includes('nfl')) return 'Football'
    if (name.includes('basketball') || name.includes('nba')) return 'Basketball'
    if (name.includes('hockey') || name.includes('nhl')) return 'Hockey'
    if (name.includes('soccer') || name.includes('mls')) return 'Soccer'
    return 'Other'
  }

  // Initialize/reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (editSet) {
        // Edit mode - populate with existing set data
        const sport = getSportFromOrganization(editSet.organization_name || editSet.organization)
        setFormData({
          proposed_name: editSet.name || '',
          proposed_year: editSet.year || currentYear,
          proposed_sport: sport,
          proposed_manufacturer: editSet.manufacturer_name || editSet.manufacturer || '',
          proposed_description: '',
          submission_notes: ''
        })
      } else {
        // Create mode - reset to empty form
        setFormData({
          proposed_name: '',
          proposed_year: preselectedYear || currentYear,
          proposed_sport: 'Baseball',
          proposed_manufacturer: '',
          proposed_description: '',
          submission_notes: ''
        })
      }
    }
  }, [isOpen, preselectedYear, editSet])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const isValid = () => {
    const year = parseInt(formData.proposed_year)
    return formData.proposed_name.trim() &&
           year && year >= minYear && year <= currentYear + 2 &&
           formData.proposed_sport
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isValid()) {
      showError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)

    try {
      if (isEditMode) {
        // Edit existing set
        const submissionData = {
          set_id: editSet.set_id
        }

        // Only include fields that changed
        if (formData.proposed_name.trim() !== editSet.name) {
          submissionData.proposed_name = formData.proposed_name.trim()
        }
        if (parseInt(formData.proposed_year) !== editSet.year) {
          submissionData.proposed_year = parseInt(formData.proposed_year)
        }
        const currentSport = getSportFromOrganization(editSet.organization_name || editSet.organization)
        if (formData.proposed_sport !== currentSport) {
          submissionData.proposed_sport = formData.proposed_sport
        }
        const currentManufacturer = editSet.manufacturer_name || editSet.manufacturer || ''
        if (formData.proposed_manufacturer !== currentManufacturer) {
          submissionData.proposed_manufacturer = formData.proposed_manufacturer || null
        }
        if (formData.proposed_description.trim()) {
          submissionData.proposed_description = formData.proposed_description.trim()
        }
        if (formData.submission_notes.trim()) {
          submissionData.submission_notes = formData.submission_notes.trim()
        }

        const response = await axios.post('/api/crowdsource/set-edit', submissionData)

        if (response.data.auto_approved) {
          success('Set updated successfully!')
        } else {
          success('Set update submitted for review!')
        }
      } else {
        // Create new set
        const submissionData = {
          name: formData.proposed_name.trim(),
          year: parseInt(formData.proposed_year),
          sport: formData.proposed_sport
        }

        // Only include optional fields if they have values
        if (formData.proposed_manufacturer.trim()) {
          submissionData.manufacturer = formData.proposed_manufacturer.trim()
        }
        if (formData.proposed_description.trim()) {
          submissionData.description = formData.proposed_description.trim()
        }
        if (formData.submission_notes.trim()) {
          submissionData.submission_notes = formData.submission_notes.trim()
        }

        const response = await axios.post('/api/crowdsource/set', submissionData)

        if (response.data.auto_approved) {
          success('Set created successfully!')
        } else {
          success('Set submission created! It will be reviewed by our team.')
        }
      }

      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Error submitting set:', err)
      if (err.response?.status === 429) {
        showError('Rate limit exceeded. Please try again later.')
      } else {
        showError(err.response?.data?.message || 'Failed to submit. Please try again.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="suggest-set-modal-overlay" onClick={onClose}>
      <div className="suggest-set-modal" onClick={e => e.stopPropagation()}>
        <div className="suggest-set-modal-header">
          <h2>
            <Icon name="layers" size={20} />
            {isEditMode ? (isAdmin ? 'Edit Set' : 'Suggest Set Update') : 'Submit New Set'}
          </h2>
          <button className="suggest-set-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="suggest-set-modal-intro">
          <Icon name="info" size={16} />
          <p>
            {isEditMode
              ? (isAdmin
                ? 'Your changes will take effect immediately.'
                : "Suggest changes to this set. We'll review and apply them if approved.")
              : "Suggest a new set that's missing from our database. Our team will review and add it if approved."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="suggest-set-form">
          <div className="suggest-set-form-row">
            <label>
              Set Name <span className="suggest-set-required">*</span>
            </label>
            <input
              type="text"
              value={formData.proposed_name}
              onChange={e => handleChange('proposed_name', e.target.value)}
              placeholder="e.g. 2026 Topps Cosmic Chrome, 1952 Topps Football, 1986 Fleer Basketball"
              required
              autoFocus
            />
          </div>

          <div className="suggest-set-form-grid">
            <div className="suggest-set-form-row">
              <label>Year <span className="suggest-set-required">*</span></label>
              {yearEditable || !preselectedYear || isEditMode ? (
                <input
                  type="number"
                  value={formData.proposed_year}
                  onChange={e => handleChange('proposed_year', e.target.value)}
                  min={minYear}
                  max={currentYear + 2}
                  required
                />
              ) : (
                <div className="suggest-set-static-value">{formData.proposed_year}</div>
              )}
            </div>

            <div className="suggest-set-form-row">
              <label>
                Sport <span className="suggest-set-required">*</span>
              </label>
              <select
                value={formData.proposed_sport}
                onChange={e => handleChange('proposed_sport', e.target.value)}
                required
              >
                {sports.map(sport => (
                  <option key={sport} value={sport}>{sport}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="suggest-set-form-row">
            <label>Manufacturer</label>
            <select
              value={formData.proposed_manufacturer}
              onChange={e => handleChange('proposed_manufacturer', e.target.value)}
              disabled={manufacturersLoading}
            >
              <option value="">Select a manufacturer...</option>
              {manufacturers.map(mfr => (
                <option key={mfr.manufacturer_id} value={mfr.name}>{mfr.name}</option>
              ))}
            </select>
          </div>

          <div className="suggest-set-form-row">
            <label>Description</label>
            <textarea
              value={formData.proposed_description}
              onChange={e => handleChange('proposed_description', e.target.value)}
              placeholder="Optional description of the set (release date, notable features, etc.)"
              rows={3}
            />
          </div>

          <div className="suggest-set-form-row">
            <label>Additional Notes</label>
            <textarea
              value={formData.submission_notes}
              onChange={e => handleChange('submission_notes', e.target.value)}
              placeholder="Any additional information that would help reviewers (sources, links, etc.)"
              rows={2}
            />
          </div>

          <div className="suggest-set-form-actions">
            <button type="button" onClick={onClose} className="suggest-set-cancel-btn">
              Cancel
            </button>
            <button
              type="submit"
              className="suggest-set-submit-btn"
              disabled={!isValid() || submitting}
            >
              {submitting ? (
                <>
                  <span className="suggest-set-spinner"></span>
                  {isEditMode ? 'Saving...' : 'Submitting...'}
                </>
              ) : (
                <>
                  <Icon name={isEditMode ? 'check' : 'upload'} size={16} />
                  {isEditMode
                    ? (isAdmin ? 'Apply Changes' : 'Submit Changes')
                    : 'Submit Set'}
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default SuggestSetModal
