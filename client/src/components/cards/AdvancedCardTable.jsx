import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { slugFromName } from '../../utils/urlUtils'
import './AdvancedCardTable.css'

const AdvancedCardTable = ({ apiEndpoint, showPlayerColumn = true, loadAllCards = false }) => {
  const { user } = useAuth()
  const [cards, setCards] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' })
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [addToCollectionDialog, setAddToCollectionDialog] = useState({ show: false, card: null })
  const [isAddingToCollection, setIsAddingToCollection] = useState(false)
  const [toast, setToast] = useState(null)
  const [userCardCounts, setUserCardCounts] = useState({})
  
  // Infinite scroll state
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [isInfiniteScrollMode, setIsInfiniteScrollMode] = useState(false)
  const [seriesColumnWidth, setSeriesColumnWidth] = useState(null)
  const lastScrollTime = useRef(0)
  const scrollElementRef = useRef(null)

  // Add to Collection functionality
  const handleAddToCollectionClick = (card) => {
    setAddToCollectionDialog({ show: true, card })
  }

  // Toast message function
  const showToast = (message, type = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const handleAddToCollectionCancel = () => {
    setAddToCollectionDialog({ show: false, card: null })
  }

  const handleAddToCollectionSave = async (collectionData) => {
    if (!addToCollectionDialog.card) return
    
    setIsAddingToCollection(true)
    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/collection/add', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          card_id: addToCollectionDialog.card.card_id,
          ...collectionData
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add card to collection')
      }
      
      // Close the dialog
      setAddToCollectionDialog({ show: false, card: null })
      
      // Show success toast
      showToast('Card added to collection successfully!')
      
      // Update the card count for this card
      const cardId = addToCollectionDialog.card.card_id
      setUserCardCounts(prev => ({
        ...prev,
        [cardId]: (prev[cardId] || 0) + 1
      }))
      
    } catch (error) {
      console.error('Add to collection error:', error)
      const message = error.message || 'Failed to add card to collection. Please try again.'
      
      // Show error toast
      if (message.includes('already have this card with serial number')) {
        showToast(message + ' You can have multiple copies, but each serial number must be unique.', 'error')
      } else {
        showToast(message, 'error')
      }
    } finally {
      setIsAddingToCollection(false)
    }
  }

  // Calculate optimal width for series column based on content
  const calculateSeriesColumnWidth = useCallback((cardsData) => {
    if (!cardsData || cardsData.length === 0) return null
    
    // Find the longest series name
    let maxLength = 0
    let longestSeriesName = ''
    
    cardsData.forEach(card => {
      const seriesName = card.series_rel?.name || ''
      if (seriesName.length > maxLength) {
        maxLength = seriesName.length
        longestSeriesName = seriesName
      }
    })
    
    // Calculate approximate width based on character count
    // Using rough estimate of 8px per character + padding
    const estimatedWidth = Math.max(120, maxLength * 8 + 40) // Min 120px, +40px for padding
    
    // Cap at reasonable maximum to prevent extremely wide columns
    return Math.min(estimatedWidth, 400)
  }, [])

  const fetchCards = useCallback(async (pageNum = 1, resetCards = true) => {
    try {
      if (pageNum === 1) {
        setLoading(true)
        setError(null)
      } else {
        setIsLoadingMore(true)
      }

      // Build URL with pagination and search
      const url = new URL(apiEndpoint, window.location.origin)
      
      if (loadAllCards) {
        // When loadAllCards is true, fetch all cards at once
        url.searchParams.set('page', '1')
        url.searchParams.set('limit', '10000') // Very high limit to get all cards
      } else {
        // Normal pagination mode
        url.searchParams.set('page', pageNum.toString())
        url.searchParams.set('limit', '100') // As per documentation requirements
      }
      
      // Add search query if present
      if (debouncedSearchQuery.trim()) {
        url.searchParams.set('search', debouncedSearchQuery.trim())
      }

      const response = await fetch(url.pathname + url.search)
      if (!response.ok) {
        throw new Error('Failed to fetch cards')
      }
      
      const data = await response.json()
      const newCards = data.cards || []
      
      if (resetCards) {
        setCards(newCards)
        setIsInfiniteScrollMode(false)
        // Calculate series column width on fresh load
        const optimalWidth = calculateSeriesColumnWidth(newCards)
        setSeriesColumnWidth(optimalWidth)
      } else {
        setCards(prevCards => [...prevCards, ...newCards])
        setIsInfiniteScrollMode(true)
      }

      
      // Check if we have more data
      const hasMoreData = !loadAllCards && newCards.length === 100 // Full page means likely more data
      setHasMore(hasMoreData)
      
      if (hasMoreData) {
        setPage(pageNum + 1)
      }
      
    } catch (err) {
      setError(err.message)
      setHasMore(false)
    } finally {
      setLoading(false)
      setIsLoadingMore(false)
    }
  }, [apiEndpoint, debouncedSearchQuery, calculateSeriesColumnWidth, loadAllCards, user])

  // Fetch user card counts for authenticated users
  const fetchUserCardCounts = useCallback(async (cardIds) => {
    if (!user || !cardIds || cardIds.length === 0) return

    try {
      const token = localStorage.getItem('token')
      const response = await fetch('/api/collection/counts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ card_ids: cardIds })
      })

      if (response.ok) {
        const data = await response.json()
        setUserCardCounts(data.counts || {})
      }
    } catch (error) {
      console.error('Failed to fetch card counts:', error)
    }
  }, [user])

  // Fetch card counts when cards change
  useEffect(() => {
    if (user && cards.length > 0) {
      const cardIds = cards.map(card => card.card_id)
      fetchUserCardCounts(cardIds)
    }
  }, [cards, user, fetchUserCardCounts])

  // Debounce search query
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery)
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [searchQuery])

  // Initial load and search changes
  useEffect(() => {
    if (apiEndpoint) {
      setCards([])
      setPage(1)
      setHasMore(true)
      fetchCards(1, true)
    }
  }, [apiEndpoint, fetchCards])

  // Infinite scroll handler with throttling (1000ms as per documentation)
  const handleScroll = useCallback(() => {
    // Disable infinite scroll when loadAllCards is true
    if (loadAllCards) return
    if (!scrollElementRef.current || !hasMore || isLoadingMore) return

    const now = Date.now()
    if (now - lastScrollTime.current < 1000) return // 1000ms throttling as required
    
    const { scrollTop, scrollHeight, clientHeight } = scrollElementRef.current
    const threshold = 100 // pixels from bottom
    
    if (scrollHeight - scrollTop - clientHeight <= threshold) {
      lastScrollTime.current = now
      fetchCards(page, false)
    }
  }, [hasMore, isLoadingMore, page, fetchCards, loadAllCards])

  // Attach scroll listener
  useEffect(() => {
    const scrollElement = scrollElementRef.current
    if (scrollElement) {
      scrollElement.addEventListener('scroll', handleScroll, { passive: true })
      return () => scrollElement.removeEventListener('scroll', handleScroll)
    }
  }, [handleScroll])

  // Sorting logic
  const sortedCards = useMemo(() => {
    // If we're in infinite scroll mode, don't re-sort to avoid jarring experience
    if (isInfiniteScrollMode) {
      return cards
    }
    
    return [...cards].sort((a, b) => {
      // Primary sort: series name (always ascending for default behavior)
      const aSeriesName = a.series_rel?.name || ''
      const bSeriesName = b.series_rel?.name || ''
      
      if (aSeriesName !== bSeriesName) {
        return aSeriesName.localeCompare(bSeriesName)
      }
      
      // Secondary sort: card number (always ascending for default behavior)
      const aCardNumber = parseInt(a.card_number) || 0
      const bCardNumber = parseInt(b.card_number) || 0
      
      if (aCardNumber !== bCardNumber) {
        return aCardNumber - bCardNumber
      }

      // If user has selected a specific column to sort by, apply that as tertiary sort  
      if (sortConfig.key && sortConfig.key !== 'series_rel.name' && sortConfig.key !== 'card_number') {
        let aValue = a[sortConfig.key]
        let bValue = b[sortConfig.key]

        // Handle nested properties
        if (sortConfig.key.includes('.')) {
          const keys = sortConfig.key.split('.')
          aValue = keys.reduce((obj, key) => obj?.[key], a)
          bValue = keys.reduce((obj, key) => obj?.[key], b)
        }

        // Handle special cases
        if (sortConfig.key === 'players') {
          aValue = a.card_player_teams?.[0]?.player_team_rel?.player_rel?.last_name || ''
          bValue = b.card_player_teams?.[0]?.player_team_rel?.player_rel?.last_name || ''
        }

        if (sortConfig.key === 'card_number') {
          aValue = parseInt(aValue) || 0
          bValue = parseInt(bValue) || 0
        }

        if (aValue === null || aValue === undefined) aValue = ''
        if (bValue === null || bValue === undefined) bValue = ''

        if (aValue < bValue) {
          return sortConfig.direction === 'asc' ? -1 : 1
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'asc' ? 1 : -1
        }
      }
      
      return 0
    })
  }, [cards, sortConfig, isInfiniteScrollMode])

  const requestSort = (key) => {
    let direction = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortConfig({ key, direction })
    
    // If we're in infinite scroll mode, reset to first page to get fresh sorted data
    if (isInfiniteScrollMode) {
      setCards([])
      setPage(1)
      setHasMore(true)
      setIsInfiniteScrollMode(false)
      fetchCards(1, true)
    }
  }

  const getSortIcon = (columnKey) => {
    if (sortConfig.key !== columnKey) {
      return '' // No icon when not sorted
    }
    return sortConfig.direction === 'asc' ? ' ↑' : ' ↓'
  }

  // Calculate summary statistics
  const summary = useMemo(() => {
    const total = sortedCards.length
    const rookies = sortedCards.filter(card => card.is_rookie).length
    const autographs = sortedCards.filter(card => card.is_autograph).length
    const relics = sortedCards.filter(card => card.is_relic).length
    const shortPrints = sortedCards.filter(card => card.is_short_print).length

    return { total, rookies, autographs, relics, shortPrints }
  }, [sortedCards])

  const downloadCSV = () => {
    if (!sortedCards.length) return

    const headers = [
      'Card Number',
      ...(showPlayerColumn ? ['Player'] : []),
      'Series',
      'Year',
      'Color',
      'Attributes',
      'Notes'
    ]

    const csvContent = [
      headers.join(','),
      ...sortedCards.map(card => {
        const playerNames = card.card_player_teams?.map(cpt => {
          const player = cpt.player
          return player ? `${player.first_name} ${player.last_name}`.trim() : 'Unknown Player'
        }).filter(Boolean).join('; ') || 'Unknown Player'

        const attributes = []
        if (card.is_rookie) attributes.push('RC')
        if (card.is_autograph) attributes.push('AUTO')
        if (card.is_relic) attributes.push('RELIC')
        if (card.is_short_print) attributes.push('SP')
        if (card.print_run) attributes.push(`/${card.print_run}`)

        const row = [
          `"${card.card_number || 'N/A'}"`,
          ...(showPlayerColumn ? [`"${playerNames}"`] : []),
          `"${card.series_rel?.name || 'Unknown Series'}"`,
          `"${card.series_rel?.set_rel?.year || 'Unknown'}"`,
          `"${card.color_rel?.color || ''}"`,
          `"${attributes.join(', ')}"`,
          `"${card.notes || ''}"`
        ]
        return row.join(',')
      })
    ].join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `cards-export-${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Helper function to determine text color based on background
  const getContrastColor = (hexColor) => {
    if (!hexColor) return '#000000'
    const cleanHex = hexColor.replace('#', '')
    if (cleanHex.length !== 6) return '#000000'
    
    const r = parseInt(cleanHex.substr(0, 2), 16)
    const g = parseInt(cleanHex.substr(2, 2), 16)
    const b = parseInt(cleanHex.substr(4, 2), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#000000' : '#FFFFFF'
  }

  if (loading) {
    return (
      <div className="table-container">
        <div className="table-loading">
          <div className="spinner"></div>
          <span>Loading cards...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="table-container">
        <div className="table-error">
          <h3>Error loading cards</h3>
          <p>{error}</p>
        </div>
      </div>
    )
  }

  if (sortedCards.length === 0) {
    return (
      <div className="table-container">
        {/* Search input - still show it even when no results */}
        <div style={{ 
          padding: '16px', 
          borderBottom: '1px solid var(--card-border)', 
          background: 'var(--gray-50)'
        }}>
          <div style={{ position: 'relative', maxWidth: '400px' }}>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by card #, series, player, team, or color..."
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: '1px solid var(--card-border)',
                borderRadius: '6px',
                fontSize: '14px',
                background: 'white',
                color: 'var(--gray-900)'
              }}
            />
            <div style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--gray-400)',
              pointerEvents: 'none'
            }}>
              <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  padding: '4px',
                  color: 'var(--gray-400)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: '3px'
                }}
                title="Clear search"
              >
                <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>
        
        <div className="table-empty">
          <h3>No cards found</h3>
          {searchQuery ? (
            <div>
              <p>No cards match your search for "<strong>{searchQuery}</strong>"</p>
              <p style={{ fontSize: '0.9em', color: 'var(--gray-600)', marginTop: '8px' }}>
                Try searching by card number, series name, player name, team name, or color.
              </p>
              <button 
                onClick={() => setSearchQuery('')}
                style={{
                  marginTop: '12px',
                  padding: '6px 12px',
                  background: 'var(--primary-color)',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                Clear search
              </button>
            </div>
          ) : (
            <p>No cards match the current criteria.</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="table-container">
      {/* Search input */}
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid var(--card-border)', 
        background: 'var(--gray-50)'
      }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by card #, series, player, team, or color..."
            style={{
              width: '100%',
              padding: '8px 12px 8px 36px',
              border: '1px solid var(--card-border)',
              borderRadius: '6px',
              fontSize: '14px',
              background: 'white',
              color: 'var(--gray-900)'
            }}
          />
          <div style={{
            position: 'absolute',
            left: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'var(--gray-400)',
            pointerEvents: 'none'
          }}>
            <svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '8px',
                top: '50%',
                transform: 'translateY(-50%)',
                padding: '4px',
                color: 'var(--gray-400)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                borderRadius: '3px'
              }}
              title="Clear search"
            >
              <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Simple table with sticky header */}
      <div className="table-wrapper">
        <div className="table-scroll" ref={scrollElementRef}>
          <table className="simple-table">
            <thead>
              <tr>
                <th 
                  className="sortable" 
                  onClick={() => requestSort('card_number')}
                  title="Click to sort by card number"
                >
                  Card Number {getSortIcon('card_number')}
                </th>
                {showPlayerColumn && (
                  <th 
                    className="sortable" 
                    onClick={() => requestSort('players')}
                    title="Click to sort by player name"
                  >
                    Player {getSortIcon('players')}
                  </th>
                )}
                <th 
                  className="sortable" 
                  onClick={() => requestSort('series_rel.name')}
                  title="Click to sort by series"
                  style={seriesColumnWidth ? { minWidth: `${seriesColumnWidth}px`, width: `${seriesColumnWidth}px` } : {}}
                >
                  Series {getSortIcon('series_rel.name')}
                </th>
                <th 
                  className="sortable" 
                  onClick={() => requestSort('print_run')}
                  title="Click to sort by print run"
                >
                  Print Run {getSortIcon('print_run')}
                </th>
                <th 
                  className="sortable" 
                  onClick={() => requestSort('color_rel.name')}
                  title="Click to sort by color"
                  style={{ textAlign: 'center' }}
                >
                  Color {getSortIcon('color_rel.name')}
                </th>
                <th>Attributes</th>
                <th 
                  className="sortable" 
                  onClick={() => requestSort('notes')}
                  title="Click to sort by notes"
                >
                  Notes {getSortIcon('notes')}
                </th>
                {user && (
                  <th style={{ width: '50px', minWidth: '50px', textAlign: 'center' }} title="Number of copies you own">Own</th>
                )}
                {user && (
                  <th style={{ width: '60px', minWidth: '60px', textAlign: 'center' }}>Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {sortedCards.map((card, index) => {
                // Get player-team pairs for proper team tagging
                const playerTeamPairs = card.card_player_teams?.map(cpt => {
                  const player = cpt.player
                  const team = cpt.team
                  
                  if (!player) return null
                  
                  const playerName = `${player.first_name} ${player.last_name}`.trim()
                  return {
                    playerName,
                    team,
                    isRookie: card.is_rookie
                  }
                }).filter(Boolean) || []

                // Determine row class based on collection status for authenticated users
                const hasCard = user && userCardCounts[card.card_id] > 0
                const rowClass = user ? (hasCard ? 'table-row owned-card' : 'table-row unowned-card') : 'table-row'

                return (
                  <tr 
                    key={card.card_id} 
                    className={rowClass}
                    onDoubleClick={user ? () => handleAddToCollectionClick(card) : undefined}
                    title={user ? "Double-click to add to collection" : ""}
                  >
                    <td>
                      {card.card_number || 'N/A'}
                    </td>
                    {showPlayerColumn && (
                      <td>
                        <div className="player-info">
                          {playerTeamPairs.map((pair, idx) => {
                            // Team color logic (same as browse page)
                            const getLuminance = (hexColor) => {
                              const hex = hexColor?.replace('#', '');
                              if (!hex || hex.length !== 6) return 0.5;
                              
                              const r = parseInt(hex.substr(0, 2), 16);
                              const g = parseInt(hex.substr(2, 2), 16);
                              const b = parseInt(hex.substr(4, 2), 16);
                              
                              return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
                            };
                            
                            // Determine team colors
                            let bgColor, borderColor;
                            if (pair.team?.primary_color && pair.team?.secondary_color) {
                              const primaryLuminance = getLuminance(pair.team.primary_color);
                              const secondaryLuminance = getLuminance(pair.team.secondary_color);
                              
                              if (primaryLuminance < secondaryLuminance) {
                                bgColor = pair.team.primary_color;
                                borderColor = pair.team.secondary_color;
                              } else {
                                bgColor = pair.team.secondary_color;
                                borderColor = pair.team.primary_color;
                              }
                            } else {
                              bgColor = pair.team?.primary_color || '#6b7280';
                              borderColor = pair.team?.secondary_color || '#9ca3af';
                            }
                            
                            const getContrastColor = (hexColor) => {
                              const luminance = getLuminance(hexColor);
                              return luminance > 0.5 ? '#000000' : '#FFFFFF';
                            };
                            
                            const textColor = getContrastColor(bgColor);

                            return (
                              <span key={idx} className="player-team-item">
                                {pair.team?.abbreviation && (
                                  <span 
                                    className="team-tag"
                                    style={{
                                      backgroundColor: bgColor,
                                      borderColor: borderColor,
                                      color: textColor
                                    }}
                                  >
                                    {pair.team.abbreviation}
                                  </span>
                                )}
                                <Link 
                                  to={`/players/${slugFromName(pair.playerName)}`}
                                  className="player-name-link"
                                >
                                  {pair.playerName}
                                </Link>
                                {pair.isRookie && (
                                  <span className="badge badge-rookie">RC</span>
                                )}
                                {idx < playerTeamPairs.length - 1 && ' '}
                              </span>
                            )
                          })}
                          {playerTeamPairs.length === 0 && 'Unknown Player'}
                        </div>
                      </td>
                    )}
                    <td style={seriesColumnWidth ? { minWidth: `${seriesColumnWidth}px`, width: `${seriesColumnWidth}px`, whiteSpace: 'nowrap' } : {}}>
                      {card.series_rel?.name ? (
                        <Link 
                          to={`/series/${slugFromName(card.series_rel.name)}`}
                          className="series-name-link"
                        >
                          {card.series_rel.name}
                        </Link>
                      ) : (
                        'Unknown Series'
                      )}
                    </td>
                    <td>
                      {card.print_run ? `/${card.print_run}` : ''}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {card.color_rel?.color && (
                        <span 
                          className="color-badge"
                          style={{
                            backgroundColor: card.color_rel.hex_color || '#6b7280',
                            color: getContrastColor(card.color_rel.hex_color || '#6b7280')
                          }}
                        >
                          {card.color_rel.color}
                        </span>
                      )}
                    </td>
                    <td>
                      <div className="attributes-list">
                        {card.is_autograph && (
                          <span className="badge badge-auto">AUTO</span>
                        )}
                        {card.is_relic && (
                          <span className="badge badge-relic">RELIC</span>
                        )}
                        {card.is_short_print && (
                          <span className="badge badge-sp">SP</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ 
                        maxWidth: '150px', 
                        overflow: 'hidden', 
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }} 
                      title={card.notes || ''}>
                        {card.notes || ''}
                      </div>
                    </td>
                    {user && (
                      <td style={{ 
                        textAlign: 'center', 
                        verticalAlign: 'middle',
                        padding: '10px 8px',
                        width: '50px',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: userCardCounts[card.card_id] > 0 ? '#16a34a' : '#6b7280'
                      }}>
                        {userCardCounts[card.card_id] || 0}
                      </td>
                    )}
                    {user && (
                      <td style={{ 
                        textAlign: 'center', 
                        verticalAlign: 'middle', 
                        padding: '10px 8px',
                        width: '60px'
                      }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation() // Prevent row double-click
                            handleAddToCollectionClick(card)
                          }}
                          className="add-to-collection-btn"
                          title="Add card to collection"
                          style={{
                            background: '#dcfce7',
                            border: '1px solid #bbf7d0',
                            color: '#16a34a',
                            cursor: 'pointer',
                            padding: '0',
                            borderRadius: '8px',
                            fontSize: '16px',
                            fontWeight: '600',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '28px',
                            height: '28px',
                            boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
                            margin: '0 auto'
                          }}
                          onMouseEnter={(e) => {
                            e.target.style.backgroundColor = '#bbf7d0'
                            e.target.style.borderColor = '#86efac'
                            e.target.style.color = '#15803d'
                            e.target.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.1)'
                          }}
                          onMouseLeave={(e) => {
                            e.target.style.backgroundColor = '#dcfce7'
                            e.target.style.borderColor = '#bbf7d0'
                            e.target.style.color = '#16a34a'
                            e.target.style.boxShadow = '0 1px 2px rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          +
                        </button>
                      </td>
                    )}
                  </tr>
                )
              })}
            </tbody>
          </table>
          
          {/* Loading more indicator - only show when not in loadAllCards mode */}
          {isLoadingMore && !loadAllCards && (
            <div className="loading-more-indicator">
              <div className="spinner"></div>
              <span>Loading more cards...</span>
            </div>
          )}
          
          {/* End of data indicator - only show when not in loadAllCards mode */}
          {!hasMore && cards.length > 0 && !loadAllCards && (
            <div className="end-of-data-indicator">
              <span>No more cards to load</span>
            </div>
          )}
        </div>
      </div>

      {/* Summary Footer */}
      <div className="table-summary-footer">
        <div className="summary-stats">
          <span className="summary-total">
            <strong>{summary.total} cards total</strong>
          </span>
          <span className="summary-stat">
            {summary.rookies} RC
          </span>
          <span className="summary-stat">
            {summary.autographs} AUTO
          </span>
          <span className="summary-stat">
            {summary.relics} RELIC
          </span>
          <span className="summary-stat">
            {summary.shortPrints} SP
          </span>
          <button 
            className="download-btn"
            onClick={downloadCSV}
            title="Download as CSV"
          >
            ⬇️ CSV
          </button>
        </div>
      </div>

      {/* Toast Message */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: toast.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: toast.type === 'error' ? '#dc2626' : '#16a34a',
          padding: '12px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
          border: `1px solid ${toast.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
          zIndex: 10000,
          maxWidth: '400px',
          fontSize: '14px',
          fontWeight: '500'
        }}>
          {toast.message}
        </div>
      )}
    </div>
  )
}

export default AdvancedCardTable