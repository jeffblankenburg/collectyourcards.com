import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useToast } from '../../contexts/ToastContext'
import axios from 'axios'
import Icon from '../Icon'
import ImageEditor from '../ImageEditor'
import './QuickEditModal.css' // Use QuickEdit styles

const AddCardModal = ({ 
  isOpen, 
  onClose, 
  card, 
  onCardAdded 
}) => {
  const { success, error } = useToast()
  const [saving, setSaving] = useState(false)
  const [locations, setLocations] = useState([])
  const [gradingAgencies, setGradingAgencies] = useState([])
  const [showPricing, setShowPricing] = useState(true)
  const [showGrading, setShowGrading] = useState(false)
  const [showPhotos, setShowPhotos] = useState(false)
  
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
    purchase_price: '',
    estimated_value: '',
    notes: '',
    aftermarket_autograph: false,
    grading_agency: '',
    grade: '',
    grade_id: ''
  })
  
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [uploadingPhotos, setUploadingPhotos] = useState(false)
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [selectedImage, setSelectedImage] = useState(null)

  useEffect(() => {
    if (card && isOpen) {
      // Reset form for new card
      setFormData({
        random_code: generateRandomCode(),
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
      
      // Reset sections
      setShowGrading(false)
      setShowPricing(true)
      setShowPhotos(false)
      setSelectedPhotos([])
      
      // Load data
      loadLocations()
      loadGradingAgencies()
    }
  }, [card, isOpen])

  const loadLocations = async () => {
    try {
      const response = await axios.get('/api/user/locations')
      setLocations(response.data.locations || [])
    } catch (err) {
      console.error('Error loading locations:', err)
      setLocations([])
    }
  }

  const loadGradingAgencies = async () => {
    try {
      const response = await axios.get('/api/grading-agencies')
      setGradingAgencies(response.data.agencies || [])
    } catch (err) {
      console.error('Error loading grading agencies:', err)
      setGradingAgencies([])
    }
  }

  const handlePhotoSelect = (event) => {
    const files = Array.from(event.target.files)
    const currentTotal = selectedPhotos.length
    
    // Check total limit
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
      
      if (file.size > 10 * 1024 * 1024) {
        error(`${file.name}: File size must be less than 10MB`)
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

  const uploadNewPhotos = async (userCardId) => {
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
        setSelectedPhotos([])
      }
    } catch (err) {
      console.error('Error uploading photos:', err)
      error(err.response?.data?.message || 'Failed to upload photos')
    } finally {
      setUploadingPhotos(false)
    }
  }

  const handleImageClick = (photo, index) => {
    // Create a mock photo object with URL from File
    const mockPhoto = {
      photo_url: URL.createObjectURL(photo),
      sort_order: index + 1
    }
    setSelectedImage(mockPhoto)
    setShowImageEditor(true)
  }

  const handleImageEditorClose = () => {
    setShowImageEditor(false)
    if (selectedImage?.photo_url) {
      URL.revokeObjectURL(selectedImage.photo_url)
    }
    setSelectedImage(null)
  }

  const handleImageSave = async (editedImageBlob) => {
    if (!selectedImage || !editedImageBlob) return

    try {
      // Find the index of the image being edited
      const imageIndex = selectedImage.sort_order - 1
      
      // Create new file from blob
      const editedFile = new File([editedImageBlob], `edited-photo-${imageIndex}.jpg`, {
        type: 'image/jpeg'
      })
      
      // Replace the file in selectedPhotos array
      setSelectedPhotos(prev => {
        const newPhotos = [...prev]
        newPhotos[imageIndex] = editedFile
        return newPhotos
      })
      
      success('Photo updated successfully')
      handleImageEditorClose()
    } catch (err) {
      console.error('Error updating photo:', err)
      error('Failed to update photo')
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
      const newUserCard = response.data
      const newUserCardId = newUserCard.user_card_id
      
      // Upload photos if any were selected
      if (selectedPhotos.length > 0) {
        await uploadNewPhotos(newUserCardId)
      }
      
      success(`Added ${card.card_number} ${card.card_player_teams?.[0]?.player ? 
        `${card.card_player_teams[0].player.first_name} ${card.card_player_teams[0].player.last_name}` : 
        'card'} to your collection`)
      
      if (onCardAdded) {
        onCardAdded(newUserCard)
      }
      
      onClose()
    } catch (err) {
      error('Failed to add card: ' + (err.response?.data?.error || err.message))
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
              <h3>Add Card #{card.card_number}</h3>
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
                      {card.is_short_print && <span className="cardcard-tag cardcard-sp cardcard-rc-inline"> SP</span>}
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
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="text"
                  name="random_code"
                  value={formData.random_code}
                  onChange={handleInputChange}
                  placeholder="e.g., ABCD"
                />
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({
                    ...prev,
                    random_code: generateRandomCode()
                  }))}
                  title="Generate new random code"
                  style={{
                    background: 'rgba(255, 255, 255, 0.1)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    borderRadius: '6px',
                    padding: '8px',
                    color: 'white',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  <Icon name="refresh-cw" size={16} />
                </button>
              </div>
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
                Card Photos ({selectedPhotos.length}/5)
              </button>
            </div>
            {showPhotos && (
              <div className="quick-edit-photos-section">
                {/* Photo Grid */}
                <div className="photo-grid">
                  {/* New photos to upload */}
                  {selectedPhotos.map((photo, index) => (
                    <div key={index} className="photo-preview-item new">
                      <div className="photo-preview">
                        <img
                          src={URL.createObjectURL(photo)}
                          alt={`Preview ${index + 1}`}
                          onClick={() => handleImageClick(photo, index)}
                          className="photo-clickable"
                          title="Click to edit image"
                          onLoad={(e) => URL.revokeObjectURL(e.target.src)}
                        />
                        {index === 0 && (
                          <div className="primary-badge">Primary</div>
                        )}
                        <div className="photo-controls">
                          <button
                            type="button"
                            className="remove-photo"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeNewPhoto(index)
                            }}
                            disabled={saving || uploadingPhotos}
                            title="Remove photo"
                          >
                            <Icon name="x" size={14} />
                          </button>
                        </div>
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
                          id="photo-upload-add-card"
                          disabled={saving || uploadingPhotos}
                        />
                        <label htmlFor="photo-upload-add-card" className="photo-upload-inline">
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
              {saving ? 'Adding...' : 'Add to Collection'}
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

export default AddCardModal