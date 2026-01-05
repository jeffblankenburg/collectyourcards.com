/**
 * API v1 Response Utilities
 *
 * Ensures consistent response format across all v1 endpoints.
 */

/**
 * Success response for a single item
 */
function successResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data
  })
}

/**
 * Success response for a list of items with pagination
 */
function listResponse(res, data, meta = {}) {
  const { total = data.length, limit = 50, offset = 0 } = meta

  return res.status(200).json({
    success: true,
    data,
    meta: {
      total,
      limit,
      offset,
      hasMore: offset + data.length < total
    }
  })
}

/**
 * Error response
 */
function errorResponse(res, code, message, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  })
}

/**
 * Not found error
 */
function notFoundResponse(res, resource, identifier) {
  return errorResponse(
    res,
    `${resource.toUpperCase()}_NOT_FOUND`,
    `${resource} with identifier '${identifier}' not found`,
    404
  )
}

/**
 * Validation error
 */
function validationError(res, message) {
  return errorResponse(res, 'VALIDATION_ERROR', message, 400)
}

/**
 * Server error
 */
function serverError(res, error) {
  console.error('API v1 Server Error:', error)
  return errorResponse(
    res,
    'INTERNAL_ERROR',
    'An internal server error occurred',
    500
  )
}

/**
 * Parse pagination params from query
 */
function parsePagination(query, defaults = {}) {
  const limit = Math.min(
    Math.max(parseInt(query.limit) || defaults.limit || 50, 1),
    500 // Max limit
  )
  const offset = Math.max(parseInt(query.offset) || defaults.offset || 0, 0)

  return { limit, offset }
}

/**
 * Parse sort params from query
 * Supports: ?sort=field (asc) or ?sort=-field (desc)
 * Multiple: ?sort=-year,name
 */
function parseSort(query, allowedFields = []) {
  if (!query.sort) return null

  const sorts = query.sort.split(',').map(s => {
    const desc = s.startsWith('-')
    const field = desc ? s.slice(1) : s

    // Validate field is allowed
    if (allowedFields.length > 0 && !allowedFields.includes(field)) {
      return null
    }

    return { field, direction: desc ? 'desc' : 'asc' }
  }).filter(Boolean)

  return sorts.length > 0 ? sorts : null
}

module.exports = {
  successResponse,
  listResponse,
  errorResponse,
  notFoundResponse,
  validationError,
  serverError,
  parsePagination,
  parseSort
}
