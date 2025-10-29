import React, { useState, useEffect, useMemo, useCallback, startTransition } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { useNavigate } from 'react-router-dom'
import CollectionTable from '../components/tables/CollectionTable'
import QuickEditModal from '../components/modals/QuickEditModal'
import SaveViewModal from '../components/modals/SaveViewModal'
import SavedViewsDropdown from '../components/SavedViewsDropdown'
import TeamFilterCircles from '../components/TeamFilterCircles'
import Icon from '../components/Icon'
import axios from 'axios'
import { createLogger } from '../utils/logger'
import './CollectionDashboardScoped.css'

const log = createLogger('CollectionDashboard')

function CollectionDashboard() {
  const { isAuthenticated, user } = useAuth()
  const { success, error } = useToast()

  log.info('CollectionDashboard mounted', { isAuthenticated, userId: user?.user_id })
  
  const [achievementStats, setAchievementStats] = useState({
    total_achievements: 0,
    total_points: 0
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
  const [hasInitializedLocations, setHasInitializedLocations] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('table')
  const [cards, setCards] = useState([])
  const [cardsLoading, setCardsLoading] = useState(false)
  const [activeFilters, setActiveFilters] = useState(new Set())
  const [showEditModal, setShowEditModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [gradingAgencies, setGradingAgencies] = useState([])
  const [selectedTeamIds, setSelectedTeamIds] = useState([])
  const [showSaveViewModal, setShowSaveViewModal] = useState(false)
  const [allTeams, setAllTeams] = useState([]) // All teams from full collection
  const [loadedView, setLoadedView] = useState(null) // Track currently loaded view for updates

  const navigate = useNavigate()

  // Calculate stats from filtered cards (not from API)
  const filteredStats = useMemo(() => {
    log.debug('Recalculating filtered stats', { cardCount: cards.length })

    const uniquePlayers = new Set()
    const uniqueSeries = new Set()
    let totalValue = 0
    let rookieCount = 0
    let autoCount = 0
    let relicCount = 0
    let gradedCount = 0

    cards.forEach(card => {
      // Track unique players
      card.card_player_teams?.forEach(cpt => {
        if (cpt.player?.player_id) {
          uniquePlayers.add(cpt.player.player_id)
        }
      })

      // Track unique series
      if (card.series_rel?.series_id) {
        uniqueSeries.add(card.series_rel.series_id)
      }

      // Calculate total value - only use current_value
      if (card.current_value) {
        totalValue += parseFloat(card.current_value)
      }

      // Count special card types
      if (card.is_rookie) rookieCount++
      if (card.is_autograph) autoCount++
      if (card.is_relic) relicCount++
      if (card.grade) gradedCount++
    })

    return {
      total_cards: cards.length,
      total_value: totalValue,
      unique_players: uniquePlayers.size,
      unique_series: uniqueSeries.size,
      rookie_cards: rookieCount,
      autograph_cards: autoCount,
      relic_cards: relicCount,
      graded_cards: gradedCount
    }
  }, [cards])

  // Calculate teams from filtered cards
  const filteredTeams = useMemo(() => {
    log.debug('Recalculating filtered teams', { cardCount: cards.length })

    const teamMap = new Map()

    cards.forEach(card => {
      card.card_player_teams?.forEach(cpt => {
        if (cpt.team) {
          const team = cpt.team
          const teamId = team.team_id

          if (!teamMap.has(teamId)) {
            teamMap.set(teamId, {
              ...team,
              card_count: 0,
              player_ids: new Set()
            })
          }

          const teamData = teamMap.get(teamId)
          teamData.card_count++
          if (cpt.player?.first_name && cpt.player?.last_name) {
            teamData.player_ids.add(`${cpt.player.first_name} ${cpt.player.last_name}`)
          }
        }
      })
    })

    // Convert to array and add player_count
    return Array.from(teamMap.values())
      .map(team => ({
        ...team,
        player_count: team.player_ids.size,
        player_ids: undefined // Remove the Set from the final object
      }))
      .sort((a, b) => b.card_count - a.card_count) // Sort by card count descending
  }, [cards])

  // Memoize the API endpoint for filtered cards
  const apiEndpoint = useMemo(() => {
    const params = []
    
    if (selectedLocationIds.length > 0) {
      // Show selected locations plus unassigned cards
      const locationParams = selectedLocationIds.map(id => `location_id=${id}`).join('&')
      params.push(locationParams)
      params.push('include_unassigned=true')
    } else {
      // If no locations selected, show only unassigned cards (cards without a location)
      params.push('include_unassigned=true')
      params.push('only_unassigned=true')
    }
    
    // Add filter parameters
    if (activeFilters.has('rookies')) params.push('is_rookie=true')
    if (activeFilters.has('autos')) params.push('is_autograph=true')
    if (activeFilters.has('relics')) params.push('is_relic=true')
    if (activeFilters.has('graded')) params.push('has_grade=true')
    
    // Add team filtering
    if (selectedTeamIds.length > 0) {
      const teamParams = selectedTeamIds.map(id => `team_id=${id}`).join('&')
      params.push(teamParams)
    }
    
    return `/api/user/collection/cards?${params.join('&')}`
  }, [selectedLocationIds, activeFilters, selectedTeamIds])

  useEffect(() => {
    if (isAuthenticated) {
      fetchAchievementStats() // Only fetch achievement stats from API
      fetchLocations()
      // Pre-load grading agencies for edit modal
      fetchGradingAgencies()
    }
  }, [isAuthenticated])

  // Set page title
  useEffect(() => {
    document.title = 'My Collection - Collect Your Cards'
  }, [])

  // Auto-select dashboard locations only on initial load
  useEffect(() => {
    if (locations.length > 0 && !hasInitializedLocations) {
      const dashboardLocations = locations.filter(loc => loc.is_dashboard)
      setSelectedLocationIds(dashboardLocations.map(loc => loc.user_location_id))
      setHasInitializedLocations(true)
    }
  }, [locations, hasInitializedLocations])

  // Fetch cards when API endpoint changes
  useEffect(() => {
    if (isAuthenticated && hasInitializedLocations) {
      fetchCards(apiEndpoint)
    }
  }, [apiEndpoint, isAuthenticated, hasInitializedLocations])

  // Accumulate all teams from loaded cards for multi-team selection
  useEffect(() => {
    if (cards.length === 0) return

    const newTeamMap = new Map()

    // Add existing teams to map with fresh Sets for accumulation
    allTeams.forEach(team => {
      newTeamMap.set(team.team_id, {
        ...team,
        card_count: 0,
        player_ids: new Set()
      })
    })

    // Extract teams from current cards and merge with existing
    cards.forEach(card => {
      card.card_player_teams?.forEach(cpt => {
        if (cpt.team) {
          const team = cpt.team
          const teamId = team.team_id

          if (!newTeamMap.has(teamId)) {
            newTeamMap.set(teamId, {
              ...team,
              card_count: 0,
              player_ids: new Set()
            })
          }

          const teamData = newTeamMap.get(teamId)
          teamData.card_count++
          if (cpt.player?.first_name && cpt.player?.last_name) {
            teamData.player_ids.add(`${cpt.player.first_name} ${cpt.player.last_name}`)
          }
        }
      })
    })

    // Convert to array and sort alphabetically by abbreviation
    const teamsArray = Array.from(newTeamMap.values())
      .map(team => ({
        ...team,
        player_count: team.player_ids.size,
        player_ids: undefined
      }))
      .sort((a, b) => {
        const abbrevA = (a.abbreviation || a.name || '').toUpperCase()
        const abbrevB = (b.abbreviation || b.name || '').toUpperCase()
        return abbrevA.localeCompare(abbrevB)
      })

    // Only update if teams have changed
    if (JSON.stringify(teamsArray) !== JSON.stringify(allTeams)) {
      setAllTeams(teamsArray)
    }
  }, [cards, allTeams])

  const fetchAchievementStats = async () => {
    try {
      setLoading(true)
      const achievementResponse = await axios.get('/api/user/achievements/stats')
      if (achievementResponse.data.success) {
        setAchievementStats({
          total_achievements: achievementResponse.data.stats.total_achievements || 0,
          total_points: achievementResponse.data.stats.total_points || 0
        })
      }
    } catch (err) {
      log.error('Failed to fetch achievement stats', err)
      // Continue without achievements if they fail
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

  const fetchGradingAgencies = async () => {
    try {
      const response = await axios.get('/api/grading-agencies')
      setGradingAgencies(response.data.agencies || [])
    } catch (err) {
      log.error('Failed to fetch grading agencies', err)
    }
  }

  const fetchCards = async (endpoint) => {
    try {
      setCardsLoading(true)
      console.log('Fetching cards with endpoint:', endpoint) // Debug log
      const response = await axios.get(endpoint)
      console.log('Cards received:', response.data.cards?.length || 0) // Debug log
      setCards(response.data.cards || [])
      
      // Refresh location counts whenever collection data changes
      fetchLocations()
    } catch (err) {
      console.error('Error fetching cards:', err)
      error('Failed to load collection cards')
    } finally {
      setCardsLoading(false)
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

  const handleFilterToggle = (filterType) => {
    setActiveFilters(prev => {
      const newFilters = new Set(prev)
      if (newFilters.has(filterType)) {
        newFilters.delete(filterType)
      } else {
        newFilters.add(filterType)
      }
      return newFilters
    })
  }

  const handleTeamFilter = (teamIds) => {
    setSelectedTeamIds(teamIds)
  }

  // Card action handlers - memoized to prevent re-creation
  const handleEditCard = useCallback((card) => {
    // Use startTransition to mark this as a non-urgent update
    startTransition(() => {
      setSelectedCard(card)
      setShowEditModal(true)
    })
  }, [])

  const handleDeleteCard = useCallback(async (card) => {
    // Remove confirmation dialog per CLAUDE.md rules - NO JAVASCRIPT ALERTS
    log.info('Deleting card from collection', { user_card_id: card.user_card_id })

    try {
      await axios.delete(`/api/user/cards/${card.user_card_id}`)
      success(`Card ${card.card_number} removed from collection`)

      // Refresh the cards list (stats will auto-recalculate via useMemo)
      setCards(prev => prev.filter(c => c.user_card_id !== card.user_card_id))
    } catch (err) {
      log.error('Failed to delete card', err)
      error('Failed to delete card: ' + (err.response?.data?.error || err.message))
    }
  }, [success, error])

  const handleFavoriteToggle = useCallback(async (card) => {
    try {
      const response = await axios.put(`/api/user/cards/${card.user_card_id}`, {
        is_special: !card.is_special
      })
      
      // Update the card in the local state
      setCards(prev => prev.map(c => 
        c.user_card_id === card.user_card_id 
          ? { ...c, is_special: !c.is_special }
          : c
      ))
      
      success(response.data.card.is_special ? 'Added to favorites' : 'Removed from favorites')
    } catch (err) {
      error('Failed to update favorite status: ' + (err.response?.data?.error || err.message))
    }
  }, [success, error])

  const handleCardClick = useCallback((card) => {
    // Navigate to card detail page
    const playerSlug = card.card_player_teams?.[0]?.player 
      ? `${card.card_player_teams[0].player.first_name}-${card.card_player_teams[0].player.last_name}`.toLowerCase().replace(/\s+/g, '-')
      : 'unknown'
    const seriesSlug = card.series_rel?.slug || 'unknown'
    navigate(`/card/${seriesSlug}/${card.card_number}/${playerSlug}`)
  }, [navigate])

  const handleEditModalClose = () => {
    setShowEditModal(false)
    setSelectedCard(null)
  }

  const handleEditModalSave = async () => {
    log.debug('Card updated, refreshing collection')
    // Refresh the cards list after the modal handles the update (stats will auto-recalculate)
    const updatedCards = await axios.get(apiEndpoint)
    setCards(updatedCards.data.cards || [])

    setShowEditModal(false)
    setSelectedCard(null)
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

      // Refresh locations and cards (stats will auto-recalculate)
      await fetchLocations()
      await fetchCards(apiEndpoint)

      // Remove from selected locations if it was selected
      setSelectedLocationIds(prev => prev.filter(id => id !== locationToDelete.user_location_id))

      // Close modal and reset
      setShowReassignModal(false)
      setLocationToDelete(null)
      setReassignLocationId('')
    } catch (err) {
      log.error('Failed to reassign and delete location', err)
      error('Failed to reassign cards and delete location')
    } finally {
      setDeletingLocationId(null)
    }
  }

  const handleViewSaved = (view) => {
    log.info('Collection view saved', { view })
    success('View saved successfully!')
  }

  const handleLoadView = (view) => {
    log.info('Loading collection view', { view })

    const config = view.filter_config

    // Apply location filters
    if (config.locationIds && Array.isArray(config.locationIds)) {
      setSelectedLocationIds(config.locationIds)
    }

    // Apply team filters
    if (config.teamIds && Array.isArray(config.teamIds)) {
      setSelectedTeamIds(config.teamIds)
    }

    // Apply card type filters
    const newFilters = new Set()
    if (config.filters?.rookies) newFilters.add('rookies')
    if (config.filters?.autos) newFilters.add('autos')
    if (config.filters?.relics) newFilters.add('relics')
    if (config.filters?.graded) newFilters.add('graded')
    setActiveFilters(newFilters)

    // Track this as the currently loaded view for update functionality
    setLoadedView(view)

    success(`Loaded view: ${view.name}`)
  }

  const handleUpdateView = async () => {
    if (!loadedView) return

    try {
      log.info('Updating collection view', { view: loadedView })

      const response = await axios.put(`/api/collection-views/${loadedView.collection_view_id}`, {
        filter_config: getCurrentFilterConfig()
      })

      if (response.data.success) {
        // Update the loadedView with new filter config
        setLoadedView({
          ...loadedView,
          filter_config: response.data.view.filter_config
        })
        success(`Updated view: ${loadedView.name}`)
      }
    } catch (err) {
      log.error('Failed to update view', err)
      error('Failed to update view: ' + (err.response?.data?.error || err.message))
    }
  }

  // Build filter configuration object for saving
  const getCurrentFilterConfig = () => {
    return {
      locationIds: selectedLocationIds,
      teamIds: selectedTeamIds,
      filters: {
        rookies: activeFilters.has('rookies'),
        autos: activeFilters.has('autos'),
        relics: activeFilters.has('relics'),
        graded: activeFilters.has('graded')
      }
    }
  }

  // Check if current filters differ from loaded view
  const hasFiltersChanged = useMemo(() => {
    if (!loadedView) return false

    const currentConfig = getCurrentFilterConfig()
    const loadedConfig = loadedView.filter_config

    // Compare locationIds
    const currentLocations = [...currentConfig.locationIds].sort()
    const loadedLocations = [...(loadedConfig.locationIds || [])].sort()
    if (JSON.stringify(currentLocations) !== JSON.stringify(loadedLocations)) {
      return true
    }

    // Compare teamIds
    const currentTeams = [...currentConfig.teamIds].sort()
    const loadedTeams = [...(loadedConfig.teamIds || [])].sort()
    if (JSON.stringify(currentTeams) !== JSON.stringify(loadedTeams)) {
      return true
    }

    // Compare filters
    if (currentConfig.filters.rookies !== loadedConfig.filters?.rookies) return true
    if (currentConfig.filters.autos !== loadedConfig.filters?.autos) return true
    if (currentConfig.filters.relics !== loadedConfig.filters?.relics) return true
    if (currentConfig.filters.graded !== loadedConfig.filters?.graded) return true

    return false
  }, [loadedView, selectedLocationIds, selectedTeamIds, activeFilters])

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
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(value || 0)
  }

  const formatNumber = (value) => {
    return new Intl.NumberFormat('en-US').format(value || 0)
  }

  return (
    <div className="collection-dashboard-page">
      <div className="dashboard-container">
        
        {/* Compact Header with Integrated Stats */}
        <header className="dashboard-header">
          <div className="header-top">
            <div className="header-title">
              <div className="title-and-icon">
                <Icon name="collections" size={24} className="title-icon" />
                <h1 className="dashboard-title">My Collection</h1>
              </div>
              
              {/* Team Filter Circles - Below title */}
              {allTeams.length > 0 && (
                <div className="collection-team-filters">
                  <TeamFilterCircles
                    teams={allTeams}
                    selectedTeamIds={selectedTeamIds}
                    onTeamFilter={handleTeamFilter}
                    compact={true}
                  />
                </div>
              )}
            </div>
            
            <div className="header-stats">
            <div className="stat-item">
              <Icon name="layers" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(filteredStats.total_cards)}</span>
                <span className="stat-label">Cards</span>
              </div>
            </div>
            <div className="stat-item">
              <Icon name="value" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatCurrency(filteredStats.total_value)}</span>
                <span className="stat-label">Value</span>
              </div>
            </div>
            <div className="stat-item">
              <Icon name="user" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(filteredStats.unique_players)}</span>
                <span className="stat-label">Players</span>
              </div>
            </div>
            <div
              className="stat-item clickable achievement-stat"
              onClick={() => navigate('/achievements')}
              title="View your achievements"
            >
              <Icon name="trophy" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(achievementStats.total_achievements)}</span>
                <span className="stat-label">Achievements</span>
                {achievementStats.total_points > 0 && (
                  <span className="achievement-points">{achievementStats.total_points.toLocaleString()} pts</span>
                )}
              </div>
            </div>
            <div
              className={`stat-item clickable ${activeFilters.has('autos') ? 'active' : ''}`}
              onClick={() => handleFilterToggle('autos')}
              title="Click to filter by autographed cards"
            >
              <Icon name="edit" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(filteredStats.autograph_cards)}</span>
                <span className="stat-label">Autos</span>
              </div>
            </div>
            <div
              className={`stat-item clickable ${activeFilters.has('relics') ? 'active' : ''}`}
              onClick={() => handleFilterToggle('relics')}
              title="Click to filter by relic cards"
            >
              <Icon name="jersey" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(filteredStats.relic_cards)}</span>
                <span className="stat-label">Relics</span>
              </div>
            </div>
            <div
              className={`stat-item clickable ${activeFilters.has('graded') ? 'active' : ''}`}
              onClick={() => handleFilterToggle('graded')}
              title="Click to filter by graded cards"
            >
              <Icon name="graded-slab" size={18} />
              <div className="stat-content">
                <span className="stat-value">{formatNumber(filteredStats.graded_cards)}</span>
                <span className="stat-label">Graded</span>
              </div>
            </div>
            <div
              className={`stat-item clickable ${activeFilters.has('rookies') ? 'active' : ''}`}
              onClick={() => handleFilterToggle('rookies')}
              title="Click to filter by rookie cards"
            >
              <span className="rc-tag">RC</span>
              <div className="stat-content">
                <span className="stat-value">{formatNumber(filteredStats.rookie_cards)}</span>
                <span className="stat-label">Rookies</span>
              </div>
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
                <Icon name="sliders-horizontal" size={16} />
              </button>
            )}
          </div>
        </section>

        {/* Collection Table */}
        <section className="collection-table-section">
          {selectedLocationIds.length === 0 && (
            <div className="unassigned-cards-header">
              <Icon name="info" size={20} />
              <span>No dashboard locations selected. Click location tags above to view your cards.</span>
            </div>
          )}

          <CollectionTable
            cards={cards}
            loading={cardsLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            showGalleryToggle={true}
            downloadFilename={`my-collection-${selectedLocationIds.length === 0 ? 'unassigned-cards' : 'location-cards'}`}
            maxHeight="800px"
            onEditCard={handleEditCard}
            onDeleteCard={handleDeleteCard}
            onFavoriteToggle={handleFavoriteToggle}
            onCardClick={handleCardClick}
            customActions={
              locations.length > 0 && cards.length > 0 && (
                <>
                  {/* Update View Button - Only shows when view is loaded AND filters changed */}
                  {loadedView && hasFiltersChanged && (
                    <button
                      className="update-view-btn"
                      onClick={handleUpdateView}
                      title={`Update "${loadedView.name}" with current filters`}
                    >
                      <Icon name="save" size={16} />
                      <span>Update "{loadedView.name}"</span>
                    </button>
                  )}

                  <SavedViewsDropdown
                    onSaveNewView={() => setShowSaveViewModal(true)}
                    onLoadView={handleLoadView}
                    currentFilterConfig={getCurrentFilterConfig()}
                  />
                </>
              )
            }
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

      {/* Quick Edit Modal - Lightweight and fast */}
      <QuickEditModal
        isOpen={showEditModal}
        card={selectedCard}
        onClose={handleEditModalClose}
        onCardUpdated={handleEditModalSave}
        locations={locations}
        gradingAgencies={gradingAgencies}
      />

      {/* Save View Modal */}
      <SaveViewModal
        isOpen={showSaveViewModal}
        onClose={() => setShowSaveViewModal(false)}
        filterConfig={getCurrentFilterConfig()}
        onViewSaved={handleViewSaved}
      />
    </div>
  )
}

export default CollectionDashboard