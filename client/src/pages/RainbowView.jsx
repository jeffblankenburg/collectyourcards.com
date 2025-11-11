import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import CardTable from '../components/tables/CardTable'
import AddCardModal from '../components/modals/AddCardModal'
import { useToast } from '../contexts/ToastContext'
import { generateSlug } from '../utils/slugs'
import { createLogger } from '../utils/logger'
import './CardDetailScoped.css'

const log = createLogger('RainbowView')

function RainbowView() {
  const { year, setSlug, seriesSlug, cardNumber, playerName } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const { success, error: showError } = useToast()

  log.info('RainbowView mounted', { year, setSlug, seriesSlug, cardNumber, playerName })

  const [rainbowCards, setRainbowCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [cardInfo, setCardInfo] = useState(null) // Info about the card for header
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [showImageViewer, setShowImageViewer] = useState(false)
  const [currentImageView, setCurrentImageView] = useState('front') // 'front' or 'back'

  useEffect(() => {
    fetchRainbowCards()
  }, [year, setSlug, seriesSlug, cardNumber, playerName])

  // Set page title when data loads
  useEffect(() => {
    if (cardInfo) {
      document.title = `Rainbow: #${cardInfo.card_number} ${cardInfo.player_names} - Collect Your Cards`
    } else if (loading) {
      document.title = 'Loading Rainbow View... - Collect Your Cards'
    }
  }, [cardInfo, loading])

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

  const fetchRainbowCards = async () => {
    const startTime = performance.now()

    try {
      setLoading(true)
      setError(null)
      log.info('Starting rainbow card fetch', { seriesSlug, cardNumber, playerName })

      // First, get the correct set_id using year and setSlug
      let targetSetId = null

      if (year && setSlug) {
        log.debug('Fetching sets list for set validation', { year, setSlug })
        const setsResponse = await axios.get('/api/sets-list')
        const allSets = setsResponse.data.sets || []

        log.debug('Sets list received', { totalSets: allSets.length })

        // Log all 2022 sets for debugging
        const matchingYearSets = allSets.filter(set => {
          const setYear = set.year || parseInt(set.name.split(' ')[0])
          return setYear === parseInt(year)
        })

        log.group(`Found ${matchingYearSets.length} sets for year ${year}`, () => {
          matchingYearSets.forEach(set => {
            const slug = generateSlug(set.name)
            log.debug(`  "${set.name}"`, {
              set_id: set.set_id,
              year: set.year,
              slug: slug,
              matches: slug === setSlug
            })
          })
        })

        const foundSet = allSets.find(set => {
          const setYear = set.year || parseInt(set.name.split(' ')[0])
          return setYear === parseInt(year) && set.slug === setSlug
        })

        if (foundSet) {
          targetSetId = foundSet.set_id
          log.success(`Found matching set: "${foundSet.name}"`, {
            set_id: targetSetId,
            slug: generateSlug(foundSet.name)
          })
        } else {
          log.warn('No matching set found', {
            year,
            setSlug,
            availableSlugs: matchingYearSets.map(s => generateSlug(s.name))
          })
        }
      } else {
        log.debug('No year/setSlug provided, skipping set validation')
      }

      // Fetch the card - pass set_id if we have it for disambiguation
      const cardApiPath = `/api/card/${seriesSlug}/${cardNumber}/${playerName}`
      const apiParams = targetSetId ? { set_id: targetSetId } : {}
      log.debug('Fetching card', { path: cardApiPath, params: apiParams })

      const cardFetchStart = performance.now()
      const cardResponse = await axios.get(cardApiPath, { params: apiParams })
      log.performance('Card fetch', cardFetchStart)

      if (!cardResponse.data.success) {
        log.error('Card not found in API response')
        setError('Card not found')
        return
      }

      const card = cardResponse.data.card
      log.info('Card fetched successfully', {
        card_id: card.card_id,
        card_number: card.card_number,
        set_id: card.set_id,
        set_name: card.set_name,
        series_name: card.series_name
      })

      // Verify the card is from the expected set (should match since we passed set_id to API)
      if (targetSetId && card.set_id !== targetSetId) {
        log.error('Set validation failed - API returned card from wrong set', {
          expectedSetId: targetSetId,
          actualSetId: card.set_id,
          cardSetName: card.set_name,
          urlYear: year,
          urlSetSlug: setSlug
        })
        setError(`Card #${cardNumber} not found in the specified set`)
        return
      }

      if (targetSetId) {
        log.success('Set validation passed - card is from correct set')
      }
      setCardInfo(card)

      // Now fetch all rainbow cards (parallels with same card number in the set)
      log.debug('Fetching rainbow parallels', {
        set_id: card.set_id,
        card_number: card.card_number
      })

      const rainbowFetchStart = performance.now()
      const rainbowResponse = await axios.get(`/api/cards/rainbow`, {
        params: {
          set_id: card.set_id,
          card_number: card.card_number
        }
      })
      log.performance('Rainbow fetch', rainbowFetchStart)

      const rainbowCards = rainbowResponse.data.cards || []
      log.success(`Loaded ${rainbowCards.length} rainbow parallels`)

      setRainbowCards(rainbowCards)
      log.performance('Complete rainbow view load', startTime)

    } catch (err) {
      log.error('Failed to fetch rainbow cards', {
        error: err.message,
        response: err.response?.data,
        status: err.response?.status
      })
      setError(err.response?.data?.message || 'Failed to load rainbow view')
    } finally {
      setLoading(false)
    }
  }

  const handleBackToCard = () => {
    // Navigate back to the original card detail page using year/setSlug
    if (year && setSlug) {
      navigate(`/sets/${year}/${setSlug}/${seriesSlug}`)
    } else {
      navigate(`/card/${seriesSlug}/${cardNumber}/${playerName}`)
    }
  }

  const handleCardClick = (card) => {
    // Navigate to that specific card's detail page
    const playerNames = card.card_player_teams?.map(cpt =>
      `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
    ).filter(name => name).join(', ') || 'unknown'

    const clickedSeriesSlug = card.series_rel?.slug || 'unknown'
    const playerSlug = generateSlug(playerNames)

    // Navigate to the specific card detail page
    // Always use the simple /card/ route - CardDetail will handle canonical URL internally
    navigate(`/card/${clickedSeriesSlug}/${card.card_number}/${playerSlug}`)
  }

  const handleAddCard = (card) => {
    setSelectedCard(card)
    setShowAddCardModal(true)
  }

  const handleCardAdded = async () => {
    // Refresh the rainbow cards to update user counts
    await fetchRainbowCards()
    setShowAddCardModal(false)
  }

  const handleImageClick = (side) => {
    setCurrentImageView(side)
    setShowImageViewer(true)
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

  if (loading) {
    return (
      <div className="card-detail-page">
        <div className="card-detail-container">
          <div className="loading-state">
            <div className="loading-spinner">
              <div className="card-icon-spinner"></div>
            </div>
            <p>Loading rainbow view...</p>
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
            <h2>Rainbow View Not Available</h2>
            <p>{error}</p>
            <div className="error-actions">
              <button onClick={handleBackToCard} className="back-button">
                <Icon name="arrow-left" size={16} />
                Back to Card
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (!cardInfo) {
    return null
  }

  return (
    <div className="card-detail-page">
      <div className="card-detail-container">

        {/* Card Header */}
        <div className="card-header">
          {/* Rainbow indicator strip */}
          <div
            className="card-header-color-strip"
            style={{
              background: 'linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080)',
              '--text-color': '#ffffff'
            }}
          >
            <span className="card-header-color-text">
              Rainbow View - All Parallels
            </span>
          </div>

          <div className="card-title-section">
            <h1 className="card-title">
              #{cardInfo.card_number}
            </h1>
            <div className="card-subtitle">
              {/* Team-Player pairs */}
              <div className="player-team-pairs">
                {cardInfo.player_names.split(',').map((playerName, index) => {
                  const trimmedName = playerName.trim()
                  const team = cardInfo.teams?.[index] || cardInfo.primary_team

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
                              const teamSlug = generateSlug(team.name)
                              navigate(`/teams/${teamSlug}`)
                            }}
                          >
                            <span>{team.abbreviation}</span>
                          </div>
                        )}
                        {/* Player Name */}
                        <h2 className="player-name clickable-link" onClick={() => {
                          const playerSlug = generateSlug(trimmedName)
                          navigate(`/players/${playerSlug}`)
                        }}>
                          {trimmedName}
                          {cardInfo.is_rookie && index === 0 && (
                            <span className="rookie-indicator">
                              RC
                            </span>
                          )}
                          {cardInfo.is_short_print && index === 0 && (
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

              {/* Card Tags (Auto/Relic/SP) and Action Buttons */}
              <div className="card-subtitle-bottom">
                {(cardInfo.is_autograph || cardInfo.is_relic || cardInfo.is_short_print) && (
                  <div className="player-card-tags">
                    {cardInfo.is_autograph && (
                      <span className="player-tag player-tag-auto">
                        AUTOGRAPH
                      </span>
                    )}
                    {cardInfo.is_relic && (
                      <span className="player-tag player-tag-relic">
                        RELIC
                      </span>
                    )}
                    {cardInfo.is_short_print && (
                      <span className="player-tag player-tag-sp">
                        SHORT PRINT
                      </span>
                    )}
                  </div>
                )}

                {/* Back button */}
                <div className="player-action-buttons">
                  <button
                    onClick={handleBackToCard}
                    className="squircle-button back-button"
                    title="Back to card detail"
                  >
                    ←
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Stats Boxes and Card Images in Header */}
          <div className="card-header-right-section">
            {/* Card Images */}
            <div className="card-images-header">
              {cardInfo.front_image_url ? (
                <img
                  src={cardInfo.front_image_url}
                  alt={`${cardInfo.player_names} #${cardInfo.card_number} - Front`}
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
              {cardInfo.back_image_url ? (
                <img
                  src={cardInfo.back_image_url}
                  alt={`${cardInfo.player_names} #${cardInfo.card_number} - Back`}
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
                <label>Parallels Found</label>
                <span className="stat-value">{rainbowCards.length}</span>
              </div>
              <div className="stat-box">
                <label>Set</label>
                <span className="stat-value">{cardInfo.set_name}</span>
              </div>
              <div
                className="stat-box stat-box-clickable stat-box-logo"
                onClick={() => {
                  const searchQuery = `${cardInfo.set_name} ${cardInfo.player_names} #${cardInfo.card_number}`
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
                  const searchQuery = `${cardInfo.card_number}+${cardInfo.set_name}+${cardInfo.player_names.replace(/,/g, '+').replace(/\s+/g, '+')}`
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

        {/* Info Section */}
        <div className="rainbow-info-section" style={{
          padding: '16px 24px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '8px',
          margin: '16px 0',
          fontSize: '14px',
          color: 'rgba(255, 255, 255, 0.7)'
        }}>
          <p style={{ margin: 0 }}>
            <Icon name="info" size={16} style={{ verticalAlign: 'middle', marginRight: '8px' }} />
            Showing all parallel versions of card #{cardInfo.card_number} from the {cardInfo.set_name} set.
            Click any card number to view its details.
          </p>
        </div>

      </div>

      {/* Rainbow Cards Table - Full Width Outside Container */}
      {rainbowCards.length > 0 && (
        <CardTable
          cards={rainbowCards}
          loading={loading}
          onAddCard={handleAddCard}
          onCardClick={handleCardClick}
          showSearch={true}
          showBulkActions={false}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          maxHeight="none"
          showDownload={true}
          downloadFilename={`rainbow-${cardInfo.card_number}-${cardInfo.set_name}`}
          defaultSort="series_name"
          autoFocusSearch={false}
        />
      )}

      {/* Add Card Modal */}
      {showAddCardModal && (
        <AddCardModal
          isOpen={showAddCardModal}
          onClose={() => setShowAddCardModal(false)}
          card={selectedCard}
          onCardAdded={handleCardAdded}
        />
      )}

      {/* Full-Screen Image Viewer */}
      {showImageViewer && (cardInfo.front_image_url || cardInfo.back_image_url) && (
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
              {currentImageView === 'front' && cardInfo.front_image_url && (
                <img
                  src={cardInfo.front_image_url}
                  alt={`${cardInfo.player_names} #${cardInfo.card_number} - Front`}
                  className="card-image-viewer-image"
                />
              )}
              {currentImageView === 'back' && cardInfo.back_image_url && (
                <img
                  src={cardInfo.back_image_url}
                  alt={`${cardInfo.player_names} #${cardInfo.card_number} - Back`}
                  className="card-image-viewer-image"
                />
              )}
            </div>

            {/* Navigation - Only show if both images exist */}
            {cardInfo.front_image_url && cardInfo.back_image_url && (
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
              {currentImageView === 'front' ? 'Front' : 'Back'} - {cardInfo.player_names} #{cardInfo.card_number}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default RainbowView
