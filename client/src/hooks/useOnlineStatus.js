import { useState, useEffect, useCallback } from 'react'

/**
 * useOnlineStatus - Hook to detect and monitor online/offline status
 *
 * @returns {Object} - { isOnline, isOffline, wasOffline }
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [wasOffline, setWasOffline] = useState(false)

  const handleOnline = useCallback(() => {
    setIsOnline(true)
    // If we were offline and came back online, set wasOffline for toast/notification
    if (!navigator.onLine === false) {
      setWasOffline(true)
      // Reset wasOffline after 5 seconds
      setTimeout(() => setWasOffline(false), 5000)
    }
  }, [])

  const handleOffline = useCallback(() => {
    setIsOnline(false)
  }, [])

  useEffect(() => {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    // Also do periodic connectivity checks for more reliable detection
    const checkConnectivity = async () => {
      try {
        // Quick HEAD request to detect actual connectivity
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 3000)

        const response = await fetch('/api/health', {
          method: 'HEAD',
          signal: controller.signal,
          cache: 'no-store'
        })

        clearTimeout(timeout)
        if (response.ok && !isOnline) {
          handleOnline()
        }
      } catch (err) {
        // If the fetch fails and we think we're online, we might actually be offline
        if (isOnline && !navigator.onLine) {
          handleOffline()
        }
      }
    }

    // Check connectivity on mount
    if (isOnline) {
      checkConnectivity()
    }

    // Periodic check every 30 seconds
    const interval = setInterval(checkConnectivity, 30000)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      clearInterval(interval)
    }
  }, [isOnline, handleOnline, handleOffline])

  return {
    isOnline,
    isOffline: !isOnline,
    wasOffline
  }
}

export default useOnlineStatus
