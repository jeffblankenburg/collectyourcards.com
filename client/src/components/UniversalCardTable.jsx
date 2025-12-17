import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import Icon from './Icon'
import AddCardModal from './modals/AddCardModal'
import EditCardModal from './EditCardModal'
import { generateSlug } from '../utils/slugs'
import './UniversalCardTable.css'

const UniversalCardTable = ({
  apiEndpoint = null,
  cards: initialCards = [],
  showPlayer = true,
  showTeam = true,
  showSeries = true,
  showColor = true,
  showAttributes = true,
  showDownload = true,
  columnWidths: customColumnWidths = null,
  defaultSort = null, // Will be determined based on isCollectionView
  downloadFilename = 'cards',
  pageSize = 100,
  onCardClick = null,
  onSeriesClick = null,
  showSearch = false,
  autoFocusSearch = false,
  selectedTeamIds = [],
  clientSideFiltering = false,
  statFilter = null,
  showOwned = true,
  showAddButtons = true,
  isCollectionView = false,
  showGalleryToggle = false,
  showCollectionColumns = false,
  onCollectionDataLoaded = null
}) => {
  const { isAuthenticated } = useAuth()
  const { success, error } = useToast()
  const navigate = useNavigate()
  const [cards, setCards] = useState(initialCards)
  const [sortField, setSortField] = useState(
    defaultSort || (isCollectionView ? 'series_name' : 'sort_order')
  )
  const [sortDirection, setSortDirection] = useState('asc')
  // Removed displayedCards state - using sortedCards directly to prevent re-render loops
  const [loading, setLoading] = useState(false)
  const [totalCardsCount, setTotalCardsCount] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const [viewMode, setViewMode] = useState('table') // 'table' or 'gallery'
  const [userCardCounts, setUserCardCounts] = useState({})
  const [showAddCardModal, setShowAddCardModal] = useState(false)
  const [selectedCard, setSelectedCard] = useState(null)
  const [showEditCardModal, setShowEditCardModal] = useState(false)
  const [editingCard, setEditingCard] = useState(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [cardToDelete, setCardToDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  // Removed infinite scroll state - no longer needed
  const [columnWidths, setColumnWidths] = useState(customColumnWidths || {
    code: '100px',
    edit: '60px',
    favorite: '70px',
    cardNumber: '100px',
    player: '200px',
    series: '300px',
    printRun: '100px',
    color: '120px',
    attributes: '120px',
    purchasePrice: '120px',
    estimatedValue: '120px',
    currentValue: '120px',
    location: '150px',
    grade: '120px',
    amAuto: '80px',
    notes: '200px',
    actions: '60px'
  })
  
  // Update column widths when customColumnWidths prop changes
  useEffect(() => {
    if (customColumnWidths) {
      setColumnWidths(customColumnWidths)
    }
  }, [customColumnWidths])

  // Auto-focus search input when component loads
  useEffect(() => {
    if (autoFocusSearch && searchInputRef.current && showSearch) {
      // Small delay to ensure the component is fully rendered
      setTimeout(() => {
        searchInputRef.current?.focus()
      }, 100)
    }
  }, [autoFocusSearch, showSearch])

  const [isResizing, setIsResizing] = useState(false)
  const [resizeColumn, setResizeColumn] = useState(null)
  const loadingRef = useRef(false)
  const searchInputRef = useRef(null)

  const loadInitialData = useCallback(async () => {
    if (!apiEndpoint) return
    
    // Prevent multiple simultaneous requests
    if (loadingRef.current) {
      return
    }
    
    try {
      loadingRef.current = true
      setLoading(true)
      setCards([]) // Clear existing cards first
      
      const url = new URL(apiEndpoint, window.location.origin)
      url.searchParams.set('limit', '10000') // Load ALL cards
      url.searchParams.set('page', '1')
      
      const response = await axios.get(url.pathname + url.search)
      
      const { cards: newCards, total } = response.data
      
      // No deduplication needed - backend already handles this correctly
      // User collections can have multiple copies of the same card (different user_card_id)
      const cardsData = newCards || []
      
      setCards(cardsData)
      setTotalCardsCount(total || cardsData.length)
      
      // Calculate collection completion for authenticated users
      if (isAuthenticated && onCollectionDataLoaded && cardsData.length > 0) {
        const totalCards = cardsData.length
        const ownedCount = cardsData.filter(card => 
          card.user_card_count && parseInt(card.user_card_count) > 0
        ).length
        
        onCollectionDataLoaded({
          totalCards,
          ownedCount
        })
      }
      
    } catch (error) {
      console.error('Error loading data:', error)
      setCards([])
      setTotalCardsCount(0)
    } finally {
      setLoading(false)
      loadingRef.current = false
    }
  }, [apiEndpoint, isAuthenticated, onCollectionDataLoaded])

  // Load initial data from API endpoint or use provided cards
  useEffect(() => {
    if (apiEndpoint) {
      loadInitialData()
    } else if (initialCards.length > 0) {
      setCards(initialCards)
      setTotalCardsCount(initialCards.length)
    }
  }, [apiEndpoint]) // Removed initialCards dependency to prevent infinite reloads

  // User card counts are now included in the card data from the API
  // No separate loading needed

  const handleAddCard = (card) => {
    setSelectedCard(card)
    setShowAddCardModal(true)
  }

  const handleCardAdded = () => {
    // Refresh the entire table data to get updated user counts
    if (apiEndpoint) {
      loadInitialData()
    }
  }

  const handleEditCard = (card) => {
    setEditingCard(card)
    setShowEditCardModal(true)
  }

  const handleCardUpdated = () => {
    // Refresh the entire table data to get updated information
    if (apiEndpoint) {
      loadInitialData()
    }
  }

  const handleDeleteCard = (card) => {
    setCardToDelete(card)
    setShowDeleteConfirm(true)
  }

  const confirmDeleteCard = async () => {
    if (!cardToDelete) return
    
    try {
      setDeleting(true)
      await axios.delete(`/api/user/cards/${cardToDelete.user_card_id}`)
      
      // Refresh the table data
      if (apiEndpoint) {
        loadInitialData()
      }
      
      // Close the confirmation modal
      setShowDeleteConfirm(false)
      setCardToDelete(null)
    } catch (error) {
      console.error('Error deleting card:', error)
      // You might want to show an error toast here
    } finally {
      setDeleting(false)
    }
  }

  const [shareDropdownCard, setShareDropdownCard] = useState(null)
  const shareDropdownRef = useRef(null)

  // Close share dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (shareDropdownRef.current && !shareDropdownRef.current.contains(event.target)) {
        setShareDropdownCard(null)
      }
    }

    if (shareDropdownCard) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [shareDropdownCard])

  const handleShareCard = (event, card) => {
    event.stopPropagation()
    setShareDropdownCard(shareDropdownCard?.user_card_id === card.user_card_id ? null : card)
  }

  const getCardShareUrl = (card) => {
    const playerNames = card.card_player_teams?.map((cpt, i) => cpt.player?.name).join(', ') || card.player_name || 'unknown'
    const playerSlug = generateSlug(playerNames)
    const seriesSlug = card.series_rel?.slug || card.series_slug || 'unknown'

    return `${window.location.origin}/card/${seriesSlug}/${card.card_number}/${playerSlug}`
  }

  const getCardShareContent = (card) => {
    const playerNames = card.card_player_teams?.map((cpt, i) => cpt.player?.name).join(', ') || card.player_name || 'Unknown Player'
    const cardNumber = card.card_number || 'Unknown'
    const seriesName = card.series_rel?.name || card.series_name || 'Unknown Series'
    
    return {
      title: `Check out my ${seriesName} #${cardNumber} ${playerNames} card!`,
      text: `${seriesName} #${cardNumber} ${playerNames}`,
      hashtags: 'SportCards,CardCollector,CollectYourCards'
    }
  }

  const copyCardLink = async (card) => {
    try {
      const url = getCardShareUrl(card)
      await navigator.clipboard.writeText(url)
      success('Card link copied to clipboard!')
      setShareDropdownCard(null)
    } catch (err) {
      console.error('Failed to copy URL:', err)
      error('Failed to copy link')
    }
  }

  const shareToTwitter = (card) => {
    const url = getCardShareUrl(card)
    const playerNames = card.card_player_teams?.map((cpt, i) => cpt.player?.name).join(', ') || card.player_name || 'Unknown Player'
    const cardNumber = card.card_number || 'Unknown'
    const seriesName = card.series_rel?.name || card.series_name || 'Unknown Series'
    const year = card.series_rel?.set_rel?.year || card.set_year || ''
    
    // Create more engaging tweet content
    const tweetText = `🏀⚾ Check out my ${year} ${seriesName} #${cardNumber} ${playerNames} card! 🔥\n\nWhat do you think of this one? 👀\n\n${url}\n\n#SportCards #CardCollector #${playerNames.replace(/\s+/g, '')} #CollectYourCards`
    
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`
    window.open(twitterUrl, '_blank', 'width=550,height=420')
    setShareDropdownCard(null)
  }

  const shareToFacebook = (card) => {
    const url = getCardShareUrl(card)
    const playerNames = card.card_player_teams?.map((cpt, i) => cpt.player?.name).join(', ') || card.player_name || 'Unknown Player'
    const cardNumber = card.card_number || 'Unknown'
    const seriesName = card.series_rel?.name || card.series_name || 'Unknown Series'
    const year = card.series_rel?.set_rel?.year || card.set_year || ''
    
    // Create Facebook-friendly content
    const facebookQuote = `🏀⚾ Just added this amazing ${year} ${seriesName} #${cardNumber} ${playerNames} card to my collection! 🔥\n\nAny fellow collectors out there? What do you think of this one? 👀\n\n#SportCards #CardCollector #${playerNames.replace(/\s+/g, '')} #CollectYourCards #Collecting`
    
    const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(facebookQuote)}`
    window.open(facebookUrl, '_blank', 'width=550,height=420')
    setShareDropdownCard(null)
  }

  const shareToInstagram = (card) => {
    const url = getCardShareUrl(card)
    const playerNames = card.card_player_teams?.map((cpt, i) => cpt.player?.name).join(', ') || card.player_name || 'Unknown Player'
    const cardNumber = card.card_number || 'Unknown'
    const seriesName = card.series_rel?.name || card.series_name || 'Unknown Series'
    const year = card.series_rel?.set_rel?.year || card.set_year || ''
    
    // Create Instagram-friendly content (shorter, more hashtags)
    const instagramContent = `🏀⚾ ${year} ${seriesName} #${cardNumber} ${playerNames} 🔥\n\n${url}\n\n#SportCards #CardCollector #${playerNames.replace(/\s+/g, '')} #Collecting #Cards #Vintage #Sports #CollectYourCards #CardShow #Investment`
    
    navigator.clipboard.writeText(instagramContent).then(() => {
      success('Caption copied! Now open Instagram and paste in your story or post.')
      window.open('https://www.instagram.com/', '_blank')
    }).catch(err => {
      error('Failed to copy content for Instagram')
    })
    setShareDropdownCard(null)
  }

  const shareToBlueSky = (card) => {
    const url = getCardShareUrl(card)
    const playerNames = card.card_player_teams?.map((cpt, i) => cpt.player?.name).join(', ') || card.player_name || 'Unknown Player'
    const cardNumber = card.card_number || 'Unknown'
    const seriesName = card.series_rel?.name || card.series_name || 'Unknown Series'
    const year = card.series_rel?.set_rel?.year || card.set_year || ''
    
    // Create Blue Sky friendly content
    const blueskyText = `🏀⚾ Check out my ${year} ${seriesName} #${cardNumber} ${playerNames} card!\n\nWhat do you think? Any ${playerNames} fans out there?\n\n${url}\n\n#SportCards #CardCollecting #${playerNames.replace(/\s+/g, '')} #CollectYourCards`
    
    const blueSkyUrl = `https://bsky.app/intent/compose?text=${encodeURIComponent(blueskyText)}`
    window.open(blueSkyUrl, '_blank', 'width=550,height=420')
    setShareDropdownCard(null)
  }

  const handleToggleFavorite = async (card) => {
    if (!isAuthenticated || !isCollectionView) return
    
    try {
      const config = {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
      
      const response = await axios.post(`/api/profile/favorite-cards/${card.user_card_id}`, {}, config)
      
      // Update the card's favorite status locally
      setCards(prevCards => 
        prevCards.map(c => 
          c.user_card_id === card.user_card_id 
            ? { ...c, is_special: response.data.is_favorite }
            : c
        )
      )
      
      success(response.data.message)
      
    } catch (err) {
      console.error('Error toggling favorite:', err)
      if (err.response?.status === 400) {
        error(err.response.data.error)
      } else {
        error('Failed to update favorite status')
      }
    }
  }

  const cancelDelete = () => {
    setShowDeleteConfirm(false)
    setCardToDelete(null)
  }

  const handleCardNumberClick = (card) => {
    // Navigate to card detail page by ID
    if (card.card_id) {
      navigate(`/cards/${card.card_id}`)
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

    // Apply stat filter (for player detail pages)
    if (clientSideFiltering && statFilter) {
      result = result.filter(card => {
        switch (statFilter) {
          case 'rookie':
            return card.is_rookie
          case 'autograph':
            return card.is_autograph
          case 'relic':
            return card.is_relic
          case 'numbered':
            return card.print_run && card.print_run > 0
          default:
            return true
        }
      })
    }
    
    // Then filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      result = result.filter(card => {
        // Search in random code (collection view) - case-insensitive search, but display preserves casing
        if (showCollectionColumns && card.random_code?.toLowerCase().includes(query)) return true
        
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
        if (showCollectionColumns && card.serial_number && String(card.serial_number).includes(query)) return true
        
        // Search in print run
        if (card.print_run && String(card.print_run).includes(query)) return true
        
        // Search in color
        if (card.color_rel?.color?.toLowerCase().includes(query)) return true
        
        // Search in attributes (rookie, autograph, relic)
        if (card.is_rookie && 'rookie'.includes(query)) return true
        if (card.is_rookie && 'rc'.includes(query)) return true
        if (card.is_autograph && 'autograph'.includes(query)) return true
        if (card.is_autograph && 'auto'.includes(query)) return true
        if (card.is_relic && 'relic'.includes(query)) return true
        if (card.is_short_print && 'short print'.includes(query)) return true
        if (card.is_short_print && 'sp'.includes(query)) return true
        
        // Search in collection-specific fields
        if (showCollectionColumns) {
          // Search in purchase price
          if (card.purchase_price && String(card.purchase_price).includes(query)) return true
          
          // Search in estimated value
          if (card.estimated_value && String(card.estimated_value).includes(query)) return true
          
          // Search in current value
          if (card.current_value && String(card.current_value).includes(query)) return true
          
          // Search in location
          if (card.location_name?.toLowerCase().includes(query)) return true
          
          // Search in grade
          if (card.grade && String(card.grade).includes(query)) return true
          
          // Search in grading agency
          if (card.grading_agency_name?.toLowerCase().includes(query)) return true
          if (card.grading_agency_abbr?.toLowerCase().includes(query)) return true
          
          // Search in aftermarket autograph
          if (card.aftermarket_autograph && 'aftermarket'.includes(query)) return true
          if (card.aftermarket_autograph && 'am auto'.includes(query)) return true
        }
        
        // Search in notes
        if (card.notes?.toLowerCase().includes(query)) return true
        
        return false
      })
    }
    
    return result
  }, [cards, searchQuery, selectedTeamIds, showCollectionColumns, clientSideFiltering, statFilter])

  // Helper functions for sorting
  const getPlayerName = useCallback((card) => {
    // First check if player_names is already provided (from simplified API)
    if (card.player_names) {
      return card.player_names
    }
    
    // Fall back to extracting from nested structure
    const playerTeams = card.card_player_teams || []
    if (playerTeams.length === 0) return ''
    
    const players = playerTeams.map(cpt => {
      // Check both possible structures for player data
      const player = cpt.player || cpt.player_team_rel?.player_rel
      if (player) {
        // Handle both name formats
        if (player.name) {
          return player.name
        } else if (player.first_name && player.last_name) {
          return `${player.first_name} ${player.last_name}`
        }
      }
      return ''
    }).filter(name => name)
    
    return players.join(' / ')
  }, [])

  const getTeamName = useCallback((card) => {
    const playerTeams = card.card_player_teams || []
    if (playerTeams.length === 0) return ''
    
    const teams = playerTeams.map(cpt => {
      // Check both possible structures for team data
      const team = cpt.team || cpt.player_team_rel?.team_rel
      return team ? team.name : ''
    }).filter(name => name)
    
    return [...new Set(teams)].join(' / ') // Remove duplicates
  }, [])

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
          aValue = parseInt(a.sort_order) || 999999
          bValue = parseInt(b.sort_order) || 999999
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
        case 'owned_count':
          aValue = a.user_card_count || 0
          bValue = b.user_card_count || 0
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
  }, [filteredCards, sortField, sortDirection, getPlayerName, getTeamName])

  // Removed problematic useEffect that caused infinite re-renders

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
      const dataToExport = sortedCards
      
      // Create headers that exactly match the table columns
      const headers = [
        ...(showCollectionColumns ? ['Code'] : []),
        'Card #',
        ...(showPlayer ? ['Player(s)'] : []),
        ...(showSeries ? ['Series'] : []),
        showCollectionColumns ? 'Serial #' : 'Print Run',
        ...(showColor ? ['Color'] : []),
        ...(showAttributes ? ['Attributes'] : []),
        ...(showCollectionColumns ? [
          'Purchase Price',
          'Estimated Value', 
          'Current Value',
          'Location',
          'Grade',
          'AM Auto'
        ] : []),
        'Notes'
      ]

      const csvData = [
        headers.join(','),
        ...dataToExport.map(card => {
          // Format serial number / print run exactly like the table
          const serialPrintRun = showCollectionColumns ? (
            card.serial_number && card.print_run ? `${card.serial_number}/${card.print_run}` :
            card.serial_number ? card.serial_number :
            card.print_run ? `/${card.print_run}` : ''
          ) : (
            card.print_run ? `/${card.print_run}` : ''
          )
          
          // Format attributes exactly like the table
          const attributes = [
            card.is_rookie ? 'RC' : '',
            card.is_autograph ? 'AUTO' : '',
            card.is_relic ? 'RELIC' : '',
            card.is_short_print ? 'SP' : ''
          ].filter(Boolean).join(' ')
          
          // Format grade exactly like the table
          const grade = card.grade ? (
            card.grading_agency_abbr ? 
              `${card.grading_agency_abbr} ${card.grade}` : 
              String(card.grade)
          ) : ''
          
          const row = [
            ...(showCollectionColumns ? [`"${card.random_code || ''}"`] : []),
            `"${card.card_number || ''}"`,
            ...(showPlayer ? [`"${getPlayerName(card)}"`] : []),
            ...(showSeries ? [`"${card.series_rel?.name || ''}"`] : []),
            `"${serialPrintRun}"`,
            ...(showColor ? [`"${card.color_rel?.color || ''}"`] : []),
            ...(showAttributes ? [`"${attributes}"`] : []),
            ...(showCollectionColumns ? [
              card.purchase_price ? `"${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(card.purchase_price)}"` : '""',
              card.estimated_value ? `"${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(card.estimated_value)}"` : '""',
              card.current_value ? `"${new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(card.current_value)}"` : '""',
              `"${card.location_name || ''}"`,
              `"${grade}"`,
              card.aftermarket_autograph ? '"Yes"' : '"No"'
            ] : []),
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
    } finally {
      setLoading(false)
    }
  }

  const SortIcon = ({ field }) => {
    if (sortField !== field) {
      return null // Don't show any icon for non-sorted columns
    }
    return (
      <Icon 
        name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
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

  // Helper function to get background style for color stripes
  const getColorBackground = (colorName, hexColor) => {
    if (colorName?.toLowerCase() === 'rainbow') {
      return {
        background: 'linear-gradient(90deg, #ff0000, #ff8000, #ffff00, #80ff00, #00ff00, #00ff80, #00ffff, #0080ff, #0000ff, #8000ff, #ff00ff, #ff0080)'
      }
    }
    return {
      backgroundColor: hexColor || '#64748b'
    }
  }


  return (
    <>
      <div className={`universal-card-table ${viewMode === 'gallery' ? 'gallery-view' : ''}`}>
        {/* Search Box and View Toggle */}
        {(showSearch || showGalleryToggle) && (
        <div className="table-controls">
          {showGalleryToggle && (
            <div className="view-toggle">
              <button
                className={`view-toggle-btn ${viewMode === 'table' ? 'active' : ''}`}
                onClick={() => setViewMode('table')}
                title="Table View"
              >
                <Icon name="list" size={18} />
              </button>
              <button
                className={`view-toggle-btn ${viewMode === 'gallery' ? 'active' : ''}`}
                onClick={() => setViewMode('gallery')}
                title="Gallery View"
              >
                <Icon name="grid" size={18} />
              </button>
            </div>
          )}
          {showSearch && (
            <div className="search-container">
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Search this list..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
          )}
        </div>
      )}
      
      {viewMode === 'table' ? (
        <div className="table-container">
          <table className="cards-table">
          <thead>
            <tr>
              {isAuthenticated && isCollectionView && (
                <th className="center action-header" style={{ width: columnWidths.edit }}>
                  Edit
                </th>
              )}
              {isAuthenticated && isCollectionView && (
                <th className="center action-header" style={{ width: columnWidths.favorite }}>
                  <Icon name="star" size={16} title="Favorites" />
                </th>
              )}
              {isAuthenticated && showOwned && (
                <>
                  <th className="center action-header-owned">
                    ACTION
                  </th>
                  <th 
                    className="center owned-header sortable"
                    onClick={() => handleSort('owned_count')}
                  >
                    <div className="header-content">
                      <span>OWNED</span>
                      <Icon 
                        name="chevron-up" 
                        size={14} 
                        className={`sort-icon ${sortField === 'owned_count' ? 'active' : 'neutral'} ${sortField === 'owned_count' && sortDirection === 'desc' ? 'desc' : ''}`}
                      />
                    </div>
                  </th>
                </>
              )}
              {showCollectionColumns && (
                <th 
                  className="sortable resizable-header"
                  onClick={() => handleSort('random_code')}
                  style={{ width: columnWidths.code }}
                >
                  <div className="header-content">
                    Code <SortIcon field="random_code" />
                  </div>
                </th>
              )}
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
              {showSeries && (
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
              )}
              <th 
                className="sortable resizable-header"
                onClick={() => handleSort(showCollectionColumns ? 'serial_number' : 'print_run')}
                style={{ width: columnWidths.printRun }}
              >
                <div className="header-content">
                  {showCollectionColumns ? 'Serial #' : 'Print Run'} <SortIcon field={showCollectionColumns ? 'serial_number' : 'print_run'} />
                </div>
                <div 
                  className={`resize-handle ${isResizing && resizeColumn === 'printRun' ? 'resizing' : ''}`}
                  onMouseDown={(e) => handleResizeStart(e, 'printRun')}
                />
              </th>
              {showColor && (
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
              )}
              {showAttributes && (
                <th className="resizable-header" style={{ width: columnWidths.attributes }}>
                  Attributes
                  <div 
                    className={`resize-handle ${isResizing && resizeColumn === 'attributes' ? 'resizing' : ''}`}
                    onMouseDown={(e) => handleResizeStart(e, 'attributes')}
                  />
                </th>
              )}
              {showCollectionColumns && (
                <>
                  <th 
                    className="sortable resizable-header"
                    onClick={() => handleSort('purchase_price')}
                    style={{ width: columnWidths.purchasePrice }}
                  >
                    <div className="header-content">
                      Purchase $ <SortIcon field="purchase_price" />
                    </div>
                  </th>
                  <th 
                    className="sortable resizable-header"
                    onClick={() => handleSort('estimated_value')}
                    style={{ width: columnWidths.estimatedValue }}
                  >
                    <div className="header-content">
                      $ Value <SortIcon field="estimated_value" />
                    </div>
                  </th>
                  <th 
                    className="sortable resizable-header"
                    onClick={() => handleSort('current_value')}
                    style={{ width: columnWidths.currentValue }}
                  >
                    <div className="header-content">
                      Current Value <SortIcon field="current_value" />
                    </div>
                  </th>
                  <th 
                    className="sortable resizable-header"
                    onClick={() => handleSort('location_name')}
                    style={{ width: columnWidths.location }}
                  >
                    <div className="header-content">
                      Location <SortIcon field="location_name" />
                    </div>
                  </th>
                  <th 
                    className="sortable resizable-header"
                    onClick={() => handleSort('grade')}
                    style={{ width: columnWidths.grade }}
                  >
                    <div className="header-content">
                      Grade <SortIcon field="grade" />
                    </div>
                  </th>
                  <th className="center" style={{ width: columnWidths.amAuto }}>
                    AM Auto
                  </th>
                </>
              )}
              <th className="resizable-header" style={{ width: columnWidths.notes }}>
                Notes
                <div 
                  className={`resize-handle ${isResizing && resizeColumn === 'notes' ? 'resizing' : ''}`}
                  onMouseDown={(e) => handleResizeStart(e, 'notes')}
                />
              </th>
              {isAuthenticated && isCollectionView && (
                <th className="center action-header" style={{ width: columnWidths.actions }}>
                  Delete
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedCards.map(card => {
              const isOwned = isAuthenticated && (card.user_card_count > 0)
              const classNames = [
                onCardClick ? 'clickable' : '',
                (isOwned && !isCollectionView) ? 'owned-card' : ''
              ].filter(Boolean).join(' ')
              
              if (card.card_number === 'CI-1') {
                console.log('Card CI-1 debug:', {
                  isAuthenticated,
                  cardId: card.card_id,
                  userCount: card.user_card_count,
                  isOwned,
                  classNames
                })
              }
              
              return (
              <tr 
                key={showCollectionColumns ? card.user_card_id : card.card_id} 
                className={classNames}
                onClick={() => onCardClick && onCardClick(card)}
              >
                {isAuthenticated && isCollectionView && (
                  <td className="action-cell center">
                    <button
                      className="edit-card-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleEditCard(card)
                      }}
                      title="Edit card details"
                    >
                      <Icon name="edit" size={16} style={{color: 'white'}} />
                    </button>
                  </td>
                )}
                {isAuthenticated && isCollectionView && (
                  <td className="action-cell center">
                    <button
                      className={`favorite-card-btn ${card.is_special ? 'favorited' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleToggleFavorite(card)
                      }}
                      title={card.is_special ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Icon 
                        name="star" 
                        size={16} 
                        style={{
                          color: card.is_special ? '#fbbf24' : 'rgba(255, 255, 255, 0.5)',
                          fill: card.is_special ? '#fbbf24' : 'none'
                        }} 
                      />
                    </button>
                  </td>
                )}
                {isAuthenticated && showOwned && (
                  <>
                    <td className="action-cell center">
                      {showAddButtons && (
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
                      )}
                    </td>
                    <td className="owned-cell center">
                      {card.user_card_count || 0}
                    </td>
                  </>
                )}
                {showCollectionColumns && (
                  <td className="random-code-cell">
                    {card.random_code && (
                      <span className="random-code-label">
                        {card.random_code}
                      </span>
                    )}
                  </td>
                )}
                <td className="card-number-cell clickable-card-number" onClick={() => handleCardNumberClick(card)}>
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
                        {card.is_short_print && <span className="sp-tag">SP</span>}
                      </div>
                    ))}
                  </td>
                )}
                {showSeries && (
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
                )}
                <td className="print-run-cell center">
                  {showCollectionColumns ? (
                    // Show serial number / print run for collection view
                    card.serial_number && card.print_run ? `${card.serial_number}/${card.print_run}` :
                    card.serial_number ? card.serial_number :
                    card.print_run ? `/${card.print_run}` : ''
                  ) : (
                    // Show just print run for other views
                    card.print_run ? `/${card.print_run}` : ''
                  )}
                </td>
                {showColor && (
                  <td className="color-cell">
                    {card.color_rel?.color && (
                      <span 
                        className="color-tag" 
                        style={{ 
                          ...getColorBackground(card.color_rel.color, card.color_rel.hex_color),
                          color: card.color_rel.color?.toLowerCase() === 'rainbow' ? '#000000' : getTextColor(card.color_rel.hex_color)
                        }}
                      >
                        {card.color_rel.color}
                      </span>
                    )}
                  </td>
                )}
                {showAttributes && (
                  <td className="attributes-cell center">
                    <div className="attribute-tags">
                      {card.is_autograph && <span className="auto-tag">AUTO</span>}
                      {card.is_relic && <span className="relic-tag">RELIC</span>}
                      {card.is_short_print && <span className="sp-tag">SP</span>}
                    </div>
                  </td>
                )}
                {showCollectionColumns && (
                  <>
                    <td className="purchase-price-cell center">
                      {card.purchase_price ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD'
                      }).format(card.purchase_price) : ''}
                    </td>
                    <td className="estimated-value-cell center">
                      {card.estimated_value ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD'
                      }).format(card.estimated_value) : ''}
                    </td>
                    <td className="current-value-cell center">
                      {card.current_value ? new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD'
                      }).format(card.current_value) : ''}
                    </td>
                    <td className="location-cell">
                      {card.location_name && (
                        <span className="location-tag-small">
                          {card.location_name}
                        </span>
                      )}
                    </td>
                    <td className="grade-cell center">
                      {card.grade ? (
                        <span className="grade-info">
                          {card.grading_agency_abbr ? 
                            `${card.grading_agency_abbr} ${card.grade}` : 
                            String(card.grade)}
                        </span>
                      ) : ''}
                    </td>
                    <td className="aftermarket-auto-cell center">
                      {card.aftermarket_autograph ? (
                        <span className="aftermarket-auto-indicator">✓</span>
                      ) : ''}
                    </td>
                  </>
                )}
                <td className="notes-cell">
                  {card.notes}
                </td>
                {isAuthenticated && isCollectionView && (
                  <td className="action-cell center">
                    <button
                      className="delete-card-btn"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDeleteCard(card)
                      }}
                      title="Delete card from collection"
                    >
                      <Icon name="trash" size={16} style={{color: '#ef4444'}} />
                    </button>
                  </td>
                )}
              </tr>
              )
            })}
          </tbody>
        </table>

        {sortedCards.length === 0 && !loading && (
          <div className="empty-state">
            <Icon name="search" size={48} />
            <h3>No Cards Found</h3>
            <p>No cards match the current filters.</p>
          </div>
        )}

        {/* Removed loading more indicator - no longer needed */}
        </div>
      ) : (
        <div className="gallery-container">
          <div className="gallery-grid">
            {sortedCards.map((card, index) => (
              <div key={card.user_card_id || card.card_id} className="gallery-card">
                <div className="gallery-card-image">
                  {card.primary_photo_url ? (
                    <img 
                      src={card.primary_photo_url} 
                      alt={`Card ${card.card_number}`}
                      className="card-image"
                    />
                  ) : (
                    <div className="card-placeholder">
                      <Icon name="image" size={32} />
                      <span>No Photo</span>
                    </div>
                  )}
                  {isCollectionView && (
                    <button
                      className="gallery-edit-btn"
                      onClick={() => handleEditCard(card)}
                      title="Edit card"
                    >
                      <Icon name="edit" size={14} />
                    </button>
                  )}
                  {isCollectionView && (
                    <>
                      <button
                        className="gallery-share-btn"
                        onClick={(e) => handleShareCard(e, card)}
                        title="Share this card"
                      >
                        <Icon name="share-2" size={14} />
                      </button>
                      {shareDropdownCard?.user_card_id === card.user_card_id && (
                        <div className="gallery-share-dropdown" ref={shareDropdownRef}>
                          <div className="gallery-share-header">
                            <span>Share this card</span>
                          </div>
                          <button 
                            className="share-dropdown-option"
                            onClick={() => copyCardLink(card)}
                          >
                            <Icon name="link" size={14} />
                            <span>Copy Link</span>
                          </button>
                          <div className="share-dropdown-divider"></div>
                          <button 
                            className="share-dropdown-option twitter"
                            onClick={() => shareToTwitter(card)}
                          >
                            <Icon name="twitter" size={14} />
                            <span>Twitter</span>
                          </button>
                          <button 
                            className="share-dropdown-option facebook"
                            onClick={() => shareToFacebook(card)}
                          >
                            <Icon name="facebook" size={14} />
                            <span>Facebook</span>
                          </button>
                          <button 
                            className="share-dropdown-option instagram"
                            onClick={() => shareToInstagram(card)}
                          >
                            <Icon name="camera" size={14} />
                            <span>Instagram</span>
                          </button>
                          <button 
                            className="share-dropdown-option bluesky"
                            onClick={() => shareToBlueSky(card)}
                          >
                            <Icon name="cloud" size={14} />
                            <span>Blue Sky</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div className="gallery-card-info">
                  <div className="card-number">#{card.card_number}</div>
                  <div className="card-player">
                    {card.card_player_teams?.map((cpt, i) => cpt.player?.name).join(', ') || card.player_name || 'N/A'}
                  </div>
                  <div className="card-series">{card.series_rel?.name || card.series_name}</div>
                  
                  {/* Tags row for random code and grading */}
                  <div className="gallery-tags">
                    {card.random_code && (
                      <div className="gallery-random-code-tag">{card.random_code}</div>
                    )}
                    {card.grading_agency_abbr && card.grade && (
                      <div className="gallery-grade-tag">
                        {card.grading_agency_abbr} {card.grade}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Color stripe at bottom if color or print run exists */}
                {(card.color_rel?.color || card.print_run) && (
                  <div 
                    className="gallery-color-stripe"
                    style={{
                      ...getColorBackground(card.color_rel?.color, card.color_rel?.hex_color)
                    }}
                  >
                    <span className="gallery-color-text" style={{
                      color: card.color_rel?.color?.toLowerCase() === 'rainbow' ? '#000000' : getTextColor(card.color_rel?.hex_color || '#64748b')
                    }}>
                      {[
                        card.color_rel?.color,
                        card.print_run ? (showCollectionColumns && card.serial_number ? `${card.serial_number}/${card.print_run}` : `/${card.print_run}`) : null
                      ].filter(Boolean).join(' ')}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>

          {sortedCards.length === 0 && !loading && (
            <div className="empty-state">
              <Icon name="search" size={48} />
              <h3>No Cards Found</h3>
              <p>No cards match the current filters.</p>
            </div>
          )}
        </div>
      )}

      {/* Table Footer */}
      <div className="table-footer">
        <div className="table-info">
          <span>
            Showing {sortedCards.length} of {totalCardsCount} cards
          </span>
        </div>
        
        {showDownload && (
          <div className="table-actions">
            <button 
              className="action-button primary"
              onClick={handleDownload}
              disabled={loading || sortedCards.length === 0}
            >
              {loading ? (
                <>
                  <div className="card-icon-spinner small"></div>
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
        )}
      </div>
      </div>

      {/* Modals - Use portals to render at document body level to avoid stacking context issues */}
      {showAddCardModal && createPortal(
        <AddCardModal
          isOpen={showAddCardModal}
          onClose={() => setShowAddCardModal(false)}
          card={selectedCard}
          onCardAdded={handleCardAdded}
        />,
        document.body
      )}
      
      {showEditCardModal && createPortal(
        <EditCardModal
          isOpen={showEditCardModal}
          onClose={() => setShowEditCardModal(false)}
          card={editingCard}
          onCardUpdated={handleCardUpdated}
        />,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && createPortal(
        <div className="modal-overlay" onClick={cancelDelete}>
          <div className="delete-confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Card from Collection</h3>
              <button className="modal-close" onClick={cancelDelete}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="warning-icon">
                <Icon name="warning" size={48} style={{color: '#ef4444'}} />
              </div>
              
              <div className="delete-message">
                <h4>Are you sure you want to delete this card?</h4>
                <div className="card-details">
                  {cardToDelete && (
                    <>
                      <p><strong>Card:</strong> {cardToDelete.card_number}</p>
                      <p><strong>Series:</strong> {cardToDelete.series_rel?.name}</p>
                      {cardToDelete.card_player_teams?.[0] && (
                        <p><strong>Player:</strong> {cardToDelete.card_player_teams[0].player?.name}</p>
                      )}
                      {cardToDelete.random_code && (
                        <p><strong>Code:</strong> {cardToDelete.random_code}</p>
                      )}
                    </>
                  )}
                </div>
                <p className="warning-text">This action cannot be undone.</p>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="btn-cancel" onClick={cancelDelete}>
                Cancel
              </button>
              <button 
                className="btn-delete" 
                onClick={confirmDeleteCard}
                disabled={deleting}
              >
                {deleting ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Icon name="trash" size={16} />
                    Delete Card
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

export default UniversalCardTable