/**
 * Console log capture utility for feedback submissions
 * Captures recent console logs while filtering sensitive data
 */

// Store for captured logs
const capturedLogs = []
const MAX_LOGS = 100

// Sensitive patterns to filter out
const sensitivePatterns = [
  /Bearer\s+[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+/gi, // JWT tokens
  /password['":\s]*['"]?[^'"}\s,]+/gi, // Passwords
  /token['":\s]*['"]?[A-Za-z0-9\-_]+/gi, // Generic tokens
  /api[_-]?key['":\s]*['"]?[A-Za-z0-9\-_]+/gi, // API keys
  /secret['":\s]*['"]?[A-Za-z0-9\-_]+/gi, // Secrets
  /authorization['":\s]*['"]?[^'"}\s,]+/gi, // Auth headers
  /cookie['":\s]*['"]?[^'"}\s,]+/gi, // Cookies
]

/**
 * Filter sensitive data from a string
 */
function filterSensitiveData(str) {
  if (typeof str !== 'string') {
    try {
      str = JSON.stringify(str)
    } catch {
      str = String(str)
    }
  }

  let filtered = str
  sensitivePatterns.forEach(pattern => {
    filtered = filtered.replace(pattern, '[FILTERED]')
  })

  return filtered
}

/**
 * Format arguments for logging
 */
function formatArgs(args) {
  return args.map(arg => {
    if (arg === null) return 'null'
    if (arg === undefined) return 'undefined'
    if (typeof arg === 'object') {
      try {
        return filterSensitiveData(JSON.stringify(arg, null, 2))
      } catch {
        return '[Object]'
      }
    }
    return filterSensitiveData(String(arg))
  }).join(' ')
}

/**
 * Add a log entry
 */
function addLog(level, args) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message: formatArgs(args)
  }

  capturedLogs.push(entry)

  // Keep only the most recent logs
  while (capturedLogs.length > MAX_LOGS) {
    capturedLogs.shift()
  }
}

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug
}

let isInitialized = false

/**
 * Initialize console capture
 * Call this once when the app starts
 */
export function initConsoleCapture() {
  if (isInitialized) return

  // Override console methods
  console.log = function(...args) {
    addLog('log', args)
    originalConsole.log.apply(console, args)
  }

  console.warn = function(...args) {
    addLog('warn', args)
    originalConsole.warn.apply(console, args)
  }

  console.error = function(...args) {
    addLog('error', args)
    originalConsole.error.apply(console, args)
  }

  console.info = function(...args) {
    addLog('info', args)
    originalConsole.info.apply(console, args)
  }

  console.debug = function(...args) {
    addLog('debug', args)
    originalConsole.debug.apply(console, args)
  }

  // Capture unhandled errors
  window.addEventListener('error', (event) => {
    addLog('error', [`Unhandled error: ${event.message} at ${event.filename}:${event.lineno}:${event.colno}`])
  })

  // Capture unhandled promise rejections
  window.addEventListener('unhandledrejection', (event) => {
    addLog('error', [`Unhandled promise rejection: ${event.reason}`])
  })

  isInitialized = true
}

/**
 * Get captured logs (filtered for sensitive data)
 * @param {number} limit - Maximum number of logs to return
 * @returns {Array} Array of log entries
 */
export function getCapturedLogs(limit = 50) {
  const logs = capturedLogs.slice(-limit)
  return logs
}

/**
 * Get captured logs as a JSON string
 * @param {number} limit - Maximum number of logs to return
 * @returns {string} JSON string of log entries
 */
export function getCapturedLogsJson(limit = 50) {
  const logs = getCapturedLogs(limit)
  return JSON.stringify(logs, null, 2)
}

/**
 * Clear captured logs
 */
export function clearCapturedLogs() {
  capturedLogs.length = 0
}

/**
 * Get recent errors only
 * @param {number} limit - Maximum number of errors to return
 * @returns {Array} Array of error log entries
 */
export function getRecentErrors(limit = 20) {
  return capturedLogs
    .filter(log => log.level === 'error' || log.level === 'warn')
    .slice(-limit)
}

export default {
  initConsoleCapture,
  getCapturedLogs,
  getCapturedLogsJson,
  clearCapturedLogs,
  getRecentErrors
}
