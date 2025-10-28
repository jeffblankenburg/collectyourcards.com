/**
 * String Similarity Utilities
 *
 * Provides algorithms for fuzzy string matching, used primarily
 * for matching user input (player names, team names) to database records.
 *
 * @module utils/string-similarity
 */

/**
 * Calculate Levenshtein distance between two strings
 *
 * Measures the minimum number of single-character edits (insertions, deletions, substitutions)
 * required to change one string into another. Lower values indicate more similar strings.
 *
 * @param {string} str1 - First string to compare
 * @param {string} str2 - Second string to compare
 * @returns {number} - Edit distance between the strings (0 = identical)
 *
 * @example
 * levenshteinDistance('kitten', 'sitting') // Returns 3
 * levenshteinDistance('mike', 'mike') // Returns 0
 * levenshteinDistance('angels', 'anglels') // Returns 2 (transposition + insertion)
 */
function levenshteinDistance(str1, str2) {
  const m = str1.length
  const n = str2.length
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))

  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }

  return dp[m][n]
}

/**
 * Calculate similarity ratio between two strings (0-1 scale)
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} - Similarity ratio from 0 (completely different) to 1 (identical)
 *
 * @example
 * getSimilarityRatio('mike trout', 'michael trout') // Returns ~0.77
 */
function getSimilarityRatio(str1, str2) {
  const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase())
  const maxLength = Math.max(str1.length, str2.length)

  if (maxLength === 0) return 1.0 // Both strings empty

  return 1.0 - (distance / maxLength)
}

/**
 * Check if two strings are similar within a threshold
 *
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @param {number} threshold - Minimum similarity ratio (0-1, default 0.8)
 * @returns {boolean} - True if strings are similar enough
 *
 * @example
 * isSimilar('angels', 'anglels', 0.8) // Returns true (typo within threshold)
 * isSimilar('yankees', 'dodgers', 0.8) // Returns false (too different)
 */
function isSimilar(str1, str2, threshold = 0.8) {
  return getSimilarityRatio(str1, str2) >= threshold
}

module.exports = {
  levenshteinDistance,
  getSimilarityRatio,
  isSimilar
}
