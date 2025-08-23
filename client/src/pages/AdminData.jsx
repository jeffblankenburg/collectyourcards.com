import React, { useState, useEffect } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import axios from 'axios'
import Icon from '../components/Icon'
import './AdminData.css'

const DATABASE_TABLES = [
  // Core Data Tables
  { name: 'card', displayName: 'Cards', category: 'Core Data', icon: 'card' },
  { name: 'player', displayName: 'Players', category: 'Core Data', icon: 'user' },
  { name: 'team', displayName: 'Teams', category: 'Core Data', icon: 'users' },
  { name: 'series', displayName: 'Series', category: 'Core Data', icon: 'collection' },
  { name: 'set', displayName: 'Sets', category: 'Core Data', icon: 'archive' },
  
  // Reference Tables
  { name: 'color', displayName: 'Colors', category: 'Reference Data', icon: 'color' },
  { name: 'grading_agency', displayName: 'Grading Agencies', category: 'Reference Data', icon: 'star' },
  { name: 'manufacturer', displayName: 'Manufacturers', category: 'Reference Data', icon: 'factory' },
  { name: 'organization', displayName: 'Organizations', category: 'Reference Data', icon: 'building' },
  
  // Relationship Tables
  { name: 'card_player_team', displayName: 'Card-Player-Team Links', category: 'Relationships', icon: 'link' },
  { name: 'player_team', displayName: 'Player-Team Links', category: 'Relationships', icon: 'link' },
  { name: 'card_variation', displayName: 'Card Variations', category: 'Relationships', icon: 'shuffle' },
  { name: 'player_alias', displayName: 'Player Aliases', category: 'Relationships', icon: 'alias' },
  
  // User Data Tables
  { name: 'user', displayName: 'Users', category: 'User Data', icon: 'user' },
  { name: 'user_card', displayName: 'User Collections', category: 'User Data', icon: 'heart' },
  { name: 'user_location', displayName: 'User Locations', category: 'User Data', icon: 'map' },
  { name: 'user_player', displayName: 'User Player Visits', category: 'User Data', icon: 'eye' },
  { name: 'user_team', displayName: 'User Team Visits', category: 'User Data', icon: 'eye' },
  { name: 'user_series', displayName: 'User Series Visits', category: 'User Data', icon: 'eye' },
  
  // Import & Processing
  { name: 'import_job', displayName: 'Import Jobs', category: 'Import System', icon: 'upload' },
  { name: 'import_staging', displayName: 'Import Staging', category: 'Import System', icon: 'staging' },
  { name: 'import_series_staging', displayName: 'Series Staging', category: 'Import System', icon: 'staging' },
  { name: 'import_mapping', displayName: 'Import Mappings', category: 'Import System', icon: 'map' },
  { name: 'import_recovery_point', displayName: 'Recovery Points', category: 'Import System', icon: 'shield' },
  
  // Logs & Audit
  { name: 'admin_action_log', displayName: 'Admin Actions', category: 'Audit Logs', icon: 'activity' },
  { name: 'user_auth_log', displayName: 'Authentication Logs', category: 'Audit Logs', icon: 'lock' },
  { name: 'user_session', displayName: 'User Sessions', category: 'Audit Logs', icon: 'clock' },
  
  // eBay Integration
  { name: 'ebay_purchases', displayName: 'eBay Purchases', category: 'eBay Integration', icon: 'shopping' },
  { name: 'user_ebay_accounts', displayName: 'eBay Accounts', category: 'eBay Integration', icon: 'link' },
  { name: 'ebay_sync_logs', displayName: 'eBay Sync Logs', category: 'eBay Integration', icon: 'refresh' },
  { name: 'ebay_deletion_log', displayName: 'eBay Deletions', category: 'eBay Integration', icon: 'trash' },
  
  // Utilities & Processing
  { name: 'duplicate_detection_job', displayName: 'Duplicate Detection Jobs', category: 'Data Quality', icon: 'search' },
  { name: 'duplicate_player_group', displayName: 'Duplicate Player Groups', category: 'Data Quality', icon: 'users' },
  { name: 'duplicate_player_member', displayName: 'Duplicate Members', category: 'Data Quality', icon: 'user' },
  { name: 'staging_data', displayName: 'Staging Data', category: 'Data Quality', icon: 'database' },
  { name: 'user_card_photo', displayName: 'Card Photos', category: 'Media', icon: 'image' }
]

