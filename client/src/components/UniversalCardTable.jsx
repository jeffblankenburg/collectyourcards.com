import React, { useState, useEffect, useMemo, useRef } from 'react'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import Icon from './Icon'
import AddCardModal from './AddCardModal'
import './UniversalCardTable.css'

const UniversalCardTable = ({
  apiEndpoint = null,
  cards: initialCards = [],
  showPlayer = true,
  showTeam = true,
  showSeries = true,
  defaultSort = 'series_name',
  downloadFilename = 'cards',
  pageSize = 100,
  onCardClick = null,
  onSeriesClick = null,
  showSearch = false,
  selectedTeamIds = []
}) => {
  const { isAuthenticated } = useAuth()
  const [cards, setCards] = useState(initialCards)
  const [sortField, setSortField] = useState(defaultSort)
  const [sortDirection, setSortDirection] = useState('asc')
  const [displayedCards, setDisplayedCards] = useState([])
  const [loading, setLoading] = useState(false)
  const [totalCardsCount, setTotalCardsCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [userCardCounts, setUserCardCounts] = useState({})
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  // Removed infinite scroll state - no longer needed
  const [columnWidths, setColumnWidths] = useState({
    cardNumber: '100px',
    player: '200px',
    series: '300px',
    printRun: '100px',
    color: '120px',
    attributes: '120px',
    notes: '200px'
  })
  const [isResizing, setIsResizing] = useState(false)
  const [resizeColumn, setResizeColumn] = useState(null)
  const loadingRef = useRef(false)

  // Load initial data from API endpoint or use provided cards
  useEffect(() => {
    if (apiEndpoint) {
      // console.log('🔃 useEffect triggered for endpoint:', apiEndpoint, 'loading:', loading, 'loadingRef:', loadingRef.current)
      loadInitialData()
    } else if (initialCards.length > 0) {
      setCards(initialCards)
      setTotalCardsCount(initialCards.length)
    }
  }, [apiEndpoint]) // Removed initialCards dependency

  // Load user card counts when cards change and user is authenticated
  useEffect(() => {
    if (isAuthenticated && displayedCards.length > 0) {
      loadUserCardCounts()
    }
  }, [isAuthenticated, displayedCards])

  const loadInitialData = async () => {
    if (!apiEndpoint || loading || loadingRef.current) return
    
    try {
      loadingRef.current = true
      setLoading(true)
      setCards([]) // Clear existing cards first
      
      const url = new URL(apiEndpoint, window.location.origin)
      url.searchParams.set('limit', '10000') // Load ALL cards
      url.searchParams.set('page', '1')
      
      // console.log('📥 Loading ALL data:', url.pathname + url.search)
      const response = await axios.get(url.pathname + url.search)
      
      const { cards: newCards, total } = response.data
      
      // Deduplicate data
      const uniqueCards = newCards ? Array.from(
        new Map(newCards.map(card => [card.card_id, card])).values()
      ) : []
      
      setCards(uniqueCards)
      setTotalCardsCount(total || uniqueCards.length)
      
      // console.log(`✅ Loaded ALL ${uniqueCards.length} cards`)
    } catch (error) {
      console.error('Error loading data:', error)
      setCards([])
      setTotalCardsCount(0)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }

  const loadUserCardCounts = async () => {
    try {
      const cardIds = displayedCards.map(card => card.card_id)
      if (cardIds.length === 0) return

      const response = await axios.post('/api/user/cards/counts', { card_ids: cardIds })
      setUserCardCounts(response.data.counts || {})
    } catch (err) {
      console.error('Error loading user card counts:', err)
      setUserCardCounts({})
    }
  }

  const handleAddCard = (card) => {
    setSelectedCard(card)
    setShowAddCardModal(true)
  }

  const handleCardAdded = () => {
    // Refresh user card counts after adding a card
    if (displayedCards.length > 0) {
      loadUserCardCounts()
    }
  }

  // Filter cards based on search query and selected teams
  const filteredCards = useMemo(() => {
    let result = cards
    
    // Filter by selected teams first
    if (selectedTeamIds && selectedTeamIds.length > 0) {
      result = result.filter(card => 
        card.card_player_teams?.some(cpt => 
          cpt.team?.team_id && selectedTeamIds.includes(cpt.team.team_id)
        )
      )
    }
    
    // Then filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(card => {
        // Search in card number
        if (card.card_number?.toLowerCase().includes(query)) return true
        
        // Search in series name
        if (card.series_rel?.name?.toLowerCase().includes(query)) return true
        
        // Search in player names
        if (card.card_player_teams?.some(cpt => 
          cpt.player?.name?.toLowerCase().includes(query)
        )) return true
        
        // Search in print run
        if (card.print_run && String(card.print_run).includes(query)) return true
        
        // Search in color
        if (card.color_rel?.color?.toLowerCase().includes(query)) return true
        
        return false
      })
    }
    
    return result
  }, [cards, searchQuery, selectedTeamIds])

  // Sort and paginate cards
  const sortedCards = useMemo(() => {
    const sorted = [...filteredCards].sort((a, b) => {
      let aValue, bValue

      switch (sortField) {
        case 'series_name':
          aValue = a.series_rel?.name || ''
          bValue = b.series_rel?.name || ''
          break
        case 'sort_order':
          aValue = a.sort_order || 999999
          bValue = b.sort_order || 999999
          break
        case 'card_number':
          aValue = a.card_number || ''
          bValue = b.card_number || ''
          break
        case 'player_name':
          aValue = getPlayerName(a)
          bValue = getPlayerName(b)
          break
        case 'team_name':
          aValue = getTeamName(a)
          bValue = getTeamName(b)
          break
        case 'color':
          aValue = a.color_rel?.color || ''
          bValue = b.color_rel?.color || ''
          break
        case 'print_run':
          aValue = a.print_run || 999999
          bValue = b.print_run || 999999
          break
        default:
          aValue = a[sortField] || ''
          bValue = b[sortField] || ''
      }

      if (typeof aValue === 'string' && typeof bValue === 'string') {
        aValue = aValue.toLowerCase()
        bValue = bValue.toLowerCase()
      }

      if (aValue < bValue) return sortDirection === 'asc' ? -1 : 1
      if (aValue > bValue) return sortDirection === 'asc' ? 1 : -1
      return 0
    })

    return sorted
  }, [filteredCards, sortField, sortDirection])

  // Update displayed cards when sorting changes
  useEffect(() => {
    setDisplayedCards([...sortedCards])
  }, [sortedCards])

  const getPlayerName = (card) => {
    // First check if player_names is already provided (from simplified API)
    if (card.player_names) {
      return card.player_names
    }
    
    // Fall back to extracting from nested structure
    const playerTeams = card.card_player_teams || []
    if (playerTeams.length === 0) return ''
    
    const players = playerTeams.map(cpt => {
      const player = cpt.player_team_rel?.player_rel
      return player ? `${player.first_name} ${player.last_name}` : ''
    }).filter(name => name)
    
    return players.join(' / ')
  }

  const getTeamName = (card) => {
    const playerTeams = card.card_player_teams || []
    if (playerTeams.length === 0) return ''
    
    const teams = playerTeams.map(cpt => {
      const team = cpt.player_team_rel?.team_rel
      return team ? team.name : ''
    }).filter(name => name)
    
    return [...new Set(teams)].join(' / ') // Remove duplicates
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Removed loadMoreData - no longer needed since we load all data at once

  // Column resizing functions
  const handleResizeStart = (e, column) => {
    e.preventDefault()
    e.stopPropagation() // Prevent sort from triggering
    setIsResizing(true)
    setResizeColumn(column)
    
    const startX = e.clientX
    const startWidth = parseInt(columnWidths[column], 10)
    
    const handleMouseMove = (e) => {
      const newWidth = Math.max(50, startWidth + (e.clientX - startX))
      setColumnWidths(prev => ({
        ...prev,
        [column]: `${newWidth}px`
      }))
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      setResizeColumn(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Removed infinite scroll logic - loading all data at once


  const handleDownload = async () => {
    try {
      setLoading(true)
      const dataToExport = displayedCards
      
      // Create CSV data
      const headers = [
        'Series',
        'Card Number',
        ...(showPlayer ? ['Player'] : []),
        ...(showTeam ? ['Team'] : []),
        'Color',
        'Print Run',
        'Rookie',
        'Autograph',
        'Relic',
        'Notes'
      ]

      const csvData = [
        headers.join(','),
        ...dataToExport.map(card => [
          `"${card.series_rel?.name || ''}"`,
          `"${card.card_number || ''}"`,
          ...(showPlayer ? [`"${getPlayerName(card)}"`] : []),
          ...(showTeam ? [`"${getTeamName(card)}"`] : []),
          `"${card.color_rel?.color || ''}"`,
          card.print_run || '',
          card.is_rookie ? 'Yes' : 'No',
          card.is_autograph ? 'Yes' : 'No',
          card.is_relic ? 'Yes' : 'No',
          `"${card.notes || ''}"`
        ].join(','))
      ].join('\n')

      // Download file
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${downloadFilename}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading data:', error)
    } finally {
      setLoading(false)
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return <Icon name="trending" size={14} className="sort-icon neutral" />
    }
    return (
      <Icon 
        name={sortDirection === 'asc' ? 'trending' : 'trending'} 
        size={14} 
        className={`sort-icon active ${sortDirection}`}
      />
    )
  }

  // Calculate text color based on background brightness
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
    <div className="universal-card-table">
      {/* Search Box */}
      {showSearch && (
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
      )}
      
      <div className="table-container">
        <table className="cards-table">
          <thead>
            <tr>
              <th 
                className="sortable resizable-header"
                onClick={() => handleSort('card_number')}
                style={{ width: columnWidths.cardNumber }}
              >
                <div className="header-content">
                  Card # <SortIcon field="card_number" />
                </div>
                <div 
                  className={`resize-handle ${isResizing && resizeColumn === 'cardNumber' ? 'resizing' : ''}`}
                  onMouseDown={(e) => handleResizeStart(e, 'cardNumber')}
                />
              </th>
              {showPlayer && (
                <th 
                  className="sortable resizable-header"
                  onClick={() => handleSort('player_name')}
                  style={{ width: columnWidths.player }}
                >
                  <div className="header-content">
                    Player(s) <SortIcon field="player_name" />
                  </div>
                  <div 
                    className={`resize-handle ${isResizing && resizeColumn === 'player' ? 'resizing' : ''}`}
                    onMouseDown={(e) => handleResizeStart(e, 'player')}
                  />
                </th>
              )}
              <th 
                className="sortable resizable-header"
                onClick={() => handleSort('series_name')}
                style={{ width: columnWidths.series }}
              >
                <div className="header-content">
                  Series <SortIcon field="series_name" />
                </div>
                <div 
                  className={`resize-handle ${isResizing && resizeColumn === 'series' ? 'resizing' : ''}`}
                  onMouseDown={(e) => handleResizeStart(e, 'series')}
                />
              </th>
              <th 
                className="sortable resizable-header"
                onClick={() => handleSort('print_run')}
                style={{ width: columnWidths.printRun }}
              >
                <div className="header-content">
                  Print Run <SortIcon field="print_run" />
                </div>
                <div 
                  className={`resize-handle ${isResizing && resizeColumn === 'printRun' ? 'resizing' : ''}`}
                  onMouseDown={(e) => handleResizeStart(e, 'printRun')}
                />
              </th>
              <th 
                className="sortable resizable-header"
                onClick={() => handleSort('color')}
                style={{ width: columnWidths.color }}
              >
                <div className="header-content">
                  Color <SortIcon field="color" />
                </div>
                <div 
                  className={`resize-handle ${isResizing && resizeColumn === 'color' ? 'resizing' : ''}`}
                  onMouseDown={(e) => handleResizeStart(e, 'color')}
                />
              </th>
              <th className="resizable-header" style={{ width: columnWidths.attributes }}>
                Attributes
                <div 
                  className={`resize-handle ${isResizing && resizeColumn === 'attributes' ? 'resizing' : ''}`}
                  onMouseDown={(e) => handleResizeStart(e, 'attributes')}
                />
              </th>
              <th className="resizable-header" style={{ width: columnWidths.notes }}>
                Notes
                <div 
                  className={`resize-handle ${isResizing && resizeColumn === 'notes' ? 'resizing' : ''}`}
                  onMouseDown={(e) => handleResizeStart(e, 'notes')}
                />
              </th>
              {isAuthenticated && (
                <>
                  <th className="center">
                    Owned
                  </th>
                  <th className="center">
                    Action
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {displayedCards.map(card => (
              <tr 
                key={card.card_id} 
                className={onCardClick ? 'clickable' : ''}
                onClick={() => onCardClick && onCardClick(card)}
              >
                <td className="card-number-cell">
                  {card.card_number}
                </td>
                {showPlayer && (
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
                )}
                <td className="series-cell">
                  {onSeriesClick ? (
                    <span 
                      className="series-link"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSeriesClick(card.series_rel)
                      }}
                    >
                      {card.series_rel?.name}
                    </span>
                  ) : (
                    card.series_rel?.name
                  )}
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
                {isAuthenticated && (
                  <>
                    <td className="user-card-count-cell center">
                      {userCardCounts[card.card_id] || 0}
                    </td>
                    <td className="action-cell center">
                      <button
                        className="add-card-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleAddCard(card)
                        }}
                        title="Add to Collection"
                      >
                        <Icon name="plus" size={16} style={{color: 'white'}} />
                      </button>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {displayedCards.length === 0 && !loading && (
          <div className="empty-state">
            <Icon name="search" size={48} />
            <h3>No Cards Found</h3>
            <p>No cards match the current filters.</p>
          </div>
        )}

        {/* Removed loading more indicator - no longer needed */}
      </div>

      {/* Table Footer */}
      <div className="table-footer">
        <div className="table-info">
          <span>
            Showing {displayedCards.length} of {totalCardsCount} cards
          </span>
        </div>
        
        <div className="table-actions">
          <button 
            className="action-button primary"
            onClick={handleDownload}
            disabled={loading || displayedCards.length === 0}
          >
            {loading ? (
              <>
                <Icon name="activity" size={16} className="spinner" />
                Preparing...
              </>
            ) : (
              <>
                <Icon name="import" size={16} />
                Download
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Add Card Modal */}
      <AddCardModal
        isOpen={showAddCardModal}
        onClose={() => setShowAddCardModal(false)}
        card={selectedCard}
        onCardAdded={handleCardAdded}
      />
    </div>
  )
}

export default UniversalCardTable