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
    // Don't edit primary key columns
    if (columnName === primaryKey || columnName.endsWith('_id') || columnName === 'id') return
    
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
    const editableColumns = columns.filter(col => col !== primaryKey && !col.endsWith('_id') && col !== 'id')
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

  const handleDeleteRow = async (row) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const recordId = row[primaryKey]
        
        await axios.delete(`/api/admin-data/table-data/${tableName}/${recordId}`)
        addToast('Record deleted successfully', 'success')
        loadTableData(tableName)
      } catch (error) {
        console.error('Error deleting record:', error)
        addToast('Failed to delete record', 'error')
      }
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
    return targetTable ? `/admin/tables/${targetTable}` : null
  }

  // Render cell content with potential linking
  const renderCellContent = (row, columnName, isEditing) => {
    const value = row[columnName]
    const linkTo = getEntityLink(columnName, value)
    
    if (isEditing) {
      return null // Input will be rendered separately
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
          <div className="breadcrumb">
            <Link to="/admin" className="breadcrumb-link">
              <Icon name="shield" size={16} />
              Admin
            </Link>
            <Icon name="chevron-right" size={16} />
            <Link to="/admin/tables" className="breadcrumb-link">
              Database Tables
            </Link>
            <Icon name="chevron-right" size={16} />
            <span>{displayName}</span>
          </div>
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
                    <th className="row-number-header">#</th>
                    {columns.map(col => (
                      <th 
                        key={col} 
                        className={`
                          ${col === primaryKey || col.endsWith('_id') || col === 'id' ? 'readonly-column' : ''}
                          sortable-header
                          ${sortColumn === col ? 'sorted' : ''}
                        `}
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
                      </th>
                    ))}
                    <th className="actions-column">
                      <Icon name="trash" size={16} />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tableData.map((row, rowIndex) => (
                    <tr key={rowIndex} className="data-row">
                      <td className="row-number">{rowIndex + 1}</td>
                      {columns.map(col => {
                        const cellKey = `${rowIndex}-${col}`
                        const isEditing = editingCell?.row === rowIndex && editingCell?.col === col
                        const isReadonly = col === primaryKey || col.endsWith('_id') || col === 'id'
                        const isSaving = savingCells.has(cellKey)
                        
                        return (
                          <td 
                            key={col} 
                            className={`
                              ${isReadonly ? 'readonly-cell' : 'editable-cell'}
                              ${isEditing ? 'editing-cell' : ''}
                              ${isSaving ? 'saving-cell' : ''}
                            `}
                            onClick={() => !isReadonly && handleCellClick(rowIndex, col, row[col])}
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => handleCellKeyDown(e, rowIndex, col)}
                                onBlur={() => handleCellSave(rowIndex, col, editValue)}
                                className="cell-input"
                                autoFocus
                              />
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
                      <td className="row-number">
                        <Icon name="plus" size={12} />
                      </td>
                      {columns.map(col => {
                        const isReadonly = col === primaryKey || col.endsWith('_id') || col === 'id'
                        
                        return (
                          <td key={col} className={isReadonly ? 'readonly-cell' : 'editable-cell'}>
                            {isReadonly ? (
                              <div className="cell-content">
                                <span className="cell-value">
                                  <em className="auto-generated">auto</em>
                                </span>
                              </div>
                            ) : (
                              <input
                                type="text"
                                value={newRow[col] || ''}
                                onChange={(e) => setNewRow({...newRow, [col]: e.target.value})}
                                placeholder={`Enter ${col}...`}
                                className="cell-input new-cell-input"
                              />
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
    </div>
  )
}

export default AdminTableEditor