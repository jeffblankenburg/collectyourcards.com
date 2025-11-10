import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import Icon from '../Icon'
import './PhotoCountHover.css'

// Client-side cache for fetched photos
const photoCache = new Map()

const PhotoCountHover = ({ photoCount, userCardId, onUploadClick }) => {
  const [showThumbnails, setShowThumbnails] = useState(false)
  const [hoverTimeout, setHoverTimeout] = useState(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const [photos, setPhotos] = useState([])
  const [loading, setLoading] = useState(false)
  const countRef = useRef(null)

  const handleMouseEnter = async () => {
    // Clear any existing timeout
    if (hoverTimeout) {
      clearTimeout(hoverTimeout)
    }

    // Show thumbnails after 300ms delay
    const timeout = setTimeout(async () => {
      if (photoCount > 0 && countRef.current) {
        // Calculate position relative to viewport
        const rect = countRef.current.getBoundingClientRect()
        const thumbnailHeight = 104 // 80px + padding
        const thumbnailWidth = 500 // max-width of strip

        setPosition({
          top: rect.top - thumbnailHeight - 10, // 10px gap above
          left: Math.min(window.innerWidth - thumbnailWidth - 10, rect.right) // Extend from right edge, but keep 10px from viewport edge
        })

        // Check cache first
        if (photoCache.has(userCardId)) {
          setPhotos(photoCache.get(userCardId))
          setShowThumbnails(true)
        } else {
          // Fetch photos on-demand
          setLoading(true)
          try {
            const response = await axios.get(`/api/user/cards/${userCardId}/photos`)
            const fetchedPhotos = response.data.photos || []

            // Cache the photos
            photoCache.set(userCardId, fetchedPhotos)
            setPhotos(fetchedPhotos)
            setShowThumbnails(true)
          } catch (error) {
            console.error('Error fetching photos:', error)
          } finally {
            setLoading(false)
          }
        }
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

  // Show camera icon + count when photos exist
  return (
    <>
      <div
        ref={countRef}
        className="photo-count-container"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <div className="photo-count-display">
          <Icon name="camera" size={14} />
          <span className="photo-count-number">{photoCount}</span>
        </div>
      </div>

      {showThumbnails && createPortal(
        <div
          className="photo-thumbnails-strip"
          style={{
            position: 'fixed',
            top: `${position.top}px`,
            left: `${position.left}px`,
          }}
        >
          {loading ? (
            <div className="photo-loading">
              <div className="card-icon-spinner small"></div>
              <span>Loading photos...</span>
            </div>
          ) : photos.length > 0 ? (
            photos
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
              ))
          ) : (
            <div className="photo-no-results">No photos available</div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

export default PhotoCountHover