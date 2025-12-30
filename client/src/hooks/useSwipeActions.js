import { useState, useRef, useCallback } from 'react'
import { useHaptic } from './useHaptic'

/**
 * useSwipeActions - Custom hook for swipe-to-reveal actions on mobile
 *
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Distance to swipe before action is triggered (default: 80)
 * @param {number} options.maxSwipe - Maximum swipe distance (default: 160)
 * @param {boolean} options.disabled - Disable swipe actions (default: false)
 * @returns {Object} - { swipeOffset, swipeDirection, handlers, resetSwipe }
 */
export function useSwipeActions(options = {}) {
  const {
    threshold = 80,
    maxSwipe = 160,
    disabled = false
  } = options

  const haptic = useHaptic()
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [swipeDirection, setSwipeDirection] = useState(null) // 'left' or 'right'
  const [isActive, setIsActive] = useState(false)

  const startX = useRef(0)
  const startY = useRef(0)
  const currentX = useRef(0)
  const isHorizontalSwipe = useRef(null) // Track if this is a horizontal or vertical swipe
  const hasTriggeredHaptic = useRef(false)

  const handleTouchStart = useCallback((e) => {
    if (disabled) return

    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    currentX.current = startX.current
    isHorizontalSwipe.current = null // Reset swipe direction detection
    hasTriggeredHaptic.current = false
    setIsActive(true)
  }, [disabled])

  const handleTouchMove = useCallback((e) => {
    if (disabled || !isActive) return

    currentX.current = e.touches[0].clientX
    const currentY = e.touches[0].clientY

    const diffX = currentX.current - startX.current
    const diffY = currentY - startY.current

    // Determine swipe direction on first significant movement
    if (isHorizontalSwipe.current === null && (Math.abs(diffX) > 10 || Math.abs(diffY) > 10)) {
      isHorizontalSwipe.current = Math.abs(diffX) > Math.abs(diffY)
    }

    // Only handle horizontal swipes
    if (!isHorizontalSwipe.current) {
      return
    }

    // Prevent vertical scrolling while swiping horizontally
    e.preventDefault()

    // Apply resistance at edges
    const resistance = 0.5
    let offset = diffX

    if (Math.abs(offset) > maxSwipe) {
      const overshoot = Math.abs(offset) - maxSwipe
      offset = (offset > 0 ? 1 : -1) * (maxSwipe + overshoot * resistance)
    }

    // Clamp to max swipe
    offset = Math.max(-maxSwipe * 1.2, Math.min(maxSwipe * 1.2, offset))

    setSwipeOffset(offset)
    setSwipeDirection(offset > 0 ? 'right' : offset < 0 ? 'left' : null)

    // Trigger haptic feedback when threshold is reached
    if (Math.abs(offset) >= threshold && !hasTriggeredHaptic.current) {
      haptic.impact()
      hasTriggeredHaptic.current = true
    } else if (Math.abs(offset) < threshold) {
      hasTriggeredHaptic.current = false
    }
  }, [disabled, isActive, threshold, maxSwipe, haptic])

  const handleTouchEnd = useCallback(() => {
    if (disabled) return

    setIsActive(false)

    // If swiped past threshold, snap to action position
    if (Math.abs(swipeOffset) >= threshold) {
      const snapPosition = swipeOffset > 0 ? maxSwipe : -maxSwipe
      setSwipeOffset(snapPosition)
      haptic.light()
    } else {
      // Snap back to closed
      setSwipeOffset(0)
      setSwipeDirection(null)
    }
  }, [disabled, swipeOffset, threshold, maxSwipe, haptic])

  const resetSwipe = useCallback(() => {
    setSwipeOffset(0)
    setSwipeDirection(null)
    setIsActive(false)
  }, [])

  // Check if actions are visible
  const isOpen = Math.abs(swipeOffset) >= threshold
  const leftActionsVisible = swipeOffset > threshold
  const rightActionsVisible = swipeOffset < -threshold

  return {
    swipeOffset,
    swipeDirection,
    isOpen,
    leftActionsVisible,
    rightActionsVisible,
    isActive,
    resetSwipe,
    handlers: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
      onTouchCancel: handleTouchEnd
    }
  }
}

export default useSwipeActions
