import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import { SeriesCard } from '../components/cards'
import CommentsSection from '../components/CommentsSection'
import ActivityFeed from '../components/ActivityFeed'
import { createLogger } from '../utils/logger'
import './SeriesPageScoped.css'

const log = createLogger('SeriesPage')

function SeriesPage() {
  const { year, setId } = useParams()
  const navigate = useNavigate()
  const { addToast } = useToast()
  const { user } = useAuth()

  log.info('SeriesPage mounted', { year, setId })
  
  const [series, setSeries] = useState([])
  const [filteredSeries, setFilteredSeries] = useState([])
  const [selectedSet, setSelectedSet] = useState(null)
  const [loading, setLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [spreadsheetStatus, setSpreadsheetStatus] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [parallelsCollapsed, setParallelsCollapsed] = useState(false)
  const [openDropdownSeriesId, setOpenDropdownSeriesId] = useState(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  
  const dropdownRef = useRef(null)
  const activeParallelsBoxRef = useRef(null)
  const currentDropdownIdRef = useRef(null)

  // Check if user is admin
  const isAdmin = user && ['admin', 'superadmin', 'data_admin'].includes(user.role)

  // Helper function to generate URL slug (matching backend)
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/'/g, '') // Remove apostrophes completely
      .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  useEffect(() => {
    if (setId && year) {
      loadSetById(setId)
      loadSeriesForSet(setId)
    }
  }, [year, setId])

  // Set page title when set loads
  useEffect(() => {
    if (selectedSet?.name) {
      document.title = `${selectedSet.name} Series - Collect Your Cards`
    } else {
      document.title = 'Series - Collect Your Cards'
    }
  }, [selectedSet?.name])

  // Keep ref synchronized with state
  useEffect(() => {
    currentDropdownIdRef.current = openDropdownSeriesId
  }, [openDropdownSeriesId])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Don't close if clicking on a parallels box
      if (event.target.closest('.parallels-box-wrapper')) {
        return
      }
      
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        currentDropdownIdRef.current = null
        setOpenDropdownSeriesId(null)
        activeParallelsBoxRef.current = null
      }
    }

    if (openDropdownSeriesId) {
      // Add a small delay to ensure the dropdown has rendered
      setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside)
      }, 10)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [openDropdownSeriesId])

  // Add scroll listener to update dropdown position
  useEffect(() => {
    const handleScroll = () => {
      if (openDropdownSeriesId) {
        updateDropdownPosition()
      }
    }

    if (openDropdownSeriesId) {
      window.addEventListener('scroll', handleScroll)
      window.addEventListener('resize', handleScroll)
    }

    return () => {
      window.removeEventListener('scroll', handleScroll)
      window.removeEventListener('resize', handleScroll)
    }
  }, [openDropdownSeriesId])

  useEffect(() => {
    // Filter series with parallel collapse logic
    let seriesToFilter = series
    
    if (parallelsCollapsed) {
      // Only show series that are not parallels
      // A series is a parallel if it has a parent (parallel_of_series)
      seriesToFilter = series.filter(s => !s.parallel_of_series)
    }
    
    if (!searchTerm.trim()) {
      setFilteredSeries(seriesToFilter)
    } else {
      const filtered = seriesToFilter.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (s.color_name && s.color_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.print_run_display && s.print_run_display.toLowerCase().includes(searchTerm.toLowerCase()))
      )
      setFilteredSeries(filtered)
    }
  }, [series, searchTerm, parallelsCollapsed])

  const loadSetById = async (setIdParam) => {
    try {
      const response = await axios.get('/api/sets-list')
      const allSets = response.data.sets || []

      // Find the set by ID
      const foundSet = allSets.find(set => set.set_id === parseInt(setIdParam))

      if (foundSet) {
        setSelectedSet(foundSet)
        // Check spreadsheet availability
        checkSpreadsheetStatus(foundSet.set_id)
      }
    } catch (error) {
      console.error('Error loading set:', error)
    }
  }

  const loadSeriesForSet = async (setIdParam) => {
    try {
      setLoading(true)

      // Get series for this set directly by ID
      const response = await axios.get(`/api/series-by-set/${setIdParam}`)
      const seriesData = response.data.series || []

      // Sort series: alphabetically by name, but "coming soon" (no cards) at the end
      const sortedSeries = [...seriesData].sort((a, b) => {
        const aHasCards = (a.card_count || 0) > 0
        const bHasCards = (b.card_count || 0) > 0

        // If one has cards and one doesn't, the one with cards comes first
        if (aHasCards && !bHasCards) return -1
        if (!aHasCards && bHasCards) return 1

        // Both have cards or both don't - sort alphabetically
        const nameA = a.name || ''
        const nameB = b.name || ''
        return nameA.localeCompare(nameB)
      })

      setSeries(sortedSeries)
      setFilteredSeries(sortedSeries)
    } catch (error) {
      console.error('Error loading series:', error)
      addToast(`Failed to load series: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  // Check spreadsheet availability status
  const checkSpreadsheetStatus = async (setId) => {
    try {
      const response = await axios.get(`/api/spreadsheet-generation/status/${setId}`)
      setSpreadsheetStatus(response.data)
    } catch (error) {
      console.error('Error checking spreadsheet status:', error)
      setSpreadsheetStatus(null)
    }
  }

  // Download master set spreadsheet from blob storage
  const downloadMasterSetSpreadsheet = () => {
    if (!spreadsheetStatus?.blob_url) {
      addToast('Spreadsheet is not available for download', 'error')
      return
    }
    
    // Direct download from blob storage
    window.open(spreadsheetStatus.blob_url, '_blank')
    addToast('Download started', 'success')
  }

  // Helper functions for parallel handling
  const getParallelCount = (targetSeries) => {
    // Count how many series in this set are parallels of the target series
    // A parallel has the same base name structure but different color/variant
    if (!targetSeries.name) return 0
    
    // If this series is itself a parallel, don't count parallels for it
    if (targetSeries.parallel_of_series || targetSeries.color_name) return 0
    
    // Count series that could be parallels of this base series
    return series.filter(s => {
      // Skip itself
      if (s.series_id === targetSeries.series_id) return false
      
      // Must be marked as a parallel
      if (!s.parallel_of_series) return false
      
      // Must have a parent name that matches this series
      return s.parent_series_name === targetSeries.name
    }).length
  }

  const handleParallelsClick = useCallback((parentSeries, event) => {
    event.stopPropagation()
    
    // Capture element info immediately
    const targetElement = event.currentTarget
    const rect = targetElement.getBoundingClientRect()
    
    // Simple approach: just toggle between null and the series ID
    setOpenDropdownSeriesId(currentId => {
      if (currentId === parentSeries.series_id) {
        // Close
        activeParallelsBoxRef.current = null
        return null
      } else {
        // Open
        activeParallelsBoxRef.current = targetElement
        setDropdownPosition({
          top: rect.bottom + 8,
          left: rect.left
        })
        return parentSeries.series_id
      }
    })
  }, [openDropdownSeriesId])

  const getParallelsForSeries = (parentSeriesId) => {
    return series.filter(s => s.parent_series_id === parentSeriesId)
  }

  // Function to update dropdown position based on current parallels box position
  const updateDropdownPosition = () => {
    if (activeParallelsBoxRef.current) {
      const rect = activeParallelsBoxRef.current.getBoundingClientRect()
      setDropdownPosition({
        top: rect.bottom + 8, // Fixed position - no scroll offset needed
        left: rect.left
      })
    }
  }

  // Function to remove set name from series name
  const getCleanSeriesName = (seriesName) => {
    if (!seriesName || !selectedSet) return seriesName
    
    // Remove the set name from the beginning of the series name
    const setName = selectedSet.name
    if (seriesName.startsWith(setName)) {
      return seriesName.substring(setName.length).trim()
    }
    
    return seriesName
  }

  return (
    <div className="series-page">
      <div className="content-area">
        {loading ? (
          <div className="loading-state">
            <div className="card-icon-spinner"></div>
            <span>Loading...</span>
          </div>
        ) : selectedSet && (
          <>
            {/* Set Detail Header */}
            <div className="set-detail-header">
              <div className="set-header-content">
                <div className="set-title-section">
                  <div className="set-title-line">
                    <Link 
                      to={`/sets/${year}`}
                      className="back-button"
                      title="Go back to year"
                    >
                      <Icon name="arrow-left" size={24} />
                    </Link>
                    <Icon name="layers" size={32} />
                    <h1 className="set-name">{selectedSet.name}</h1>
                  </div>
                  
                </div>
                
                {/* Set Statistics & Actions */}
                <div className="set-stats-and-actions">
                  <div className="set-stats">
                    <div className="stat-box">
                      <span className="stat-number">{selectedSet.series_count || 0}</span>
                      <span className="stat-label">Series</span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-number">{selectedSet.total_card_count?.toLocaleString() || 0}</span>
                      <span className="stat-label">Cards</span>
                    </div>
                  </div>
                  
                  
                  {/* Set Actions */}
                  <div className="set-actions">
                  {spreadsheetStatus?.blob_url && (
                    <button
                      className="action-button primary"
                      onClick={() => downloadMasterSetSpreadsheet()}
                      title={`Download complete set spreadsheet (${spreadsheetStatus.format?.toUpperCase() || 'XLSX'}, ${Math.round(spreadsheetStatus.file_size / 1024)}KB)`}
                    >
                      <Icon name="import" size={16} />
                      Download Complete Checklist
                    </button>
                  )}
                </div>
              </div>
              </div>
            </div>
            
            {/* Series List */}
            <div className="series-list">
              <div className="series-grid-unified">
                {/* Search Box and Controls as Grid Item - spans last two columns */}
                <div className="grid-search-box">
                  <button 
                    className="collapse-parallels-btn"
                    onClick={() => setParallelsCollapsed(!parallelsCollapsed)}
                  >
                    <Icon name={parallelsCollapsed ? "eye" : "eye-off"} size={16} />
                    {parallelsCollapsed ? "Show Parallels" : "Collapse Parallels"}
                  </button>
                  <div className="search-box">
                    <Icon name="search" size={20} />
                    <input
                      type="text"
                      placeholder="Search series..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                {/* Force new row after search */}
                <div className="grid-row-break"></div>
              {/* Series cards */}
              {filteredSeries.map(s => {
                const parallelCount = getParallelCount(s)
                return (
                  <SeriesCard
                    key={s.series_id}
                    hideSetName={true}
                    series={{
                      series_id: s.series_id,
                      name: s.name === selectedSet?.name ? 'Base Set' : getCleanSeriesName(s.name),
                      full_name: s.name,  // Pass the full name for the modal
                      set_name: selectedSet?.name,
                      card_count: s.card_count || 0,
                      rc_count: s.rookie_count || 0,
                      color_name: s.color_name,
                      color_hex: s.color_hex_value,
                      print_run_display: s.print_run_display || (s.min_print_run && s.max_print_run ? `${s.min_print_run}-${s.max_print_run}` : ''),
                      parallel_of: (s.color_name && s.color_hex_value) || s.parallel_of_series ? true : false,
                      parallel_parent_name: s.parent_series_name,
                      parallel_count: parallelCount,
                      // Completion data - only present if user is authenticated
                      is_complete: s.is_complete || false,
                      completion_percentage: s.completion_percentage || 0,
                      owned_cards: s.owned_cards || 0
                    }}
                  />
                )
              })}
              {filteredSeries.length === 0 && series.length > 0 && (
                <div className="empty-state">
                  <Icon name="search" size={48} />
                  <p>No series found matching "{searchTerm}"</p>
                </div>
              )}
            </div>
            </div>
          </>
        )}
      </div>

      {/* Parallels Dropdown Portal */}
      {openDropdownSeriesId && createPortal(
        <div 
          className="parallels-dropdown-menu" 
          ref={dropdownRef}
          style={{
            position: 'fixed',
            top: dropdownPosition.top,
            left: dropdownPosition.left,
            zIndex: 9999
          }}
        >
          {getParallelsForSeries(openDropdownSeriesId).map(parallel => (
            <div
              key={parallel.series_id}
              className="parallel-item-compact"
              onClick={(e) => {
                e.stopPropagation()
                // Navigate to series by ID
                navigate(`/series/${parallel.series_id}`)
                setOpenDropdownSeriesId(null)
                activeParallelsBoxRef.current = null
              }}
              title="Click to view cards"
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
        </div>,
        document.body
      )}

      {/* Social Section - Discussion and Activity Feed Side by Side */}
      {selectedSet && (
        <div className="social-section">
          <CommentsSection
            itemType="set"
            itemId={selectedSet.set_id}
            title="Discussion"
          />
          <ActivityFeed
            setId={selectedSet.set_id}
            title="Recent Activity"
          />
        </div>
      )}

      {/* Admin Edit Button */}
      {isAdmin && selectedSet && (
        <button 
          className="admin-edit-button"
          onClick={() => navigate(`/admin/sets?search=${encodeURIComponent(selectedSet.name)}`)}
          title="Edit set (Admin)"
        >
          <Icon name="edit" size={20} />
        </button>
      )}
    </div>
  )
}

export default SeriesPage