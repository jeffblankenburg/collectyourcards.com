import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import { useAuth } from '../contexts/AuthContext'
import Icon from '../components/Icon'
import { YearCard, SetCard, SeriesCard } from '../components/cards'
import './AdminSets.css' // Use the same CSS as AdminSets
import './PublicSets.css' // Additional styles for public version

function PublicSets() {
  const { year, setSlug, seriesSlug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [years, setYears] = useState([])
  const [filteredYears, setFilteredYears] = useState([])
  const [sets, setSets] = useState([])
  const [filteredSets, setFilteredSets] = useState([])
  const [series, setSeries] = useState([])
  const [filteredSeries, setFilteredSeries] = useState([])
  const [selectedSet, setSelectedSet] = useState(null)
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [loading, setLoading] = useState(false)
  const [downloadLoading, setDownloadLoading] = useState(false)
  const [spreadsheetStatus, setSpreadsheetStatus] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [parallelsCollapsed, setParallelsCollapsed] = useState(false)
  const [openDropdownSeriesId, setOpenDropdownSeriesId] = useState(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const { addToast } = useToast()
  const dropdownRef = useRef(null)
  const activeParallelsBoxRef = useRef(null)
  const currentDropdownIdRef = useRef(null)

  // Helper function to generate URL slug (matching backend)
  const generateSlug = (name) => {
    return name
      .toLowerCase()
      .replace(/'/g, '') // Remove apostrophes completely
      .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
      .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
  }

  useEffect(() => {
    // Load data based on URL parameters
    if (setSlug) {
      // We're viewing series for a specific set
      loadSetBySlug(year, setSlug)
      loadSeriesForSet(year, setSlug)
    } else if (year) {
      // We're viewing sets for a specific year
      loadSetsForYear(year)
    } else {
      // We're viewing the years list
      loadYears()
    }
  }, [year, setSlug, seriesSlug])

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
    // Filter based on current view and search term
    if (!year && !setSlug) {
      // Filter years
      if (!searchTerm.trim()) {
        setFilteredYears(years)
      } else {
        const filtered = years.filter(y => 
          y.year.toString().includes(searchTerm)
        )
        setFilteredYears(filtered)
      }
    } else if (year && !setSlug) {
      // Filter sets
      if (!searchTerm.trim()) {
        setFilteredSets(sets)
      } else {
        const filtered = sets.filter(set => 
          set.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          (set.organization && set.organization.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (set.manufacturer && set.manufacturer.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        setFilteredSets(filtered)
      }
    } else if (setSlug && !seriesSlug) {
      // Filter series with parallel collapse logic
      let seriesToFilter = series
      
      if (parallelsCollapsed) {
        // Only show series that are not parallels
        // A series is considered a parallel if it has color info OR a parent series
        seriesToFilter = series.filter(s => 
          !s.color_name && 
          !s.color_hex_value && 
          !s.parent_series_id
        )
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
    }
  }, [years, sets, series, searchTerm, year, setSlug, seriesSlug, parallelsCollapsed])

  const loadYears = async () => {
    try {
      setLoading(true)
      // Use the existing sets-list endpoint to extract years
      const response = await axios.get('/api/sets-list')
      const setsData = response.data.sets || []
      
      // Group sets by year and count series and cards
      const yearStats = {}
      setsData.forEach(set => {
        const setYear = set.year || parseInt(set.name.split(' ')[0])
        if (setYear && setYear >= 1900 && setYear <= new Date().getFullYear() + 10) {
          if (!yearStats[setYear]) {
            yearStats[setYear] = { year: setYear, setCount: 0, seriesCount: 0, cardCount: 0 }
          }
          yearStats[setYear].setCount += 1
          yearStats[setYear].seriesCount += set.series_count || 0
          yearStats[setYear].cardCount += set.total_card_count || set.card_count || 0
        }
      })
      
      const yearsData = Object.values(yearStats).sort((a, b) => b.year - a.year)
      setYears(yearsData)
      setFilteredYears(yearsData)
    } catch (error) {
      console.error('Error loading years:', error)
      addToast(`Failed to load years: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadSetsForYear = async (yearParam) => {
    try {
      setLoading(true)
      const response = await axios.get('/api/sets-list')
      const allSets = response.data.sets || []
      
      // Filter sets by year
      const yearSets = allSets.filter(set => {
        const setYear = set.year || parseInt(set.name.split(' ')[0])
        return setYear === parseInt(yearParam)
      })
      
      // Add slug to each set
      const setsWithSlugs = yearSets.map(set => ({
        ...set,
        slug: generateSlug(set.name)
      }))
      
      setSets(setsWithSlugs)
      setFilteredSets(setsWithSlugs)
    } catch (error) {
      console.error('Error loading sets:', error)
      addToast(`Failed to load sets: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadSetBySlug = async (yearParam, setSlugParam) => {
    try {
      const response = await axios.get('/api/sets-list')
      const allSets = response.data.sets || []
      
      // Find the set by year and slug
      const foundSet = allSets.find(set => {
        const setYear = set.year || parseInt(set.name.split(' ')[0])
        const slug = generateSlug(set.name)
        return setYear === parseInt(yearParam) && slug === setSlugParam
      })
      
      if (foundSet) {
        setSelectedSet(foundSet)
        // Check spreadsheet availability
        checkSpreadsheetStatus(foundSet.set_id)
      }
    } catch (error) {
      console.error('Error loading set:', error)
    }
  }

  const loadSeriesForSet = async (yearParam, setSlugParam) => {
    try {
      setLoading(true)
      
      // First get the set ID
      const setsResponse = await axios.get('/api/sets-list')
      const allSets = setsResponse.data.sets || []
      const foundSet = allSets.find(set => {
        const setYear = set.year || parseInt(set.name.split(' ')[0])
        const slug = generateSlug(set.name)
        return setYear === parseInt(yearParam) && slug === setSlugParam
      })
      
      if (foundSet) {
        // Now get series for this set
        const response = await axios.get(`/api/series-by-set/${foundSet.set_id}`)
        const seriesData = response.data.series || []
        
        // Sort series alphabetically by name
        const sortedSeries = [...seriesData].sort((a, b) => {
          const nameA = a.name || ''
          const nameB = b.name || ''
          return nameA.localeCompare(nameB)
        })
        
        setSeries(sortedSeries)
        setFilteredSeries(sortedSeries)
      }
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

  // Function to determine if a color is light or dark
  const isLightColor = (hex) => {
    if (!hex) return false
    
    // Remove # if present
    const color = hex.replace('#', '')
    
    // Convert to RGB
    const r = parseInt(color.substr(0, 2), 16)
    const g = parseInt(color.substr(2, 2), 16)
    const b = parseInt(color.substr(4, 2), 16)
    
    // Calculate luminance using standard formula
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    
    // Return true if light (luminance > 0.5)
    return luminance > 0.5
  }

  // Function to calculate completion percentage
  const getCompletionPercentage = (cardCount, cardEnteredCount) => {
    if (!cardCount || cardCount === 0) return 0
    return Math.round((cardEnteredCount / cardCount) * 100)
  }

  // Helper functions for parallel handling
  const getParallelCount = (seriesId) => {
    // Count how many series have this series as their parent
    return series.filter(s => s.parent_series_id === seriesId).length
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

  // Function to get completion status color
  const getCompletionColor = (percentage) => {
    return percentage >= 100 ? '#10b981' : '#ef4444' // green for 100%, red for everything else
  }

  // Function to remove set name from parallel series name
  const getCleanParallelName = (parallelName) => {
    if (!parallelName || !selectedSet) return parallelName
    
    // Remove the set name from the beginning of the parallel name
    const setName = selectedSet.name
    if (parallelName.startsWith(setName)) {
      return parallelName.substring(setName.length).trim()
    }
    
    return parallelName
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
    <div className="admin-sets-page">
      <div className="content-area">
        {loading ? (
          <div className="loading-state">
            <Icon name="activity" size={24} className="spinning" />
            <span>Loading...</span>
          </div>
        ) : (
          <>
            {/* Years Grid */}
            {!year && !setSlug && (
              <div className="years-grid-unified">
                {/* Header as grid items */}
                <div className="grid-header-title">
                  <Icon name="layers" size={32} />
                  <h1>Sets & Series</h1>
                </div>
                <div className="grid-header-search">
                  <div className="search-box">
                    <Icon name="search" size={20} />
                    <input
                      type="text"
                      placeholder="Search years..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      autoFocus
                    />
                  </div>
                </div>
                {/* Force new row after header */}
                <div className="grid-row-break"></div>
                {/* Year cards */}
                {filteredYears.map(y => (
                  <YearCard 
                    key={y.year}
                    year={{
                      year: y.year,
                      card_count: y.cardCount, // Total cards across all sets in this year
                      set_count: y.setCount
                    }}
                  />
                ))}
              </div>
            )}

            {/* Sets Grid */}
            {year && !setSlug && (
              <div className="sets-list">
                <div className="sets-grid-unified">
                  {/* Header as grid items */}
                  <div className="grid-header-title-with-back">
                    <Link 
                      to="/sets" 
                      className="back-button"
                      title="Go back"
                    >
                      <Icon name="arrow-left" size={24} />
                    </Link>
                    <Icon name="layers" size={32} />
                    <h1>{year} Sets</h1>
                  </div>
                  <div className="grid-header-search-sets">
                    <div className="search-box">
                      <Icon name="search" size={20} />
                      <input
                        type="text"
                        placeholder="Search sets..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        autoFocus
                      />
                    </div>
                  </div>
                  {/* Force new row after header */}
                  <div className="grid-row-break"></div>
                  {/* Set cards */}
                  {filteredSets.map(set => (
                    <SetCard 
                      key={set.set_id}
                      set={{
                        name: set.name,
                        year: set.year || parseInt(year),
                        card_count: set.total_card_count || set.card_count || 0,
                        series_count: set.series_count || 0,
                        manufacturer: set.manufacturer_name,
                        organization: set.organization,
                        thumbnail: set.thumbnail,
                        slug: set.slug
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Series Grid */}
            {setSlug && selectedSet && (
              <div className="series-list">
                <div className="series-grid-unified">
                  {/* Header as grid items */}
                  <div className="grid-header-title-with-back">
                    <Link 
                      to={`/sets/${year}`}
                      className="back-button"
                      title="Go back"
                    >
                      <Icon name="arrow-left" size={24} />
                    </Link>
                    <Icon name="layers" size={32} />
                    <h1>{selectedSet.name}</h1>
                  </div>
                  <div className="grid-header-controls">
                    {spreadsheetStatus?.blob_url && (
                      <button 
                        className="action-button primary"
                        onClick={() => downloadMasterSetSpreadsheet()}
                        title={`Download complete set spreadsheet (${spreadsheetStatus.format?.toUpperCase() || 'XLSX'}, ${Math.round(spreadsheetStatus.file_size / 1024)}KB)`}
                      >
                        <Icon name="import" size={16} />
                        Download Master Set
                      </button>
                    )}
                  </div>
                  <div className="grid-header-search-series">
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
                  {/* Force new row after header */}
                  <div className="grid-row-break"></div>
                  {/* Series cards */}
                  {filteredSeries.map(s => {
                    const parallelCount = getParallelCount(s.series_id)
                    return (
                      <SeriesCard 
                        key={s.series_id}
                        series={{
                          name: s.name === selectedSet?.name ? 'Base Set' : getCleanSeriesName(s.name),
                          set_name: selectedSet?.name,
                          card_count: s.card_count || 0,
                          rc_count: s.rookie_count || 0,
                          color_name: s.color_name,
                          color_hex: s.color_hex_value,
                          print_run_display: s.print_run_display || (s.min_print_run && s.max_print_run ? `${s.min_print_run}-${s.max_print_run}` : ''),
                          parallel_of: (s.color_name && s.color_hex_value) || s.parent_series_id ? true : false,
                          parallel_parent_name: s.parent_series_name,
                          parallel_count: parallelCount,
                          slug: generateSlug(s.name),
                          set_slug: setSlug,
                          year: year
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
            )}

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
                navigate(`/series/${generateSlug(parallel.name)}`)
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
    </div>
  )
}

export default PublicSets