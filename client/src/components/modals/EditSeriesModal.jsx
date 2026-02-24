import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import { useAuth } from '../../contexts/AuthContext'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './EditSeriesModal.css'

function EditSeriesModal({ series, isOpen, onClose, onSave, onDeleteSuccess }) {
  const [editForm, setEditForm] = useState({})
  const [colors, setColors] = useState([])
  const [allSeries, setAllSeries] = useState([])
  const [seriesCards, setSeriesCards] = useState([])
  const [saving, setSaving] = useState(false)
  const [uploadingFront, setUploadingFront] = useState(false)
  const [uploadingBack, setUploadingBack] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const frontFileInputRef = useRef(null)
  const backFileInputRef = useRef(null)
  const { user } = useAuth()
  const { addToast } = useToast()

  const isAdmin = user?.role === 'admin'
  const isSuperAdmin = user?.role === 'superadmin'

  useEffect(() => {
    if (isOpen && series) {
      setEditForm({
        name: series.name || '',
        set_name: series.set_name || '',
        card_count: series.card_count || 0,
        is_base: series.is_base !== false,
        parallel_of_series: series.parallel_of_series || '',
        color_id: series.color_id || '',
        production_code: series.production_code || '',
        front_image_path: series.front_image_path || '',
        back_image_path: series.back_image_path || '',
        front_image_source: series.front_image_path ? 'custom' : 'none',
        back_image_source: series.back_image_path ? 'custom' : 'none'
      })

      loadColors()
      loadSeriesForParallel()
      loadSeriesCards()
    }
  }, [isOpen, series])

  const loadColors = async () => {
    try {
      const response = await axios.get('/api/colors')
      setColors(response.data.colors || [])
    } catch (error) {
      console.error('Error loading colors:', error)
    }
  }

  const loadSeriesForParallel = async () => {
    try {
      if (series?.set_id) {
        const response = await axios.get(`/api/sets-list/${series.set_id}/series`)
        // Filter out the current series
        const otherSeries = (response.data.series || []).filter(s => s.series_id !== series.series_id)
        setAllSeries(otherSeries)
      }
    } catch (error) {
      console.error('Error loading series:', error)
    }
  }

  const loadSeriesCards = async () => {
    try {
      if (series?.series_id) {
        // Load cards that have images for the card picker
        const response = await axios.get(`/api/cards`, {
          params: {
            series_id: series.series_id,
            has_images: true,
            limit: 50
          }
        })
        setSeriesCards(response.data.cards || [])
      }
    } catch (error) {
      console.error('Error loading series cards:', error)
    }
  }

  const handleFormChange = (field, value) => {
    setEditForm(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleImageUpload = async (file, type) => {
    if (!file) return

    const setUploading = type === 'front' ? setUploadingFront : setUploadingBack
    setUploading(true)

    try {
      const formData = new FormData()
      formData.append('image', file)
      formData.append('type', type)

      const response = await axios.post(
        `/api/admin/series/upload-images/${series.series_id}`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      const imagePath = type === 'front'
        ? response.data.front_image_path
        : response.data.back_image_path

      handleFormChange(`${type}_image_path`, imagePath)
      handleFormChange(`${type}_image_source`, 'custom')
      addToast(`${type === 'front' ? 'Front' : 'Back'} image uploaded`, 'success')
    } catch (error) {
      console.error(`Error uploading ${type} image:`, error)
      addToast(error.response?.data?.message || `Failed to upload ${type} image`, 'error')
    } finally {
      setUploading(false)
    }
  }

  const handleCardImageSelect = (cardId, type) => {
    const card = seriesCards.find(c => c.card_id === parseInt(cardId))
    if (card) {
      const imagePath = type === 'front' ? card.front_image_path : card.back_image_path
      handleFormChange(`${type}_image_path`, imagePath || '')
      handleFormChange(`${type}_image_source`, cardId ? 'card' : 'none')
      handleFormChange(`${type}_image_card_id`, cardId)
    }
  }

  const handleSave = async () => {
    if (!series) return

    try {
      setSaving(true)

      await axios.put(`/api/admin/series/${series.series_id}`, {
        name: editForm.name.trim(),
        set_id: series.set_id,
        card_count: parseInt(editForm.card_count) || 0,
        is_base: editForm.is_base,
        parallel_of_series: editForm.parallel_of_series || null,
        color_id: editForm.color_id || null,
        production_code: editForm.production_code?.trim() || null,
        front_image_path: editForm.front_image_path || null,
        back_image_path: editForm.back_image_path || null
      })

      addToast('Series updated successfully', 'success')

      if (onSave) {
        onSave()
      }

      onClose()
    } catch (error) {
      console.error('Error updating series:', error)
      addToast(error.response?.data?.message || 'Failed to update series', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setShowDeleteConfirm(false)
    setDeleteConfirmText('')
    onClose()
  }

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true)
    setDeleteConfirmText('')
  }

  const handleDeleteConfirm = async () => {
    if (!series || deleteConfirmText !== 'DELETE') return

    try {
      setDeleting(true)
      await axios.delete(`/api/admin/series/${series.series_id}`)
      addToast(`Series "${series.name}" has been permanently deleted`, 'success')
      handleClose()
      if (onDeleteSuccess) {
        onDeleteSuccess(series.series_id)
      }
    } catch (error) {
      console.error('Error deleting series:', error)
      addToast(`Failed to delete series: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setDeleting(false)
    }
  }

  if (!isOpen) return null

  // Get cards with front/back images for the picker
  const cardsWithFrontImages = seriesCards.filter(c => c.front_image_path)
  const cardsWithBackImages = seriesCards.filter(c => c.back_image_path)

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div className="edit-series-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{series?.name || 'Series'}</h3>
          <button
            className="close-btn"
            onClick={onClose}
            type="button"
          >
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="modal-content">
          <div className="edit-form">
            <div className="series-details-form">
              {/* Set Name (locked) */}
              <div className="form-field-row">
                <label className="field-label">Set</label>
                <div className="locked-field">
                  <span>{editForm.set_name}</span>
                </div>
              </div>

              {/* Series Name */}
              <div className="form-field-row">
                <label className="field-label">Series Name *</label>
                <input
                  type="text"
                  className="field-input"
                  value={editForm.name || ''}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  placeholder="e.g., Base Set, Chrome Refractor"
                />
              </div>

              {/* Card Count and Base Set toggle */}
              <div className="form-row-inline">
                <div className="form-field-row">
                  <label className="field-label">Card Count</label>
                  <input
                    type="number"
                    className="field-input"
                    value={editForm.card_count || ''}
                    onChange={(e) => handleFormChange('card_count', e.target.value)}
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div className="form-field-row">
                  <label className="field-label">Base Set?</label>
                  <button
                    type="button"
                    className={`toggle-btn ${editForm.is_base ? 'active' : ''}`}
                    onClick={() => handleFormChange('is_base', !editForm.is_base)}
                  >
                    {editForm.is_base ? 'Yes' : 'No'}
                  </button>
                </div>
              </div>

              {/* Parallel Of */}
              <div className="form-field-row">
                <label className="field-label">Parallel Of</label>
                <select
                  className="field-input"
                  value={editForm.parallel_of_series || ''}
                  onChange={(e) => handleFormChange('parallel_of_series', e.target.value)}
                >
                  <option value="">Not a parallel</option>
                  {allSeries.map(s => (
                    <option key={s.series_id} value={s.series_id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Color */}
              <div className="form-field-row">
                <label className="field-label">Color</label>
                <select
                  className="field-input"
                  value={editForm.color_id || ''}
                  onChange={(e) => handleFormChange('color_id', e.target.value)}
                >
                  <option value="">No color</option>
                  {colors.map(color => (
                    <option key={color.color_id} value={color.color_id}>
                      {color.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Production Code */}
              <div className="form-field-row">
                <label className="field-label">Production Code</label>
                <input
                  type="text"
                  className="field-input"
                  value={editForm.production_code || ''}
                  onChange={(e) => handleFormChange('production_code', e.target.value)}
                  placeholder="e.g., CMP304930"
                />
              </div>

              {/* Front Image */}
              <div className="form-field-row">
                <label className="field-label">Front Image</label>
                <div className="image-source-options">
                  <div className="image-option-row">
                    <button
                      type="button"
                      className="image-option-btn"
                      onClick={() => frontFileInputRef.current?.click()}
                      disabled={uploadingFront}
                    >
                      <Icon name="upload" size={16} />
                      {uploadingFront ? 'Uploading...' : 'Upload'}
                    </button>
                    <input
                      ref={frontFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageUpload(e.target.files[0], 'front')}
                    />

                    {cardsWithFrontImages.length > 0 && (
                      <select
                        className="field-input card-select"
                        value={editForm.front_image_card_id || ''}
                        onChange={(e) => handleCardImageSelect(e.target.value, 'front')}
                      >
                        <option value="">Select from cards...</option>
                        {cardsWithFrontImages.map(card => (
                          <option key={card.card_id} value={card.card_id}>
                            #{card.card_number} - {card.card_player_teams?.[0]?.player?.name || 'Unknown'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {editForm.front_image_path && (
                    <div className="image-preview">
                      <img src={editForm.front_image_path} alt="Front" />
                      <button
                        type="button"
                        className="clear-image-btn"
                        onClick={() => {
                          handleFormChange('front_image_path', '')
                          handleFormChange('front_image_source', 'none')
                          handleFormChange('front_image_card_id', '')
                        }}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Back Image */}
              <div className="form-field-row">
                <label className="field-label">Back Image</label>
                <div className="image-source-options">
                  <div className="image-option-row">
                    <button
                      type="button"
                      className="image-option-btn"
                      onClick={() => backFileInputRef.current?.click()}
                      disabled={uploadingBack}
                    >
                      <Icon name="upload" size={16} />
                      {uploadingBack ? 'Uploading...' : 'Upload'}
                    </button>
                    <input
                      ref={backFileInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => handleImageUpload(e.target.files[0], 'back')}
                    />

                    {cardsWithBackImages.length > 0 && (
                      <select
                        className="field-input card-select"
                        value={editForm.back_image_card_id || ''}
                        onChange={(e) => handleCardImageSelect(e.target.value, 'back')}
                      >
                        <option value="">Select from cards...</option>
                        {cardsWithBackImages.map(card => (
                          <option key={card.card_id} value={card.card_id}>
                            #{card.card_number} - {card.card_player_teams?.[0]?.player?.name || 'Unknown'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {editForm.back_image_path && (
                    <div className="image-preview">
                      <img src={editForm.back_image_path} alt="Back" />
                      <button
                        type="button"
                        className="clear-image-btn"
                        onClick={() => {
                          handleFormChange('back_image_path', '')
                          handleFormChange('back_image_source', 'none')
                          handleFormChange('back_image_card_id', '')
                        }}
                      >
                        <Icon name="x" size={14} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Section - Superadmin Only */}
        {isSuperAdmin && showDeleteConfirm && (
          <div className="edit-series-delete-section">
            <div className="edit-series-delete-warning">
              <Icon name="alert-triangle" size={24} />
              <div className="edit-series-delete-warning-content">
                <h4>DANGER: Permanent Deletion</h4>
                <p>
                  You are about to <strong>permanently delete</strong> the series "{series.name}" and ALL of its data:
                </p>
                <ul>
                  <li>All {editForm.card_count || 0} cards in this series</li>
                  <li>All user collection data for these cards</li>
                  <li>All card images and related data</li>
                </ul>
                <p className="edit-series-delete-irreversible">
                  This action is <strong>IRREVERSIBLE</strong>. There is no undo.
                </p>
              </div>
            </div>
            <div className="edit-series-delete-confirm-input">
              <label>Type DELETE to confirm:</label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                placeholder="Type DELETE"
                autoComplete="off"
              />
            </div>
            <div className="edit-series-delete-actions">
              <button
                className="edit-series-delete-cancel"
                onClick={() => {
                  setShowDeleteConfirm(false)
                  setDeleteConfirmText('')
                }}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                className="edit-series-delete-confirm"
                onClick={handleDeleteConfirm}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
              >
                {deleting ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <Icon name="trash-2" size={16} />
                    Permanently Delete Series
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        <div className="modal-footer">
          <div className={`review-notice ${isAdmin ? 'admin' : ''}`}>
            <Icon name={isAdmin ? 'zap' : 'info'} size={14} />
            <span>
              {isAdmin
                ? 'Admin mode: Your changes will take effect immediately.'
                : "Thanks for helping improve our data! We'll review your changes and let you know when they're live."}
            </span>
          </div>
          <div className="modal-actions">
            {isSuperAdmin && !showDeleteConfirm && (
              <button
                type="button"
                className="delete-btn"
                onClick={handleDeleteClick}
                disabled={saving}
              >
                <Icon name="trash-2" size={16} />
                Delete Series
              </button>
            )}
            <div className="modal-actions-right">
              <button
                type="button"
                className="cancel-btn"
                onClick={handleClose}
                disabled={saving || deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="save-btn"
                onClick={handleSave}
                disabled={saving || showDeleteConfirm || !editForm.name?.trim()}
              >
                {saving ? (
                  <>
                    <div className="card-icon-spinner small"></div>
                    {isAdmin ? 'Applying...' : 'Submitting...'}
                  </>
                ) : (
                  isAdmin ? 'Apply Changes' : 'Submit Changes'
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default EditSeriesModal
