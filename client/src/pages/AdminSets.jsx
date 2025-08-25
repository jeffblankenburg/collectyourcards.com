import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import './AdminSets.css'

function AdminSets() {
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
  const [showEditModal, setShowEditModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editType, setEditType] = useState('') // 'set' or 'series'
  const [editForm, setEditForm] = useState({})
  const [organizations, setOrganizations] = useState([])
  const [manufacturers, setManufacturers] = useState([])
  const [saving, setSaving] = useState(false)
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
    loadOrganizations()
    loadManufacturers()
    
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
          (s.primary_color_name && s.primary_color_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
          (s.print_run_display && s.print_run_display.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        setFilteredSeries(filtered)
      }
    }
    // Note: seriesSlug case handled by navigation redirect
  }, [years, sets, series, searchTerm, year, setSlug, seriesSlug, parallelsCollapsed])

  const loadYears = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/admin/sets/years')
      setYears(response.data.years || [])
      setFilteredYears(response.data.years || [])
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
      const response = await axios.get(`/api/admin/sets/by-year/${yearParam}`)
      const setsData = response.data.sets || []
      setSets(setsData)
      setFilteredSets(setsData)
    } catch (error) {
      console.error('Error loading sets:', error)
      addToast(`Failed to load sets: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadSetBySlug = async (yearParam, setSlugParam) => {
    try {
      // We need to get set details for the breadcrumb
      const response = await axios.get(`/api/admin/sets/by-year/${yearParam}`)
      const allSets = response.data.sets || []
      const foundSet = allSets.find(s => s.slug === setSlugParam)
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
      const response = await axios.get(`/api/admin/series/by-set/${yearParam}/${setSlugParam}`)
      const seriesData = response.data.series || []
      setSeries(seriesData)
      setFilteredSeries(seriesData)
    } catch (error) {
      console.error('Error loading series:', error)
      addToast(`Failed to load series: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  const loadSeriesBySlug = async (yearParam, setSlugParam, seriesSlugParam) => {
    try {
      // Find the series from the set's series list
      const response = await axios.get(`/api/admin/series/by-set/${yearParam}/${setSlugParam}`)
      const allSeries = response.data.series || []
      const foundSeries = allSeries.find(s => generateSlug(s.name) === seriesSlugParam)
      if (foundSeries) {
        setSelectedSeries(foundSeries)
      }
    } catch (error) {
      console.error('Error loading series:', error)
    }
  }


  const loadOrganizations = async () => {
    try {
      const response = await axios.get('/api/admin/organizations')
      setOrganizations(response.data.organizations || [])
    } catch (error) {
      console.error('Error loading organizations:', error)
    }
  }

  const loadManufacturers = async () => {
    try {
      const response = await axios.get('/api/admin/manufacturers')
      setManufacturers(response.data.manufacturers || [])
    } catch (error) {
      console.error('Error loading manufacturers:', error)
    }
  }


  // Navigation is now handled by React Router, no need for click handlers

  const handleEditSet = (set) => {
    setEditingItem(set)
    setEditType('set')
    setEditForm({
      name: set.name || '',
      year: set.year || '',
      organization: set.organization_id || '',
      manufacturer: set.manufacturer_id || '',
      is_complete: set.is_complete || false
    })
    setShowEditModal(true)
  }

  const handleEditSeries = (seriesData) => {
    setEditingItem(seriesData)
    setEditType('series')
    setEditForm({
      name: seriesData.name || '',
      card_count: seriesData.card_count || 0,
      card_entered_count: seriesData.card_entered_count || 0,
      is_base: seriesData.is_base || false,
      parallel_of_series: seriesData.parallel_of_series || '',
      min_print_run: seriesData.min_print_run || '',
      max_print_run: seriesData.max_print_run || '',
      print_run_display: seriesData.print_run_display || '',
      primary_color_name: seriesData.primary_color_name || '',
      primary_color_hex: seriesData.primary_color_hex || '',
      photo_url: seriesData.photo_url || '',
      front_image_path: seriesData.front_image_path || '',
      back_image_path: seriesData.back_image_path || ''
    })
    setShowEditModal(true)
  }

  const handleCloseModal = () => {
    setShowEditModal(false)
    setEditingItem(null)
    setEditType('')
    setEditForm({})
    setSaving(false)
  }

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !saving) {
      e.preventDefault()
      handleSave()
    }
  }

  const handleSave = async () => {
    if (!editingItem) return

    try {
      setSaving(true)
      
      if (editType === 'set') {
        const updateData = {
          name: editForm.name.trim(),
          year: parseInt(editForm.year) || null,
          organization: editForm.organization || null,
          manufacturer: editForm.manufacturer || null,
          is_complete: editForm.is_complete
        }

        await axios.put(`/api/admin/sets/${editingItem.set_id}`, updateData)
        
        // Reload sets
        await loadSetsForYear(year)
        
      } else if (editType === 'series') {
        const updateData = {
          name: editForm.name.trim(),
          set: selectedSet.set_id,
          card_count: parseInt(editForm.card_count) || 0,
          card_entered_count: parseInt(editForm.card_entered_count) || 0,
          is_base: editForm.is_base,
          parallel_of_series: editForm.parallel_of_series || null,
          min_print_run: editForm.min_print_run ? parseInt(editForm.min_print_run) : null,
          max_print_run: editForm.max_print_run ? parseInt(editForm.max_print_run) : null,
          print_run_display: editForm.print_run_display.trim(),
          primary_color_name: editForm.primary_color_name.trim(),
          primary_color_hex: editForm.primary_color_hex.trim(),
          photo_url: editForm.photo_url.trim(),
          front_image_path: editForm.front_image_path.trim(),
          back_image_path: editForm.back_image_path.trim()
        }

        await axios.put(`/api/admin/series/${editingItem.series_id}`, updateData)
        
        // Reload series
        await loadSeriesForSet(year, setSlug)
      }

      addToast(`${editType === 'set' ? 'Set' : 'Series'} updated successfully`, 'success')
      handleCloseModal()
      
    } catch (error) {
      console.error(`Error updating ${editType}:`, error)
      addToast(`Failed to update ${editType}: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const getColorPreview = (color) => {
    if (!color) return null
    return (
      <div 
        className="color-preview" 
        style={{ backgroundColor: color }}
        title={color}
      />
    )
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


  return (
    <div className="admin-sets-page">
      <div className="admin-header">
        <div className="admin-title">
          {(year || setSlug || seriesSlug) && (
            <Link 
              to={seriesSlug ? `/admin/sets/${year}/${setSlug}` : setSlug ? `/admin/sets/${year}` : '/admin/sets'} 
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
             'Sets & Series Administration'}
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
                    to={`/admin/sets/${y.year}`}
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
                      onClick={() => navigate(`/admin/sets/${year}/${set.slug}`)}
                      onDoubleClick={(e) => { e.stopPropagation(); handleEditSet(set); }}
                      title="Click to view series, double-click to edit"
                    >
                      <div className="set-id-stripe">SET_ID: {set.set_id}</div>
                      <div className="set-header">
                        <div className="set-title-row">
                          <div className="set-name">{set.name}</div>
                          {set.is_complete && <span className="complete-badge">Complete</span>}
                        </div>
                        <button 
                          className="edit-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditSet(set)
                          }}
                          title="Edit set"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      </div>
                      <div className="set-content">
                        <div className="set-stats">
                          <div className="set-stat-box">
                            <div className="set-stat-number">{set.series_count || 0}</div>
                            <div className="set-stat-label">SERIES</div>
                          </div>
                          <div className="set-stat-box">
                            <div className="set-stat-number">{set.card_count || 0}</div>
                            <div className="set-stat-label">CARDS</div>
                          </div>
                        </div>
                        <div className="set-tags">
                          {set.manufacturer && (
                            <div className="set-manufacturer">
                              <span className="manufacturer-tag">{set.manufacturer}</span>
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
                            navigate(`/admin/cards/${year}/${setSlug}/${generateSlug(s.name)}`)
                          }
                        }}
                        title="Click to view cards"
                      >
                      {/* Top stripe for database ID */}
                      <div className="series-id-stripe">SERIES_ID: {s.series_id}</div>
                      <div className="series-content">
                        <div className="series-header">
                          <div className="series-name">{s.name}</div>
                          <div className="series-badges">
                            {s.is_base && <span className="base-badge">BASE</span>}
                            <button 
                              className="edit-btn"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleEditSeries(s)
                              }}
                              title="Edit series"
                            >
                              <Icon name="edit" size={14} />
                            </button>
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
                          {/* Always show completion percentage */}
                          <div 
                            className="series-stat-box"
                            style={{
                              backgroundColor: getCompletionPercentage(s.card_count, s.card_entered_count) < 100 
                                ? 'rgba(239, 68, 68, 0.2)' 
                                : 'rgba(255, 255, 255, 0.1)',
                              borderColor: getCompletionPercentage(s.card_count, s.card_entered_count) < 100 
                                ? 'rgba(239, 68, 68, 0.4)' 
                                : 'rgba(255, 255, 255, 0.2)'
                            }}
                          >
                            <div 
                              className="series-stat-number"
                              style={{
                                color: getCompletionColor(getCompletionPercentage(s.card_count, s.card_entered_count))
                              }}
                            >
                              {getCompletionPercentage(s.card_count, s.card_entered_count)}%
                            </div>
                            <div className="series-stat-label">COMPLETE</div>
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
                        className="series-parallel-stripe"
                        title={s.parallel_of_name ? `Parallel of series ID: ${s.parallel_of_series}` : undefined}
                      >
                        {s.parallel_of_name && getCleanParallelName(s.parallel_of_name).toUpperCase()}
                      </div>
                      {/* Right color stripe - only show when color data exists */}
                      {s.primary_color_hex && (
                        <div 
                          className="series-color-stripe-right"
                          style={{ 
                            backgroundColor: s.primary_color_hex,
                            color: isLightColor(s.primary_color_hex) ? '#000000' : '#ffffff',
                            textShadow: isLightColor(s.primary_color_hex) 
                              ? '0 1px 1px rgba(255, 255, 255, 0.8)' 
                              : '0 1px 1px rgba(0, 0, 0, 0.8)'
                          }}
                        >
                          {(() => {
                            const colorName = s.primary_color_name || ''
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
                navigate(`/admin/cards/${year}/${setSlug}/${generateSlug(parallel.name)}`)
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
              {parallel.primary_color_hex && (
                <div 
                  className="parallel-color-stripe"
                  style={{ backgroundColor: parallel.primary_color_hex }}
                  title={parallel.primary_color_name}
                />
              )}
            </div>
          ))}
        </div>,
        document.body
      )}

      {/* Edit Modal */}
      {showEditModal && editingItem && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit {editType === 'set' ? 'Set' : 'Series'}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <form className="edit-form" onSubmit={(e) => e.preventDefault()}>
                
                {editType === 'set' ? (
                  <>
                    <div className="form-section">
                      <div className="form-row">
                        <label className="form-label">ID</label>
                        <span className="form-value">{editingItem.set_id}</span>
                      </div>

                      <div className="form-row">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.name}
                          onChange={(e) => handleFormChange('name', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Set name"
                        />
                      </div>

                      <div className="form-row">
                        <label className="form-label">Year</label>
                        <input
                          type="number"
                          className="form-input"
                          value={editForm.year}
                          onChange={(e) => handleFormChange('year', e.target.value)}
                          onKeyDown={handleKeyDown}
                          min="1900"
                          max="2100"
                        />
                      </div>

                      <div className="form-row">
                        <label className="form-label">Organization</label>
                        <select
                          className="form-input"
                          value={editForm.organization}
                          onChange={(e) => handleFormChange('organization', e.target.value)}
                          onKeyDown={handleKeyDown}
                        >
                          <option value="">Select organization...</option>
                          {organizations.map(org => (
                            <option key={org.organization_id} value={org.organization_id}>
                              {org.name} ({org.abbreviation})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-row">
                        <label className="form-label">Manufacturer</label>
                        <select
                          className="form-input"
                          value={editForm.manufacturer}
                          onChange={(e) => handleFormChange('manufacturer', e.target.value)}
                          onKeyDown={handleKeyDown}
                        >
                          <option value="">Select manufacturer...</option>
                          {manufacturers.map(mfg => (
                            <option key={mfg.manufacturer_id} value={mfg.manufacturer_id}>
                              {mfg.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-row">
                        <label className="form-label">Complete</label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={editForm.is_complete}
                            onChange={(e) => handleFormChange('is_complete', e.target.checked)}
                          />
                          <span>Set is complete</span>
                        </label>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-section">
                      <div className="form-row">
                        <label className="form-label">ID</label>
                        <span className="form-value">{editingItem.series_id}</span>
                      </div>

                      <div className="form-row">
                        <label className="form-label">Name</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.name}
                          onChange={(e) => handleFormChange('name', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Series name"
                        />
                      </div>

                      <div className="form-row">
                        <label className="form-label">Is Base Series</label>
                        <label className="checkbox-label">
                          <input
                            type="checkbox"
                            checked={editForm.is_base}
                            onChange={(e) => handleFormChange('is_base', e.target.checked)}
                          />
                          <span>This is a base series</span>
                        </label>
                      </div>

                      <div className="form-row">
                        <label className="form-label">Parallel Of</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.parallel_of_series}
                          onChange={(e) => handleFormChange('parallel_of_series', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Series ID if this is a parallel"
                        />
                      </div>
                    </div>

                    <div className="form-section">
                      <h4>Card Counts</h4>
                      
                      <div className="form-row">
                        <label className="form-label">Total Cards</label>
                        <input
                          type="number"
                          className="form-input"
                          value={editForm.card_count}
                          onChange={(e) => handleFormChange('card_count', e.target.value)}
                          onKeyDown={handleKeyDown}
                          min="0"
                        />
                      </div>

                      <div className="form-row">
                        <label className="form-label">Cards Entered</label>
                        <input
                          type="number"
                          className="form-input"
                          value={editForm.card_entered_count}
                          onChange={(e) => handleFormChange('card_entered_count', e.target.value)}
                          onKeyDown={handleKeyDown}
                          min="0"
                        />
                      </div>
                    </div>

                    <div className="form-section">
                      <h4>Print Run</h4>
                      
                      <div className="form-row">
                        <label className="form-label">Min Print Run</label>
                        <input
                          type="number"
                          className="form-input"
                          value={editForm.min_print_run}
                          onChange={(e) => handleFormChange('min_print_run', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Minimum print run"
                          min="0"
                        />
                      </div>

                      <div className="form-row">
                        <label className="form-label">Max Print Run</label>
                        <input
                          type="number"
                          className="form-input"
                          value={editForm.max_print_run}
                          onChange={(e) => handleFormChange('max_print_run', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Maximum print run"
                          min="0"
                        />
                      </div>

                      <div className="form-row">
                        <label className="form-label">Display Text</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.print_run_display}
                          onChange={(e) => handleFormChange('print_run_display', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="e.g., /99, 1 of 1"
                        />
                      </div>
                    </div>

                    <div className="form-section">
                      <h4>Color</h4>
                      
                      <div className="form-row">
                        <label className="form-label">Color Name</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.primary_color_name}
                          onChange={(e) => handleFormChange('primary_color_name', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="e.g., Gold, Silver"
                        />
                      </div>

                      <div className="form-row">
                        <label className="form-label">Color Hex</label>
                        <div className="color-field">
                          <div 
                            className="color-preview" 
                            style={{ backgroundColor: editForm.primary_color_hex }}
                            onClick={() => document.getElementById('color-picker').click()}
                            title="Primary color"
                          />
                          <input
                            id="color-picker"
                            type="color"
                            style={{ display: 'none' }}
                            value={editForm.primary_color_hex || '#000000'}
                            onChange={(e) => handleFormChange('primary_color_hex', e.target.value)}
                          />
                          <input
                            type="text"
                            className="color-text-input"
                            value={editForm.primary_color_hex || ''}
                            onChange={(e) => handleFormChange('primary_color_hex', e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="#000000"
                            maxLength={7}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="form-section">
                      <h4>Images</h4>
                      
                      <div className="form-row">
                        <label className="form-label">Photo URL</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.photo_url}
                          onChange={(e) => handleFormChange('photo_url', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Photo URL"
                        />
                      </div>

                      <div className="form-row">
                        <label className="form-label">Front Image</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.front_image_path}
                          onChange={(e) => handleFormChange('front_image_path', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Front image path"
                        />
                      </div>

                      <div className="form-row">
                        <label className="form-label">Back Image</label>
                        <input
                          type="text"
                          className="form-input"
                          value={editForm.back_image_path}
                          onChange={(e) => handleFormChange('back_image_path', e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder="Back image path"
                        />
                      </div>
                    </div>
                  </>
                )}
                
              </form>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={handleCloseModal} disabled={saving}>
                Cancel
              </button>
              <button 
                className="save-btn" 
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <Icon name="activity" size={16} className="spinning" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon name="check" size={16} />
                    Save Changes
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminSets