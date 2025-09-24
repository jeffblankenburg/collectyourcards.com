import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import './ImageEditor.css'

const ImageEditor = ({ 
  isOpen, 
  onClose, 
  imageUrl, 
  onSave,
  title = "Edit Image"
}) => {
  const canvasRef = useRef(null)
  const [rotation, setRotation] = useState(0)
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 1, height: 1 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [imageLoaded, setImageLoaded] = useState(false)
  const [originalImage, setOriginalImage] = useState(null)
  const [saving, setSaving] = useState(false)
  const [corsEnabled, setCorsEnabled] = useState(false)

  useEffect(() => {
    if (isOpen && imageUrl) {
      console.log('Loading image:', imageUrl)
      // Reset state
      setImageLoaded(false)
      setOriginalImage(null)
      setRotation(0)
      setCrop({ x: 0, y: 0, width: 1, height: 1 })
      
      // Try loading with CORS first
      const tryLoadWithCORS = () => {
        console.log('Attempting CORS load for:', imageUrl)
        const img = new Image()
        
        img.onload = () => {
          console.log('✅ Image loaded WITH CORS support:', img.width, 'x', img.height)
          console.log('CORS enabled - save functionality will be available')
          setOriginalImage(img)
          setImageLoaded(true)
          setCorsEnabled(true)
        }
        
        img.onerror = (error) => {
          console.log('❌ CORS load failed, trying without CORS...', error)
          console.log('CORS error details:', {
            type: error.type,
            target: error.target?.src,
            crossOrigin: img.crossOrigin,
            currentOrigin: window.location.origin
          })
          tryLoadWithoutCORS()
        }
        
        img.crossOrigin = 'anonymous'
        img.src = imageUrl
      }
      
      // Fallback: load without CORS (allows viewing but not saving)
      const tryLoadWithoutCORS = () => {
        const img = new Image()
        
        img.onload = () => {
          console.log('Image loaded without CORS:', img.width, 'x', img.height)
          setOriginalImage(img)
          setImageLoaded(true)
          setCorsEnabled(false)
        }
        
        img.onerror = (error) => {
          console.error('Error loading image:', error, imageUrl)
          setImageLoaded(false)
          setCorsEnabled(false)
        }
        
        // No crossOrigin attribute
        img.src = imageUrl
      }
      
      tryLoadWithCORS()
    } else if (!isOpen) {
      // Clean up when modal closes
      setImageLoaded(false)
      setOriginalImage(null)
      setRotation(0)
      setCrop({ x: 0, y: 0, width: 1, height: 1 })
    }
  }, [isOpen, imageUrl])

  useEffect(() => {
    if (imageLoaded && originalImage) {
      drawCanvas()
    }
  }, [rotation, crop, imageLoaded, originalImage, isDragging])

  const drawCanvas = () => {
    if (!originalImage || !canvasRef.current) return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    // Check if we have a crop selection and aren't currently dragging
    const hasCrop = crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0
    const showCroppedPreview = hasCrop && !isDragging
    
    if (showCroppedPreview) {
      // Show cropped preview
      const sourceX = crop.x * originalImage.width
      const sourceY = crop.y * originalImage.height
      const sourceWidth = crop.width * originalImage.width
      const sourceHeight = crop.height * originalImage.height
      
      // Calculate canvas size based on rotation and crop
      const maxSize = 600
      let displayWidth, displayHeight
      
      if (rotation % 180 === 0) {
        // 0° or 180° - use crop dimensions
        displayWidth = sourceWidth
        displayHeight = sourceHeight
      } else {
        // 90° or 270° - swap crop dimensions
        displayWidth = sourceHeight
        displayHeight = sourceWidth
      }
      
      const scale = Math.min(maxSize / displayWidth, maxSize / displayHeight, 1)
      canvas.width = displayWidth * scale
      canvas.height = displayHeight * scale
      
      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Save context state
      ctx.save()
      
      // Apply rotation from center
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      
      // Draw only the cropped portion, centered
      const scaledWidth = sourceWidth * scale
      const scaledHeight = sourceHeight * scale
      ctx.drawImage(
        originalImage,
        sourceX, sourceY, sourceWidth, sourceHeight,
        -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight
      )
      
      ctx.restore()
    } else {
      // Show full image with crop overlay (during dragging or no crop)
      const maxSize = 600
      
      // Calculate canvas size based on rotation
      let displayWidth, displayHeight
      if (rotation % 180 === 0) {
        // 0° or 180° - use original orientation
        displayWidth = originalImage.width
        displayHeight = originalImage.height
      } else {
        // 90° or 270° - swap width and height
        displayWidth = originalImage.height
        displayHeight = originalImage.width
      }
      
      const scale = Math.min(maxSize / displayWidth, maxSize / displayHeight)
      canvas.width = displayWidth * scale
      canvas.height = displayHeight * scale

      // Clear canvas
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      
      // Save context state
      ctx.save()
      
      // Apply rotation from center
      ctx.translate(canvas.width / 2, canvas.height / 2)
      ctx.rotate((rotation * Math.PI) / 180)
      
      // Draw image centered on the rotated canvas
      const imageWidth = originalImage.width * scale
      const imageHeight = originalImage.height * scale
      ctx.drawImage(originalImage, -imageWidth / 2, -imageHeight / 2, imageWidth, imageHeight)
      
      // Restore context state
      ctx.restore()
      
      // Draw crop overlay if dragging or has partial crop
      if (isDragging) {
        drawCropOverlay(ctx, canvas)
      }
    }
  }

  const drawCropOverlay = (ctx, canvas) => {
    const cropX = crop.x * canvas.width
    const cropY = crop.y * canvas.height
    const cropWidth = crop.width * canvas.width
    const cropHeight = crop.height * canvas.height

    // Only draw overlay if we have a partial crop selection (not full image)
    const isPartialCrop = crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0
    
    if (isPartialCrop && cropWidth > 0 && cropHeight > 0) {
      // Draw semi-transparent overlay on the areas outside the crop selection
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
      
      // Top area
      if (cropY > 0) {
        ctx.fillRect(0, 0, canvas.width, cropY)
      }
      
      // Bottom area
      if (cropY + cropHeight < canvas.height) {
        ctx.fillRect(0, cropY + cropHeight, canvas.width, canvas.height - (cropY + cropHeight))
      }
      
      // Left area
      if (cropX > 0) {
        ctx.fillRect(0, cropY, cropX, cropHeight)
      }
      
      // Right area  
      if (cropX + cropWidth < canvas.width) {
        ctx.fillRect(cropX + cropWidth, cropY, canvas.width - (cropX + cropWidth), cropHeight)
      }
      
      // Draw crop border
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 2
      ctx.strokeRect(cropX, cropY, cropWidth, cropHeight)
      
      // Add corner indicators for better visibility
      const cornerSize = 10
      ctx.fillStyle = '#3b82f6'
      
      // Top-left corner
      ctx.fillRect(cropX - 1, cropY - 1, cornerSize, 3)
      ctx.fillRect(cropX - 1, cropY - 1, 3, cornerSize)
      
      // Top-right corner
      ctx.fillRect(cropX + cropWidth - cornerSize + 1, cropY - 1, cornerSize, 3)
      ctx.fillRect(cropX + cropWidth - 1, cropY - 1, 3, cornerSize)
      
      // Bottom-left corner
      ctx.fillRect(cropX - 1, cropY + cropHeight - 2, cornerSize, 3)
      ctx.fillRect(cropX - 1, cropY + cropHeight - cornerSize + 1, 3, cornerSize)
      
      // Bottom-right corner
      ctx.fillRect(cropX + cropWidth - cornerSize + 1, cropY + cropHeight - 2, cornerSize, 3)
      ctx.fillRect(cropX + cropWidth - 1, cropY + cropHeight - cornerSize + 1, 3, cornerSize)
    }
  }

  const handleRotateLeft = () => {
    setRotation(prev => (prev - 90 + 360) % 360)
  }

  const handleRotateRight = () => {
    setRotation(prev => (prev + 90) % 360)
  }

  const handleResetCrop = () => {
    setCrop({ x: 0, y: 0, width: 1, height: 1 })
  }

  const handleCanvasMouseDown = (e) => {
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    // Get actual canvas coordinates (accounting for CSS scaling)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY
    
    // Convert to normalized coordinates (0-1)
    const x = canvasX / canvas.width
    const y = canvasY / canvas.height
    
    setIsDragging(true)
    setDragStart({ x, y })
    setCrop({ x, y, width: 0, height: 0 })
  }

  const handleCanvasMouseMove = (e) => {
    if (!isDragging) return
    
    const canvas = canvasRef.current
    const rect = canvas.getBoundingClientRect()
    
    // Get actual canvas coordinates (accounting for CSS scaling)
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    
    const canvasX = (e.clientX - rect.left) * scaleX
    const canvasY = (e.clientY - rect.top) * scaleY
    
    // Convert to normalized coordinates (0-1) and clamp to canvas bounds
    const x = Math.max(0, Math.min(1, canvasX / canvas.width))
    const y = Math.max(0, Math.min(1, canvasY / canvas.height))
    
    // Calculate crop rectangle
    const newCrop = {
      x: Math.min(dragStart.x, x),
      y: Math.min(dragStart.y, y),
      width: Math.abs(x - dragStart.x),
      height: Math.abs(y - dragStart.y)
    }
    
    // Ensure crop doesn't go outside canvas bounds
    if (newCrop.x + newCrop.width > 1) {
      newCrop.width = 1 - newCrop.x
    }
    if (newCrop.y + newCrop.height > 1) {
      newCrop.height = 1 - newCrop.y
    }
    
    setCrop(newCrop)
  }

  const handleCanvasMouseUp = () => {
    setIsDragging(false)
    
    // If crop is too small, reset it
    if (crop.width < 0.05 || crop.height < 0.05) {
      setCrop({ x: 0, y: 0, width: 1, height: 1 })
    }
  }

  const handleSave = async () => {
    if (!originalImage || !canvasRef.current) return

    // Check if CORS is available for saving
    if (!corsEnabled) {
      showToast('Cannot save edited image: The image is from a domain that doesn\'t allow editing. You can view and rotate/crop for preview, but saving requires server configuration changes.', 'error')
      return
    }

    setSaving(true)
    try {
      // Create a new canvas for the final image
      const finalCanvas = document.createElement('canvas')
      const finalCtx = finalCanvas.getContext('2d')
      
      // Calculate final dimensions based on rotation
      const sourceX = crop.x * originalImage.width
      const sourceY = crop.y * originalImage.height
      const sourceWidth = crop.width * originalImage.width
      const sourceHeight = crop.height * originalImage.height
      
      // Set canvas size based on rotation
      if (rotation % 180 === 0) {
        finalCanvas.width = sourceWidth
        finalCanvas.height = sourceHeight
      } else {
        finalCanvas.width = sourceHeight
        finalCanvas.height = sourceWidth
      }
      
      // Apply rotation and crop to final canvas
      finalCtx.save()
      finalCtx.translate(finalCanvas.width / 2, finalCanvas.height / 2)
      finalCtx.rotate((rotation * Math.PI) / 180)
      
      finalCtx.drawImage(
        originalImage,
        sourceX, sourceY, sourceWidth, sourceHeight,
        -sourceWidth / 2, -sourceHeight / 2, sourceWidth, sourceHeight
      )
      
      finalCtx.restore()
      
      // Convert to blob
      finalCanvas.toBlob((blob) => {
        if (blob && onSave) {
          onSave(blob)
        }
        onClose()
      }, 'image/jpeg', 0.9)
    } catch (error) {
      console.error('Error saving image:', error)
      if (error.name === 'SecurityError' || error.message.includes('tainted')) {
        showToast('Unable to save image due to security restrictions. The image may be from a different domain that doesn\'t allow editing.', 'error')
      } else {
        showToast('Failed to save image. Please try again.', 'error')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleClose = () => {
    setRotation(0)
    setCrop({ x: 0, y: 0, width: 1, height: 1 })
    setImageLoaded(false)
    setOriginalImage(null)
    onClose()
  }

  if (!isOpen) return null

  return createPortal(
    <div className="image-editor-overlay" onClick={handleClose}>
      <div className="image-editor-modal" onClick={e => e.stopPropagation()}>
        <div className="image-editor-header">
          <h3>{title}</h3>
          <button className="image-editor-close" onClick={handleClose}>
            <Icon name="x" size={20} />
          </button>
        </div>

        <div className="image-editor-content">
          {imageLoaded ? (
            <div className="image-editor-canvas-container">
              <canvas
                ref={canvasRef}
                className="image-editor-canvas"
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
              />
              <div className="image-editor-instructions">
                <p>
                  {(crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0) && !isDragging ? 
                    'Preview of cropped image • Use "Reset Crop" to start over • Rotate if needed' :
                    'Click and drag to select crop area • Use rotation buttons to orient image'
                  }
                </p>
                {!corsEnabled && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#f59e0b', fontWeight: '500' }}>
                    ⚠️ Preview only - Saving disabled due to server restrictions
                  </div>
                )}
                {(rotation !== 0 || (crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0)) && (
                  <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#3b82f6' }}>
                    {rotation !== 0 && <span>Rotation: {rotation}° • </span>}
                    {(crop.width < 1 || crop.height < 1 || crop.x > 0 || crop.y > 0) && <span>Cropped to selection • </span>}
                    <span>{corsEnabled ? 'Click "Apply & Save" to save changes' : 'Preview only - cannot save'}</span>
                  </div>
                )}
              </div>
            </div>
          ) : imageUrl ? (
            <div className="image-editor-loading">
              <div className="card-icon-spinner"></div>
              <p>Loading image...</p>
              <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
                {imageUrl}
              </p>
            </div>
          ) : (
            <div className="image-editor-loading">
              <p>No image URL provided</p>
            </div>
          )}
        </div>

        <div className="image-editor-controls">
          <div className="image-editor-rotate-controls">
            <button 
              className="image-editor-btn"
              onClick={handleRotateLeft}
              disabled={!imageLoaded}
              title="Rotate left 90°"
            >
              <Icon name="arrow-left" size={16} />
              Rotate Left
            </button>
            <button 
              className="image-editor-btn"
              onClick={handleRotateRight}
              disabled={!imageLoaded}
              title="Rotate right 90°"
            >
              <Icon name="arrow-right" size={16} />
              Rotate Right
            </button>
          </div>
          
          <div className="image-editor-crop-controls">
            <button 
              className="image-editor-btn"
              onClick={handleResetCrop}
              disabled={!imageLoaded}
            >
              <Icon name="refresh" size={16} />
              Reset Crop
            </button>
          </div>
        </div>

        <div className="image-editor-actions">
          <button 
            className="image-editor-btn btn-cancel" 
            onClick={handleClose}
          >
            Cancel
          </button>
          <button 
            className="image-editor-btn btn-save" 
            onClick={handleSave}
            disabled={!imageLoaded || saving || !corsEnabled}
          >
            {saving ? (
              <>
                <div className="card-icon-spinner small"></div>
                Saving...
              </>
            ) : (
              <>
                <Icon name="check" size={16} />
                Apply & Save
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

export default ImageEditor