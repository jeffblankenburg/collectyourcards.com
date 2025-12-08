import { Component } from 'react'

/**
 * Error boundary that catches chunk load failures (dynamic import errors)
 * and provides a user-friendly way to recover by reloading the page.
 *
 * This handles the case where a new deployment replaces JS chunk files
 * and users with stale cached HTML try to load old chunk URLs.
 */
class ChunkErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasChunkError: false }
  }

  static getDerivedStateFromError(error) {
    // Check if this is a chunk loading error
    if (isChunkLoadError(error)) {
      return { hasChunkError: true }
    }
    // Let other errors propagate
    return null
  }

  componentDidCatch(error, errorInfo) {
    // Log chunk errors for debugging
    if (isChunkLoadError(error)) {
      console.warn('Chunk load error detected:', error.message)
    }
  }

  handleReload = () => {
    // Force a hard reload to get fresh assets
    window.location.reload()
  }

  render() {
    if (this.state.hasChunkError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
          padding: '2rem',
          textAlign: 'center'
        }}>
          <div style={{
            backgroundColor: '#f0f9ff',
            border: '1px solid #0ea5e9',
            borderRadius: '8px',
            padding: '2rem',
            maxWidth: '400px'
          }}>
            <h2 style={{ margin: '0 0 1rem', color: '#0369a1' }}>
              New Version Available
            </h2>
            <p style={{ margin: '0 0 1.5rem', color: '#64748b' }}>
              We've updated Collect Your Cards! Please refresh to get the latest version.
            </p>
            <button
              onClick={this.handleReload}
              style={{
                backgroundColor: '#0ea5e9',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.75rem 1.5rem',
                fontSize: '1rem',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#0284c7'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#0ea5e9'}
            >
              Refresh Now
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

/**
 * Check if an error is a chunk/module loading error
 */
function isChunkLoadError(error) {
  const message = error?.message || ''
  const name = error?.name || ''

  return (
    // Vite/ES module dynamic import errors
    message.includes('Failed to fetch dynamically imported module') ||
    message.includes('Loading chunk') ||
    message.includes('Loading CSS chunk') ||
    // Webpack chunk errors
    name === 'ChunkLoadError' ||
    message.includes('Loading chunk') ||
    // Network errors during module fetch
    (message.includes('Failed to fetch') && message.includes('.js')) ||
    // MIME type error from serving HTML instead of JS
    message.includes('MIME type')
  )
}

export default ChunkErrorBoundary
