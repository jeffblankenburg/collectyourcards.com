// Standardized slug generation for series, sets, and players
// This ensures consistent URL generation and matching across the entire application

/**
 * Generate a URL-safe slug from a name
 * @param {string} name - The name to convert to a slug
 * @returns {string} URL-safe slug
 */
export function generateSlug(name) {
  if (!name) return 'unknown'

  return name
    .toLowerCase()
    .replace(/&/g, 'and') // Convert ampersands to "and" to preserve semantic meaning
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace ALL other special chars (including spaces, slashes, etc.) with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

/**
 * Generate a player slug from first and last name
 * @param {string} firstName
 * @param {string} lastName
 * @returns {string} URL-safe player slug
 */
export function generatePlayerSlug(firstName, lastName) {
  const fullName = `${firstName || ''} ${lastName || ''}`.trim()
  return generateSlug(fullName)
}
