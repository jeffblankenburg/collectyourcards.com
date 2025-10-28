/**
 * Batch Lookup Service
 *
 * Optimized database queries for batch player/team lookups during import.
 * Uses parameterized queries and batching to reduce database round-trips
 * from hundreds to just a few queries.
 *
 * @module services/import/batch-lookup
 */

const sql = require('mssql')
const { normalizePlayerName, normalizeTeamName } = require('./name-normalizer')
const { levenshteinDistance } = require('../../utils/string-similarity')

class BatchLookupService {
  constructor(pool) {
    this.pool = pool
  }

  /**
   * Batch lookup for all players at once
   *
   * Performs a single database query to fetch all players with their teams,
   * then matches against the provided names using exact and fuzzy matching.
   *
   * Organization filtering: Includes NCAA (ID: 5) when searching professional leagues (1-4)
   *
   * @param {Array<string>} playerNames - Array of player names to lookup
   * @param {number|null} organizationId - Organization ID to filter by (1=MLB, 2=NFL, 3=NBA, 4=NHL, 5=NCAA)
   * @returns {Promise<Object>} - Lookup object with exact and fuzzy matches per name
   */
  async batchFindPlayers(playerNames, organizationId = null) {
    try {
      console.log(`🔍 Batch lookup for ${playerNames.length} unique players`)
      const playerLookup = {}

      if (playerNames.length === 0) return playerLookup

      console.log('🔍 Sample player names to search:', playerNames.slice(0, 5))

      // Include NCAA players when searching for professional leagues
      // Organization IDs: 1=MLB, 2=NFL, 3=NBA, 4=NHL, 5=NCAA
      const organizationFilter = organizationId ? [parseInt(organizationId)] : null
      if (organizationFilter && [1, 2, 3, 4].includes(parseInt(organizationId))) {
        organizationFilter.push(5) // Always include NCAA for pro leagues
        console.log(`🎓 Including NCAA players in batch search (orgs: ${organizationFilter.join(', ')})`)
      }

      // Get all players WITH their teams for suggestions
      let baseQuery = `
        SELECT DISTINCT
          p.player_id as playerId,
          LTRIM(RTRIM(COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, ''))) as playerName,
          p.first_name as firstName,
          p.last_name as lastName,
          p.nick_name as nickName,
          t.team_id as teamId,
          t.name as teamName,
          t.primary_color as primaryColor,
          t.secondary_color as secondaryColor,
          t.abbreviation as abbreviation
        FROM player p
        LEFT JOIN player_team pt ON p.player_id = pt.player
        LEFT JOIN team t ON pt.team = t.team_id
      `

      const request = this.pool.request()

      if (organizationFilter) {
        // Create parameters for each organization ID in the filter
        organizationFilter.forEach((orgId, index) => {
          request.input(`org${index}`, sql.Int, orgId)
        })
        baseQuery += `
          WHERE (
            NOT EXISTS (SELECT 1 FROM player_team pt_check WHERE pt_check.player = p.player_id)
            OR
            p.player_id IN (
              SELECT DISTINCT pt2.player
              FROM player_team pt2
              JOIN team t2 ON pt2.team = t2.team_id
              WHERE t2.organization IN (${organizationFilter.map((_, i) => `@org${i}`).join(', ')})
            )
          )
        `
      }

      baseQuery += ` ORDER BY p.first_name, p.last_name`

      console.log('🔍 Running player lookup query...')
      const allPlayersResult = await request.query(baseQuery)
      console.log(`📊 Found ${allPlayersResult.recordset.length} total player-team records in database`)

      // Group players by ID to consolidate teams
      const allPlayersGrouped = this._groupPlayersByTeam(allPlayersResult.recordset)
      console.log(`📊 Grouped into ${allPlayersGrouped.length} unique players`)

      // Match in JavaScript with both exact and fuzzy matching
      playerNames.forEach(searchName => {
        const normalizedSearchName = normalizePlayerName(searchName)
        console.log(`🔍 Searching for: "${searchName}" -> normalized: "${normalizedSearchName}"`)

        // Find exact matches
        const exactMatches = this._findExactPlayerMatches(allPlayersGrouped, searchName, normalizedSearchName)

        // Find fuzzy matches (only if no exact matches found)
        let fuzzyMatches = []
        if (exactMatches.length === 0) {
          fuzzyMatches = this._findFuzzyPlayerMatches(allPlayersGrouped, searchName, normalizedSearchName)
        }

        playerLookup[searchName] = {
          exact: exactMatches,
          fuzzy: fuzzyMatches
        }

        console.log(`🎯 "${searchName}": found ${exactMatches.length} exact + ${fuzzyMatches.length} fuzzy matches`)
      })

      console.log(`✅ Batch player lookup complete: ${Object.keys(playerLookup).length} names processed`)

      // Log summary
      const totalMatches = Object.values(playerLookup).reduce((sum, result) => sum + result.exact.length, 0)
      console.log(`📊 Summary: ${totalMatches} total matches found across all names`)

      return playerLookup

    } catch (error) {
      console.error('Error in batch player lookup:', error)
      return {}
    }
  }

