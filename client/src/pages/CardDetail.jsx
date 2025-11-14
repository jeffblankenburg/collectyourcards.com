import React, { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import CollectionTable from '../components/tables/CollectionTable'
import QuickEditModal from '../components/modals/QuickEditModal'
import AddCardModal from '../components/modals/AddCardModal'
import AddToListDropdown from '../components/AddToListDropdown'
import CommentsSection from '../components/CommentsSection'
import { useToast } from '../contexts/ToastContext'
import SocialShareButton from '../components/SocialShareButton'
import { createLogger } from '../utils/logger'
import './CardDetailScoped.css'

const log = createLogger('CardDetail')

function CardDetail() {
  // Handle both URL formats:
  // 1. Canonical: /sets/:year/:setSlug/:seriesSlug/:cardNumber/:playerName
  // 2. Simple: /card/:seriesSlug/:cardNumber/:playerName
  const params = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { success, error: showError } = useToast()

  log.info('CardDetail mounted', { params, isAuthenticated, userRole: user?.role })

  // Extract parameters
  const year = params.year
  const setSlug = params.setSlug
  const seriesSlug = params.seriesSlug
  const cardNumber = params.cardNumber
  const playerName = params.playerName
  
  const [card, setCard] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [seriesCards, setSeriesCards] = useState([])
  const [currentCardIndex, setCurrentCardIndex] = useState(-1)
  const [userCards, setUserCards] = useState([])
  const [checkingUserCards, setCheckingUserCards] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)
  const [cardToEdit, setCardToEdit] = useState(null)
  const [locations, setLocations] = useState([])
  const [gradingAgencies, setGradingAgencies] = useState([])
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [parallelSeries, setParallelSeries] = useState([])
  const [showParallels, setShowParallels] = useState(false)
  const parallelsRef = useRef(null)
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [currentImageView, setCurrentImageView] = useState('front') // 'front' or 'back'
  const [ebayConnected, setEbayConnected] = useState(false)
  const [creatingListing, setCreatingListing] = useState(false)

  // Determine which URL format we're using based on presence of year/setSlug
  const isSimpleUrl = !year || !setSlug
  
  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)
  
  // Close parallels dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (parallelsRef.current && !parallelsRef.current.contains(event.target)) {
        setShowParallels(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [])

  // Keyboard navigation for image viewer
  useEffect(() => {
    if (!showImageViewer) return

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setShowImageViewer(false)
      } else if (event.key === 'ArrowLeft') {
        setCurrentImageView('front')
      } else if (event.key === 'ArrowRight') {
        setCurrentImageView('back')
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [showImageViewer])

  useEffect(() => {
    fetchCardDetails()
  }, [year, setSlug, seriesSlug, cardNumber, playerName])

  // Set page title when card loads
  useEffect(() => {
    if (card) {
      const playerNames = card.player_names || getPlayerNamesFromCard(card)
      document.title = `#${card.card_number} ${playerNames} - ${card.series_name} - Collect Your Cards`
    } else if (loading) {
      document.title = 'Loading Card... - Collect Your Cards'
    }
  }, [card, loading])

  useEffect(() => {
    if (isAuthenticated && card) {
      checkUserCards()
      checkEbayConnection()
    } else {
      setCheckingUserCards(false)
      setUserCards([])
      setEbayConnected(false)
    }
  }, [isAuthenticated, card])

  const checkEbayConnection = async () => {
    try {
      const response = await axios.get('/api/ebay/auth/status')
      setEbayConnected(response.data.connected)
    } catch (err) {
      log.error('Failed to check eBay connection', err)
      setEbayConnected(false)
    }
  }

  const checkUserCards = async () => {
    const startTime = performance.now()
    log.debug('Checking user collection for card', { card_id: card.card_id })

    try {
      setCheckingUserCards(true)
      const response = await axios.get(`/api/user/cards/${card.card_id}`)
      const userCardsData = response.data.cards || []
      setUserCards(userCardsData)
      log.info(`Found ${userCardsData.length} copies in user collection`)

      // Load locations and grading agencies for the edit modal
      const [locationsRes, gradingRes] = await Promise.all([
        axios.get('/api/user/locations'),
        axios.get('/api/grading-agencies')
      ])
      setLocations(locationsRes.data.locations || [])
      setGradingAgencies(gradingRes.data.agencies || [])
      log.performance('User cards check', startTime)
    } catch (err) {
      log.error('Failed to check user cards', err)
      setUserCards([])
    } finally {
      setCheckingUserCards(false)
    }
  }

  const fetchCardDetails = async () => {
    const startTime = performance.now()
    log.info('Fetching card details', {
      seriesSlug,
      cardNumber,
      playerName,
      urlFormat: isSimpleUrl ? 'simple' : 'canonical'
    })

    try {
      setLoading(true)
      setError(null)

      // Always use simple API endpoint - both URL formats have the same card data
      const response = await axios.get(`/api/card/${seriesSlug}/${cardNumber}/${playerName}`)

      if (response.data.success) {
        const cardData = response.data.card
        setCard(cardData)
        log.success('Card details loaded', {
          card_id: cardData.card_id,
          card_number: cardData.card_number,
          series_name: cardData.series_name,
          set_name: cardData.set_name
        })

        // Fetch all cards in the series for navigation
        await fetchSeriesCards(cardData)

        // Fetch parallel series for dropdown
        if (cardData.set_id) {
          await fetchParallelSeries(cardData)
        }

        log.performance('Complete card detail load', startTime)
      } else {
        log.warn('Card not found in API response')
        setError('Card not found')
      }
    } catch (err) {
      log.error('Failed to fetch card details', {
        error: err.message,
        status: err.response?.status,
        seriesSlug,
        cardNumber,
        playerName
      })

      // If card not found and we're using simple URL format, try to redirect to first card in series
      if (err.response?.status === 404 && isSimpleUrl) {
        log.debug('Card not found, attempting to redirect to first card in series')
        try {
          // Get first card in the series
          const seriesResponse = await axios.get(`/api/cards?series_name=${seriesSlug.replace(/-/g, ' ')}&limit=1`)
          const firstCard = seriesResponse.data.cards?.[0]

          if (firstCard) {
            const firstCardPlayerNames = getPlayerNamesFromCard(firstCard) || 'unknown'
            const firstCardPlayerSlug = firstCardPlayerNames
              .toLowerCase()
              .replace(/,/g, '-') // Handle multiple players
              .replace(/[^a-z0-9\s-]/g, '')
              .replace(/\s+/g, '-')
              .replace(/-+/g, '-')
              .trim()

            log.navigation(`/card/${seriesSlug}/${cardNumber}/${playerName}`,
              `/card/${seriesSlug}/${firstCard.card_number}/${firstCardPlayerSlug}`,
              { reason: 'Card not found, redirecting to first in series' })

            // Redirect to first card in series
            navigate(`/card/${seriesSlug}/${firstCard.card_number}/${firstCardPlayerSlug}`, { replace: true })
            return
          }
        } catch (fallbackErr) {
          log.error('Failed to find first card in series for fallback', fallbackErr)
        }
      }

      setError(err.response?.data?.message || 'Failed to load card details')
    } finally {
      setLoading(false)
    }
  }

  const fetchSeriesCards = async (cardData) => {
    const startTime = performance.now()
    log.debug('Fetching series cards for navigation', { series_id: cardData.series_id })

    try {
      // Get all cards in the series
      const response = await axios.get(`/api/cards?series_id=${cardData.series_id}&limit=10000`)
      const cards = response.data.cards || []

      // Sort by sort_order for proper series navigation order
      const sortedCards = cards.sort((a, b) => {
        // Primary sort: sort_order (this determines the series sequence)
        const aSortOrder = a.sort_order !== null && a.sort_order !== undefined ? Number(a.sort_order) : 999999
        const bSortOrder = b.sort_order !== null && b.sort_order !== undefined ? Number(b.sort_order) : 999999

        if (aSortOrder !== bSortOrder) {
          return aSortOrder - bSortOrder
        }

        // Fallback to card number sorting if sort_order is the same
        const aNum = parseInt(a.card_number)
        const bNum = parseInt(b.card_number)

        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum
        }

        // Final fallback to string comparison
        return (a.card_number || '').localeCompare(b.card_number || '')
      })


      setSeriesCards(sortedCards)

      // Find current card index - ensure type matching
      const currentCardId = Number(cardData.card_id)
      const currentIndex = sortedCards.findIndex(c => Number(c.card_id) === currentCardId)
      setCurrentCardIndex(currentIndex)

      log.info('Series cards loaded for navigation', {
        totalCards: sortedCards.length,
        currentIndex,
        currentCardNumber: cardData.card_number
      })
      log.performance('Series cards fetch', startTime)

    } catch (err) {
      log.error('Failed to fetch series cards', err)
      setSeriesCards([])
      setCurrentCardIndex(-1)
    }
  }

  const fetchParallelSeries = async (cardData) => {
    log.debug('Fetching parallel series', { set_id: cardData.set_id, card_number: cardData.card_number })

    try {
      // Get all series in the same set that have a card with the same number
      const response = await axios.get(`/api/cards/parallel-series?set_id=${cardData.set_id}&card_number=${encodeURIComponent(cardData.card_number)}`)
      const parallels = response.data.series || []

      // Sort by series name, but put base series first
      const sortedParallels = parallels.sort((a, b) => {
        // Base series first
        if (a.is_base && !b.is_base) return -1
        if (!a.is_base && b.is_base) return 1

        // Then alphabetical
        return (a.name || '').localeCompare(b.name || '')
      })

      setParallelSeries(sortedParallels)
      log.info(`Found ${sortedParallels.length} parallel series`, {
        parallels: sortedParallels.map(p => p.name)
      })
    } catch (err) {
      log.error('Failed to fetch parallel series', err)
      setParallelSeries([])
    }
  }

  const handleBackToSeries = () => {
    if (isSimpleUrl && card) {
      // For simple URLs, construct the series URL from card data
      navigate(`/sets/${card.set_year}/${card.set_slug}/${card.series_slug}`)
    } else {
      // For complex URLs, use the existing params
      navigate(`/sets/${year}/${setSlug}/${seriesSlug}`)
    }
  }

  const handleParallelSeriesChange = (selectedSeriesId) => {
    if (!selectedSeriesId || !card) return
    
    // Find the selected series to get its slug
    const selectedSeries = parallelSeries.find(s => s.series_id === parseInt(selectedSeriesId))
    if (!selectedSeries) return
    
    // Use current card's actual player names to construct new URL
    const playerNames = card.player_names || 'unknown'
    const playerSlug = playerNames
      .toLowerCase()
      .replace(/,/g, '-') // Replace commas with dashes first
      .replace(/[^a-z0-9\s-]/g, '') // Remove special chars except spaces and dashes
      .replace(/\s+/g, '-') // Replace spaces with dashes
      .replace(/-+/g, '-') // Collapse multiple dashes
      .trim()
    
    
    // Simply navigate to the same card number in the new series
    // If the card doesn't exist, the page will handle the error and can redirect to first card
    navigate(`/card/${selectedSeries.series_slug}/${card.card_number}/${playerSlug}`)
  }

  const navigateToCard = (targetCard) => {
    if (!targetCard) return
    
    // Get player names for URL
    const playerNames = getPlayerNamesFromCard(targetCard) || 'unknown'
    
    // Use simple URL format for navigation with series
    const playerSlug = playerNames
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    
    // Get series slug - use current card's series info if available
    const targetSeriesSlug = card?.series_slug || seriesSlug || 'unknown'
    
    navigate(`/card/${targetSeriesSlug}/${targetCard.card_number}/${playerSlug}`)
  }

  const handlePreviousCard = () => {
    if (currentCardIndex > 0) {
      navigateToCard(seriesCards[currentCardIndex - 1])
    }
  }

  const handleNextCard = () => {
    if (currentCardIndex < seriesCards.length - 1) {
      navigateToCard(seriesCards[currentCardIndex + 1])
    }
  }

  // Helper function to get player names from a card object
  const getPlayerNamesFromCard = (card) => {
    if (!card) return ''
    
    // Handle cards API structure: card_player_teams array with nested player objects
    if (card.card_player_teams && card.card_player_teams.length > 0) {
      return card.card_player_teams
        .map(cpt => {
          // Handle both formats: cpt.player.name or cpt.player.first_name + last_name
          if (cpt.player?.name) {
            return cpt.player.name
          }
          if (cpt.player?.first_name || cpt.player?.last_name) {
            return `${cpt.player.first_name || ''} ${cpt.player.last_name || ''}`.trim()
          }
          return null
        })
        .filter(name => name)
        .join(', ')
    }
    
    // Handle card-detail API structure: aggregated player_names string
    if (card.player_names) {
      return card.player_names
    }
    
    // Handle individual first/last name fields (fallback)
    if (card.first_name || card.last_name) {
      return `${card.first_name || ''} ${card.last_name || ''}`.trim()
    }
    
    // Final fallbacks
    return card.player_name || card.playerName || 'Unknown Player'
  }

  // Function to determine if a color is light or dark for text contrast
  const isLightColor = (hex) => {
    if (!hex) return false
    hex = hex.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5
  }

  const handleDeleteCard = async (cardToDelete) => {
    // Remove confirmation dialog per CLAUDE.md rules - NO JAVASCRIPT ALERTS
    log.info('Deleting card from collection', {
      user_card_id: cardToDelete.user_card_id,
      card_number: card.card_number
    })

    try {
      await axios.delete(`/api/user/cards/${cardToDelete.user_card_id}`)
      success('Card removed from collection')
      log.success('Card deleted from collection')
      // Reload user cards
      await checkUserCards()
    } catch (err) {
      log.error('Failed to delete card', err)
      showError('Failed to remove card from collection')
    }
  }

  const handleFavoriteToggle = async (cardToToggle) => {
    const isFavoriting = !cardToToggle.is_special
    log.info(isFavoriting ? 'Adding card to favorites' : 'Removing card from favorites', {
      user_card_id: cardToToggle.user_card_id
    })

    try {
      await axios.put(`/api/user/cards/${cardToToggle.user_card_id}`, {
        is_special: isFavoriting
      })
      success(isFavoriting ? 'Added to favorites' : 'Removed from favorites')
      log.success(isFavoriting ? 'Card favorited' : 'Card unfavorited')
      // Reload user cards
      await checkUserCards()
    } catch (err) {
      log.error('Failed to toggle favorite status', err)
      showError('Failed to update favorite status')
    }
  }

  const handleCardUpdated = async () => {
    log.debug('Card updated, reloading user collection')
    // Reload user cards after edit
    await checkUserCards()
  }

  const handleAddToCollection = () => {
    if (!isAuthenticated) {
      log.warn('User tried to add card without authentication')
      showError('Please log in to add cards to your collection')
      return
    }
    log.info('Opening add card modal', { card_id: card.card_id })
    setShowAddCardModal(true)
  }

  const handleCardAdded = async () => {
    log.success('Card added to collection')
    // Reload user cards after adding
    await checkUserCards()
    setShowAddCardModal(false)
  }

  const handleImageClick = (side) => {
    setCurrentImageView(side)
    setShowImageViewer(true)
  }

  const handleToggleImage = () => {
    setCurrentImageView(prev => prev === 'front' ? 'back' : 'front')
  }

  const handleListOnEbay = async () => {
    if (!isAuthenticated) {
      showError('Please log in to list on eBay')
      return
    }

    if (!ebayConnected) {
      showError('Please connect your eBay account in your profile settings first')
      navigate('/profile')
      return
    }

    try {
      setCreatingListing(true)
      log.info('Creating eBay listing for card', { card_id: card.card_id })

      const response = await axios.post('/api/ebay/listings/create', {
        card_id: card.card_id
      })

      if (response.data.success) {
        success('Listing created! Opening eBay to add photos and set price...')
        log.success('eBay listing created', { itemId: response.data.listing.itemId })

        // Open eBay's edit page in new tab
        window.open(response.data.listing.editUrl, '_blank')
      }
    } catch (err) {
      log.error('Failed to create eBay listing', err)

      if (err.response?.data?.code === 'EBAY_NOT_CONNECTED') {
        showError('Please connect your eBay account in your profile settings first')
        navigate('/profile')
      } else {
        showError(err.response?.data?.message || 'Failed to create eBay listing')
      }
    } finally {
      setCreatingListing(false)
    }
  }

  if (loading) {
    return (
      <div className="card-detail-page">
        <div className="card-detail-container">
          <div className="loading-state">
            <div className="loading-spinner">
              <div className="card-icon-spinner"></div>
            </div>
            <p>Loading card details...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="card-detail-page">
        <div className="card-detail-container">
          <div className="error-state">
            <Icon name="alert-circle" size={48} />
            <h2>Card Not Found</h2>
            <p>{error}</p>
            <div className="error-actions">
              <button onClick={handleBackToSeries} className="back-button">
                <Icon name="arrow-left" size={16} />
                Back to Series
              </button>
              <Link to="/search" className="search-link">
                <Icon name="search" size={16} />
                Search Cards
              </Link>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!card) {
    return null
  }

  return (
    <div className="card-detail-page">
      <div className="card-detail-container">

        {/* Card Header */}
        <div className="card-header">
          {/* Color Strip for Parallels */}
          {(card.color_hex || card.color_name || card.print_run) && (
            <div 
              className="card-header-color-strip"
              style={{
                '--color': card.color_hex || (card.print_run ? '#6b7280' : '#ec4899'),
                '--text-color': isLightColor(card.color_hex) ? '#000000' : '#ffffff'
              }}
            >
              <span className="card-header-color-text">
                {card.color_name ? (
                  <>
                    {card.color_name}{card.print_run && (
                      <>
                        &nbsp;&nbsp;/{card.print_run.toLocaleString()}
                      </>
                    )}
                  </>
                ) : card.print_run ? (
                  <>
                    /{card.print_run.toLocaleString()}
                  </>
                ) : (
                  'Parallel'
                )}
              </span>
            </div>
          )}

          <div className="card-title-section">
            <h1 className="card-title">
              #{card.card_number}
            </h1>
            <div className="card-subtitle">
              {/* Team-Player pairs */}
              <div className="player-team-pairs">
                {card.player_names.split(',').map((playerName, index) => {
                  const trimmedName = playerName.trim()
                  const team = card.teams?.[index] || card.primary_team
                  
                  return (
                    <div key={index} className="player-team-pair">
                      <div className="player-team-pair-header">
                        {/* Team Circle */}
                        {team && (
                          <div 
                            className="card-team-circle clickable-team-circle"
                            style={{
                              '--team-primary': team.primary_color || '#333',
                              '--team-secondary': team.secondary_color || '#666'
                            }}
                            title={`Go to ${team.name}`}
                            onClick={() => {
                              const teamSlug = team.name
                                .toLowerCase()
                                .replace(/[^a-z0-9\s-]/g, '')
                                .replace(/\s+/g, '-')
                                .replace(/-+/g, '-')
                                .trim()
                              navigate(`/teams/${teamSlug}`)
                            }}
                          >
                            <span>{team.abbreviation}</span>
                          </div>
                        )}
                        {/* Player Name */}
                        <h2 className="player-name clickable-link" onClick={() => {
                          const playerSlug = trimmedName
                            .toLowerCase()
                            .replace(/[^a-z0-9\s-]/g, '')
                            .replace(/\s+/g, '-')
                            .replace(/-+/g, '-')
                            .trim()
                          navigate(`/players/${playerSlug}`)
                        }}>
                          {trimmedName}
                          {card.is_rookie && index === 0 && (
                            <span className="rookie-indicator">
                              RC
                            </span>
                          )}
                          {card.is_short_print && index === 0 && (
                            <span className="rookie-indicator" style={{ background: 'rgba(236, 72, 153, 0.2)', color: '#ec4899', borderColor: 'rgba(236, 72, 153, 0.3)' }}>
                              SP
                            </span>
                          )}
                        </h2>
                      </div>
                    </div>
                  )
                })}
              </div>
              
              {/* Card Tags (Auto/Relic/SP) and Action Buttons - Separate Row */}
              <div className="card-subtitle-bottom">
                {(card.is_autograph || card.is_relic || card.is_short_print) && (
                  <div className="player-card-tags">
                    {card.is_autograph && (
                      <span className="player-tag player-tag-auto">
                        AUTOGRAPH
                      </span>
                    )}
                    {card.is_relic && (
                      <span className="player-tag player-tag-relic">
                        RELIC
                      </span>
                    )}
                    {card.is_short_print && (
                      <span className="player-tag player-tag-sp">
                        SHORT PRINT
                      </span>
                    )}
                  </div>
                )}
                
                {/* Action buttons */}
                <div className="player-action-buttons">
                  {isAuthenticated && (
                    <AddToListDropdown
                      card={card}
                      onAddToCollection={handleAddToCollection}
                      className="squircle-button add-button"
                    />
                  )}
                  {isAuthenticated && ebayConnected && (
                    <button
                      onClick={handleListOnEbay}
                      disabled={creatingListing}
                      className="squircle-button ebay-list-button"
                      title="List this card on eBay"
                    >
                      <Icon name="dollar-sign" size={16} />
                      {creatingListing && <span className="button-loading-spinner"></span>}
                    </button>
                  )}
                  {parallelSeries.length > 1 && (
                    <button
                      onClick={() => {
                        const playerSlug = card.player_names
                          .toLowerCase()
                          .replace(/[^a-z0-9\s-]/g, '')
                          .replace(/\s+/g, '-')
                          .replace(/-+/g, '-')
                          .trim()
                        // Use year/setSlug if available, otherwise use card data
                        const rainbowYear = year || card.set_year
                        const rainbowSetSlug = setSlug || card.set_slug
                        navigate(`/rainbow/${rainbowYear}/${rainbowSetSlug}/${card.series_slug}/${card.card_number}/${playerSlug}`)
                      }}
                      className="squircle-button rainbow-button"
                      title="View all parallels (Rainbow View)"
                    >
                      <Icon name="rainbow" size={16} />
                    </button>
                  )}
                  <SocialShareButton
                    card={card}
                    iconOnly={true}
                    size={16}
                    className="squircle-button share-button"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Stats Boxes and Card Images in Header */}
          <div className="card-header-right-section">
            {/* Card Images */}
            <div className="card-images-header">
              {card.front_image_url ? (
                <img
                  src={card.front_image_url}
                  alt={`${card.player_names} #${card.card_number} - Front`}
                  className="card-image front-card card-image-clickable"
                  onClick={() => handleImageClick('front')}
                  title="Click to view full size"
                />
              ) : (
                <div className="card-image-placeholder front-card">
                  <Icon name="image" size={24} />
                  <p>Front</p>
                  <small>No Image</small>
                </div>
              )}
              {card.back_image_url ? (
                <img
                  src={card.back_image_url}
                  alt={`${card.player_names} #${card.card_number} - Back`}
                  className="card-image back-card card-image-clickable"
                  onClick={() => handleImageClick('back')}
                  title="Click to view full size"
                />
              ) : (
                <div className="card-image-placeholder back-card">
                  <Icon name="image" size={24} />
                  <p>Back</p>
                  <small>No Image</small>
                </div>
              )}
            </div>

            {/* Stats Boxes */}
            <div className="card-stats-header">
              <div className="stat-box">
                <label>Current Value</label>
                <span className="stat-value">TBD</span>
              </div>
              <div className="stat-box">
                <label>CYC Pop</label>
                <span className="stat-value">{card.cyc_population || 0}</span>
              </div>
              <div 
                className="stat-box stat-box-clickable stat-box-logo" 
                onClick={() => {
                  const searchQuery = `${card.set_name} ${card.player_names} #${card.card_number}`
                  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&_sacat=0&_from=R40&_trksid=p4624852.m570.l1313&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339123359&customid=&toolid=10001&mkevt=1`
                  window.open(ebayUrl, '_blank')
                }}
                title="Find on eBay"
              >
                <span className="stat-value">
                  <img 
                    src="https://cardcheckliststorage.blob.core.windows.net/logo/ebay.svg" 
                    alt="eBay" 
                    className="logo-image"
                  />
                </span>
              </div>
              <div 
                className="stat-box stat-box-clickable stat-box-logo" 
                onClick={() => {
                  const searchQuery = `${card.card_number}+${card.set_name}+${card.player_names.replace(/,/g, '+').replace(/\s+/g, '+')}`
                  const comcUrl = `https://www.comc.com/Cards,sh,=${searchQuery}`
                  window.open(comcUrl, '_blank')
                }}
                title="Find on COMC"
              >
                <span className="stat-value">
                  <img 
                    src="https://cardcheckliststorage.blob.core.windows.net/logo/comc.webp" 
                    alt="COMC" 
                    className="logo-image"
                  />
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Subtle Card Navigation */}
        {seriesCards.length > 1 && (
          <div className="card-navigation-subtle">
            {currentCardIndex > 0 && (
              <button 
                onClick={handlePreviousCard} 
                className="nav-card-button prev"
                title="Previous card"
              >
                <Icon name="chevron-left" size={12} />
                <span className="card-nav-info">
                  #{seriesCards[currentCardIndex - 1]?.card_number} {getPlayerNamesFromCard(seriesCards[currentCardIndex - 1])}
                </span>
              </button>
            )}
            
            <div className="nav-series-section">
              <div className="nav-series-name clickable-link" onClick={handleBackToSeries}>
                {card.series_name}
              </div>
              
              {/* Parallels Dropdown */}
              {parallelSeries.length > 1 && (
                <div className="nav-parallels-dropdown" ref={parallelsRef}>
                  <button 
                    className="nav-parallels-toggle"
                    onClick={() => setShowParallels(!showParallels)}
                    title={`${parallelSeries.length} parallel series available`}
                  >
                    <Icon name="shuffle" size={12} />
                    <Icon name={showParallels ? "chevron-up" : "chevron-down"} size={10} />
                  </button>
                  
                  {showParallels && (
                    <div className="nav-parallels-dropdown-menu">
                      {parallelSeries.map(series => (
                        <div 
                          key={series.series_id}
                          className={`nav-parallel-item ${series.series_id === card.series_id ? 'current' : ''}`}
                          onClick={() => {
                            if (series.series_id !== card.series_id) {
                              handleParallelSeriesChange(series.series_id)
                            }
                            setShowParallels(false)
                          }}
                        >
                          <div className="nav-parallel-content">
                            <span className="nav-parallel-name">{series.name}</span>
                            {series.print_run_display && (
                              <span className="nav-parallel-print-run">{series.print_run_display}</span>
                            )}
                          </div>
                          {series.color_hex && (
                            <div 
                              className="nav-parallel-color-stripe"
                              style={{ backgroundColor: series.color_hex }}
                              title={series.color_name || 'Parallel color'}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {currentCardIndex < seriesCards.length - 1 && currentCardIndex >= 0 && (
              <button 
                onClick={handleNextCard} 
                className="nav-card-button next"
                title="Next card"
              >
                <span className="card-nav-info">
                  #{seriesCards[currentCardIndex + 1]?.card_number} {getPlayerNamesFromCard(seriesCards[currentCardIndex + 1])}
                </span>
                <Icon name="chevron-right" size={12} />
              </button>
            )}
          </div>
        )}


      </div>

      {/* User's Collection of this Card - Full Width Outside Container */}
      {isAuthenticated && card && userCards.length > 0 && (
        <CollectionTable
          cards={userCards}
          loading={checkingUserCards}
          onEditCard={(card) => {
            setCardToEdit(card)
            setShowEditModal(true)
          }}
          onDeleteCard={handleDeleteCard}
          onFavoriteToggle={handleFavoriteToggle}
          onCardClick={null} // Don't navigate from here
          showSearch={true}
          showGalleryToggle={true}
          viewMode="table"
          maxHeight="600px"
          showDownload={false}
        />
      )}

      {/* Admin Edit Button */}
      {isAdmin && card && (
        <button 
          className="admin-edit-button"
          onClick={() => navigate(`/admin/cards?series=${card.series_id}`)}
          title="Edit card (Admin)"
        >
          <Icon name="edit" size={20} />
        </button>
      )}

      {/* Comments Section */}
      {card && (
        <CommentsSection
          itemType="card"
          itemId={card.card_id}
          title={`Discussion about ${card.player_names} #${card.card_number}`}
        />
      )}
      
      {/* Add Card Modal */}
      {showAddCardModal && (
        <AddCardModal
          isOpen={showAddCardModal}
          onClose={() => setShowAddCardModal(false)}
          card={card}
          onCardAdded={handleCardAdded}
        />
      )}
      
      {/* Quick Edit Modal */}
      {showEditModal && cardToEdit && (
        <QuickEditModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false)
            setCardToEdit(null)
          }}
          card={cardToEdit}
          onCardUpdated={handleCardUpdated}
          locations={locations}
          gradingAgencies={gradingAgencies}
        />
      )}

      {/* Full-Screen Image Viewer */}
      {showImageViewer && (card.front_image_url || card.back_image_url) && (
        <div className="card-image-viewer-overlay" onClick={() => setShowImageViewer(false)}>
          <div className="card-image-viewer-container" onClick={(e) => e.stopPropagation()}>
            {/* Close Button */}
            <button
              className="card-image-viewer-close"
              onClick={() => setShowImageViewer(false)}
              title="Close (Esc)"
            >
              <Icon name="x" size={24} />
            </button>

            {/* Image Display */}
            <div className="card-image-viewer-image-container">
              {currentImageView === 'front' && card.front_image_url && (
                <img
                  src={card.front_image_url}
                  alt={`${card.player_names} #${card.card_number} - Front`}
                  className="card-image-viewer-image"
                />
              )}
              {currentImageView === 'back' && card.back_image_url && (
                <img
                  src={card.back_image_url}
                  alt={`${card.player_names} #${card.card_number} - Back`}
                  className="card-image-viewer-image"
                />
              )}
            </div>

            {/* Navigation - Only show if both images exist */}
            {card.front_image_url && card.back_image_url && (
              <div className="card-image-viewer-nav">
                <button
                  className={`card-image-viewer-nav-btn ${currentImageView === 'front' ? 'active' : ''}`}
                  onClick={() => setCurrentImageView('front')}
                  title="Front (Left Arrow)"
                >
                  <Icon name="chevron-left" size={32} />
                  <span>Front</span>
                </button>
                <button
                  className={`card-image-viewer-nav-btn ${currentImageView === 'back' ? 'active' : ''}`}
                  onClick={() => setCurrentImageView('back')}
                  title="Back (Right Arrow)"
                >
                  <span>Back</span>
                  <Icon name="chevron-right" size={32} />
                </button>
              </div>
            )}

            {/* Label */}
            <div className="card-image-viewer-label">
              {currentImageView === 'front' ? 'Front' : 'Back'} - {card.player_names} #{card.card_number}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CardDetail