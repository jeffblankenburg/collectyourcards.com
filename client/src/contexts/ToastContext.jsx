import { createContext, useContext, useState, useEffect } from 'react'
import Icon from '../components/Icon'

const ToastContext = createContext()

export const useToast = () => {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([])

  // Cleanup expired toasts periodically
  useEffect(() => {
    const cleanup = setInterval(() => {
      const now = Date.now()
      setToasts(prev => {
        const filtered = prev.filter(toast =>
          (now - toast.timestamp) < (toast.duration + 1000) // Keep for duration + 1 second buffer
        )
        // CRITICAL: Only update state if something actually changed
        // This prevents re-rendering the entire app every 5 seconds when there are no toasts
        return filtered.length !== prev.length ? filtered : prev
      })
    }, 5000) // Run cleanup every 5 seconds

    return () => clearInterval(cleanup)
  }, [])

  const addToast = (message, type = 'info', duration = 5000) => {
    // Check for duplicate messages (prevent identical messages within 1 second)
    const now = Date.now()
    const isDuplicate = toasts.some(existingToast => 
      existingToast.message === message && 
      existingToast.type === type &&
      (now - existingToast.timestamp) < 1000 // 1 second deduplication window
    )
    
    if (isDuplicate) {
      return null // Don't add duplicate toast
    }
    
    const id = now + Math.random()
    const toast = { id, message, type, duration, timestamp: now }
    
    setToasts(prev => {
      // Limit to maximum 5 toasts to prevent UI flooding
      const newToasts = [...prev, toast]
      if (newToasts.length > 5) {
        return newToasts.slice(-5) // Keep only the last 5 toasts
      }
      return newToasts
    })
    
    // Auto remove toast after duration
    setTimeout(() => {
      removeToast(id)
    }, duration)
    
    return id
  }

  const removeToast = (id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id))
  }

  const success = (message, duration) => addToast(message, 'success', duration)
  const error = (message, duration) => addToast(message, 'error', duration)
  const warning = (message, duration) => addToast(message, 'warning', duration)
  const info = (message, duration) => addToast(message, 'info', duration)

  const value = {
    toasts,
    addToast,
    removeToast,
    success,
    error,
    warning,
    info
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </ToastContext.Provider>
  )
}

const ToastContainer = ({ toasts, removeToast }) => {
  if (!toasts.length) return null

  return (
    <div className="toast-container">
      {toasts.map(toast => (
        <Toast key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

const Toast = ({ toast, onRemove }) => {
  const getToastIcon = (type) => {
    switch (type) {
      case 'success': return <Icon name="success" size={16} />
      case 'error': return <Icon name="error" size={16} />
      case 'warning': return <Icon name="warning" size={16} />
      default: return <Icon name="info" size={16} />
    }
  }

  return (
    <div className={`toast toast-${toast.type}`} onClick={() => onRemove(toast.id)}>
      <span className="toast-icon">{getToastIcon(toast.type)}</span>
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close" onClick={() => onRemove(toast.id)}>×</button>
    </div>
  )
}

export default ToastContext