import React, { useState, useRef, useImperativeHandle, forwardRef } from 'react'
import Icon from './Icon'
import './MultiImageUploader.css'

/**
 * MultiImageUploader - eBay-style multi-image uploader for card front/back images
 *
 * Features:
 * - Upload multiple images at once (front and back)
 * - Drag-and-drop reordering (first image = front, second = back)
 * - Preview images before saving
 * - Edit button to open image editor
 * - Single "Save All" action
 *
 * Props:
 * - existingImages: { front: url|null, back: url|null }
 * - onSave: (images: { front: File|null, back: File|null, frontEdited: Blob|null, backEdited: Blob|null }) => Promise<void>
 * - onEditImage: (imageUrl: string, side: 'front'|'back') => void
 * - onDeleteImage: (side: 'front'|'back') => Promise<void>
 * - onMessage: (message: string, type: 'info'|'warning'|'error') => void - optional callback for user feedback
 * - disabled: boolean
 * - maxImages: number (default 2 for front/back)
 *
 * Ref Methods:
 * - hasStagedImages(): boolean - returns true if there are unsaved staged images
 * - saveStagedImages(): Promise<void> - triggers upload of staged images
 */
const MultiImageUploader = forwardRef(({
  existingImages = { front: null, back: null },
  onSave,
  onEditImage,
  onDeleteImage,
  onMessage,
  disabled = false,
  maxImages = 2
}, ref) => {
  // Track staged images (files to upload)
  const [stagedImages, setStagedImages] = useState([])
  const [draggedIndex, setDraggedIndex] = useState(null)
  const [dragOverIndex, setDragOverIndex] = useState(null)
  const [saving, setSaving] = useState(false)
  const [deletingImage, setDeletingImage] = useState(null)
  const [confirmDeleteSide, setConfirmDeleteSide] = useState(null)
  const fileInputRef = useRef(null)

  // Combine existing and staged images for display
  const existingCount = (existingImages.front ? 1 : 0) + (existingImages.back ? 1 : 0)
  const totalCount = existingCount + stagedImages.length
  const canAddMore = totalCount < maxImages

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    if (files.length === 0) return

    // Calculate how many we can add
    const slotsAvailable = maxImages - totalCount

    // Notify if some files will be skipped
    if (files.length > slotsAvailable) {
      const skipped = files.length - slotsAvailable
      onMessage?.(`Only ${slotsAvailable} image slot${slotsAvailable !== 1 ? 's' : ''} available. ${skipped} image${skipped !== 1 ? 's' : ''} skipped.`, 'warning')
    }

    const filesToAdd = files.slice(0, slotsAvailable)

    // Validate files
    const validFiles = []
    for (const file of filesToAdd) {
      if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
        onMessage?.(`${file.name}: Only JPEG, PNG, and WebP images are allowed`, 'error')
        continue
      }
      if (file.size > 10 * 1024 * 1024) {
        onMessage?.(`${file.name}: File size must be less than 10MB`, 'error')
        continue
      }
      validFiles.push({
        file,
        previewUrl: URL.createObjectURL(file),
        id: `staged-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      })
    }

    if (validFiles.length > 0) {
      setStagedImages(prev => [...prev, ...validFiles])
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Remove a staged image
  const handleRemoveStaged = (index) => {
    setStagedImages(prev => {
      const newList = [...prev]
      const removed = newList.splice(index, 1)[0]
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl)
      }
      return newList
    })
  }

  // Drag and drop handlers for staged images
  const handleDragStart = (e, index) => {
    setDraggedIndex(index)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', index.toString())
  }

  const handleDragOver = (e, index) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverIndex(index)
  }

  const handleDragLeave = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragOverIndex(null)
    }
  }

  const handleDragEnd = () => {
    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  const handleDrop = (e, targetIndex) => {
    e.preventDefault()

    if (draggedIndex === null || draggedIndex === targetIndex) {
      setDraggedIndex(null)
      setDragOverIndex(null)
      return
    }

    setStagedImages(prev => {
      const newList = [...prev]
      const [draggedItem] = newList.splice(draggedIndex, 1)
      newList.splice(targetIndex, 0, draggedItem)
      return newList
    })

    setDraggedIndex(null)
    setDragOverIndex(null)
  }

  // Save all staged images
  const handleSaveAll = async () => {
    if (stagedImages.length === 0 || !onSave) return

    setSaving(true)
    try {
      // Map staged images to front/back based on existing images
      const images = { front: null, back: null }

      // If no existing front, first staged becomes front
      // If no existing back, next staged becomes back
      let stagedIndex = 0

      if (!existingImages.front && stagedImages[stagedIndex]) {
        images.front = stagedImages[stagedIndex].file
        stagedIndex++
      }

      if (!existingImages.back && stagedImages[stagedIndex]) {
        images.back = stagedImages[stagedIndex].file
        stagedIndex++
      }

      await onSave(images)

      // Clear staged images after successful save
      stagedImages.forEach(img => {
        if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
      })
      setStagedImages([])
    } finally {
      setSaving(false)
    }
  }

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    hasStagedImages: () => stagedImages.length > 0,
    saveStagedImages: handleSaveAll
  }), [stagedImages, handleSaveAll])

  // Handle delete with confirmation
  const handleDeleteClick = (side) => {
    setConfirmDeleteSide(side)
  }

  const handleConfirmDelete = async (side) => {
    if (!onDeleteImage) return

    setDeletingImage(side)
    try {
      await onDeleteImage(side)
    } finally {
      setDeletingImage(null)
      setConfirmDeleteSide(null)
    }
  }

  const handleCancelDelete = () => {
    setConfirmDeleteSide(null)
  }

  // Get label for image slot
  const getSlotLabel = (index, isExisting, side) => {
    if (isExisting) {
      return side === 'front' ? 'Front' : 'Back'
    }
    // For staged images, calculate what slot they'll fill
    const frontExists = existingImages.front
    const backExists = existingImages.back

    if (!frontExists && index === 0) return 'Front'
    if (!backExists && ((!frontExists && index === 1) || (frontExists && index === 0))) return 'Back'
    return index === 0 ? 'Front' : 'Back'
  }

  return (
    <div className="multi-image-uploader">
      <div className="multi-image-uploader-header">
        <span className="multi-image-uploader-title">
          <Icon name="image" size={16} />
          Card Images
        </span>
      </div>

      <div className="multi-image-uploader-grid">
        {/* Existing Front Image */}
        {existingImages.front && (
          <div className="multi-image-uploader-slot existing">
            <div className="multi-image-uploader-label">Front</div>
            <div className="multi-image-uploader-preview">
              <img src={existingImages.front} alt="Front" />
              <div className="multi-image-uploader-overlay">
                {confirmDeleteSide === 'front' ? (
                  <div className="multi-image-uploader-confirm-delete">
                    <button
                      type="button"
                      className="multi-image-uploader-confirm-btn"
                      onClick={() => handleConfirmDelete('front')}
                      disabled={deletingImage === 'front'}
                    >
                      {deletingImage === 'front' ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                      type="button"
                      className="multi-image-uploader-cancel-delete-btn"
                      onClick={handleCancelDelete}
                      disabled={deletingImage === 'front'}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="multi-image-uploader-edit-btn"
                      onClick={() => onEditImage?.(existingImages.front, 'front')}
                      disabled={disabled}
                    >
                      <Icon name="edit" size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="multi-image-uploader-delete-btn"
                      onClick={() => handleDeleteClick('front')}
                      disabled={disabled}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Existing Back Image */}
        {existingImages.back && (
          <div className="multi-image-uploader-slot existing">
            <div className="multi-image-uploader-label">Back</div>
            <div className="multi-image-uploader-preview">
              <img src={existingImages.back} alt="Back" />
              <div className="multi-image-uploader-overlay">
                {confirmDeleteSide === 'back' ? (
                  <div className="multi-image-uploader-confirm-delete">
                    <button
                      type="button"
                      className="multi-image-uploader-confirm-btn"
                      onClick={() => handleConfirmDelete('back')}
                      disabled={deletingImage === 'back'}
                    >
                      {deletingImage === 'back' ? 'Deleting...' : 'Yes, Delete'}
                    </button>
                    <button
                      type="button"
                      className="multi-image-uploader-cancel-delete-btn"
                      onClick={handleCancelDelete}
                      disabled={deletingImage === 'back'}
                    >
                      <Icon name="x" size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="button"
                      className="multi-image-uploader-edit-btn"
                      onClick={() => onEditImage?.(existingImages.back, 'back')}
                      disabled={disabled}
                    >
                      <Icon name="edit" size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="multi-image-uploader-delete-btn"
                      onClick={() => handleDeleteClick('back')}
                      disabled={disabled}
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Staged Images (to be uploaded) */}
        {stagedImages.map((img, index) => (
          <div
            key={img.id}
            className={`multi-image-uploader-slot staged ${dragOverIndex === index ? 'drag-over' : ''} ${draggedIndex === index ? 'dragging' : ''}`}
            draggable={!disabled && stagedImages.length > 1}
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={(e) => handleDragOver(e, index)}
            onDragLeave={handleDragLeave}
            onDragEnd={handleDragEnd}
            onDrop={(e) => handleDrop(e, index)}
          >
            <div className="multi-image-uploader-label">
              {getSlotLabel(index, false)}
              <span className="multi-image-uploader-new-badge">New</span>
            </div>
            <div className="multi-image-uploader-preview">
              <img src={img.previewUrl} alt={`Preview ${index + 1}`} />
              {stagedImages.length > 1 && (
                <div className="multi-image-uploader-drag-hint">
                  <Icon name="grip-vertical" size={16} />
                </div>
              )}
              <button
                type="button"
                className="multi-image-uploader-remove-btn"
                onClick={() => handleRemoveStaged(index)}
                disabled={disabled || saving}
              >
                <Icon name="x" size={14} />
              </button>
            </div>
          </div>
        ))}

        {/* Add Image Slot */}
        {canAddMore && (
          <div className="multi-image-uploader-slot add-slot">
            <div className="multi-image-uploader-label">
              {!existingImages.front && stagedImages.length === 0 ? 'Front' :
               !existingImages.back && (stagedImages.length === 0 || (!existingImages.front && stagedImages.length === 1)) ? 'Back' :
               'Add Image'}
            </div>
            <label className="multi-image-uploader-dropzone">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                multiple={canAddMore && (maxImages - totalCount) > 1}
                onChange={handleFileSelect}
                disabled={disabled || saving}
              />
              <Icon name="plus" size={28} />
              <span>
                {totalCount === 0
                  ? 'Add Front & Back'
                  : canAddMore
                    ? `Add ${!existingImages.front && !stagedImages.length ? 'Front' : 'Back'} Image`
                    : ''}
              </span>
              <span className="multi-image-uploader-hint">
                Click or drag images here
              </span>
            </label>
          </div>
        )}
      </div>

      {/* Save button when there are staged images */}
      {stagedImages.length > 0 && (
        <div className="multi-image-uploader-actions">
          <button
            type="button"
            className="multi-image-uploader-clear-btn"
            onClick={() => {
              stagedImages.forEach(img => {
                if (img.previewUrl) URL.revokeObjectURL(img.previewUrl)
              })
              setStagedImages([])
            }}
            disabled={saving}
          >
            Clear All
          </button>
          <button
            type="button"
            className="multi-image-uploader-save-btn"
            onClick={handleSaveAll}
            disabled={disabled || saving}
          >
            {saving ? (
              <>
                <div className="card-icon-spinner tiny" />
                Uploading...
              </>
            ) : (
              <>
                <Icon name="upload" size={16} />
                Save {stagedImages.length} Image{stagedImages.length > 1 ? 's' : ''}
              </>
            )}
          </button>
        </div>
      )}

      {/* Instructions */}
      <div className="multi-image-uploader-instructions">
        <p>
          <Icon name="info" size={14} />
          First image = Front, Second image = Back. Drag to reorder before saving.
        </p>
      </div>
    </div>
  )
})

export default MultiImageUploader
