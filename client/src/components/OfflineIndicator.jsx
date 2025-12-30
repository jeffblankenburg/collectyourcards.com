import React, { useState, useEffect } from 'react'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import Icon from './Icon'
import './OfflineIndicator.css'

/**
 * OfflineIndicator - Shows a banner when the user is offline
 *
 * Features:
 * - Appears at the top of the viewport when offline
 * - Shows a reconnection message when coming back online
 * - Dismissible after reconnection
 */
function OfflineIndicator() {
  const { isOnline, isOffline, wasOffline } = useOnlineStatus()
  const [showReconnected, setShowReconnected] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  // Show "reconnected" message briefly when coming back online
  useEffect(() => {
    if (isOnline && wasOffline) {
      setShowReconnected(true)
      const timer = setTimeout(() => {
        setShowReconnected(false)
      }, 3000)
      return () => clearTimeout(timer)
    }
  }, [isOnline, wasOffline])

  // Reset dismissed state when going offline again
  useEffect(() => {
    if (isOffline) {
      setDismissed(false)
    }
  }, [isOffline])

  // Don't render if online and no reconnection message
  if (isOnline && !showReconnected) {
    return null
  }

  // Don't render if dismissed
  if (dismissed) {
    return null
  }

  return (
    <div className={`offline-indicator ${isOffline ? 'offline' : 'online'}`}>
      <div className="offline-indicator-content">
        {isOffline ? (
          <>
            <Icon name="wifi-off" size={18} />
            <span className="offline-message">
              You're offline. Some features may be unavailable.
            </span>
          </>
        ) : (
          <>
            <Icon name="wifi" size={18} />
            <span className="offline-message">
              Back online!
            </span>
            <button
              className="offline-dismiss"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <Icon name="close" size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default OfflineIndicator
