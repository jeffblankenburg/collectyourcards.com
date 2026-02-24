/**
 * Auto-Resolution Logic for Provisional Cards
 *
 * This module attempts to match user's text input against existing database entities.
 * It uses exact matching first, then fuzzy matching for players.
 */

const { prisma } = require('../../../config/prisma-singleton')

/**
 * Normalize a string for comparison
 * - Lowercase
 * - Remove extra whitespace
 * - Remove common punctuation
 */
function normalizeString(str) {
  if (!str) return ''
  return str
    .toLowerCase()
    .trim()
    .replace(/[''`]/g, "'")
    .replace(/\s+/g, ' ')
}

/**
 * Calculate string similarity using Levenshtein distance
 * Returns a value between 0 and 1 (1 = exact match)
 */
function similarity(s1, s2) {
  if (!s1 || !s2) return 0
  const a = normalizeString(s1)
  const b = normalizeString(s2)

  if (a === b) return 1.0

  const longer = a.length > b.length ? a : b
  const shorter = a.length > b.length ? b : a

  if (longer.length === 0) return 1.0

  // Simple check: one contains the other
  if (longer.includes(shorter) || shorter.includes(longer)) {
    return shorter.length / longer.length
  }

  // Levenshtein distance
  const matrix = []
  for (let i = 0; i <= shorter.length; i++) {
    matrix[i] = [i]
  }
  for (let j = 0; j <= longer.length; j++) {
    matrix[0][j] = j
  }
  for (let i = 1; i <= shorter.length; i++) {
    for (let j = 1; j <= longer.length; j++) {
      if (shorter[i - 1] === longer[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }

  const distance = matrix[shorter.length][longer.length]
  return (longer.length - distance) / longer.length
}

/**
 * Match a set by name and year
 * Returns: { id, name, confidence } or null
 */
async function matchSet(setNameRaw, year) {
  const normalized = normalizeString(setNameRaw)

  // Try exact match first (case-insensitive)
  const exactMatch = await prisma.$queryRaw`
    SELECT set_id, name, year
    FROM [set]
    WHERE LOWER(name) = ${normalized}
      AND year = ${year}
  `

  if (exactMatch.length > 0) {
    return {
      id: exactMatch[0].set_id,
      name: exactMatch[0].name,
      year: exactMatch[0].year,
      confidence: 1.0
    }
  }

  // Try partial match (set name contains input or vice versa)
  const partialMatch = await prisma.$queryRaw`
    SELECT set_id, name, year
    FROM [set]
    WHERE year = ${year}
      AND (LOWER(name) LIKE ${`%${normalized}%`} OR ${normalized} LIKE '%' + LOWER(name) + '%')
    ORDER BY
      CASE WHEN LOWER(name) = ${normalized} THEN 0 ELSE 1 END,
      LEN(name) ASC
  `

  if (partialMatch.length > 0) {
    const match = partialMatch[0]
    const conf = similarity(setNameRaw, match.name)
    if (conf >= 0.7) {
      return {
        id: match.set_id,
        name: match.name,
        year: match.year,
        confidence: conf
      }
    }
  }

  return null
}

/**
 * Match a series by name within a set
 * Returns: { id, name, confidence } or null
 *
 * Note: Base series have the SAME NAME as the set (e.g., "2024 Topps Chrome" set
 * has a "2024 Topps Chrome" base series), NOT a series named "Base".
 */
async function matchSeries(seriesNameRaw, setId) {
  // Helper to find the base series for a set
  // Base series is identified by is_base=1, or by having the same name as the set
  const findBaseSeries = async () => {
    const baseSeries = await prisma.$queryRaw`
      SELECT s.series_id, s.name, s.is_base
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      WHERE s.[set] = ${setId}
        AND (s.is_base = 1 OR LOWER(s.name) = LOWER(st.name))
      ORDER BY s.is_base DESC, s.series_id ASC
    `
    if (baseSeries.length > 0) {
      return {
        id: Number(baseSeries[0].series_id),
        name: baseSeries[0].name,
        confidence: 1.0
      }
    }
    return null
  }

  // No series specified - return the base series
  if (!seriesNameRaw) {
    return await findBaseSeries()
  }

  const normalized = normalizeString(seriesNameRaw)

  // If user typed "base" or "base set", they mean the base series
  if (normalized === 'base' || normalized === 'base set') {
    return await findBaseSeries()
  }

  // Try exact match first
  const exactMatch = await prisma.$queryRaw`
    SELECT series_id, name
    FROM series
    WHERE [set] = ${setId}
      AND LOWER(name) = ${normalized}
  `

  if (exactMatch.length > 0) {
    return {
      id: Number(exactMatch[0].series_id),
      name: exactMatch[0].name,
      confidence: 1.0
    }
  }

  // Try partial match
  const partialMatch = await prisma.$queryRaw`
    SELECT series_id, name
    FROM series
    WHERE [set] = ${setId}
      AND (LOWER(name) LIKE ${`%${normalized}%`} OR ${normalized} LIKE '%' + LOWER(name) + '%')
  `

  if (partialMatch.length > 0) {
    const match = partialMatch[0]
    const conf = similarity(seriesNameRaw, match.name)
    if (conf >= 0.7) {
      return {
        id: Number(match.series_id),
        name: match.name,
        confidence: conf
      }
    }
  }

  return null
}

/**
 * Match a color by name
 * Returns: { id, name, confidence } or null
 */
async function matchColor(colorNameRaw) {
  if (!colorNameRaw) return null

  const normalized = normalizeString(colorNameRaw)

  // Try exact match
  const exactMatch = await prisma.$queryRaw`
    SELECT color_id, name
    FROM color
    WHERE LOWER(name) = ${normalized}
  `

  if (exactMatch.length > 0) {
    return {
      id: exactMatch[0].color_id,
      name: exactMatch[0].name,
      confidence: 1.0
    }
  }

  // Try partial match (user might say "Gold" when color is "Gold Refractor")
  const partialMatch = await prisma.$queryRaw`
    SELECT color_id, name
    FROM color
    WHERE LOWER(name) LIKE ${`%${normalized}%`}
       OR ${normalized} LIKE '%' + LOWER(name) + '%'
    ORDER BY LEN(name) ASC
  `

  if (partialMatch.length > 0) {
    const match = partialMatch[0]
    const conf = similarity(colorNameRaw, match.name)
    if (conf >= 0.5) { // Lower threshold for colors
      return {
        id: match.color_id,
        name: match.name,
        confidence: conf
      }
    }
  }

  return null
}

/**
 * Match a player by name
 * Uses exact match, then alias match, then fuzzy match
 * Returns: { playerId, playerName, teamId?, teamName?, playerTeamId?, confidence } or null
 */
async function matchPlayer(playerNameRaw, teamNameRaw = null) {
  const normalizedPlayer = normalizeString(playerNameRaw)

  // Parse name parts (handles "Mike Trout" or "Trout, Mike")
  let firstName, lastName
  if (normalizedPlayer.includes(',')) {
    const parts = normalizedPlayer.split(',').map(s => s.trim())
    lastName = parts[0]
    firstName = parts[1] || ''
  } else {
    const parts = normalizedPlayer.split(' ')
    firstName = parts[0] || ''
    lastName = parts.slice(1).join(' ') || ''
  }

  // Try exact match on first + last name
  let players = await prisma.$queryRaw`
    SELECT p.player_id, p.first_name, p.last_name,
           pt.player_team_id, pt.team as team_id,
           t.name as team_name
    FROM player p
    LEFT JOIN player_team pt ON p.player_id = pt.player
    LEFT JOIN team t ON pt.team = t.team_Id
    WHERE LOWER(p.first_name) = ${firstName}
      AND LOWER(p.last_name) = ${lastName}
  `

  if (players.length === 0) {
    // Try swapped (in case of "Trout Mike" entry)
    players = await prisma.$queryRaw`
      SELECT p.player_id, p.first_name, p.last_name,
             pt.player_team_id, pt.team as team_id,
             t.name as team_name
      FROM player p
      LEFT JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN team t ON pt.team = t.team_Id
      WHERE LOWER(p.first_name) = ${lastName}
        AND LOWER(p.last_name) = ${firstName}
    `
  }

  if (players.length === 0) {
    // Try alias match
    players = await prisma.$queryRaw`
      SELECT p.player_id, p.first_name, p.last_name,
             pt.player_team_id, pt.team as team_id,
             t.name as team_name
      FROM player p
      JOIN player_alias pa ON p.player_id = pa.player_id
      LEFT JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN team t ON pt.team = t.team_Id
      WHERE LOWER(pa.alias_name) = ${normalizedPlayer}
    `
  }

  if (players.length === 0) {
    // Try fuzzy match (SOUNDEX or LIKE)
    players = await prisma.$queryRaw`
      SELECT TOP 5 p.player_id, p.first_name, p.last_name,
             pt.player_team_id, pt.team as team_id,
             t.name as team_name
      FROM player p
      LEFT JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN team t ON pt.team = t.team_Id
      WHERE (LOWER(p.first_name) LIKE ${`${firstName}%`} AND LOWER(p.last_name) LIKE ${`${lastName}%`})
         OR (LOWER(p.first_name) + ' ' + LOWER(p.last_name) LIKE ${`%${normalizedPlayer}%`})
      ORDER BY p.card_count DESC
    `
  }

  if (players.length === 0) {
    return null
  }

  // If team was specified, try to find the matching team association
  if (teamNameRaw) {
    const normalizedTeam = normalizeString(teamNameRaw)

    // Find player-team match
    for (const player of players) {
      if (player.team_name && similarity(player.team_name, teamNameRaw) >= 0.7) {
        return {
          playerId: Number(player.player_id),
          playerName: `${player.first_name} ${player.last_name}`,
          teamId: player.team_id,
          teamName: player.team_name,
          playerTeamId: player.player_team_id ? Number(player.player_team_id) : null,
          confidence: 0.95
        }
      }
    }

    // No exact team match, but found player
    const player = players[0]
    return {
      playerId: Number(player.player_id),
      playerName: `${player.first_name} ${player.last_name}`,
      teamId: player.team_id || null,
      teamName: player.team_name || null,
      playerTeamId: player.player_team_id ? Number(player.player_team_id) : null,
      confidence: 0.8 // Lower confidence because team didn't match
    }
  }

  // No team specified, return first/best match
  const player = players[0]
  const fullName = `${player.first_name} ${player.last_name}`
  const nameConf = similarity(playerNameRaw, fullName)

  return {
    playerId: Number(player.player_id),
    playerName: fullName,
    teamId: player.team_id || null,
    teamName: player.team_name || null,
    playerTeamId: player.player_team_id ? Number(player.player_team_id) : null,
    confidence: Math.max(0.85, nameConf) // At least 0.85 for found players
  }
}

/**
 * Match a team by name
 * Returns: { id, name, confidence } or null
 */
async function matchTeam(teamNameRaw) {
  if (!teamNameRaw) return null

  const normalized = normalizeString(teamNameRaw)

  // Try exact match
  const exactMatch = await prisma.$queryRaw`
    SELECT team_Id, name
    FROM team
    WHERE LOWER(name) = ${normalized}
  `

  if (exactMatch.length > 0) {
    return {
      id: exactMatch[0].team_Id,
      name: exactMatch[0].name,
      confidence: 1.0
    }
  }

  // Try partial match (city, abbreviation, mascot)
  const partialMatch = await prisma.$queryRaw`
    SELECT team_Id, name, city, mascot, abbreviation
    FROM team
    WHERE LOWER(name) LIKE ${`%${normalized}%`}
       OR LOWER(city) LIKE ${`%${normalized}%`}
       OR LOWER(mascot) LIKE ${`%${normalized}%`}
       OR LOWER(abbreviation) = ${normalized}
    ORDER BY
      CASE WHEN LOWER(abbreviation) = ${normalized} THEN 0 ELSE 1 END,
      CASE WHEN LOWER(name) LIKE ${`%${normalized}%`} THEN 0 ELSE 1 END,
      LEN(name) ASC
  `

  if (partialMatch.length > 0) {
    const match = partialMatch[0]
    const conf = Math.max(
      similarity(teamNameRaw, match.name),
      similarity(teamNameRaw, match.city || ''),
      similarity(teamNameRaw, match.mascot || ''),
      match.abbreviation && normalizeString(match.abbreviation) === normalized ? 1.0 : 0
    )
    if (conf >= 0.6) {
      return {
        id: match.team_Id,
        name: match.name,
        confidence: conf
      }
    }
  }

  return null
}

/**
 * Parse a player/team string that might contain multiple entries
 * Input: "Mike Trout / Aaron Judge" or "Mike Trout, Aaron Judge"
 * Returns: [{ playerName, teamName? }]
 */
function parseMultiplePlayersTeams(playerString, teamString) {
  // Split by "/" or "," or " and "
  const playerNames = playerString
    .split(/\s*[\/,]\s*|\s+and\s+/i)
    .map(s => s.trim())
    .filter(s => s.length > 0)

  let teamNames = []
  if (teamString) {
    teamNames = teamString
      .split(/\s*[\/,]\s*|\s+and\s+/i)
      .map(s => s.trim())
      .filter(s => s.length > 0)
  }

  return playerNames.map((playerName, i) => ({
    playerName,
    teamName: teamNames[i] || teamNames[0] || null // Use corresponding team or first team or null
  }))
}

/**
 * Main auto-resolution function
 * Takes provisional card data and attempts to resolve all entities
 *
 * @param {Object} cardData - The provisional card data
 * @returns {Object} - Resolution results with confidence scores
 */
async function autoResolve(cardData) {
  const results = {
    set: null,
    series: null,
    color: null,
    players: [],
    fullyResolved: false,
    requiresNewSet: false,
    requiresNewSeries: false,
    requiresNewPlayer: false,
    requiresNewTeam: false
  }

  // 1. Resolve set
  results.set = await matchSet(cardData.setNameRaw, cardData.year)
  if (!results.set) {
    results.requiresNewSet = true
  }

  // 2. Resolve series (only if set was found)
  if (results.set && results.set.id) {
    results.series = await matchSeries(cardData.seriesNameRaw, results.set.id)
    if (!results.series && cardData.seriesNameRaw) {
      results.requiresNewSeries = true
    }
  } else {
    results.requiresNewSeries = !!cardData.seriesNameRaw
  }

  // 3. Resolve color
  results.color = await matchColor(cardData.colorNameRaw)

  // 4. Resolve players
  const playerEntries = parseMultiplePlayersTeams(
    cardData.playerNameRaw || '',
    cardData.teamNameRaw || ''
  )

  for (const entry of playerEntries) {
    if (!entry.playerName) continue

    const playerMatch = await matchPlayer(entry.playerName, entry.teamName)
    if (playerMatch) {
      results.players.push({
        ...playerMatch,
        rawPlayerName: entry.playerName,
        rawTeamName: entry.teamName,
        needsReview: playerMatch.confidence < 0.95
      })
    } else {
      results.requiresNewPlayer = true

      // Try to resolve team even if player wasn't found
      let teamId = null
      let teamName = null
      if (entry.teamName) {
        const teamMatch = await matchTeam(entry.teamName)
        if (teamMatch) {
          teamId = teamMatch.id
          teamName = teamMatch.name
        } else {
          results.requiresNewTeam = true
        }
      }

      results.players.push({
        playerId: null,
        playerName: null,
        teamId: teamId,
        teamName: teamName,
        playerTeamId: null,
        confidence: 0,
        rawPlayerName: entry.playerName,
        rawTeamName: entry.teamName,
        needsReview: true
      })
    }
  }

  // 5. Determine if fully resolved
  results.fullyResolved = (
    results.set && results.set.confidence >= 0.95 &&
    (results.series || !cardData.seriesNameRaw) &&
    results.players.every(p => p.playerId && p.confidence >= 0.95)
  )

  return results
}

/**
 * Check if an existing card matches these parameters
 * Used to prevent duplicate card entries
 */
async function findExistingCard(seriesId, cardNumber, playerTeamIds) {
  if (!seriesId || !cardNumber) return null

  // Normalize card number for comparison
  const normalizedCardNumber = cardNumber.toString().trim()

  const cards = await prisma.$queryRaw`
    SELECT c.card_id, c.card_number, c.series
    FROM card c
    WHERE c.series = ${seriesId}
      AND c.card_number_indexed = ${normalizedCardNumber}
  `

  if (cards.length === 0) return null

  // If we have player_team_ids, verify they match
  if (playerTeamIds && playerTeamIds.length > 0) {
    for (const card of cards) {
      const cardPlayers = await prisma.$queryRaw`
        SELECT player_team FROM card_player_team WHERE card = ${card.card_id}
      `
      const cardPlayerTeamIds = cardPlayers.map(cp => Number(cp.player_team))

      // Check if all requested players are on this card
      const allMatch = playerTeamIds.every(ptId => cardPlayerTeamIds.includes(ptId))
      if (allMatch && playerTeamIds.length === cardPlayerTeamIds.length) {
        return {
          cardId: Number(card.card_id),
          cardNumber: card.card_number,
          seriesId: Number(card.series)
        }
      }
    }
  }

  // Return first match if no player_team filtering
  if (cards.length > 0 && (!playerTeamIds || playerTeamIds.length === 0)) {
    return {
      cardId: Number(cards[0].card_id),
      cardNumber: cards[0].card_number,
      seriesId: Number(cards[0].series)
    }
  }

  return null
}

module.exports = {
  autoResolve,
  matchSet,
  matchSeries,
  matchColor,
  matchPlayer,
  matchTeam,
  findExistingCard,
  parseMultiplePlayersTeams,
  similarity,
  normalizeString
}
