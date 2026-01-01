import React, { useState, useEffect } from 'react'
import axios from 'axios'
import Icon from '../Icon'
import { useToast } from '../../contexts/ToastContext'
import './SuggestEditModalScoped.css'

function SuggestEditModal({ isOpen, onClose, card }) {
  const { success, error: showError } = useToast()
  const [submitting, setSubmitting] = useState(false)

  // Form state - null means "no change proposed"
  const [formData, setFormData] = useState({
    proposed_card_number: '',
    proposed_is_rookie: null,
    proposed_is_autograph: null,
    proposed_is_relic: null,
    proposed_is_short_print: null,
    proposed_print_run: '',
    proposed_notes: '',
    submission_notes: ''
  })

  // Track which fields have been changed
  const [changedFields, setChangedFields] = useState({})

  // Reset form when card changes
  useEffect(() => {
    if (card) {
      setFormData({
        proposed_card_number: card.card_number || '',
        proposed_is_rookie: card.is_rookie || false,
        proposed_is_autograph: card.is_autograph || false,
        proposed_is_relic: card.is_relic || false,
        proposed_is_short_print: card.is_short_print || false,
        proposed_print_run: card.print_run || '',
        proposed_notes: card.notes || '',
        submission_notes: ''
      })
      setChangedFields({})
    }
  }, [card])

  const handleFieldChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))

    // Track if this field is different from original
    let originalValue
    switch (field) {
      case 'proposed_card_number':
        originalValue = card.card_number || ''
        break
      case 'proposed_is_rookie':
        originalValue = card.is_rookie || false
        break
      case 'proposed_is_autograph':
        originalValue = card.is_autograph || false
        break
      case 'proposed_is_relic':
        originalValue = card.is_relic || false
        break
      case 'proposed_is_short_print':
        originalValue = card.is_short_print || false
        break
      case 'proposed_print_run':
        originalValue = card.print_run || ''
        break
      case 'proposed_notes':
        originalValue = card.notes || ''
        break
      default:
        originalValue = ''
    }

    setChangedFields(prev => ({
      ...prev,
      [field]: value !== originalValue
    }))
  }

  const hasChanges = Object.values(changedFields).some(changed => changed)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!hasChanges) {
      showError('No changes detected. Please modify at least one field.')
      return
    }

    setSubmitting(true)

    try {
      // Build submission data - only include changed fields
      const submissionData = {
        card_id: card.card_id
      }

      if (changedFields.proposed_card_number) {
        submissionData.proposed_card_number = formData.proposed_card_number
      }
      if (changedFields.proposed_is_rookie) {
        submissionData.proposed_is_rookie = formData.proposed_is_rookie
      }
      if (changedFields.proposed_is_autograph) {
        submissionData.proposed_is_autograph = formData.proposed_is_autograph
      }
      if (changedFields.proposed_is_relic) {
        submissionData.proposed_is_relic = formData.proposed_is_relic
      }
      if (changedFields.proposed_is_short_print) {
        submissionData.proposed_is_short_print = formData.proposed_is_short_print
      }
      if (changedFields.proposed_print_run) {
        submissionData.proposed_print_run = formData.proposed_print_run ? parseInt(formData.proposed_print_run) : null
      }
      if (changedFields.proposed_notes) {
        submissionData.proposed_notes = formData.proposed_notes
      }

      // Always include submission notes if provided
      if (formData.submission_notes.trim()) {
        submissionData.submission_notes = formData.submission_notes.trim()
      }

      await axios.post('/api/crowdsource/card-edit', submissionData)

      success('Edit suggestion submitted! It will be reviewed by our team.')
      onClose()
    } catch (err) {
      console.error('Error submitting edit:', err)
      if (err.response?.status === 409) {
        showError('You already have a pending edit for this card.')
      } else {
        showError(err.response?.data?.message || 'Failed to submit edit suggestion.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="suggest-edit-modal-overlay" onClick={onClose}>
      <div className="suggest-edit-modal" onClick={e => e.stopPropagation()}>
        <div className="suggest-edit-modal-header">
          <h2>
            <Icon name="edit" size={20} />
            Suggest Edit
          </h2>
          <button className="suggest-edit-modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="suggest-edit-modal-card-info">
          <span className="suggest-edit-card-number">#{card?.card_number}</span>
          <span className="suggest-edit-card-player">{card?.player_names}</span>
          <span className="suggest-edit-card-series">{card?.series_name}</span>
        </div>

        <form onSubmit={handleSubmit} className="suggest-edit-form">
          <div className="suggest-edit-form-section">
            <h3>Card Details</h3>

            <div className="suggest-edit-form-row">
              <label>
                Card Number
                {changedFields.proposed_card_number && <span className="suggest-edit-changed-indicator">Modified</span>}
              </label>
              <input
                type="text"
                value={formData.proposed_card_number}
                onChange={e => handleFieldChange('proposed_card_number', e.target.value)}
                placeholder="e.g. 123, 123a, RC-5"
              />
            </div>

            <div className="suggest-edit-form-row">
              <label>
                Print Run
                {changedFields.proposed_print_run && <span className="suggest-edit-changed-indicator">Modified</span>}
              </label>
              <input
                type="number"
                value={formData.proposed_print_run}
                onChange={e => handleFieldChange('proposed_print_run', e.target.value)}
                placeholder="e.g. 99, 199, 500"
                min="1"
              />
            </div>

            <div className="suggest-edit-checkbox-group">
              <label className={`suggest-edit-checkbox ${changedFields.proposed_is_rookie ? 'changed' : ''}`}>
                <input
                  type="checkbox"
                  checked={formData.proposed_is_rookie}
                  onChange={e => handleFieldChange('proposed_is_rookie', e.target.checked)}
                />
                <span className="suggest-edit-checkbox-label">Rookie Card (RC)</span>
                {changedFields.proposed_is_rookie && <span className="suggest-edit-changed-indicator">Modified</span>}
              </label>

              <label className={`suggest-edit-checkbox ${changedFields.proposed_is_autograph ? 'changed' : ''}`}>
                <input
                  type="checkbox"
                  checked={formData.proposed_is_autograph}
                  onChange={e => handleFieldChange('proposed_is_autograph', e.target.checked)}
                />
                <span className="suggest-edit-checkbox-label">Autograph</span>
                {changedFields.proposed_is_autograph && <span className="suggest-edit-changed-indicator">Modified</span>}
              </label>

              <label className={`suggest-edit-checkbox ${changedFields.proposed_is_relic ? 'changed' : ''}`}>
                <input
                  type="checkbox"
                  checked={formData.proposed_is_relic}
                  onChange={e => handleFieldChange('proposed_is_relic', e.target.checked)}
                />
                <span className="suggest-edit-checkbox-label">Relic/Memorabilia</span>
                {changedFields.proposed_is_relic && <span className="suggest-edit-changed-indicator">Modified</span>}
              </label>

              <label className={`suggest-edit-checkbox ${changedFields.proposed_is_short_print ? 'changed' : ''}`}>
                <input
                  type="checkbox"
                  checked={formData.proposed_is_short_print}
                  onChange={e => handleFieldChange('proposed_is_short_print', e.target.checked)}
                />
                <span className="suggest-edit-checkbox-label">Short Print (SP)</span>
                {changedFields.proposed_is_short_print && <span className="suggest-edit-changed-indicator">Modified</span>}
              </label>
            </div>

            <div className="suggest-edit-form-row">
              <label>
                Notes
                {changedFields.proposed_notes && <span className="suggest-edit-changed-indicator">Modified</span>}
              </label>
              <textarea
                value={formData.proposed_notes}
                onChange={e => handleFieldChange('proposed_notes', e.target.value)}
                placeholder="Any additional notes about this card"
                rows={3}
              />
            </div>
          </div>

          <div className="suggest-edit-form-section">
            <h3>Your Explanation</h3>
            <div className="suggest-edit-form-row">
              <label>Why should this be changed?</label>
              <textarea
                value={formData.submission_notes}
                onChange={e => setFormData(prev => ({ ...prev, submission_notes: e.target.value }))}
                placeholder="Help reviewers understand why you're suggesting this change. Include sources if available."
                rows={3}
              />
            </div>
          </div>

          <div className="suggest-edit-form-actions">
            <button type="button" onClick={onClose} className="suggest-edit-cancel-btn">
              Cancel
            </button>
            <button
              type="submit"
              className="suggest-edit-submit-btn"
              disabled={!hasChanges || submitting}
            >
              {submitting ? (
                <>
                  <span className="suggest-edit-spinner"></span>
                  Submitting...
                </>
              ) : (
                <>
                  <Icon name="upload" size={16} />
                  Submit Suggestion
                </>
              )}
            </button>
          </div>
        </form>

        <div className="suggest-edit-info-banner">
          <Icon name="info" size={16} />
          <span>Your suggestion will be reviewed by our team. Approved changes help improve the database for everyone!</span>
        </div>
      </div>
    </div>
  )
}

export default SuggestEditModal
