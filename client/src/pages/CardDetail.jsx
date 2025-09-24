import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import CollectionTable from '../components/tables/CollectionTable'
import QuickEditModal from '../components/modals/QuickEditModal'
import AddCardModal from '../components/modals/AddCardModal'
import CommentsSection from '../components/CommentsSection'
import { useToast } from '../contexts/ToastContext'
import SocialShareButton from '../components/SocialShareButton'
import './CardDetailScoped.css'

function CardDetail() {
  // Handle both URL formats: 
  // 1. Complex: /sets/:year/:setSlug/:seriesSlug/:cardSlug
  // 2. Simple: /card/:seriesSlug/:cardNumber/:playerName
  const params = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const { success, error: showError } = useToast()
  
  // Extract parameters - check if we have the simple URL structure
  let year, setSlug, seriesSlug, cardSlug, cardNumber, playerName
  
  if (params.cardNumber && params.playerName && !params.year) {
    // Simple URL format: /card/:seriesSlug/:cardNumber/:playerName
    seriesSlug = params.seriesSlug
    cardNumber = params.cardNumber
    playerName = params.playerName
  } else {
    // Complex URL format: /sets/:year/:setSlug/:seriesSlug/:cardSlug
    year = params.year
    setSlug = params.setSlug
    seriesSlug = params.seriesSlug
    cardSlug = params.cardSlug
  }
  
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
  
  // Determine which URL format we're using
  const isSimpleUrl = !!(cardNumber && playerName)
  
  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)
  
  useEffect(() => {
    fetchCardDetails()
  }, [year, setSlug, seriesSlug, cardSlug, cardNumber, playerName])

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
    } else {
      setCheckingUserCards(false)
      setUserCards([])
    }
  }, [isAuthenticated, card])

  const checkUserCards = async () => {
    try {
      setCheckingUserCards(true)
      const response = await axios.get(`/api/user/cards/${card.card_id}`)
      setUserCards(response.data.cards || [])
      
      // Load locations and grading agencies for the edit modal
      const [locationsRes, gradingRes] = await Promise.all([
        axios.get('/api/user/locations'),
        axios.get('/api/grading-agencies')
      ])
      setLocations(locationsRes.data.locations || [])
      setGradingAgencies(gradingRes.data.agencies || [])
    } catch (err) {
      console.error('Error checking user cards:', err)
      setUserCards([])
    } finally {
      setCheckingUserCards(false)
    }
  }

  const fetchCardDetails = async () => {
    try {
      setLoading(true)
      setError(null)
      
      let response
      
      if (isSimpleUrl) {
        // Use simple URL format API endpoint with series
        response = await axios.get(`/api/card/${seriesSlug}/${cardNumber}/${playerName}`)
      } else {
        // Use complex URL format API endpoint
        response = await axios.get(`/api/card-detail/${year}/${setSlug}/${seriesSlug}/${cardSlug}`)
      }
      
      if (response.data.success) {
        setCard(response.data.card)
        
        // Fetch all cards in the series for navigation
        await fetchSeriesCards(response.data.card)
      } else {
        setError('Card not found')
      }
    } catch (err) {
      console.error('Error fetching card details:', err)
      setError(err.response?.data?.message || 'Failed to load card details')
    } finally {
      setLoading(false)
    }
  }

  const fetchSeriesCards = async (cardData) => {
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
      
    } catch (err) {
      console.error('Error fetching series cards:', err)
      setSeriesCards([])
      setCurrentCardIndex(-1)
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
    try {
      await axios.delete(`/api/user/cards/${cardToDelete.user_card_id}`)
      success('Card removed from collection')
      // Reload user cards
      await checkUserCards()
    } catch (err) {
      console.error('Error deleting card:', err)
      showError('Failed to remove card from collection')
    }
  }

  const handleFavoriteToggle = async (cardToToggle) => {
    try {
      await axios.put(`/api/user/cards/${cardToToggle.user_card_id}`, {
        is_special: !cardToToggle.is_special
      })
      success(cardToToggle.is_special ? 'Removed from favorites' : 'Added to favorites')
      // Reload user cards
      await checkUserCards()
    } catch (err) {
      console.error('Error toggling favorite:', err)
      showError('Failed to update favorite status')
    }
  }

  const handleCardUpdated = async () => {
    // Reload user cards after edit
    await checkUserCards()
  }

  const handleAddToCollection = () => {
    if (!isAuthenticated) {
      showError('Please log in to add cards to your collection')
      return
    }
    setShowAddCardModal(true)
  }

  const handleCardAdded = async () => {
    // Reload user cards after adding
    await checkUserCards()
    setShowAddCardModal(false)
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
          {(card.color_hex || card.color_name) && (
            <div 
              className="card-header-color-strip"
              style={{
                '--color': card.color_hex || '#ec4899',
                '--text-color': isLightColor(card.color_hex) ? '#000000' : '#ffffff'
              }}
            >
              <span className="card-header-color-text">
                {card.color_name || 'Parallel'}{card.print_run && (
                  <>
                    &nbsp;&nbsp;/{card.print_run.toLocaleString()}
                  </>
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
                        </h2>
                      </div>
                      
                      {/* Auto/Relic tags and action buttons below each player name */}
                      {index === 0 && (
                        <div className="player-actions-row">
                          {(card.is_autograph || card.is_relic) && (
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
                            </div>
                          )}
                          
                          {/* Action buttons */}
                          <div className="player-action-buttons">
                            {isAuthenticated && (
                              <button 
                                className="squircle-button add-button"
                                onClick={handleAddToCollection}
                                title="Add to Collection"
                              >
                                <Icon name="plus" size={16} />
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
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>

          {/* Stats Boxes and Card Images in Header */}
          <div className="card-header-right-section">
            {/* Card Images */}
            <div className="card-images-header">
              <div className="card-image-placeholder front-card">
                <Icon name="image" size={24} />
                <p>Front</p>
                <small>No Image</small>
              </div>
              <div className="card-image-placeholder back-card">
                <Icon name="image" size={24} />
                <p>Back</p>
                <small>No Image</small>
              </div>
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
                  const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}`
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
            
            <div className="nav-series-name clickable-link" onClick={handleBackToSeries}>
              {card.series_name}
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
    </div>
  )
}

export default CardDetail