  /**
   * Batch lookup for all teams at once
   *
   * @param {Array<string>} teamNames - Array of team names to lookup
   * @param {number|null} organizationId - Organization ID to filter by
   * @returns {Promise<Object>} - Lookup object with exact and fuzzy matches per team
   */
  async batchFindTeams(teamNames, organizationId = null) {
    try {
      console.log(`🏟️ Batch lookup for ${teamNames.length} unique teams`)
      console.log(`🏟️ Team names to lookup:`, teamNames)
      console.log(`🏟️ Organization ID:`, organizationId)
      const teamLookup = {}

      if (teamNames.length === 0) return teamLookup

      // Create parameterized query for all teams using OR conditions
      const request = this.pool.request()

      // Build OR conditions for name matching (with full normalization including spaces)
      const nameConditions = teamNames.map((teamName, index) => {
        const normalizedName = normalizeTeamName(teamName)
        request.input(`team${index}`, sql.NVarChar, normalizedName)
        console.log(`  🔧 Parameter @team${index} = "${normalizedName}" (original: "${teamName}")`)
        // Need to normalize database values too - remove spaces, periods, hyphens
        return `(
          REPLACE(REPLACE(REPLACE(LOWER(t.name), ' ', ''), '.', ''), '-', '') = @team${index}
          OR
          REPLACE(REPLACE(REPLACE(LOWER(t.abbreviation), ' ', ''), '.', ''), '-', '') = @team${index}
        )`
      }).join(' OR ')

      if (organizationId) {
        request.input('organizationId', sql.Int, organizationId)
      }

      const exactQuery = `
        SELECT DISTINCT
          t.team_id as teamId,
          t.name as teamName,
          t.city as city,
          t.abbreviation as abbreviation,
          t.primary_color as primaryColor,
          t.secondary_color as secondaryColor
        FROM team t
        WHERE (${nameConditions})
        ${organizationId ? 'AND t.organization = @organizationId' : ''}
        ORDER BY t.name
      `

      console.log(`🔍 Executing exact match query`)
      const exactResult = await request.query(exactQuery)
      console.log(`📊 Exact match query returned ${exactResult.recordset.length} results`)

      // Group results by team name
      teamNames.forEach(teamName => {
        const matches = this._matchTeams(exactResult.recordset, teamName)
        teamLookup[teamName] = {
          exact: matches,
          fuzzy: []
        }
      })

      // For teams with no exact matches, try fuzzy matching
      const teamsWithoutMatches = teamNames.filter(teamName =>
        teamLookup[teamName].exact.length === 0
      )

      console.log(`📊 Team match status:`)
      teamNames.forEach(teamName => {
        console.log(`  "${teamName}": ${teamLookup[teamName].exact.length} exact matches`)
      })

      if (teamsWithoutMatches.length > 0) {
        console.log(`🔍 Attempting fuzzy matching for ${teamsWithoutMatches.length} teams without exact matches`)
        await this._findFuzzyTeamMatches(teamsWithoutMatches, teamLookup, organizationId)
      }

      const exactCount = Object.values(teamLookup).filter(t => t.exact.length > 0).length
      const fuzzyCount = Object.values(teamLookup).filter(t => t.fuzzy.length > 0).length
      console.log(`✅ Batch team lookup complete: ${exactCount} exact matches, ${fuzzyCount} fuzzy matches`)
      return teamLookup

    } catch (error) {
      console.error('Error in batch team lookup:', error)
      return {}
    }
  }

