import React, { useState, useEffect, useRef } from 'react'
import Icon from './Icon'
import axios from 'axios'
import { useToast } from '../contexts/ToastContext'
import './SavedViewsDropdown.css'

const SavedViewsDropdown = ({
  onSaveNewView,
  onLoadView,
  currentFilterConfig
}) => {
  const { success, error } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [savedViews, setSavedViews] = useState([])
  const [loading, setLoading] = useState(false)
  const [deletingViewId, setDeletingViewId] = useState(null)
  const dropdownRef = useRef(null)

  // Fetch saved views when dropdown opens
  useEffect(() => {
    if (isOpen) {
      fetchSavedViews()
    }
  }, [isOpen])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const fetchSavedViews = async () => {
    try {
      setLoading(true)
      const response = await axios.get('/api/collection-views')
      if (response.data.success) {
        setSavedViews(response.data.views || [])
      }
    } catch (error) {
      console.error('Error fetching saved views:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteClick = (viewId, event) => {
    event.stopPropagation()
    setDeletingViewId(viewId)
  }

  const handleConfirmDelete = async (viewId, event) => {
    event.stopPropagation()

    try {
      await axios.delete(`/api/collection-views/${viewId}`)
      success('View deleted successfully')
      // Refresh the list
      fetchSavedViews()
      setDeletingViewId(null)
    } catch (err) {
      console.error('Error deleting view:', err)
      error('Failed to delete view')
    }
  }

  const handleCancelDelete = (event) => {
    event.stopPropagation()
    setDeletingViewId(null)
  }

  const handleCopyShareLink = (view, event) => {
    event.stopPropagation()

    const shareUrl = `${window.location.origin}/shared/${view.slug}`

    navigator.clipboard.writeText(shareUrl).then(() => {
      success('Share link copied to clipboard!')
    }).catch(err => {
      console.error('Failed to copy share link:', err)
      error('Failed to copy share link')
    })
  }

  const formatViewSummary = (view) => {
    const config = view.filter_config
    const parts = []

    if (config.locationIds?.length > 0) {
      parts.push(`${config.locationIds.length} location${config.locationIds.length > 1 ? 's' : ''}`)
    }

    if (config.teamIds?.length > 0) {
      parts.push(`${config.teamIds.length} team${config.teamIds.length > 1 ? 's' : ''}`)
    }

    const activeFilters = []
    if (config.filters?.rookies) activeFilters.push('Rookies')
    if (config.filters?.autos) activeFilters.push('Autos')
    if (config.filters?.relics) activeFilters.push('Relics')
    if (config.filters?.graded) activeFilters.push('Graded')

    if (activeFilters.length > 0) {
      parts.push(activeFilters.join(', '))
    }

    return parts.length > 0 ? parts.join(' • ') : 'No filters'
  }

  return (
    <div className="saved-views-dropdown" ref={dropdownRef}>
      <button
        className="save-view-btn"
        onClick={() => setIsOpen(!isOpen)}
        title="Manage saved views"
      >
        <Icon name="bookmark" size={16} />
        <span>Saved Views</span>
        <Icon name={isOpen ? "chevron-up" : "chevron-down"} size={14} />
      </button>

      {isOpen && (
        <div className="saved-views-menu">
          {/* Save Current View Option */}
          <div className="saved-views-section">
            <button
              className="saved-view-action save-new"
              onClick={() => {
                setIsOpen(false)
                onSaveNewView()
              }}
            >
              <Icon name="plus" size={16} />
              <span>Save Current View</span>
            </button>
          </div>

          {/* Divider */}
          {savedViews.length > 0 && <div className="saved-views-divider" />}

          {/* Saved Views List */}
          <div className="saved-views-section">
            {loading ? (
              <div className="saved-views-loading">
                <Icon name="activity" size={16} className="spinner" />
                <span>Loading...</span>
              </div>
            ) : savedViews.length === 0 ? (
              <div className="saved-views-empty">
                <Icon name="inbox" size={24} />
                <span>No saved views yet</span>
              </div>
            ) : (
              <div className="saved-views-list">
                {savedViews.map(view => (
                  <div
                    key={view.collection_view_id}
                    className={`saved-view-item ${deletingViewId === view.collection_view_id ? 'deleting' : ''}`}
                    onClick={() => {
                      if (deletingViewId !== view.collection_view_id) {
                        setIsOpen(false)
                        onLoadView(view)
                      }
                    }}
                  >
                    <div className="saved-view-info">
                      <div className="saved-view-name">
                        {view.name}
                        {view.is_public && (
                          <>
                            <span className="public-badge" title="Public view">
                              <Icon name="share-2" size={12} />
                            </span>
                            <button
                              className="copy-share-link-btn"
                              onClick={(e) => handleCopyShareLink(view, e)}
                              title="Copy share link"
                            >
                              <Icon name="link" size={12} />
                            </button>
                          </>
                        )}
                      </div>
                      <div className="saved-view-summary">
                        {formatViewSummary(view)}
                      </div>
                      {view.view_count > 0 && (
                        <div className="saved-view-stats">
                          <Icon name="eye" size={12} />
                          <span>{view.view_count} views</span>
                        </div>
                      )}
                    </div>
                    {deletingViewId === view.collection_view_id ? (
                      <div className="delete-confirm-actions">
                        <button
                          className="confirm-delete-btn"
                          onClick={(e) => handleConfirmDelete(view.collection_view_id, e)}
                          title="Confirm delete"
                        >
                          <Icon name="check" size={14} />
                        </button>
                        <button
                          className="cancel-delete-btn"
                          onClick={handleCancelDelete}
                          title="Cancel"
                        >
                          <Icon name="x" size={14} />
                        </button>
                      </div>
                    ) : (
                      <button
                        className="delete-view-btn"
                        onClick={(e) => handleDeleteClick(view.collection_view_id, e)}
                        title="Delete view"
                      >
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default SavedViewsDropdown
