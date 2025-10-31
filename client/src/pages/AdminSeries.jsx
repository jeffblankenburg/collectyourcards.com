import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import Icon from '../components/Icon'
import SearchableDropdown from '../components/SearchableDropdown'
import './AdminSeriesScoped.css'

function AdminSeries() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const setId = searchParams.get('set')
  const [series, setSeries] = useState([])
  const [totalSeries, setTotalSeries] = useState(0)
  const [setInfo, setSetInfo] = useState(null)
  const [loading, setLoading] = useState(true)
  const [searching, setSearching] = useState(false)
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [isSearchMode, setIsSearchMode] = useState(false)
  const [sortField, setSortField] = useState('name')
  const [sortDirection, setSortDirection] = useState('asc')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDuplicateModal, setShowDuplicateModal] = useState(false)
  const [editingSeries, setEditingSeries] = useState(null)
  const [duplicatingSeries, setDuplicatingSeries] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [addForm, setAddForm] = useState({
    name: '',
    is_base: false,
    color: '',
    card_count: '',
    card_entered_count: '',
    rookie_count: '',
    print_run_display: '',
    production_code: '',
    set_id: '',
    parallel_of_series: ''
  })
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [duplicating, setDuplicating] = useState(false)
  const [availableSets, setAvailableSets] = useState([])
  const [availableSeries, setAvailableSeries] = useState([])
  const [seriesForSet, setSeriesForSet] = useState([])
  const [availableColors, setAvailableColors] = useState([])
  const [duplicateForm, setDuplicateForm] = useState({
    name: '',
    color_id: '',
    print_run: ''
  })
  const [colorDropdownOpen, setColorDropdownOpen] = useState(false)
  const [colorSearchTerm, setColorSearchTerm] = useState('')
  const [highlightedColorIndex, setHighlightedColorIndex] = useState(-1)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingSeries, setDeletingSeries] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const { addToast } = useToast()
  const searchTimeoutRef = useRef(null)

  // Memoized color tag component to prevent forced reflow
  const ColorTag = useCallback(({ colorName, colorHex }) => {
    if (!colorName) return null
    
    // Pre-calculate text color to avoid multiple DOM reflows
    const backgroundColor = colorHex || '#ec4899'
    const textColor = useMemo(() => {
      if (!colorHex) return '#ffffff'
      
      const r = parseInt(colorHex.slice(1, 3), 16)
      const g = parseInt(colorHex.slice(3, 5), 16) 
      const b = parseInt(colorHex.slice(5, 7), 16)
      const brightness = (r * 0.299 + g * 0.587 + b * 0.114)
      
      return brightness > 128 ? '#000000' : '#ffffff'
    }, [colorHex])
    
    return (
      <span 
        className="color-tag"
        style={{
          backgroundColor,
          color: textColor
        }}
      >
        {colorName}
      </span>
    )
  }, [])

  // Memoized series row component to prevent unnecessary re-renders
  const SeriesRow = React.memo(({ seriesItem, onEdit, onDuplicate, onViewCards, onUpload }) => {
    return (
      <div 
        className="series-row"
        onDoubleClick={() => onEdit(seriesItem)}
        title="Double-click to edit series"
      >
        <div className="col-actions">
          <button 
            className="edit-btn"
            title="Edit series"
            onClick={() => onEdit(seriesItem)}
          >
            <Icon name="edit" size={16} />
          </button>
          <button 
            className="duplicate-btn"
            title="Duplicate as parallel"
            onClick={() => onDuplicate(seriesItem)}
          >
            <Icon name="shuffle" size={16} />
          </button>
          <button 
            className="upload-btn"
            title="Upload cards to this series"
            onClick={() => onUpload(seriesItem)}
          >
            <Icon name="upload" size={16} />
          </button>
          <button 
            className="view-btn"
            title="View cards"
            onClick={() => onViewCards(seriesItem)}
          >
            <Icon name="grid" size={16} />
          </button>
        </div>
        <div className="col-id">{seriesItem.series_id}</div>
        <div className="col-name">
          {seriesItem.name}
          {seriesItem.parallel_of_name && seriesItem.parallel_of_name.trim() && (
            <span className="parallel-badge" style={{ marginLeft: '0.5rem' }}>{seriesItem.parallel_of_name}</span>
          )}
        </div>
        <div className="col-base center">
          {seriesItem.is_base && <Icon name="check" size={16} className="base-icon" />}
        </div>
        <div className="col-color center">
          <ColorTag 
            colorName={seriesItem.color_name}
            colorHex={seriesItem.color_hex}
          />
        </div>
        <div className="col-cards center">
          {(seriesItem.card_count || 0).toLocaleString()}
        </div>
        <div className="col-entered center">
          {(seriesItem.card_entered_count || 0).toLocaleString()}
        </div>
        <div className="col-rookies center">
          {(seriesItem.rookie_count || 0).toLocaleString()}
        </div>
        <div className="col-print-run center">
          {seriesItem.print_run_display ||
           (seriesItem.min_print_run && seriesItem.max_print_run
             ? `${seriesItem.min_print_run}-${seriesItem.max_print_run}`
             : seriesItem.max_print_run || '-')}
        </div>
        <div className="col-production-code center">
          {seriesItem.production_code || '-'}
        </div>
      </div>
    )
  })

  // Load series on mount or when search changes
  useEffect(() => {
    // Load with initial search if provided in URL
    loadSeries(searchParams.get('search') || '')
  }, [setId])

  const loadSeries = useCallback(async (search = '') => {
    const loadStartTime = performance.now()
    
    try {
      setSearching(true)
      
      const params = {}
      
      if (search) {
        params.search = search
        setIsSearchMode(true)
      } else {
        setIsSearchMode(false)
      }
      
      if (setId) {
        params.set = setId
      }
      
      const response = await axios.get('/api/admin/series', { params })
      
      if (response.data) {
        setSeries(response.data.series || [])
        setSetInfo(response.data.setInfo || null)
      }
      
      // Get total count from database if not searching and not filtering by set
      if (!search && !setId) {
        try {
          const countResponse = await axios.get('/api/database/status')
          if (countResponse.data?.records?.series) {
            setTotalSeries(countResponse.data.records.series)
          }
        } catch (error) {
          console.error('Failed to get total series count:', error)
        }
      } else {
        // Clear total count when searching or filtering
        setTotalSeries(0)
      }
      
      const loadTime = performance.now() - loadStartTime
      if (loadTime > 500) {
        console.log(`AdminSeries: Loading series took ${loadTime.toFixed(2)}ms`)
      }
      
    } catch (error) {
      console.error('Error loading series:', error)
      addToast('Failed to load series', 'error')
      setSeries([])
    } finally {
      setSearching(false)
      setLoading(false)
    }
  }, [setId, addToast])

  // Memoized search change handler to prevent recreation
  const handleSearchChange = useCallback((e) => {
    const value = e.target.value
    setSearchTerm(value)
    
    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }
    
    // Set new timeout for debounced search
    searchTimeoutRef.current = setTimeout(() => {
      loadSeries(value)
    }, 300)
  }, [])

  // Memoized sort handler to prevent recreation
  const handleSort = useCallback((field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }, [sortField, sortDirection])

  // Memoized sorting to prevent recalculation on every render
  const sortedSeries = useMemo(() => {
    const startTime = performance.now()
    
    const sorted = [...series].sort((a, b) => {
      let aVal = a[sortField]
      let bVal = b[sortField]
      
      // Handle null/undefined values
      if (aVal === null || aVal === undefined) aVal = ''
      if (bVal === null || bVal === undefined) bVal = ''
      
      // Handle numeric fields
      if (['card_count', 'card_entered_count', 'rookie_count', 'min_print_run', 'max_print_run', 'series_id'].includes(sortField)) {
        aVal = Number(aVal) || 0
        bVal = Number(bVal) || 0
      }
      
      // Handle string comparison
      if (typeof aVal === 'string') {
        aVal = aVal.toLowerCase()
        bVal = bVal.toLowerCase()
      }
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1
      return 0
    })
    
    const sortTime = performance.now() - startTime
    if (sortTime > 50) {
      console.log(`AdminSeries: Sorting ${series.length} series took ${sortTime.toFixed(2)}ms`)
    }
    
    return sorted
  }, [series, sortField, sortDirection])

  const loadSets = useCallback(async () => {
    try {
      // Request ALL sets for the dropdown
      const response = await axios.get('/api/admin/sets', { params: { all: 'true' } })
      const sets = response.data.sets || []
      setAvailableSets(sets)
    } catch (error) {
      console.error('Error loading sets:', error)
      addToast('Failed to load sets', 'error')
    }
  }, [addToast])

  const loadColors = useCallback(async () => {
    try {
      const response = await axios.get('/api/admin/series/colors')
      setAvailableColors(response.data.colors || [])
    } catch (error) {
      console.error('Error loading colors:', error)
      setAvailableColors([])
    }
  }, [])

  // Load sets and colors on mount so they're always available for dropdowns
  useEffect(() => {
    loadSets()
    loadColors()
  }, [loadSets, loadColors])

  const loadSeriesForSet = useCallback(async (setId) => {
    if (!setId) {
      setSeriesForSet([])
      return
    }
    
    try {
      const response = await axios.get('/api/admin/series', { params: { set: setId } })
      setSeriesForSet(response.data.series || [])
    } catch (error) {
      console.error('Error loading series for set:', error)
      addToast('Failed to load series for set', 'error')
      setSeriesForSet([])
    }
  }, [addToast])

  // Memoized edit handler
  const handleEditSeries = useCallback(async (seriesItem) => {
    setEditingSeries(seriesItem)
    const setId = seriesItem.set_id ? Number(seriesItem.set_id) : ''

    // Load series for the current set if one is selected
    if (seriesItem.set_id) {
      await loadSeriesForSet(seriesItem.set_id)
    }

    // Now set the form with the loaded data
    setEditForm({
      name: seriesItem.name || '',
      is_base: seriesItem.is_base || false,
      color: seriesItem.color || '',
      card_count: seriesItem.card_count || '',
      card_entered_count: seriesItem.card_entered_count || '',
      rookie_count: seriesItem.rookie_count || '',
      print_run_display: seriesItem.print_run_display || '',
      production_code: seriesItem.production_code || '',
      set_id: setId,
      parallel_of_series: seriesItem.parallel_of_series ? Number(seriesItem.parallel_of_series) : ''
    })

    setShowEditModal(true)
  }, [loadSeriesForSet])

  // Memoized add modal handler
  const handleShowAddModal = useCallback(async () => {
    setSeriesForSet([]) // Clear series until set is selected

    // Prepopulate name field with set name + trailing space if we're on a set page
    if (setInfo && setInfo.name) {
      setAddForm(prev => ({
        ...prev,
        name: setInfo.name + ' ',
        set_id: setId ? Number(setId) : '' // Also preselect the set
      }))
      // Load series for the preselected set
      if (setId) {
        await loadSeriesForSet(setId)
      }
    } else {
      // Reset form if no set context
      setAddForm({
        name: '',
        is_base: false,
        color: '',
        card_count: '',
        card_entered_count: '',
        rookie_count: '',
        print_run_display: '',
        production_code: '',
        set_id: '',
        parallel_of_series: ''
      })
    }

    setShowAddModal(true)
  }, [setInfo, setId, loadSeriesForSet])

  // Memoized duplicate modal handler
  const handleShowDuplicateModal = useCallback((seriesItem) => {
    setDuplicatingSeries(seriesItem)
    setDuplicateForm({
      name: seriesItem.name + ' 2',
      color_id: '',
      print_run: ''
    })
    setColorSearchTerm('') // Reset color search term
    setHighlightedColorIndex(-1) // Reset highlighted index
    setColorDropdownOpen(false) // Ensure dropdown is closed
    setShowDuplicateModal(true)
  }, [])

  const handleDuplicateSeries = async () => {
    if (!duplicatingSeries || !duplicateForm.name.trim()) {
      addToast('Please provide a name for the parallel series', 'error')
      return
    }

    try {
      setDuplicating(true)
      
      const response = await axios.post(`/api/admin/series/${duplicatingSeries.series_id}/duplicate`, {
        name: duplicateForm.name,
        color_id: duplicateForm.color_id || null,
        print_run: duplicateForm.print_run || null
      })

      if (response.data.success) {
        addToast(`Successfully created parallel series with ${response.data.cards_created} cards`, 'success')
        setShowDuplicateModal(false)
        setDuplicatingSeries(null)
        setDuplicateForm({ name: '', color_id: '', print_run: '' })
        setColorSearchTerm('') // Reset color search term
        setColorDropdownOpen(false) // Close dropdown
        loadSeries(searchTerm)
      } else {
        addToast(response.data.message || 'Failed to duplicate series', 'error')
      }
    } catch (error) {
      console.error('Error duplicating series:', error)
      addToast(error.response?.data?.message || 'Failed to duplicate series', 'error')
    } finally {
      setDuplicating(false)
    }
  }


  // Memoized navigation handler
  const handleViewCards = useCallback((seriesItem) => {
    // Navigate to cards list for this series
    navigate(`/admin/cards?series=${seriesItem.series_id}`)
  }, [navigate])

  // Memoized upload handler
  const handleUpload = useCallback((seriesItem) => {
    // Navigate to import page with series pre-selected
    navigate(`/admin/import?series=${seriesItem.series_id}`)
  }, [navigate])

  const handleCreateSeries = async () => {
    try {
      setCreating(true)

      // Validate required fields
      if (!addForm.name.trim()) {
        addToast('Series name is required', 'error')
        return
      }
      if (!addForm.set_id) {
        addToast('Set selection is required', 'error')
        return
      }

      const createData = {
        name: addForm.name.trim(),
        set_id: Number(addForm.set_id),
        is_base: addForm.is_base || false,
        card_count: addForm.card_count ? Number(addForm.card_count) : null,
        card_entered_count: addForm.card_entered_count ? Number(addForm.card_entered_count) : null,
        rookie_count: addForm.rookie_count ? Number(addForm.rookie_count) : null,
        print_run_display: addForm.print_run_display.trim() || null,
        production_code: addForm.production_code.trim() || null,
        parallel_of_series: addForm.parallel_of_series ? Number(addForm.parallel_of_series) : null
      }

      const response = await axios.post('/api/admin/series', createData)
      
      // Add new series to the list
      const newSeries = response.data.series
      setSeries(prevSeries => [newSeries, ...prevSeries])

      addToast('Series created successfully', 'success')
      setShowAddModal(false)
      
      // Reset form
      setAddForm({
        name: '',
        is_base: false,
        color: '',
        card_count: '',
        card_entered_count: '',
        rookie_count: '',
        print_run_display: '',
        production_code: '',
        set_id: '',
        parallel_of_series: ''
      })
      
    } catch (error) {
      console.error('Error creating series:', error)
      const errorMessage = error.response?.data?.message || error.message
      addToast(`Failed to create series: ${errorMessage}`, 'error')
    } finally {
      setCreating(false)
    }
  }

  const handleSaveSeries = async () => {
    if (!editingSeries) return

    try {
      setSaving(true)
      
      // Validate required fields
      if (!editForm.name.trim()) {
        addToast('Series name is required', 'error')
        return
      }
      if (!editForm.set_id) {
        addToast('Set selection is required', 'error')
        return
      }

      const updateData = {
        name: editForm.name.trim(),
        set_id: Number(editForm.set_id),
        is_base: editForm.is_base || false,
        card_count: editForm.card_count ? Number(editForm.card_count) : null,
        card_entered_count: editForm.card_entered_count ? Number(editForm.card_entered_count) : null,
        rookie_count: editForm.rookie_count ? Number(editForm.rookie_count) : null,
        print_run_display: editForm.print_run_display.trim() || null,
        production_code: editForm.production_code.trim() || null,
        parallel_of_series: editForm.parallel_of_series ? Number(editForm.parallel_of_series) : null
      }

      const response = await axios.put(`/api/admin/series/${editingSeries.series_id}`, updateData)
      
      // Update the series list with the new data
      setSeries(prevSeries => 
        prevSeries.map(s => 
          s.series_id === editingSeries.series_id 
            ? { ...s, ...response.data.series }
            : s
        )
      )

      addToast('Series updated successfully', 'success')
      setShowEditModal(false)
      setEditingSeries(null)
      
    } catch (error) {
      console.error('Error updating series:', error)
      const errorMessage = error.response?.data?.message || error.message
      addToast(`Failed to update series: ${errorMessage}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteSeries = async () => {
    if (!deletingSeries) return

    setDeleting(true)
    try {
      const response = await axios.delete(`/api/admin/series/${deletingSeries.series_id}`)
      
      if (response.data.success) {
        addToast(`Successfully deleted series: ${deletingSeries.name}`, 'success')
        setShowDeleteModal(false)
        setShowEditModal(false)
        setDeletingSeries(null)
        loadSeries() // Refresh the list
      }
    } catch (error) {
      console.error('Error deleting series:', error)
      const message = error.response?.data?.message || 'Failed to delete series'
      addToast(message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  // Memoized delete modal handler
  const handleShowDeleteModal = useCallback((series) => {
    setDeletingSeries(series)
    setShowDeleteModal(true)
  }, [])

  if (loading) {
    return (
      <div className="admin-series-page">
        <div className="admin-header">
          <div className="admin-title">
            <Icon name="layers" size={32} />
            <h1>
            {totalSeries > 0 && !setInfo && !isSearchMode 
              ? `${totalSeries.toLocaleString()} Series` 
              : isSearchMode 
                ? `Series Search Results (${series.length})`
                : setInfo 
                  ? 'Series Management'
                  : 'Recent Series (100)'}
          </h1>
          </div>
        </div>
        <div className="loading-state">
          <div className="card-icon-spinner"></div>
          <p>Loading series...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="admin-series-page">
      <div className="admin-header">
        <div className="admin-title">
          <Icon name="layers" size={32} />
          <h1>
            {totalSeries > 0 && !setInfo && !isSearchMode 
              ? `${totalSeries.toLocaleString()} Series` 
              : isSearchMode 
                ? `Series Search Results (${series.length})`
                : setInfo 
                  ? 'Series Management'
                  : 'Recent Series (100)'}
          </h1>
        </div>
        
        <div className="admin-controls">
          <button
            className="new-item-button"
            onClick={handleShowAddModal}
            title="Add new series"
          >
            <Icon name="plus" size={20} />
          </button>
          <div className="search-box">
            <Icon name="search" size={20} />
            <input
              type="text"
              placeholder="Search series by name..."
              value={searchTerm}
              onChange={handleSearchChange}
              autoFocus
            />
          </div>
        </div>
      </div>
      
      {setInfo && (
        <div className="set-context">
          <span>Viewing series for: </span>
          <strong>{setInfo.name} ({setInfo.year})</strong>
          <button 
            className="back-btn"
            onClick={() => navigate('/admin/sets')}
          >
            <Icon name="arrow-left" size={16} />
            Back to Sets
          </button>
        </div>
      )}

      {!setInfo && !isSearchMode && (
        <div className="info-banner">
          <Icon name="info" size={16} />
          <span>Showing 100 most recently created series. Use search to find specific series from all {totalSeries > 0 ? totalSeries.toLocaleString() : ''} series.</span>
        </div>
      )}

      {series.length === 0 ? (
        <div className="empty-state">
          <Icon name="database" size={48} />
          <h3>No Series Found</h3>
          <p>
            {searchTerm 
              ? `No series match "${searchTerm}"`
              : setId 
                ? 'No series found for this set'
                : 'No series available'}
          </p>
        </div>
      ) : (
        <div className="series-table">
          <div className="table-header">
            <div className="col-header actions">Actions</div>
            <div className="col-header id">ID</div>
            <div 
              className={`col-header name sortable ${sortField === 'name' ? 'active' : ''}`}
              onClick={() => handleSort('name')}
            >
              Series Name
              {sortField === 'name' && (
                <Icon 
                  name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                  size={14} 
                  className="sort-icon" 
                />
              )}
            </div>
            <div 
              className={`col-header center sortable ${sortField === 'is_base' ? 'active' : ''}`}
              onClick={() => handleSort('is_base')}
            >
              Base
              {sortField === 'is_base' && (
                <Icon 
                  name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                  size={14} 
                  className="sort-icon" 
                />
              )}
            </div>
            <div className="col-header center">Color</div>
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
            <div 
              className={`col-header center sortable ${sortField === 'card_entered_count' ? 'active' : ''}`}
              onClick={() => handleSort('card_entered_count')}
            >
              Entered
              {sortField === 'card_entered_count' && (
                <Icon 
                  name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                  size={14} 
                  className="sort-icon" 
                />
              )}
            </div>
            <div 
              className={`col-header center sortable ${sortField === 'rookie_count' ? 'active' : ''}`}
              onClick={() => handleSort('rookie_count')}
            >
              Rookies
              {sortField === 'rookie_count' && (
                <Icon 
                  name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                  size={14} 
                  className="sort-icon" 
                />
              )}
            </div>
            <div className="col-header center">Print Run</div>
            <div className="col-header center">Production Code</div>
          </div>

          {sortedSeries.map(seriesItem => (
            <SeriesRow
              key={seriesItem.series_id}
              seriesItem={seriesItem}
              onEdit={handleEditSeries}
              onDuplicate={handleShowDuplicateModal}
              onUpload={handleUpload}
              onViewCards={handleViewCards}
            />
          ))}
        </div>
      )}

      {/* Add Series Modal */}
      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="edit-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add New Series</h3>
              <button className="close-btn" onClick={() => setShowAddModal(false)}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
                  <div className="form-field-row">
                    <label className="field-label">Name</label>
                    <input
                      type="text"
                      className="field-input"
                      value={addForm.name}
                      onChange={(e) => setAddForm({...addForm, name: e.target.value})}
                      placeholder="Enter series name"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Set</label>
                    <SearchableDropdown
                      options={availableSets}
                      value={addForm.set_id}
                      onChange={(value) => {
                        setAddForm({...addForm, set_id: Number(value), parallel_of_series: ''})
                        loadSeriesForSet(value)
                      }}
                      placeholder="Select set..."
                      emptyMessage="No sets available"
                      getOptionLabel={(set) => set.name}
                      getOptionValue={(set) => Number(set.set_id)}
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Parallel Parent</label>
                    <SearchableDropdown
                      options={seriesForSet.filter(s => !s.parallel_of_series)}
                      value={addForm.parallel_of_series}
                      onChange={(value) => setAddForm({...addForm, parallel_of_series: value})}
                      placeholder={addForm.set_id ? "Select parallel parent..." : "First select a set"}
                      emptyMessage={addForm.set_id ? "No available series for parallel (all series in this set already have parents)" : "Select a set first"}
                      getOptionLabel={(series) => series.name}
                      getOptionValue={(series) => series.series_id}
                      disabled={!addForm.set_id}
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Base Series</label>
                    <button
                      type="button"
                      className={`hof-toggle ${addForm.is_base ? 'hof-active' : ''}`}
                      onClick={() => setAddForm({...addForm, is_base: !addForm.is_base})}
                    >
                      <Icon name="check-circle" size={16} />
                      <span>Is Base Series</span>
                      {addForm.is_base && <Icon name="check" size={16} className="hof-check" />}
                    </button>
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Card Count</label>
                    <input
                      type="number"
                      className="field-input"
                      value={addForm.card_count}
                      onChange={(e) => setAddForm({...addForm, card_count: e.target.value})}
                      placeholder="Total number of cards"
                      min="0"
                    />
                  </div>


                  <div className="form-field-row">
                    <label className="field-label">Print Run</label>
                    <input
                      type="text"
                      className="field-input"
                      value={addForm.print_run_display}
                      onChange={(e) => setAddForm({...addForm, print_run_display: e.target.value})}
                      placeholder="e.g., 1000-2000, 500, Limited"
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Production Code</label>
                    <input
                      type="text"
                      className="field-input"
                      value={addForm.production_code}
                      onChange={(e) => setAddForm({...addForm, production_code: e.target.value})}
                      placeholder="e.g., ABC123XYZ"
                      maxLength={12}
                    />
                  </div>

            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowAddModal(false)} disabled={creating}>
                Cancel
              </button>
              <button 
                className="save-btn"
                onClick={handleCreateSeries}
                disabled={creating || !addForm.name.trim()}
              >
                {creating ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Creating...
                  </>
                ) : (
                  'Create Series'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Series Modal */}
      {showEditModal && editingSeries && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="edit-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Series #{editingSeries.series_id}</h3>
              <button className="close-btn" onClick={() => setShowEditModal(false)}>
                <Icon name="x" size={20} />
              </button>
            </div>
            
                  <div className="form-field-row">
                    <label className="field-label">Name</label>
                    <input
                      type="text"
                      className="field-input"
                      value={editForm.name}
                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                      placeholder="Enter series name"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Set</label>
                    <SearchableDropdown
                      options={availableSets}
                      value={editForm.set_id}
                      onChange={(value) => {
                        setEditForm({...editForm, set_id: Number(value), parallel_of_series: ''})
                        loadSeriesForSet(value)
                      }}
                      placeholder="Select set..."
                      emptyMessage="No sets available"
                      getOptionLabel={(set) => set.name}
                      getOptionValue={(set) => Number(set.set_id)}
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Parallel Parent</label>
                    <SearchableDropdown
                      options={seriesForSet.filter(s => 
                        s.series_id !== editingSeries?.series_id && 
                        !s.parallel_of_series
                      )}
                      value={editForm.parallel_of_series}
                      onChange={(value) => setEditForm({...editForm, parallel_of_series: value})}
                      placeholder={editForm.set_id ? "Select parallel parent..." : "First select a set"}
                      emptyMessage={editForm.set_id ? "No available series for parallel (all series in this set already have parents)" : "Select a set first"}
                      getOptionLabel={(series) => series.name}
                      getOptionValue={(series) => series.series_id}
                      disabled={!editForm.set_id}
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Base Series</label>
                    <button
                      type="button"
                      className={`hof-toggle ${editForm.is_base ? 'hof-active' : ''}`}
                      onClick={() => setEditForm({...editForm, is_base: !editForm.is_base})}
                    >
                      <Icon name="check-circle" size={16} />
                      <span>Is Base Series</span>
                      {editForm.is_base && <Icon name="check" size={16} className="hof-check" />}
                    </button>
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Card Count</label>
                    <input
                      type="number"
                      className="field-input"
                      value={editForm.card_count}
                      onChange={(e) => setEditForm({...editForm, card_count: e.target.value})}
                      placeholder="Total number of cards"
                      min="0"
                    />
                  </div>


                  <div className="form-field-row">
                    <label className="field-label">Print Run</label>
                    <input
                      type="text"
                      className="field-input"
                      value={editForm.print_run_display}
                      onChange={(e) => setEditForm({...editForm, print_run_display: e.target.value})}
                      placeholder="e.g., 1000-2000, 500, Limited"
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Production Code</label>
                    <input
                      type="text"
                      className="field-input"
                      value={editForm.production_code}
                      onChange={(e) => setEditForm({...editForm, production_code: e.target.value})}
                      placeholder="e.g., ABC123XYZ"
                      maxLength={12}
                    />
                  </div>

            <div className="modal-actions">
              <button 
                className="delete-series-btn"
                onClick={() => handleShowDeleteModal(editingSeries)}
                disabled={saving}
              >
                <Icon name="trash" size={16} />
                Delete
              </button>
              
              <div className="modal-actions-right">
                <button className="cancel-btn" onClick={() => setShowEditModal(false)} disabled={saving}>
                  Cancel
                </button>
                <button 
                  className="save-btn"
                  onClick={handleSaveSeries}
                  disabled={saving || !editForm.name.trim()}
                >
                  {saving ? (
                    <>
                      <div className="card-icon-spinner small"></div>
                      Saving...
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Duplicate Series Modal */}
      {showDuplicateModal && duplicatingSeries && (
        <div className="modal-overlay" onClick={() => setShowDuplicateModal(false)}>
          <div className="edit-player-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create Parallel of {duplicatingSeries.name}</h3>
              <button className="close-btn" onClick={() => setShowDuplicateModal(false)}>
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="form-info">
              <Icon name="info" size={16} />
              <span>Creating parallel in set: <strong>{duplicatingSeries.set_name}</strong></span>
            </div>
            
                <div className="form-field-row">
                  <label className="field-label">Series Name</label>
                  <input
                    type="text"
                    className="field-input"
                    value={duplicateForm.name}
                    onChange={(e) => setDuplicateForm({...duplicateForm, name: e.target.value})}
                    onFocus={(e) => {
                      // Set cursor to end of input
                      setTimeout(() => {
                        e.target.setSelectionRange(e.target.value.length, e.target.value.length)
                      }, 0)
                    }}
                    placeholder="Enter parallel series name"
                    autoFocus
                    required
                  />
                </div>

                <div className="form-field-row">
                  <label className="field-label">Color</label>
                  <div className="color-dropdown">
                    <div className="color-input-container">
                      {duplicateForm.color_id && (
                        <div 
                          className="color-dot selected-dot"
                          style={{ 
                            backgroundColor: availableColors.find(c => c.color_id == duplicateForm.color_id)?.hex_value || '#ec4899'
                          }}
                        />
                      )}
                      <input
                        type="text"
                        className="color-input-field"
                        value={colorSearchTerm}
                        onChange={(e) => {
                          setColorSearchTerm(e.target.value)
                          setColorDropdownOpen(true)
                          setHighlightedColorIndex(-1) // Reset highlight when searching
                        }}
                        onFocus={() => {
                          setColorDropdownOpen(true)
                          setHighlightedColorIndex(-1)
                        }}
                        onBlur={(e) => {
                          // Only close if clicking outside the dropdown menu or if Tab key was pressed
                          setTimeout(() => {
                            if (!e.relatedTarget?.closest('.color-dropdown-menu')) {
                              setColorDropdownOpen(false)
                              setHighlightedColorIndex(-1)
                            }
                          }, 150)
                        }}
                        onKeyDown={(e) => {
                          const filteredColors = availableColors.filter(color =>
                            color.name.toLowerCase().includes(colorSearchTerm.toLowerCase())
                          )

                          if (e.key === 'Escape') {
                            setColorDropdownOpen(false)
                            setColorSearchTerm('')
                            setHighlightedColorIndex(-1)
                          } else if (e.key === 'Tab') {
                            // Close dropdown on Tab key
                            setColorDropdownOpen(false)
                            setHighlightedColorIndex(-1)
                            // Allow default Tab behavior to move to next field
                          } else if (e.key === 'ArrowDown') {
                            e.preventDefault()
                            if (!colorDropdownOpen) {
                              setColorDropdownOpen(true)
                              setHighlightedColorIndex(0)
                            } else {
                              setHighlightedColorIndex(prev =>
                                prev < filteredColors.length ? prev + 1 : prev
                              )
                            }
                          } else if (e.key === 'ArrowUp') {
                            e.preventDefault()
                            setHighlightedColorIndex(prev => prev > -1 ? prev - 1 : -1)
                          } else if (e.key === 'Enter') {
                            e.preventDefault()

                            // If an item is highlighted, select it
                            if (highlightedColorIndex === -1) {
                              // "No Color" option
                              setDuplicateForm({...duplicateForm, color_id: ''})
                              setColorSearchTerm('')
                              setColorDropdownOpen(false)
                              setHighlightedColorIndex(-1)
                            } else if (highlightedColorIndex >= 0 && highlightedColorIndex < filteredColors.length) {
                              const selectedColor = filteredColors[highlightedColorIndex]
                              setDuplicateForm({...duplicateForm, color_id: selectedColor.color_id})
                              setColorSearchTerm(selectedColor.name)
                              setColorDropdownOpen(false)
                              setHighlightedColorIndex(-1)
                            } else if (filteredColors.length === 1) {
                              // Only one match, select it
                              setDuplicateForm({...duplicateForm, color_id: filteredColors[0].color_id})
                              setColorSearchTerm(filteredColors[0].name)
                              setColorDropdownOpen(false)
                              setHighlightedColorIndex(-1)
                            } else if (colorSearchTerm === '' || colorSearchTerm.toLowerCase() === 'no color') {
                              setDuplicateForm({...duplicateForm, color_id: ''})
                              setColorSearchTerm('')
                              setColorDropdownOpen(false)
                              setHighlightedColorIndex(-1)
                            }
                          }
                        }}
                        placeholder={duplicateForm.color_id ? 
                          availableColors.find(c => c.color_id == duplicateForm.color_id)?.name || 'Type to search colors...' 
                          : 'Type to search colors...'}
                      />
                      <Icon 
                        name={colorDropdownOpen ? "chevron-up" : "chevron-down"} 
                        size={16} 
                        className="dropdown-arrow"
                        onClick={() => setColorDropdownOpen(!colorDropdownOpen)}
                      />
                    </div>
                    
                    {colorDropdownOpen && (
                      <div className="color-dropdown-menu">
                        <div
                          className={`color-dropdown-item ${highlightedColorIndex === -1 ? 'highlighted' : ''}`}
                          onMouseDown={() => {
                            setDuplicateForm({...duplicateForm, color_id: ''})
                            setColorSearchTerm('')
                            setColorDropdownOpen(false)
                            setHighlightedColorIndex(-1)
                          }}
                          onMouseEnter={() => setHighlightedColorIndex(-1)}
                        >
                          <div className="color-dot no-color" />
                          <span>No Color</span>
                        </div>
                        {availableColors
                          .filter(color =>
                            color.name.toLowerCase().includes(colorSearchTerm.toLowerCase())
                          )
                          .map((color, index) => (
                          <div
                            key={color.color_id}
                            className={`color-dropdown-item ${highlightedColorIndex === index ? 'highlighted' : ''}`}
                            onMouseDown={() => {
                              setDuplicateForm({...duplicateForm, color_id: color.color_id})
                              setColorSearchTerm(color.name)
                              setColorDropdownOpen(false)
                              setHighlightedColorIndex(-1)
                            }}
                            onMouseEnter={() => setHighlightedColorIndex(index)}
                          >
                            <div
                              className="color-dot"
                              style={{ backgroundColor: color.hex_value || '#ec4899' }}
                            />
                            <span>{color.name}</span>
                          </div>
                        ))}
                        {colorSearchTerm && availableColors.filter(color => 
                          color.name.toLowerCase().includes(colorSearchTerm.toLowerCase())
                        ).length === 0 && (
                          <div className="color-dropdown-item no-results">
                            <span>No colors found matching "{colorSearchTerm}"</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="form-field-row">
                  <label className="field-label">Print Run (per card)</label>
                  <input
                    type="number"
                    className="field-input"
                    value={duplicateForm.print_run}
                    onChange={(e) => setDuplicateForm({...duplicateForm, print_run: e.target.value})}
                    placeholder="Enter print run (e.g., 99, 250)"
                    min="1"
                  />
                </div>

                <div className="form-info">
                  <Icon name="info" size={16} />
                  <span>This will create a new parallel series and duplicate all {duplicatingSeries.card_entered_count || 0} cards from the original series.</span>
                </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowDuplicateModal(false)} disabled={duplicating}>
                Cancel
              </button>
              <button 
                className="save-btn"
                onClick={handleDuplicateSeries}
                disabled={duplicating || !duplicateForm.name.trim()}
              >
                {duplicating ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Creating Parallel...
                  </>
                ) : (
                  'Create Parallel Series'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && deletingSeries && (
        <div className="modal-overlay" onClick={() => !deleting && setShowDeleteModal(false)}>
          <div className="edit-player-modal delete-confirmation-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Series</h3>
              <button className="close-btn" onClick={() => !deleting && setShowDeleteModal(false)}>
                <Icon name="x" size={20} />
              </button>
            </div>

            <div className="delete-confirmation-content">
              <div className="warning-icon">
                <Icon name="alert-triangle" size={48} />
              </div>
              
              <h4>Are you sure you want to delete this series?</h4>
              <p><strong>Series:</strong> {deletingSeries.name}</p>
              <p><strong>Set:</strong> {deletingSeries.set_name}</p>
              <p><strong>Cards to be deleted:</strong> {deletingSeries.card_entered_count || 0}</p>
              
              <div className="danger-warning">
                <Icon name="alert-circle" size={16} />
                <span>This action cannot be undone. All cards and associated data will be permanently deleted.</span>
              </div>
            </div>
            
            <div className="modal-actions">
              <button className="cancel-btn" onClick={() => setShowDeleteModal(false)} disabled={deleting}>
                Cancel
              </button>
              <button 
                className="delete-confirm-btn"
                onClick={handleDeleteSeries}
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
                    Delete Series
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

export default AdminSeries