  /**
   * Batch lookup for specific player_team combinations only
   *
   * Checks which player-team relationships already exist in the database.
   *
   * @param {Array<string>} combinationKeys - Array of "playerId_teamId" keys
   * @returns {Promise<Object>} - Lookup object with existing player_team records
   */
  async batchFindActualPlayerTeams(combinationKeys) {
    try {
      console.log(`🤝 Batch lookup for ${combinationKeys.length} specific player_team combinations`)
      const playerTeamLookup = {}

      if (combinationKeys.length === 0) return playerTeamLookup

      // Parse the keys back to player/team IDs
      const combinations = combinationKeys.map(key => {
        const [playerId, teamId] = key.split('_')
        return { playerId, teamId, key }
      })

      // Batch query all specific combinations
      const conditions = combinations.map((_, index) =>
        `(pt.player = @player${index} AND pt.team = @team${index})`
      ).join(' OR ')

      const request = this.pool.request()
      combinations.forEach((combo, index) => {
        request.input(`player${index}`, sql.BigInt, combo.playerId)
        request.input(`team${index}`, sql.Int, combo.teamId)
      })

      const query = `
        SELECT
          pt.player_team_id as playerTeamId,
          pt.player as playerId,
          pt.team as teamId
        FROM player_team pt
        WHERE ${conditions}
      `

      console.log(`🔍 Running player_team query with ${combinations.length} combinations`)
      const result = await request.query(query)
      console.log(`📊 Query returned ${result.recordset.length} existing player_team records`)

      // Index results by player_team key
      result.recordset.forEach(row => {
        const key = `${row.playerId}_${row.teamId}`
        playerTeamLookup[key] = {
          playerTeamId: String(row.playerTeamId),
          playerId: String(row.playerId),
          teamId: String(row.teamId)
        }
        console.log(`✅ Found player_team record: ${key} -> ${row.playerTeamId}`)
      })

      console.log(`✅ Batch player_team lookup complete: ${Object.keys(playerTeamLookup).length} combinations found`)
      return playerTeamLookup

    } catch (error) {
      console.error('Error in batch player_team lookup:', error)
      return {}
    }
  }

  // ============================================================================
  // PRIVATE HELPER METHODS
  // ============================================================================

  /**
   * Group player records by ID to consolidate teams
   * @private
   */
  _groupPlayersByTeam(recordset) {
    const playerMap = new Map()
    recordset.forEach(row => {
      const playerId = String(row.playerId)
      if (!playerMap.has(playerId)) {
        playerMap.set(playerId, {
          playerId,
          playerName: row.playerName,
          firstName: row.firstName,
          lastName: row.lastName,
          nickName: row.nickName,
          teams: []
        })
      }

      if (row.teamId) {
        // Check for duplicate teams before adding
        const existingTeam = playerMap.get(playerId).teams.find(team => team.teamId === String(row.teamId))
        if (!existingTeam) {
          playerMap.get(playerId).teams.push({
            teamId: String(row.teamId),
            teamName: row.teamName,
            primaryColor: row.primaryColor,
            secondaryColor: row.secondaryColor,
            abbreviation: row.abbreviation
          })
        }
      }
    })

    return Array.from(playerMap.values())
  }

  /**
   * Find exact player matches
   * @private
   */
  _findExactPlayerMatches(allPlayersGrouped, searchName, normalizedSearchName) {
    return allPlayersGrouped.filter(player => {
      const normalizedPlayerName = normalizePlayerName(player.playerName || '')
      const isRegularMatch = normalizedPlayerName === normalizedSearchName

      // Also check nickname + last_name (e.g., "Minnie Minoso")
      let isNicknameMatch = false
      if (player.nickName && player.lastName) {
        const nickNameVariation = normalizePlayerName(`${player.nickName} ${player.lastName}`)
        isNicknameMatch = nickNameVariation === normalizedSearchName
      }

      const isMatch = isRegularMatch || isNicknameMatch

      if (isMatch) {
        if (isNicknameMatch) {
          console.log(`✅ EXACT NICKNAME MATCH: "${searchName}" matches "${player.nickName} ${player.lastName}" (${player.playerName}) with ${player.teams.length} teams`)
        } else {
          console.log(`✅ EXACT MATCH: "${searchName}" matches "${player.playerName}" with ${player.teams.length} teams`)
        }
      }

      return isMatch
    })
  }

