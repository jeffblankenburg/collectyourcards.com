import React, { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './AdminTableEditor.css'

const TABLE_DISPLAY_NAMES = {
  card: 'Cards',
  player: 'Players', 
  team: 'Teams',
  series: 'Series',
  set: 'Sets',
  color: 'Colors',
  grading_agency: 'Grading Agencies',
  manufacturer: 'Manufacturers',
  organization: 'Organizations',
  card_player_team: 'Card-Player-Team Links',
  player_team: 'Player-Team Links',
  card_variation: 'Card Variations',
  player_alias: 'Player Aliases',
  user: 'Users',
  user_card: 'User Collections',
  user_location: 'User Locations',
  user_player: 'User Player Visits',
  user_team: 'User Team Visits',
  user_series: 'User Series Visits',
  import_job: 'Import Jobs',
  import_staging: 'Import Staging',
  import_series_staging: 'Series Staging',
  import_mapping: 'Import Mappings',
  import_recovery_point: 'Recovery Points',
  admin_action_log: 'Admin Actions',
  user_auth_log: 'Authentication Logs',
  user_session: 'User Sessions',
  ebay_purchases: 'eBay Purchases',
  user_ebay_accounts: 'eBay Accounts',
  ebay_sync_logs: 'eBay Sync Logs',
  ebay_deletion_log: 'eBay Deletions',
  duplicate_detection_job: 'Duplicate Detection Jobs',
  duplicate_player_group: 'Duplicate Player Groups',
  duplicate_player_member: 'Duplicate Members',
  staging_data: 'Staging Data',
  user_card_photo: 'Card Photos'
}

// Table-specific field configuration
const TABLE_FIELD_CONFIG = {
  team: {
    hiddenFields: ['created'], // Hide created field
    readonlyFields: ['team_Id', 'card_count'],
    dropdownFields: {
      organization: { sourceTable: 'organization', valueField: 'organization_id', displayField: 'name' }
    },
    booleanFields: [],
    noWrapFields: ['name']
  },
  series: {
    hiddenFields: ['created', 'min_print_run', 'max_print_run', 'print_run_variations', 'print_run_display'], // Hide created field
    readonlyFields: ['series_id', 'card_entered_count'],
    dropdownFields: {
      set: { sourceTable: 'set', valueField: 'set_id', displayField: 'name' },
      parallel_of_series: { sourceTable: 'series', valueField: 'series_id', displayField: 'name', 
                           filter: (item, currentRow) => item.set_id === currentRow.set_id && !item.parallel_of_series }
    },
    booleanFields: ['is_base', 'is_parallel'],
    noWrapFields: ['name'],
    editableFields: ['card_count'] // Explicitly editable
  },
  set: {
    hiddenFields: ['created'], // Hide created field
    readonlyFields: ['set_id', 'card_count', 'series_count'],
    dropdownFields: {
      organization: { sourceTable: 'organization', valueField: 'organization_id', displayField: 'name' }
    },
    booleanFields: ['is_complete'],
    noWrapFields: ['name']
  },
  color: {
    hiddenFields: ['created'], // Already hidden
    readonlyFields: ['color_id'],
    dropdownFields: {},
    booleanFields: [],
    noWrapFields: ['name']
  },
  grading_agency: {
    hiddenFields: ['created'], // Already hidden
    readonlyFields: ['grading_agency_id'],
    dropdownFields: {},
    booleanFields: [],
    noWrapFields: ['name']
  },
  // Add configurations for other common tables
  manufacturer: {
    hiddenFields: ['created'],
    readonlyFields: ['manufacturer_id'],
    dropdownFields: {},
    booleanFields: [],
    noWrapFields: ['name']
  },
  organization: {
    hiddenFields: ['created'],
    readonlyFields: ['organization_id'],
    dropdownFields: {},
    booleanFields: [],
    noWrapFields: ['name']
  },
  player: {
    hiddenFields: ['created'],
    readonlyFields: ['player_id', 'card_count'],
    dropdownFields: {},
    booleanFields: ['is_hof'],
    noWrapFields: ['first_name', 'last_name']
  },
  card: {
    hiddenFields: ['created'],
    readonlyFields: ['card_id'],
    dropdownFields: {
      series: { sourceTable: 'series', valueField: 'series_id', displayField: 'name' },
      grading_agency: { sourceTable: 'grading_agency', valueField: 'grading_agency_id', displayField: 'name' }
    },
    booleanFields: ['is_rookie', 'is_autograph', 'is_memorabilia'],
    noWrapFields: []
  }
}

function AdminTableEditor() {
  const { tableName } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { addToast } = useToast()
  const [tableData, setTableData] = useState([])
  const [columns, setColumns] = useState([])
  const [primaryKey, setPrimaryKey] = useState(null)
  const [loading, setLoading] = useState(false)
  const [total, setTotal] = useState(0)
  const [searchTerm, setSearchTerm] = useState('')
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')
  const [editingCell, setEditingCell] = useState(null) // {row: index, col: columnName}
  const [editValue, setEditValue] = useState('')
  const [newRow, setNewRow] = useState(null) // For adding new records
  const [savingCells, setSavingCells] = useState(new Set()) // Track which cells are being saved
  const [deleteConfirm, setDeleteConfirm] = useState(null) // For delete confirmation dialog
  const [dropdownData, setDropdownData] = useState({}) // Store data for dropdown fields
  const [columnWidths, setColumnWidths] = useState({}) // Store column widths for resizing
  const [resizing, setResizing] = useState(null) // Track which column is being resized

  // Check if user has admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-table-editor-page">
        <div className="access-denied">
          <Icon name="lock" size={48} />
          <h2>Access Denied</h2>
          <p>Administrative privileges required to access this page.</p>
          <Link to="/" className="back-home-btn">
            <Icon name="home" size={16} />
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  // Check if table name is valid
  const displayName = TABLE_DISPLAY_NAMES[tableName]
  if (!displayName) {
    return (
      <div className="admin-table-editor-page">
        <div className="access-denied">
          <Icon name="alert-triangle" size={48} />
          <h2>Invalid Table</h2>
          <p>The table "{tableName}" was not found.</p>
          <Link to="/admin/tables" className="back-home-btn">
            <Icon name="database" size={16} />
            Back to Tables
          </Link>
        </div>
      </div>
    )
  }

  useEffect(() => {
    loadTableData(tableName)
  }, [tableName, sortColumn, sortDirection])

  useEffect(() => {
    loadDropdownData(tableName)
  }, [tableName])

  useEffect(() => {
    if (searchTerm !== '') {
      const timeoutId = setTimeout(() => {
        loadTableData(tableName)
      }, 500)
      return () => clearTimeout(timeoutId)
    }
  }, [searchTerm])

  // Global keyboard shortcuts
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Don't interfere with cell editing
      if (editingCell || newRow) return
      
      // Ctrl+F or / for search focus
      if ((e.ctrlKey && e.key === 'f') || e.key === '/') {
        e.preventDefault()
        document.querySelector('.search-box input')?.focus()
      }
      // Ctrl+N for new row
      else if (e.ctrlKey && e.key === 'n') {
        e.preventDefault()
        handleAddRow()
      }
      // Escape to clear search or close new row
      else if (e.key === 'Escape') {
        if (searchTerm) {
          setSearchTerm('')
        } else if (newRow) {
          setNewRow(null)
        }
      }
    }

    document.addEventListener('keydown', handleGlobalKeyDown)
    return () => document.removeEventListener('keydown', handleGlobalKeyDown)
  }, [editingCell, newRow, searchTerm])

  const loadTableData = async (tableNameParam) => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/admin-data/table-data/${tableNameParam}`, {
        params: {
          limit: 10000, // Show all records
          search: searchTerm,
          sortColumn: sortColumn,
          sortDirection: sortDirection
        }
      })
      
      setTableData(response.data.data || [])
      setColumns(response.data.columns || [])
      setPrimaryKey(response.data.primaryKey || 'id')
      setTotal(response.data.total || 0)
    } catch (error) {
      console.error('Error loading table data:', error)
      addToast('Failed to load table data', 'error')
    } finally {
      setLoading(false)
    }
  }

  // Load limited data for dropdown fields (just show a few recent/popular options)
  const loadDropdownData = async (tableNameParam) => {
    const config = TABLE_FIELD_CONFIG[tableNameParam] || {}
    const dropdownFields = config.dropdownFields || {}
    
    if (Object.keys(dropdownFields).length === 0) {
      setDropdownData({})
      return
    }
    
    try {
      const newDropdownData = {}
      
      // Load just the most recent/commonly used options for each dropdown field
      for (const [fieldName, fieldConfig] of Object.entries(dropdownFields)) {
        try {
          const response = await axios.get(`/api/admin-data/table-data/${fieldConfig.sourceTable}`, {
            params: { 
              limit: 50,  // Only load top 50 most recent options
              sortColumn: fieldConfig.valueField,
              sortDirection: 'desc'
            }
          })
          newDropdownData[fieldName] = response.data.data || []
        } catch (fieldError) {
          console.error(`Error loading ${fieldName} dropdown data:`, fieldError)
          newDropdownData[fieldName] = []
        }
      }
      
      setDropdownData(newDropdownData)
    } catch (error) {
      console.error('Error loading dropdown data:', error)
      addToast('Failed to load dropdown data', 'error')
    }
  }

  const handleSort = (columnName) => {
    if (sortColumn === columnName) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc')
    } else {
      // New column, default to ascending
      setSortColumn(columnName)
      setSortDirection('asc')
    }
    // No pagination - sorting reloads all data
  }

  const handleCellClick = (rowIndex, columnName, currentValue) => {
    const config = TABLE_FIELD_CONFIG[tableName] || {}
    
    // Don't edit readonly fields or primary keys
    if (columnName === primaryKey || 
        columnName.endsWith('_id') || 
        columnName === 'id' ||
        config.readonlyFields?.includes(columnName)) return
    
    setEditingCell({ row: rowIndex, col: columnName })
    setEditValue(currentValue || '')
  }

  const handleCellSave = async (rowIndex, columnName, newValue) => {
    const cellKey = `${rowIndex}-${columnName}`
    setSavingCells(prev => new Set([...prev, cellKey]))

    try {
      const row = tableData[rowIndex]
      const recordId = row[primaryKey]
      
      console.log('Saving cell:', {
        tableName,
        rowIndex,
        columnName,
        newValue,
        primaryKey,
        recordId,
        row: row
      })
      
      // Only send the changed field
      const updateData = { [columnName]: newValue }
      
      const response = await axios.put(`/api/admin-data/table-data/${tableName}/${recordId}`, updateData)
      console.log('Save response:', response.data)
      
      // Update local data
      const updatedData = [...tableData]
      updatedData[rowIndex] = { ...updatedData[rowIndex], [columnName]: newValue }
      setTableData(updatedData)
      
      setEditingCell(null)
      addToast('Cell updated successfully', 'success')
    } catch (error) {
      console.error('Error updating cell:', error)
      console.error('Error details:', error.response?.data)
      addToast(`Failed to update ${columnName}: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setSavingCells(prev => {
        const next = new Set(prev)
        next.delete(cellKey)
        return next
      })
    }
  }

  const handleCellKeyDown = (e, rowIndex, columnName) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleCellSave(rowIndex, columnName, editValue)
      // Move to next row, same column
      moveToNextCell(rowIndex, columnName, false, true)
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      handleCellSave(rowIndex, columnName, editValue)
      // Move to next editable cell
      moveToNextCell(rowIndex, columnName, e.shiftKey, false)
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      handleCellSave(rowIndex, columnName, editValue)
      moveToNextCell(rowIndex, columnName, false, true)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      handleCellSave(rowIndex, columnName, editValue)
      moveToNextCell(rowIndex, columnName, true, true)
    } else if (e.key === 'ArrowRight' && e.target.selectionStart === e.target.value.length) {
      e.preventDefault()
      handleCellSave(rowIndex, columnName, editValue)
      moveToNextCell(rowIndex, columnName, false, false)
    } else if (e.key === 'ArrowLeft' && e.target.selectionStart === 0) {
      e.preventDefault()
      handleCellSave(rowIndex, columnName, editValue)
      moveToNextCell(rowIndex, columnName, true, false)
    }
  }

  const moveToNextCell = (currentRow, currentCol, backwards = false, sameColumn = false) => {
    const config = TABLE_FIELD_CONFIG[tableName] || {}
    const editableColumns = columns.filter(col => 
      col !== primaryKey && 
      !col.endsWith('_id') && 
      col !== 'id' &&
      !config.readonlyFields?.includes(col) &&
      !config.hiddenFields?.includes(col)
    )
    const currentColIndex = editableColumns.indexOf(currentCol)
    
    let nextRow = currentRow
    let nextColIndex = currentColIndex
    
    if (sameColumn) {
      // Move up/down in same column
      nextRow = backwards ? currentRow - 1 : currentRow + 1
    } else {
      // Move left/right across columns
      nextColIndex = backwards ? currentColIndex - 1 : currentColIndex + 1
      
      // Wrap to next/previous row if at end/start of columns
      if (nextColIndex >= editableColumns.length) {
        nextRow = currentRow + 1
        nextColIndex = 0
      } else if (nextColIndex < 0) {
        nextRow = currentRow - 1
        nextColIndex = editableColumns.length - 1
      }
    }
    
    // Check bounds
    if (nextRow >= 0 && nextRow < tableData.length && nextColIndex >= 0 && nextColIndex < editableColumns.length) {
      const nextCol = editableColumns[nextColIndex]
      const nextValue = tableData[nextRow][nextCol]
      setTimeout(() => {
        handleCellClick(nextRow, nextCol, nextValue)
      }, 50) // Small delay to ensure save completes first
    }
  }

  const handleDeleteRow = (row) => {
    setDeleteConfirm({
      row,
      message: `Are you sure you want to delete this ${displayName.toLowerCase().slice(0, -1)}?`
    })
  }

  const confirmDelete = async () => {
    if (!deleteConfirm) return
    
    try {
      const recordId = deleteConfirm.row[primaryKey]
      
      await axios.delete(`/api/admin-data/table-data/${tableName}/${recordId}`)
      addToast('Record deleted successfully', 'success')
      loadTableData(tableName)
    } catch (error) {
      console.error('Error deleting record:', error)
      addToast('Failed to delete record', 'error')
    } finally {
      setDeleteConfirm(null)
    }
  }

  const handleAddRow = () => {
    // Create empty row template
    const emptyRow = {}
    columns.forEach(col => {
      if (col !== primaryKey && !col.endsWith('_id') && col !== 'id') {
        emptyRow[col] = ''
      }
    })
    setNewRow(emptyRow)
    
    // Scroll to bottom to make new row visible
    setTimeout(() => {
      const tableWrapper = document.querySelector('.spreadsheet-table-wrapper')
      if (tableWrapper) {
        tableWrapper.scrollTop = tableWrapper.scrollHeight
      }
    }, 100)
  }

  const handleNewRowSave = async () => {
    try {
      await axios.post(`/api/admin-data/table-data/${tableName}`, newRow)
      addToast('Record added successfully', 'success')
      setNewRow(null)
      loadTableData(tableName)
    } catch (error) {
      console.error('Error adding record:', error)
      addToast('Failed to add record', 'error')
    }
  }

  // Helper function to determine if a field should link to another table
  const getEntityLink = (columnName, value) => {
    if (!value || value === null) return null
    
    // Don't make primary keys clickable within their own table
    if ((tableName === 'team' && columnName === 'team_Id') ||
        (tableName === 'series' && columnName === 'series_id') ||
        (tableName === 'set' && columnName === 'set_id') ||
        (tableName === 'color' && columnName === 'color_id') ||
        (tableName === 'grading_agency' && columnName === 'grading_agency_id')) {
      return null
    }
    
    const linkMappings = {
      // Direct ID mappings
      'player_id': 'player',
      'team_id': 'team', 
      'team_Id': 'team',
      'series_id': 'series',
      'set_id': 'set',
      'card_id': 'card',
      'color_id': 'color',
      'user_id': 'user',
      'grading_agency_id': 'grading_agency',
      'manufacturer_id': 'manufacturer',
      'organization_id': 'organization',
      
      // Special fields that should link even without _id suffix
      'organization': 'organization',
      'grading_agency': 'grading_agency',
      'manufacturer': 'manufacturer'
    }
    
    const targetTable = linkMappings[columnName]
    return targetTable ? `/admin/table/${targetTable}` : null
  }

  // Helper function to get dropdown options with filtering
  const getDropdownOptions = (fieldName, fieldConfig, currentRow) => {
    const data = dropdownData[fieldName] || []
    
    if (fieldConfig.filter && currentRow) {
      try {
        return data.filter(item => fieldConfig.filter(item, currentRow))
      } catch (error) {
        console.error('Error filtering dropdown options:', error)
        return data
      }
    }
    
    return data
  }

  // Simple dropdown component as separate React component
  const SearchableDropdown = ({ fieldName, fieldConfig, currentValue, onChange, currentRow, dropdownData }) => {
    const [searchTerm, setSearchTerm] = useState('')
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [suggestions, setSuggestions] = useState([])
    const [loading, setLoading] = useState(false)

    // Get the current display name for the value
    const getCurrentDisplayName = () => {
      if (!currentValue) return ''
      
      // Try to get from server-provided display name first
      const displayFieldName = `${fieldName}_name`
      if (currentRow && currentRow[displayFieldName]) {
        return currentRow[displayFieldName]
      }
      
      // Fallback to dropdown data
      const option = (dropdownData[fieldName] || []).find(
        item => item[fieldConfig.valueField] == currentValue
      )
      return option ? option[fieldConfig.displayField] : currentValue
    }

    // Search for options by name
    const searchOptions = async (query) => {
      if (!query || query.length < 2) {
        setSuggestions(dropdownData[fieldName] || [])
        return
      }

      setLoading(true)
      try {
        const response = await axios.get(`/api/admin-data/table-data/${fieldConfig.sourceTable}`, {
          params: { 
            limit: 20,
            search: query
          }
        })
        setSuggestions(response.data.data || [])
      } catch (error) {
        console.error('Error searching options:', error)
        setSuggestions([])
      }
      setLoading(false)
    }

    // Initialize with current display name
    useEffect(() => {
      const displayName = getCurrentDisplayName()
      setSearchTerm(displayName)
      setSuggestions(dropdownData[fieldName] || [])
    }, [currentValue, dropdownData[fieldName], currentRow])

    return (
      <div className="searchable-dropdown">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setShowSuggestions(true)
            searchOptions(e.target.value)
          }}
          onFocus={() => {
            setShowSuggestions(true)
            setSuggestions(dropdownData[fieldName] || [])
          }}
          onBlur={() => {
            setTimeout(() => setShowSuggestions(false), 200)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setShowSuggestions(false)
            } else if (e.key === 'Enter' && suggestions.length > 0) {
              // Auto-select first suggestion on Enter
              const firstSuggestion = suggestions[0]
              setSearchTerm(firstSuggestion[fieldConfig.displayField])
              setShowSuggestions(false)
              onChange(firstSuggestion[fieldConfig.valueField])
            }
          }}
          placeholder={`Search ${fieldName}...`}
          className="dropdown-input"
          autoFocus
        />
        
        {showSuggestions && (
          <div className="dropdown-suggestions">
            {loading && <div className="dropdown-loading">Searching...</div>}
            {suggestions.length === 0 && !loading && (
              <div className="dropdown-empty">No matches found</div>
            )}
            {suggestions.slice(0, 10).map(option => {
              const key = option[fieldConfig.valueField]
              const display = option[fieldConfig.displayField]
              return (
                <div
                  key={key}
                  className="dropdown-suggestion"
                  onClick={() => {
                    setSearchTerm(display)
                    setShowSuggestions(false)
                    onChange(key) // Save the ID, not the display name
                  }}
                >
                  {display}
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  // Simple render function that returns the component
  const renderDropdownInput = (fieldName, fieldConfig, currentValue, onChange, currentRow) => {
    return (
      <SearchableDropdown
        fieldName={fieldName}
        fieldConfig={fieldConfig}
        currentValue={currentValue}
        onChange={onChange}
        currentRow={currentRow}
        dropdownData={dropdownData}
      />
    )
  }

  // Get display text for dropdown values using server-provided display names
  const getDropdownDisplayText = (row, columnName, fieldConfig, value) => {
    if (!value) return <em className="null-value">null</em>
    
    // Check if server provided a display name (e.g., set_name, organization_name)
    const displayFieldName = `${columnName}_name`
    if (row[displayFieldName]) {
      return row[displayFieldName]
    }
    
    // Fallback to searching in dropdown data
    const data = dropdownData[columnName] || []
    const option = data.find(item => item[fieldConfig.valueField] == value)
    return option ? option[fieldConfig.displayField] : value
  }

  // Render cell content with potential linking, checkboxes, dropdowns etc.
  const renderCellContent = (row, columnName, isEditing) => {
    const value = row[columnName]
    const config = TABLE_FIELD_CONFIG[tableName] || {}
    const linkTo = getEntityLink(columnName, value)
    
    if (isEditing) {
      return null // Input will be rendered separately
    }
    
    // Handle boolean fields with checkboxes
    if (config.booleanFields?.includes(columnName)) {
      return (
        <label className="checkbox-wrapper" onClick={(e) => e.stopPropagation()}>
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => {
              const newValue = e.target.checked
              handleCellSave(
                tableData.findIndex(r => r[primaryKey] === row[primaryKey]),
                columnName,
                newValue
              )
            }}
            className="boolean-checkbox"
          />
        </label>
      )
    }

    // Handle dropdown fields - show display text instead of ID
    if (config.dropdownFields && config.dropdownFields[columnName]) {
      const fieldConfig = config.dropdownFields[columnName]
      const displayText = getDropdownDisplayText(row, columnName, fieldConfig, value)
      
      // Return as link if it should link to another entity
      if (linkTo && value) {
        return (
          <Link 
            to={linkTo} 
            className="entity-link"
            onClick={(e) => e.stopPropagation()} // Prevent cell editing
            title={`Go to ${getEntityLink(columnName, value)} table`}
          >
            {displayText}
            <Icon name="external-link" size={12} className="link-icon" />
          </Link>
        )
      }
      
      return <span className="cell-value">{displayText}</span>
    }
    
    // Format the display value
    let displayValue = value
    if (typeof value === 'boolean') {
      displayValue = value ? '✓' : '✗'
    } else if (value === null || value === undefined) {
      displayValue = <em className="null-value">null</em>
    } else {
      displayValue = String(value || '')
    }
    
    // Return as link if it should link to another entity
    if (linkTo && value) {
      return (
        <Link 
          to={linkTo} 
          className="entity-link"
          onClick={(e) => e.stopPropagation()} // Prevent cell editing
          title={`Go to ${getEntityLink(columnName, value)} table`}
        >
          {displayValue}
          <Icon name="external-link" size={12} className="link-icon" />
        </Link>
      )
    }
    
    return <span className="cell-value">{displayValue}</span>
  }

  // Column resizing functions
  const handleResizeStart = (columnName, e) => {
    e.preventDefault()
    e.stopPropagation()
    
    setResizing({
      column: columnName,
      startX: e.clientX,
      startWidth: e.target.parentElement.offsetWidth
    })
  }

  const handleResizeMove = (e) => {
    if (!resizing) return
    
    const deltaX = e.clientX - resizing.startX
    const newWidth = Math.max(60, resizing.startWidth + deltaX) // Minimum width of 60px
    
    setColumnWidths(prev => ({
      ...prev,
      [resizing.column]: newWidth
    }))
  }

  const handleResizeEnd = () => {
    setResizing(null)
  }

  // Add global mouse event listeners for column resizing
  useEffect(() => {
    if (resizing) {
      document.addEventListener('mousemove', handleResizeMove)
      document.addEventListener('mouseup', handleResizeEnd)
      document.body.style.cursor = 'col-resize'
      
      return () => {
        document.removeEventListener('mousemove', handleResizeMove)
        document.removeEventListener('mouseup', handleResizeEnd)
        document.body.style.cursor = 'default'
      }
    }
  }, [resizing])

  return (
    <div className="admin-table-editor-page">
      {/* Quick Navigation Bar */}
      <div className="quick-nav-bar">
        <div className="nav-content">
          <div className="nav-label">
            <Icon name="database" size={16} />
            Quick Jump:
          </div>
          <div className="nav-tables">
            {Object.entries(TABLE_DISPLAY_NAMES).map(([table, displayName]) => (
              <Link 
                key={table} 
                to={`/admin/table/${table}`}
                className={`nav-table ${table === tableName ? 'active' : ''}`}
                title={displayName}
              >
                {displayName}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="admin-table-header">
        <div className="header-content">
          <div className="title-section">
            <h1>{displayName}</h1>
            <div className="table-info">
              <span className="table-name">({tableName})</span>
              {!loading && <span className="record-count">{total.toLocaleString()} records</span>}
            </div>
          </div>
        </div>

        <div className="table-controls">
          <div className="search-box">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Search records... (Ctrl+F or /)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && loadTableData(tableName)}
            />
          </div>
          
          <button 
            className="add-button"
            onClick={handleAddRow}
            title="Add new row (Ctrl+N)"
          >
            <Icon name="plus" size={16} />
            Add Row
          </button>

          <div className="keyboard-help" title="Keyboard Shortcuts">
            <div className="help-content">
              <Icon name="help-circle" size={16} />
              <div className="help-tooltip">
                <div className="help-title">Keyboard Shortcuts</div>
                <div className="help-shortcuts">
                  <div><kbd>Tab</kbd> - Move to next cell & save</div>
                  <div><kbd>Shift+Tab</kbd> - Move to previous cell & save</div>
                  <div><kbd>Enter</kbd> - Move down & save</div>
                  <div><kbd>Arrow Keys</kbd> - Navigate cells & save</div>
                  <div><kbd>Escape</kbd> - Cancel edit / Clear search</div>
                  <div><kbd>Ctrl+F</kbd> or <kbd>/</kbd> - Focus search</div>
                  <div><kbd>Ctrl+N</kbd> - Add new row</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-table-content">
        {loading ? (
          <div className="loading-container">
            <Icon name="activity" size={24} className="spinner" />
            <p>Loading {displayName.toLowerCase()}...</p>
          </div>
        ) : (
          <>
            <div className="spreadsheet-table-wrapper">
              <table className="spreadsheet-table">
                <thead>
                  <tr>
                    {columns.filter(col => {
                      const config = TABLE_FIELD_CONFIG[tableName] || {}
                      return !config.hiddenFields?.includes(col)
                    }).map(col => {
                      const config = TABLE_FIELD_CONFIG[tableName] || {}
                      return (
                        <th 
                          key={col} 
                          className={`
                            ${col === primaryKey || col.endsWith('_id') || col === 'id' ? 'readonly-column' : ''}
                            sortable-header
                            ${sortColumn === col ? 'sorted' : ''}
                            ${config.noWrapFields?.includes(col) ? 'no-wrap-column' : ''}
                            resizable-column
                          `}
                          style={{ width: columnWidths[col] ? `${columnWidths[col]}px` : undefined }}
                          onClick={() => handleSort(col)}
                        >
                          <div className="header-content">
                            <span>{col}</span>
                            <div className="header-icons">
                              {(col === primaryKey || col.endsWith('_id') || col === 'id') && <Icon name="lock" size={12} />}
                              <div className="sort-indicators">
                                {sortColumn === col && (
                                  <Icon 
                                    name={sortDirection === 'asc' ? 'chevron-up' : 'chevron-down'} 
                                    size={12} 
                                    className="sort-icon"
                                  />
                                )}
                                {sortColumn !== col && (
                                  <Icon name="chevron-up" size={10} className="sort-placeholder" />
                                )}
                              </div>
                            </div>
                          </div>
                          <div 
                            className="resize-handle"
                            onMouseDown={(e) => handleResizeStart(col, e)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </th>
                      )
                    })}
                    <th className="actions-column">
                      <Icon name="trash" size={16} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="data-row">
                      {columns.filter(col => {
                        const config = TABLE_FIELD_CONFIG[tableName] || {}
                        return !config.hiddenFields?.includes(col)
                      }).map(col => {
                        const cellKey = `${rowIndex}-${col}`
                        const isEditing = editingCell?.row === rowIndex && editingCell?.col === col
                        const config = TABLE_FIELD_CONFIG[tableName] || {}
                        const isReadonly = col === primaryKey || col.endsWith('_id') || col === 'id' || config.readonlyFields?.includes(col)
                        const isSaving = savingCells.has(cellKey)
                        
                        return (
                          <td 
                            key={col} 
                            className={`
                              ${isReadonly ? 'readonly-cell' : 'editable-cell'}
                              ${isEditing ? 'editing-cell' : ''}
                              ${isSaving ? 'saving-cell' : ''}
                              ${config.noWrapFields?.includes(col) ? 'no-wrap-column' : ''}
                            `}
                            style={{ width: columnWidths[col] ? `${columnWidths[col]}px` : undefined }}
                            onClick={() => !isReadonly && handleCellClick(rowIndex, col, row[col])}
                          >
                            {isEditing ? (
                              config.dropdownFields && config.dropdownFields[col] ? (
                                renderDropdownInput(
                                  col,
                                  config.dropdownFields[col],
                                  editValue,
                                  (newValue) => {
                                    setEditValue(newValue)
                                    // Auto-save on dropdown change
                                    handleCellSave(rowIndex, col, newValue)
                                  },
                                  row
                                )
                              ) : (
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => handleCellKeyDown(e, rowIndex, col)}
                                  onBlur={() => handleCellSave(rowIndex, col, editValue)}
                                  className="cell-input"
                                  autoFocus
                                />
                              )
                            ) : (
                              <div className="cell-content">
                                {isSaving && <Icon name="activity" size={12} className="saving-spinner" />}
                                {renderCellContent(row, col, false)}
                              </div>
                            )}
                          </td>
                        )
                      })}
                      <td className="actions-column">
                        <button 
                          onClick={() => handleDeleteRow(row)} 
                          className="delete-row-btn"
                          title="Delete row"
                        >
                          <Icon name="trash" size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {/* New row for adding records */}
                  {newRow && (
                    <tr className="new-row">
                      {columns.filter(col => {
                        const config = TABLE_FIELD_CONFIG[tableName] || {}
                        return !config.hiddenFields?.includes(col)
                      }).map(col => {
                        const config = TABLE_FIELD_CONFIG[tableName] || {}
                        const isReadonly = col === primaryKey || col.endsWith('_id') || col === 'id' || config.readonlyFields?.includes(col)
                        
                        return (
                          <td key={col} className={`
                            ${isReadonly ? 'readonly-cell' : 'editable-cell'}
                            ${config.noWrapFields?.includes(col) ? 'no-wrap-column' : ''}
                          `}>
                            {isReadonly ? (
                              <div className="cell-content">
                                <span className="cell-value">
                                  <em className="auto-generated">auto</em>
                                </span>
                              </div>
                            ) : (
                              config.dropdownFields && config.dropdownFields[col] ? (
                                <select
                                  value={newRow[col] || ''}
                                  onChange={(e) => setNewRow({...newRow, [col]: e.target.value})}
                                  className="dropdown-input new-cell-input"
                                >
                                  <option value="">Select {col}...</option>
                                  {getDropdownOptions(col, config.dropdownFields[col], null).map(option => (
                                    <option 
                                      key={option[config.dropdownFields[col].valueField]} 
                                      value={option[config.dropdownFields[col].valueField]}
                                    >
                                      {option[config.dropdownFields[col].displayField]}
                                    </option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={newRow[col] || ''}
                                  onChange={(e) => setNewRow({...newRow, [col]: e.target.value})}
                                  placeholder={`Enter ${col}...`}
                                  className="cell-input new-cell-input"
                                />
                              )
                            )}
                          </td>
                        )
                      })}
                      <td className="actions-column">
                        <button onClick={handleNewRowSave} className="save-new-btn" title="Save new row">
                          <Icon name="check" size={14} />
                        </button>
                        <button onClick={() => setNewRow(null)} className="cancel-new-btn" title="Cancel">
                          <Icon name="x" size={14} />
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

          </>
        )}
      </div>

      {/* Custom Delete Confirmation Dialog */}
      {deleteConfirm && (
        <div className="modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="confirmation-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <Icon name="alert-triangle" size={24} className="warning-icon" />
              <h3>Confirm Deletion</h3>
            </div>
            <div className="dialog-content">
              <p>{deleteConfirm.message}</p>
              <p className="warning-text">This action cannot be undone.</p>
            </div>
            <div className="dialog-actions">
              <button 
                className="cancel-btn"
                onClick={() => setDeleteConfirm(null)}
              >
                Cancel
              </button>
              <button 
                className="delete-btn"
                onClick={confirmDelete}
              >
                <Icon name="trash" size={16} />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AdminTableEditor