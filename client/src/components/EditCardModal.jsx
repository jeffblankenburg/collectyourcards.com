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
  onCardUpdated,
  preloadedLocations = [],
  preloadedGradingAgencies = []
}) => {
  const { user } = useAuth()
  const { success, error } = useToast()
  const [loading, setLoading] = useState(false)
  const [locations, setLocations] = useState([])
  const [gradingAgencies, setGradingAgencies] = useState([])
  const [showPricing, setShowPricing] = useState(true)
  const [showGrading, setShowGrading] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [existingPhotos, setExistingPhotos] = useState([])
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState(null)
  const [draggedPhotoId, setDraggedPhotoId] = useState(null)
  const [dragOverPhotoId, setDragOverPhotoId] = useState(null)
  const [reordering, setReordering] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [showNewLocationInput, setShowNewLocationInput] = useState(false)
  
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
      // Use preloaded data if available
      if (preloadedLocations.length > 0) {
        setLocations(preloadedLocations)
      } else {
        loadLocations()
      }
      
      if (preloadedGradingAgencies.length > 0) {
        setGradingAgencies(preloadedGradingAgencies)
      } else {
        loadGradingAgencies()
      }
      
      // Always load photos as they're card-specific
      loadExistingPhotos()
      
      // Populate form immediately
      populateForm()
    }
  }, [isOpen, card, preloadedLocations, preloadedGradingAgencies])

  const populateForm = () => {
    if (card) {
      // For collection cards, we need to find the user_location from the location_name
      const userLocationId = locations.find(loc => loc.location === card.location_name)?.user_location_id || ''
      
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
      
      setFormData(newFormData)
      
      // Show sections if they have data
      setShowPricing(!!(card.purchase_price || card.estimated_value))
      setShowGrading(!!(card.grade || card.grading_agency))
    }
  }

  const loadLocations = async () => {
    try {
      const response = await axios.get('/api/user/locations')
      setLocations(response.data.locations || [])
    } catch (err) {
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

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      error('Please enter a location name')
      return
    }

    try {
      const response = await axios.post('/api/user/locations', {
        location: newLocationName.trim()
      })
      
      const newLocation = response.data.location
      setLocations([...locations, newLocation])
      setFormData(prev => ({...prev, user_location: newLocation.user_location_id.toString()}))
      setNewLocationName('')
      setShowNewLocationInput(false)
      success('Location created successfully')
    } catch (err) {
      console.error('Error creating location:', err)
      error(err.response?.data?.message || 'Failed to create location')
    }
  }

  const loadExistingPhotos = async () => {
    if (!card?.user_card_id) return
    
    try {
      const response = await axios.get(`/api/user/cards/${card.user_card_id}/photos`)
      if (response.data.success) {
        setExistingPhotos(response.data.photos || [])
        setShowPhotos(response.data.photos?.length > 0) // Auto-expand if photos exist
      }
    } catch (err) {
      console.error('Error loading existing photos:', err)
    }
  }

  const handlePhotoSelect = (event) => {
    const files = Array.from(event.target.files)
    const currentTotal = existingPhotos.length + selectedPhotos.length
    
    // Check total limit including existing photos
    if (currentTotal + files.length > 5) {
      error(`Maximum 5 photos allowed per card. You have ${currentTotal} photo(s) already.`)
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
      setSelectedPhotos(prev => [...prev, ...validFiles])
      setShowPhotos(true)
    }
  }

  const removeNewPhoto = (index) => {
    setSelectedPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const deleteExistingPhoto = async (photoId) => {
    try {
      setDeletingPhotoId(photoId)
      
      await axios.delete(`/api/user/cards/${card.user_card_id}/photos/${photoId}`)
      
      // Refresh existing photos
      await loadExistingPhotos()
      success('Photo deleted successfully')
    } catch (err) {
      console.error('Error deleting photo:', err)
      error(err.response?.data?.message || 'Failed to delete photo')
    } finally {
      setDeletingPhotoId(null)
    }
  }

  const uploadNewPhotos = async () => {
    if (selectedPhotos.length === 0) return
    
    try {
      setUploadingPhotos(true)
      
      const formData = new FormData()
      selectedPhotos.forEach(photo => {
        formData.append('photos', photo)
      })
      
      const response = await axios.post(`/api/user/cards/${card.user_card_id}/photos`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      if (response.data.success) {
        success(`Successfully uploaded ${response.data.photos.length} photo(s)`)
        setSelectedPhotos([])
        await loadExistingPhotos() // Refresh the existing photos
      }
    } catch (err) {
      console.error('Error uploading photos:', err)
      error(err.response?.data?.message || 'Failed to upload photos')
    } finally {
      setUploadingPhotos(false)
    }
  }

  const handleDragStart = (e, photoId) => {
    console.log('Drag start:', photoId)
    setDraggedPhotoId(photoId)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', photoId)
  }

  const handleDragOver = (e, photoId) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverPhotoId(photoId)
  }

  const handleDragLeave = (e) => {
    // Only clear if we're leaving the photo item entirely
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverPhotoId(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedPhotoId(null)
    setDragOverPhotoId(null)
  }

  const handleDrop = (e, targetPhotoId) => {
    e.preventDefault()
    
    if (!draggedPhotoId || draggedPhotoId === targetPhotoId) {
      setDraggedPhotoId(null)
      setDragOverPhotoId(null)
      return
    }

    // Find dragged and target photo indices
    const draggedIndex = existingPhotos.findIndex(p => p.user_card_photo_id === draggedPhotoId)
    const targetIndex = existingPhotos.findIndex(p => p.user_card_photo_id === targetPhotoId)
    
    if (draggedIndex === -1 || targetIndex === -1) {
      setDraggedPhotoId(null)
      setDragOverPhotoId(null)
      return
    }

    // Reorder photos array locally
    const reorderedPhotos = [...existingPhotos]
    const [draggedPhoto] = reorderedPhotos.splice(draggedIndex, 1)
    reorderedPhotos.splice(targetIndex, 0, draggedPhoto)
    
    // Update sort_order values in the local array
    const updatedPhotos = reorderedPhotos.map((photo, index) => ({
      ...photo,
      sort_order: index + 1
    }))
    
    setExistingPhotos(updatedPhotos)
    setDraggedPhotoId(null)
    setDragOverPhotoId(null)
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
      
      // Upload photos if any were selected
      if (selectedPhotos.length > 0) {
        await uploadNewPhotos()
      }

      // Update photo sort orders if they were changed
      const photoOrders = existingPhotos.map(photo => ({
        photoId: photo.user_card_photo_id,
        sortOrder: photo.sort_order
      }))

      console.log('Sending photo orders to API:', photoOrders)

      if (photoOrders.length > 0) {
        try {
          await axios.put(`/api/user/cards/${card.user_card_id}/photos/reorder`, {
            photoOrders: photoOrders
          })
          console.log('Photo order update successful')
        } catch (photoErr) {
          console.error('Error updating photo order:', photoErr)
          console.error('Full error details:', photoErr.response)
          // Don't fail the entire update for photo ordering issues
        }
      }
      
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

  // Don't render anything if modal is not open
  if (!isOpen) return null

  return (
    <div className="edit-modal-overlay" onClick={onClose}>
      <div className="modal-content edit-card-modal" onClick={e => e.stopPropagation()}>
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
                {!showNewLocationInput ? (
                  <div className="location-select-row">
                    <select
                      name="user_location"
                      value={formData.user_location}
                      onChange={handleInputChange}
                      className="form-select"
                    >
                      <option value="">Select location</option>
                      {locations.map(location => (
                        <option key={location.user_location_id} value={location.user_location_id}>
                          {location.location}
                        </option>
                      ))}
                    </select>
                    <button 
                      type="button" 
                      className="new-location-btn"
                      onClick={() => setShowNewLocationInput(true)}
                      title="Create new location"
                    >
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="new-location-input">
                    <input
                      type="text"
                      placeholder="Enter location name"
                      value={newLocationName}
                      onChange={(e) => setNewLocationName(e.target.value)}
                      className="form-input"
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateLocation()}
                      autoFocus
                    />
                    <button 
                      type="button" 
                      className="create-location-btn"
                      onClick={handleCreateLocation}
                    >
                      <Icon name="check" size={16} />
                    </button>
                    <button 
                      type="button" 
                      className="cancel-location-btn"
                      onClick={() => {
                        setShowNewLocationInput(false)
                        setNewLocationName('')
                      }}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                )}
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

          {/* Photos Section */}
          <div className="form-section collapsible">
            <div 
              className="section-header"
              onClick={() => setShowPhotos(!showPhotos)}
            >
              <h4>Card Photos ({existingPhotos.length + selectedPhotos.length}/5)</h4>
              <Icon name={showPhotos ? "chevron-up" : "chevron-down"} size={18} />
            </div>
            
            {showPhotos && (
              <div className="collapsible-content">
                {/* Photo Grid - Existing and New Photos Combined */}
                <div className="photo-grid">
                  {/* Existing photos */}
                  {existingPhotos.map((photo, index) => (
                    <div 
                      key={photo.user_card_photo_id} 
                      className={`photo-preview-item existing ${dragOverPhotoId === photo.user_card_photo_id ? 'drag-over' : ''}`}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, photo.user_card_photo_id)}
                      onDragOver={(e) => handleDragOver(e, photo.user_card_photo_id)}
                      onDragLeave={handleDragLeave}
                      onDragEnd={handleDragEnd}
                      onDrop={(e) => handleDrop(e, photo.user_card_photo_id)}
                    >
                      <div className={`photo-preview ${draggedPhotoId === photo.user_card_photo_id ? 'dragging' : ''}`}>
                        <img
                          src={photo.photo_url}
                          alt={`Card photo ${photo.sort_order}`}
                        />
                        {photo.sort_order === 1 && (
                          <div className="primary-badge">Primary</div>
                        )}
                        <button
                          type="button"
                          className="remove-photo"
                          onClick={() => deleteExistingPhoto(photo.user_card_photo_id)}
                          disabled={loading || deletingPhotoId === photo.user_card_photo_id || reordering}
                        >
                          {deletingPhotoId === photo.user_card_photo_id ? (
                            <Icon name="activity" size={12} className="spinner" />
                          ) : (
                            <Icon name="x" size={14} />
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* New photos to upload */}
                  {selectedPhotos.map((photo, index) => (
                    <div key={index} className="photo-preview-item new">
                      <div className="photo-preview">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Preview ${index + 1}`}
                          onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                        />
                        <div className="new-badge">New</div>
                        <button
                          type="button"
                          className="remove-photo"
                          onClick={() => removeNewPhoto(index)}
                          disabled={loading || uploadingPhotos}
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                  
                  {/* Upload button as last item if space available */}
                  {(existingPhotos.length + selectedPhotos.length) < 5 && (
                    <div className="photo-preview-item upload-slot">
                      <div className="photo-preview upload-preview">
                        <input
                          type="file"
                          accept="image/jpeg,image/jpg,image/png,image/webp"
                          multiple
                          onChange={handlePhotoSelect}
                          style={{ display: 'none' }}
                          id="photo-upload-edit"
                          disabled={loading || uploadingPhotos}
                        />
                        <label htmlFor="photo-upload-edit" className="photo-upload-inline">
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