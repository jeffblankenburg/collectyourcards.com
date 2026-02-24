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

  // Action mode: 'collection' or 'list'
  const [actionMode, setActionMode] = useState('collection')

  // Collection-related state
  const [locations, setLocations] = useState([])
  const [selectedLocation, setSelectedLocation] = useState('')
  const [newLocationName, setNewLocationName] = useState('')
  const [showNewLocationInput, setShowNewLocationInput] = useState(false)

  // List-related state
  const [lists, setLists] = useState([])
  const [selectedList, setSelectedList] = useState('')
  const [newListName, setNewListName] = useState('')
  const [showNewListInput, setShowNewListInput] = useState(false)
  const [loadingLists, setLoadingLists] = useState(false)

  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isOpen && user) {
      loadUserLocations()
      loadUserLists()
    }
  }, [isOpen, user])

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setActionMode('collection')
      setShowNewLocationInput(false)
      setNewLocationName('')
      setShowNewListInput(false)
      setNewListName('')
    }
  }, [isOpen])

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

  const loadUserLists = async () => {
    try {
      setLoadingLists(true)
      const response = await axios.get('/api/user/lists')
      setLists(response.data.lists || [])
    } catch (error) {
      console.error('Error loading lists:', error)
      addToast('Failed to load lists', 'error')
    } finally {
      setLoadingLists(false)
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

  const handleCreateList = async () => {
    if (!newListName.trim()) {
      addToast('Please enter a list name', 'error')
      return
    }

    try {
      const response = await axios.post('/api/user/lists', {
        name: newListName.trim()
      })

      const newList = response.data.list
      setLists([...lists, newList])
      setSelectedList(newList.slug)
      setNewListName('')
      setShowNewListInput(false)
      addToast('List created successfully', 'success')
    } catch (error) {
      console.error('Error creating list:', error)
      addToast(error.response?.data?.message || 'Failed to create list', 'error')
    }
  }

  const handleAddCardsToCollection = async () => {
    try {
      setIsSubmitting(true)

      // Batch add all selected cards in a single request
      const response = await axios.post('/api/user/cards/bulk', {
        card_ids: selectedCardIds,
        user_location: selectedLocation ? parseInt(selectedLocation) : null,
        notes: `Added via bulk selection from ${series.name}`
      })

      const { added } = response.data
      addToast(`Successfully added ${added} cards to your collection`, 'success')
      onComplete?.()
      onClose()
    } catch (error) {
      console.error('Error adding cards to collection:', error)
      addToast(error.response?.data?.message || 'Failed to add cards to collection', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAddCardsToList = async () => {
    if (!selectedList) {
      addToast('Please select a list', 'error')
      return
    }

    try {
      setIsSubmitting(true)

      // Add all selected cards to the list in one request
      const response = await axios.post(`/api/user/lists/${selectedList}/cards`, {
        cardIds: selectedCardIds
      })

      const { added, duplicates, message } = response.data

      if (duplicates > 0 && added === 0) {
        addToast(message || 'All cards were already in this list', 'warning')
      } else if (duplicates > 0) {
        addToast(message || `Added ${added} cards to list (${duplicates} duplicates skipped)`, 'success')
      } else {
        addToast(message || `Successfully added ${added} cards to list`, 'success')
      }

      onComplete?.()
      onClose()
    } catch (error) {
      console.error('Error adding cards to list:', error)
      addToast(error.response?.data?.message || 'Failed to add cards to list', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSubmit = () => {
    if (actionMode === 'collection') {
      handleAddCardsToCollection()
    } else {
      handleAddCardsToList()
    }
  }

  if (!isOpen) return null

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content bulk-card-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Add {selectedCardIds.length} cards</h3>
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

          {/* Action Mode Toggle */}
          <div className="action-mode-toggle">
            <button
              type="button"
              className={`action-mode-btn ${actionMode === 'collection' ? 'active' : ''}`}
              onClick={() => setActionMode('collection')}
            >
              <Icon name="folder" size={16} />
              Add to Collection
            </button>
            <button
              type="button"
              className={`action-mode-btn ${actionMode === 'list' ? 'active' : ''}`}
              onClick={() => setActionMode('list')}
            >
              <Icon name="list" size={16} />
              Add to List
            </button>
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

          {/* Collection Mode: Location Selection */}
          {actionMode === 'collection' && (
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

          {/* List Mode: List Selection */}
          {actionMode === 'list' && (
            <div className="list-section">
              <label htmlFor="list-select">Select a list:</label>

              <div className="list-controls">
                {loadingLists ? (
                  <div className="loading-lists">Loading lists...</div>
                ) : !showNewListInput ? (
                  <div className="list-select-row">
                    <select
                      id="list-select"
                      value={selectedList}
                      onChange={(e) => setSelectedList(e.target.value)}
                      className="form-select"
                    >
                      <option value="">Select a list...</option>
                      {lists.map(list => (
                        <option key={list.user_list_id} value={list.slug}>
                          {list.name} ({list.card_count || 0} cards)
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="new-list-btn"
                      onClick={() => setShowNewListInput(true)}
                      title="Create new list"
                    >
                      <Icon name="plus" size={16} />
                    </button>
                  </div>
                ) : (
                  <div className="new-list-input">
                    <input
                      type="text"
                      placeholder="Enter list name"
                      value={newListName}
                      onChange={(e) => setNewListName(e.target.value)}
                      className="form-input"
                      onKeyPress={(e) => e.key === 'Enter' && handleCreateList()}
                      autoFocus
                    />
                    <button
                      type="button"
                      className="create-list-btn"
                      onClick={handleCreateList}
                    >
                      <Icon name="check" size={16} />
                    </button>
                    <button
                      type="button"
                      className="cancel-list-btn"
                      onClick={() => {
                        setShowNewListInput(false)
                        setNewListName('')
                      }}
                    >
                      <Icon name="x" size={16} />
                    </button>
                  </div>
                )}

                {lists.length === 0 && !loadingLists && !showNewListInput && (
                  <p className="no-lists-hint">No lists yet. Create one to get started!</p>
                )}
              </div>
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
            className="button-primary"
            onClick={handleSubmit}
            disabled={isSubmitting || (actionMode === 'list' && !selectedList)}
          >
            {isSubmitting ? (
              <>
                <div className="card-icon-spinner small"></div>
                Adding...
              </>
            ) : actionMode === 'collection' ? (
              `Add ${selectedCardIds.length} Cards to Collection`
            ) : (
              `Add ${selectedCardIds.length} Cards to List`
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default BulkCardModal