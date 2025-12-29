import React from 'react'
import { usePullToRefresh } from '../hooks/usePullToRefresh'
import Icon from './Icon'
import './PullToRefresh.css'

/**
 * PullToRefresh - Wrapper component that adds pull-to-refresh functionality
 *
 * @param {React.ReactNode} children - Content to wrap
 * @param {Function} onRefresh - Async function to call when refresh triggers
 * @param {boolean} disabled - Disable the pull-to-refresh
 * @param {string} className - Additional class names
 */
function PullToRefresh({ children, onRefresh, disabled = false, className = '' }) {
  const { isRefreshing, pullDistance, containerRef, isPulledPastThreshold } = usePullToRefresh(
    onRefresh,
    { disabled }
  )

  // Calculate rotation for the arrow/spinner based on pull distance
  const rotation = Math.min(pullDistance * 3, 180)
  const opacity = Math.min(pullDistance / 40, 1)
  const scale = Math.min(0.5 + (pullDistance / 160), 1)

  return (
    <div
      ref={containerRef}
      className={`pull-to-refresh-container ${className}`}
    >
      {/* Pull indicator */}
      <div
        className={`pull-to-refresh-indicator ${isRefreshing ? 'refreshing' : ''} ${isPulledPastThreshold ? 'ready' : ''}`}
        style={{
          transform: `translateY(${pullDistance - 50}px)`,
          opacity: pullDistance > 10 ? opacity : 0
        }}
      >
        <div
          className="pull-to-refresh-icon"
          style={{
            transform: isRefreshing ? 'none' : `rotate(${rotation}deg) scale(${scale})`
          }}
        >
          {isRefreshing ? (
            <Icon name="loader" size={24} className="spinning" />
          ) : (
            <Icon name="arrow-down" size={24} />
          )}
        </div>
        <span className="pull-to-refresh-text">
          {isRefreshing
            ? 'Refreshing...'
            : isPulledPastThreshold
              ? 'Release to refresh'
              : 'Pull to refresh'}
        </span>
      </div>

      {/* Content with transform for pull effect */}
      <div
        className="pull-to-refresh-content"
        style={{
          transform: pullDistance > 0 ? `translateY(${pullDistance}px)` : 'none'
        }}
      >
        {children}
      </div>
    </div>
  )
}

export default PullToRefresh
