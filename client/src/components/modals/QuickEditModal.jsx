import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '../../contexts/ToastContext'
import axios from 'axios'
import Icon from '../Icon'
import ImageEditor from '../ImageEditor'
import './QuickEditModal.css'

const QuickEditModal = ({ 
  isOpen, 
  onClose, 
  card, 
  onCardUpdated,
  locations = [],
  gradingAgencies = []
}) => {
  const { success, error } = useToast()
  const [saving, setSaving] = useState(false)
  const [showGrading, setShowGrading] = useState(false)
  const [showPricing, setShowPricing] = useState(true)
  
  const [formData, setFormData] = useState({
    random_code: '',
    serial_number: '',
    user_location: '',
    purchase_price: '',
    estimated_value: '',
    notes: '',
    aftermarket_autograph: false,
    grading_agency: '',
    grade: '',
    grade_id: ''
  })
  
  const [existingPhotos, setExistingPhotos] = useState([])
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  const [deletingPhotoId, setDeletingPhotoId] = useState(null)
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    if (card && isOpen) {
      // Find location ID from name
      const locationId = locations.find(loc => loc.location === card.location_name)?.user_location_id || ''
      
      setFormData({
        random_code: card.random_code || '',
        serial_number: card.serial_number || '',
        user_location: locationId,
        purchase_price: card.purchase_price || '',
        estimated_value: card.estimated_value || '',
        notes: card.notes || '',
        aftermarket_autograph: card.aftermarket_autograph || false,
        grading_agency: card.grading_agency ? String(card.grading_agency) : '',
        grade: card.grade || '',
        grade_id: card.grade_id || ''
      })
      
      // Show sections if they have data
      setShowGrading(!!(card.grade || card.grading_agency))
      setShowPricing(!!(card.purchase_price || card.estimated_value))
      
      // Load existing photos
      loadExistingPhotos()
    }
  }, [card, isOpen, locations])
  
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

  const handleImageClick = (photo) => {
    setSelectedImage(photo)
    setShowImageEditor(true)
  }

  const handleImageEditorClose = () => {
    setShowImageEditor(false)
    setSelectedImage(null)
  }

  const handleImageSave = async (editedImageBlob) => {
    if (!selectedImage || !editedImageBlob) return

    try {
      const formData = new FormData()
      formData.append('photo', editedImageBlob, 'edited-photo.jpg')
      
      // Replace the existing photo
      const response = await axios.put(`/api/user/cards/${card.user_card_id}/photos/${selectedImage.user_card_photo_id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      if (response.data.success) {
        success('Photo updated successfully')
        await loadExistingPhotos() // Refresh the existing photos
      }
    } catch (err) {
      console.error('Error updating photo:', err)
      error(err.response?.data?.message || 'Failed to update photo')
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
    setSaving(true)

    try {
      await axios.put(`/api/user/cards/${card.user_card_id}`, formData)

      // Upload photos if any were selected
      if (selectedPhotos.length > 0) {
        await uploadNewPhotos()
      }

      success('Card updated successfully')

      // Build complete updated card object for parent component
      if (onCardUpdated) {
        // Find the selected location name for display
        const selectedLocation = locations.find(loc =>
          loc.user_location_id === parseInt(formData.user_location)
        )

        const updatedCard = {
          ...card,
          // Update with form data
          random_code: formData.random_code || null,
          serial_number: formData.serial_number ? parseInt(formData.serial_number) : null,
          user_location: formData.user_location || null,
          location_name: selectedLocation?.location || null,
          purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
          estimated_value: formData.estimated_value ? parseFloat(formData.estimated_value) : null,
          notes: formData.notes || null,
          aftermarket_autograph: formData.aftermarket_autograph,
          grading_agency: formData.grading_agency || null,
          grade: formData.grade || null,
          grade_id: formData.grade_id || null
        }

        onCardUpdated(updatedCard)
      }

      onClose()
    } catch (err) {
      error('Failed to update card: ' + (err.response?.data?.error || err.message))
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen || !card) return null

  return createPortal(
    <div className="quick-edit-overlay" onClick={onClose}>
      <div className="quick-edit-modal" onClick={e => e.stopPropagation()}>
        <div className="quick-edit-header">
          <div className="quick-edit-card-info">
            <div className="quick-edit-title">
              <h3>Edit Card #{card.card_number}</h3>
            </div>
            <div className="quick-edit-details">
              <div className="quick-edit-players">
                {card.card_player_teams?.map((cpt, index) => (
                  <div key={index} className="quick-edit-player-item">
                    {cpt.team && (
                      <div
                        className="team-circle-base team-circle-sm"
                        style={{
                          '--primary-color': cpt.team.primary_color || '#333',
                          '--secondary-color': cpt.team.secondary_color || '#666'
                        }}
                        title={cpt.team.name}
                      >
                        {cpt.team.abbreviation}
                      </div>
                    )}
                    <span className="quick-edit-player-name">
                      {cpt.player?.first_name} {cpt.player?.last_name}
                      {card.is_rookie && <span className="cardcard-tag cardcard-rc cardcard-rc-inline"> RC</span>}
                    </span>
                  </div>
                ))}
              </div>
              <div className="quick-edit-series">
                {card.series_rel?.name}
              </div>
            </div>
          </div>
          <button className="quick-edit-close" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="quick-edit-form">
          {/* Basic Info Section */}
          <div className="quick-edit-row quick-edit-two-col">
            <label>
              Random Code
              <input
                type="text"
                name="random_code"
                value={formData.random_code}
                onChange={handleInputChange}
                placeholder="e.g., ABCD"
              />
            </label>
            {card?.print_run && (
              <label>
                Serial Number
                <div className="serial-input-wrapper">
                  <input
                    type="text"
                    name="serial_number"
                    value={formData.serial_number}
                    onChange={handleInputChange}
                    placeholder="e.g., 25"
                    className="serial-number-input"
                  />
                  <span className="serial-suffix">/{card.print_run}</span>
                </div>
              </label>
            )}
          </div>

          <div className="quick-edit-row">
            <label>
              Location
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
            </label>
          </div>

          <div className="section-divider"></div>

          {/* Pricing Section */}
          <div className="quick-edit-section">
            <div className="quick-edit-section-header">
              <button
                type="button"
                className="section-toggle"
                onClick={() => setShowPricing(!showPricing)}
              >
                <Icon name={showPricing ? 'chevron-down' : 'chevron-right'} size={16} />
                Pricing & Value
              </button>
            </div>
            {showPricing && (
              <div className="quick-edit-row quick-edit-two-col">
                <label>
                  Purchase Price
                  <div className="currency-input-wrapper">
                    <span className="currency-prefix">$</span>
                    <input
                      type="text"
                      name="purchase_price"
                      value={formData.purchase_price}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      pattern="[0-9]+(\.[0-9]{1,2})?"
                    />
                  </div>
                </label>
                <label>
                  Estimated Value
                  <div className="currency-input-wrapper">
                    <span className="currency-prefix">$</span>
                    <input
                      type="text"
                      name="estimated_value"
                      value={formData.estimated_value}
                      onChange={handleInputChange}
                      placeholder="0.00"
                      pattern="[0-9]+(\.[0-9]{1,2})?"
                    />
                  </div>
                </label>
              </div>
            )}
          </div>

          <div className="section-divider"></div>

          {/* Grading Section */}
          <div className="quick-edit-section">
            <div className="quick-edit-section-header">
              <button
                type="button"
                className="section-toggle"
                onClick={() => setShowGrading(!showGrading)}
              >
                <Icon name={showGrading ? 'chevron-down' : 'chevron-right'} size={16} />
                Grading Information
              </button>
            </div>
            {showGrading && (
              <div className="quick-edit-grading-content">
                <div className="quick-edit-row">
                  <label>
                    Grading Agency
                    <select
                      name="grading_agency"
                      value={formData.grading_agency}
                      onChange={handleInputChange}
                    >
                      <option value="">None</option>
                      {gradingAgencies.map(agency => (
                        <option key={agency.grading_agency_id} value={agency.grading_agency_id}>
                          {agency.abbreviation ? `${agency.abbreviation} - ${agency.name}` : agency.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <div className="quick-edit-row quick-edit-two-col">
                  <label>
                    Grade
                    <input
                      type="text"
                      name="grade"
                      value={formData.grade}
                      onChange={handleInputChange}
                      placeholder="e.g., 9.5"
                    />
                  </label>
                  <label>
                    Grade ID
                    <input
                      type="text"
                      name="grade_id"
                      value={formData.grade_id}
                      onChange={handleInputChange}
                      placeholder="Certificate #"
                    />
                  </label>
                </div>
              </div>
            )}
          </div>

          <div className="section-divider"></div>

          {/* Photos Section */}
          <div className="quick-edit-section">
            <div className="quick-edit-section-header">
              <button
                type="button"
                className="section-toggle"
                onClick={() => setShowPhotos(!showPhotos)}
              >
                <Icon name={showPhotos ? 'chevron-down' : 'chevron-right'} size={16} />
                Card Photos ({existingPhotos.length + selectedPhotos.length}/5)
              </button>
            </div>
            {showPhotos && (
              <div className="quick-edit-photos-section">
                {/* Photo Grid */}
                <div className="photo-grid">
                  {/* Existing photos */}
                  {existingPhotos.map((photo, index) => (
                    <div key={photo.user_card_photo_id} className="photo-preview-item existing">
                      <div className="photo-preview">
                        <img
                          src={photo.photo_url}
                          alt={`Card photo ${photo.sort_order}`}
                          onClick={() => handleImageClick(photo)}
                          className="photo-clickable"
                          title="Click to edit image"
                        />
                        {photo.sort_order === 1 && (
                          <div className="primary-badge">Primary</div>
                        )}
                        <div className="photo-controls">
                          <button
                            type="button"
                            className="remove-photo"
                            onClick={(e) => {
                              e.stopPropagation()
                              deleteExistingPhoto(photo.user_card_photo_id)
                            }}
                            disabled={saving || deletingPhotoId === photo.user_card_photo_id || uploadingPhotos}
                            title="Delete photo"
                          >
                            {deletingPhotoId === photo.user_card_photo_id ? (
                              <div className="card-icon-spinner tiny"></div>
                            ) : (
                              <Icon name="x" size={14} />
                            )}
                          </button>
                        </div>
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
                          disabled={saving || uploadingPhotos}
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
                          id="photo-upload-quick-edit"
                          disabled={saving || uploadingPhotos}
                        />
                        <label htmlFor="photo-upload-quick-edit" className="photo-upload-inline">
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

          <div className="section-divider"></div>

          {/* Notes */}
          <div className="quick-edit-row">
            <label>
              Notes
              <textarea
                name="notes"
                value={formData.notes}
                onChange={handleInputChange}
                rows="2"
                placeholder="Add any notes about this card..."
              />
            </label>
          </div>

          {/* Simple aftermarket checkbox */}
          <div className="aftermarket-checkbox-row">
            <label className="simple-checkbox-label">
              <input
                type="checkbox"
                name="aftermarket_autograph"
                checked={formData.aftermarket_autograph}
                onChange={handleInputChange}
              />
              Aftermarket Autograph
            </label>
          </div>

          <div className="quick-edit-actions">
            <button type="button" onClick={onClose} className="btn-cancel">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-save">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

        {/* Image Editor Modal */}
        <ImageEditor
          isOpen={showImageEditor}
          onClose={handleImageEditorClose}
          imageUrl={selectedImage?.photo_url}
          onSave={handleImageSave}
          title={`Edit Photo ${selectedImage?.sort_order || ''}`}
        />
      </div>
    </div>,
    document.body
  )
}

export default QuickEditModal