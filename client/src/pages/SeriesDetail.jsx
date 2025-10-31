import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import CardTable from '../components/tables/CardTable'
import AddCardModal from '../components/modals/AddCardModal'
import BulkCardModal from '../components/modals/BulkCardModal'
import CommentsSection from '../components/CommentsSection'
import ActivityFeed from '../components/ActivityFeed'
import { generateSlug } from '../utils/slugs'
import { createLogger } from '../utils/logger'
import './SeriesDetail.css'

const log = createLogger('SeriesDetail')

function SeriesDetail() {
  const { seriesSlug, year, setSlug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [series, setSeries] = useState(null)

  log.info('SeriesDetail mounted', { seriesSlug, year, setSlug, isAuthenticated })
  const [stats, setStats] = useState({})
  const [parallels, setParallels] = useState([])
  const [showParallels, setShowParallels] = useState(false)
  const [collectionCompletion, setCollectionCompletion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const parallelsRef = useRef(null)
  
  // Table-specific state
  const [cards, setCards] = useState([])
  const [tableLoading, setTableLoading] = useState(false)
  
  // Modal state
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  
  // Bulk selection state
  const [bulkSelectionMode, setBulkSelectionMode] = useState(false)
  const [selectedCards, setSelectedCards] = useState(new Set())
  const [showBulkActionsModal, setShowBulkActionsModal] = useState(false)

  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  useEffect(() => {
    fetchSeriesData()
  }, [seriesSlug, year, setSlug])

  // Set page title when series loads
  useEffect(() => {
    if (series?.name) {
      document.title = `${series.name} - Collect Your Cards`
    } else if (loading) {
      document.title = 'Loading Series... - Collect Your Cards'
    }
  }, [series?.name, loading])

  // Close parallels dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (parallelsRef.current && !parallelsRef.current.contains(event.target)) {
        setShowParallels(false)
      }
    }

    if (showParallels) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showParallels])

  const fetchSeriesData = async () => {
    const startTime = performance.now()
    log.info('Fetching series data', { seriesSlug, year, setSlug })

    try {
      setLoading(true)

      let seriesList = []

      if (year && setSlug) {
        log.debug('Using canonical URL format', { year, setSlug })
        // If we have year and setSlug, get series for that specific set
        // First get the set ID
        const setsResponse = await axios.get('/api/sets-list')
        const allSets = setsResponse.data.sets || []
        const foundSet = allSets.find(set => {
          const setYear = set.year || parseInt(set.name.split(' ')[0])
          const slug = generateSlug(set.name)
          return setYear === parseInt(year) && slug === setSlug
        })

        if (foundSet) {
          log.debug('Found set', { set_id: foundSet.set_id, set_name: foundSet.name })
          // Get series for this set
          const seriesResponse = await axios.get(`/api/series-by-set/${foundSet.set_id}`)
          seriesList = seriesResponse.data.series || []
          log.debug(`Loaded ${seriesList.length} series from set`)
        } else {
          log.warn('Set not found', { year, setSlug })
        }
      } else {
        log.debug('Using fallback /series/:seriesSlug route')
        // Fallback to getting all series (for /series/:seriesSlug route)
        const response = await axios.get('/api/series-list')
        seriesList = response.data.series || []
        log.debug(`Loaded ${seriesList.length} series from series-list`)
      }

      // Find series by slug (using standard slug generation)
      const foundSeries = seriesList.find(s => {
        if (!s.name) return false
        const slug = generateSlug(s.name)
        return slug === seriesSlug
      })

      if (foundSeries) {
        setSeries(foundSeries)
        log.success('Series found', {
          series_id: foundSeries.series_id,
          name: foundSeries.name,
          set_name: foundSeries.set_name
        })

        // If we're on the fallback /series/:seriesSlug route, redirect to canonical URL
        if (!year && !setSlug && foundSeries.set_year && foundSeries.set_slug) {
          log.navigation(`/series/${seriesSlug}`,
            `/sets/${foundSeries.set_year}/${foundSeries.set_slug}/${seriesSlug}`,
            { reason: 'Redirecting to canonical URL' })
          navigate(`/sets/${foundSeries.set_year}/${foundSeries.set_slug}/${seriesSlug}`, { replace: true })
          return
        }

        // Get actual stats for the series
        await fetchSeriesStats(foundSeries)

        // Get related parallels
        await fetchRelatedParallels(foundSeries, seriesList)

        setError(null)
        log.performance('Complete series data load', startTime)
      } else {
        log.error('Series not found', { seriesSlug, availableSlugs: seriesList.map(s => generateSlug(s.name)).slice(0, 10) })
        setError('Series not found')
      }
    } catch (err) {
      log.error('Failed to fetch series data', err)
      setError('Failed to load series data')
    } finally {
      setLoading(false)
    }
  }

  const fetchSeriesStats = async (series) => {
    log.debug('Fetching series stats', { series_id: series.series_id })

    try {
      // Get ALL cards for the series by setting a high limit
      const response = await axios.get(`/api/cards?series_id=${series.series_id}&limit=10000`)
      const cards = response.data.cards || []

      // Calculate stats from the actual card data
      const seriesStats = {
        total_cards: cards.length,
        rookie_cards: cards.filter(card =>
          card.card_player_teams?.some(cpt => cpt.is_rookie) || card.is_rookie
        ).length,
        autograph_cards: cards.filter(card => card.is_autograph).length,
        relic_cards: cards.filter(card => card.is_relic).length,
        numbered_cards: cards.filter(card => card.print_run && card.print_run > 0).length,
        unique_players: new Set(
          cards.flatMap(card =>
            card.card_player_teams?.map(cpt => cpt.player?.player_id) || []
          )
        ).size
      }

      setStats(seriesStats)
      log.info('Series stats calculated', seriesStats)
    } catch (err) {
      log.error('Failed to fetch series stats', err)
      // Fallback to basic stats if API call fails
      const fallbackStats = {
        total_cards: series.card_count || 0,
        rookie_cards: 0,
        autograph_cards: 0,
        relic_cards: 0,
        numbered_cards: 0,
        unique_players: 0
      }
      setStats(fallbackStats)
      log.warn('Using fallback stats', fallbackStats)
    }
  }

  const fetchRelatedParallels = async (currentSeries, allSeries) => {
    log.debug('Fetching related parallels', {
      series_id: currentSeries.series_id,
      is_parallel: currentSeries.is_parallel
    })

    try {
      const relatedParallels = []

      if (currentSeries.is_parallel && currentSeries.parallel_of_series) {
        // If this is a parallel, find the parent and other parallels of the same parent
        const parentId = currentSeries.parallel_of_series

        // Find the parent series
        const parent = allSeries.find(s => s.series_id === parentId)
        if (parent) {
          relatedParallels.push({
            ...parent,
            relationship: 'parent'
          })
        }

        // Find other parallels of the same parent
        const siblings = allSeries.filter(s =>
          s.parallel_of_series === parentId &&
          s.series_id !== currentSeries.series_id
        )
        siblings.forEach(sibling => {
          relatedParallels.push({
            ...sibling,
            relationship: 'sibling'
          })
        })
      } else {
        // If this is a parent series, find all its parallels
        const children = allSeries.filter(s =>
          s.parallel_of_series === currentSeries.series_id
        )
        children.forEach(child => {
          relatedParallels.push({
            ...child,
            relationship: 'parallel'
          })
        })
      }

      setParallels(relatedParallels)
      log.info(`Found ${relatedParallels.length} related parallels`)
    } catch (err) {
      log.error('Failed to fetch related parallels', err)
      setParallels([])
    }
  }

  // Table data loading function
  const loadTableData = async () => {
    if (!series) return

    const startTime = performance.now()
    log.debug('Loading card table data', { series_id: series.series_id })

    try {
      setTableLoading(true)
      const url = `/api/cards?series_id=${series.series_id}&limit=10000`

      const response = await axios.get(url)
      const { cards: newCards } = response.data

      setCards(newCards || [])
      log.info(`Loaded ${newCards?.length || 0} cards for table`)
      log.performance('Card table load', startTime)
    } catch (error) {
      log.error('Failed to load card table data', error)
    } finally {
      setTableLoading(false)
    }
  }

  // Load table data when series changes
  useEffect(() => {
    if (series) {
      loadTableData()
    }
  }, [series?.series_id])


  const handleAddCard = (card) => {
    setSelectedCard(card)
    setShowAddCardModal(true)
  }

  const handleCardAdded = () => {
    // Reload data to get updated counts
    loadTableData()
    setShowAddCardModal(false)
  }

  const handleCardClick = (card) => {
    // Generate the player names for URL
    const playerNames = card.card_player_teams?.map(cpt =>
      `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
    ).filter(name => name).join(', ') || 'unknown'

    const playerSlug = generateSlug(playerNames)

    // Use canonical URL with year/setSlug when available
    if (year && setSlug) {
      navigate(`/sets/${year}/${setSlug}/${seriesSlug}/${card.card_number}/${playerSlug}`)
    } else {
      // Fallback to simple route
      navigate(`/card/${seriesSlug}/${card.card_number}/${playerSlug}`)
    }
  }

  if (loading) {
    return (
      <div className="series-detail-page">
        <div className="loading-container">
          <Icon name="activity" size={24} className="spinner" />
          <p>Loading series details...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="series-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <p>{error}</p>
          <button onClick={fetchSeriesData} className="retry-button">
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (!series) {
    return (
      <div className="series-detail-page">
        <div className="error-container">
          <Icon name="error" size={24} />
          <p>Series not found</p>
        </div>
      </div>
    )
  }

  // Calculate text color based on background brightness (for parallel colors)
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

  return (
    <div className="series-detail-page">
      <div className="series-detail-container">
        
        {/* Series Header - Redesigned */}
        <header className="series-header-combined">
          {/* Color Strip - Right Side */}
          <div 
            className="color-strip-right"
            style={{
              backgroundColor: series.color_hex_value || '#3b82f6'
            }}
          >
            <span 
              className="color-strip-text"
              style={{
                color: getTextColor(series.color_hex_value || '#3b82f6')
              }}
            >
              {series.color_name && series.print_run_display ? 
                `${series.color_name.toUpperCase()} ${series.print_run_display}` :
                series.color_name ? series.color_name.toUpperCase() :
                series.print_run_display ? series.print_run_display :
                'BASE'
              }
            </span>
          </div>
          
          <div className="series-header-content">
            {/* Two Column Layout */}
            <div className="series-header-top">
              <div className="series-title-section">
                <div className="series-title-line">
                  {year && setSlug ? (
                    <Link 
                      to={`/sets/${year}/${setSlug}`}
                      className="back-button"
                      title="Back to series list"
                    >
                      <Icon name="arrow-left" size={24} />
                    </Link>
                  ) : (
                    <Link 
                      to="/sets"
                      className="back-button"
                      title="Back to sets"
                    >
                      <Icon name="arrow-left" size={24} />
                    </Link>
                  )}
                  <h1 className="series-name">{series.name}</h1>
                </div>
                
                {/* Card Images in same column as title */}
                {(series.front_image_path || series.back_image_path) && (
                  <div className="card-images-section">
                    <div className="card-images-container">
                      {series.front_image_path && (
                        <div className="card-image-wrapper">
                          <img 
                            src={series.front_image_path}
                            alt={`${series.name} front`}
                            className="card-image front-image"
                          />
                          <span className="image-label">Front</span>
                        </div>
                      )}
                      {series.back_image_path && (
                        <div className="card-image-wrapper">
                          <img 
                            src={series.back_image_path}
                            alt={`${series.name} back`}
                            className="card-image back-image"
                          />
                          <span className="image-label">Back</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Stats and Parallels */}
              <div className="series-stats-section">
                <div className="series-stats-grid">
                  {/* Collection Completion for Authenticated Users */}
                  {isAuthenticated && collectionCompletion && (
                    <div className="stat-compact completion-stat">
                      <span 
                        className="stat-value"
                        style={{
                          color: collectionCompletion.percentage === 100 ? '#10b981' : 
                                collectionCompletion.percentage >= 90 ? '#f59e0b' : '#ef4444'
                        }}
                      >
                        {collectionCompletion.percentage}%
                      </span>
                      <span className="stat-label">Complete</span>
                    </div>
                  )}
                  
                  <div className="stat-compact">
                    <span className="stat-value">{stats.total_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label">Cards</span>
                  </div>
                  <div className="stat-compact">
                    <span className="stat-value">{stats.rookie_cards?.toLocaleString() || 0}</span>
                    <span className="stat-label">Rookies</span>
                  </div>
                </div>

                {/* Parallels Dropdown */}
                {parallels.length > 0 && (
                  <div className="parallels-compact">
                    <div className="parallels-dropdown" ref={parallelsRef}>
                      <button 
                        className="parallels-toggle"
                        onClick={() => setShowParallels(!showParallels)}
                      >
                        <span className="parallels-count">{parallels.length} related parallel{parallels.length === 1 ? '' : 's'}</span>
                        <Icon name={showParallels ? "arrow-up" : "arrow-down"} size={14} />
                      </button>
                      
                      {showParallels && (
                        <div className="parallels-dropdown-menu">
                          {parallels.map(parallel => (
                            <div
                              key={parallel.series_id}
                              className={`parallel-item-compact ${parallel.relationship}`}
                              onClick={() => {
                                const slug = generateSlug(parallel.name)
                                // Use canonical URL with year/setSlug if available
                                if (year && setSlug) {
                                  navigate(`/sets/${year}/${setSlug}/${slug}`)
                                } else if (parallel.set_year && parallel.set_slug) {
                                  navigate(`/sets/${parallel.set_year}/${parallel.set_slug}/${slug}`)
                                } else {
                                  navigate(`/series/${slug}`)
                                }
                              }}
                            >
                              <div className="parallel-content-compact">
                                <span className="parallel-name-compact">{parallel.name}</span>
                                {parallel.print_run_display && (
                                  <span className="parallel-print-run-tag">{parallel.print_run_display}</span>
                                )}
                              </div>
                              {parallel.color_hex_value && (
                                <div 
                                  className="parallel-color-stripe"
                                  style={{ backgroundColor: parallel.color_hex_value }}
                                  title={parallel.color_name}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Cards Table */}
        {series && (
          <CardTable
            cards={cards}
            loading={tableLoading}
            onAddCard={handleAddCard}
            onCardClick={handleCardClick}
            onPlayerClick={(player) => {
              const playerName = `${player.first_name} ${player.last_name}`
              const playerSlug = generateSlug(playerName)
              navigate(`/players/${playerSlug}`)
            }}
            bulkSelectionMode={bulkSelectionMode}
            selectedCards={selectedCards}
            onBulkSelectionToggle={() => {
              setBulkSelectionMode(!bulkSelectionMode)
              setSelectedCards(new Set()) // Clear selections when switching modes
            }}
            onCardSelection={(cardIds) => setSelectedCards(cardIds)}
            onBulkAction={() => setShowBulkActionsModal(true)}
            defaultSort="sort_order"
            downloadFilename={`${series.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'series'}_cards`}
            maxHeight="800px"
            autoFocusSearch={false}
          />
        )}

      </div>

      {/* Add Card Modal */}
      {showAddCardModal && createPortal(
        <AddCardModal
          isOpen={showAddCardModal}
          onClose={() => setShowAddCardModal(false)}
          card={selectedCard}
          onCardAdded={handleCardAdded}
        />,
        document.body
      )}

      {/* Bulk Actions Modal */}
      {showBulkActionsModal && createPortal(
        <BulkCardModal
          isOpen={showBulkActionsModal}
          onClose={() => {
            setShowBulkActionsModal(false)
            setSelectedCards(new Set()) // Clear selections after bulk action
          }}
          series={series}
          selectedCardIds={Array.from(selectedCards)}
          selectedCards={cards.filter(card => selectedCards.has(card.card_id))}
          onComplete={() => {
            loadTableData() // Reload data to get updated counts
            setShowBulkActionsModal(false)
            setSelectedCards(new Set())
          }}
        />,
        document.body
      )}

      {/* Social Section - Discussion and Activity Feed side-by-side */}
      {series && (
        <div className="social-section">
          <CommentsSection
            itemType="series"
            itemId={series.series_id}
            title={`Discussion about ${series.name}`}
          />
          <ActivityFeed seriesId={series.series_id} title="Recent Activity" />
        </div>
      )}

      {/* Admin Edit Button */}
      {isAdmin && series && (
        <button 
          className="admin-edit-button"
          onClick={() => navigate(`/admin/series?search=${encodeURIComponent(series.name)}`)}
          title="Edit series (Admin)"
        >
          <Icon name="edit" size={20} />
        </button>
      )}
    </div>
  )
}

export default SeriesDetail