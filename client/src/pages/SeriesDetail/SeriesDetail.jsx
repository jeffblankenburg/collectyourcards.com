import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../../components/Icon'
import AddCardModal from '../../components/AddCardModal'
import './SeriesDetail.css'


function SeriesDetail() {
  const { seriesSlug, year, setSlug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated, user } = useAuth()
  const [series, setSeries] = useState(null)
  const [stats, setStats] = useState({})
  const [parallels, setParallels] = useState([])
  const [showParallels, setShowParallels] = useState(false)
  const [collectionCompletion, setCollectionCompletion] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const parallelsRef = useRef(null)
  
  // Table-specific state
  const [cards, setCards] = useState([])
  const [sortField, setSortField] = useState('sort_order')
  const [sortDirection, setSortDirection] = useState('asc')
  const [tableLoading, setTableLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  
  // Modal state
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)

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
    try {
      setLoading(true)
      
      let seriesList = []
      
      if (year && setSlug) {
        // If we have year and setSlug, get series for that specific set
        // First get the set ID
        const setsResponse = await axios.get('/api/sets-list')
        const allSets = setsResponse.data.sets || []
        const foundSet = allSets.find(set => {
          const setYear = set.year || parseInt(set.name.split(' ')[0])
          const slug = set.name
            .toLowerCase()
            .replace(/'/g, '') // Remove apostrophes completely
            .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
            .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
          return setYear === parseInt(year) && slug === setSlug
        })
        
        if (foundSet) {
          // Get series for this set
          const seriesResponse = await axios.get(`/api/series-by-set/${foundSet.set_id}`)
          seriesList = seriesResponse.data.series || []
        }
      } else {
        // Fallback to getting all series (for /series/:seriesSlug route)
        const response = await axios.get('/api/series-list')
        seriesList = response.data.series || []
      }
      
      // Find series by slug (recreate slug logic matching the one used in SeriesCard)
      const foundSeries = seriesList.find(s => {
        if (!s.name) return false
        const slug = s.name
          .toLowerCase()
          .replace(/'/g, '') // Remove apostrophes completely
          .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
          .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
        return slug === seriesSlug
      })

      if (foundSeries) {
        setSeries(foundSeries)
        
        // Get actual stats for the series
        await fetchSeriesStats(foundSeries)
        
        // Get related parallels
        await fetchRelatedParallels(foundSeries, seriesList)
        
        // Collection completion will be calculated by UniversalCardTable
        
        setError(null)
      } else {
        setError('Series not found')
      }
    } catch (err) {
      console.error('Error fetching series data:', err)
      setError('Failed to load series data')
    } finally {
      setLoading(false)
    }
  }

  const fetchSeriesStats = async (series) => {
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
    } catch (err) {
      console.error('Error fetching series stats:', err)
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
    }
  }

  const fetchRelatedParallels = async (currentSeries, allSeries) => {
    try {
      // console.log('Current series:', currentSeries.name, {...})
      
      const relatedParallels = []
      
      if (currentSeries.is_parallel && currentSeries.parallel_of_series) {
        // If this is a parallel, find the parent and other parallels of the same parent
        const parentId = currentSeries.parallel_of_series
        // console.log('Looking for parent with ID:', parentId)
        
        // Find the parent series
        const parent = allSeries.find(s => s.series_id === parentId)
        if (parent) {
          // console.log('Found parent:', parent.name)
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
        // console.log('Found siblings:', siblings.length, siblings.map(s => s.name))
        siblings.forEach(sibling => {
          relatedParallels.push({
            ...sibling,
            relationship: 'sibling'
          })
        })
      } else {
        // If this is a parent series, find all its parallels
        // console.log('Looking for children of series ID:', currentSeries.series_id)
        const children = allSeries.filter(s => 
          s.parallel_of_series === currentSeries.series_id
        )
        // console.log('Found children:', children.length, children.map(s => s.name))
        children.forEach(child => {
          relatedParallels.push({
            ...child,
            relationship: 'parallel'
          })
        })
      }
      
      // console.log('Final related parallels:', relatedParallels.length, relatedParallels.map(p => ({ name: p.name, relationship: p.relationship })))
      setParallels(relatedParallels)
    } catch (err) {
      console.error('Error fetching related parallels:', err)
      setParallels([])
    }
  }

  // Table data loading function
  const loadTableData = async () => {
    if (!series) return
    
    try {
      setTableLoading(true)
      const url = `/api/cards?series_id=${series.series_id}&limit=10000`
      
      const response = await axios.get(url)
      const { cards: newCards } = response.data
      
      setCards(newCards || [])
    } catch (error) {
      console.error('Error loading cards:', error)
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

  // Filter cards based on search query
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards
    
    const query = searchQuery.toLowerCase()
    return cards.filter(card => {
      // Search in card number
      if (card.card_number?.toLowerCase().includes(query)) return true
      
      // Search in player names
      const playerNames = card.card_player_teams?.map(cpt => 
        `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
      ).join(' ').toLowerCase()
      if (playerNames.includes(query)) return true
      
      // Search in team names
      const teamNames = card.card_player_teams?.map(cpt => 
        cpt.team?.name || ''
      ).join(' ').toLowerCase()
      if (teamNames.includes(query)) return true
      
      return false
    })
  }, [cards, searchQuery])

  // Sort filtered cards
  const sortedCards = useMemo(() => {
    const sorted = [...filteredCards].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]

      // Handle special sorting cases
      if (sortField === 'player_name') {
        aVal = a.card_player_teams?.[0]?.player ? 
          `${a.card_player_teams[0].player.first_name || ''} ${a.card_player_teams[0].player.last_name || ''}`.trim() : ''
        bVal = b.card_player_teams?.[0]?.player ? 
          `${b.card_player_teams[0].player.first_name || ''} ${b.card_player_teams[0].player.last_name || ''}`.trim() : ''
      } else if (sortField === 'sort_order') {
        // Handle sort_order as numeric
        const aNum = parseInt(a.sort_order) || 0
        const bNum = parseInt(b.sort_order) || 0
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      } else if (sortField === 'card_number') {
        // Smart card number sorting: numeric if all are numbers, alphabetic if mixed
        const aNum = parseInt(a.card_number)
        const bNum = parseInt(b.card_number)
        
        // Check if both are valid integers and the string representations match (no letters)
        if (!isNaN(aNum) && !isNaN(bNum) && 
            a.card_number === aNum.toString() && 
            b.card_number === bNum.toString()) {
          // Both are pure integers, sort numerically
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
        } else {
          // At least one has letters, sort alphabetically
          aVal = String(a.card_number || '').toLowerCase()
          bVal = String(b.card_number || '').toLowerCase()
        }
      }

      // Convert to strings for comparison (if not already handled above)
      if (sortField !== 'card_number' || typeof aVal === 'string') {
        aVal = String(aVal || '').toLowerCase()
        bVal = String(bVal || '').toLowerCase()

        if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
        if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      }
      
      return 0
    })

    return sorted
  }, [filteredCards, sortField, sortDirection])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const handleAddCard = (card) => {
    setSelectedCard(card)
    setShowAddCardModal(true)
  }

  const handleCardAdded = () => {
    // Reload data to get updated counts
    loadTableData()
    setShowAddCardModal(false)
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <Icon name="chevron-up" size={14} className="sort-icon neutral" />
    }
    
    return (
      <Icon 
        name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
        size={14} 
        className={`sort-icon active ${sortDirection}`}
      />
    )
  }

  const handleCardClick = (card) => {
    // Generate the player names for URL
    const playerNames = card.card_player_teams?.map(cpt => 
      `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
    ).filter(name => name).join(', ') || 'unknown'
    
    // Use simple URL format for navigation with series
    const playerSlug = playerNames
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    
    navigate(`/card/${seriesSlug}/${card.card_number}/${playerSlug}`)
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
                                const slug = parallel.name
                                  .toLowerCase()
                                  .replace(/[^a-z0-9\s-]/g, '')
                                  .replace(/\s+/g, '-')
                                  .replace(/-+/g, '-')
                                  .trim()
                                navigate(`/series/${slug}`)
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
          <div className="table-wrapper">
            {tableLoading ? (
              <div className="series-table-loading">
                <Icon name="activity" size={24} className="spinner" />
                <p>Loading cards...</p>
              </div>
            ) : (
              <>
                {/* Search */}
                <div className="table-controls">
                  <div className="search-container">
                    <input
                      type="text"
                      placeholder="Search this list..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input"
                    />
                  </div>
                </div>

                {/* Table */}
                <div className="table-container">
                  <table className="cards-table">
                    <thead>
                      <tr>
                        {isAuthenticated && (
                          <>
                            <th className="action-header">ADD</th>
                            <th className="owned-header">OWNED</th>
                          </>
                        )}
                        <th 
                          className="sortable card-header"
                          onClick={() => handleSort('card_number')}
                        >
                          <div className="header-content">
                            Card # <SortIcon field="card_number" />
                          </div>
                        </th>
                        <th 
                          className="sortable player-header"
                          onClick={() => handleSort('player_name')}
                        >
                          <div className="header-content">
                            Player(s) <SortIcon field="player_name" />
                          </div>
                        </th>
                        <th className="color-header">Color</th>
                        <th className="attributes-header">Attributes</th>
                        <th className="notes-header">Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCards.map(card => {
                        const isOwned = isAuthenticated && (card.user_card_count > 0)
                        
                        return (
                          <tr 
                            key={card.card_id}
                            className={`card-row ${handleCardClick ? 'clickable' : ''} ${isOwned ? 'owned-card' : ''}`}
                            onClick={() => handleCardClick && handleCardClick(card)}
                          >
                            {isAuthenticated && (
                              <>
                                <td className="action-cell">
                                  <button
                                    className="add-card-btn"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleAddCard(card)
                                    }}
                                    title="Add to Collection"
                                  >
                                    <Icon name="plus" size={16} />
                                  </button>
                                </td>
                                <td className="owned-cell">
                                  {card.user_card_count || 0}
                                </td>
                              </>
                            )}
                            <td className="card-number-cell">
                              {card.card_number}
                            </td>
                            <td className="player-cell">
                              {card.card_player_teams?.map((cpt, index) => (
                                <div key={index} className="player-info">
                                  {/* Team Circle */}
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
                                  {card.is_rookie && <span className="rc-tag">RC</span>}
                                </div>
                              ))}
                            </td>
                            <td className="color-cell">
                              {card.color_name && (
                                <span 
                                  className="color-tag"
                                  style={{
                                    backgroundColor: card.color_hex_value || '#ec4899',
                                    color: card.color_hex_value ? (
                                      // Calculate if we need dark or light text
                                      parseInt(card.color_hex_value.slice(1, 3), 16) * 0.299 +
                                      parseInt(card.color_hex_value.slice(3, 5), 16) * 0.587 +
                                      parseInt(card.color_hex_value.slice(5, 7), 16) * 0.114 > 186
                                      ? '#000000' : '#ffffff'
                                    ) : '#ffffff'
                                  }}
                                >
                                  {card.color_name}
                                </span>
                              )}
                            </td>
                            <td className="attributes-cell">
                              <div className="attribute-tags">
                                {card.is_autograph && <span className="auto-tag">AUTO</span>}
                                {card.is_relic && <span className="relic-tag">RELIC</span>}
                              </div>
                            </td>
                            <td className="notes-cell">
                              {card.notes}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Footer */}
                <div className="table-footer">
                  <div className="table-info">
                    Showing {sortedCards.length} of {cards.length} cards
                    {searchQuery && ` (filtered by "${searchQuery}")`}
                  </div>
                  <div className="table-actions">
                    <button 
                      className="action-button secondary"
                      onClick={() => {
                        // TODO: Implement download functionality
                        console.log('Download clicked')
                      }}
                    >
                      <Icon name="import" size={16} />
                      Download
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
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