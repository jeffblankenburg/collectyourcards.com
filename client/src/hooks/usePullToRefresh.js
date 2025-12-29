import { useState, useEffect, useCallback, useRef } from 'react'
import { useHaptic } from './useHaptic'

/**
 * usePullToRefresh - Custom hook for pull-to-refresh functionality on mobile
 *
 * @param {Function} onRefresh - Async function to call when refresh is triggered
 * @param {Object} options - Configuration options
 * @param {number} options.threshold - Distance to pull before refresh triggers (default: 80)
 * @param {number} options.resistance - Resistance factor for pull (default: 2.5)
 * @param {boolean} options.disabled - Disable pull-to-refresh (default: false)
 * @returns {Object} - { isRefreshing, pullDistance, containerRef }
 */
export function usePullToRefresh(onRefresh, options = {}) {
  const {
    threshold = 80,
    resistance = 2.5,
    disabled = false
  } = options

  const haptic = useHaptic()
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const containerRef = useRef(null)
  const startY = useRef(0)
  const currentY = useRef(0)
  const pulling = useRef(false)
  const hasTriggeredHaptic = useRef(false)

  const handleTouchStart = useCallback((e) => {
    if (disabled || isRefreshing) return

    // Only start pull if at top of scroll
    const container = containerRef.current
    if (!container) return

    // Check if we're at the top of the scrollable area
    const scrollTop = container.scrollTop || window.scrollY
    if (scrollTop > 0) return

    startY.current = e.touches[0].clientY
    pulling.current = true
    hasTriggeredHaptic.current = false
  }, [disabled, isRefreshing])

  const handleTouchMove = useCallback((e) => {
    if (!pulling.current || disabled || isRefreshing) return

    currentY.current = e.touches[0].clientY
    const diff = currentY.current - startY.current

    // Only pull down, not up
    if (diff < 0) {
      setPullDistance(0)
      return
    }

    // Apply resistance for natural feel
    const distance = Math.min(diff / resistance, threshold * 1.5)
    setPullDistance(distance)

    // Trigger haptic feedback when threshold is reached
    if (distance >= threshold && !hasTriggeredHaptic.current) {
      haptic.impact()
      hasTriggeredHaptic.current = true
    } else if (distance < threshold) {
      hasTriggeredHaptic.current = false
    }

    // Prevent scroll while pulling
    if (distance > 10) {
      e.preventDefault()
    }
  }, [disabled, isRefreshing, resistance, threshold, haptic])

  const handleTouchEnd = useCallback(async () => {
    if (!pulling.current || disabled) return

    pulling.current = false

    if (pullDistance >= threshold && !isRefreshing) {
      setIsRefreshing(true)
      setPullDistance(threshold) // Hold at threshold during refresh

      try {
        await onRefresh()
        haptic.success() // Success haptic on refresh complete
      } catch (error) {
        console.error('Pull-to-refresh error:', error)
        haptic.error() // Error haptic on failure
      } finally {
        setIsRefreshing(false)
        setPullDistance(0)
      }
    } else {
      setPullDistance(0)
    }
  }, [pullDistance, threshold, isRefreshing, onRefresh, disabled, haptic])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    // Use passive: false to allow preventDefault
    container.addEventListener('touchstart', handleTouchStart, { passive: true })
    container.addEventListener('touchmove', handleTouchMove, { passive: false })
    container.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      container.removeEventListener('touchstart', handleTouchStart)
      container.removeEventListener('touchmove', handleTouchMove)
      container.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return {
    isRefreshing,
    pullDistance,
    containerRef,
    // Helper to know if we're past threshold
    isPulledPastThreshold: pullDistance >= threshold
  }
}

export default usePullToRefresh
