import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from './Icon'
import './EditCardModal.css'

const EditCardModal = ({ 
  isOpen, 
  onClose, 
  card, 
  onCardUpdated 
}) => {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState([])
  const [gradingAgencies, setGradingAgencies] = useState([])
  const [showPricing, setShowPricing] = useState(true)
  const [showGrading, setShowGrading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  
  const [formData, setFormData] = useState({
    random_code: '',
    serial_number: '',
    user_location: '',
    notes: '',
    aftermarket_autograph: false,
    purchase_price: '',
    estimated_value: '',
    grading_agency: '',
    grade: '',
    grade_id: ''
  })

  useEffect(() => {
    if (isOpen && card) {
      loadLocations()
      loadGradingAgencies()
    }
  }, [isOpen, card])

  // Populate form after locations and grading agencies are loaded
  useEffect(() => {
    if (isOpen && card && locations.length > 0 && gradingAgencies.length > 0) {
      populateForm()
    }
  }, [isOpen, card, locations, gradingAgencies])

  const populateForm = () => {
    if (card) {
      // For collection cards, we need to find the user_location from the location_name
      const userLocationId = locations.find(loc => loc.location === card.location_name)?.user_location_id || ''
      
      console.log('Populating form with card data:', card)
      console.log('Available grading agencies:', gradingAgencies)
      console.log('Card grading agency:', card.grading_agency)
      
      const newFormData = {
        random_code: card.random_code || '',
        serial_number: card.serial_number || '',
        user_location: userLocationId,
        notes: card.notes || '',
        aftermarket_autograph: card.aftermarket_autograph || false,
        purchase_price: card.purchase_price || '',
        estimated_value: card.estimated_value || '',
        grading_agency: card.grading_agency ? String(card.grading_agency) : '',
        grade: card.grade || '',
        grade_id: card.grade_id || ''
      }
      
      console.log('Setting form data:', newFormData)
      setFormData(newFormData)
      
      // Show sections if they have data
      setShowPricing(!!(card.purchase_price || card.estimated_value))
      setShowGrading(!!(card.grade || card.grading_agency))
    }
  }

  const loadLocations = async () => {
    try {
      console.log('Loading user locations...')
      const response = await axios.get('/api/user/locations')
      console.log('Locations response:', response.data)
      setLocations(response.data.locations || [])
    } catch (err) {
      console.error('Error loading locations:', err.response?.data || err.message)
      setLocations([])
    }
  }

  const loadGradingAgencies = async () => {
    try {
      const response = await axios.get('/api/grading-agencies')
      setGradingAgencies(response.data.agencies || [])
    } catch (err) {
      console.error('Error loading grading agencies:', err)
    }
  }

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      const submitData = {
        ...formData,
        serial_number: formData.serial_number ? parseInt(formData.serial_number) : null,
        user_location: formData.user_location || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
        grading_agency: formData.grading_agency || null,
        grade: formData.grade || null
      }

      console.log('Updating user_card:', submitData)

      // Update the existing user_card record
      await axios.put(`/api/user/cards/${card.user_card_id}`, submitData)
      
      success(`Card #${card.card_number} updated successfully`)
      onCardUpdated()
      onClose()
    } catch (err) {
      console.error('Error updating card:', err)
      console.error('Response data:', err.response?.data)
      error(err.response?.data?.message || 'Failed to update card')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteCard = () => {
    setShowDeleteConfirm(true)
  }

  const confirmDeleteCard = async () => {
    try {
      setDeleting(true)
      await axios.delete(`/api/user/cards/${card.user_card_id}`)
      
      success(`Card #${card.card_number} deleted from collection`)
      onCardUpdated() // Refresh the table data
      onClose() // Close the edit modal
      setShowDeleteConfirm(false)
    } catch (err) {
      console.error('Error deleting card:', err)
      error(err.response?.data?.message || 'Failed to delete card')
    } finally {
      setDeleting(false)
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
  }

  if (!isOpen || !card) return null

  const hasSerial = card.print_run && card.print_run > 1

  // Calculate text color based on background brightness
  const getTextColorForBackground = (hexColor) => {
    if (!hexColor) return '#ffffff'
    
    // Remove # if present
    const hex = hexColor.replace('#', '')
    
    // Parse RGB values
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16) 
    const b = parseInt(hex.substr(4, 2), 16)
    
    // Calculate relative luminance using WCAG formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    // Return black text for bright colors, white text for dark colors
    return luminance > 0.5 ? '#000000' : '#ffffff'
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content add-card-modal" onClick={e => e.stopPropagation()}>
        {/* Card Header */}
        <div className="card-header">
          <button className="modal-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
          
          <div className="card-info">
            <div className="card-number">#{card.card_number}</div>
            <div className="card-details">
              <div className="card-players">
                {card.card_player_teams?.map((cpt, index) => (
                  <span key={index}>
                    {cpt.player?.name}
                    {index < card.card_player_teams.length - 1 ? ', ' : ''}
                  </span>
                )) || 'N/A'}
              </div>
              <div className="card-teams">
                {card.card_player_teams?.map((cpt, index) => (
                  <span key={index}>
                    {cpt.team?.name}
                    {index < card.card_player_teams.length - 1 ? ', ' : ''}
                  </span>
                )) || 'N/A'}
              </div>
              <div className="card-series">{card.series_rel?.name}</div>
            </div>
          </div>
          
          {/* Color stripe for parallels */}
          {card.color_rel?.hex_color && card.color_rel?.color && (
            <div 
              className="card-color-stripe"
              style={{ backgroundColor: card.color_rel.hex_color }}
            >
              <span 
                className="color-name"
                style={{
                  color: getTextColorForBackground(card.color_rel.hex_color)
                }}
              >
                {card.color_rel.color}
              </span>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="add-card-form">

          {/* Main Form Fields */}
          <div className="form-section main-fields">
            <div className="form-grid">
              <div className="form-group">
                <label>Random Code</label>
                <input
                  type="text"
                  name="random_code"
                  value={formData.random_code}
                  onChange={handleInputChange}
                  placeholder="Enter random code"
                  className="random-code-input"
                />
              </div>

              {hasSerial && (
                <div className="form-group">
                  <label>Serial Number</label>
                  <div className="serial-input-wrapper">
                    <input
                      type="number"
                      name="serial_number"
                      value={formData.serial_number}
                      onChange={handleInputChange}
                      placeholder="#"
                      min="1"
                      max={card.print_run}
                      className="serial-input"
                    />
                    <span className="print-run-suffix">/ {card.print_run}</span>
                  </div>
                </div>
              )}

              <div className={`form-group ${!hasSerial ? 'full-width' : ''}`}>
                <label>Location</label>
                <select
                  name="user_location"
                  value={formData.user_location}
                  onChange={handleInputChange}
                >
                  <option value="">Select location</option>
                  {locations.map(location => (
                    <option key={location.user_location_id} value={location.user_location_id}>
                      {location.location}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Notes</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Any notes about this card..."
                  rows="2"
                />
              </div>

              <div className="form-group">
                <label></label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="aftermarket_autograph"
                    checked={formData.aftermarket_autograph}
                    onChange={handleInputChange}
                  />
                  <span>Aftermarket Autograph</span>
                </label>
              </div>
            </div>
          </div>

          {/* Pricing Information - Collapsible */}
          <div className="form-section collapsible">
            <div 
              className="section-header"
              onClick={() => setShowPricing(!showPricing)}
            >
              <h4>Pricing Information</h4>
              <Icon name={showPricing ? "chevron-up" : "chevron-down"} size={18} />
            </div>
            
            {showPricing && (
              <div className="collapsible-content">
                <div className="price-row">
                  <div className="form-group">
                    <label>Purchase Price</label>
                    <div className="price-input">
                      <span className="currency">$</span>
                      <input
                        type="number"
                        name="purchase_price"
                        value={formData.purchase_price}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                  
                  <div className="form-group">
                    <label>Estimated Value</label>
                    <div className="price-input">
                      <span className="currency">$</span>
                      <input
                        type="number"
                        name="estimated_value"
                        value={formData.estimated_value}
                        onChange={handleInputChange}
                        placeholder="0.00"
                        step="0.01"
                        min="0"
                      />
                    </div>
                  </div>
                  
                </div>
              </div>
            )}
          </div>

          {/* Grading Information - Collapsible */}
          <div className="form-section collapsible">
            <div 
              className="section-header"
              onClick={() => setShowGrading(!showGrading)}
            >
              <h4>Grading Information</h4>
              <Icon name={showGrading ? "chevron-up" : "chevron-down"} size={18} />
            </div>
            
            {showGrading && (
              <div className="collapsible-content">
                <div className="form-group">
                  <label>Grading Company</label>
                  <select
                    name="grading_agency"
                    value={formData.grading_agency}
                    onChange={handleInputChange}
                  >
                    <option value="">Not Graded</option>
                    {gradingAgencies.map(agency => (
                      <option key={agency.grading_agency_id} value={agency.grading_agency_id}>
                        {agency.display_name}
                      </option>
                    ))}
                  </select>
                </div>
                
                {formData.grading_agency && (
                  <div className="form-group">
                    <label>Grade</label>
                    <input
                      type="text"
                      name="grade"
                      value={formData.grade}
                      onChange={handleInputChange}
                      placeholder="10, 9.5, etc."
                    />
                  </div>
                )}

                {formData.grading_agency && (
                  <div className="form-group">
                    <label>Grade ID</label>
                    <input
                      type="text"
                      name="grade_id"
                      value={formData.grade_id}
                      onChange={handleInputChange}
                      placeholder="Cert number"
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button 
              type="button" 
              className="edit-modal-btn btn-delete" 
              onClick={handleDeleteCard}
              disabled={loading}
            >
              <Icon name="trash" size={16} />
              Delete
            </button>
            <div className="right-actions">
              <button type="button" className="edit-modal-btn btn-cancel" onClick={onClose}>
                Cancel
              </button>
              <button type="submit" className="edit-modal-btn btn-submit" disabled={loading}>
                {loading ? (
                  <>
                    <Icon name="activity" size={16} className="spinner" />
                    Updating...
                  </>
                ) : (
                  'Update Card'
                )}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Card from Collection</h3>
              <button className="modal-close" onClick={cancelDelete}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="delete-icon">
                <Icon name="warning" size={48} style={{color: '#ef4444'}} />
              </div>
              
              <div className="delete-message">
                <h4>Are you sure you want to delete this card?</h4>
                <div className="card-details">
                  <p><strong>Card:</strong> {card.card_number}</p>
                  <p><strong>Series:</strong> {card.series_rel?.name}</p>
                  {card.card_player_teams?.[0] && (
                    <p><strong>Player:</strong> {card.card_player_teams[0].player?.name}</p>
                  )}
                  {card.random_code && (
                    <p><strong>Code:</strong> {card.random_code}</p>
                  )}
                </div>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelDelete}>
                Cancel
              </button>
              <button 
                className="btn-delete" 
                onClick={confirmDeleteCard}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <Icon name="activity" size={16} className="spinner" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Icon name="trash" size={16} />
                    Delete Card
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

export default EditCardModal