  /**
   * Find fuzzy player matches
   * @private
   */
  _findFuzzyPlayerMatches(allPlayersGrouped, searchName, normalizedSearchName) {
    // Check if this is a single-name search (like "Ichiro")
    const isSingleName = !normalizedSearchName.includes(' ')

    let fuzzyMatches = allPlayersGrouped.filter(player => {
      // Construct full name from database fields
      const dbFullName = `${player.firstName || ''} ${player.lastName || ''}`.trim()
      const normalizedDbName = normalizePlayerName(dbFullName)

      if (!normalizedDbName) return false

      // Special handling for single-name searches (e.g., "Ichiro")
      if (isSingleName) {
        const normalizedFirstName = normalizePlayerName(player.firstName || '')
        const normalizedLastName = normalizePlayerName(player.lastName || '')

        // Check if search matches just the first name
        if (normalizedFirstName === normalizedSearchName) {
          console.log(`👤 SINGLE NAME MATCH (first name): "${searchName}" matches "${dbFullName}"`)
          player.similarity = 0.95 // High priority for single-name matches
          player.distance = 0
          return true
        }

        // Check if search matches just the last name
        if (normalizedLastName === normalizedSearchName) {
          console.log(`👤 SINGLE NAME MATCH (last name): "${searchName}" matches "${dbFullName}"`)
          player.similarity = 0.95
          player.distance = 0
          return true
        }
      }

      // Calculate similarity between search string and database full name
      const distance = levenshteinDistance(normalizedSearchName, normalizedDbName)
      const maxLength = Math.max(normalizedSearchName.length, normalizedDbName.length)
      const similarity = 1 - (distance / maxLength)

      // Also check nickname variation if available
      let nickSimilarity = 0
      let nickDistance = 999
      if (player.nickName && player.lastName) {
        const nickFullName = `${player.nickName} ${player.lastName}`.trim()
        const normalizedNickName = normalizePlayerName(nickFullName)
        nickDistance = levenshteinDistance(normalizedSearchName, normalizedNickName)
        const nickMaxLength = Math.max(normalizedSearchName.length, normalizedNickName.length)
        nickSimilarity = 1 - (nickDistance / nickMaxLength)
      }

      // Use the best similarity score
      const bestSimilarity = Math.max(similarity, nickSimilarity)
      const bestDistance = Math.min(distance, nickDistance)

      // Match if BOTH distance is close AND similarity is reasonable
      const isFuzzyMatch = bestDistance <= 2 || (bestDistance <= 3 && bestSimilarity > 0.75) || bestSimilarity > 0.85

      if (isFuzzyMatch) {
        if (nickSimilarity > similarity) {
          console.log(`🔍 FUZZY NICKNAME MATCH: "${searchName}" ~= "${player.nickName} ${player.lastName}" (similarity: ${bestSimilarity.toFixed(2)}, distance: ${bestDistance}, teams: ${player.teams.length})`)
        } else {
          console.log(`🔍 FUZZY MATCH: "${searchName}" ~= "${dbFullName}" (similarity: ${bestSimilarity.toFixed(2)}, distance: ${bestDistance}, teams: ${player.teams.length})`)
        }
        player.similarity = bestSimilarity
        player.distance = bestDistance
      }

      return isFuzzyMatch
    })

    // Sort fuzzy matches by similarity (best first)
    fuzzyMatches.sort((a, b) => b.similarity - a.similarity)

    // If we have a perfect single-name match, prioritize it heavily
    const hasPerfectMatch = fuzzyMatches.some(p => p.similarity === 1.0)
    if (hasPerfectMatch) {
      const perfectMatches = fuzzyMatches.filter(p => p.similarity === 1.0)
      const otherMatches = fuzzyMatches.filter(p => p.similarity < 1.0).slice(0, 2)
      fuzzyMatches = [...perfectMatches, ...otherMatches]
    } else {
      // No perfect match, show top 5
      fuzzyMatches = fuzzyMatches.slice(0, 5)
    }

    return fuzzyMatches
  }

