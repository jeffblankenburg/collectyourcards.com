/**
 * SQL Security Utilities
 *
 * Centralized security functions for preventing SQL injection attacks.
 * All SQL queries that include user input MUST use these functions.
 *
 * @module sql-security
 * @created 2025-10-28
 * @see /server/SQL_INJECTION_AUDIT.md for full security audit
 */

/**
 * Safely escape a string for use in SQL LIKE clauses
 *
 * Escapes all SQL special characters that could be used for injection:
 * - Single quotes (')
 * - Percent signs (%) - SQL wildcard
 * - Underscores (_) - SQL wildcard
 * - Brackets ([ ]) - SQL escape characters
 *
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for LIKE clauses
 *
 * @example
 * const userInput = "O'Malley 50%"
 * const safe = escapeLikePattern(userInput)
 * // safe = "O''Malley 50[%]"
 * const query = `WHERE name LIKE '%${safe}%'` // Safe to use
 *
 * @example
 * // Malicious input
 * const attack = "'; DROP TABLE users; --"
 * const safe = escapeLikePattern(attack)
 * // safe = "''; DROP TABLE users; --" (attack neutralized)
 */
function escapeLikePattern(str) {
  if (!str) return ''
  if (typeof str !== 'string') {
    str = String(str)
  }

  return str
    .replace(/'/g, "''")   // Escape single quotes (SQL standard)
    .replace(/%/g, '[%]')  // Escape SQL wildcard
    .replace(/_/g, '[_]')  // Escape SQL wildcard
    .replace(/\[/g, '[[]') // Escape opening bracket
    .replace(/\]/g, '[]]') // Escape closing bracket
}

/**
 * Validate and sanitize numeric ID input
 *
 * Ensures the input is a valid positive integer.
 * Throws an error if validation fails.
 * Use this for all database IDs from user input.
 *
 * @param {string|number} id - The ID to validate
 * @param {string} fieldName - Name of field for error messages (default: 'id')
 * @returns {number} - Validated numeric ID
 * @throws {Error} - If ID is not a positive integer
 *
 * @example
 * const teamId = validateNumericId(req.query.team_id, 'team_id')
 * const query = `WHERE team_id = ${teamId}` // Safe to use
 *
 * @example
 * // Handles various inputs
 * validateNumericId('123', 'user_id')    // Returns 123
 * validateNumericId(456, 'card_id')      // Returns 456
 * validateNumericId('abc', 'series_id')  // Throws Error
 * validateNumericId(-5, 'player_id')     // Throws Error
 */
function validateNumericId(id, fieldName = 'id') {
  const numId = parseInt(id, 10)

  if (isNaN(numId) || numId < 0) {
    throw new Error(`Invalid ${fieldName}: must be a positive integer`)
  }

  return numId
}

/**
 * Validate an array of numeric IDs
 *
 * Filters out invalid values and returns only valid positive integers.
 * Does NOT throw errors - silently filters invalid entries.
 * Use this for arrays of IDs from user input (e.g., selected filters).
 *
 * @param {Array} ids - Array of IDs to validate
 * @returns {Array<number>} - Array of validated numeric IDs (may be empty)
 *
 * @example
 * const cardIds = validateNumericArray([1, 2, 'invalid', 3, -5, '10'])
 * // Returns: [1, 2, 3, 10]
 *
 * @example
 * const locationIds = validateNumericArray(req.query.locations)
 * if (locationIds.length > 0) {
 *   const inClause = locationIds.join(',')
 *   const query = `WHERE location_id IN (${inClause})` // Safe to use
 * }
 */
function validateNumericArray(ids) {
  if (!Array.isArray(ids)) {
    return []
  }

  return ids
    .map(id => Number(id))
    .filter(id => !isNaN(id) && id > 0 && isFinite(id))
}

/**
 * Escape a string for safe use in SQL string literals
 *
 * Only escapes single quotes - use for equality comparisons.
 * For LIKE patterns, use escapeLikePattern() instead.
 *
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string
 *
 * @example
 * const cardNumber = escapeString(req.query.card_number)
 * const query = `WHERE card_number = '${cardNumber}'` // Safe to use
 *
 * @example
 * const playerName = "O'Malley"
 * const safe = escapeString(playerName)
 * // safe = "O''Malley"
 */
function escapeString(str) {
  if (!str) return ''
  if (typeof str !== 'string') {
    str = String(str)
  }

  return str.replace(/'/g, "''")
}

/**
 * Build a safe IN clause from an array of numeric IDs
 *
 * Validates all IDs and returns a comma-separated string.
 * Returns null if the array is empty or all values are invalid.
 *
 * @param {Array} ids - Array of numeric IDs
 * @returns {string|null} - Safe comma-separated IDs or null
 *
 * @example
 * const inClause = buildInClause([1, 2, 3])
 * if (inClause) {
 *   const query = `WHERE card_id IN (${inClause})`
 * }
 * // query = "WHERE card_id IN (1,2,3)"
 *
 * @example
 * // Handles invalid input
 * buildInClause([])              // Returns null
 * buildInClause(['a', 'b'])      // Returns null
 * buildInClause([1, 'x', 2])     // Returns "1,2"
 */
function buildInClause(ids) {
  const validated = validateNumericArray(ids)
  return validated.length > 0 ? validated.join(',') : null
}

/**
 * Validate BigInt ID (for SQL Server bigint columns)
 *
 * Ensures the input can be safely converted to BigInt.
 * Throws an error if validation fails.
 *
 * @param {string|number|bigint} id - The ID to validate
 * @param {string} fieldName - Name of field for error messages
 * @returns {bigint} - Validated BigInt ID
 * @throws {Error} - If ID cannot be converted to BigInt
 *
 * @example
 * const userId = validateBigIntId(req.user.userId, 'user_id')
 * const query = `WHERE [user] = ${userId}` // Safe to use
 */
function validateBigIntId(id, fieldName = 'id') {
  try {
    const bigIntId = BigInt(id)

    if (bigIntId < 0n) {
      throw new Error(`Invalid ${fieldName}: must be positive`)
    }

    return bigIntId
  } catch (err) {
    throw new Error(`Invalid ${fieldName}: must be a valid integer`)
  }
}

/**
 * Sanitize search term for full-text search
 *
 * Removes dangerous characters while allowing normal search terms.
 * Use for search queries where you want to allow spaces and alphanumeric.
 *
 * @param {string} searchTerm - The search term to sanitize
 * @param {number} maxLength - Maximum allowed length (default: 100)
 * @returns {string} - Sanitized search term
 *
 * @example
 * const search = sanitizeSearchTerm("Mike Trout 2023")
 * // search = "Mike Trout 2023" (allowed)
 *
 * @example
 * const malicious = sanitizeSearchTerm("'; DROP TABLE--")
 * // malicious = "DROP TABLE" (dangerous chars removed)
 */
function sanitizeSearchTerm(searchTerm, maxLength = 100) {
  if (!searchTerm) return ''
  if (typeof searchTerm !== 'string') {
    searchTerm = String(searchTerm)
  }

  // Remove dangerous characters, keep alphanumeric, spaces, hyphens, apostrophes
  const sanitized = searchTerm
    .replace(/[^\w\s\-']/g, '') // Keep word chars, spaces, hyphens, apostrophes
    .trim()
    .substring(0, maxLength)

  return sanitized
}

// Export all security functions
module.exports = {
  escapeLikePattern,
  validateNumericId,
  validateNumericArray,
  escapeString,
  buildInClause,
  validateBigIntId,
  sanitizeSearchTerm
}

/**
 * USAGE GUIDELINES
 * ================
 *
 * 1. LIKE QUERIES (search, pattern matching):
 *    const safe = escapeLikePattern(userInput)
 *    const query = `WHERE name LIKE '%${safe}%'`
 *
 * 2. EQUALITY COMPARISONS (exact match):
 *    const safe = escapeString(userInput)
 *    const query = `WHERE card_number = '${safe}'`
 *
 * 3. NUMERIC IDS (single value):
 *    const id = validateNumericId(req.query.id, 'card_id')
 *    const query = `WHERE card_id = ${id}`
 *
 * 4. BIGINT IDS (SQL Server bigint):
 *    const userId = validateBigIntId(req.user.userId, 'user_id')
 *    const query = `WHERE [user] = ${userId}`
 *
 * 5. IN CLAUSES (multiple IDs):
 *    const inClause = buildInClause([1, 2, 3])
 *    if (inClause) {
 *      const query = `WHERE id IN (${inClause})`
 *    }
 *
 * 6. ARRAY OF IDS (manual building):
 *    const ids = validateNumericArray(req.query.ids)
 *    const safe = ids.join(',')
 *    const query = `WHERE id IN (${safe})`
 *
 * 7. SEARCH TERMS (full-text search):
 *    const term = sanitizeSearchTerm(req.query.q)
 *    const safe = escapeLikePattern(term)
 *    const query = `WHERE description LIKE '%${safe}%'`
 *
 * NEVER DO:
 * ❌ const query = `WHERE name = '${userInput}'`
 * ❌ const query = `WHERE id = ${req.query.id}`
 * ❌ const query = `WHERE id IN (${ids.join(',')})`
 *
 * ALWAYS DO:
 * ✅ Use the functions from this module
 * ✅ Validate/escape ALL user input
 * ✅ Test with malicious input
 */
