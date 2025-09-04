import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from './Icon'
import './AddCardModal.css'

const AddCardModal = ({ 
  isOpen, 
  onClose, 
  card, 
  onCardAdded 
}) => {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState([])
  const [gradingAgencies, setGradingAgencies] = useState([])
  const [showPricing, setShowPricing] = useState(true)
  const [showGrading, setShowGrading] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  
  // Function to generate 4-character random code
  const generateRandomCode = () => {
    const chars = '0123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKMNOPQRSTUVWXYZ'
    let result = ''
    for (let i = 0; i < 4; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return result
  }

  const [formData, setFormData] = useState({
    random_code: generateRandomCode(),
    serial_number: '',
    user_location: '',
    notes: '',
    aftermarket_auto: false,
    purchase_price: '',
    estimated_value: '',
    grading_agency: '',
    grade: '',
    grade_id: ''
  })

  useEffect(() => {
    if (isOpen) {
      loadLocations()
      loadGradingAgencies()
      resetForm()
    }
  }, [isOpen])

  const resetForm = () => {
    setFormData({
      random_code: generateRandomCode(),
      serial_number: '',
      user_location: '',
      notes: '',
      aftermarket_auto: false,
      purchase_price: '',
      estimated_value: '',
      grading_agency: '',
      grade: '',
      grade_id: ''
    })
    setShowPricing(true)
    setShowGrading(false)
    setShowPhotos(false)
    setSelectedPhotos([])
  }

  const handlePhotoSelect = (event) => {
    const files = Array.from(event.target.files)
    
    // Limit to 5 photos
    if (files.length > 5) {
      error('Maximum 5 photos allowed per card')
      return
    }
    
    // Validate file types and sizes
    const validFiles = []
    for (const file of files) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        error(`${file.name}: Only JPEG, PNG, and WebP images are allowed`)
        continue
      }
      
      if (file.size > 5 * 1024 * 1024) {
        error(`${file.name}: File size must be less than 5MB`)
        continue
      }
      
      validFiles.push(file)
    }
    
    if (validFiles.length > 0) {
      setSelectedPhotos(validFiles)
      setShowPhotos(true) // Auto-expand the section when photos are selected
    }
  }

  const removePhoto = (index) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const uploadPhotos = async (userCardId) => {
    if (selectedPhotos.length === 0) return
    
    try {
      setUploadingPhotos(true)
      
      const formData = new FormData()
      selectedPhotos.forEach(photo => {
        formData.append('photos', photo)
      })
      
      const response = await axios.post(`/api/user/cards/${userCardId}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      if (response.data.success) {
        success(`Successfully uploaded ${response.data.photos.length} photo(s)`)
      }
    } catch (err) {
      console.error('Error uploading photos:', err)
      error(err.response?.data?.message || 'Failed to upload photos')
    } finally {
      setUploadingPhotos(false)
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
      // Set empty array if request fails
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
        card_id: card.card_id,
        ...formData,
        serial_number: formData.serial_number ? parseInt(formData.serial_number) : null,
        user_location: formData.user_location || null,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
        estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
        grading_agency: formData.grading_agency || null,
        grade: formData.grade || null
      }

      const response = await axios.post('/api/user/cards', submitData)
      const newUserCardId = response.data.user_card_id
      
      // Upload photos if any were selected
      if (selectedPhotos.length > 0) {
        await uploadPhotos(newUserCardId)
      }
      
      success(`Card #${card.card_number} added to collection`)
      if (onCardAdded) onCardAdded()
      onClose()
    } catch (err) {
      console.error('Error adding card:', err)
      error(err.response?.data?.message || 'Failed to add card to collection')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !card) return null

  const hasSerial = card.print_run && card.print_run > 0

  // Calculate text color based on background brightness (for parallel colors)
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
            <Icon name="close" size={20} />
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
                <div className="input-with-button" style={{ display: 'flex', alignItems: 'center' }}>
                  <input
                    type="text"
                    name="random_code"
                    value={formData.random_code}
                    onChange={handleInputChange}
                    placeholder="Auto-generated"
                    className="random-code-input"
                    style={{ width: 'calc(100% - 44px)', marginRight: '8px' }}
                  />
                  <button
                    type="button"
                    className="edit-card-btn"
                    onClick={() => setFormData(prev => ({
                      ...prev,
                      random_code: generateRandomCode()
                    }))}
                    title="Generate new random code"
                    style={{ flexShrink: 0 }}
                  >
                    <Icon name="refresh" size={16} style={{color: 'white'}} />
                  </button>
                </div>
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
                    name="aftermarket_auto"
                    checked={formData.aftermarket_auto}
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
              <Icon name={showPricing ? "arrow-up" : "arrow-down"} size={18} />
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
              <Icon name={showGrading ? "arrow-up" : "arrow-down"} size={18} />
            </div>
            
            {showGrading && (
              <div className="collapsible-content">
                <div className="form-group">
                  <label>Grading Agency</label>
                  <select
                    name="grading_agency"
                    value={formData.grading_agency}
                    onChange={handleInputChange}
                  >
                    <option value="">Select a grading agency</option>
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
                      placeholder="e.g., 10, 9.5, PSA 10"
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

          {/* Photos Section */}
          <div className="form-section collapsible">
            <div 
              className="section-header"
              onClick={() => setShowPhotos(!showPhotos)}
            >
              <h4>Card Photos (Optional)</h4>
              <Icon name={showPhotos ? "chevron-up" : "chevron-down"} size={18} />
            </div>
            
            {showPhotos && (
              <div className="collapsible-content">
                {/* Photo Grid - New Photos */}
                <div className="photo-grid">
                  {/* New photos to upload */}
                  {selectedPhotos.map((photo, index) => (
                    <div key={index} className="photo-preview-item new">
                      <div className="photo-preview">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Preview ${index + 1}`}
                          onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                        />
                        {index === 0 && (
                          <div className="primary-badge">Primary</div>
                        )}
                        <button
                          type="button"
                          className="remove-photo"
                          onClick={() => removePhoto(index)}
                          disabled={loading || uploadingPhotos}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Upload button as last item if space available */}
                  {selectedPhotos.length < 5 && (
                    <div className="photo-preview-item upload-slot">
                      <div className="photo-preview upload-preview">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          multiple
                          onChange={handlePhotoSelect}
                          style={{ display: 'none' }}
                          id="photo-upload"
                          disabled={loading || uploadingPhotos}
                        />
                        <label htmlFor="photo-upload" className="photo-upload-inline">
                          <Icon name="plus" size={24} />
                          <span>Add Photo</span>
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="form-actions">
            <button
              type="button"
              className="add-modal-btn add-modal-btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="add-modal-btn add-modal-btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Icon name="activity" size={16} className="spinner" />
                  Adding...
                </>
              ) : (
                'Add Card'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default AddCardModal