import React, { useState, useRef, useCallback } from 'react'
import axios from 'axios'
import Icon from './Icon'
import ImageEditor from './ImageEditor'
import { useToast } from '../contexts/ToastContext'
import './BulkImageUpload.css'

/**
 * BulkImageUpload - Full-screen bulk image upload and assignment interface
 *
 * Workflow:
 * 1. User uploads many images at once
 * 2. Images display in a grid on the left
 * 3. User selects 1-2 images, then clicks a card row to assign
 * 4. Assigned images disappear from grid
 * 5. Undo button reverses last assignment
 */
const BulkImageUpload = ({
  cards,
  seriesName,
  onClose,
  onCardUpdate
}) => {
  const { addToast } = useToast()
  const fileInputRef = useRef(null)

  // All uploaded images (not yet assigned)
  const [images, setImages] = useState([])
  // Currently selected image IDs (max 2)
  const [selectedImageIds, setSelectedImageIds] = useState([])
  // Undo stack - each entry: { cardId, front: imageData|null, back: imageData|null, previousFront, previousBack }
  const [undoStack, setUndoStack] = useState([])
  // Loading state for assignment
  const [assigning, setAssigning] = useState(false)
  // Search/filter for cards
  const [cardSearch, setCardSearch] = useState('')
  // Track which cards have been assigned images in this session
  const [assignedCardIds, setAssignedCardIds] = useState(new Set())
  // Image editor state
  const [showImageEditor, setShowImageEditor] = useState(false)
  const [editingImageId, setEditingImageId] = useState(null)

  // Helper to get player names from card_player_teams
  const getPlayerNames = (card) => {
    if (!card.card_player_teams || card.card_player_teams.length === 0) {
      return 'Unknown'
    }
    return card.card_player_teams
      .map(pt => pt.player?.name || `${pt.player?.first_name || ''} ${pt.player?.last_name || ''}`.trim())
      .filter(Boolean)
      .join(', ')
  }

  // Filter cards based on search
  const filteredCards = cards.filter(card => {
    if (!cardSearch.trim()) return true
    const search = cardSearch.toLowerCase()
    const cardNumber = (card.card_number || '').toLowerCase()
    const playerNames = getPlayerNames(card).toLowerCase()
    return cardNumber.includes(search) || playerNames.includes(search)
  })

  // Handle file selection
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    console.log('Files selected:', files.length, files.map(f => ({ name: f.name, type: f.type, size: f.size })))
    if (files.length === 0) return

    const newImages = []
    let skippedType = 0
    let skippedSize = 0

    files.forEach((file, index) => {
      // Validate file type - accept common image types
      const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
      if (!validTypes.includes(file.type)) {
        console.log('Skipping file due to type:', file.name, file.type)
        skippedType++
        return
      }
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        console.log('Skipping file due to size:', file.name, file.size)
        skippedSize++
        return
      }

      const id = `img-${Date.now()}-${index}-${Math.random().toString(36).substr(2, 9)}`
      const previewUrl = URL.createObjectURL(file)

      newImages.push({
        id,
        file,
        previewUrl,
        name: file.name
      })
    })

    console.log('Valid images to add:', newImages.length)

    if (newImages.length > 0) {
      setImages(prev => {
        const updated = [...prev, ...newImages]
        console.log('Total images after update:', updated.length)
        return updated
      })
      addToast(`Loaded ${newImages.length} image${newImages.length > 1 ? 's' : ''}`, 'success')
    }

    if (skippedType > 0) {
      addToast(`${skippedType} file(s) skipped - unsupported format`, 'warning')
    }
    if (skippedSize > 0) {
      addToast(`${skippedSize} file(s) skipped - too large (10MB max)`, 'warning')
    }

    // Reset input so same files can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  // Handle image selection (toggle)
  const handleImageClick = (imageId) => {
    setSelectedImageIds(prev => {
      if (prev.includes(imageId)) {
        // Deselect
        return prev.filter(id => id !== imageId)
      } else if (prev.length < 2) {
        // Select (max 2)
        return [...prev, imageId]
      } else {
        // Replace oldest selection
        return [prev[1], imageId]
      }
    })
  }

  // Clear selection
  const clearSelection = () => {
    setSelectedImageIds([])
  }

  // Open image editor for a queued image
  const handleEditQueuedImage = (imageId) => {
    setEditingImageId(imageId)
    setShowImageEditor(true)
  }

  // Close image editor
  const handleCloseImageEditor = () => {
    setShowImageEditor(false)
    setEditingImageId(null)
  }

  // Save edited image - replace the original in the images array
  const handleSaveEditedImage = async (editedBlob) => {
    if (!editingImageId) return

    const originalImage = images.find(img => img.id === editingImageId)
    if (!originalImage) return

    // Create new preview URL for the edited image
    const newPreviewUrl = URL.createObjectURL(editedBlob)

    // Create a new File object from the blob
    const editedFile = new File([editedBlob], originalImage.name, { type: 'image/jpeg' })

    // Update the image in state
    setImages(prev => prev.map(img => {
      if (img.id === editingImageId) {
        // Revoke old URL to prevent memory leak
        URL.revokeObjectURL(img.previewUrl)
        return {
          ...img,
          file: editedFile,
          previewUrl: newPreviewUrl
        }
      }
      return img
    }))

    addToast('Image edited successfully', 'success')
    handleCloseImageEditor()
  }

  // Get the image being edited
  const editingImage = editingImageId ? images.find(img => img.id === editingImageId) : null

  // Assign selected images to a card
  const handleAssignToCard = async (card) => {
    if (selectedImageIds.length === 0) {
      addToast('Select one or two images first', 'warning')
      return
    }

    const selectedImages = selectedImageIds.map(id => images.find(img => img.id === id)).filter(Boolean)
    if (selectedImages.length === 0) return

    setAssigning(true)
    try {
      const formData = new FormData()

      // First selected = front, second = back
      if (selectedImages[0]) {
        formData.append('front_image', selectedImages[0].file)
      }
      if (selectedImages[1]) {
        formData.append('back_image', selectedImages[1].file)
      }

      const response = await axios.put(
        `/api/admin/cards/${card.card_id}/reference-image`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } }
      )

      // Save to undo stack
      setUndoStack(prev => [...prev, {
        cardId: card.card_id,
        cardNumber: card.card_number,
        assignedImages: selectedImages.map(img => ({ ...img })),
        previousFront: card.front_image_path,
        previousBack: card.back_image_path
      }])

      // Remove assigned images from the grid
      const assignedIds = new Set(selectedImageIds)
      setImages(prev => {
        const remaining = prev.filter(img => !assignedIds.has(img.id))
        // Clean up URLs for removed images
        prev.filter(img => assignedIds.has(img.id)).forEach(img => {
          URL.revokeObjectURL(img.previewUrl)
        })
        return remaining
      })

      // Clear selection
      setSelectedImageIds([])

      // Track this card as assigned
      setAssignedCardIds(prev => new Set([...prev, card.card_id]))

      // Update card in parent state
      onCardUpdate(card.card_id, {
        front_image_path: response.data.front_image_url || card.front_image_path,
        back_image_path: response.data.back_image_url || card.back_image_path
      })

      addToast(`Assigned ${selectedImages.length} image${selectedImages.length > 1 ? 's' : ''} to card #${card.card_number}`, 'success')

    } catch (error) {
      console.error('Error assigning images:', error)
      addToast(`Failed to assign images: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setAssigning(false)
    }
  }

  // Undo last assignment
  const handleUndo = async () => {
    if (undoStack.length === 0) return

    const lastAction = undoStack[undoStack.length - 1]

    setAssigning(true)
    try {
      // Delete the images we just assigned
      if (lastAction.assignedImages.some(img => img === lastAction.assignedImages[0])) {
        await axios.delete(`/api/admin/cards/${lastAction.cardId}/image/front`)
      }
      if (lastAction.assignedImages.length > 1) {
        await axios.delete(`/api/admin/cards/${lastAction.cardId}/image/back`)
      }

      // Restore images to the grid (at the beginning so they're easy to find)
      setImages(prev => [...lastAction.assignedImages, ...prev])

      // Remove from undo stack
      setUndoStack(prev => prev.slice(0, -1))

      // Update card in parent state
      onCardUpdate(lastAction.cardId, {
        front_image_path: lastAction.previousFront,
        back_image_path: lastAction.previousBack
      })

      // Remove from assigned set
      setAssignedCardIds(prev => {
        const next = new Set(prev)
        next.delete(lastAction.cardId)
        return next
      })

      addToast(`Undid assignment for card #${lastAction.cardNumber}`, 'info')

    } catch (error) {
      console.error('Error undoing assignment:', error)
      addToast(`Failed to undo: ${error.response?.data?.message || error.message}`, 'error')
    } finally {
      setAssigning(false)
    }
  }

  // Count cards with images
  const cardsWithImages = cards.filter(c => c.front_image_path || c.back_image_path).length

  // Get selected images for preview
  const selectedImages = selectedImageIds.map(id => images.find(img => img.id === id)).filter(Boolean)

  return (
    <div className="bulk-upload-overlay">
      <div className="bulk-upload-container">
        {/* Header */}
        <header className="bulk-upload-header">
          <div className="bulk-upload-header-left">
            <h2>Bulk Image Upload</h2>
            <span className="bulk-upload-series-name">{seriesName}</span>
          </div>
          <div className="bulk-upload-header-stats">
            <span className="bulk-upload-stat">
              <Icon name="image" size={16} />
              {images.length} images loaded
            </span>
            <span className="bulk-upload-stat">
              <Icon name="check-circle" size={16} />
              {cardsWithImages} / {cards.length} cards have images
            </span>
          </div>
          <div className="bulk-upload-header-actions">
            {undoStack.length > 0 && (
              <button
                className="bulk-upload-undo-btn"
                onClick={handleUndo}
                disabled={assigning}
                title={`Undo: Card #${undoStack[undoStack.length - 1]?.cardNumber}`}
              >
                <Icon name="undo" size={16} />
                Undo
              </button>
            )}
            <button className="bulk-upload-close-btn" onClick={onClose}>
              <Icon name="x" size={20} />
              Done
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="bulk-upload-content">
          {/* Left Panel - Image Grid */}
          <div className="bulk-upload-images-panel">
            <div className="bulk-upload-images-header">
              <h3>Images</h3>
              <label className="bulk-upload-add-btn">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  multiple
                  onChange={handleFileSelect}
                />
                <Icon name="plus" size={16} />
                Add Images
              </label>
            </div>

            {/* Selection Preview */}
            {selectedImages.length > 0 && (
              <div className="bulk-upload-selection-preview">
                <div className="bulk-upload-selection-images">
                  {selectedImages.map((img, idx) => (
                    <div key={img.id} className="bulk-upload-selection-item">
                      <span className="bulk-upload-selection-label">
                        {idx === 0 ? 'Front' : 'Back'}
                      </span>
                      <div className="bulk-upload-selection-image-wrapper">
                        <img src={img.previewUrl} alt={img.name} />
                        <button
                          className="bulk-upload-edit-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleEditQueuedImage(img.id)
                          }}
                          title="Edit image (rotate, crop)"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="bulk-upload-clear-selection" onClick={clearSelection}>
                  <Icon name="x" size={14} />
                  Clear
                </button>
              </div>
            )}

            {/* Image Grid */}
            {images.length === 0 ? (
              <div className="bulk-upload-empty">
                <Icon name="image" size={48} />
                <p>No images loaded</p>
                <p className="bulk-upload-empty-hint">Click "Add Images" or drag and drop files here</p>
              </div>
            ) : (
              <div className="bulk-upload-image-grid">
                {images.map((img, index) => (
                  <div
                    key={img.id}
                    className={`bulk-upload-image-item ${selectedImageIds.includes(img.id) ? 'selected' : ''}`}
                    onClick={() => handleImageClick(img.id)}
                  >
                    <img src={img.previewUrl} alt={img.name} />
                    <span className="bulk-upload-image-index">{index + 1}</span>
                    {selectedImageIds.includes(img.id) && (
                      <span className="bulk-upload-image-selection-badge">
                        {selectedImageIds.indexOf(img.id) === 0 ? 'F' : 'B'}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Panel - Cards List */}
          <div className="bulk-upload-cards-panel">
            <div className="bulk-upload-cards-header">
              <h3>Cards</h3>
              <div className="bulk-upload-cards-search">
                <Icon name="search" size={16} />
                <input
                  type="text"
                  placeholder="Search by card # or player..."
                  value={cardSearch}
                  onChange={(e) => setCardSearch(e.target.value)}
                />
              </div>
            </div>

            <div className="bulk-upload-cards-list">
              {filteredCards.map(card => {
                const hasImages = card.front_image_path || card.back_image_path
                const justAssigned = assignedCardIds.has(card.card_id)

                return (
                  <div
                    key={card.card_id}
                    className={`bulk-upload-card-row ${hasImages ? 'has-images' : ''} ${justAssigned ? 'just-assigned' : ''} ${selectedImageIds.length === 0 ? 'disabled' : ''}`}
                    onClick={() => selectedImageIds.length > 0 && handleAssignToCard(card)}
                  >
                    <div className="bulk-upload-card-number">#{card.card_number}</div>
                    <div className="bulk-upload-card-player">{getPlayerNames(card)}</div>
                    <div className="bulk-upload-card-status">
                      {hasImages ? (
                        <span className="bulk-upload-card-has-image">
                          <Icon name="check" size={14} />
                          {card.front_image_path && card.back_image_path ? 'F+B' :
                           card.front_image_path ? 'F' : 'B'}
                        </span>
                      ) : (
                        <span className="bulk-upload-card-no-image">
                          <Icon name="image" size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Assignment Indicator */}
        {assigning && (
          <div className="bulk-upload-assigning">
            <div className="bulk-upload-assigning-spinner" />
            Assigning images...
          </div>
        )}

        {/* Image Editor Modal */}
        <ImageEditor
          isOpen={showImageEditor}
          onClose={handleCloseImageEditor}
          imageUrl={editingImage?.previewUrl}
          onSave={handleSaveEditedImage}
          title={`Edit ${selectedImageIds.indexOf(editingImageId) === 0 ? 'Front' : 'Back'} Image`}
        />
      </div>
    </div>
  )
}

export default BulkImageUpload