  /**
   * Match teams from database results
   * @private
   */
  _matchTeams(recordset, teamName) {
    const normalizedTeamName = normalizeTeamName(teamName)

    console.log(`🔍 Searching for team: "${teamName}"`)
    console.log(`  📝 Normalized input: "${normalizedTeamName}"`)
    console.log(`  📊 Comparing against ${recordset.length} teams from database`)

    const matches = recordset.filter(team => {
      // Normalize both sides for comparison (removes spaces, accents, periods, hyphens)
      const normalizedTeamNameFromDB = normalizeTeamName(team.teamName)
      const normalizedAbbrevFromDB = team.abbreviation ? normalizeTeamName(team.abbreviation) : ''

      const nameMatch = normalizedTeamNameFromDB === normalizedTeamName
      const abbrevMatch = normalizedAbbrevFromDB === normalizedTeamName

      if (nameMatch || abbrevMatch) {
        console.log(`  ✅ MATCH: "${teamName}" matches "${team.teamName}"`)
      }

      return nameMatch || abbrevMatch
    }).map(team => ({
      teamId: String(team.teamId),
      teamName: team.teamName,
      city: team.city,
      abbreviation: team.abbreviation,
      primaryColor: team.primaryColor,
      secondaryColor: team.secondaryColor
    }))

    console.log(`✅ Found ${matches.length} matches for "${teamName}":`, matches.map(m => m.teamName))

    return matches
  }

  /**
   * Find fuzzy team matches
   * @private
   */
  async _findFuzzyTeamMatches(teamsWithoutMatches, teamLookup, organizationId) {
    console.log(`🔍 Teams needing fuzzy match:`, teamsWithoutMatches)

    for (const teamName of teamsWithoutMatches) {
      const fuzzyRequest = this.pool.request()
      const normalizedSearchTerm = normalizeTeamName(teamName)
      fuzzyRequest.input('teamName', sql.NVarChar, `%${normalizedSearchTerm}%`)
      if (organizationId) {
        fuzzyRequest.input('organizationId', sql.Int, organizationId)
      }

      const fuzzyQuery = `
        SELECT
          t.team_id as teamId,
          t.name as teamName,
          t.city as city,
          t.abbreviation as abbreviation,
          t.primary_color as primaryColor,
          t.secondary_color as secondaryColor,
          CASE WHEN REPLACE(REPLACE(REPLACE(LOWER(t.name), ' ', ''), '.', ''), '-', '') LIKE @teamName + '%' THEN 0 ELSE 1 END as matchPriority
        FROM team t
        WHERE (
          REPLACE(REPLACE(REPLACE(LOWER(t.name), ' ', ''), '.', ''), '-', '') LIKE @teamName
          OR
          REPLACE(REPLACE(REPLACE(LOWER(t.abbreviation), ' ', ''), '.', ''), '-', '') LIKE @teamName
        )
        ${organizationId ? 'AND t.organization = @organizationId' : ''}
        ORDER BY matchPriority, t.name
      `

      const fuzzyResult = await fuzzyRequest.query(fuzzyQuery)

      if (fuzzyResult.recordset.length > 0) {
        teamLookup[teamName].fuzzy = fuzzyResult.recordset.map(team => ({
          teamId: String(team.teamId),
          teamName: team.teamName,
          city: team.city,
          abbreviation: team.abbreviation,
          primaryColor: team.primaryColor,
          secondaryColor: team.secondaryColor,
          matchType: 'fuzzy' // Mark as fuzzy match for UI
        }))
        console.log(`✨ Found ${fuzzyResult.recordset.length} fuzzy matches for "${teamName}":`,
          fuzzyResult.recordset.map(r => r.teamName).join(', '))
      }
    }
  }
}

module.exports = BatchLookupService
