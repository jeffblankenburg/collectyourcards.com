import React, { useState } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import { COLLECTION_TABLE_COLUMNS, getDefaultVisibleColumns } from '../../utils/tableColumnDefinitions'
import './SaveViewModal.css'

/**
 * SaveViewModal - Modal for saving current collection filters as a shareable view
 *
 * @param {boolean} isOpen - Whether the modal is open
 * @param {function} onClose - Callback to close the modal
 * @param {object} filterConfig - Current filter configuration to save
 * @param {function} onViewSaved - Callback after view is saved successfully
 */
function SaveViewModal({ isOpen, onClose, filterConfig, onViewSaved }) {
  const { success, error: showError } = useToast()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isPublic, setIsPublic] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedView, setSavedView] = useState(null) // Store saved view to show share link
  const [visibleColumns, setVisibleColumns] = useState(
    getDefaultVisibleColumns('collection_table')
  )
  const [showColumnPicker, setShowColumnPicker] = useState(false) // Toggle for column picker section

  const handleColumnToggle = (columnId) => {
    const column = COLLECTION_TABLE_COLUMNS[columnId]

    // Prevent toggling alwaysVisible columns
    if (column?.alwaysVisible) {
      return
    }

    setVisibleColumns(prev =>
      prev.includes(columnId)
        ? prev.filter(id => id !== columnId)
        : [...prev, columnId]
    )
  }

  const handleSave = async () => {
    if (!name.trim()) {
      showError('Please enter a name for this view')
      return
    }

    try {
      setSaving(true)

      // Include visible_columns in the filter_config
      const configWithColumns = {
        ...filterConfig,
        visible_columns: visibleColumns
      }

      const response = await axios.post('/api/collection-views', {
        name: name.trim(),
        description: description.trim() || null,
        filter_config: configWithColumns,
        is_public: isPublic
      })

      if (response.data.success) {
        setSavedView(response.data.view)
        success(`View "${name}" saved successfully!`)

        // Call parent callback
        if (onViewSaved) {
          onViewSaved(response.data.view)
        }
      }
    } catch (err) {
      console.error('Error saving view:', err)
      showError(err.response?.data?.error || 'Failed to save view')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setName('')
    setDescription('')
    setIsPublic(true)
    setSavedView(null)
    setVisibleColumns(getDefaultVisibleColumns('collection_table'))
    setShowColumnPicker(false)
    onClose()
  }

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text)
    success('Link copied to clipboard!')
  }

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="save-view-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{savedView ? 'View Saved!' : 'Save Current View'}</h3>
          <button className="close-btn" onClick={handleClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="modal-body">
          {!savedView ? (
            <>
              <p className="modal-description">
                Save your current filters and selections as a shareable collection view.
                Your view will automatically update when you add or remove cards.
              </p>

              <div className="form-group">
                <label>View Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Toronto Blue Jays Rookies"
                  autoFocus
                  maxLength={100}
                />
              </div>

              <div className="form-group">
                <label>Description (optional)</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what makes this collection special..."
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(e) => setIsPublic(e.target.checked)}
                  />
                  <span>Make this view public (anyone with the link can view)</span>
                </label>
              </div>

              {/* Show current filter summary */}
              <div className="filter-summary">
                <h4>Current Filters:</h4>
                <ul>
                  {filterConfig.locationIds && filterConfig.locationIds.length > 0 && (
                    <li>{filterConfig.locationIds.length} location(s) selected</li>
                  )}
                  {filterConfig.teamIds && filterConfig.teamIds.length > 0 && (
                    <li>{filterConfig.teamIds.length} team(s) selected</li>
                  )}
                  {filterConfig.filters?.rookies && <li>Rookie cards only</li>}
                  {filterConfig.filters?.autos && <li>Autograph cards only</li>}
                  {filterConfig.filters?.relics && <li>Relic cards only</li>}
                  {filterConfig.filters?.graded && <li>Graded cards only</li>}
                  {(!filterConfig.locationIds || filterConfig.locationIds.length === 0) &&
                   (!filterConfig.teamIds || filterConfig.teamIds.length === 0) &&
                   !filterConfig.filters?.rookies &&
                   !filterConfig.filters?.autos &&
                   !filterConfig.filters?.relics &&
                   !filterConfig.filters?.graded && (
                    <li>All cards (no filters applied)</li>
                  )}
                </ul>
              </div>

              {/* Column visibility selection */}
              <div className="column-picker-section">
                <button
                  type="button"
                  className="column-picker-toggle"
                  onClick={() => setShowColumnPicker(!showColumnPicker)}
                >
                  <Icon name={showColumnPicker ? 'chevron-down' : 'chevron-right'} size={16} />
                  <span>Visible Columns ({visibleColumns.length}/{Object.keys(COLLECTION_TABLE_COLUMNS).length})</span>
                </button>

                {showColumnPicker && (
                  <div className="column-picker-list">
                    {Object.values(COLLECTION_TABLE_COLUMNS).map(column => {
                      const isVisible = visibleColumns.includes(column.id)
                      const isRequired = column.alwaysVisible

                      return (
                        <label
                          key={column.id}
                          className={`column-picker-item ${isRequired ? 'required' : ''}`}
                          title={column.description}
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() => handleColumnToggle(column.id)}
                            disabled={isRequired}
                          />
                          <span className="column-picker-item-label">
                            {column.label}
                            {isRequired && (
                              <span className="required-badge">Required</span>
                            )}
                          </span>
                        </label>
                      )
                    })}
                  </div>
                )}
                <p className="column-picker-help">
                  Choose which columns viewers will see in the shared view
                </p>
              </div>
            </>
          ) : (
            <>
              <div className="success-message">
                <Icon name="check-circle" size={48} className="success-icon" />
                <p>Your collection view has been saved and is ready to share!</p>
              </div>

              <div className="share-link-section">
                <label>Shareable Link:</label>
                <div className="share-link-input">
                  <input
                    type="text"
                    value={savedView.shortlink}
                    readOnly
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    className="copy-button"
                    onClick={() => copyToClipboard(savedView.shortlink)}
                    title="Copy link"
                  >
                    <Icon name="copy" size={16} />
                  </button>
                </div>
              </div>

              <div className="share-options">
                <a
                  href={savedView.shortlink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="preview-link"
                >
                  <Icon name="external-link" size={16} />
                  Preview View
                </a>
              </div>
            </>
          )}
        </div>

        <div className="modal-actions">
          {!savedView ? (
            <>
              <button className="cancel-btn" onClick={handleClose} disabled={saving}>
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleSave}
                disabled={saving || !name.trim()}
              >
                {saving ? (
                  <>
                    <div className="spinner-small"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Icon name="check" size={16} />
                    Save View
                  </>
                )}
              </button>
            </>
          ) : (
            <button className="done-btn" onClick={handleClose}>
              <Icon name="check" size={16} />
              Done
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default SaveViewModal
