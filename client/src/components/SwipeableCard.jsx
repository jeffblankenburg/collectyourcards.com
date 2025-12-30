import React from 'react'
import { useSwipeActions } from '../hooks/useSwipeActions'
import Icon from './Icon'
import './SwipeableCard.css'

/**
 * SwipeableCard - Wrapper component that adds swipe-to-reveal actions
 *
 * Swipe right: Edit action (blue)
 * Swipe left: Delete action (red)
 *
 * @param {Object} props
 * @param {React.ReactNode} props.children - The card content
 * @param {Function} props.onEdit - Called when edit action is triggered
 * @param {Function} props.onDelete - Called when delete action is triggered
 * @param {Function} props.onFavorite - Called when favorite action is triggered
 * @param {boolean} props.isFavorite - Whether the item is favorited
 * @param {boolean} props.disabled - Disable swipe actions
 */
function SwipeableCard({
  children,
  onEdit,
  onDelete,
  onFavorite,
  isFavorite = false,
  disabled = false
}) {
  const {
    swipeOffset,
    swipeDirection,
    leftActionsVisible,
    rightActionsVisible,
    isActive,
    resetSwipe,
    handlers
  } = useSwipeActions({
    threshold: 80,
    maxSwipe: 120,
    disabled
  })

  const handleEdit = (e) => {
    e.stopPropagation()
    resetSwipe()
    onEdit?.()
  }

  const handleDelete = (e) => {
    e.stopPropagation()
    resetSwipe()
    onDelete?.()
  }

  const handleFavorite = (e) => {
    e.stopPropagation()
    resetSwipe()
    onFavorite?.()
  }

  return (
    <div className="swipeable-card-container">
      {/* Left Actions (revealed on swipe right) - Edit & Favorite */}
      <div
        className={`swipeable-action-container left ${leftActionsVisible ? 'visible' : ''}`}
        style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 80) }}
      >
        {onFavorite && (
          <button
            className={`swipeable-action favorite ${isFavorite ? 'active' : ''}`}
            onClick={handleFavorite}
            aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          >
            <Icon name="star" size={24} />
            <span>{isFavorite ? 'Unfave' : 'Fave'}</span>
          </button>
        )}
        {onEdit && (
          <button
            className="swipeable-action edit"
            onClick={handleEdit}
            aria-label="Edit"
          >
            <Icon name="edit" size={24} />
            <span>Edit</span>
          </button>
        )}
      </div>

      {/* Right Actions (revealed on swipe left) - Delete */}
      <div
        className={`swipeable-action-container right ${rightActionsVisible ? 'visible' : ''}`}
        style={{ opacity: Math.min(1, Math.abs(swipeOffset) / 80) }}
      >
        {onDelete && (
          <button
            className="swipeable-action delete"
            onClick={handleDelete}
            aria-label="Delete"
          >
            <Icon name="trash" size={24} />
            <span>Delete</span>
          </button>
        )}
      </div>

      {/* Card Content */}
      <div
        className={`swipeable-card-content ${isActive ? 'swiping' : ''}`}
        style={{
          transform: `translateX(${swipeOffset}px)`,
          transition: isActive ? 'none' : 'transform 0.3s ease-out'
        }}
        {...handlers}
      >
        {children}
      </div>
    </div>
  )
}

export default SwipeableCard
