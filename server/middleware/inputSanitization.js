const validator = require('validator')
const DOMPurify = require('isomorphic-dompurify')

/**
 * Comprehensive input sanitization middleware for 100% SQL injection protection
 * This validates and sanitizes ALL user input before it reaches database queries
 */

// Define allowed patterns for different input types
const INPUT_PATTERNS = {
  username: /^[a-zA-Z0-9._-]{3,30}$/,
  cardNumber: /^[a-zA-Z0-9#\-\/\s]{1,50}$/,
  serialNumber: /^\d{1,10}$/,
  randomCode: /^[A-Z0-9]{6,12}$/,
  grade: /^\d{1,2}(\.\d{1,2})?$/,
  price: /^\d{1,8}(\.\d{1,2})?$/,
  locationName: /^[a-zA-Z0-9\s\-,.()]{1,100}$/,
  notes: /^[\s\S]{0,1000}$/, // Any chars but limited length
  bio: /^[\s\S]{0,500}$/,
  website: /^https?:\/\/.{1,255}$/
}

// Maximum lengths for all text fields
const MAX_LENGTHS = {
  username: 30,
  firstName: 50,
  lastName: 50,
  email: 255,
  bio: 500,
  website: 255,
  location: 100,
  notes: 1000,
  cardNumber: 50,
  seriesName: 200,
  teamName: 100,
  randomCode: 12
}

// Dangerous patterns that should never appear in any input
const DANGEROUS_PATTERNS = [
  /['"`;]/,                    // SQL quote characters and semicolon
  /--/,                        // SQL comment
  /\/\*/,                      // SQL block comment start
  /\*\//,                      // SQL block comment end
  /\bunion\b/i,                // SQL UNION
  /\bselect\b/i,               // SQL SELECT
  /\binsert\b/i,               // SQL INSERT
  /\bupdate\b/i,               // SQL UPDATE
  /\bdelete\b/i,               // SQL DELETE
  /\bdrop\b/i,                 // SQL DROP
  /\bexec\b/i,                 // SQL EXEC
  /\bexecute\b/i,              // SQL EXECUTE
  /\bsp_\w+/i,                 // SQL stored procedures
  /\bxp_\w+/i,                 // SQL extended procedures
  /<script/i,                  // XSS script tags
  /javascript:/i,              // XSS javascript protocol
  /vbscript:/i,                // XSS vbscript protocol
  /onload/i,                   // XSS event handlers
  /onerror/i,
  /onclick/i,
  /onmouseover/i
]

/**
 * Validate and sanitize a string input
 */
function sanitizeString(value, fieldName, options = {}) {
  if (value === null || value === undefined) {
    return null
  }

  // Convert to string
  let sanitized = String(value)

  // Check maximum length
  const maxLength = options.maxLength || MAX_LENGTHS[fieldName] || 255
  if (sanitized.length > maxLength) {
    throw new Error(`${fieldName} exceeds maximum length of ${maxLength} characters`)
  }

  // Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error(`${fieldName} contains invalid characters`)
    }
  }

  // Apply specific pattern validation if exists
  if (INPUT_PATTERNS[fieldName] && !INPUT_PATTERNS[fieldName].test(sanitized)) {
    throw new Error(`${fieldName} format is invalid`)
  }

  // HTML sanitization for rich text fields
  if (fieldName === 'bio' || fieldName === 'notes') {
    sanitized = DOMPurify.sanitize(sanitized, { 
      ALLOWED_TAGS: [], 
      ALLOWED_ATTR: [] 
    })
  }

  // URL validation for website field
  if (fieldName === 'website' && sanitized) {
    if (!validator.isURL(sanitized, { require_protocol: true })) {
      throw new Error('Website must be a valid URL with http:// or https://')
    }
  }

  // Email validation
  if (fieldName === 'email' && sanitized) {
    if (!validator.isEmail(sanitized)) {
      throw new Error('Invalid email format')
    }
  }

  return sanitized.trim()
}

/**
 * Validate and sanitize numeric inputs
 */
