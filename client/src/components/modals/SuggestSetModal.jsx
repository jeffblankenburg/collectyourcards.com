import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Icon from '../Icon'
import { useToast } from '../../contexts/ToastContext'
import './SuggestSetModalScoped.css'

function SuggestSetModal({ isOpen, onClose, onSuccess, preselectedYear = null }) {
  const { success, error: showError } = useToast()
  const [submitting, setSubmitting] = useState(false)

  const sports = ['Baseball', 'Football', 'Basketball', 'Hockey', 'Soccer', 'Other']
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: 100 }, (_, i) => currentYear - i)

  const [formData, setFormData] = useState({
    proposed_name: '',
    proposed_year: preselectedYear || currentYear,
    proposed_sport: 'Baseball',
    proposed_manufacturer: '',
    proposed_description: '',
    submission_notes: ''
  })

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setFormData({
        proposed_name: '',
        proposed_year: preselectedYear || currentYear,
        proposed_sport: 'Baseball',
        proposed_manufacturer: '',
        proposed_description: '',
        submission_notes: ''
      })
    }
  }, [isOpen, preselectedYear])

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  const isValid = () => {
    return formData.proposed_name.trim() && formData.proposed_year && formData.proposed_sport
  }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!isValid()) {
      showError('Please fill in all required fields.')
      return
    }

    setSubmitting(true)

    try {
      const submissionData = {
        name: formData.proposed_name.trim(),
        year: parseInt(formData.proposed_year),
        sport: formData.proposed_sport,
        manufacturer: formData.proposed_manufacturer.trim() || null,
        description: formData.proposed_description.trim() || null,
        submission_notes: formData.submission_notes.trim() || null
      }

      await axios.post('/api/crowdsource/set', submissionData)

      success('Set submission created! It will be reviewed by our team.')
      onSuccess?.()
      onClose()
    } catch (err) {
      console.error('Error submitting set:', err)
      if (err.response?.status === 429) {
        showError('Rate limit exceeded. Please try again later.')
      } else {
        showError(err.response?.data?.message || 'Failed to submit set. Please try again.')
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
            <Icon name="archive" size={20} />
            Submit New Set
          </h2>
          <button className="suggest-set-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="suggest-set-modal-intro">
          <Icon name="info" size={16} />
          <p>Suggest a new set that's missing from our database. Our team will review and add it if approved.</p>
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
              placeholder="e.g. Topps Chrome, Bowman Draft, Panini Prizm"
              required
            />
          </div>

          <div className="suggest-set-form-grid">
            <div className="suggest-set-form-row">
              <label>
                Year <span className="suggest-set-required">*</span>
              </label>
              <select
                value={formData.proposed_year}
                onChange={e => handleChange('proposed_year', e.target.value)}
                required
              >
                {years.map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
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
            <input
              type="text"
              value={formData.proposed_manufacturer}
              onChange={e => handleChange('proposed_manufacturer', e.target.value)}
              placeholder="e.g. Topps, Panini, Upper Deck"
            />
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
                  Submitting...
                </>
              ) : (
                <>
                  <Icon name="upload" size={16} />
                  Submit Set
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
