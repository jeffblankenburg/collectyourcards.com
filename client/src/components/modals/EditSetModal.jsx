import React, { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../../contexts/ToastContext'
import Icon from '../Icon'

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

  // Reinitialize form when set changes
  useEffect(() => {
    if (set && isOpen) {
      setEditForm({
        name: set.name || '',
        year: set.year || '',
        organization: set.organization_id || '',
        manufacturer: set.manufacturer_id || '',
        is_complete: set.is_complete || false,
        thumbnail: set.thumbnail || ''
      })
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

  const handleThumbnailUpload = async (file) => {
    if (!file) return null
    
    try {
      setUploadingThumbnail(true)
      
      const formData = new FormData()
      formData.append('thumbnail', file)
      formData.append('setId', set.set_id)
      
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
    if (!set) return

    try {
      setSaving(true)
      
      let thumbnailUrl = editForm.thumbnail
      if (selectedFile) {
        thumbnailUrl = await handleThumbnailUpload(selectedFile)
        if (!thumbnailUrl) {
          return
        }
      }
      
      const updateData = {
        name: editForm.name.trim(),
        year: parseInt(editForm.year) || null,
        organization: editForm.organization || null,
        manufacturer: editForm.manufacturer || null,
        is_complete: editForm.is_complete,
        thumbnail: thumbnailUrl
      }

      await axios.put(`/api/admin/sets/${set.set_id}`, updateData)
      addToast('Set updated successfully', 'success')
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

  if (!isOpen || !set) return null

  return (
    <div className="admin-sets-page">
      <div className="modal-overlay" onClick={handleClose}>
        <div className="edit-player-modal" onClick={(e) => e.stopPropagation()}>
          <div className="modal-header">
            <h3>Edit Set #{set.set_id}</h3>
            <button className="close-btn" onClick={handleClose}>
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
                    onChange={(e) => handleFormChange('name', e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Set name"
                  />
                </div>

                <div className="form-field-row">
                  <label className="field-label">Year</label>
                  <input
                    type="number"
                    className="field-input"
                    value={editForm.year}
                    onChange={(e) => handleFormChange('year', e.target.value)}
                    onKeyDown={handleKeyDown}
                    min="1900"
                    max="2100"
                  />
                </div>

                <div className="form-field-row">
                  <label className="field-label">Organization</label>
                  <select
                    className="field-input"
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
                </div>

                <div className="form-field-row">
                  <label className="field-label">Manufacturer</label>
                  <select
                    className="field-input"
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
                </div>

                <div className="form-field-row">
                  <label className="field-label">Complete</label>
                  <button
                    type="button"
                    className={`hof-toggle ${editForm.is_complete ? 'hof-active' : ''}`}
                    onClick={() => handleFormChange('is_complete', !editForm.is_complete)}
                  >
                    <Icon name="check-circle" size={16} />
                    <span>Set is complete</span>
                    {editForm.is_complete && <Icon name="check" size={16} className="hof-check" />}
                  </button>
                </div>

                <div className="form-field-row">
                  <label className="field-label">Thumbnail</label>
                  <div className="thumbnail-section">
                    {editForm.thumbnail && (
                      <div className="current-thumbnail">
                        <img 
                          src={editForm.thumbnail} 
                          alt="Current thumbnail"
                        />
                        <span className="thumbnail-label">Current thumbnail</span>
                      </div>
                    )}
                    <div className="thumbnail-upload" onClick={() => document.getElementById('thumbnail-input').click()}>
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
                        className="file-input"
                        style={{ display: 'none' }}
                      />
                      <span className="upload-text">
                        {selectedFile ? selectedFile.name : (editForm.thumbnail ? 'Change thumbnail...' : 'Choose image file...')}
                      </span>
                      {uploadingThumbnail && <span className="upload-status">Uploading...</span>}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div className="modal-actions">
            <button className="cancel-btn" onClick={handleClose} disabled={saving}>
              Cancel
            </button>
            <button 
              className="save-btn" 
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? (
                <>
                  <div className="card-icon-spinner small"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Icon name="check" size={16} />
                  Save Changes
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EditSetModal