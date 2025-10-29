import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Settings, RotateCcw } from 'lucide-react'
import './ColumnPicker.css'

/**
 * ColumnPicker Component
 *
 * GitHub-style column visibility management for tables
 * Allows users to show/hide columns with preferences saved to database
 *
 * @param {string} tableName - Table identifier ('card_table' or 'collection_table')
 * @param {object} columns - Column definitions from tableColumnDefinitions
 * @param {array} visibleColumns - Array of currently visible column IDs
 * @param {function} onColumnsChange - Callback when visible columns change
 * @param {boolean} isAuthenticated - Whether user is logged in (required for saving)
 */
const ColumnPicker = ({
  tableName,
  columns,
  visibleColumns = [],
  onColumnsChange,
  isAuthenticated = false
}) => {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const dropdownRef = useRef(null)
  const saveTimeoutRef = useRef(null)

  // Handle click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  // Calculate visible count (exclude alwaysVisible from count since user can't toggle them)
  const totalColumns = Object.values(columns).length
  const visibleCount = visibleColumns.length

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Debounced save function - only saves after user stops clicking for 500ms
  const debouncedSave = useCallback((newVisibleColumns) => {
    if (!isAuthenticated) {
      return
    }

    // Clear any existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    // Set saving indicator
    setIsSaving(true)

    // Set new timeout
    saveTimeoutRef.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('token')
        const response = await fetch('/api/user/table-preferences', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            table_name: tableName,
            visible_columns: newVisibleColumns
          })
        })

        if (!response.ok) {
          throw new Error('Failed to save preferences')
        }
      } catch (error) {
        console.error('[ColumnPicker] Error saving column preferences:', error)
        // Note: Don't show error to user - preferences still work locally
      } finally {
        setIsSaving(false)
      }
    }, 500) // Wait 500ms after last change
  }, [tableName, isAuthenticated])

  // Toggle column visibility - fast, optimistic update
  const handleToggle = useCallback((columnId) => {
    const column = columns[columnId]

    // Prevent toggling alwaysVisible columns
    if (column?.alwaysVisible) {
      return
    }

    const newVisibleColumns = visibleColumns.includes(columnId)
      ? visibleColumns.filter(id => id !== columnId)
      : [...visibleColumns, columnId]

    // Update UI immediately (optimistic update)
    onColumnsChange(newVisibleColumns)

    // Debounced save to database
    debouncedSave(newVisibleColumns)
  }, [columns, visibleColumns, onColumnsChange, debouncedSave])

  // Reset to default columns
  const handleReset = useCallback(() => {
    // Clear any pending save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    const defaultColumns = Object.values(columns)
      .filter(col => col.defaultVisible)
      .map(col => col.id)

    // Update UI immediately
    onColumnsChange(defaultColumns)

    // Delete preferences from database if authenticated (non-blocking)
    if (isAuthenticated) {
      setIsSaving(true)
      const token = localStorage.getItem('token')
      fetch(`/api/user/table-preferences/${tableName}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
        .catch(error => {
          console.error('Error resetting preferences:', error)
        })
        .finally(() => {
          setIsSaving(false)
        })
    }

    setIsOpen(false)
  }, [columns, onColumnsChange, isAuthenticated, tableName])

  // Memoize column items to prevent re-rendering all checkboxes when dropdown opens
  const columnItems = useMemo(() => {
    return Object.values(columns).map(column => {
      const isVisible = visibleColumns.includes(column.id)
      const isRequired = column.alwaysVisible
      const requiresAuth = column.requiresAuth && !isAuthenticated

      // Don't show auth-required columns to non-authenticated users
      if (requiresAuth) {
        return null
      }

      return (
        <label
          key={column.id}
          className={`column-picker-item ${isRequired ? 'required' : ''}`}
          title={column.description}
        >
          <input
            type="checkbox"
            checked={isVisible}
            onChange={() => handleToggle(column.id)}
            disabled={isRequired}
          />
          <span className="column-picker-item-label">
            {column.label}
            {isRequired && (
              <span className="column-picker-required-badge">Required</span>
            )}
          </span>
        </label>
      )
    })
  }, [columns, visibleColumns, isAuthenticated, handleToggle])

  return (
    <div className="column-picker" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        className="column-picker-trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-label={`Column visibility settings (${visibleCount}/${totalColumns} visible)`}
        aria-expanded={isOpen}
        title={`Column settings (${visibleCount}/${totalColumns} visible)`}
      >
        <Settings size={18} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="column-picker-dropdown">
          <div className="column-picker-header">
            <span className="column-picker-dropdown-title">Show Columns</span>
            <button
              className="column-picker-reset"
              onClick={handleReset}
              title="Reset to defaults"
            >
              <RotateCcw size={14} />
              Reset
            </button>
          </div>

          <div className="column-picker-list">
            {columnItems}
          </div>

          {isAuthenticated && (
            <div className="column-picker-footer">
              {isSaving ? (
                <span className="column-picker-saving">Saving...</span>
              ) : (
                <span className="column-picker-info">
                  Changes are saved automatically
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Memoize to prevent re-renders when internal state (isOpen) changes
export default React.memo(ColumnPicker)
