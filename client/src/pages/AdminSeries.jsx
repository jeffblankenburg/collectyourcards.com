import React, { useState, useEffect } from 'react'
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
  const [editingSeries, setEditingSeries] = useState(null)
  const [editForm, setEditForm] = useState({})
  const [addForm, setAddForm] = useState({
    name: '',
    is_base: false,
    color: '',
    card_count: '',
    card_entered_count: '',
    rookie_count: '',
    print_run_display: '',
    set_id: '',
    parallel_of_series: ''
  })
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)
  const [availableSets, setAvailableSets] = useState([])
  const [availableSeries, setAvailableSeries] = useState([])
  const [seriesForSet, setSeriesForSet] = useState([])
  const { addToast } = useToast()
  const searchTimeoutRef = React.useRef(null)

  // Load series on mount or when search changes
  useEffect(() => {
    // Load with initial search if provided in URL
    loadSeries(searchParams.get('search') || '')
  }, [setId])

  const loadSeries = async (search = '') => {
    try {
      setSearching(true)
      
      const params = {
        limit: 100
      }
      
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
      }
    } catch (error) {
      console.error('Error loading series:', error)
      addToast('Failed to load series', 'error')
      setSeries([])
    } finally {
      setSearching(false)
      setLoading(false)
    }
  }

  const handleSearchChange = (e) => {
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
  }

  const handleSort = (field) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDirection('asc')
    }
  }

  const getSortedSeries = () => {
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
    
    return sorted
  }

  const loadSets = async () => {
    try {
      // Request ALL sets for the dropdown
      const response = await axios.get('/api/admin/sets', { params: { all: 'true' } })
      const sets = response.data.sets || []
      setAvailableSets(sets)
    } catch (error) {
      console.error('Error loading sets:', error)
      addToast('Failed to load sets', 'error')
    }
  }

  const loadSeriesForSet = async (setId) => {
    if (!setId) {
      setSeriesForSet([])
      return
    }
    
    try {
      const response = await axios.get('/api/admin/series', { params: { set: setId, limit: 1000 } })
      setSeriesForSet(response.data.series || [])
    } catch (error) {
      console.error('Error loading series for set:', error)
      addToast('Failed to load series for set', 'error')
      setSeriesForSet([])
    }
  }

  const handleEditSeries = async (seriesItem) => {
    setEditingSeries(seriesItem)
    const setId = seriesItem.set_id ? Number(seriesItem.set_id) : ''
    
    setEditForm({
      name: seriesItem.name || '',
      is_base: seriesItem.is_base || false,
      color: seriesItem.color || '',
      card_count: seriesItem.card_count || '',
      card_entered_count: seriesItem.card_entered_count || '',
      rookie_count: seriesItem.rookie_count || '',
      print_run_display: seriesItem.print_run_display || '',
      set_id: setId,
      parallel_of_series: seriesItem.parallel_of_series ? Number(seriesItem.parallel_of_series) : ''
    })
    
    // Load sets and series for dropdowns
    await loadSets()
    // Load series for the current set if one is selected
    if (seriesItem.set_id) {
      await loadSeriesForSet(seriesItem.set_id)
    }
    
    setShowEditModal(true)
  }

  const handleShowAddModal = async () => {
    // Load sets for dropdown
    await loadSets()
    setSeriesForSet([]) // Clear series until set is selected
    setShowAddModal(true)
  }


  const handleViewCards = (seriesItem) => {
    // Navigate to cards list for this series
    navigate(`/admin/cards?series=${seriesItem.series_id}`)
  }

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

  if (loading) {
    return (
      <div className="admin-series-page">
        <div className="admin-header">
          <div className="admin-title">
            <Icon name="layers" size={32} />
            <h1>{totalSeries > 0 && !setInfo ? `${totalSeries.toLocaleString()} Series` : 'Series Management'}</h1>
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
          <h1>{totalSeries > 0 && !setInfo ? `${totalSeries.toLocaleString()} Series` : 'Series Management'}</h1>
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
          </div>
          
          {getSortedSeries().map(seriesItem => (
            <div 
              key={seriesItem.series_id} 
              className="series-row"
              onDoubleClick={() => handleEditSeries(seriesItem)}
              title="Double-click to edit series"
            >
              <div className="col-actions">
                <button 
                  className="edit-btn"
                  title="Edit series"
                  onClick={() => handleEditSeries(seriesItem)}
                >
                  <Icon name="edit" size={16} />
                </button>
                <button 
                  className="view-btn"
                  title="View cards"
                  onClick={() => handleViewCards(seriesItem)}
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
                {seriesItem.color_name && (
                  <span 
                    className="color-tag"
                    style={{
                      backgroundColor: seriesItem.color_hex || '#ec4899',
                      color: seriesItem.color_hex ? (
                        parseInt(seriesItem.color_hex.slice(1, 3), 16) * 0.299 +
                        parseInt(seriesItem.color_hex.slice(3, 5), 16) * 0.587 +
                        parseInt(seriesItem.color_hex.slice(5, 7), 16) * 0.114 > 128
                        ? '#000000' : '#ffffff'
                      ) : '#ffffff'
                    }}
                  >
                    {seriesItem.color_name}
                  </span>
                )}
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
            </div>
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
            
            <div className="modal-content">
              <div className="edit-form">
                <div className="player-details-form">
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
                    <label className="field-label">Cards Entered</label>
                    <input
                      type="number"
                      className="field-input"
                      value={addForm.card_entered_count}
                      onChange={(e) => setAddForm({...addForm, card_entered_count: e.target.value})}
                      placeholder="Number of cards entered"
                      min="0"
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Rookie Count</label>
                    <input
                      type="number"
                      className="field-input"
                      value={addForm.rookie_count}
                      onChange={(e) => setAddForm({...addForm, rookie_count: e.target.value})}
                      placeholder="Number of rookie cards"
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
                </div>
              </div>
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
            
            <div className="modal-content">
              <div className="edit-form">
                <div className="player-details-form">
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
                    <label className="field-label">Cards Entered</label>
                    <input
                      type="number"
                      className="field-input"
                      value={editForm.card_entered_count}
                      onChange={(e) => setEditForm({...editForm, card_entered_count: e.target.value})}
                      placeholder="Number of cards entered"
                      min="0"
                    />
                  </div>

                  <div className="form-field-row">
                    <label className="field-label">Rookie Count</label>
                    <input
                      type="number"
                      className="field-input"
                      value={editForm.rookie_count}
                      onChange={(e) => setEditForm({...editForm, rookie_count: e.target.value})}
                      placeholder="Number of rookie cards"
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
                </div>
              </div>
            </div>
            
            <div className="modal-actions">
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
      )}
    </div>
  )
}

export default AdminSeries