/**
 * Azure Blob Storage Utilities
 *
 * Handles environment-aware blob path generation to separate dev and production storage
 */

/**
 * Get the environment prefix for blob storage paths
 * @returns {string} 'dev/' for development, empty string for production
 */
function getEnvironmentPrefix() {
  const environment = process.env.NODE_ENV || 'development'
  return environment === 'production' ? '' : 'dev/'
}

/**
 * Generate a blob name with environment prefix
 * @param {string} path - The blob path (e.g., 'user-card/123_filename.jpg')
 * @returns {string} Environment-prefixed blob name (e.g., 'dev/user-card/123_filename.jpg')
 */
function getBlobName(path) {
  const prefix = getEnvironmentPrefix()
  return `${prefix}${path}`
}

/**
 * Extract blob name from a full Azure Blob Storage URL
 * Handles both dev and production URLs
 * @param {string} url - Full blob URL
 * @param {number} pathSegments - Number of path segments to extract (default: 2)
 * @returns {string} Blob name with environment prefix if present
 */
function extractBlobNameFromUrl(url, pathSegments = 2) {
  if (!url) return ''

  const urlParts = url.split('/')
  const blobPath = urlParts.slice(-pathSegments).join('/')

  // If URL contains 'dev/' prefix, preserve it
  if (url.includes('/dev/')) {
    return blobPath.startsWith('dev/') ? blobPath : `dev/${blobPath}`
  }

  return blobPath
}

/**
 * Check if current environment is production
 * @returns {boolean}
 */
function isProduction() {
  return process.env.NODE_ENV === 'production'
}

/**
 * Get current environment name
 * @returns {string}
 */
function getEnvironment() {
  return process.env.NODE_ENV || 'development'
}

module.exports = {
  getEnvironmentPrefix,
  getBlobName,
  extractBlobNameFromUrl,
  isProduction,
  getEnvironment
}
