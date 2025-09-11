import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import './BulkCardModal.css'

function BulkCardModal({ 
  isOpen, 
  onClose, 
  series,
  selectedCardIds,
  selectedCards,
  onComplete
}) {
  const { addToast } = useToast()
  const { user } = useAuth()
  
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [newLocationName, setNewLocationName] = useState('')
  const [showNewLocationInput, setShowNewLocationInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  useEffect(() => {
    if (isOpen && user) {
      loadUserLocations()
    }
  }, [isOpen, user])

  const loadUserLocations = async () => {
    try {
      const response = await axios.get('/api/user/locations')
      const userLocations = response.data.locations || []
      setLocations(userLocations)
      
      // Set first location as default
      if (userLocations.length > 0) {
        setSelectedLocation(userLocations[0].user_location_id.toString())
      }
    } catch (error) {
      console.error('Error loading locations:', error)
      addToast('Failed to load locations', 'error')
    }
  }

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      addToast('Please enter a location name', 'error')
      return
    }

    try {
      const response = await axios.post('/api/user/locations', {
        location: newLocationName.trim()
      })
      
      const newLocation = response.data.location
      setLocations([...locations, newLocation])
      setSelectedLocation(newLocation.user_location_id.toString())
      setNewLocationName('')
      setShowNewLocationInput(false)
      addToast('Location created successfully', 'success')
    } catch (error) {
      console.error('Error creating location:', error)
      addToast(error.response?.data?.message || 'Failed to create location', 'error')
    }
  }

  const handleAddCardsToCollection = async () => {
    try {
      setIsSubmitting(true)
      
      // Add each selected card to collection
      const promises = selectedCardIds.map(cardId => 
        axios.post('/api/user/cards', {
          card_id: cardId,
          user_location: selectedLocation ? parseInt(selectedLocation) : null,
          notes: `Added via bulk selection from ${series.name}`
        })
      )

      await Promise.all(promises)
      
      addToast(`Successfully added ${selectedCardIds.length} cards to your collection`, 'success')
      onComplete?.()
      onClose()
    } catch (error) {
      console.error('Error adding cards to collection:', error)
      addToast(error.response?.data?.message || 'Failed to add cards to collection', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bulk-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add {selectedCardIds.length} cards to your collection</h3>
          <button className="modal-close-btn" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="modal-form">
          {/* Series Info */}
          <div className="series-info">
            <div className="series-info-header">
              <h4>{series?.name}</h4>
              <p className="series-card-count">
                Adding <strong>{selectedCardIds.length}</strong> cards from this series
              </p>
            </div>
          </div>

          {/* Selected Cards List */}
          <div className="selected-cards-section">
            <h5>Selected Cards:</h5>
            <div className="selected-cards-list">
              {selectedCards.map(card => (
                <div key={card.card_id} className="selected-card-item">
                  <span className="card-number">#{card.card_number}</span>
                  <div className="card-players">
                    {card.card_player_teams?.map((cpt, index) => (
                      <div key={index} className="player-info">
                        {cpt.team && (
                          <div 
                            className="team-circle"
                            style={{
                              backgroundColor: cpt.team.primary_color || '#333',
                              borderColor: cpt.team.secondary_color || '#666',
                              color: '#fff'
                            }}
                            title={cpt.team.name}
                          >
                            {cpt.team.abbreviation || cpt.team.name?.slice(0, 3).toUpperCase()}
                          </div>
                        )}
                        <span className="player-name">
                          {cpt.player?.first_name} {cpt.player?.last_name}
                        </span>
                      </div>
                    )) || <span className="no-player">No player assigned</span>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Location Selection */}
          <div className="location-section">
            <label htmlFor="location-select">Assign all cards to location:</label>
            
            <div className="location-controls">
              {!showNewLocationInput ? (
                <div className="location-select-row">
                  <select 
                    id="location-select"
                    value={selectedLocation} 
                    onChange={(e) => setSelectedLocation(e.target.value)}
                    className="form-select"
                  >
                    <option value="">No location</option>
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
          </div>
        </div>

        <div className="modal-actions">
          <button 
            type="button" 
            className="button-secondary" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="button" 
            className="button-primary"
            onClick={handleAddCardsToCollection}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <div className="card-icon-spinner small"></div>
                Adding...
              </>
            ) : (
              `Add ${selectedCardIds.length} Cards`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default BulkCardModal