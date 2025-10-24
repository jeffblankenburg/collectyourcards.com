/**
 * Centralized Logging Utility for CollectYourCards
 *
 * Provides structured logging with levels, context, and easy production control.
 *
 * Usage:
 *   import { createLogger } from '../utils/logger'
 *   const log = createLogger('ComponentName')
 *
 *   log.debug('Detailed debugging info', { data })
 *   log.info('General information', { data })
 *   log.warn('Warning messages', { data })
 *   log.error('Error messages', { error })
 *   log.performance('Operation', startTime)
 *
 * Control in Browser Console:
 *   localStorage.setItem('log_level', 'debug')  // Show all logs
 *   localStorage.setItem('log_level', 'info')   // Show info, warn, error
 *   localStorage.setItem('log_level', 'warn')   // Show warn, error only
 *   localStorage.setItem('log_level', 'error')  // Show errors only
 *   localStorage.setItem('log_level', 'none')   // Disable all logging
 *   localStorage.removeItem('log_level')        // Use default (info in prod, debug in dev)
 */

const LOG_LEVELS = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
}

const LOG_COLORS = {
  debug: '#6B7280',  // Gray
  info: '#3B82F6',   // Blue
  warn: '#F59E0B',   // Orange
  error: '#EF4444',  // Red
  success: '#10B981', // Green
  performance: '#8B5CF6' // Purple
}

const LOG_EMOJIS = {
  debug: '🔍',
  info: 'ℹ️',
  warn: '⚠️',
  error: '❌',
  success: '✅',
  performance: '⚡'
}

/**
 * Get the current log level from localStorage or environment
 */
function getLogLevel() {
  // Check localStorage first
  const storedLevel = localStorage.getItem('log_level')
  if (storedLevel && LOG_LEVELS[storedLevel] !== undefined) {
    return LOG_LEVELS[storedLevel]
  }

  // Default: debug in development, info in production
  return import.meta.env.DEV ? LOG_LEVELS.debug : LOG_LEVELS.info
}

/**
 * Check if a log level should be shown
 */
function shouldLog(messageLevel) {
  const currentLevel = getLogLevel()
  return LOG_LEVELS[messageLevel] >= currentLevel
}

/**
 * Format timestamp
 */
function getTimestamp() {
  const now = new Date()
  return now.toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3
  })
}

/**
 * Get user context from localStorage
 */
function getUserContext() {
  try {
    const userStr = localStorage.getItem('user')
    if (userStr) {
      const user = JSON.parse(userStr)
      return {
        userId: user.user_id,
        email: user.email,
        role: user.role
      }
    }
  } catch (e) {
    // Ignore errors
  }
  return null
}

/**
 * Format and output a log message
 */
function logMessage(level, component, message, data, error) {
  if (!shouldLog(level)) return

  const timestamp = getTimestamp()
  const emoji = LOG_EMOJIS[level] || ''
  const color = LOG_COLORS[level] || '#000000'

  // Build the log prefix
  const prefix = `${emoji} [${timestamp}] [${component}]`

  // Style for the prefix
  const prefixStyle = `color: ${color}; font-weight: bold;`

  // Output based on level
  const consoleMethod = level === 'error' ? 'error' :
                       level === 'warn' ? 'warn' :
                       level === 'debug' ? 'debug' :
                       'log'

  // Log the message
  if (data || error) {
    console[consoleMethod](`%c${prefix}`, prefixStyle, message, data || error)
  } else {
    console[consoleMethod](`%c${prefix}`, prefixStyle, message)
  }

  // Add user context for errors
  if (level === 'error') {
    const userContext = getUserContext()
    if (userContext) {
      console.debug('👤 User Context:', userContext)
    }
  }
}

/**
 * Create a logger instance for a specific component
 */
