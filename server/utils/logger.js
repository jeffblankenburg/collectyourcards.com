/**
 * Enhanced Logger Utility
 *
 * Makes errors clearly visible above the instrumentation noise.
 * Provides visual separation with banner formatting for errors.
 */

const chalk = require('chalk') || {
  red: (s) => s,
  yellow: (s) => s,
  green: (s) => s,
  blue: (s) => s,
  gray: (s) => s,
  bold: (s) => s,
  bgRed: (s) => s,
  bgYellow: (s) => s
}

// Check if chalk is available
let hasChalk = true
try {
  require.resolve('chalk')
} catch (e) {
  hasChalk = false
}

const BANNER_WIDTH = 80
const ERROR_BANNER = '═'.repeat(BANNER_WIDTH)
const WARNING_BANNER = '─'.repeat(BANNER_WIDTH)

/**
 * Format a highly visible error message
 */
function logError(context, error, additionalInfo = {}) {
  const timestamp = new Date().toISOString()
  const errorMessage = error?.message || error || 'Unknown error'
  const stack = error?.stack || ''

  console.error('')
  console.error(hasChalk ? chalk.bgRed.bold(`  ERROR  `) : '  ERROR  ')
  console.error(hasChalk ? chalk.red(ERROR_BANNER) : ERROR_BANNER)
  console.error(hasChalk ? chalk.red.bold(`| CONTEXT: ${context}`) : `| CONTEXT: ${context}`)
  console.error(hasChalk ? chalk.red(`| TIME: ${timestamp}`) : `| TIME: ${timestamp}`)
  console.error(hasChalk ? chalk.red(`| MESSAGE: ${errorMessage}`) : `| MESSAGE: ${errorMessage}`)

  // Log additional info if provided
  if (Object.keys(additionalInfo).length > 0) {
    console.error(hasChalk ? chalk.red(`| DETAILS:`) : `| DETAILS:`)
    Object.entries(additionalInfo).forEach(([key, value]) => {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value
      console.error(hasChalk ? chalk.red(`|   ${key}: ${displayValue}`) : `|   ${key}: ${displayValue}`)
    })
  }

  // Log stack trace in a condensed format
  if (stack) {
    console.error(hasChalk ? chalk.red(`| STACK:`) : `| STACK:`)
    const stackLines = stack.split('\n').slice(1, 6) // First 5 stack frames
    stackLines.forEach(line => {
      console.error(hasChalk ? chalk.gray(`|   ${line.trim()}`) : `|   ${line.trim()}`)
    })
    if (stack.split('\n').length > 6) {
      console.error(hasChalk ? chalk.gray(`|   ... (${stack.split('\n').length - 6} more frames)`) : `|   ... (${stack.split('\n').length - 6} more frames)`)
    }
  }

  console.error(hasChalk ? chalk.red(ERROR_BANNER) : ERROR_BANNER)
  console.error('')
}

/**
 * Format a visible warning message
 */
function logWarning(context, message, additionalInfo = {}) {
  const timestamp = new Date().toISOString()

  console.warn('')
  console.warn(hasChalk ? chalk.bgYellow.bold(`  WARNING  `) : '  WARNING  ')
  console.warn(hasChalk ? chalk.yellow(WARNING_BANNER) : WARNING_BANNER)
  console.warn(hasChalk ? chalk.yellow.bold(`| CONTEXT: ${context}`) : `| CONTEXT: ${context}`)
  console.warn(hasChalk ? chalk.yellow(`| TIME: ${timestamp}`) : `| TIME: ${timestamp}`)
  console.warn(hasChalk ? chalk.yellow(`| MESSAGE: ${message}`) : `| MESSAGE: ${message}`)

  if (Object.keys(additionalInfo).length > 0) {
    Object.entries(additionalInfo).forEach(([key, value]) => {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : value
      console.warn(hasChalk ? chalk.yellow(`|   ${key}: ${displayValue}`) : `|   ${key}: ${displayValue}`)
    })
  }

  console.warn(hasChalk ? chalk.yellow(WARNING_BANNER) : WARNING_BANNER)
  console.warn('')
}

/**
 * Log API request errors (the most common type)
 */
function logApiError(route, method, error, req = null) {
  const additionalInfo = {}

  if (req) {
    additionalInfo.path = req.originalUrl || req.path
    additionalInfo.userId = req.user?.userId || 'anonymous'
    additionalInfo.ip = req.ip || req.headers?.['x-forwarded-for'] || 'unknown'

    // Include relevant body params (but not passwords)
    if (req.body && Object.keys(req.body).length > 0) {
      const safeBody = { ...req.body }
      if (safeBody.password) safeBody.password = '[REDACTED]'
      if (safeBody.newPassword) safeBody.newPassword = '[REDACTED]'
      if (safeBody.currentPassword) safeBody.currentPassword = '[REDACTED]'
      additionalInfo.body = safeBody
    }
  }

  logError(`API ${method} ${route}`, error, additionalInfo)
}

/**
 * Log database errors
 */
function logDbError(operation, table, error, query = null) {
  const additionalInfo = {
    operation,
    table
  }

  if (query) {
    // Truncate long queries
    additionalInfo.query = query.length > 200 ? query.substring(0, 200) + '...' : query
  }

  logError('Database Operation', error, additionalInfo)
}

/**
 * Standard info log (no special formatting, just timestamped)
 */
function logInfo(context, message) {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ℹ️ ${context}: ${message}`)
}

/**
 * Debug log (only in development)
 */
function logDebug(context, message, data = null) {
  if (process.env.NODE_ENV !== 'development') return

  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] 🐛 ${context}: ${message}`)
  if (data) {
    console.log(`    Data:`, data)
  }
}

module.exports = {
  logError,
  logWarning,
  logApiError,
  logDbError,
  logInfo,
  logDebug
}
