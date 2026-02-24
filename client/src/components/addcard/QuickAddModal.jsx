import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import './QuickAddModal.css'

/**
 * QuickAddModal - Simplified add to collection modal
 *
 * Shows card preview and allows quick add with optional fields:
 * - Storage location
 * - Purchase price
 * - Notes
 */
export default function QuickAddModal({ card, onClose, onSuccess }) {
  const { addToast } = useToast()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [locations, setLocations] = useState([])
  const [formData, setFormData] = useState({
    user_location: '',
    purchase_price: '',
    notes: ''
  })

  // Fetch user locations
  useEffect(() => {
    const fetchLocations = async () => {
      try {
        const response = await axios.get('/api/user/locations')
        if (response.data) {
          setLocations(response.data)
        }
      } catch (error) {
        console.error('Error fetching locations:', error)
      }
    }

    fetchLocations()
  }, [])

  // Handle input change
  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      const payload = {
        card_id: card.card_id
      }

      // Add optional fields if provided
      if (formData.user_location) {
        payload.user_location = parseInt(formData.user_location)
      }
      if (formData.purchase_price) {
        const price = parseFloat(formData.purchase_price)
        if (!isNaN(price)) {
          payload.purchase_price = price
        }
      }
      if (formData.notes.trim()) {
        payload.notes = formData.notes.trim()
      }

      const response = await axios.post('/api/user/cards', payload)

      if (response.data) {
        addToast('Card added to your collection!', 'success')
        onSuccess(response.data)
      }
    } catch (error) {
      console.error('Error adding card:', error)
      addToast(error.response?.data?.message || 'Failed to add card', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Get player name from card
  const playerName = card.card_player_teams?.[0]?.player?.name || 'Unknown Player'

  // Get display info
  const setYear = card.set_rel?.year
  const setName = card.set_rel?.name || 'Unknown Set'
  const seriesName = card.series_rel?.name
  const colorName = card.color_rel?.color

  return (
    <div className="quick-add-modal-backdrop" onClick={onClose}>
      <div className="quick-add-modal" onClick={e => e.stopPropagation()}>
        <button
          type="button"
          className="quick-add-modal-close"
          onClick={onClose}
          aria-label="Close"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"></path>
          </svg>
        </button>

        <div className="quick-add-modal-header">
          <h2>Add to Collection</h2>
        </div>

        {/* Card Preview */}
        <div className="quick-add-card-preview">
          <div className="quick-add-card-image">
            {card.front_image_path ? (
              <img src={card.front_image_path} alt={`Card #${card.card_number}`} />
            ) : (
              <div className="quick-add-card-placeholder">
                <span>#{card.card_number}</span>
              </div>
            )}
          </div>
          <div className="quick-add-card-details">
            <div className="quick-add-card-number">#{card.card_number}</div>
            <div className="quick-add-card-player">{playerName}</div>
            <div className="quick-add-card-set">
              {setYear && <span className="quick-add-year">{setYear}</span>}
              {setName}
            </div>
            {seriesName && seriesName.toLowerCase() !== 'base' && (
              <div className="quick-add-card-series">{seriesName}</div>
            )}
            {colorName && (
              <div className="quick-add-card-color">
                {card.color_rel?.hex_color && (
                  <span
                    className="quick-add-color-dot"
                    style={{ backgroundColor: card.color_rel.hex_color }}
                  ></span>
                )}
                {colorName}
                {card.print_run && <span className="quick-add-print-run">/{card.print_run}</span>}
              </div>
            )}
            {/* Badges */}
            <div className="quick-add-card-badges">
              {card.is_rookie && <span className="quick-add-badge quick-add-badge-rc">RC</span>}
              {card.is_autograph && <span className="quick-add-badge quick-add-badge-auto">AUTO</span>}
              {card.is_relic && <span className="quick-add-badge quick-add-badge-relic">RELIC</span>}
              {card.is_short_print && <span className="quick-add-badge quick-add-badge-sp">SP</span>}
            </div>
          </div>
        </div>

        {/* Form */}
        <form className="quick-add-form" onSubmit={handleSubmit}>
          <div className="quick-add-form-row">
            <div className="quick-add-field">
              <label htmlFor="quick-add-location">Storage Location</label>
              <select
                id="quick-add-location"
                value={formData.user_location}
                onChange={(e) => handleChange('user_location', e.target.value)}
              >
                <option value="">Select a location (optional)</option>
                {locations.map(loc => (
                  <option key={loc.user_location_id} value={loc.user_location_id}>
                    {loc.location}
                  </option>
                ))}
              </select>
            </div>

            <div className="quick-add-field quick-add-field-price">
              <label htmlFor="quick-add-price">Purchase Price</label>
              <div className="quick-add-price-input">
                <span className="quick-add-currency">$</span>
                <input
                  id="quick-add-price"
                  type="text"
                  placeholder="0.00"
                  value={formData.purchase_price}
                  onChange={(e) => handleChange('purchase_price', e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="quick-add-field">
            <label htmlFor="quick-add-notes">Notes</label>
            <textarea
              id="quick-add-notes"
              placeholder="Any notes about this card..."
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              rows={2}
            ></textarea>
          </div>

          <div className="quick-add-actions">
            <button
              type="button"
              className="quick-add-cancel-btn"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="quick-add-submit-btn"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <span className="quick-add-spinner"></span>
                  Adding...
                </>
              ) : (
                <>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"></path>
                  </svg>
                  Add to Collection
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
