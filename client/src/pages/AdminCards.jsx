import React, { useState, useEffect, useRef } from 'react' // useRef still needed for imageUploaderRef
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import ImageEditor from '../components/ImageEditor'
import MultiImageUploader from '../components/MultiImageUploader'
import './AdminSets.css'
import './AdminCardsScoped.css'
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
  const [communityImages, setCommunityImages] = useState([])
  const [loadingCommunityImages, setLoadingCommunityImages] = useState(false)
  const [currentReferenceUserCard, setCurrentReferenceUserCard] = useState(null)
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [editingImage, setEditingImage] = useState(null) // { imageUrl, side: 'front'|'back' }
  const [currentAssignedImages, setCurrentAssignedImages] = useState({ front: null, back: null })
  const [availableColors, setAvailableColors] = useState([])
  const { addToast } = useToast()
  const imageUploaderRef = useRef(null)

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
    loadColors()
  }, [year, setSlug, seriesSlug, seriesIdFromQuery])

  // Load cards when we have selectedSeries data
  useEffect(() => {
    if (selectedSeries) {
      loadCardsForSeries(selectedSeries.series_id)
      document.title = `Admin Cards: ${selectedSeries.name} - Collect Your Cards`
    } else {
      document.title = 'Admin Cards - Collect Your Cards'
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
          (card.is_relic && 'relic'.includes(searchLower)) ||
          (card.is_short_print && 'short print'.includes(searchLower)) ||
          (card.is_short_print && 'sp'.includes(searchLower))
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
      // Find the series from the set's series list using stored slug
      const response = await axios.get(`/api/admin/series/by-set/${yearParam}/${setSlugParam}`)
      const allSeries = response.data.series || []
      const foundSeries = allSeries.find(s => s.slug === seriesSlugParam)
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

  // Update a single card in state without reloading the entire table
  const updateCardInState = (cardId, updates) => {
    const updateFn = prev => prev.map(c =>
      c.card_id === cardId ? { ...c, ...updates } : c
    )
    setCards(updateFn)
    setFilteredCards(updateFn)
  }

  const loadPlayersAndTeams = async () => {
    // This function is no longer needed since we'll search dynamically
    // Remove the initial loading since we'll search on-demand
  }

  const loadColors = async () => {
    try {
      const response = await axios.get('/api/admin/series/colors')
      setAvailableColors(response.data.colors || [])
    } catch (error) {
      console.error('Error loading colors:', error)
    }
  }

  const handleAddCard = () => {
    setEditingCard(null) // null indicates we're adding a new card
    setEditForm({
      card_number: '',
      sort_order: '',
      is_rookie: false,
      is_autograph: false,
      is_relic: false,
      is_short_print: false,
      print_run: '',
      notes: '',
      color_id: ''
    })
    setCardPlayers([])
    setShowEditModal(true)
  }

  const handleEditCard = async (card) => {
    setEditingCard(card)
    setEditForm({
      card_number: card.card_number || '',
      sort_order: card.sort_order || '',
      is_rookie: card.is_rookie || false,
      is_autograph: card.is_autograph || false,
      is_relic: card.is_relic || false,
      is_short_print: card.is_short_print || false,
      print_run: card.print_run || '',
      notes: card.notes || '',
      color_id: card.color_id || ''
    })
    // Set current players for this card
    setCardPlayers(card.card_player_teams || [])
    setShowEditModal(true)

    // Fetch community images for this card
    if (card.card_id) {
      await loadCommunityImages(card.card_id)
    }
  }

  const handleCloseModal = () => {
    setShowEditModal(false)
    setEditingCard(null)
    setEditForm({})
    setCardPlayers([])
    setSaving(false)
    setCommunityImages([])
    setCurrentReferenceUserCard(null)
  }

  const loadCommunityImages = async (cardId) => {
    try {
      setLoadingCommunityImages(true)
      const response = await axios.get(`/api/admin/cards/${cardId}/community-images`)
      setCommunityImages(response.data.community_images || [])
      setCurrentReferenceUserCard(response.data.current_reference)

      // Get current assigned images from the card in the cards list
      const currentCard = cards.find(c => c.card_id === cardId)
      if (currentCard) {
        setCurrentAssignedImages({
          front: currentCard.front_image_path || null,
          back: currentCard.back_image_path || null
        })
      } else {
        // If not in list, make an API call to get card details including image paths
        const cardResponse = await axios.get(`/api/cards`, { params: { card_id: cardId, limit: 1 } })
        const cardData = cardResponse.data.cards?.[0]
        if (cardData) {
          setCurrentAssignedImages({
            front: cardData.front_image_path || null,
            back: cardData.back_image_path || null
          })
        }
      }
    } catch (error) {
      console.error('Error loading community images:', error)
      addToast('Failed to load community images', 'error')
    } finally {
      setLoadingCommunityImages(false)
    }
  }

  const handleSelectReferenceImage = async (userCardId) => {
    if (!editingCard) return

    try {
      // Update the reference image on the server
      const response = await axios.put(`/api/admin/cards/${editingCard.card_id}/reference-image`, {
        user_card_id: userCardId
      })

      // Update local state with reference user card
      setCurrentReferenceUserCard(userCardId)

      // IMMEDIATELY update currentAssignedImages from API response to avoid race condition
      // This handles both setting new images and clearing them (when userCardId is null)
      setCurrentAssignedImages({
        front: response.data.front_image_url || null,
        back: response.data.back_image_url || null
      })

      const message = userCardId ? 'Reference image updated successfully' : 'Reference image cleared successfully'
      addToast(message, 'success')

      // Update the card in state (updates the "Img" indicator in the table)
      updateCardInState(editingCard.card_id, {
        front_image_path: response.data.front_image_url || null,
        back_image_path: response.data.back_image_url || null,
        reference_user_card: userCardId
      })
    } catch (error) {
      console.error('Error updating reference image:', error)
      addToast(`Failed to update reference image: ${error.response?.data?.message || error.message}`, 'error')
    }
  }

  const handleEditAssignedImage = (imageUrl, side) => {
    setEditingImage({ imageUrl, side })
    setShowImageEditor(true)
  }

  const handleImageEditorClose = () => {
    setShowImageEditor(false)
    setEditingImage(null)
  }

  const handleImageEditorSave = async (editedImageBlob) => {
    if (!editingCard || !editingImage || !editedImageBlob) return

    try {
      // Create FormData to upload the edited image
      const formData = new FormData()
      const fieldName = `${editingImage.side}_image` // 'front_image' or 'back_image'
      formData.append(fieldName, editedImageBlob, `edited-${editingImage.side}.jpg`)

      const response = await axios.put(`/api/admin/cards/${editingCard.card_id}/reference-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // IMMEDIATELY update currentAssignedImages from API response to avoid race condition
      // The backend returns both front and back URLs, preserving any images we didn't edit
      setCurrentAssignedImages({
        front: response.data.front_image_url || null,
        back: response.data.back_image_url || null
      })

      // Clear reference_user_card since we're now using an edited version
      setCurrentReferenceUserCard(null)

      addToast(`${editingImage.side === 'front' ? 'Front' : 'Back'} image updated successfully!`, 'success')

      // Update the card in state
      updateCardInState(editingCard.card_id, {
        front_image_path: response.data.front_image_url || null,
        back_image_path: response.data.back_image_url || null
      })

      handleImageEditorClose()
    } catch (error) {
      console.error('Error updating assigned image:', error)
      addToast(`Failed to update image: ${error.response?.data?.message || error.message}`, 'error')
    }
  }

  // Handle multi-image upload (both front and back at once)
  const handleMultiImageSave = async (images) => {
    if (!editingCard) return

    try {
      const formData = new FormData()

      if (images.front) {
        formData.append('front_image', images.front)
      }
      if (images.back) {
        formData.append('back_image', images.back)
      }

      const response = await axios.put(`/api/admin/cards/${editingCard.card_id}/reference-image`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      // Update currentAssignedImages from API response
      setCurrentAssignedImages({
        front: response.data.front_image_url || null,
        back: response.data.back_image_url || null
      })

      // Clear reference_user_card since we're using a direct upload
      setCurrentReferenceUserCard(null)

      const uploadedCount = (images.front ? 1 : 0) + (images.back ? 1 : 0)
      addToast(`${uploadedCount} image${uploadedCount > 1 ? 's' : ''} uploaded successfully!`, 'success')

      // Update the card in state
      updateCardInState(editingCard.card_id, {
        front_image_path: response.data.front_image_url || null,
        back_image_path: response.data.back_image_url || null
      })
    } catch (error) {
      console.error('Error uploading images:', error)
      addToast(`Failed to upload images: ${error.response?.data?.message || error.message}`, 'error')
      throw error // Re-throw so the uploader knows it failed
    }
  }

  const handleDeleteImage = async (side) => {
    if (!editingCard) return

    try {
      const response = await axios.delete(`/api/admin/cards/${editingCard.card_id}/image/${side}`)

      // Update currentAssignedImages from API response
      setCurrentAssignedImages({
        front: response.data.front_image_url || null,
        back: response.data.back_image_url || null
      })

      addToast(`${side === 'front' ? 'Front' : 'Back'} image deleted successfully`, 'success')

      // Update the card in state
      updateCardInState(editingCard.card_id, {
        front_image_path: response.data.front_image_url || null,
        back_image_path: response.data.back_image_url || null
      })
    } catch (error) {
      console.error('Error deleting image:', error)
      addToast(`Failed to delete image: ${error.response?.data?.message || error.message}`, 'error')
      throw error // Re-throw so the uploader knows it failed
    }
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
    if (!editForm.card_number.trim()) {
      addToast('Card number is required', 'error')
      return
    }

    try {
      setSaving(true)

      const playersToSave = cardPlayers.map(cp => ({
        player_id: cp.player.player_id,
        team_id: cp.team.team_id
      }))

      console.log('Saving card with players:', cardPlayers.map(cp => `${cp.player.name} (${cp.team.name})`))
      console.log('Players data being sent to API:', playersToSave)

      const cardData = {
        card_number: editForm.card_number.trim(),
        sort_order: editForm.sort_order ? parseInt(editForm.sort_order) : null,
        is_rookie: editForm.is_rookie,
        is_autograph: editForm.is_autograph,
        is_relic: editForm.is_relic,
        is_short_print: editForm.is_short_print,
        print_run: editForm.print_run ? parseInt(editForm.print_run) : null,
        notes: editForm.notes.trim(),
        color_id: editForm.color_id ? parseInt(editForm.color_id) : null,
        players: playersToSave
      }

      if (editingCard) {
        // Update existing card
        const response = await axios.put(`/api/admin/cards/${editingCard.card_id}`, cardData)

        // Also save any staged images in the uploader
        if (imageUploaderRef.current?.hasStagedImages()) {
          await imageUploaderRef.current.saveStagedImages()
        }

        // Update the card in state instead of reloading entire table
        // Preserve current image paths (may have been updated while modal was open)
        const currentCardInState = cards.find(c => c.card_id === editingCard.card_id)
        const updatedCard = response.data.card || {
          ...editingCard,
          ...cardData,
          card_player_teams: cardPlayers,
          // Preserve image paths from current state (not original editingCard which may be stale)
          front_image_path: currentCardInState?.front_image_path || editingCard.front_image_path,
          back_image_path: currentCardInState?.back_image_path || editingCard.back_image_path,
          reference_user_card: currentCardInState?.reference_user_card || editingCard.reference_user_card
        }
        setCards(prev => prev.map(c => c.card_id === editingCard.card_id ? updatedCard : c))
        setFilteredCards(prev => prev.map(c => c.card_id === editingCard.card_id ? updatedCard : c))

        addToast('Card updated successfully', 'success')
      } else {
        // Create new card - need to reload to get the new card with its ID
        await axios.post('/api/admin/cards', {
          ...cardData,
          series_id: selectedSeries.series_id
        })
        addToast('Card created successfully', 'success')
        await loadCardsForSeries(selectedSeries.series_id)
      }

      handleCloseModal()

    } catch (error) {
      console.error('Error saving card:', error)
      const action = editingCard ? 'update' : 'create'
      addToast(`Failed to ${action} card: ${error.response?.data?.message || error.message}`, 'error')
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
        name: `${player.first_name || ''} ${player.last_name || ''}`.trim(),
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
    if (selectedSet && selectedSet.set_id) {
      // Navigate to series list for this set
      return `/admin/series?set=${selectedSet.set_id}`
    } else if (selectedSeries && selectedSeries.set_id) {
      // Use series data if set data not available
      return `/admin/series?set=${selectedSeries.set_id}`
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
            onClick={handleAddCard}
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
                    <th style={{width: '130px'}}>Card #</th>
                    <th style={{width: '30%'}}>Player(s)</th>
                    <th style={{width: '110px'}}>Print Run</th>
                    <th style={{width: '120px'}}>Color</th>
                    <th style={{width: '130px'}}>Attributes</th>
                    <th style={{width: '50px'}} title="Has assigned image">Img</th>
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
                          {card.is_short_print && <span className="sp-tag">SP</span>}
                        </div>
                      </td>
                      <td className="image-indicator-cell center">
                        {(card.reference_user_card || card.front_image_path || card.back_image_path) && (
                          <Icon
                            name="image"
                            size={18}
                            style={{ color: '#10b981' }}
                            title={card.reference_user_card ? 'Card has community reference image' : 'Card has uploaded image'}
                          />
                        )}
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
      
      {/* Edit/Add Card Modal */}
      {showEditModal && (
        <div className="admin-cards-modal-overlay" onClick={handleCloseModal}>
          <div className="admin-cards-edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="admin-cards-modal-header">
              <div className="admin-cards-modal-title">
                {editingCard ? (
                  <>
                    <h3 className="admin-cards-modal-title-main">Edit Card #{editForm.card_number || 'N/A'}</h3>
                    {selectedSeries && selectedSet && (
                      <span className="admin-cards-modal-subtitle">
                        {selectedSet.year} {selectedSeries.name}
                      </span>
                    )}
                  </>
                ) : (
                  <>
                    <h3 className="admin-cards-modal-title-main">Add New Card</h3>
                    {selectedSeries && selectedSet && (
                      <span className="admin-cards-modal-subtitle">
                        {selectedSet.year} {selectedSeries.name}
                      </span>
                    )}
                  </>
                )}
              </div>
              <button className="admin-cards-close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="admin-cards-modal-body">

              {editingCard && (
                <div className="admin-cards-form-row">
                  <label className="admin-cards-form-label">Card ID</label>
                  <span className="admin-cards-form-value">{editingCard.card_id}</span>
                </div>
              )}

                <div className="admin-cards-form-row">
                  <label className="admin-cards-form-label">Card Number</label>
                  <input
                    type="text"
                    className="admin-cards-form-input"
                    value={editForm.card_number}
                    onChange={(e) => handleFormChange('card_number', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter card number"
                    autoFocus
                    required
                  />
                </div>

                <div className="admin-cards-form-row">
                  <label className="admin-cards-form-label">Sort Order</label>
                  <input
                    type="number"
                    className="admin-cards-form-input"
                    value={editForm.sort_order}
                    onChange={(e) => handleFormChange('sort_order', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter sort order (optional)"
                  />
                </div>

                <div className="admin-cards-form-row">
                  <label className="admin-cards-form-label">Print Run</label>
                  <input
                    type="number"
                    className="admin-cards-form-input"
                    value={editForm.print_run}
                    onChange={(e) => handleFormChange('print_run', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Enter print run (optional)"
                  />
                </div>

                <div className="admin-cards-form-row">
                  <label className="admin-cards-form-label">Color</label>
                  <select
                    className="admin-cards-form-input admin-cards-color-select"
                    value={editForm.color_id}
                    onChange={(e) => handleFormChange('color_id', e.target.value)}
                  >
                    <option value="">No color (use series default)</option>
                    {availableColors.map(color => (
                      <option
                        key={color.color_id}
                        value={color.color_id}
                        style={{
                          backgroundColor: color.hex_value || '#666',
                          color: color.hex_value && getTextColor(color.hex_value)
                        }}
                      >
                        {color.name}
                      </option>
                    ))}
                  </select>
                  {editForm.color_id && (
                    <span
                      className="admin-cards-color-preview"
                      style={{
                        backgroundColor: availableColors.find(c => c.color_id === parseInt(editForm.color_id))?.hex_value || '#666',
                        color: getTextColor(availableColors.find(c => c.color_id === parseInt(editForm.color_id))?.hex_value)
                      }}
                    >
                      {availableColors.find(c => c.color_id === parseInt(editForm.color_id))?.name}
                    </span>
                  )}
                </div>

                <div className="admin-cards-form-row">
                  <label className="admin-cards-form-label">Attributes</label>
                  <div className="admin-cards-checkbox-group">
                    <label className="admin-cards-checkbox-item">
                      <input
                        type="checkbox"
                        checked={editForm.is_rookie}
                        onChange={(e) => handleFormChange('is_rookie', e.target.checked)}
                      />
                      <span>Rookie Card</span>
                    </label>

                    <label className="admin-cards-checkbox-item">
                      <input
                        type="checkbox"
                        checked={editForm.is_autograph}
                        onChange={(e) => handleFormChange('is_autograph', e.target.checked)}
                      />
                      <span>Autograph</span>
                    </label>

                    <label className="admin-cards-checkbox-item">
                      <input
                        type="checkbox"
                        checked={editForm.is_relic}
                        onChange={(e) => handleFormChange('is_relic', e.target.checked)}
                      />
                      <span>Relic</span>
                    </label>

                    <label className="admin-cards-checkbox-item">
                      <input
                        type="checkbox"
                        checked={editForm.is_short_print}
                        onChange={(e) => handleFormChange('is_short_print', e.target.checked)}
                      />
                      <span>Short Print</span>
                    </label>
                  </div>
                </div>

                <div className="admin-cards-form-row">
                  <label className="admin-cards-form-label">Notes</label>
                  <textarea
                    className="admin-cards-form-input"
                    value={editForm.notes}
                    onChange={(e) => handleFormChange('notes', e.target.value)}
                    placeholder="Enter any notes (optional)"
                    rows="3"
                  />
                </div>

                <div className="admin-cards-form-row">
                  <label className="admin-cards-form-label">
                    Players {cardPlayers.length > 0 && `(${cardPlayers.length})`}
                  </label>
                  <div className="admin-cards-players-list">
                    {cardPlayers.length === 0 && (
                      <div className="admin-cards-no-players-message">
                        <p>No players assigned to this card</p>
                      </div>
                    )}
                    {cardPlayers.map((cardPlayer, index) => (
                      <div key={index} className="admin-cards-player-item">
                        <div className="admin-cards-player-info">
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
                          className="admin-cards-remove-player-btn"
                          onClick={() => handleRemovePlayer(index)}
                          title="Remove player"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ))}
                    <div className="admin-cards-inline-player-search">
                      <div className="admin-cards-player-search-box">
                        <Icon name="search" size={16} className="admin-cards-search-icon" />
                        <input
                          type="text"
                          placeholder="Search players to add..."
                          value={playerSearchTerm}
                          onChange={(e) => handlePlayerSearch(e.target.value)}
                          onKeyDown={handleSearchKeyDown}
                          className="admin-cards-inline-player-search-input"
                        />
                      </div>

                      {filteredPlayers.length > 0 && (
                        <div className="admin-cards-inline-player-search-results">
                          {filteredPlayers.slice(0, 8).map((result, index) => (
                            <button
                              key={`${result.player.player_id}-${result.team.team_id}`}
                              className={`admin-cards-inline-player-search-result ${index === selectedResultIndex ? 'selected' : ''}`}
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
                              <span className="admin-cards-inline-player-result-name">
                                {(result.player.first_name || '')} {(result.player.last_name || '')}
                              </span>
                              <span className="admin-cards-inline-team-result-name">
                                {result.team.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Multi-Image Uploader - Upload both front and back at once */}
                {editingCard && (
                  <div className="admin-cards-community-images-section">
                    <MultiImageUploader
                      ref={imageUploaderRef}
                      existingImages={currentAssignedImages}
                      onSave={handleMultiImageSave}
                      onEditImage={handleEditAssignedImage}
                      onDeleteImage={handleDeleteImage}
                      onMessage={(msg, type) => addToast(msg, type)}
                      disabled={saving}
                    />
                  </div>
                )}

                {/* Community Images Section - Only show when editing existing card */}
                {editingCard && (
                  <div className="admin-cards-community-images-section">
                    <div className="admin-cards-community-images-header">
                      <span className="admin-cards-community-images-title">
                        Select Reference Image From Community {communityImages.length > 0 && `(${communityImages.length})`}
                      </span>
                      {currentReferenceUserCard && (
                        <button
                          type="button"
                          className="admin-cards-clear-reference-btn"
                          onClick={() => handleSelectReferenceImage(null)}
                          title="Clear reference image"
                        >
                          Clear Selection
                        </button>
                      )}
                    </div>

                    {loadingCommunityImages ? (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'rgba(255, 255, 255, 0.6)' }}>
                        <div className="card-icon-spinner"></div>
                        <p style={{ marginTop: '1rem' }}>Loading community images...</p>
                      </div>
                    ) : communityImages.length === 0 ? (
                      <div className="admin-cards-no-community-images">
                        <p>No community images available for this card yet.</p>
                      </div>
                    ) : (
                      <div className="admin-cards-community-images-table">
                        <div className="admin-cards-images-table-header">
                          <div className="admin-cards-images-col-user">Uploaded By</div>
                          <div className="admin-cards-images-col-front">Front Image</div>
                          <div className="admin-cards-images-col-back">Back Image</div>
                        </div>
                        <div className="admin-cards-images-table-body">
                          {communityImages.map((userCard) => (
                            <div
                              key={userCard.user_card_id}
                              className={`admin-cards-image-row ${currentReferenceUserCard === userCard.user_card_id ? 'selected' : ''}`}
                              onClick={() => handleSelectReferenceImage(userCard.user_card_id)}
                              title="Click to select as reference image"
                            >
                              <div className="admin-cards-images-col-user">
                                <div className="admin-cards-user-info">
                                  <span className="admin-cards-user-email">{userCard.user_email}</span>
                                  {currentReferenceUserCard === userCard.user_card_id && (
                                    <span className="admin-cards-selected-badge">
                                      <Icon name="check-circle" size={16} /> Selected
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="admin-cards-images-col-front">
                                {userCard.front_image ? (
                                  <img src={userCard.front_image} alt="Front" className="admin-cards-thumbnail" />
                                ) : (
                                  <div className="admin-cards-no-image">No front image</div>
                                )}
                              </div>
                              <div className="admin-cards-images-col-back">
                                {userCard.back_image ? (
                                  <img src={userCard.back_image} alt="Back" className="admin-cards-thumbnail" />
                                ) : (
                                  <div className="admin-cards-no-image">No back image</div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

            </div>

            <div className="admin-cards-modal-actions">
              <button className="admin-cards-cancel-btn" onClick={handleCloseModal} disabled={saving}>
                Cancel
              </button>
              <button
                className="admin-cards-save-btn"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    {editingCard ? 'Saving...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <Icon name="check" size={16} />
                    {editingCard ? 'Save Changes' : 'Create Card'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Image Editor Modal */}
      <ImageEditor
        isOpen={showImageEditor}
        onClose={handleImageEditorClose}
        imageUrl={editingImage?.imageUrl}
        onSave={handleImageEditorSave}
        title={`Edit ${editingImage?.side === 'front' ? 'Front' : 'Back'} Image`}
      />

    </div>
  )
}

export default AdminCards