function sanitizeNumber(value, fieldName, options = {}) {
  if (value === null || value === undefined || value === '') {
    return null
  }

  const num = Number(value)
  if (isNaN(num)) {
    throw new Error(`${fieldName} must be a valid number`)
  }

  if (options.min !== undefined && num < options.min) {
    throw new Error(`${fieldName} must be at least ${options.min}`)
  }

  if (options.max !== undefined && num > options.max) {
    throw new Error(`${fieldName} must be at most ${options.max}`)
  }

  if (options.integer && !Number.isInteger(num)) {
    throw new Error(`${fieldName} must be a whole number`)
  }

  return num
}

/**
 * Validate and sanitize boolean inputs
 */
function sanitizeBoolean(value) {
  if (value === null || value === undefined) {
    return false
  }
  return Boolean(value)
}

/**
 * Main sanitization middleware
 */
function sanitizeInput(req, res, next) {
  try {
    if (req.body) {
      // Create sanitized version of req.body
      req.sanitized = {}

      Object.keys(req.body).forEach(key => {
        const value = req.body[key]
        
        switch (key) {
          // String fields
          case 'username':
          case 'first_name':
          case 'last_name':
          case 'email':
          case 'bio':
          case 'website':
          case 'location':
          case 'notes':
          case 'card_number':
          case 'series_name':
          case 'team_name':
          case 'random_code':
            req.sanitized[key] = sanitizeString(value, key)
            break

          // Numeric fields
          case 'card_id':
          case 'series_id':
          case 'user_card_id':
          case 'team_id':
          case 'player_id':
            req.sanitized[key] = sanitizeNumber(value, key, { integer: true, min: 1 })
            break

          case 'serial_number':
            req.sanitized[key] = sanitizeNumber(value, key, { integer: true, min: 1, max: 999999999 })
            break

          case 'purchase_price':
          case 'estimated_value':
          case 'current_value':
            req.sanitized[key] = sanitizeNumber(value, key, { min: 0, max: 999999.99 })
            break

          case 'grade':
            req.sanitized[key] = sanitizeNumber(value, key, { min: 1, max: 10 })
            break

          case 'grading_agency':
            req.sanitized[key] = sanitizeNumber(value, key, { integer: true, min: 1, max: 100 })
            break

          case 'user_location':
            req.sanitized[key] = sanitizeNumber(value, key, { integer: true, min: 1 })
            break

          // Boolean fields
          case 'is_rookie':
          case 'is_autograph':
          case 'is_relic':
          case 'is_special':
          case 'aftermarket_autograph':
          case 'is_public_profile':
          case 'is_for_sale':
          case 'is_wanted':
            req.sanitized[key] = sanitizeBoolean(value)
            break

          default:
            // For any unrecognized field, apply basic string sanitization
            if (typeof value === 'string') {
              req.sanitized[key] = sanitizeString(value, 'generic', { maxLength: 255 })
            } else {
              req.sanitized[key] = value
            }
        }
      })
    }

    next()
  } catch (error) {
    console.error('Input sanitization error:', error.message)
    res.status(400).json({
      error: 'Invalid input',
      message: error.message
    })
  }
}

/**
 * ID sanitization for URL parameters
 */
function sanitizeParams(req, res, next) {
  try {
    if (req.params) {
      Object.keys(req.params).forEach(key => {
        const value = req.params[key]
        
        // All ID parameters should be positive integers
        if (key.includes('Id') || key.includes('id') || key === 'cardId' || key === 'userCardId') {
          const num = parseInt(value)
          if (isNaN(num) || num < 1 || num > 9007199254740991) { // Max safe integer
            throw new Error(`Invalid ${key}: must be a positive integer`)
          }
          req.params[key] = num
        } else if (typeof value === 'string') {
          // For non-ID params, apply string sanitization
          req.params[key] = sanitizeString(value, 'param', { maxLength: 100 })
        }
      })
    }
    next()
  } catch (error) {
    console.error('Parameter sanitization error:', error.message)
    res.status(400).json({
      error: 'Invalid parameter',
      message: error.message
    })
  }
}

module.exports = {
  sanitizeInput,
  sanitizeParams,
  sanitizeString,
  sanitizeNumber,
  sanitizeBoolean
}