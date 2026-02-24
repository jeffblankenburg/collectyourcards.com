import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import './SubmitNewCardForm.css'

/**
 * SubmitNewCardForm - Submit new card not in database
 *
 * For cards that users can't find in the database.
 * Pre-fills player info from the search context.
 */
export default function SubmitNewCardForm({ player, onSuccess, onCancel }) {
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    card_number: '',
    year: new Date().getFullYear(),
    set_name: '',
    series_name: '',
    team_name: '',
    color_name: '',
    print_run: '',
    is_rookie: false,
    is_autograph: false,
    is_relic: false,
    is_short_print: false,
    notes: ''
  })

  // Generate year options
  const currentYear = new Date().getFullYear()
  const years = Array.from({ length: currentYear - 1899 + 1 }, (_, i) => currentYear + 1 - i)

  // Handle input change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Handle checkbox toggle
  const handleCheckbox = (field) => {
    setFormData(prev => ({ ...prev, [field]: !prev[field] }))
  }

  // Get player name
  const playerName = player
    ? `${player.first_name || ''} ${player.last_name || ''}`.trim()
    : ''

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()

    // Validate required fields
    if (!formData.card_number.trim()) {
      addToast('Please enter a card number', 'error')
      return
    }
    if (!formData.set_name.trim()) {
      addToast('Please enter a set name', 'error')
      return
    }

    setIsSubmitting(true)

    try {
      const cardData = {
        player_name: playerName,
        team_name: formData.team_name.trim() || '',
        set_name: formData.set_name.trim(),
        series_name: formData.series_name.trim() || '',
        card_number: formData.card_number.trim(),
        year: parseInt(formData.year),
        color_name: formData.color_name.trim() || '',
        print_run: formData.print_run ? parseInt(formData.print_run) : null,
        is_rookie: formData.is_rookie,
        is_autograph: formData.is_autograph,
        is_relic: formData.is_relic,
        is_short_print: formData.is_short_print,
        notes: formData.notes.trim() || ''
      }

      const response = await axios.post('/api/crowdsource/provisional-card', {
        cards: [cardData]
      })

      if (response.data.success) {
        addToast('Card submitted! It will appear in your collection after review.', 'success')
        onSuccess(response.data)
      } else {
        addToast(response.data.message || 'Failed to submit card', 'error')
      }
    } catch (error) {
      console.error('Submit error:', error)
      addToast(error.response?.data?.message || 'Failed to submit card', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="submit-new-card-form">
      <div className="submit-new-card-header">
        <h3>Submit New Card</h3>
        <p className="submit-new-card-subtitle">
          This card will be added to our database after review.
        </p>
      </div>

      {/* Player Info (read-only) */}
      <div className="submit-new-card-player-info">
        <span className="submit-new-card-label">Player</span>
        <span className="submit-new-card-player-name">{playerName}</span>
      </div>

      <form className="submit-new-card-fields" onSubmit={handleSubmit}>
        {/* Required Fields Row */}
        <div className="submit-new-card-row">
          <div className="submit-new-card-field submit-new-card-field-number">
            <label htmlFor="submit-card-number">
              Card # <span className="submit-required">*</span>
            </label>
            <input
              id="submit-card-number"
              type="text"
              placeholder="e.g., 150"
              value={formData.card_number}
              onChange={(e) => handleChange('card_number', e.target.value)}
              required
            />
          </div>

          <div className="submit-new-card-field submit-new-card-field-year">
            <label htmlFor="submit-year">
              Year <span className="submit-required">*</span>
            </label>
            <select
              id="submit-year"
              value={formData.year}
              onChange={(e) => handleChange('year', e.target.value)}
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="submit-new-card-field submit-new-card-field-set">
            <label htmlFor="submit-set-name">
              Set Name <span className="submit-required">*</span>
            </label>
            <input
              id="submit-set-name"
              type="text"
              placeholder="e.g., Topps Chrome"
              value={formData.set_name}
              onChange={(e) => handleChange('set_name', e.target.value)}
              required
            />
          </div>
        </div>

        {/* Optional Fields Row 1 */}
        <div className="submit-new-card-row">
          <div className="submit-new-card-field">
            <label htmlFor="submit-series-name">Series</label>
            <input
              id="submit-series-name"
              type="text"
              placeholder="e.g., Base, Rookies, All-Stars"
              value={formData.series_name}
              onChange={(e) => handleChange('series_name', e.target.value)}
            />
          </div>

          <div className="submit-new-card-field">
            <label htmlFor="submit-team-name">Team</label>
            <input
              id="submit-team-name"
              type="text"
              placeholder="e.g., Los Angeles Angels"
              value={formData.team_name}
              onChange={(e) => handleChange('team_name', e.target.value)}
            />
          </div>
        </div>

        {/* Optional Fields Row 2 */}
        <div className="submit-new-card-row">
          <div className="submit-new-card-field">
            <label htmlFor="submit-color-name">Color / Parallel</label>
            <input
              id="submit-color-name"
              type="text"
              placeholder="e.g., Gold Prizm, Refractor"
              value={formData.color_name}
              onChange={(e) => handleChange('color_name', e.target.value)}
            />
          </div>

          <div className="submit-new-card-field submit-new-card-field-print-run">
            <label htmlFor="submit-print-run">Print Run</label>
            <input
              id="submit-print-run"
              type="text"
              placeholder="e.g., 50"
              value={formData.print_run}
              onChange={(e) => handleChange('print_run', e.target.value)}
            />
          </div>
        </div>

        {/* Card Attributes */}
        <div className="submit-new-card-field">
          <label>Card Attributes</label>
          <div className="submit-new-card-checkboxes">
            <label className={`submit-checkbox ${formData.is_rookie ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={formData.is_rookie}
                onChange={() => handleCheckbox('is_rookie')}
              />
              <span>Rookie Card (RC)</span>
            </label>

            <label className={`submit-checkbox ${formData.is_autograph ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={formData.is_autograph}
                onChange={() => handleCheckbox('is_autograph')}
              />
              <span>Autograph</span>
            </label>

            <label className={`submit-checkbox ${formData.is_relic ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={formData.is_relic}
                onChange={() => handleCheckbox('is_relic')}
              />
              <span>Relic / Memorabilia</span>
            </label>

            <label className={`submit-checkbox ${formData.is_short_print ? 'checked' : ''}`}>
              <input
                type="checkbox"
                checked={formData.is_short_print}
                onChange={() => handleCheckbox('is_short_print')}
              />
              <span>Short Print (SP)</span>
            </label>
          </div>
        </div>

        {/* Notes */}
        <div className="submit-new-card-field">
          <label htmlFor="submit-notes">Notes (optional)</label>
          <textarea
            id="submit-notes"
            placeholder="Any additional details about this card..."
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            rows={2}
          ></textarea>
        </div>

        {/* Actions */}
        <div className="submit-new-card-actions">
          <button
            type="button"
            className="submit-new-card-cancel-btn"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Back to Card Browser
          </button>
          <button
            type="submit"
            className="submit-new-card-submit-btn"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="submit-new-card-spinner"></span>
                Submitting...
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
                </svg>
                Submit Card
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  )
}
