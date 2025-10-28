/**
 * Name Normalization Service
 *
 * Handles normalization of player and team names for fuzzy matching.
 * Removes accents, punctuation, and standardizes spacing to improve
 * matching accuracy between user input and database records.
 *
 * @module services/import/name-normalizer
 */

/**
 * Normalize accented characters to their ASCII equivalents
 *
 * Uses Unicode normalization (NFD) to decompose accented characters,
 * then removes the combining diacritical marks.
 *
 * @param {string} str - String with potential accents
 * @returns {string} - String with accents removed
 *
 * @example
 * normalizeAccents('José Ramírez') // Returns 'Jose Ramirez'
 * normalizeAccents('Renée') // Returns 'Renee'
 */
function normalizeAccents(str) {
  if (!str) return ''
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

/**
 * Normalize player name for matching
 *
 * - Removes accents
 * - Converts to lowercase
 * - Removes periods (for initials like "J.T.")
 * - Normalizes whitespace
 *
 * @param {string} name - Player name to normalize
 * @returns {string} - Normalized player name
 *
 * @example
 * normalizePlayerName('J.T. Realmuto') // Returns 'jt realmuto'
 * normalizePlayerName('José  Altuve') // Returns 'jose altuve'
 */
function normalizePlayerName(name) {
  if (!name) return ''

  return normalizeAccents(name.trim().toLowerCase())
    .replace(/\./g, '') // Remove periods like "J.T." -> "JT"
    .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
}

/**
 * Normalize team name for matching
 *
 * - Removes accents
 * - Converts to lowercase
 * - Removes ALL spaces (handles "Wolf Pack" vs "Wolfpack")
 * - Removes periods and hyphens
 *
 * @param {string} name - Team name to normalize
 * @returns {string} - Normalized team name
 *
 * @example
 * normalizeTeamName('Los Angeles Angels') // Returns 'losangelesangels'
 * normalizeTeamName('Wolf Pack') // Returns 'wolfpack'
 * normalizeTeamName('St. Louis Cardinals') // Returns 'stlouiscardinals'
 */
function normalizeTeamName(name) {
  if (!name) return ''

  return normalizeAccents(name.trim().toLowerCase())
    .replace(/\s+/g, '') // Remove ALL spaces
    .replace(/[.-]/g, '') // Remove periods and hyphens
}

/**
 * Split and normalize multiple player names
 *
 * Handles comma or semicolon separated player names from spreadsheets
 *
 * @param {string} playerNames - Multiple player names separated by commas/semicolons
 * @returns {Array<string>} - Array of normalized player names
 *
 * @example
 * splitPlayerNames('Mike Trout, Shohei Ohtani') // Returns ['mike trout', 'shohei ohtani']
 */
function splitPlayerNames(playerNames) {
  if (!playerNames) return []

  return playerNames
    .split(/[,;]/)
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => normalizePlayerName(name))
}

/**
 * Split and normalize multiple team names
 *
 * Handles comma or semicolon separated team names from spreadsheets
 *
 * @param {string} teamNames - Multiple team names separated by commas/semicolons
 * @returns {Array<string>} - Array of normalized team names
 *
 * @example
 * splitTeamNames('Angels, Dodgers') // Returns ['angels', 'dodgers']
 */
function splitTeamNames(teamNames) {
  if (!teamNames) return []

  return teamNames
    .split(/[,;]/)
    .map(name => name.trim())
    .filter(name => name.length > 0)
    .map(name => normalizeTeamName(name))
}

module.exports = {
  normalizeAccents,
  normalizePlayerName,
  normalizeTeamName,
  splitPlayerNames,
  splitTeamNames
}
