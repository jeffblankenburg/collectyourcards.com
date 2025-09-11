import React, { useState, useEffect, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import EditSetModal from '../components/modals/EditSetModal'
import './AdminSetsScoped.css'

function AdminSets() {
  const { year, setSlug, seriesSlug } = useParams()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [sets, setSets] = useState([])
  const [totalSets, setTotalSets] = useState(0)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [sortField, setSortField] = useState('last_viewed')
  const [sortDirection, setSortDirection] = useState('desc')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [editType, setEditType] = useState('') // 'set' or 'series'
  const [editForm, setEditForm] = useState({})
  const [organizations, setOrganizations] = useState([])
  const [manufacturers, setManufacturers] = useState([])
  const [colors, setColors] = useState([])
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false)
  const colorDropdownRef = useRef(null)
  const [saving, setSaving] = useState(false)
  const [parallelsCollapsed, setParallelsCollapsed] = useState(false)
  const [openDropdownSeriesId, setOpenDropdownSeriesId] = useState(null)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 })
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadingImages, setUploadingImages] = useState(false)
  const [selectedFrontImage, setSelectedFrontImage] = useState(null)
  const [selectedBackImage, setSelectedBackImage] = useState(null)
  const [frontImagePreview, setFrontImagePreview] = useState(null)
  const [backImagePreview, setBackImagePreview] = useState(null)
  const [generatingSpreadsheet, setGeneratingSpreadsheet] = useState(false)
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
    document.title = 'Admin Sets - Collect Your Cards'
    loadOrganizations()
    loadManufacturers()
    loadColors()
    // Load with initial search if provided in URL
    loadSets(searchParams.get('search') || '')
  }, [])


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

  // Close color dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (colorDropdownRef.current && !colorDropdownRef.current.contains(event.target)) {
        setColorDropdownOpen(false)
      }
    }

    if (colorDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [colorDropdownOpen])

  const loadSets = async (searchQuery = '') => {
    try {
      setLoading(!searchQuery) // Only show main loading for initial load
      setSearching(!!searchQuery) // Show search loading for searches
      
      const params = new URLSearchParams()
      params.append('limit', '20')
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim())
      }

      const response = await axios.get(`/api/admin/sets?${params.toString()}`)
      setSets(response.data.sets || [])
      setLastUpdated(new Date())
      setIsSearchMode(!!searchQuery.trim())
      
      // Get total count from database if not searching
      if (!searchQuery.trim()) {
        try {
          const countResponse = await axios.get('/api/database/status')
          if (countResponse.data?.records?.sets) {
            setTotalSets(countResponse.data.records.sets)
          }
        } catch (error) {
          console.error('Failed to get total sets count:', error)
        }
      }
      
    } catch (error) {
      console.error('Error loading sets:', error)
      addToast(`Failed to load sets: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setLoading(false)
      setSearching(false)
    }
  }

  const handleSearch = (e) => {
    const value = e.target.value
    setSearchTerm(value)
    
    // Debounce search
    clearTimeout(window.setsSearchTimeout)
    window.setsSearchTimeout = setTimeout(() => {
      loadSets(value)
    }, 300)
  }

  const handleRefresh = () => {
    if (isSearchMode) {
      loadSets(searchTerm)
    } else {
      loadSets()
    }
  }

  const handleSort = (field) => {
    let direction = 'asc'
    if (sortField === field && sortDirection === 'asc') {
      direction = 'desc'
    }
    setSortField(field)
    setSortDirection(direction)
  }

  const getSortedSets = () => {
    return [...sets].sort((a, b) => {
      let aValue, bValue
      
      switch (sortField) {
        case 'set_id':
          aValue = a.set_id
          bValue = b.set_id
          break
        case 'name':
          aValue = (a.name || '').toLowerCase()
          bValue = (b.name || '').toLowerCase()
          break
        case 'year':
          aValue = a.year || 0
          bValue = b.year || 0
          break
        case 'organization':
          aValue = (a.organization || '').toLowerCase()
          bValue = (b.organization || '').toLowerCase()
          break
        case 'manufacturer':
          aValue = (a.manufacturer || '').toLowerCase()
          bValue = (b.manufacturer || '').toLowerCase()
          break
        case 'series_count':
          aValue = a.series_count || 0
          bValue = b.series_count || 0
          break
        case 'card_count':
          aValue = a.card_count || 0
          bValue = b.card_count || 0
          break
        case 'last_viewed':
          aValue = a.last_viewed ? new Date(a.last_viewed) : new Date(0)
          bValue = b.last_viewed ? new Date(b.last_viewed) : new Date(0)
          break
        default:
          return 0
      }

      if (aValue < bValue) {
        return sortDirection === 'asc' ? -1 : 1
      }
      if (aValue > bValue) {
        return sortDirection === 'asc' ? 1 : -1
      }
      return 0
    })
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

  const loadColors = async () => {
    try {
      const response = await axios.get('/api/admin/colors')
      console.log('Loaded colors:', response.data.colors)
      setColors(response.data.colors || [])
    } catch (error) {
      console.error('Error loading colors:', error)
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
      is_complete: set.is_complete || false,
      thumbnail: set.thumbnail || ''
    })
    setSelectedFile(null)
    setShowEditModal(true)
  }

  const handleSetSaveSuccess = () => {
    loadSets()
  }

  const handleEditSeries = (seriesData) => {
    console.log('Editing series data:', seriesData)
    console.log('Series color_id:', seriesData.color_id, 'type:', typeof seriesData.color_id)
    console.log('Series color field:', seriesData.color, 'type:', typeof seriesData.color)
    setEditingItem(seriesData)
    setEditType('series')
    const formData = {
      name: seriesData.name || '',
      card_count: seriesData.card_count || 0,
      card_entered_count: seriesData.card_entered_count || 0,
      is_base: seriesData.is_base || false,
      parallel_of_series: seriesData.parallel_of_series || '',
      color_id: seriesData.color_id || null,
      front_image_path: seriesData.front_image_path || '',
      back_image_path: seriesData.back_image_path || ''
    }
    console.log('Setting form data:', formData)
    setEditForm(formData)
    setSelectedFrontImage(null)
    setSelectedBackImage(null)
    setShowEditModal(true)
  }

  const handleFrontImageSelect = (file) => {
    setSelectedFrontImage(file)
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      setFrontImagePreview(previewUrl)
    } else {
      setFrontImagePreview(null)
    }
  }

  const handleBackImageSelect = (file) => {
    setSelectedBackImage(file)
    if (file) {
      const previewUrl = URL.createObjectURL(file)
      setBackImagePreview(previewUrl)
    } else {
      setBackImagePreview(null)
    }
  }

  const handleCloseModal = () => {
    setShowEditModal(false)
    setEditingItem(null)
    setEditType('')
    setEditForm({})
    setSaving(false)
    setSelectedFile(null)
    setUploadingThumbnail(false)
    setSelectedFrontImage(null)
    setSelectedBackImage(null)
    
    // Clean up preview URLs to prevent memory leaks
    if (frontImagePreview) {
      URL.revokeObjectURL(frontImagePreview)
      setFrontImagePreview(null)
    }
    if (backImagePreview) {
      URL.revokeObjectURL(backImagePreview)
      setBackImagePreview(null)
    }
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

  const handleThumbnailUpload = async (file) => {
    if (!file) return null
    
    try {
      setUploadingThumbnail(true)
      
      const formData = new FormData()
      formData.append('thumbnail', file)
      formData.append('setId', editingItem.set_id)
      
      const response = await axios.post('/api/admin/sets/upload-thumbnail', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      if (response.data.success) {
        addToast('Thumbnail uploaded successfully', 'success')
        return response.data.thumbnailUrl
      } else {
        throw new Error(response.data.message || 'Upload failed')
      }
    } catch (error) {
      console.error('Error uploading thumbnail:', error)
      addToast(`Failed to upload thumbnail: ${error.response?.data?.message || error.message}`, 'error')
      return null
    } finally {
      setUploadingThumbnail(false)
    }
  }

  const handleSeriesImagesUpload = async (frontFile, backFile) => {
    if (!frontFile && !backFile) return { front_image_path: null, back_image_path: null }
    
    try {
      setUploadingImages(true)
      
      const formData = new FormData()
      if (frontFile) {
        formData.append('front_image', frontFile)
      }
      if (backFile) {
        formData.append('back_image', backFile)
      }
      
      const response = await axios.post(`/api/admin/series/upload-images/${editingItem.series_id}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })
      
      if (response.data.success) {
        const uploadMessage = []
        if (frontFile) uploadMessage.push('front image')
        if (backFile) uploadMessage.push('back image')
        addToast(`Series ${uploadMessage.join(' and ')} uploaded successfully`, 'success')
        return {
          front_image_path: response.data.front_image_url || null,
          back_image_path: response.data.back_image_url || null
        }
      } else {
        throw new Error(response.data.message || 'Upload failed')
      }
    } catch (error) {
      console.error('Error uploading series images:', error)
      addToast(`Failed to upload series images: ${error.response?.data?.message || error.message}`, 'error')
      return { front_image_path: null, back_image_path: null }
    } finally {
      setUploadingImages(false)
    }
  }

  const handleSave = async () => {
    if (!editingItem || editType !== 'series') return

    try {
      setSaving(true)
      
      // Handle series editing only (set editing now handled by EditSetModal component)
      // Handle image uploads first if any files were selected
      let imageUploadResults = { front_image_path: null, back_image_path: null }
      if (selectedFrontImage || selectedBackImage) {
        imageUploadResults = await handleSeriesImagesUpload(selectedFrontImage, selectedBackImage)
      }
      
      const updateData = {
        name: editForm.name.trim(),
        set: selectedSet.set_id,
        card_count: parseInt(editForm.card_count) || 0,
        is_base: editForm.is_base,
        parallel_of_series: editForm.parallel_of_series || null,
        color_id: editForm.color_id || null,
        front_image_path: imageUploadResults.front_image_path || editForm.front_image_path?.trim() || null,
        back_image_path: imageUploadResults.back_image_path || editForm.back_image_path?.trim() || null
      }

      await axios.put(`/api/admin/series/${editingItem.series_id}`, updateData)
      
      // Reload series
      await loadSeriesForSet(year, setSlug)

      addToast('Series updated successfully', 'success')
      handleCloseModal()
      
    } catch (error) {
      console.error('Error updating series:', error)
      addToast(`Failed to update series: ${error.response?.data?.message || error.message}`, 'error')
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

  // Generate spreadsheet for current set
  const handleGenerateSpreadsheet = async () => {
    if (!selectedSet || generatingSpreadsheet) return
    
    try {
      setGeneratingSpreadsheet(true)
      addToast('Queueing spreadsheet generation...', 'info')
      
      const response = await axios.post(`/api/spreadsheet-generation/queue/${selectedSet.set_id}`, {
        priority: 10 // High priority for manual requests
      })
      
      if (response.data.queue_id) {
        addToast(`Spreadsheet generation queued for ${selectedSet.name}. Processing will complete in the background.`, 'success')
      } else {
        addToast(response.data.message || 'Spreadsheet generation queued', 'success')
      }
    } catch (error) {
      console.error('Error queueing spreadsheet generation:', error)
      addToast(
        error.response?.data?.message || 'Failed to queue spreadsheet generation', 
        'error'
      )
    } finally {
      setGeneratingSpreadsheet(false)
    }
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
  }, [])

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
          <Icon name="layers" size={32} />
          <h1>{totalSets > 0 ? `${totalSets.toLocaleString()} Sets` : 'Sets'}</h1>
        </div>

        <div className="admin-controls">
          <button
            className="add-set-btn"
            onClick={() => setShowAddModal(true)}
            title="Add new set"
          >
            <Icon name="plus" size={20} />
          </button>
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="Search sets by name, year, organization, manufacturer..."
              value={searchTerm}
              onChange={handleSearch}
            />
            {searching && <div className="card-icon-spinner small"></div>}
          </div>
        </div>
      </div>

      <div className="sets-content">
        {loading ? (
          <div className="loading-state">
            <div className="card-icon-spinner"></div>
            <span>Loading sets...</span>
          </div>
        ) : (
          <>
            <div className="section-header">
              <div className="section-info">
                <h2>
                  {isSearchMode 
                    ? `Search Results (${sets.length})` 
                    : `Most Recently Viewed Sets (${sets.length})`
                  }
                </h2>
              </div>
            </div>

            <div className="sets-table">
              <div className="table-header">
                <div className="col-header center">Actions</div>
                <div 
                  className={`col-header sortable ${sortField === 'set_id' ? 'active' : ''}`}
                  onClick={() => handleSort('set_id')}
                >
                  ID
                  {sortField === 'set_id' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header sortable ${sortField === 'name' ? 'active' : ''}`}
                  onClick={() => handleSort('name')}
                >
                  Set Name
                  {sortField === 'name' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header center sortable ${sortField === 'year' ? 'active' : ''}`}
                  onClick={() => handleSort('year')}
                >
                  Year
                  {sortField === 'year' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header center sortable ${sortField === 'organization' ? 'active' : ''}`}
                  onClick={() => handleSort('organization')}
                >
                  Org
                  {sortField === 'organization' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header center sortable ${sortField === 'manufacturer' ? 'active' : ''}`}
                  onClick={() => handleSort('manufacturer')}
                >
                  Manufacturer
                  {sortField === 'manufacturer' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header center sortable ${sortField === 'series_count' ? 'active' : ''}`}
                  onClick={() => handleSort('series_count')}
                >
                  Series
                  {sortField === 'series_count' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
                <div 
                  className={`col-header center sortable ${sortField === 'card_count' ? 'active' : ''}`}
                  onClick={() => handleSort('card_count')}
                >
                  Cards
                  {sortField === 'card_count' && (
                    <Icon 
                      name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                      size={14} 
                      className="sort-icon" 
                    />
                  )}
                </div>
              </div>
              
              {getSortedSets().map(set => (
                <div 
                  key={set.set_id} 
                  className="set-row"
                  onDoubleClick={() => handleEditSet(set)}
                  title="Double-click to edit set"
                >
                  <div className="col-actions">
                    <button 
                      className="edit-btn"
                      title="Edit set"
                      onClick={() => handleEditSet(set)}
                    >
                      <Icon name="edit" size={16} />
                    </button>
                    <button 
                      className="view-btn"
                      title="View series"
                      onClick={() => navigate(`/admin/series?set=${set.set_id}`)}
                    >
                      <Icon name="layers" size={16} />
                    </button>
                  </div>
                  <div className="col-id">{set.set_id}</div>
                  <div className="col-name">
                    <span className="set-name">{set.name}</span>
                    {set.is_complete && <span className="complete-badge">Complete</span>}
                  </div>
                  <div className="col-year">{set.year}</div>
                  <div className="col-organization">{set.organization}</div>
                  <div className="col-manufacturer">{set.manufacturer}</div>
                  <div className="col-series">{(set.series_count || 0).toLocaleString()}</div>
                  <div className="col-cards">{(set.card_count || 0).toLocaleString()}</div>
                </div>
              ))}

              {sets.length === 0 && (
                <div className="empty-state">
                  <Icon name="search" size={48} />
                  <h3>No sets found</h3>
                  <p>
                    {isSearchMode 
                      ? `No sets match "${searchTerm}". Try a different search term.`
                      : 'No recently viewed sets found. Sets will appear here after users visit their detail pages.'
                    }
                  </p>
                </div>
              )}
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

      {/* Edit Set Modal */}
      {showEditModal && editingItem && editType === 'set' && (
        <EditSetModal
          isOpen={true}
          onClose={handleCloseModal}
          set={editingItem}
          organizations={organizations}
          manufacturers={manufacturers}
          onSaveSuccess={handleSetSaveSuccess}
        />
      )}

      {/* Edit Series Modal */}
      {showEditModal && editingItem && editType === 'series' && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div className="edit-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Series #{editingItem.series_id}</h3>
              <button className="close-btn" onClick={handleCloseModal}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
            <div className="modal-content">
              <div className="edit-form">
                <div className="player-details-form">
                    <div className="form-field-row">
                      <label className="field-label">Name</label>
                      <input
                        type="text"
                        className="field-input"
                        value={editForm.name}
                        onChange={(e) => handleFormChange('name', e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Series name"
                      />
                    </div>

                    <div className="form-field-row">
                      <label className="field-label">Is Base Series</label>
                      <button
                        type="button"
                        className={`hof-toggle ${editForm.is_base ? 'hof-active' : ''}`}
                        onClick={() => handleFormChange('is_base', !editForm.is_base)}
                      >
                        <Icon name="star" size={16} />
                        <span>This is a base series</span>
                        {editForm.is_base && <Icon name="check" size={16} className="hof-check" />}
                      </button>
                    </div>

                    <div className="form-field-row">
                      <label className="field-label">Parallel Of</label>
                      <select
                        className="field-input"
                        value={editForm.parallel_of_series || ''}
                        onChange={(e) => handleFormChange('parallel_of_series', e.target.value || null)}
                        onKeyDown={handleKeyDown}
                      >
                        <option value="">Not a parallel</option>
                        {series.filter(s => !s.parallel_of_series && s.series_id !== editingItem?.series_id).map(s => (
                          <option key={s.series_id} value={s.series_id}>
                            {s.name === selectedSet?.name ? 'Base Set' : getCleanSeriesName(s.name)}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field-row">
                      <label className="field-label">Total Cards</label>
                      <input
                        type="number"
                        className="field-input"
                        value={editForm.card_count}
                        onChange={(e) => handleFormChange('card_count', e.target.value)}
                        onKeyDown={handleKeyDown}
                        min="0"
                      />
                    </div>

                    <div className="form-field-row">
                      <label className="field-label">Entered Cards</label>
                      <input
                        type="text"
                        className="field-input"
                        value={editForm.card_entered_count || 0}
                        disabled
                        style={{ opacity: 0.7 }}
                      />
                    </div>


                    <div className="form-field-row">
                      <label className="field-label">Color</label>
                      <select
                        className="field-input"
                        value={editForm.color_id || ''}
                        onChange={(e) => handleFormChange('color_id', e.target.value || null)}
                        onKeyDown={handleKeyDown}
                      >
                        <option value="">No color</option>
                        {colors.map(color => (
                          <option key={color.color_id} value={color.color_id}>
                            {color.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="form-field-row">
                      <label className="field-label">Front Image</label>
                      <div className="thumbnail-upload" onClick={() => document.getElementById('front-image-upload').click()}>
                        <input
                          type="file"
                          id="front-image-upload"
                          accept="image/*"
                          onChange={(e) => handleFrontImageSelect(e.target.files[0] || null)}
                          style={{ display: 'none' }}
                        />
                        <span className="upload-text">
                          {selectedFrontImage ? selectedFrontImage.name : (editForm.front_image_path ? 'Change front image...' : 'Choose front image...')}
                        </span>
                      </div>
                    </div>

                    <div className="form-field-row">
                      <label className="field-label">Back Image</label>
                      <div className="thumbnail-upload" onClick={() => document.getElementById('back-image-upload').click()}>
                        <input
                          type="file"
                          id="back-image-upload"
                          accept="image/*"
                          onChange={(e) => handleBackImageSelect(e.target.files[0] || null)}
                          style={{ display: 'none' }}
                        />
                        <span className="upload-text">
                          {selectedBackImage ? selectedBackImage.name : (editForm.back_image_path ? 'Change back image...' : 'Choose back image...')}
                        </span>
                      </div>
                    </div>

                    {uploadingImages && (
                      <div className="form-field-row">
                        <span style={{ color: '#fbbf24' }}>Uploading images...</span>
                      </div>
                    )}
                </div>
              </div>
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
                    <div className="card-icon-spinner small"></div>
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