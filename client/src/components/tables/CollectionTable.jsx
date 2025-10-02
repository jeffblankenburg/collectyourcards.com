import React, { useState, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import Icon from '../Icon'
import { CardCard, GalleryCard } from '../cards'
import PhotoCountHover from './PhotoCountHover'
import './CollectionTableScoped.css'

/**
 * CollectionTable - Reusable component for displaying user's card collection (user_card table)
 * Used on collection pages, trade lists, want lists, etc.
 * 
 * Features:
 * - Shows collection-specific columns: Code, Serial #, Purchase $, Estimated $, Current $, Location, Grade
 * - Edit, Favorite, Delete actions for each card
 * - Sorting by all columns
 * - Search functionality across all fields
 * - Gallery/Table view toggle
 * - Customizable height via maxHeight prop
 * - Horizontal scrolling with optimized column widths for data visibility
 * - Responsive design
 */
const CollectionTable = ({
  cards = [],
  loading = false,
  onEditCard = null,
  onDeleteCard = null,
  onFavoriteToggle = null,
  onCardClick = null,
  showSearch = true,
  showGalleryToggle = false,
  viewMode = 'table',
  onViewModeChange = null,
  searchQuery = '',
  onSearchChange = null,
  maxHeight = null, // Custom height for the table wrapper
  showDownload = true,
  downloadFilename = 'collection'
}) => {
  const { isAuthenticated } = useAuth()
  const [sortField, setSortField] = useState('series_name')
  const [sortDirection, setSortDirection] = useState('asc')
  
  // Column resizing state - MATCHES CardTable architecture
  const [columnWidths, setColumnWidths] = useState({
    edit: 56,          // 32px button + 24px padding (matches CardTable ADD)
    favorite: 56,      // 32px button + 24px padding (matches CardTable ADD)
    code: 80,          // 4-character code tags with proper padding
    card_number: 100,  // Fixed width for card numbers
    player: 250,       // Generous width for player names (most important)
    series: 300,       // Generous width for series names (most important)
    serial: 110,       // Width for "SERIAL #" header text
    color: 120,        // Fixed width for color tags
    photos: 100,       // Width for photo count - repositioned after COLOR
    auto: 80,          // Width for "AUTO" column (split from attributes)
    relic: 80,         // Width for "RELIC" column (split from attributes)
    price: 130,        // Width for "PURCHASE $" header text
    value: 140,        // Width for "ESTIMATED $" header text
    current_value: 120, // Width for "CURRENT $" header text
    location: 200,     // Wider width for location names like "OFFICE ALPHABET BOX"
    added: 100,        // Width for "ADDED" column showing MM/DD/YY
    grade: 100,        // Fixed width for grades
    am_auto: 100,      // Width for "AM AUTO" header text
    notes: 200,        // Generous width for notes
    delete: 64         // 32px button + 32px padding (more generous spacing)
  })
  const [isResizing, setIsResizing] = useState(false)
  const [resizingColumn, setResizingColumn] = useState(null)

  // Helper function to format date added
  const formatDateAdded = (dateString) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return ''
    
    // Format as MM/DD/YY
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const year = date.getFullYear().toString().slice(-2)
    
    return `${month}/${day}/${year}`
  }

  // Filter cards based on search query
  const filteredCards = useMemo(() => {
    if (!searchQuery.trim()) return cards
    
    const query = searchQuery.toLowerCase()
    return cards.filter(card => {
      // Search in random code
      if (card.random_code?.toLowerCase().includes(query)) return true
      
      // Search in card number
      if (card.card_number?.toLowerCase().includes(query)) return true
      
      // Search in player names
      if (card.card_player_teams?.some(cpt => 
        cpt.player?.name?.toLowerCase().includes(query) ||
        cpt.player?.first_name?.toLowerCase().includes(query) ||
        cpt.player?.last_name?.toLowerCase().includes(query)
      )) return true
      
      // Search in team names
      if (card.card_player_teams?.some(cpt => 
        cpt.team?.name?.toLowerCase().includes(query) ||
        cpt.team?.abbreviation?.toLowerCase().includes(query)
      )) return true
      
      // Search in series name
      if (card.series_rel?.name?.toLowerCase().includes(query)) return true
      
      // Search in serial number
      if (card.serial_number && String(card.serial_number).includes(query)) return true
      
      // Search in values
      if (card.purchase_price && String(card.purchase_price).includes(query)) return true
      if (card.estimated_value && String(card.estimated_value).includes(query)) return true
      if (card.current_value && String(card.current_value).includes(query)) return true
      
      // Search in location
      if (card.location_name?.toLowerCase().includes(query)) return true
      
      // Search in added date (formatted)
      if (card.date_added && formatDateAdded(card.date_added).includes(query)) return true
      
      // Search in grade
      if (card.grade && String(card.grade).includes(query)) return true
      if (card.grading_agency_name?.toLowerCase().includes(query)) return true
      
      // Search in photo count
      if (card.photo_count && String(card.photo_count).includes(query)) return true
      
      // Search in notes
      if (card.notes?.toLowerCase().includes(query)) return true
      
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
      } else if (sortField === 'series_name') {
        aVal = a.series_rel?.name || ''
        bVal = b.series_rel?.name || ''
      } else if (sortField === 'color') {
        aVal = a.color_rel?.color || ''
        bVal = b.color_rel?.color || ''
      } else if (sortField === 'added_date') {
        // Date sorting: convert to timestamps for comparison
        aVal = a.date_added ? new Date(a.date_added).getTime() : 0
        bVal = b.date_added ? new Date(b.date_added).getTime() : 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      } else if (sortField === 'is_autograph' || sortField === 'is_relic') {
        // Boolean sorting: true values first when ascending
        aVal = a[sortField] ? 1 : 0
        bVal = b[sortField] ? 1 : 0
        return sortDirection === 'asc' ? bVal - aVal : aVal - bVal
      } else if (['purchase_price', 'estimated_value', 'current_value', 'grade', 'serial_number', 'photo_count'].includes(sortField)) {
        // Numeric sorting
        aVal = parseFloat(aVal) || 0
        bVal = parseFloat(bVal) || 0
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal
      } else if (sortField === 'card_number') {
        // Smart card number sorting
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

      // String comparison (if not already handled above)
      if (typeof aVal === 'string' || typeof bVal === 'string') {
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
        className={`collection-table-sort-icon collection-table-sort-active ${sortDirection}`}
      />
    )
  }

  // Column resizing handlers - MATCHES CardTable
  const handleMouseDown = (e, columnKey) => {
    e.preventDefault()
    setIsResizing(true)
    setResizingColumn(columnKey)
    
    const startX = e.clientX
    const startWidth = columnWidths[columnKey]
    
    const handleMouseMove = (e) => {
      const diff = e.clientX - startX
      // Set appropriate minimum widths for different column types
      const minWidths = {
        photos: 80,    // Minimum for "PHOTOS" header and count display
        edit: 50,      // Minimum for edit buttons
        favorite: 50,  // Minimum for favorite buttons
        delete: 50     // Minimum for delete buttons
      }
      const minWidth = minWidths[columnKey] || 50 // Default 50px minimum
      const newWidth = Math.max(minWidth, startWidth + diff)
      
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

  // Resize handle component - MATCHES CardTable
  const ResizeHandle = ({ columnKey }) => (
    <div
      className="collection-table-resize-handle"
      onMouseDown={(e) => handleMouseDown(e, columnKey)}
      title="Resize column"
    />
  )

  const formatCurrency = (value) => {
    if (!value) return ''
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(value)
  }


  const handleDownload = async () => {
    try {
      const dataToExport = sortedCards
      
      // Create headers that match the table columns
      const headers = [
        'Code',
        'Card #',
        'Player(s)',
        'Series',
        'Serial #',
        'Color',
        'Photos',
        'Auto',
        'Relic',
        'Purchase Price',
        'Estimated Value',
        'Current Value',
        'Location',
        'Added',
        'Grade',
        'AM Auto',
        'Notes'
      ]

      const csvData = [
        headers.join(','),
        ...dataToExport.map(card => {
          // Format players
          const players = card.card_player_teams?.map(cpt => 
            `${cpt.player?.first_name || ''} ${cpt.player?.last_name || ''}`.trim()
          ).join('; ') || ''
          
          // Format serial number like the table
          const serialNumber = card.serial_number && card.print_run ? 
            `${card.serial_number}/${card.print_run}` : 
            card.serial_number || (card.print_run ? `/${card.print_run}` : '')
          
          // Format auto and relic separately
          const auto = card.is_autograph ? 'AUTO' : ''
          const relic = card.is_relic ? 'RELIC' : ''

          // Format grade
          const grade = card.grade ? (
            card.grading_agency_abbr ? 
              `${card.grading_agency_abbr} ${card.grade}` : 
              String(card.grade)
          ) : ''

          const row = [
            `"${card.random_code || ''}"`,
            `"${card.card_number || ''}"`,
            `"${players}"`,
            `"${card.series_rel?.name || ''}"`,
            `"${serialNumber}"`,
            `"${card.color_rel?.color || ''}"`,
            `"${card.photo_count || 0}"`,
            `"${auto}"`,
            `"${relic}"`,
            `"${card.purchase_price ? formatCurrency(card.purchase_price) : ''}"`,
            `"${card.estimated_value ? formatCurrency(card.estimated_value) : ''}"`,
            `"${card.current_value ? formatCurrency(card.current_value) : ''}"`,
            `"${card.location_name || ''}"`,
            `"${formatDateAdded(card.date_added)}"`,
            `"${grade}"`,
            `"${card.aftermarket_autograph ? '✓' : ''}"`,
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
      <div className="collection-table-loading">
        <Icon name="activity" size={24} className="collection-table-spinner" />
        <p>Loading collection...</p>
      </div>
    )
  }

  if (viewMode === 'gallery') {
    return (
      <div className="collection-table-container">
        {/* Gallery Controls */}
        <div className="collection-table-controls">
          {showSearch && (
            <div className="collection-table-search-container">
              <input
                type="text"
                placeholder="Search collection..."
                value={searchQuery}
                onChange={(e) => onSearchChange?.(e.target.value)}
                className="collection-table-search-input"
              />
            </div>
          )}
          
          {showGalleryToggle && (
            <div className="collection-table-view-toggle">
              <button
                className={`collection-table-toggle-button ${viewMode === 'table' ? 'collection-table-active' : ''}`}
                onClick={() => onViewModeChange?.('table')}
              >
                <Icon name="list" size={16} />
                Table
              </button>
              <button
                className={`collection-table-toggle-button ${viewMode === 'gallery' ? 'collection-table-active' : ''}`}
                onClick={() => onViewModeChange?.('gallery')}
              >
                <Icon name="grid" size={16} />
                Gallery
              </button>
            </div>
          )}
        </div>

        {/* Gallery Grid using GalleryCard component */}
        <div className="gallery-cards-grid">
          {sortedCards.map(card => (
            <GalleryCard 
              key={card.user_card_id}
              card={card}
              onClick={() => onCardClick?.(card)}
              onFavoriteToggle={onFavoriteToggle}
              showFavorite={!!onFavoriteToggle}
              isFavorite={card.is_special}
              imageUrl={card.primary_photo_url || card.front_image_url}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="collection-table-footer">
          <div className="collection-table-info">
            Showing {sortedCards.length} of {cards.length} cards
            {searchQuery && ` (filtered by "${searchQuery}")`}
          </div>
          
          {showDownload && (
            <div className="collection-table-actions">
              <button 
                className="collection-table-download-button"
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

  return (
    <div className="collection-table-container">
      {/* Table Controls */}
      <div className="collection-table-controls">
        {showSearch && (
          <div className="collection-table-search-container">
            <input
              type="text"
              placeholder="Search collection..."
              value={searchQuery}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="collection-table-search-input"
            />
          </div>
        )}
        
        {showGalleryToggle && (
          <div className="collection-table-view-toggle">
            <button
              className={`collection-table-toggle-button ${viewMode === 'table' ? 'collection-table-active' : ''}`}
              onClick={() => onViewModeChange?.('table')}
            >
              <Icon name="list" size={16} />
              Table
            </button>
            <button
              className={`collection-table-toggle-button ${viewMode === 'gallery' ? 'collection-table-active' : ''}`}
              onClick={() => onViewModeChange?.('gallery')}
            >
              <Icon name="grid" size={16} />
              Gallery
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div 
        className="collection-table-wrapper"
        style={{ 
          maxHeight: maxHeight || 'none',
          overflowY: maxHeight ? 'auto' : 'hidden'
        }}
      >
        <table className="collection-table">
          <thead>
            <tr>
              <th className="edit-header" style={{ width: columnWidths.edit }}>
                EDIT
              </th>
              <th className="favorite-header" style={{ width: columnWidths.favorite }}>
                FAVE
              </th>
              <th className="code-header" style={{ width: columnWidths.code }}>
                CODE
              </th>
              <th 
                className="sortable collection-table-card-header"
                style={{ width: columnWidths.card_number }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('card_number')}>
                    CARD # <SortIcon field="card_number" />
                  </div>
                  <ResizeHandle columnKey="card_number" />
                </div>
              </th>
              <th 
                className="sortable player-header"
                style={{ width: columnWidths.player }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('player_name')}>
                    PLAYER(S) <SortIcon field="player_name" />
                  </div>
                  <ResizeHandle columnKey="player" />
                </div>
              </th>
              <th 
                className="sortable collection-table-series-header"
                style={{ width: columnWidths.series }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('series_name')}>
                    SERIES <SortIcon field="series_name" />
                  </div>
                  <ResizeHandle columnKey="series" />
                </div>
              </th>
              <th 
                className="sortable serial-header"
                style={{ width: columnWidths.serial }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('serial_number')}>
                    SERIAL # <SortIcon field="serial_number" />
                  </div>
                  <ResizeHandle columnKey="serial" />
                </div>
              </th>
              <th 
                className="sortable color-header" 
                style={{ width: columnWidths.color }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('color')}>
                    COLOR <SortIcon field="color" />
                  </div>
                  <ResizeHandle columnKey="color" />
                </div>
              </th>
              <th 
                className="sortable photos-header"
                style={{ width: columnWidths.photos }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('photo_count')}>
                    PHOTOS <SortIcon field="photo_count" />
                  </div>
                  <ResizeHandle columnKey="photos" />
                </div>
              </th>
              <th 
                className="sortable auto-header" 
                style={{ width: columnWidths.auto }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('is_autograph')}>
                    AUTO <SortIcon field="is_autograph" />
                  </div>
                  <ResizeHandle columnKey="auto" />
                </div>
              </th>
              <th 
                className="sortable relic-header" 
                style={{ width: columnWidths.relic }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('is_relic')}>
                    RELIC <SortIcon field="is_relic" />
                  </div>
                  <ResizeHandle columnKey="relic" />
                </div>
              </th>
              <th 
                className="sortable price-header"
                style={{ width: columnWidths.price }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('purchase_price')}>
                    PURCHASE $ <SortIcon field="purchase_price" />
                  </div>
                </div>
              </th>
              <th 
                className="sortable value-header"
                style={{ width: columnWidths.value }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('estimated_value')}>
                    ESTIMATED $ <SortIcon field="estimated_value" />
                  </div>
                </div>
              </th>
              <th 
                className="sortable current-value-header"
                style={{ width: columnWidths.current_value }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('current_value')}>
                    CURRENT $ <SortIcon field="current_value" />
                  </div>
                </div>
              </th>
              <th 
                className="sortable location-header"
                style={{ width: columnWidths.location }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('location_name')}>
                    LOCATION <SortIcon field="location_name" />
                  </div>
                  <ResizeHandle columnKey="location" />
                </div>
              </th>
              <th 
                className="sortable added-header"
                style={{ width: columnWidths.added }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('added_date')}>
                    ADDED <SortIcon field="added_date" />
                  </div>
                  <ResizeHandle columnKey="added" />
                </div>
              </th>
              <th 
                className="sortable grade-header"
                style={{ width: columnWidths.grade }}
              >
                <div className="header-with-resize">
                  <div className="collection-table-header-content" onClick={() => handleSort('grade')}>
                    GRADE <SortIcon field="grade" />
                  </div>
                </div>
              </th>
              <th className="am-auto-header" style={{ width: columnWidths.am_auto }}>
                <div className="header-with-resize">
                  AM AUTO
                  <ResizeHandle columnKey="am_auto" />
                </div>
              </th>
              <th className="notes-header" style={{ width: columnWidths.notes }}>
                <div className="header-with-resize">
                  NOTES
                </div>
              </th>
              <th className="delete-header" style={{ width: columnWidths.delete }}>
                DELETE
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedCards.map(card => (
              <tr 
                key={card.user_card_id}
                className={`collection-row ${onCardClick ? 'clickable' : ''}`}
              >
                <td className="edit-cell">
                  <button
                    className="edit-card-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onEditCard?.(card)
                    }}
                    title="Edit card details"
                  >
                    <Icon name="edit" size={16} />
                  </button>
                </td>
                <td className="favorite-cell">
                  <button
                    className={`favorite-btn ${card.is_special ? 'active' : ''}`}
                    onClick={(e) => {
                      e.stopPropagation()
                      onFavoriteToggle?.(card)
                    }}
                    title={card.is_special ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Icon name="star" size={16} />
                  </button>
                </td>
                <td className="code-cell">
                  {card.random_code && (
                    <span className="code-tag">
                      {card.random_code}
                    </span>
                  )}
                </td>
                <td 
                  className="card-number-cell collection-table-clickable-cell"
                  onClick={() => onCardClick?.(card)}
                  style={{ cursor: onCardClick ? 'pointer' : 'default' }}
                >
                  {card.card_number}
                </td>
                <td className="player-cell">
                  {card.card_player_teams?.map((cpt, index) => (
                    <div key={index} className="player-info">
                      {cpt.team && (
                        <div 
                          className="team-circle-base team-circle-sm"
                          style={{
                            '--primary-color': cpt.team.primary_color || '#333',
                            '--secondary-color': cpt.team.secondary_color || '#666'
                          }}
                        >
                          {cpt.team.abbreviation}
                        </div>
                      )}
                      <span className="collection-table-player-name">
                        {cpt.player?.first_name} {cpt.player?.last_name}
                      </span>
                      {card.is_rookie && <span className="cardcard-tag cardcard-rc cardcard-rc-inline"> RC</span>}
                    </div>
                  ))}
                </td>
                <td className="series-cell">{card.series_rel?.name}</td>
                <td className="serial-cell">
                  {card.serial_number && card.print_run ? 
                    `${card.serial_number}/${card.print_run}` : 
                    card.serial_number || (card.print_run ? `/${card.print_run}` : '')
                  }
                </td>
                <td className="color-cell">
                  {card.color_rel?.color && (
                    <span 
                      className="cardcard-tag cardcard-color"
                      style={{
                        backgroundColor: card.color_rel?.hex_color || '#ec4899',
                        color: card.color_rel?.hex_color ? (
                          // Simple luminance calculation: if sum of RGB values > 400, it's light
                          parseInt(card.color_rel.hex_color.slice(1, 3), 16) +
                          parseInt(card.color_rel.hex_color.slice(3, 5), 16) +
                          parseInt(card.color_rel.hex_color.slice(5, 7), 16) > 400
                          ? '#000000' : '#ffffff'
                        ) : '#ffffff'
                      }}
                    >
                      {card.color_rel.color}
                    </span>
                  )}
                </td>
                <td className="photos-cell">
                  <PhotoCountHover 
                    photoCount={card.photo_count}
                    allPhotos={card.all_photos || []}
                  />
                </td>
                <td className="auto-cell">
                  {card.is_autograph && <span className="cardcard-tag cardcard-insert">AUTO</span>}
                </td>
                <td className="relic-cell">
                  {card.is_relic && <span className="cardcard-tag cardcard-relic">RELIC</span>}
                </td>
                <td className="price-cell">
                  {formatCurrency(card.purchase_price)}
                </td>
                <td className="value-cell">
                  {formatCurrency(card.estimated_value)}
                </td>
                <td className="current-value-cell">
                  {formatCurrency(card.current_value)}
                </td>
                <td className="location-cell">
                  {card.location_name && (
                    <span className="collection-table-location-tag">
                      {card.location_name}
                    </span>
                  )}
                </td>
                <td className="added-cell">
                  {formatDateAdded(card.date_added)}
                </td>
                <td className="grade-cell">
                  {card.grade ? (
                    <span className="collection-table-grade-tag">
                      {card.grading_agency_abbr ? 
                        `${card.grading_agency_abbr} ${card.grade}` : 
                        String(card.grade)}
                    </span>
                  ) : ''}
                </td>
                <td className="am-auto-cell">
                  {card.aftermarket_autograph && (
                    <span className="am-auto-indicator">✓</span>
                  )}
                </td>
                <td className="notes-cell">{card.notes}</td>
                <td className="delete-cell">
                  <button
                    className="delete-card-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteCard?.(card)
                    }}
                    title="Delete card from collection"
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="collection-table-footer">
        <div className="collection-table-info">
          Showing {sortedCards.length} of {cards.length} cards
          {searchQuery && ` (filtered by "${searchQuery}")`}
        </div>
        
        {showDownload && (
          <div className="collection-table-actions">
            <button 
              className="collection-table-download-button"
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

export default React.memo(CollectionTable, (prevProps, nextProps) => {
  // Only re-render if these specific props change
  return (
    prevProps.cards === nextProps.cards &&
    prevProps.loading === nextProps.loading &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.viewMode === nextProps.viewMode &&
    prevProps.maxHeight === nextProps.maxHeight
  )
})