import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminSets.css' // Use the same CSS as AdminSets
import './PublicSets.css' // Additional styles for public version

function PublicSets() {
  const { year, setSlug, seriesSlug } = useParams()
  const navigate = useNavigate()
  const [years, setYears] = useState([])
  const [filteredYears, setFilteredYears] = useState([])
  const [sets, setSets] = useState([])
  const [filteredSets, setFilteredSets] = useState([])
  const [series, setSeries] = useState([])
  const [filteredSeries, setFilteredSeries] = useState([])
  const [selectedSet, setSelectedSet] = useState(null)
  const [selectedSeries, setSelectedSeries] = useState(null)
  const [loading, setLoading] = useState(false)
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
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
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
        // Only show series that are not parallels (parallel_of_series is null)
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
    }
  }, [years, sets, series, searchTerm, year, setSlug, seriesSlug, parallelsCollapsed])

  const loadYears = async () => {
    try {
      setLoading(true)
      // Use the existing sets-list endpoint to extract years
      const response = await axios.get('/api/sets-list')
      const setsData = response.data.sets || []
      
      // Group sets by year and count series
      const yearStats = {}
      setsData.forEach(set => {
        const setYear = set.year || parseInt(set.name.split(' ')[0])
        if (setYear && setYear >= 1900 && setYear <= new Date().getFullYear() + 10) {
          if (!yearStats[setYear]) {
            yearStats[setYear] = { year: setYear, setCount: 0, seriesCount: 0 }
          }
          yearStats[setYear].setCount += 1
          yearStats[setYear].seriesCount += set.series_count || 0
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
        setSeries(seriesData)
        setFilteredSeries(seriesData)
      }
    } catch (error) {
      console.error('Error loading series:', error)
      addToast(`Failed to load series: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
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
  const getParallelCount = (parentSeriesId) => {
    return series.filter(s => s.parallel_of_series === parentSeriesId).length
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
    return series.filter(s => s.parallel_of_series === parentSeriesId)
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
      <div className="admin-header">
        <div className="admin-title">
          {(year || setSlug || seriesSlug) && (
            <Link 
              to={seriesSlug ? `/sets/${year}/${setSlug}` : setSlug ? `/sets/${year}` : '/sets'} 
              className="back-button"
              title="Go back"
            >
              <Icon name="arrow-left" size={24} />
            </Link>
          )}
          <Icon name="layers" size={32} />
          <h1>
            {seriesSlug && selectedSeries ? selectedSeries.name :
             setSlug && selectedSet ? selectedSet.name : 
             year ? `${year} Sets` : 
             'Sets & Series'}
          </h1>
        </div>
        
        <div className="header-controls">
          {setSlug && selectedSet && (
            <button 
              className="collapse-parallels-btn"
              onClick={() => setParallelsCollapsed(!parallelsCollapsed)}
            >
              <Icon name={parallelsCollapsed ? "eye" : "eye-off"} size={16} />
              {parallelsCollapsed ? "Show Parallels" : "Collapse Parallels"}
            </button>
          )}
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder={
                setSlug ? "Search series..." :
                year ? "Search sets..." : 
                "Search years..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

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
              <div className="years-grid">
                {filteredYears.map(y => (
                  <Link 
                    key={y.year} 
                    to={`/sets/${y.year}`}
                    className="year-card"
                  >
                    <div className="year-number">{y.year}</div>
                    <div className="year-stats">
                      <div className="year-stat-box">
                        <div className="year-stat-number">{y.setCount}</div>
                        <div className="year-stat-label">SETS</div>
                      </div>
                      <div className="year-stat-box">
                        <div className="year-stat-number">{y.seriesCount}</div>
                        <div className="year-stat-label">SERIES</div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Sets Grid */}
            {year && !setSlug && (
              <div className="sets-list">
                <div className="sets-grid">
                  {filteredSets.map(set => (
                    <div 
                      key={set.set_id} 
                      className="set-card"
                      onClick={() => navigate(`/sets/${year}/${set.slug}`)}
                      title="Click to view series"
                    >
                      <div className="set-card-body">
                        <div className="set-thumbnail">
                          {set.thumbnail ? (
                            <img src={set.thumbnail} alt={`${set.name} thumbnail`} />
                          ) : (
                            <Icon name="series" size={20} />
                          )}
                        </div>
                        <div className="set-main">
                        <div className="set-header">
                          <div className="set-title-row">
                            <div className="set-name">{set.name}</div>
                            {set.is_complete && <span className="complete-badge">Complete</span>}
                          </div>
                        </div>
                        <div className="set-content">
                          <div className="set-stats">
                            <div className="set-stat-box">
                              <div className="set-stat-number">{set.series_count || 0}</div>
                              <div className="set-stat-label">SERIES</div>
                            </div>
                            <div className="set-stat-box">
                              <div className="set-stat-number">{set.total_card_count || set.card_count || 0}</div>
                              <div className="set-stat-label">CARDS</div>
                            </div>
                          </div>
                          <div className="set-tags">
                            {set.manufacturer_name && (
                              <div className="set-manufacturer">
                                <span className="manufacturer-tag">{set.manufacturer_name}</span>
                              </div>
                            )}
                            {set.organization && (
                              <div className="set-organization">
                                <span className="org-abbreviation">{set.organization}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Series Grid */}
            {setSlug && selectedSet && (
              <div className="series-list">
                <div className="series-grid">
                  {filteredSeries.map(s => (
                    <div 
                      key={s.series_id} 
                      className="series-card-container"
                    >
                      <div 
                        className="series-card"
                        onClick={(e) => {
                          // Don't navigate if clicking on parallels box
                          if (!e.target.closest('.parallels-box-wrapper')) {
                            navigate(`/series/${generateSlug(s.name)}`)
                          }
                        }}
                        title="Click to view cards"
                      >
                      <div className="series-content">
                        <div className="series-header">
                          <div className="series-name">
                            {s.name === selectedSet?.name ? 'Base Set' : getCleanSeriesName(s.name)}
                          </div>
                          <div className="series-badges">
                          </div>
                        </div>
                        
                        <div className="series-info">
                          {/* Parallel info moved to bottom stripe */}
                        </div>
                        
                        <div className="series-stats">
                          <div className="series-stat-box">
                            <div className="series-stat-number">{s.card_count || 0}</div>
                            <div className="series-stat-label">CARDS</div>
                          </div>
                          <div className="series-stat-box">
                            <div className="series-stat-number">{s.rookie_count || 0}</div>
                            <div className="series-stat-label">ROOKIES</div>
                          </div>
                          {getParallelCount(s.series_id) > 0 && (
                            // Show parallel count for parent series
                            <div className="parallels-box-wrapper">
                              <div 
                                className="series-stat-box clickable-stat-box"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleParallelsClick(s, e)
                                }}
                                title="Click to view parallels"
                              >
                                <div className="series-stat-number">{getParallelCount(s.series_id)}</div>
                                <div className="series-stat-label">PARALLELS</div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Bottom parallel stripe - always show for alignment */}
                      <div 
                        className={`series-parallel-stripe ${s.parent_series_name ? 'has-content' : 'empty'}`}
                        title={s.parent_series_name ? `Parallel of: ${s.parent_series_name}` : undefined}
                      >
                        {s.parent_series_name && (getCleanParallelName(s.parent_series_name).trim() || 'BASE').toUpperCase()}
                      </div>
                      {/* Right color stripe - only show when color data exists */}
                      {s.color_hex_value && (
                        <div 
                          className="series-color-stripe-right"
                          style={{ 
                            backgroundColor: s.color_hex_value,
                            color: isLightColor(s.color_hex_value) ? '#000000' : '#ffffff',
                            textShadow: isLightColor(s.color_hex_value) 
                              ? '0 1px 1px rgba(255, 255, 255, 0.8)' 
                              : '0 1px 1px rgba(0, 0, 0, 0.8)'
                          }}
                        >
                          {(() => {
                            const colorName = s.color_name || ''
                            const printRun = s.print_run_display || (s.min_print_run && s.max_print_run ? `${s.min_print_run}-${s.max_print_run}` : '')
                            const displayText = [colorName, printRun].filter(Boolean).join(' ')
                            return displayText
                          })()}
                        </div>
                      )}
                      </div>
                    </div>
                  ))}
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