import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminSets.css'
import '../components/UniversalCardTable.css'

function AdminCards() {
  const { year, setSlug, seriesSlug } = useParams()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const seriesIdFromQuery = searchParams.get('series')
  const [selectedSet, setSelectedSet] = useState(null)
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [cards, setCards] = useState([])
  const [filteredCards, setFilteredCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [saving, setSaving] = useState(false)
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [playerTeamCombinations, setPlayerTeamCombinations] = useState([])
  const [cardPlayers, setCardPlayers] = useState([])
  const [playerSearchTerm, setPlayerSearchTerm] = useState('')
  const [filteredPlayers, setFilteredPlayers] = useState([])
  const [selectedResultIndex, setSelectedResultIndex] = useState(-1)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const { addToast } = useToast()

  // Function to determine text color based on background brightness
  const getTextColor = (hexColor) => {
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

  // Helper function to generate URL slug (matching backend)
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
  }

  useEffect(() => {
    if (seriesIdFromQuery) {
      // Load series directly by ID from query param
      loadSeriesById(seriesIdFromQuery)
    } else if (year && setSlug && seriesSlug) {
      // Load using URL params (existing functionality)
      loadSetBySlug(year, setSlug)
      loadSeriesBySlug(year, setSlug, seriesSlug)
    }
    loadPlayersAndTeams()
  }, [year, setSlug, seriesSlug, seriesIdFromQuery])

  // Load cards when we have selectedSeries data
  useEffect(() => {
    if (selectedSeries) {
      loadCardsForSeries(selectedSeries.series_id)
    }
  }, [selectedSeries])

  // Filter cards based on search term
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredCards(cards)
    } else {
      const filtered = cards.filter(card => {
        const searchLower = searchTerm.toLowerCase()
        
        // Player and team info
        const playerTeamMatches = card.card_player_teams?.some(pt => 
          (pt.player?.name && pt.player.name.toLowerCase().includes(searchLower)) ||
          (pt.team?.name && pt.team.name.toLowerCase().includes(searchLower)) ||
          (pt.team?.abbreviation && pt.team.abbreviation.toLowerCase().includes(searchLower))
        )
        
        return (
          playerTeamMatches ||
          (card.card_number && card.card_number.toString().includes(searchTerm)) ||
          (card.series_rel?.name && card.series_rel.name.toLowerCase().includes(searchLower)) ||
          (card.color_rel?.color && card.color_rel.color.toLowerCase().includes(searchLower)) ||
          (card.notes && card.notes.toLowerCase().includes(searchLower)) ||
          (card.is_rookie && 'rookie'.includes(searchLower)) ||
          (card.is_autograph && 'auto'.includes(searchLower)) ||
          (card.is_relic && 'relic'.includes(searchLower))
        )
      })
      setFilteredCards(filtered)
    }
  }, [cards, searchTerm])

  const loadSetBySlug = async (yearParam, setSlugParam) => {
    try {
      // We need to get set details for the breadcrumb
      const response = await axios.get(`/api/admin/sets/by-year/${yearParam}`)
      const allSets = response.data.sets || []
      const foundSet = allSets.find(s => s.slug === setSlugParam)
      if (foundSet) {
        setSelectedSet(foundSet)
      }
    } catch (error) {
      console.error('Error loading set:', error)
    }
  }

  const loadSeriesById = async (seriesId) => {
    try {
      // Load series directly by ID
      const response = await axios.get(`/api/admin/series`, { params: { series_id: seriesId, limit: 1 } })
      const seriesData = response.data.series?.[0]
      if (seriesData) {
        setSelectedSeries(seriesData)
        // Also load set info for context
        if (seriesData.set_id) {
          const setResponse = await axios.get(`/api/admin/sets`, { params: { set_id: seriesData.set_id, limit: 1 } })
          const setData = setResponse.data.sets?.[0]
          if (setData) {
            setSelectedSet(setData)
          }
        }
      }
    } catch (error) {
      console.error('Error loading series by ID:', error)
      addToast('Failed to load series', 'error')
    }
  }

  const loadSeriesBySlug = async (yearParam, setSlugParam, seriesSlugParam) => {
    try {
      // Find the series from the set's series list
      const response = await axios.get(`/api/admin/series/by-set/${yearParam}/${setSlugParam}`)
      const allSeries = response.data.series || []
      const foundSeries = allSeries.find(s => generateSlug(s.name) === seriesSlugParam)
      if (foundSeries) {
        setSelectedSeries(foundSeries)
      }
    } catch (error) {
      console.error('Error loading series:', error)
    }
  }

  const loadCardsForSeries = async (seriesId) => {
    try {
      setLoading(true)
      // Use the working cards API with a high limit to get all cards
      const response = await axios.get(`/api/cards?series_id=${seriesId}&limit=10000`)
      const cardsData = response.data.cards || []
      setCards(cardsData)
      setFilteredCards(cardsData)
    } catch (error) {
      console.error('Error loading cards:', error)
      addToast(`Failed to load cards: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadPlayersAndTeams = async () => {
    // This function is no longer needed since we'll search dynamically
    // Remove the initial loading since we'll search on-demand
  }

  const handleEditCard = (card) => {
    setEditingCard(card)
    setEditForm({
      card_number: card.card_number || '',
      sort_order: card.sort_order || '',
      is_rookie: card.is_rookie || false,
      is_autograph: card.is_autograph || false,
      is_relic: card.is_relic || false,
      print_run: card.print_run || '',
      notes: card.notes || ''
    })
    // Set current players for this card
    setCardPlayers(card.card_player_teams || [])
    setShowEditModal(true)
  }

  const handleCloseModal = () => {
    setShowEditModal(false)
    setEditingCard(null)
    setEditForm({})
    setCardPlayers([])
    setSaving(false)
  }


  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !saving) {
      e.preventDefault()
      handleSave()
    }
  }

  const handleSave = async () => {
    if (!editingCard) return

    try {
      setSaving(true)
      
      const playersToSave = cardPlayers.map(cp => ({
        player_id: cp.player.player_id,
        team_id: cp.team.team_id
      }))
      
      console.log('Saving card with players:', cardPlayers.map(cp => `${cp.player.name} (${cp.team.name})`))
      console.log('Players data being sent to API:', playersToSave)
      
      const updateData = {
        card_number: editForm.card_number.trim(),
        sort_order: editForm.sort_order ? parseInt(editForm.sort_order) : null,
        is_rookie: editForm.is_rookie,
        is_autograph: editForm.is_autograph,
        is_relic: editForm.is_relic,
        print_run: editForm.print_run ? parseInt(editForm.print_run) : null,
        notes: editForm.notes.trim(),
        // Include player-team relationships
        players: playersToSave
      }

      // Note: You'll need to create this API endpoint
      await axios.put(`/api/admin/cards/${editingCard.card_id}`, updateData)
      
      // Reload cards
      await loadCardsForSeries(selectedSeries.series_id)
      
      addToast('Card updated successfully', 'success')
      handleCloseModal()
      
    } catch (error) {
      console.error('Error updating card:', error)
      addToast(`Failed to update card: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleRemovePlayer = (playerTeamIndex) => {
    setCardPlayers(prev => prev.filter((_, index) => index !== playerTeamIndex))
  }

  const handleAddPlayer = (player, team) => {
    // Use player_id and team_id for more reliable duplicate checking
    const exists = cardPlayers.some(cp => 
      cp.player.player_id === player.player_id &&
      cp.team.team_id === team.team_id
    )
    
    if (exists) {
      addToast('This player-team combination is already on the card', 'warning')
      return
    }

    const newPlayerTeam = {
      player: {
        name: `${player.first_name} ${player.last_name}`.trim(),
        first_name: player.first_name,
        last_name: player.last_name,
        player_id: player.player_id
      },
      team: {
        team_id: team.team_id,
        name: team.name,
        abbreviation: team.abbreviation,
        primary_color: team.primary_color,
        secondary_color: team.secondary_color
      }
    }
    
    console.log('Adding player:', newPlayerTeam.player.name, 'to team:', newPlayerTeam.team.name)
    console.log('Current cardPlayers before adding:', cardPlayers.map(cp => `${cp.player.name} (${cp.team.name})`))
    
    setCardPlayers(prev => {
      const updated = [...prev, newPlayerTeam]
      console.log('Updated cardPlayers:', updated.map(cp => `${cp.player.name} (${cp.team.name})`))
      return updated
    })
    
    setPlayerSearchTerm('')
    setFilteredPlayers([])
    setSelectedResultIndex(-1)
  }

  const calculateDropdownPosition = (inputElement) => {
    const rect = inputElement.getBoundingClientRect()
    setDropdownPosition({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width
    })
  }

  const handlePlayerSearch = async (searchTerm) => {
    setPlayerSearchTerm(searchTerm)
    
    if (!searchTerm.trim() || searchTerm.trim().length < 2) {
      setFilteredPlayers([])
      return
    }

    try {
      // Use the new player-team search API
      const response = await axios.get(`/api/player-team-search?q=${encodeURIComponent(searchTerm)}&limit=50`)
      const playerTeamCombinations = response.data.playerTeamCombinations || []
      
      // Filter out combinations already on the card using IDs for reliable comparison
      const availableCombinations = playerTeamCombinations.filter(combination => {
        const alreadyOnCard = cardPlayers.some(cp => 
          cp.player.player_id === combination.player.player_id &&
          cp.team.team_id === combination.team.team_id
        )
        return !alreadyOnCard
      })
      
      // Add displayName and set results
      const resultsWithDisplayName = availableCombinations.map(combination => ({
        ...combination,
        displayName: `${combination.player.name} (${combination.team.abbreviation})`
      }))
      
      setFilteredPlayers(resultsWithDisplayName)
      setSelectedResultIndex(-1) // Reset selection when new results come in
      
    } catch (error) {
      console.error('Error searching players:', error)
      setFilteredPlayers([])
      setSelectedResultIndex(-1)
    }
  }

  const handleSearchKeyDown = (e) => {
    if (filteredPlayers.length === 0) return

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedResultIndex(prev => 
          prev < filteredPlayers.length - 1 ? prev + 1 : prev
        )
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedResultIndex(prev => prev > 0 ? prev - 1 : -1)
        break
      case 'Enter':
        e.preventDefault()
        if (selectedResultIndex >= 0 && selectedResultIndex < filteredPlayers.length) {
          const selectedResult = filteredPlayers[selectedResultIndex]
          handleAddPlayer(selectedResult.player, selectedResult.team)
        }
        break
      case 'Escape':
        e.preventDefault()
        setPlayerSearchTerm('')
        setFilteredPlayers([])
        setSelectedResultIndex(-1)
        break
    }
  }

  if (loading) {
    return (
      <div className="admin-sets-page">
        <div className="loading-state">
          <div className="card-icon-spinner"></div>
          <span>Loading...</span>
        </div>
      </div>
    )
  }

  // Compute back URL based on available data
  const getBackUrl = () => {
    if (year) {
      // Navigate to year-specific sets page
      return `/admin/sets/${year}`
    } else if (selectedSet) {
      // We loaded set data, use the year from set data
      return `/admin/sets/${selectedSet.year}`
    } else {
      // Fallback to admin sets index
      return '/admin/sets'
    }
  }

  return (
    <div className="admin-sets-page">
      <div className="admin-header">
        <div className="admin-title">
          <Link 
            to={getBackUrl()} 
            className="back-button"
            title="Back to series"
          >
            <Icon name="arrow-left" size={24} />
          </Link>
          <Icon name="layers" size={32} />
          <h1>
            {selectedSeries ? selectedSeries.name : 'Admin Cards'}
          </h1>
        </div>
        
        <div className="admin-controls">
          <button
            className="add-card-btn"
            onClick={() => {/* Add card functionality would go here */}}
            title="Add new card"
          >
            <Icon name="plus" size={20} />
          </button>
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="Search cards..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              autoFocus
            />
          </div>
        </div>
      </div>

      <div className="content-area">
        {/* Cards Table */}
        {selectedSeries && (
          <div className="cards-list">
            <div className="cards-table-container">
              <table className="cards-table">
                <thead>
                  <tr>
                    <th style={{width: '80px'}}>Sort</th>
                    <th style={{width: '100px'}}>Card #</th>
                    <th style={{width: '30%'}}>Player(s)</th>
                    <th style={{width: '110px'}}>Print Run</th>
                    <th style={{width: '120px'}}>Color</th>
                    <th style={{width: '130px'}}>Attributes</th>
                    <th style={{width: 'auto'}}>Notes</th>
                    <th style={{width: '60px'}}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCards.map(card => (
                    <tr 
                      key={card.card_id}
                      onDoubleClick={() => handleEditCard(card)}
                      title="Double-click to edit card"
                    >
                      <td className="sort-order-cell center">
                        {card.sort_order || ''}
                      </td>
                      <td className="card-number-cell">
                        {card.card_number}
                      </td>
                      <td className="player-cell">
                        {card.card_player_teams && card.card_player_teams.map((playerTeam, index) => (
                          <div key={index} className="player-row">
                            <div 
                              className="mini-team-circle"
                              style={{ 
                                '--primary-color': playerTeam.team.primary_color,
                                '--secondary-color': playerTeam.team.secondary_color 
                              }}
                              title={playerTeam.team.name}
                            >
                              {playerTeam.team.abbreviation}
                            </div>
                            <span className="player-name">{playerTeam.player.name}</span>
                            {card.is_rookie && <span className="rc-tag">RC</span>}
                          </div>
                        ))}
                      </td>
                      <td className="print-run-cell center">
                        {card.print_run ? `/${card.print_run}` : ''}
                      </td>
                      <td className="color-cell">
                        {card.color_rel?.color && (
                          <span 
                            className="color-tag" 
                            style={{ 
                              backgroundColor: card.color_rel.hex_color,
                              color: getTextColor(card.color_rel.hex_color)
                            }}
                          >
                            {card.color_rel.color}
                          </span>
                        )}
                      </td>
                      <td className="attributes-cell center">
                        <div className="attribute-tags">
                          {card.is_autograph && <span className="auto-tag">AUTO</span>}
                          {card.is_relic && <span className="relic-tag">RELIC</span>}
                        </div>
                      </td>
                      <td className="notes-cell">
                        {card.notes}
                      </td>
                      <td className="action-cell center">
                        <button
                          className="edit-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditCard(card)
                          }}
                          title="Edit card"
                        >
                          <Icon name="edit" size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredCards.length === 0 && cards.length > 0 && (
                <div className="empty-state">
                  <Icon name="search" size={48} />
                  <p>No cards found matching "{searchTerm}"</p>
                </div>
              )}
              {cards.length === 0 && !loading && (
                <div className="empty-state">
                  <Icon name="layers" size={48} />
                  <p>No cards found in this series</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Edit Card Modal */}
      {showEditModal && editingCard && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Card</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                
                <div className="form-row">
                  <label className="form-label">Card ID</label>
                  <span className="form-value">{editingCard.card_id}</span>
                </div>

                <div className="form-row">
                  <label className="form-label">Card Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editForm.card_number}
                    onChange={(e) => handleFormChange('card_number', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter card number"
                  />
                </div>
                
                <div className="form-row">
                  <label className="form-label">Sort Order</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editForm.sort_order}
                    onChange={(e) => handleFormChange('sort_order', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter sort order (optional)"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Print Run</label>
                  <input
                    type="number"
                    className="form-input"
                    value={editForm.print_run}
                    onChange={(e) => handleFormChange('print_run', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter print run (optional)"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">Attributes</label>
                  <div className="checkbox-group">
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={editForm.is_rookie}
                        onChange={(e) => handleFormChange('is_rookie', e.target.checked)}
                      />
                      <span>Rookie Card</span>
                    </label>
                    
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={editForm.is_autograph}
                        onChange={(e) => handleFormChange('is_autograph', e.target.checked)}
                      />
                      <span>Autograph</span>
                    </label>
                    
                    <label className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={editForm.is_relic}
                        onChange={(e) => handleFormChange('is_relic', e.target.checked)}
                      />
                      <span>Relic</span>
                    </label>
                  </div>
                </div>
                
                <div className="form-row">
                  <label className="form-label">Notes</label>
                  <textarea
                    className="form-textarea"
                    value={editForm.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter any notes (optional)"
                    rows="3"
                  />
                </div>

                <div className="form-row">
                  <label className="form-label">
                    Players {cardPlayers.length > 0 && `(${cardPlayers.length})`}
                  </label>
                  <div className="players-list">
                    {cardPlayers.length === 0 && (
                      <div className="no-players-message">
                        <p>No players assigned to this card</p>
                      </div>
                    )}
                    {cardPlayers.map((cardPlayer, index) => (
                      <div key={index} className="player-item">
                        <div className="player-info">
                          <div 
                            className="mini-team-circle"
                            style={{ 
                              '--primary-color': cardPlayer.team.primary_color,
                              '--secondary-color': cardPlayer.team.secondary_color 
                            }}
                            title={cardPlayer.team.name}
                          >
                            {cardPlayer.team.abbreviation}
                          </div>
                          <span className="player-name">{cardPlayer.player.name}</span>
                        </div>
                        <button
                          type="button"
                          className="remove-player-btn"
                          onClick={() => handleRemovePlayer(index)}
                          title="Remove player"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="inline-player-search">
                      <div className="player-search-box">
                        <Icon name="search" size={16} className="search-icon" />
                        <input
                          type="text"
                          placeholder="Search players to add..."
                          value={playerSearchTerm}
                          onChange={(e) => handlePlayerSearch(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                          onFocus={(e) => calculateDropdownPosition(e.target)}
                          className="inline-player-search-input"
                        />
                      </div>
                      
                      {filteredPlayers.length > 0 && (
                        <div 
                          className="inline-player-search-results"
                          style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            width: dropdownPosition.width
                          }}
                        >
                          {filteredPlayers.slice(0, 8).map((result, index) => (
                            <button
                              key={`${result.player.player_id}-${result.team.team_id}`}
                              className={`inline-player-search-result ${index === selectedResultIndex ? 'selected' : ''}`}
                              onClick={() => handleAddPlayer(result.player, result.team)}
                              onMouseEnter={() => setSelectedResultIndex(index)}
                            >
                              <div 
                                className="mini-team-circle"
                                style={{ 
                                  '--primary-color': result.team.primary_color,
                                  '--secondary-color': result.team.secondary_color 
                                }}
                                title={result.team.name}
                              >
                                {result.team.abbreviation}
                              </div>
                              <span className="inline-player-result-name">
                                {result.player.first_name} {result.player.last_name}
                              </span>
                              <span className="inline-team-result-name">
                                {result.team.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
              </form>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon name="check" size={16} />
                    Save Changes
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

export default AdminCards