function AdminData() {
  const { user } = useAuth()
  const { showToast } = useToast()
  const [selectedTable, setSelectedTable] = useState(null)
  const [tableData, setTableData] = useState([])
  const [columns, setColumns] = useState([])
  const [primaryKey, setPrimaryKey] = useState(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchTerm, setSearchTerm] = useState('')
  const [editingCell, setEditingCell] = useState(null) // {row: index, col: columnName}
  const [editValue, setEditValue] = useState('')
  const [newRow, setNewRow] = useState(null) // For adding new records
  const [savingCells, setSavingCells] = useState(new Set()) // Track which cells are being saved

  // Check if user has admin privileges
  if (!user || !['admin', 'superadmin'].includes(user.role)) {
    return (
      <div className="admin-data-page">
        <div className="access-denied">
          <Icon name="lock" size={48} />
          <h2>Access Denied</h2>
          <p>Administrative privileges required to access this page.</p>
        </div>
      </div>
    )
  }

  const loadTableData = async (tableName, pageNum = 1) => {
    try {
      setLoading(true)
      const response = await axios.get(`/api/admin-data/table-data/${tableName}`, {
        params: {
          page: pageNum,
          limit: 50,
          search: searchTerm
        }
      })
      
      setTableData(response.data.data || [])
      setColumns(response.data.columns || [])
      setPrimaryKey(response.data.primaryKey || 'id')
      setTotalPages(response.data.totalPages || 1)
      setPage(pageNum)
    } catch (error) {
      console.error('Error loading table data:', error)
      showToast('Failed to load table data', 'error')
    } finally {
      setLoading(false)
    }
  }

  const handleTableSelect = (table) => {
    setSelectedTable(table)
    setPage(1)
    setSearchTerm('')
    setEditingCell(null)
    setNewRow(null)
    loadTableData(table.name, 1)
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
      
      // Only send the changed field
      const updateData = { [columnName]: newValue }
      
      await axios.put(`/api/admin-data/table-data/${selectedTable.name}/${recordId}`, updateData)
      
      // Update local data
      const updatedData = [...tableData]
      updatedData[rowIndex] = { ...updatedData[rowIndex], [columnName]: newValue }
      setTableData(updatedData)
      
      setEditingCell(null)
    } catch (error) {
      console.error('Error updating cell:', error)
      showToast(`Failed to update ${columnName}`, 'error')
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
    } else if (e.key === 'Escape') {
      setEditingCell(null)
    } else if (e.key === 'Tab') {
      e.preventDefault()
      handleCellSave(rowIndex, columnName, editValue)
      // Move to next editable cell
      moveToNextCell(rowIndex, columnName, e.shiftKey)
    }
  }

  const moveToNextCell = (currentRow, currentCol, backwards = false) => {
    const editableColumns = columns.filter(col => col !== primaryKey && !col.endsWith('_id') && col !== 'id')
    const currentColIndex = editableColumns.indexOf(currentCol)
    
    let nextRow = currentRow
    let nextColIndex = backwards ? currentColIndex - 1 : currentColIndex + 1
    
    // Move to next/previous row if at end/start of columns
    if (nextColIndex >= editableColumns.length) {
      nextRow = currentRow + 1
      nextColIndex = 0
    } else if (nextColIndex < 0) {
      nextRow = currentRow - 1
      nextColIndex = editableColumns.length - 1
    }
    
    // Check bounds
    if (nextRow >= 0 && nextRow < tableData.length && nextColIndex >= 0 && nextColIndex < editableColumns.length) {
      const nextCol = editableColumns[nextColIndex]
      const nextValue = tableData[nextRow][nextCol]
      handleCellClick(nextRow, nextCol, nextValue)
    }
  }

  const handleDeleteRow = async (row) => {
    if (window.confirm('Are you sure you want to delete this record?')) {
      try {
        const recordId = row[primaryKey]
        
        await axios.delete(`/api/admin-data/table-data/${selectedTable.name}/${recordId}`)
        showToast('Record deleted successfully', 'success')
        loadTableData(selectedTable.name, page)
      } catch (error) {
        console.error('Error deleting record:', error)
        showToast('Failed to delete record', 'error')
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
      await axios.post(`/api/admin-data/table-data/${selectedTable.name}`, newRow)
      showToast('Record added successfully', 'success')
      setNewRow(null)
      loadTableData(selectedTable.name, page)
    } catch (error) {
      console.error('Error adding record:', error)
      showToast('Failed to add record', 'error')
    }
  }

  const renderTableSelector = () => {
    const categories = [...new Set(DATABASE_TABLES.map(t => t.category))]
    
    return (
      <div className="table-selector">
        <h2>Database Tables</h2>
        {categories.map(category => (
          <div key={category} className="table-category">
            <h3>{category}</h3>
            <div className="table-grid">
              {DATABASE_TABLES.filter(t => t.category === category).map(table => (
                <div
                  key={table.name}
                  className={`table-card ${selectedTable?.name === table.name ? 'selected' : ''}`}
                  onClick={() => handleTableSelect(table)}
                >
                  <Icon name={table.icon} size={24} />
                  <span className="table-name">{table.displayName}</span>
                  <span className="table-technical">({table.name})</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    )
  }

  const renderDataTable = () => {
    if (!selectedTable || !columns.length) return null

    return (
      <div className="data-table-container">
        <div className="table-header">
          <div className="table-info">
            <h2>{selectedTable.displayName}</h2>
            <span className="table-name">({selectedTable.name})</span>
          </div>
          
          <div className="table-controls">
            <div className="search-box">
              <Icon name="search" size={16} />
              <input
                type="text"
                placeholder="Search records..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && loadTableData(selectedTable.name, 1)}
              />
            </div>
            
            <button 
              className="add-button"
              onClick={handleAddRow}
            >
              <Icon name="plus" size={16} />
              Add Row
            </button>
          </div>
        </div>

        {loading ? (
          <div className="loading-container">
            <Icon name="activity" size={24} className="spinner" />
            <p>Loading data...</p>
          </div>
        ) : (
          <>
            <div className="spreadsheet-table-wrapper">
              <table className="spreadsheet-table">
                <thead>
                  <tr>
                    <th className="row-number-header">#</th>
                    {columns.map(col => (
                      <th key={col} className={col === primaryKey || col.endsWith('_id') || col === 'id' ? 'readonly-column' : ''}>
                        {col}
                        {(col === primaryKey || col.endsWith('_id') || col === 'id') && <Icon name="lock" size={12} />}
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
                                <span className="cell-value">
                                  {typeof row[col] === 'boolean' ? (row[col] ? '✓' : '✗') : 
                                   row[col] === null ? <em className="null-value">null</em> : 
                                   String(row[col] || '')}
                                </span>
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

            {totalPages > 1 && (
              <div className="pagination">
                <button 
                  onClick={() => loadTableData(selectedTable.name, page - 1)}
                  disabled={page === 1}
                >
                  <Icon name="chevron-left" size={16} />
                </button>
                <span>Page {page} of {totalPages}</span>
                <button 
                  onClick={() => loadTableData(selectedTable.name, page + 1)}
                  disabled={page === totalPages}
                >
                  <Icon name="chevron-right" size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <div className="admin-data-page">
      <div className="admin-header">
        <h1>Database Administration</h1>
        <p>Manage all database tables with full CRUD operations</p>
      </div>

      <div className="admin-content">
        {!selectedTable ? renderTableSelector() : renderDataTable()}
        
        {selectedTable && (
          <button 
            className="back-button"
            onClick={() => setSelectedTable(null)}
          >
            <Icon name="arrow-left" size={16} />
            Back to Tables
          </button>
        )}
      </div>
    </div>
  )
}

export default AdminData