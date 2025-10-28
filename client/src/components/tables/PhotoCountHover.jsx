import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'
import './PhotoCountHover.css'

const PhotoCountHover = ({ photoCount, allPhotos = [], onUploadClick }) => {
  const [showThumbnails, setShowThumbnails] = useState(false)
  const [hoverTimeout, setHoverTimeout] = useState(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const countRef = useRef(null)

  const handleMouseEnter = () => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
    }
    
    // Show thumbnails after 300ms delay
    const timeout = setTimeout(() => {
      if (allPhotos.length > 0 && countRef.current) {
        // Calculate position relative to viewport
        const rect = countRef.current.getBoundingClientRect()
        const thumbnailHeight = 104 // 80px + padding
        const thumbnailWidth = 500 // max-width of strip
        
        setPosition({
          top: rect.top - thumbnailHeight - 10, // 10px gap above
          left: Math.min(window.innerWidth - thumbnailWidth - 10, rect.right) // Extend from right edge, but keep 10px from viewport edge
        })
        setShowThumbnails(true)
      }
    }, 300)
    
    setHoverTimeout(timeout)
  }

  const handleMouseLeave = () => {
    // Clear timeout and hide thumbnails
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
      setHoverTimeout(null)
    }
    setShowThumbnails(false)
  }

  // Show upload button when no photos
  if (photoCount === 0) {
    return (
      <button
        className="photo-upload-btn"
        onClick={(e) => {
          e.stopPropagation()
          if (onUploadClick) onUploadClick()
        }}
        title="Upload photo"
      >
        <Icon name="upload" size={14} />
        <span>Upload</span>
      </button>
    )
  }

  // Show icon + count when photos exist
  return (
    <>
      <div
        ref={countRef}
        className="photo-count-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="photo-count-display">
          <Icon name="image" size={14} />
          <span className="photo-count-number">{photoCount}</span>
        </div>
      </div>
      
      {showThumbnails && allPhotos.length > 0 && createPortal(
        <div 
          className="photo-thumbnails-strip"
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {allPhotos
            .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0)) // Sort by sort_order, primary first
            .map((photo, index) => (
            <div key={photo.user_card_photo_id || index} className="photo-thumbnail">
              <img
                src={photo.photo_url}
                alt={`Photo ${index + 1}`}
                loading="lazy"
                onError={(e) => {
                  // Hide broken images
                  e.target.style.display = 'none'
                }}
              />
            </div>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

export default PhotoCountHover