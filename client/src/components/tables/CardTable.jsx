import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import AddToListDropdown from '../AddToListDropdown'
import ColumnPicker from '../ColumnPicker'
import { CARD_TABLE_COLUMNS, getDefaultVisibleColumns } from '../../utils/tableColumnDefinitions'
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
  totalCards = null, // Total cards from server (for infinite scroll)
  loading = false,
  loadingMore = false, // Loading more cards (not initial load)
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
  onSearchChange = null, // Server-side search handler
  onLoadMore = null, // Infinite scroll handler
  hasMore = false, // Whether more cards can be loaded
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
  const [visibleColumns, setVisibleColumns] = useState(
    getDefaultVisibleColumns('card_table')
  )

  // Manage search state internally when not controlled by parent
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('')
  const [searchInputValue, setSearchInputValue] = useState('') // Local state for input value
  const isControlled = searchQuery !== '' || onSearchChange !== null
  const isServerSideSearch = onSearchChange !== null // Server-side search mode


  // Column resizing state
  const [columnWidths, setColumnWidths] = useState({
    checkbox: 56,      // 32px button + 24px padding (12px each side)
    owned: 60,         // Compact width for "OWN" text with centering
    card_number: 120,  // 2x the owned column width
    player: 'auto',    // Gets extra space from card_number
    series: 'auto',    // Series column between player and color
    production_code: 150, // Width for production code (10-12 characters)
    color: 'auto',
    print_run: 120,    // Width for "PRINT RUN" header text
    auto: 80,          // Width for "AUTO" column (split from attributes)
    relic: 80,         // Width for "RELIC" column (split from attributes)
    sp: 80,            // Width for "SP" column (short print)
    find: 80,          // Width for "FIND" marketplace dropdown column
    notes: 'auto',
    remove: 56         // Width for remove button column
  })
  const [isResizing, setIsResizing] = useState(false)
  const [resizingColumn, setResizingColumn] = useState(null)
  const [openMarketplaceDropdown, setOpenMarketplaceDropdown] = useState(null)
  const [lastSelectedIndex, setLastSelectedIndex] = useState(null)
  const searchInputRef = useRef(null)
  const marketplaceDropdownRef = useRef(null)
  const searchDebounceRef = useRef(null)
  const tableWrapperRef = useRef(null)

  // Auto-focus search input when component loads
  useEffect(() => {
    if (autoFocusSearch && searchInputRef.current && showSearch) {
      // Small delay to ensure the component is fully rendered
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [autoFocusSearch, showSearch])

  // Refocus search input after cards load (for server-side search)
  useEffect(() => {
    if (isServerSideSearch && searchInputValue && searchInputRef.current && !loading && !loadingMore) {
      // Refocus after search results return
      searchInputRef.current.focus()
    }
  }, [loading, loadingMore, searchInputValue, isServerSideSearch])

  // Reset last selected index when bulk selection mode changes
  useEffect(() => {
    setLastSelectedIndex(null)
  }, [bulkSelectionMode])

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

  // Infinite scroll - detect when user scrolls near bottom
  useEffect(() => {
    if (!onLoadMore || !hasMore || loadingMore) return

    const handleScroll = () => {
      const wrapper = tableWrapperRef.current
      if (!wrapper) return

      // Check if scrolled to within 200px of bottom
      const { scrollTop, scrollHeight, clientHeight } = wrapper
      const isNearBottom = scrollTop + clientHeight >= scrollHeight - 200

      if (isNearBottom && hasMore && !loadingMore) {
        onLoadMore()
      }
    }

    const wrapper = tableWrapperRef.current
    if (wrapper) {
      wrapper.addEventListener('scroll', handleScroll)
      return () => wrapper.removeEventListener('scroll', handleScroll)
    }
  }, [onLoadMore, hasMore, loadingMore])

  // Preserve scroll position when new cards are appended
  useEffect(() => {
    if (!tableWrapperRef.current || !onLoadMore) return

    const wrapper = tableWrapperRef.current
    const scrollPos = wrapper.scrollTop

    // After render, if scroll position changed unexpectedly, restore it
    if (scrollPos > 0 && wrapper.scrollTop === 0) {
      wrapper.scrollTop = scrollPos
    }
  }, [cards.length, onLoadMore])

  // Fetch user's column preferences
  useEffect(() => {
    const fetchPreferences = async () => {
      if (!isAuthenticated) {
        // Reset to defaults if not authenticated
        setVisibleColumns(getDefaultVisibleColumns('card_table'))
        return
      }

      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/user/table-preferences/card_table', {
          headers: { 'Authorization': `Bearer ${token}` }
        })

        if (response.ok) {
          const data = await response.json()
          if (data.visible_columns) {
            setVisibleColumns(data.visible_columns)
          } else {
            // No preferences saved yet, use defaults
            setVisibleColumns(getDefaultVisibleColumns('card_table'))
          }
        }
      } catch (error) {
        console.error('Error fetching column preferences:', error)
        // On error, fall back to defaults
        setVisibleColumns(getDefaultVisibleColumns('card_table'))
      }
    }

    fetchPreferences()
  }, [isAuthenticated])

  // Filter cards based on debounced search query (only when NOT using server-side search)
  const filteredCards = useMemo(() => {
    // If server-side search is active, skip client-side filtering
    if (isServerSideSearch) return cards

    if (!debouncedSearchQuery.trim()) return cards

    const query = debouncedSearchQuery.toLowerCase()
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

      // Search in color
      if (card.color_rel?.color?.toLowerCase().includes(query)) return true

      // Search in series name
      if (card.series_rel?.name?.toLowerCase().includes(query)) return true

      // Search in print run
      if (card.print_run && String(card.print_run).includes(query)) return true

      // Search in notes
      if (card.notes?.toLowerCase().includes(query)) return true

      return false
    })
  }, [cards, debouncedSearchQuery, isServerSideSearch])

  // Sort filtered cards with multi-level sorting: primary field → series → card number → player
  // Skip sorting when using server-side search/infinite scroll (server handles ordering)
  const sortedCards = useMemo(() => {
    if (isServerSideSearch && onLoadMore) {
      return filteredCards // Don't sort - preserve server order for infinite scroll
    }

    const sorted = [...filteredCards].sort((a, b) => {
      // Helper to compare values
      const compareValues = (aVal, bVal, direction) => {
        if (typeof aVal === 'string' && typeof bVal === 'string') {
          aVal = aVal.toLowerCase()
          bVal = bVal.toLowerCase()
        }
        if (aVal < bVal) return direction === 'asc' ? -1 : 1
        if (aVal > bVal) return direction === 'asc' ? 1 : -1
        return 0
      }

      // PRIMARY SORT: by selected field
      let primaryResult = 0
      let aVal = a[sortField]
      let bVal = b[sortField]

      if (sortField === 'player_name') {
        aVal = a.card_player_teams?.[0]?.player ?
          `${a.card_player_teams[0].player.first_name || ''} ${a.card_player_teams[0].player.last_name || ''}`.trim() : ''
        bVal = b.card_player_teams?.[0]?.player ?
          `${b.card_player_teams[0].player.first_name || ''} ${b.card_player_teams[0].player.last_name || ''}`.trim() : ''
        primaryResult = compareValues(aVal, bVal, sortDirection)
      } else if (sortField === 'is_autograph' || sortField === 'is_relic' || sortField === 'is_short_print') {
        aVal = a[sortField] ? 1 : 0
        bVal = b[sortField] ? 1 : 0
        primaryResult = sortDirection === 'asc' ? bVal - aVal : aVal - bVal
      } else if (sortField === 'sort_order') {
        const aNum = parseInt(a.sort_order) || 0
        const bNum = parseInt(b.sort_order) || 0
        primaryResult = sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      } else if (sortField === 'print_run') {
        const aNum = a.print_run ? parseInt(a.print_run) : 999999
        const bNum = b.print_run ? parseInt(b.print_run) : 999999
        primaryResult = sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      } else if (sortField === 'color') {
        aVal = a.color_rel?.color || ''
        bVal = b.color_rel?.color || ''
        primaryResult = compareValues(aVal, bVal, sortDirection)
      } else if (sortField === 'card_number') {
        const aNum = parseInt(a.card_number)
        const bNum = parseInt(b.card_number)
        if (!isNaN(aNum) && !isNaN(bNum) &&
            a.card_number === aNum.toString() &&
            b.card_number === bNum.toString()) {
          primaryResult = sortDirection === 'asc' ? aNum - bNum : bNum - aNum
        } else {
          primaryResult = compareValues(String(a.card_number || ''), String(b.card_number || ''), sortDirection)
        }
      } else if (sortField === 'series_name') {
        aVal = a.series_rel?.name || ''
        bVal = b.series_rel?.name || ''
        primaryResult = compareValues(aVal, bVal, sortDirection)
      } else {
        primaryResult = compareValues(String(aVal || ''), String(bVal || ''), sortDirection)
      }

      if (primaryResult !== 0) return primaryResult

      // SECONDARY SORT: by series name (if not already primary)
      if (sortField !== 'series_name') {
        const aSeriesName = a.series_rel?.name || ''
        const bSeriesName = b.series_rel?.name || ''
        const seriesResult = compareValues(aSeriesName, bSeriesName, 'asc')
        if (seriesResult !== 0) return seriesResult
      }

      // TERTIARY SORT: by card number (if not already primary)
      if (sortField !== 'card_number') {
        const aNum = parseInt(a.card_number)
        const bNum = parseInt(b.card_number)
        if (!isNaN(aNum) && !isNaN(bNum)) {
          if (aNum !== bNum) return aNum - bNum
        } else {
          const cardNumResult = compareValues(String(a.card_number || ''), String(b.card_number || ''), 'asc')
          if (cardNumResult !== 0) return cardNumResult
        }
      }

      // QUATERNARY SORT: by player name (if not already primary)
      if (sortField !== 'player_name') {
        const aPlayerName = a.card_player_teams?.[0]?.player ?
          `${a.card_player_teams[0].player.first_name || ''} ${a.card_player_teams[0].player.last_name || ''}`.trim() : ''
        const bPlayerName = b.card_player_teams?.[0]?.player ?
          `${b.card_player_teams[0].player.first_name || ''} ${b.card_player_teams[0].player.last_name || ''}`.trim() : ''
        return compareValues(aPlayerName, bPlayerName, 'asc')
      }

      return 0
    })

    return sorted
  }, [filteredCards, sortField, sortDirection, isServerSideSearch, onLoadMore])

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  // Helper function to check if a column should be visible (memoized for performance)
  const isColumnVisible = useCallback((columnId) => {
    return visibleColumns.includes(columnId)
  }, [visibleColumns])

  // Memoized callback for column changes to prevent ColumnPicker re-renders
  const handleColumnsChange = useCallback((newColumns) => {
    setVisibleColumns(newColumns)
  }, [])

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
    // Reset last selected index when selecting/deselecting all
    setLastSelectedIndex(null)
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
        'Team(s)',
        'RC',
        'Series',
        'Print Run',
        'Color',
        'Auto',
        'Relic',
        'Notes',
        'Production Code'
      ]

      const csvData = [
        headers.join(','),
        ...dataToExport.map(card => {
          // Format players
          const players = card.card_player_teams?.map(cpt =>
            `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
          ).join(' / ') || ''

          // Format teams
          const teams = card.card_player_teams?.map(cpt =>
            cpt.team?.name || ''
          ).filter(name => name).join(' / ') || ''

          // Format RC status
          const rc = card.is_rookie ? 'RC' : ''

          // Format auto and relic separately
          const auto = card.is_autograph ? 'AUTO' : ''
          const relic = card.is_relic ? 'RELIC' : ''

          const row = [
            `"${card.card_number || ''}"`,
            `"${players}"`,
            `"${teams}"`,
            `"${rc}"`,
            `"${card.series_rel?.name || ''}"`,
            `"${card.print_run ? `/${card.print_run}` : ''}"`,
            `"${card.color_rel?.color || ''}"`,
            `"${auto}"`,
            `"${relic}"`,
            `"${card.notes || ''}"`,
            `"${card.series_rel?.production_code || ''}"`
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

  // Only show full-screen loading on initial load (when there are no cards)
  // During search, keep the table visible and show a loading overlay instead
  const showFullScreenLoading = loading && cards.length === 0

  if (showFullScreenLoading) {
    return (
      <div className="card-table-loading">
        <div className="card-icon-spinner"></div>
        <p>Loading cards...</p>
      </div>
    )
  }

  return (
    <div className="card-table-container">
      {/* Table Controls */}
      {(showSearch || (isAuthenticated && showBulkActions)) && (
        <div className="card-table-controls">
          <div className="card-table-controls-left">
            {/* Column Customization */}
            <ColumnPicker
              tableName="card_table"
              columns={CARD_TABLE_COLUMNS}
              visibleColumns={visibleColumns}
              onColumnsChange={handleColumnsChange}
              isAuthenticated={isAuthenticated}
            />

            {showSearch && (
              <div className="card-table-search-container">
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Search cards..."
                  value={searchInputValue}
                  onChange={(e) => {
                    const newValue = e.target.value
                    setSearchInputValue(newValue) // Update local state immediately

                    // Always debounce search (both server-side and client-side)
                    if (searchDebounceRef.current) {
                      clearTimeout(searchDebounceRef.current)
                    }

                    searchDebounceRef.current = setTimeout(() => {
                      if (isControlled && onSearchChange) {
                        // Server-side search
                        onSearchChange(newValue)
                      } else {
                        // Client-side search
                        setDebouncedSearchQuery(newValue)
                      }
                    }, 300)
                  }}
                  onKeyDown={(e) => {
                    // Allow Enter key to trigger immediate search
                    if (e.key === 'Enter') {
                      if (searchDebounceRef.current) {
                        clearTimeout(searchDebounceRef.current)
                      }
                      const value = e.target.value
                      if (isControlled && onSearchChange) {
                        onSearchChange(value)
                      } else {
                        setDebouncedSearchQuery(value)
                      }
                    }
                  }}
                  className="card-table-search-input"
                />
              </div>
            )}
          </div>

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
        ref={tableWrapperRef}
        className="card-table-wrapper"
        style={{
          maxHeight: maxHeight,
          overflowY: maxHeight === 'none' ? 'hidden' : 'auto',
          position: 'relative'
        }}
      >
        {/* Loading overlay during search (when we already have data) */}
        {loading && cards.length > 0 && (
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(255, 255, 255, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10
          }}>
            <div className="card-icon-spinner"></div>
          </div>
        )}

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
                  {isColumnVisible('owned') && (
                    <th className="owned-header" style={{ width: columnWidths.owned }}>
                      OWN
                    </th>
                  )}
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
              {isColumnVisible('series') && (
                <th className="sortable card-table-series-header" style={{ width: columnWidths.series }}>
                  <div className="card-table-header-with-resize">
                    <div className="card-table-header-content" onClick={() => handleSort('series_name')}>
                      SERIES <SortIcon field="series_name" />
                    </div>
                  </div>
                </th>
              )}
              {isColumnVisible('color') && (
                <th className="color-header" style={{ width: columnWidths.color }}>
                <div className="card-table-header-with-resize">
                  COLOR
                </div>
              </th>
              )}
              {isColumnVisible('print_run') && (
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
              )}
              {isColumnVisible('auto') && (
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
              )}
              {isColumnVisible('relic') && (
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
              )}
              {isColumnVisible('sp') && (
                <th
                  className="sortable sp-header"
                  style={{ width: columnWidths.sp || 80 }}
                >
                  <div className="card-table-header-with-resize">
                    <div className="card-table-header-content" onClick={() => handleSort('is_short_print')}>
                      SP <SortIcon field="is_short_print" />
                    </div>
                    <ResizeHandle columnKey="sp" />
                  </div>
                </th>
              )}
              {isColumnVisible('notes') && (
                <th className="notes-header" style={{ width: columnWidths.notes }}>
                  <div className="card-table-header-with-resize">
                    NOTES
                  </div>
                </th>
              )}
              {isColumnVisible('production_code') && (
                <th className="production-code-header" style={{ width: columnWidths.production_code }}>
                  <div className="card-table-header-with-resize">
                    <div className="card-table-header-content">
                      PRODUCTION CODE
                    </div>
                  </div>
                </th>
              )}
              {isColumnVisible('shop') && (
                <th className="find-header" style={{ width: columnWidths.find }}>
                  <div className="card-table-header-content">
                    SHOP
                  </div>
                </th>
              )}
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
                                const currentIndex = sortedCards.findIndex(c => c.card_id === card.card_id)
                                const newSelected = new Set(selectedCards)

                                // Handle shift-click range selection
                                if (e.nativeEvent.shiftKey && lastSelectedIndex !== null) {
                                  const start = Math.min(lastSelectedIndex, currentIndex)
                                  const end = Math.max(lastSelectedIndex, currentIndex)

                                  // Select or deselect all cards in range based on the clicked checkbox state
                                  for (let i = start; i <= end; i++) {
                                    if (e.target.checked) {
                                      newSelected.add(sortedCards[i].card_id)
                                    } else {
                                      newSelected.delete(sortedCards[i].card_id)
                                    }
                                  }
                                } else {
                                  // Normal single checkbox toggle
                                  if (e.target.checked) {
                                    newSelected.add(card.card_id)
                                  } else {
                                    newSelected.delete(card.card_id)
                                  }
                                }

                                setLastSelectedIndex(currentIndex)
                                onCardSelection?.(newSelected)
                              }}
                              title="Select for bulk action (hold Shift to select range)"
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
                      {isColumnVisible('owned') && (
                        <td className="owned-cell">
                          {card.user_card_count || 0}
                        </td>
                      )}
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
                  {isColumnVisible('series') && (
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
                  )}
                  {isColumnVisible('color') && (
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
                  )}
                  {isColumnVisible('print_run') && (
                    <td className="print-run-cell">
                      {card.print_run && (
                        <span className="print-run-tag">
                          /{card.print_run}
                        </span>
                      )}
                    </td>
                  )}
                  {isColumnVisible('auto') && (
                    <td className="auto-cell">
                      {card.is_autograph && <span className="cardcard-tag cardcard-insert">AUTO</span>}
                    </td>
                  )}
                  {isColumnVisible('relic') && (
                    <td className="relic-cell">
                      {card.is_relic && <span className="cardcard-tag cardcard-relic">RELIC</span>}
                    </td>
                  )}
                  {isColumnVisible('sp') && (
                    <td className="sp-cell">
                      {card.is_short_print && <span className="cardcard-tag cardcard-sp">SP</span>}
                    </td>
                  )}
                  {isColumnVisible('notes') && (
                    <td className="notes-cell">
                      {card.notes}
                    </td>
                  )}
                  {isColumnVisible('production_code') && (
                    <td className="production-code-cell">{card.series_rel?.production_code || ''}</td>
                  )}
                  {isColumnVisible('shop') && (
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
                  )}
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

        {/* Loading indicator for infinite scroll */}
        {loadingMore && hasMore && (
          <div className="card-table-loading-more">
            <div className="card-icon-spinner"></div>
            <p>Loading more cards...</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="card-table-footer">
        <div className="card-table-info">
          {isServerSideSearch && totalCards !== null ? (
            <>
              Showing {cards.length} of {totalCards} cards
              {hasMore && !loading && ` (scroll down for more)`}
            </>
          ) : (
            <>
              Showing {sortedCards.length} of {cards.length} cards
              {debouncedSearchQuery && ` (filtered)`}
            </>
          )}
        </div>

        <div className="card-table-actions">
          {showDownload && (
            <button
              className="card-table-download-button"
              onClick={handleDownload}
              disabled={sortedCards.length === 0}
              title="Download table data as CSV"
            >
              <Icon name="download" size={16} />
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default CardTable