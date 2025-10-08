import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import AddToListDropdown from '../AddToListDropdown'
import './CardTableScoped.css'

/**
 * CardTable - Reusable component for displaying cards from the database (card table)
 * Used on series detail pages, set pages, search results, etc.
 * 
 * Features:
 * - Shows basic card information: Card #, Player(s), Series, Color, Attributes, Notes
 * - For authenticated users: ADD button and OWNED count
 * - Sorting by Card #, Player name, Series name, Print Run (defaults to Series)
 * - Search functionality
 * - Bulk selection mode for authenticated users
 * - Customizable height via maxHeight prop (defaults to 600px)
 * - Horizontal scrolling on small screens with minimum width protection
 * - Responsive design
 */
const CardTable = ({
  cards = [],
  loading = false,
  onAddCard = null,
  onCardClick = null,
  onSeriesClick = null,
  onPlayerClick = null,
  showSearch = true,
  showBulkActions = true,
  bulkSelectionMode = false,
  selectedCards = new Set(),
  onBulkSelectionToggle = null,
  onCardSelection = null,
  onBulkAction = null,
  searchQuery = '',
  onSearchChange = null,
  maxHeight = '600px', // Default max height for the table wrapper
  showDownload = true,
  downloadFilename = 'cards',
  defaultSort = 'series_name',
  autoFocusSearch = false,
  showRemoveFromList = false,
  onRemoveFromList = null,
  removingCardId = null
}) => {
  const { isAuthenticated } = useAuth()
  const [sortField, setSortField] = useState(defaultSort)
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Column resizing state
  const [columnWidths, setColumnWidths] = useState({
    checkbox: 56,      // 32px button + 24px padding (12px each side)
    owned: 60,         // Compact width for "OWN" text with centering
    card_number: 'auto',
    player: 'auto',
    series: 'auto',    // Series column between player and color
    color: 'auto',
    print_run: 120,    // Width for "PRINT RUN" header text
    auto: 80,          // Width for "AUTO" column (split from attributes)
    relic: 80,         // Width for "RELIC" column (split from attributes)
    find: 80,          // Width for "FIND" marketplace dropdown column
    notes: 'auto',
    remove: 56         // Width for remove button column
  })
  const [isResizing, setIsResizing] = useState(false)
  const [resizingColumn, setResizingColumn] = useState(null)
  const [openMarketplaceDropdown, setOpenMarketplaceDropdown] = useState(null)
  const searchInputRef = useRef(null)
  const marketplaceDropdownRef = useRef(null)

  // Auto-focus search input when component loads
  useEffect(() => {
    if (autoFocusSearch && searchInputRef.current && showSearch) {
      // Small delay to ensure the component is fully rendered
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [autoFocusSearch, showSearch])

  // Close marketplace dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (marketplaceDropdownRef.current && !marketplaceDropdownRef.current.contains(event.target)) {
        setOpenMarketplaceDropdown(null)
      }
    }

    if (openMarketplaceDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openMarketplaceDropdown])

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
      } else if (sortField === 'is_autograph' || sortField === 'is_relic') {
        // Boolean sorting: true values first when ascending
        aVal = a[sortField] ? 1 : 0
        bVal = b[sortField] ? 1 : 0
        return sortDirection === 'asc' ? bVal - aVal : aVal - bVal
      } else if (sortField === 'sort_order') {
        // Handle sort_order as numeric
        const aNum = parseInt(a.sort_order) || 0
        const bNum = parseInt(b.sort_order) || 0
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      } else if (sortField === 'print_run') {
        // Handle print_run as numeric, null values go to end
        const aNum = a.print_run ? parseInt(a.print_run) : 999999
        const bNum = b.print_run ? parseInt(b.print_run) : 999999
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      } else if (sortField === 'color') {
        // Handle color sorting using color_rel
        aVal = a.color_rel?.color || ''
        bVal = b.color_rel?.color || ''
      } else if (sortField === 'card_number') {
        // Smart card number sorting: numeric if all are numbers, alphabetic if mixed
        const aNum = parseInt(a.card_number)
        const bNum = parseInt(b.card_number)
        
        if (!isNaN(aNum) && !isNaN(bNum) && 
            a.card_number === aNum.toString() && 
            b.card_number === bNum.toString()) {
          return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
        } else {
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

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return null // Don't show any icon when column is not sorted
    }
    
    return (
      <Icon 
        name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
        size={14} 
        className={`card-table-sort-icon card-table-sort-active ${sortDirection}`}
      />
    )
  }

  const handleSelectAll = (checked) => {
    if (checked) {
      onCardSelection?.(new Set(sortedCards.map(card => card.card_id)))
    } else {
      onCardSelection?.(new Set())
    }
  }

  // Column resizing handlers
  const handleMouseDown = (e, columnKey) => {
    e.preventDefault()
    setIsResizing(true)
    setResizingColumn(columnKey)
    
    const startX = e.clientX
    const startWidth = columnWidths[columnKey]
    
    const handleMouseMove = (e) => {
      const diff = e.clientX - startX
      const newWidth = Math.max(50, startWidth + diff) // Minimum 50px width
      
      setColumnWidths(prev => ({
        ...prev,
        [columnKey]: newWidth
      }))
    }
    
    const handleMouseUp = () => {
      setIsResizing(false)
      setResizingColumn(null)
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
    
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }

  // Resize handle component
  const ResizeHandle = ({ columnKey }) => (
    <div
      className="card-table-resize-handle"
      onMouseDown={(e) => handleMouseDown(e, columnKey)}
      title="Resize column"
    />
  )

  const handleDownload = async () => {
    try {
      const dataToExport = sortedCards
      
      // Create headers that match the table columns
      const headers = [
        'Card #',
        'Player(s)',
        'Series',
        'Print Run',
        'Color',
        'Auto',
        'Relic',
        'Notes'
      ]

      const csvData = [
        headers.join(','),
        ...dataToExport.map(card => {
          // Format players
          const players = card.card_player_teams?.map(cpt => 
            `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
          ).join('; ') || ''
          
          // Format auto and relic separately
          const auto = card.is_autograph ? 'AUTO' : ''
          const relic = card.is_relic ? 'RELIC' : ''

          const row = [
            `"${card.card_number || ''}"`,
            `"${players}"`,
            `"${card.series_rel?.name || ''}"`,
            `"${card.print_run ? `/${card.print_run}` : ''}"`,
            `"${card.color_rel?.color || ''}"`,
            `"${auto}"`,
            `"${relic}"`,
            `"${card.notes || ''}"`
          ]
          
          return row.join(',')
        })
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
    }
  }

  if (loading) {
    return (
      <div className="card-table-loading">
        <Icon name="activity" size={24} className="card-table-spinner" />
        <p>Loading cards...</p>
      </div>
    )
  }

  return (
    <div className="card-table-container">
      {/* Table Controls */}
      {(showSearch || (isAuthenticated && showBulkActions)) && (
        <div className="card-table-controls">
          {showSearch && (
            <div className="card-table-search-container">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search cards..."
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="card-table-search-input"
              />
            </div>
          )}
          
          {isAuthenticated && showBulkActions && (
            <>
              <div className="card-table-view-toggle">
                <button
                  className={`card-table-toggle-button ${!bulkSelectionMode ? 'card-table-active' : ''}`}
                  onClick={onBulkSelectionToggle}
                  title="Single selection mode"
                >
                  <Icon name="plus-circle" size={16} />
                  Single
                </button>
                <button
                  className={`card-table-toggle-button ${bulkSelectionMode ? 'card-table-active' : ''}`}
                  onClick={onBulkSelectionToggle}
                  title="Multiple selection mode"
                >
                  <Icon name="list" size={16} />
                  Multiple
                </button>
              </div>
              
              {bulkSelectionMode && selectedCards.size > 0 && (
                <button
                  className="bulk-action-button"
                  onClick={onBulkAction}
                  title={`Add ${selectedCards.size} selected cards to collection`}
                >
                  <Icon name="plus" size={16} />
                  Add {selectedCards.size} Cards
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Table */}
      <div 
        className="card-table-wrapper"
        style={{ 
          maxHeight: maxHeight,
          overflowY: maxHeight === 'none' ? 'hidden' : 'auto'
        }}
      >
        <table className="card-table">
          <thead>
            <tr>
              {isAuthenticated && (
                <>
                  <th 
                    className={bulkSelectionMode ? "checkbox-header" : "action-header"}
                    style={{ width: columnWidths.checkbox }}
                  >
                    <div className="card-table-header-with-resize">
                      {bulkSelectionMode ? (
                        <div className="card-table-checkbox-container">
                          <input
                            type="checkbox"
                            checked={selectedCards.size === sortedCards.length && sortedCards.length > 0}
                            onChange={(e) => handleSelectAll(e.target.checked)}
                            title={selectedCards.size === sortedCards.length ? "Deselect all" : "Select all"}
                          />
                        </div>
                      ) : (
                        <div className="card-table-header-content">
                          ADD
                        </div>
                      )}
                      <ResizeHandle columnKey="checkbox" />
                    </div>
                  </th>
                  <th className="owned-header" style={{ width: columnWidths.owned }}>
                    OWN
                  </th>
                </>
              )}
              <th className="sortable card-number-header" style={{ width: columnWidths.card_number }}>
                <div className="card-table-header-with-resize">
                  <div className="card-table-header-content" onClick={() => handleSort('card_number')}>
                    CARD # <SortIcon field="card_number" />
                  </div>
                </div>
              </th>
              <th className="sortable player-header" style={{ width: columnWidths.player }}>
                <div className="card-table-header-with-resize">
                  <div className="card-table-header-content" onClick={() => handleSort('player_name')}>
                    PLAYER(S) <SortIcon field="player_name" />
                  </div>
                </div>
              </th>
              <th className="sortable card-table-series-header" style={{ width: columnWidths.series }}>
                <div className="card-table-header-with-resize">
                  <div className="card-table-header-content" onClick={() => handleSort('series_name')}>
                    SERIES <SortIcon field="series_name" />
                  </div>
                </div>
              </th>
              <th className="color-header" style={{ width: columnWidths.color }}>
                <div className="card-table-header-with-resize">
                  COLOR
                </div>
              </th>
              <th 
                className="sortable print-run-header"
                style={{ width: columnWidths.print_run }}
              >
                <div className="card-table-header-with-resize">
                  <div className="card-table-header-content" onClick={() => handleSort('print_run')}>
                    PRINT RUN <SortIcon field="print_run" />
                  </div>
                  <ResizeHandle columnKey="print_run" />
                </div>
              </th>
              <th 
                className="sortable auto-header" 
                style={{ width: columnWidths.auto }}
              >
                <div className="card-table-header-with-resize">
                  <div className="card-table-header-content" onClick={() => handleSort('is_autograph')}>
                    AUTO <SortIcon field="is_autograph" />
                  </div>
                  <ResizeHandle columnKey="auto" />
                </div>
              </th>
              <th
                className="sortable relic-header"
                style={{ width: columnWidths.relic }}
              >
                <div className="card-table-header-with-resize">
                  <div className="card-table-header-content" onClick={() => handleSort('is_relic')}>
                    RELIC <SortIcon field="is_relic" />
                  </div>
                  <ResizeHandle columnKey="relic" />
                </div>
              </th>
              <th className="notes-header" style={{ width: columnWidths.notes }}>
                <div className="card-table-header-with-resize">
                  NOTES
                </div>
              </th>
              <th className="find-header" style={{ width: columnWidths.find }}>
                <div className="card-table-header-content">
                  SHOP
                </div>
              </th>
              {showRemoveFromList && (
                <th className="remove-header" style={{ width: columnWidths.remove }}>
                  <div className="card-table-header-content">
                    {/* Empty header */}
                  </div>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card) => {
              const isOwned = isAuthenticated && (card.user_card_count > 0)
              
              return (
                <tr 
                  key={card.card_id}
                  className={`card-row ${onCardClick ? 'clickable' : ''} ${isOwned ? 'owned-card' : ''}`}
                >
                  {isAuthenticated && (
                    <>
                      {bulkSelectionMode ? (
                        <td className="checkbox-cell">
                          <div className="card-table-checkbox-container">
                            <input
                              type="checkbox"
                              checked={selectedCards.has(card.card_id)}
                              onChange={(e) => {
                                const newSelected = new Set(selectedCards)
                                if (e.target.checked) {
                                  newSelected.add(card.card_id)
                                } else {
                                  newSelected.delete(card.card_id)
                                }
                                onCardSelection?.(newSelected)
                              }}
                              title="Select for bulk action"
                            />
                          </div>
                        </td>
                      ) : (
                        <td className="action-cell">
                          <AddToListDropdown
                            card={card}
                            onAddToCollection={() => onAddCard?.(card)}
                          />
                        </td>
                      )}
                      <td className="owned-cell">
                        {card.user_card_count || 0}
                      </td>
                    </>
                  )}
                  <td 
                    className="card-number-cell card-table-clickable-cell"
                    onClick={() => onCardClick?.(card)}
                    style={{ cursor: onCardClick ? 'pointer' : 'default' }}
                    title={onCardClick ? "Click to view card details" : undefined}
                  >
                    {card.card_number}
                  </td>
                  <td className="player-cell">
                    {card.card_player_teams?.map((cpt, index) => (
                      <div key={index} className="player-info">
                        {/* Team Circle */}
                        {cpt.team && (
                          <div 
                            className="team-circle-base team-circle-sm"
                            style={{
                              '--primary-color': cpt.team.primary_color || '#333',
                              '--secondary-color': cpt.team.secondary_color || '#666'
                            }}
                            title={cpt.team.name}
                          >
                            {cpt.team.abbreviation || cpt.team.name?.slice(0, 3).toUpperCase()}
                          </div>
                        )}
                        {onPlayerClick ? (
                          <button
                            className="card-table-player-link"
                            onClick={(e) => {
                              e.stopPropagation()
                              onPlayerClick(cpt.player)
                            }}
                            title={`View ${cpt.player?.first_name} ${cpt.player?.last_name} profile`}
                          >
                            {cpt.player?.first_name} {cpt.player?.last_name}
                          </button>
                        ) : (
                          <span className="card-table-player-name">
                            {cpt.player?.first_name} {cpt.player?.last_name}
                          </span>
                        )}
                        {card.is_rookie && <span className="cardcard-tag cardcard-rc cardcard-rc-inline"> RC</span>}
                      </div>
                    ))}
                  </td>
                  <td className="card-table-series-cell">
                    {onSeriesClick ? (
                      <button 
                        className="card-table-series-link"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSeriesClick(card.series_rel)
                        }}
                        title={`View ${card.series_rel?.name} series details`}
                      >
                        {card.series_rel?.name}
                      </button>
                    ) : (
                      <span className="card-table-series-name">
                        {card.series_rel?.name}
                      </span>
                    )}
                  </td>
                  <td className="color-cell">
                    {card.color_rel?.color && (
                      <span 
                        className="color-tag"
                        style={{
                          backgroundColor: card.color_rel?.hex_color || '#ec4899',
                          color: card.color_rel?.hex_color ? (
                            parseInt(card.color_rel.hex_color.slice(1, 3), 16) * 0.299 +
                            parseInt(card.color_rel.hex_color.slice(3, 5), 16) * 0.587 +
                            parseInt(card.color_rel.hex_color.slice(5, 7), 16) * 0.114 > 128
                            ? '#000000' : '#ffffff'
                          ) : '#ffffff'
                        }}
                      >
                        {card.color_rel.color}
                      </span>
                    )}
                  </td>
                  <td className="print-run-cell">
                    {card.print_run && (
                      <span className="print-run-tag">
                        /{card.print_run}
                      </span>
                    )}
                  </td>
                  <td className="auto-cell">
                    {card.is_autograph && <span className="cardcard-tag cardcard-insert">AUTO</span>}
                  </td>
                  <td className="relic-cell">
                    {card.is_relic && <span className="cardcard-tag cardcard-relic">RELIC</span>}
                  </td>
                  <td className="notes-cell">
                    {card.notes}
                  </td>
                  <td className="find-cell">
                    <div
                      className="marketplace-dropdown"
                      ref={openMarketplaceDropdown === card.card_id ? marketplaceDropdownRef : null}
                    >
                      <button
                        className="marketplace-dropdown-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setOpenMarketplaceDropdown(
                            openMarketplaceDropdown === card.card_id ? null : card.card_id
                          )
                        }}
                        title="Find this card on marketplaces"
                      >
                        <Icon name="shopping" size={16} />
                      </button>
                      {openMarketplaceDropdown === card.card_id && (
                        <div className="marketplace-dropdown-menu">
                          <button
                            className="marketplace-dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation()
                              const playerNames = card.card_player_teams?.map(cpt =>
                                `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
                              ).join(', ') || ''
                              const searchQuery = `${card.series_rel?.set_name || ''} ${playerNames} #${card.card_number}`
                              const ebayUrl = `https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(searchQuery)}&_sacat=0&_from=R40&_trksid=p4624852.m570.l1313&mkcid=1&mkrid=711-53200-19255-0&siteid=0&campid=5339123359&customid=&toolid=10001&mkevt=1`
                              window.open(ebayUrl, '_blank')
                              setOpenMarketplaceDropdown(null)
                            }}
                          >
                            <img
                              src="https://cardcheckliststorage.blob.core.windows.net/logo/ebay.svg"
                              alt="eBay"
                              className="marketplace-logo"
                            />
                            <span>eBay</span>
                          </button>
                          <button
                            className="marketplace-dropdown-item"
                            onClick={(e) => {
                              e.stopPropagation()
                              const playerNames = card.card_player_teams?.map(cpt =>
                                `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
                              ).join(', ') || ''
                              const searchQuery = `${card.card_number}+${card.series_rel?.set_name || ''}+${playerNames.replace(/,/g, '+').replace(/\s+/g, '+')}`
                              const comcUrl = `https://www.comc.com/Cards,sh,=${searchQuery}`
                              window.open(comcUrl, '_blank')
                              setOpenMarketplaceDropdown(null)
                            }}
                          >
                            <img
                              src="https://cardcheckliststorage.blob.core.windows.net/logo/comc.webp"
                              alt="COMC"
                              className="marketplace-logo"
                            />
                            <span>COMC</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                  {showRemoveFromList && (
                    <td className="remove-cell">
                      <button
                        className="remove-from-list-button"
                        onClick={(e) => {
                          e.stopPropagation()
                          onRemoveFromList?.(card)
                        }}
                        disabled={removingCardId === card.card_id}
                        title="Remove from list"
                      >
                        {removingCardId === card.card_id ? (
                          <div className="card-icon-spinner tiny"></div>
                        ) : (
                          <Icon name="x" size={16} />
                        )}
                      </button>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="card-table-footer">
        <div className="card-table-info">
          Showing {sortedCards.length} of {cards.length} cards
          {searchQuery && ` (filtered by "${searchQuery}")`}
        </div>
        
        {showDownload && (
          <div className="card-table-actions">
            <button 
              className="card-table-download-button"
              onClick={handleDownload}
              disabled={sortedCards.length === 0}
              title="Download table data as CSV"
            >
              <Icon name="download" size={16} />
              Download
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

export default CardTable