import React, { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import './CardTableScoped.css'

/**
 * CardTable - Reusable component for displaying cards from the database (card table)
 * Used on series detail pages, set pages, search results, etc.
 * 
 * Features:
 * - Shows basic card information: Card #, Player(s), Series, Color, Attributes, Notes
 * - For authenticated users: ADD button and OWNED count
 * - Sorting by Card #, Player name, Series name, Print Run
 * - Search functionality
 * - Bulk selection mode for authenticated users
 * - Customizable height via maxHeight prop
 * - Horizontal scrolling on small screens with minimum width protection
 * - Responsive design
 */
const CardTable = ({
  cards = [],
  loading = false,
  onAddCard = null,
  onCardClick = null,
  showSearch = true,
  showBulkActions = true,
  bulkSelectionMode = false,
  selectedCards = new Set(),
  onBulkSelectionToggle = null,
  onCardSelection = null,
  onBulkAction = null,
  searchQuery = '',
  onSearchChange = null,
  maxHeight = null // Custom height for the table wrapper
}) => {
  const { isAuthenticated } = useAuth()
  const [sortField, setSortField] = useState('sort_order')
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
    attributes: 120,
    notes: 'auto'
  })
  const [isResizing, setIsResizing] = useState(false)
  const [resizingColumn, setResizingColumn] = useState(null)

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
      } else if (sortField === 'print_run') {
        // Handle print_run as numeric, null values go to end
        const aNum = a.print_run ? parseInt(a.print_run) : 999999
        const bNum = b.print_run ? parseInt(b.print_run) : 999999
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
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
      return <Icon name="chevron-up" size={14} className="card-table-sort-icon card-table-sort-neutral" />
    }
    
    return (
      <Icon 
        name="chevron-up" 
        size={14} 
        className={`card-table-sort-icon card-table-sort-active ${sortDirection === 'desc' ? 'card-table-sort-desc' : ''}`}
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
                  <Icon name="check-square" size={16} />
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
          maxHeight: maxHeight || 'none',
          overflowY: maxHeight ? 'auto' : 'hidden'
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
                        "ADD"
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
              <th className="attributes-header" style={{ width: columnWidths.attributes }}>
                <div className="card-table-header-with-resize">
                  ATTRIBUTES
                  <ResizeHandle columnKey="attributes" />
                </div>
              </th>
              <th className="notes-header" style={{ width: columnWidths.notes }}>
                <div className="card-table-header-with-resize">
                  NOTES
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCards.map((card, cardIndex) => {
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
                          <button
                            className="add-card-btn"
                            onClick={(e) => {
                              e.stopPropagation()
                              onAddCard?.(card)
                            }}
                            title="Add to Collection"
                          >
                            <Icon name="plus" size={16} />
                          </button>
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
                        <span className="card-table-player-name">
                          {cpt.player?.first_name} {cpt.player?.last_name}
                        </span>
                        {card.is_rookie && <span className="cardcard-tag cardcard-rc cardcard-rc-inline"> RC</span>}
                      </div>
                    ))}
                  </td>
                  <td className="card-table-series-cell">
                    <span className="card-table-series-name">
                      {card.series_rel?.name}
                    </span>
                  </td>
                  <td className="color-cell">
                    {card.color_name && (
                      <span 
                        className="color-tag"
                        style={{
                          backgroundColor: card.color_hex_value || '#ec4899',
                          color: card.color_hex_value ? (
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
                  <td className="print-run-cell">
                    {card.print_run && (
                      <span className="print-run-tag">
                        /{card.print_run}
                      </span>
                    )}
                  </td>
                  <td className="attributes-cell">
                    <div className="attribute-tags">
                      {card.is_autograph && <span className="cardcard-tag cardcard-insert cardcard-rc-inline">AUTO</span>}
                      {card.is_relic && <span className="cardcard-tag cardcard-relic cardcard-rc-inline">RELIC</span>}
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
      <div className="card-table-footer">
        <div className="card-table-info">
          Showing {sortedCards.length} of {cards.length} cards
          {searchQuery && ` (filtered by "${searchQuery}")`}
        </div>
      </div>
    </div>
  )
}

export default CardTable