import React, { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import './SeriesActionsModal.css'

function SeriesActionsModal({ 
  isOpen, 
  onClose, 
  series, 
  action, // 'add' or 'remove'
  onSuccess 
}) {
  const { addToast } = useToast()
  const { user } = useAuth()
  
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [newLocationName, setNewLocationName] = useState('')
  const [showNewLocationInput, setShowNewLocationInput] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [cardsInSeries, setCardsInSeries] = useState([])
  const [loadingCards, setLoadingCards] = useState(false)
  
  useEffect(() => {
    if (isOpen && user) {
      loadUserLocations()
      if (series) {
        loadSeriesCards()
      }
    }
  }, [isOpen, user, series])

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

  const loadSeriesCards = async () => {
    try {
      setLoadingCards(true)
      const seriesId = series.series_id || series.id
      const response = await axios.get(`/api/cards?series_id=${seriesId}&limit=10000`)
      setCardsInSeries(response.data.cards || [])
    } catch (error) {
      console.error('Error loading series cards:', error)
      addToast('Failed to load series cards', 'error')
    } finally {
      setLoadingCards(false)
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

  const handleAddSeriesToCollection = async () => {
    if (!selectedLocation && action === 'add') {
      addToast('Please select a location', 'error')
      return
    }

    try {
      setIsSubmitting(true)
      
      // Add one copy of each card to collection
      const promises = cardsInSeries.map(card => 
        axios.post('/api/user/cards', {
          card_id: card.card_id,
          user_location: selectedLocation ? parseInt(selectedLocation) : null,
          notes: `Added via series bulk action: ${series.name}`
        })
      )

      await Promise.all(promises)
      
      addToast(`Successfully added ${cardsInSeries.length} cards from ${series.name} to your collection`, 'success')
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Error adding series to collection:', error)
      addToast(error.response?.data?.message || 'Failed to add series to collection', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRemoveSeriesFromCollection = async () => {
    try {
      setIsSubmitting(true)
      
      // Get user's cards for this series
      const seriesId = series.series_id || series.id
      const response = await axios.get(`/api/user/collection/cards?series_id=${seriesId}`)
      const userCards = response.data.cards || []
      
      // Filter to only basic cards (no graded, no aftermarket autos)
      const basicCards = userCards.filter(card => 
        !card.grade && // Not graded
        !card.grade_id && // Not graded
        !card.aftermarket_autograph && // Not aftermarket autograph
        !card.grading_agency // Not graded
      )

      if (basicCards.length === 0) {
        addToast('No basic cards found to remove from this series', 'info')
        onClose()
        return
      }

      // Group by card_id and remove only the first copy of each
      const cardGroups = basicCards.reduce((groups, card) => {
        if (!groups[card.card_id]) {
          groups[card.card_id] = []
        }
        groups[card.card_id].push(card)
        return groups
      }, {})

      // Remove one copy of each unique card
      const cardsToRemove = Object.values(cardGroups).map(group => 
        group.sort((a, b) => new Date(a.created) - new Date(b.created))[0] // Oldest first
      )

      const deletePromises = cardsToRemove.map(card => 
        axios.delete(`/api/user/cards/${card.user_card_id}`)
      )

      await Promise.all(deletePromises)
      
      addToast(`Successfully removed ${cardsToRemove.length} basic cards from ${series.name}`, 'success')
      onSuccess?.()
      onClose()
    } catch (error) {
      console.error('Error removing series from collection:', error)
      addToast(error.response?.data?.message || 'Failed to remove series from collection', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    if (action === 'add') {
      handleAddSeriesToCollection()
    } else if (action === 'remove') {
      handleRemoveSeriesFromCollection()
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content series-actions-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>
            {action === 'add' ? 'Add Series to Collection' : 'Remove Series from Collection'}
          </h3>
          <button className="modal-close-btn" onClick={onClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="modal-form">
          <div className="series-info">
            <div className="series-info-header">
              <h4>{series?.full_name || series?.name}</h4>
              {series?.set_name && series?.full_name !== series?.set_name && (
                <p className="series-set-name">From {series.set_name}</p>
              )}
            </div>
            {loadingCards ? (
              <p className="series-card-count loading">
                <div className="card-icon-spinner tiny"></div>
                Loading cards...
              </p>
            ) : (
              <p className="series-card-count">
                <strong>{cardsInSeries.length}</strong> cards in this series
              </p>
            )}
          </div>

          {action === 'add' && (
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
          )}

          {action === 'remove' && (
            <div className="remove-info">
              <p className="warning-text">
                <Icon name="alert-triangle" size={16} />
                This will remove one copy of each card from this series. 
                Only basic cards will be removed - graded cards and aftermarket autographs will be kept.
              </p>
            </div>
          )}
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
            className={`button-primary ${action === 'remove' ? 'button-danger' : ''}`}
            onClick={handleSubmit}
            disabled={isSubmitting || loadingCards}
          >
            {isSubmitting ? (
              <>
                <div className="card-icon-spinner small"></div>
                {action === 'add' ? 'Adding...' : 'Removing...'}
              </>
            ) : (
              action === 'add' ? 'Add to Collection' : 'Remove from Collection'
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default SeriesActionsModal