export function createLogger(componentName) {
  return {
    /**
     * Debug-level logging (most verbose)
     * Use for detailed information during development
     */
    debug: (message, data) => {
      logMessage('debug', componentName, message, data)
    },

    /**
     * Info-level logging
     * Use for general informational messages about app state
     */
    info: (message, data) => {
      logMessage('info', componentName, message, data)
    },

    /**
     * Warning-level logging
     * Use for concerning situations that aren't errors
     */
    warn: (message, data) => {
      logMessage('warn', componentName, message, data)
    },

    /**
     * Error-level logging
     * Use for errors and exceptions
     */
    error: (message, error) => {
      logMessage('error', componentName, message, null, error)
    },

    /**
     * Success logging
     * Use for successful operations
     */
    success: (message, data) => {
      logMessage('info', componentName, `✅ ${message}`, data)
    },

    /**
     * Performance logging
     * Use to track operation timing
     */
    performance: (operation, startTime) => {
      const duration = performance.now() - startTime
      const durationStr = duration < 1000
        ? `${duration.toFixed(2)}ms`
        : `${(duration / 1000).toFixed(2)}s`

      logMessage('info', componentName, `⚡ ${operation} completed in ${durationStr}`, {
        operation,
        duration: `${duration.toFixed(2)}ms`
      })
    },

    /**
     * API call logging
     * Use to track API requests and responses
     */
    api: (method, url, status, duration, data) => {
      const statusColor = status >= 200 && status < 300 ? '✅' :
                         status >= 400 && status < 500 ? '⚠️' : '❌'
      const durationStr = duration < 1000
        ? `${duration.toFixed(0)}ms`
        : `${(duration / 1000).toFixed(2)}s`

      logMessage('info', componentName,
        `${statusColor} ${method} ${url} - ${status} (${durationStr})`,
        data
      )
    },

    /**
     * Navigation logging
     * Use to track route changes
     */
    navigation: (from, to, params) => {
      logMessage('info', componentName, `🧭 Navigation: ${from} → ${to}`, params)
    },

    /**
     * State change logging
     * Use to track important state changes
     */
    state: (stateName, oldValue, newValue) => {
      logMessage('debug', componentName, `📊 State change: ${stateName}`, {
        from: oldValue,
        to: newValue
      })
    },

    /**
     * Data fetch logging
     * Use to track data loading operations
     */
    fetch: (resource, result) => {
      logMessage('info', componentName, `📦 Fetched ${resource}`, result)
    },

    /**
     * Group logging (for organizing related logs)
     */
    group: (label, callback) => {
      if (!shouldLog('debug')) return
      console.group(`🗂️ ${label}`)
      callback()
      console.groupEnd()
    },

    /**
     * Table logging (for displaying data in table format)
     */
    table: (label, data) => {
      if (!shouldLog('debug')) return
      console.log(`📋 ${label}:`)
      console.table(data)
    }
  }
}

/**
 * Global logger for non-component code
 */
export const log = createLogger('App')

/**
 * Log level control helpers (exposed for console access)
 */
window.logControl = {
  setLevel: (level) => {
    if (LOG_LEVELS[level] !== undefined) {
      localStorage.setItem('log_level', level)
      console.log(`✅ Log level set to: ${level}`)
      console.log('🔄 Refresh the page for changes to take effect')
    } else {
      console.error(`❌ Invalid log level. Valid levels: ${Object.keys(LOG_LEVELS).join(', ')}`)
    }
  },

  getLevel: () => {
    const currentLevel = Object.keys(LOG_LEVELS).find(
      key => LOG_LEVELS[key] === getLogLevel()
    )
    console.log(`Current log level: ${currentLevel}`)
    return currentLevel
  },

  reset: () => {
    localStorage.removeItem('log_level')
    console.log('✅ Log level reset to default')
    console.log('🔄 Refresh the page for changes to take effect')
  },

  help: () => {
    console.log(`
%c📊 CollectYourCards Logging Control

Available Commands:
  logControl.setLevel('debug')  - Show all logs (most verbose)
  logControl.setLevel('info')   - Show info, warnings, and errors
  logControl.setLevel('warn')   - Show warnings and errors only
  logControl.setLevel('error')  - Show errors only
  logControl.setLevel('none')   - Disable all logging
  logControl.getLevel()         - Show current log level
  logControl.reset()            - Reset to default log level
  logControl.help()             - Show this help message

Log Levels: ${Object.keys(LOG_LEVELS).join(', ')}
Current Level: ${Object.keys(LOG_LEVELS).find(key => LOG_LEVELS[key] === getLogLevel())}
    `, 'font-weight: bold; font-size: 14px;')
  }
}

// Show help on first load if in development
if (import.meta.env.DEV) {
  console.log('%c💡 Logging is enabled. Type logControl.help() for options.', 'color: #3B82F6; font-weight: bold;')
}

export default createLogger
