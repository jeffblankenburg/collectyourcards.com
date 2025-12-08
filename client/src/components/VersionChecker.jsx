import { useEffect, useState, useCallback } from 'react'

/**
 * VersionChecker component that periodically checks if a new version
 * of the app has been deployed and prompts users to refresh.
 *
 * It works by fetching the index.html and checking if the JS bundle
 * references have changed since the page was loaded.
 */
const VersionChecker = () => {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [initialScripts, setInitialScripts] = useState(null)

  // Extract script sources from HTML
  const extractScriptSources = useCallback((html) => {
    const scriptMatches = html.match(/src="([^"]*\.js[^"]*)"/g) || []
    return scriptMatches
      .map(match => match.replace(/src="([^"]*)"/, '$1'))
      .filter(src => src.includes('/assets/'))
      .sort()
      .join(',')
  }, [])

  // Check for updates
  const checkForUpdates = useCallback(async () => {
    try {
      // Fetch index.html with cache-busting
      const response = await fetch('/?_v=' + Date.now(), {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) return

      const html = await response.text()
      const currentScripts = extractScriptSources(html)

      if (initialScripts === null) {
        // First check - store the initial state
        setInitialScripts(currentScripts)
      } else if (currentScripts && currentScripts !== initialScripts) {
        // Scripts have changed - new version available
        console.log('New version detected')
        setUpdateAvailable(true)
      }
    } catch (error) {
      // Silently fail - network issues shouldn't affect the user
      console.debug('Version check failed:', error.message)
    }
  }, [initialScripts, extractScriptSources])

  useEffect(() => {
    // Initial check after a short delay
    const initialTimeout = setTimeout(checkForUpdates, 5000)

    // Then check every 5 minutes
    const interval = setInterval(checkForUpdates, 5 * 60 * 1000)

    // Also check when tab becomes visible (user returns to tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        checkForUpdates()
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearTimeout(initialTimeout)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [checkForUpdates])

  const handleRefresh = () => {
    window.location.reload()
  }

  const handleDismiss = () => {
    setUpdateAvailable(false)
    // Re-check in 30 minutes if dismissed
    setTimeout(() => {
      setInitialScripts(null) // Reset to allow re-detection
    }, 30 * 60 * 1000)
  }

  if (!updateAvailable) return null

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#1e293b',
      color: 'white',
      padding: '1rem 1.25rem',
      borderRadius: '8px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      zIndex: 10000,
      maxWidth: '320px',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateY(100px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
      <div style={{ marginBottom: '0.75rem' }}>
        <strong style={{ fontSize: '0.95rem' }}>Update Available</strong>
        <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#94a3b8' }}>
          A new version of Collect Your Cards is ready.
        </p>
      </div>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={handleRefresh}
          style={{
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            padding: '0.5rem 1rem',
            fontSize: '0.85rem',
            fontWeight: '500',
            cursor: 'pointer',
            flex: 1
          }}
        >
          Refresh Now
        </button>
        <button
          onClick={handleDismiss}
          style={{
            backgroundColor: 'transparent',
            color: '#94a3b8',
            border: '1px solid #475569',
            borderRadius: '4px',
            padding: '0.5rem 0.75rem',
            fontSize: '0.85rem',
            cursor: 'pointer'
          }}
        >
          Later
        </button>
      </div>
    </div>
  )
}

export default VersionChecker
