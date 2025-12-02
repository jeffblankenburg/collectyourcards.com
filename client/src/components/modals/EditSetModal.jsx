import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'
import './EditSetModal.css'

function EditSetModal({ 
  isOpen, 
  onClose, 
  set, 
  organizations = [], 
  manufacturers = [], 
  onSaveSuccess 
}) {
  const { addToast } = useToast()
  const [editForm, setEditForm] = useState({
    name: '',
    year: '',
    organization: '',
    manufacturer: '',
    is_complete: false,
    thumbnail: ''
  })
  const [saving, setSaving] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false)

  // Initialize form when modal opens
  useEffect(() => {
    if (isOpen) {
      if (set) {
        // Edit mode - populate with existing set data
        setEditForm({
          name: set.name || '',
          year: set.year || '',
          organization: set.organization_id || '',
          manufacturer: set.manufacturer_id || '',
          is_complete: set.is_complete || false,
          thumbnail: set.thumbnail || ''
        })
      } else {
        // Add mode - reset to empty form
        setEditForm({
          name: '',
          year: '',
          organization: '',
          manufacturer: '',
          is_complete: false,
          thumbnail: ''
        })
      }
      setSelectedFile(null)
    }
  }, [set, isOpen])

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

  const handleThumbnailUpload = async (file, setId) => {
    if (!file || !setId) return null

    try {
      setUploadingThumbnail(true)

      const formData = new FormData()
      formData.append('thumbnail', file)
      formData.append('setId', setId)

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

  const handleSave = async () => {
    // Validate required fields
    if (!editForm.name.trim()) {
      addToast('Set name is required', 'error')
      return
    }

    try {
      setSaving(true)

      let savedSet

      if (set) {
        // Edit mode - update existing set
        // Upload thumbnail first if a new file was selected
        let thumbnailUrl = editForm.thumbnail
        if (selectedFile) {
          thumbnailUrl = await handleThumbnailUpload(selectedFile, set.set_id)
          if (!thumbnailUrl) {
            return
          }
        }

        const setData = {
          name: editForm.name.trim(),
          year: parseInt(editForm.year) || null,
          organization: editForm.organization || null,
          manufacturer: editForm.manufacturer || null,
          is_complete: editForm.is_complete,
          thumbnail: thumbnailUrl
        }

        const response = await axios.put(`/api/admin/sets/${set.set_id}`, setData)
        savedSet = response.data.set
        addToast('Set updated successfully', 'success')
      } else {
        // Add mode - create new set first (without thumbnail)
        const setData = {
          name: editForm.name.trim(),
          year: parseInt(editForm.year) || null,
          organization: editForm.organization || null,
          manufacturer: editForm.manufacturer || null,
          is_complete: editForm.is_complete,
          thumbnail: null
        }

        const response = await axios.post('/api/admin/sets', setData)
        savedSet = response.data.set
        addToast('Set created successfully', 'success')

        // Upload thumbnail after set is created (if file selected)
        if (selectedFile && savedSet?.set_id) {
          const thumbnailUrl = await handleThumbnailUpload(selectedFile, savedSet.set_id)
          if (thumbnailUrl) {
            // Update set with thumbnail URL
            await axios.put(`/api/admin/sets/${savedSet.set_id}`, {
              ...setData,
              thumbnail: thumbnailUrl
            })
          }
        }

        // Auto-create a series with the same name
        try {
          const seriesData = {
            name: setData.name,
            set_id: Number(savedSet.set_id), // Convert BigInt to Number and use correct field name
            is_base: true
          }
          await axios.post('/api/admin/series', seriesData)
          addToast(`Series "${setData.name}" auto-created`, 'success')
        } catch (seriesError) {
          console.error('Error auto-creating series:', seriesError)
          addToast(`Set created but series creation failed: ${seriesError.response?.data?.message || seriesError.message}`, 'error')
        }
      }

      onClose()

      if (onSaveSuccess) {
        onSaveSuccess()
      }

    } catch (error) {
      console.error('Error updating set:', error)
      addToast(`Failed to update set: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setSelectedFile(null)
    setUploadingThumbnail(false)
    setSaving(false)
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="edit-set-overlay" onClick={handleClose}>
      <div className="edit-set-modal" onClick={(e) => e.stopPropagation()}>
        <div className="edit-set-header">
          <h3>{set ? `Edit Set #${set.set_id}` : 'Add New Set'}</h3>
          <button className="edit-set-close" onClick={handleClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="edit-set-form">
          <div className="edit-set-row">
            <label>
              Name
              <input
                type="text"
                value={editForm.name}
                onChange={(e) => handleFormChange('name', e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Set name"
              />
            </label>
          </div>

          <div className="edit-set-row">
            <label>
              Year
              <input
                type="number"
                value={editForm.year}
                onChange={(e) => handleFormChange('year', e.target.value)}
                onKeyDown={handleKeyDown}
                min="1900"
                max="2100"
                placeholder="e.g. 2024"
              />
            </label>
          </div>

          <div className="edit-set-row">
            <label>
              Organization
              <select
                value={editForm.organization}
                onChange={(e) => handleFormChange('organization', e.target.value)}
                onKeyDown={handleKeyDown}
              >
                <option value="">Select organization...</option>
                {organizations.map(org => (
                  <option key={org.organization_id} value={org.organization_id}>
                    {org.name} ({org.abbreviation})
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="edit-set-row">
            <label>
              Manufacturer
              <select
                value={editForm.manufacturer}
                onChange={(e) => handleFormChange('manufacturer', e.target.value)}
                onKeyDown={handleKeyDown}
              >
                <option value="">Select manufacturer...</option>
                {manufacturers.map(mfg => (
                  <option key={mfg.manufacturer_id} value={mfg.manufacturer_id}>
                    {mfg.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="edit-set-row">
            <label>
              Status
              <button
                type="button"
                className={`edit-set-toggle ${editForm.is_complete ? 'active' : ''}`}
                onClick={() => handleFormChange('is_complete', !editForm.is_complete)}
              >
                <Icon name="check-circle" size={16} />
                <span>Set is complete</span>
                {editForm.is_complete && <Icon name="check" size={16} className="toggle-check" />}
              </button>
            </label>
          </div>

          <div className="edit-set-row">
            <label>
              Thumbnail
              <div className="edit-set-thumbnail-section">
                {editForm.thumbnail && (
                  <div className="edit-set-current-thumbnail">
                    <img
                      src={editForm.thumbnail}
                      alt="Current thumbnail"
                    />
                    <span className="edit-set-thumbnail-label">Current thumbnail</span>
                  </div>
                )}
                <div
                  className="edit-set-thumbnail-upload"
                  onClick={() => document.getElementById('thumbnail-input').click()}
                >
                  <input
                    id="thumbnail-input"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0]
                      setSelectedFile(file)
                      if (file) {
                        const previewUrl = URL.createObjectURL(file)
                        handleFormChange('thumbnail', previewUrl)
                      }
                    }}
                    style={{ display: 'none' }}
                  />
                  <span>
                    {selectedFile ? selectedFile.name : (editForm.thumbnail ? 'Change thumbnail...' : 'Choose image file...')}
                  </span>
                  {uploadingThumbnail && <span className="edit-set-upload-status">Uploading...</span>}
                </div>
              </div>
            </label>
          </div>
        </div>

        <div className="edit-set-actions">
          <button className="edit-set-cancel" onClick={handleClose} disabled={saving}>
            Cancel
          </button>
          <button
            className="edit-set-save"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <div className="edit-set-spinner"></div>
                Saving...
              </>
            ) : (
              <>
                <Icon name="check" size={16} />
                {set ? 'Save Changes' : 'Create Set'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

export default EditSetModal