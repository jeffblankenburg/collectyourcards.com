import React, { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import UniversalCardTable from '../components/UniversalCardTable'
import Icon from '../components/Icon'
import axios from 'axios'
import './CollectionDashboard.css'

function CollectionDashboard() {
  const { isAuthenticated, user } = useAuth()
  const { success, error } = useToast()
  
  const [dashboardStats, setDashboardStats] = useState({
    total_cards: 0,
    total_value: 0,
    unique_players: 0,
    unique_series: 0,
    rookie_cards: 0,
    autograph_cards: 0,
    relic_cards: 0,
    graded_cards: 0
  })
  
  const [locations, setLocations] = useState([])
  const [selectedLocationIds, setSelectedLocationIds] = useState([])
  const [loading, setLoading] = useState(true)
  const [showLocationModal, setShowLocationModal] = useState(false)
  const [showManageLocationsModal, setShowManageLocationsModal] = useState(false)
  const [newLocationName, setNewLocationName] = useState('')
  const [deletingLocationId, setDeletingLocationId] = useState(null)
  const [editingLocationId, setEditingLocationId] = useState(null)
  const [editingLocationName, setEditingLocationName] = useState('')
  const [reassignLocationId, setReassignLocationId] = useState('')
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [locationToDelete, setLocationToDelete] = useState(null)

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData()
      fetchLocations()
    }
  }, [isAuthenticated])

  // Auto-select dashboard locations when locations load
  useEffect(() => {
    const dashboardLocations = locations.filter(loc => loc.is_dashboard)
    setSelectedLocationIds(dashboardLocations.map(loc => loc.user_location_id))
  }, [locations])

  const fetchDashboardData = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/user/collection/stats')
      setDashboardStats(response.data.stats || {})
    } catch (err) {
      console.error('Error fetching dashboard stats:', err)
      error('Failed to load collection statistics')
    } finally {
      setLoading(false)
    }
  }

  const fetchLocations = async () => {
    try {
      const response = await axios.get('/api/user/locations')
      setLocations(response.data.locations || [])
    } catch (err) {
      console.error('Error fetching locations:', err)
      error('Failed to load locations')
    }
  }

  const handleCreateLocation = async () => {
    if (!newLocationName.trim()) {
      error('Location name is required')
      return
    }

    try {
      await axios.post('/api/user/locations', {
        location: newLocationName.trim(),
        is_dashboard: true // New locations default to dashboard visible
      })
      
      setNewLocationName('')
      setShowLocationModal(false)
      success('Location created successfully')
      await fetchLocations()
    } catch (err) {
      console.error('Error creating location:', err)
      error('Failed to create location')
    }
  }

  const handleLocationToggle = (locationId) => {
    setSelectedLocationIds(prev => {
      if (prev.includes(locationId)) {
        return prev.filter(id => id !== locationId)
      } else {
        return [...prev, locationId]
      }
    })
  }

  const handleToggleDashboardVisibility = async (locationId, currentVisibility) => {
    try {
      const location = locations.find(loc => loc.user_location_id === locationId)
      
      await axios.put(`/api/user/locations/${locationId}`, {
        location: location.location,
        is_dashboard: !currentVisibility
      })
      
      success(`Location ${!currentVisibility ? 'added to' : 'removed from'} dashboard`)
      await fetchLocations()
    } catch (err) {
      console.error('Error updating location:', err)
      error('Failed to update location visibility')
    }
  }

  const handleEditLocation = (location) => {
    setEditingLocationId(location.user_location_id)
    setEditingLocationName(location.location)
  }

  const handleSaveLocationName = async (locationId) => {
    if (!editingLocationName.trim()) {
      error('Location name cannot be empty')
      return
    }

    try {
      const location = locations.find(loc => loc.user_location_id === locationId)
      
      await axios.put(`/api/user/locations/${locationId}`, {
        location: editingLocationName.trim(),
        is_dashboard: location.is_dashboard
      })
      
      success('Location name updated successfully')
      await fetchLocations()
      setEditingLocationId(null)
      setEditingLocationName('')
    } catch (err) {
      console.error('Error updating location:', err)
      error('Failed to update location name')
    }
  }

  const handleCancelEdit = () => {
    setEditingLocationId(null)
    setEditingLocationName('')
  }

  const handleDeleteLocation = async (location) => {
    if (location.card_count > 0) {
      // Show reassign modal
      setLocationToDelete(location)
      setShowReassignModal(true)
      return
    }
    
    // Direct delete if no cards
    try {
      setDeletingLocationId(location.user_location_id)
      await axios.delete(`/api/user/locations/${location.user_location_id}`)
      success(`Location "${location.location}" deleted successfully`)
      await fetchLocations()
      
      // Remove from selected locations if it was selected
      setSelectedLocationIds(prev => prev.filter(id => id !== location.user_location_id))
    } catch (err) {
      console.error('Error deleting location:', err)
      error('Failed to delete location')
    } finally {
      setDeletingLocationId(null)
    }
  }

  const handleReassignAndDelete = async () => {
    if (!reassignLocationId) {
      error('Please select a location to reassign cards to')
      return
    }

    if (reassignLocationId === locationToDelete.user_location_id) {
      error('Cannot reassign cards to the same location')
      return
    }

    try {
      setDeletingLocationId(locationToDelete.user_location_id)
      
      // Call API to reassign and delete
      await axios.delete(`/api/user/locations/${locationToDelete.user_location_id}`, {
        data: { reassign_to: reassignLocationId }
      })
      
      success(`Cards reassigned and location "${locationToDelete.location}" deleted successfully`)
      
      // Refresh locations and stats
      await fetchLocations()
      await fetchDashboardData()
      
      // Remove from selected locations if it was selected
      setSelectedLocationIds(prev => prev.filter(id => id !== locationToDelete.user_location_id))
      
      // Close modal and reset
      setShowReassignModal(false)
      setLocationToDelete(null)
      setReassignLocationId('')
    } catch (err) {
      console.error('Error reassigning and deleting location:', err)
      error('Failed to reassign cards and delete location')
    } finally {
      setDeletingLocationId(null)
    }
  }

  // Memoize the API endpoint for filtered cards
  const apiEndpoint = useMemo(() => {
    if (selectedLocationIds.length === 0) {
      // Show unassigned cards when no locations are selected
      return `/api/user/collection/cards?unassigned=true`
    }
    
    const locationParams = selectedLocationIds.map(id => `location_id=${id}`).join('&')
    return `/api/user/collection/cards?${locationParams}`
  }, [selectedLocationIds])

  if (!isAuthenticated) {
    return (
      <div className="collection-dashboard">
        <div className="auth-required">
          <Icon name="lock" size={48} />
          <h2>Authentication Required</h2>
          <p>Please log in to view your card collection dashboard.</p>
        </div>
      </div>
    )
  }

  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value || 0)
  }

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value || 0)
  }

  return (
    <div className="collection-dashboard">
      <div className="dashboard-container">
        
        {/* Compact Header with Integrated Stats */}
        <header className="dashboard-header">
          <div className="header-top">
            <div className="header-title">
              <Icon name="collections" size={24} className="title-icon" />
              <h1 className="dashboard-title">My Collection</h1>
            </div>
          </div>
          
          <div className="header-stats">
            <div className="stat-item">
              <Icon name="layers" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(dashboardStats.total_cards)}</span>
                <span className="stat-label">Cards</span>
              </div>
            </div>
            <div className="stat-item">
              <Icon name="value" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatCurrency(dashboardStats.total_value)}</span>
                <span className="stat-label">Value</span>
              </div>
            </div>
            <div className="stat-item">
              <Icon name="user" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(dashboardStats.unique_players)}</span>
                <span className="stat-label">Players</span>
              </div>
            </div>
            <div className="stat-item">
              <Icon name="star" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(dashboardStats.rookie_cards)}</span>
                <span className="stat-label">Rookies</span>
              </div>
            </div>
            <div className="stat-item">
              <Icon name="edit" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(dashboardStats.autograph_cards)}</span>
                <span className="stat-label">Autos</span>
              </div>
            </div>
            <div className="stat-item">
              <Icon name="shield" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(dashboardStats.relic_cards)}</span>
                <span className="stat-label">Relics</span>
              </div>
            </div>
            <div className="stat-item">
              <Icon name="trophy" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(dashboardStats.graded_cards)}</span>
                <span className="stat-label">Graded</span>
              </div>
            </div>
          </div>
        </header>

        {/* Location Tags */}
        <section className="location-tags-section">
          <div className="location-tags">
            <button 
              className="add-location-btn icon-only"
              onClick={() => setShowLocationModal(true)}
              title="Add new location"
            >
              <Icon name="plus" size={16} />
            </button>
            {locations.map(location => (
              <div
                key={location.user_location_id}
                className={`location-tag ${
                  selectedLocationIds.includes(location.user_location_id) ? 'active' : ''
                } ${location.is_dashboard ? 'dashboard' : ''}`}
                onClick={() => handleLocationToggle(location.user_location_id)}
                title={`${location.card_count} cards${location.is_dashboard ? ' • Dashboard location' : ''}`}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    handleLocationToggle(location.user_location_id)
                  }
                }}
              >
                <Icon name="map" size={14} />
                <span className="tag-name">{location.location}</span>
                <span className="tag-count">({formatNumber(location.card_count)})</span>
                {location.is_dashboard && (
                  <button
                    className="dashboard-indicator"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleDashboardVisibility(location.user_location_id, location.is_dashboard)
                    }}
                    title="Remove from dashboard"
                  >
                    <Icon name="eye" size={12} />
                  </button>
                )}
                {!location.is_dashboard && (
                  <button
                    className="dashboard-indicator hidden"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleToggleDashboardVisibility(location.user_location_id, location.is_dashboard)
                    }}
                    title="Add to dashboard"
                  >
                    <Icon name="eye-off" size={12} />
                  </button>
                )}
              </div>
            ))}
            {locations.length > 0 && (
              <button 
                className="manage-locations-btn icon-only"
                onClick={() => setShowManageLocationsModal(true)}
                title="Manage locations"
              >
                <Icon name="settings" size={16} />
              </button>
            )}
          </div>
        </section>

        {/* Collection Table */}
        <section className="collection-table-section">
          {selectedLocationIds.length === 0 && (
            <div className="unassigned-cards-header">
              <Icon name="alert-circle" size={20} />
              <span>Showing cards without assigned locations</span>
            </div>
          )}
          <UniversalCardTable
            apiEndpoint={apiEndpoint}
            showPlayer={true}
            showTeam={true}
            showSeries={true}
            defaultSort="series_name"
            downloadFilename={`my-collection-${selectedLocationIds.length === 0 ? 'unassigned-cards' : 'location-cards'}`}
            showSearch={true}
            showOwned={false}
            showAddButtons={false}
            isCollectionView={true}
            showCollectionColumns={true}
          />
        </section>
      </div>

      {/* Add Location Modal */}
      {showLocationModal && (
        <div className="modal-overlay" onClick={() => setShowLocationModal(false)}>
          <div className="add-location-modal" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <button 
                className="modal-close"
                onClick={() => setShowLocationModal(false)}
              >
                <Icon name="x" size={20} />
              </button>
              
              <div className="card-info">
                <h2 className="modal-title">Add New Location</h2>
                <p className="modal-subtitle">Create a location to organize your card collection</p>
              </div>
            </div>
            
            <div className="form-section main-fields">
              <div className="form-group full-width">
                <label>Location Name</label>
                <input
                  type="text"
                  value={newLocationName}
                  onChange={(e) => setNewLocationName(e.target.value)}
                  placeholder="e.g., Basement Storage, Office Display, Card Vault..."
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleCreateLocation()
                    }
                  }}
                />
                <div className="form-help">
                  Choose a name that helps you remember where these cards are physically stored.
                </div>
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                className="btn-cancel"
                onClick={() => setShowLocationModal(false)}
              >
                Cancel
              </button>
              <button 
                className="btn-submit"
                onClick={handleCreateLocation}
              >
                Create Location
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manage Locations Modal */}
      {showManageLocationsModal && (
        <div className="modal-overlay" onClick={() => setShowManageLocationsModal(false)}>
          <div className="manage-locations-modal" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <button 
                className="modal-close"
                onClick={() => setShowManageLocationsModal(false)}
              >
                <Icon name="x" size={20} />
              </button>
              
              <div className="card-info">
                <h2 className="modal-title">Manage Locations</h2>
                <p className="modal-subtitle">Edit or delete your card storage locations</p>
              </div>
            </div>
            
            <div className="locations-list">
              {locations.length === 0 ? (
                <div className="empty-locations">
                  <Icon name="map-pin" size={48} />
                  <p>No locations created yet</p>
                </div>
              ) : (
                locations.map(location => (
                  <div key={location.user_location_id} className="location-item">
                    <div className="location-info">
                      {editingLocationId === location.user_location_id ? (
                        <div className="edit-location-name">
                          <input
                            type="text"
                            value={editingLocationName}
                            onChange={(e) => setEditingLocationName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                handleSaveLocationName(location.user_location_id)
                              } else if (e.key === 'Escape') {
                                handleCancelEdit()
                              }
                            }}
                            autoFocus
                            className="edit-input"
                          />
                          <button
                            className="btn-icon save"
                            onClick={() => handleSaveLocationName(location.user_location_id)}
                            title="Save"
                          >
                            <Icon name="check" size={16} />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={handleCancelEdit}
                            title="Cancel"
                          >
                            <Icon name="x" size={16} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div className="location-name">
                            {location.location}
                          </div>
                          <div className="location-stats">
                            {location.card_count} cards
                            {location.is_dashboard && (
                              <span className="dashboard-badge">
                                <Icon name="eye" size={12} />
                                Dashboard
                              </span>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                    <div className="location-actions">
                      {editingLocationId !== location.user_location_id && (
                        <>
                          <button
                            className="btn-icon"
                            onClick={() => handleEditLocation(location)}
                            title="Edit name"
                          >
                            <Icon name="edit" size={16} />
                          </button>
                          <button
                            className="btn-icon"
                            onClick={() => handleToggleDashboardVisibility(location.user_location_id, location.is_dashboard)}
                            title={location.is_dashboard ? 'Remove from dashboard' : 'Add to dashboard'}
                          >
                            <Icon name={location.is_dashboard ? 'eye-off' : 'eye'} size={16} />
                          </button>
                          <button
                            className="btn-icon delete"
                            onClick={() => handleDeleteLocation(location)}
                            disabled={deletingLocationId === location.user_location_id}
                            title="Delete location"
                          >
                            {deletingLocationId === location.user_location_id ? (
                              <Icon name="activity" size={16} className="spinner" />
                            ) : (
                              <Icon name="trash" size={16} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
            
            <div className="form-actions">
              <button 
                className="btn-submit full-width"
                onClick={() => setShowManageLocationsModal(false)}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Cards Modal */}
      {showReassignModal && locationToDelete && (
        <div className="modal-overlay" onClick={() => setShowReassignModal(false)}>
          <div className="reassign-modal" onClick={e => e.stopPropagation()}>
            <div className="card-header">
              <button 
                className="modal-close"
                onClick={() => {
                  setShowReassignModal(false)
                  setLocationToDelete(null)
                  setReassignLocationId('')
                }}
              >
                <Icon name="x" size={20} />
              </button>
              
              <div className="card-info">
                <h2 className="modal-title">Reassign Cards</h2>
                <p className="modal-subtitle">
                  "{locationToDelete.location}" contains {locationToDelete.card_count} cards
                </p>
              </div>
            </div>
            
            <div className="form-section main-fields">
              <div className="reassign-message">
                <Icon name="alert-triangle" size={24} />
                <p>
                  Before deleting this location, you need to reassign the {locationToDelete.card_count} cards 
                  to another location.
                </p>
              </div>
              
              <div className="form-group full-width">
                <label>Reassign cards to:</label>
                <select
                  value={reassignLocationId}
                  onChange={(e) => setReassignLocationId(e.target.value)}
                  autoFocus
                >
                  <option value="">Select a location...</option>
                  {locations
                    .filter(loc => loc.user_location_id !== locationToDelete.user_location_id)
                    .map(location => (
                      <option key={location.user_location_id} value={location.user_location_id}>
                        {location.location} ({location.card_count} cards)
                      </option>
                    ))}
                </select>
              </div>
            </div>
            
            <div className="form-actions">
              <button 
                className="btn-cancel"
                onClick={() => {
                  setShowReassignModal(false)
                  setLocationToDelete(null)
                  setReassignLocationId('')
                }}
              >
                Cancel
              </button>
              <button 
                className="btn-submit delete"
                onClick={handleReassignAndDelete}
                disabled={!reassignLocationId || deletingLocationId}
              >
                {deletingLocationId ? (
                  <>
                    <Icon name="activity" size={16} className="spinner" />
                    Reassigning...
                  </>
                ) : (
                  <>
                    Reassign & Delete
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CollectionDashboard