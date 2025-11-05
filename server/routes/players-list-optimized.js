const express = require('express')
const { getPrismaClient, runBatchedQueries } = require('../utils/prisma-pool-manager')
const { optionalAuthMiddleware } = require('../middleware/auth')
const { escapeLikePattern, sanitizeSearchTerm, validateNumericArray } = require('../utils/sql-security')
const router = express.Router()

// Use global Prisma instance
const prisma = getPrismaClient()

// GET /api/players-list - Get paginated list of all players with their teams
// Optional auth - works for both authenticated and non-authenticated users
router.get('/', optionalAuthMiddleware, async (req, res) => {
  const startTime = Date.now()
  const timings = {}

  try {
    const {
      page = 1,
      limit = 50,
      search,
      sortBy = 'card_count',
      sortOrder = 'desc'
    } = req.query

    const currentPage = Math.max(1, parseInt(page))
    const pageSize = Math.min(Math.max(1, parseInt(limit)), 100)
    const offset = (currentPage - 1) * pageSize

    // Get user ID from optional auth middleware (set by optionalAuthMiddleware)
    // optionalAuthMiddleware sets req.user.id (not user_id)
    const userId = req.user?.id || null
    timings.auth = 0 // Auth handled by middleware

    // Build sort clause
    const sortColumn = ['first_name', 'last_name', 'card_count', 'is_hof'].includes(sortBy) ? sortBy : 'card_count'
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Build where clause for search
    let searchCondition = ''
    if (search && search.trim()) {
      const sanitized = sanitizeSearchTerm(search.trim())
      const safeSearchTerm = escapeLikePattern(sanitized)
      searchCondition = `
        WHERE (
          p.first_name LIKE '%${safeSearchTerm}%' COLLATE Latin1_General_CI_AI
          OR p.last_name LIKE '%${safeSearchTerm}%' COLLATE Latin1_General_CI_AI
          OR p.nick_name LIKE '%${safeSearchTerm}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${safeSearchTerm}%' COLLATE Latin1_General_CI_AI
        )
      `
    }

    // For authenticated users with no search, sort by their collection count
    // For non-authenticated users or with search, sort by card count (default)
    const isAuthUserDefaultView = userId && currentPage === 1 && !search

    // Debug logging
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Players List] Auth check:', {
        userId,
        currentPage,
        search: !!search,
        isAuthUserDefaultView
      })
    }

    timings.priorityPlayers = 0 // Not using priority queries anymore

    // Get total count - OPTIMIZED
    const mainQueriesStart = Date.now()
    const countQuery = `
      SELECT COUNT(DISTINCT p.player_id) as total
      FROM player p
      ${searchCondition}
    `

    // Get top players with team information in a SINGLE OPTIMIZED QUERY
    // For authenticated users (default view, no search), sort by their collection count
    // For everyone else, sort by card count in database
    const playersQuery = `
      WITH ${isAuthUserDefaultView ? `
      UserPlayerCounts AS (
        SELECT
          pt.player as player_id,
          COUNT(DISTINCT uc.user_card_id) as user_collection_count
        FROM user_card uc
        JOIN card c ON uc.card = c.card_id
        JOIN card_player_team cpt ON c.card_id = cpt.card
        JOIN player_team pt ON cpt.player_team = pt.player_team_id
        WHERE uc.[user] = ${userId}
        GROUP BY pt.player
      ),
      ` : ''}
      PlayerData AS (
        SELECT
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.is_hof,
          p.card_count
          ${isAuthUserDefaultView ? ', ISNULL(upc.user_collection_count, 0) as user_collection_count' : ''}
        FROM player p
        ${isAuthUserDefaultView ? 'LEFT JOIN UserPlayerCounts upc ON p.player_id = upc.player_id' : ''}
        ${searchCondition}
        ORDER BY ${isAuthUserDefaultView ? 'ISNULL(upc.user_collection_count, 0) DESC, p.card_count DESC' : sortColumn + ' ' + sortDirection}
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      ),
      PlayerTeams AS (
        SELECT
          pd.player_id,
          t.team_id,
          t.name as team_name,
          t.abbreviation,
          t.primary_color,
          t.secondary_color,
          COUNT(DISTINCT c.card_id) as team_card_count
        FROM PlayerData pd
        JOIN player_team pt ON pd.player_id = pt.player
        JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
        JOIN card c ON cpt.card = c.card_id
        JOIN team t ON pt.team = t.team_id
        GROUP BY pd.player_id, t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color
      )
      SELECT
        pd.*,
        STRING_AGG(
          CONCAT(
            '{',
            '"team_id":', pt.team_id, ',',
            '"name":"', REPLACE(pt.team_name, '"', '\"'), '",',
            '"abbreviation":"', ISNULL(pt.abbreviation, ''), '",',
            '"primary_color":"', ISNULL(pt.primary_color, ''), '",',
            '"secondary_color":"', ISNULL(pt.secondary_color, ''), '",',
            '"card_count":', pt.team_card_count,
            '}'
          ),
          '|||'
        ) WITHIN GROUP (ORDER BY pt.team_card_count DESC) as teams_json
      FROM PlayerData pd
      LEFT JOIN PlayerTeams pt ON pd.player_id = pt.player_id
      GROUP BY pd.player_id, pd.first_name, pd.last_name, pd.nick_name, pd.is_hof, pd.card_count${isAuthUserDefaultView ? ', pd.user_collection_count' : ''}
      ORDER BY ${isAuthUserDefaultView ? 'pd.user_collection_count DESC, pd.card_count DESC' : sortColumn + ' ' + sortDirection}
    `

    // Run queries sequentially to avoid SQL Server contention issues
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const totalCount = Number(countResult[0].total)

    const playersWithTeams = await prisma.$queryRawUnsafe(playersQuery)
    timings.mainQueries = Date.now() - mainQueriesStart

    // Parse the aggregated team data
    const finalPlayersList = playersWithTeams.map(player => {
      const playerObj = {
        player_id: Number(player.player_id),
        first_name: player.first_name,
        last_name: player.last_name,
        nick_name: player.nick_name,
        is_hof: player.is_hof,
        card_count: Number(player.card_count),
        teams: player.teams_json ?
          player.teams_json.split('|||').map(teamStr => {
            try {
              const team = JSON.parse(teamStr)
              return {
                team_id: Number(team.team_id),
                name: team.name,
                abbreviation: team.abbreviation,
                primary_color: team.primary_color,
                secondary_color: team.secondary_color,
                card_count: Number(team.card_count)
              }
            } catch (e) {
              return null
            }
          }).filter(Boolean) : []
      }

      // Include user collection count for authenticated users
      if (isAuthUserDefaultView && player.user_collection_count !== undefined) {
        playerObj.user_card_count = Number(player.user_collection_count)
      }

      return playerObj
    })

    timings.priorityTeams = 0 // No longer using separate priority teams query

    // Calculate total time
    timings.total = Date.now() - startTime

    // Log timing info in development
    if (process.env.NODE_ENV !== 'production') {
      console.log('[Players List API] Timing breakdown:', timings)
    }

    // Add timing header for debugging
    res.setHeader('X-Response-Time', `${timings.total}ms`)
    res.setHeader('X-DB-Time', `${(timings.priorityPlayers || 0) + timings.mainQueries + (timings.priorityTeams || 0)}ms`)

    res.json({
      players: finalPlayersList,
      pagination: {
        current_page: currentPage,
        total_pages: Math.ceil(totalCount / pageSize),
        total_count: totalCount,
        page_size: pageSize,
        has_more: currentPage * pageSize < totalCount
      },
      sort_type: isAuthUserDefaultView ? 'user_collection' : 'card_count'
    })
  } catch (error) {
    console.error('Error fetching players list:', error)
    res.status(500).json({ 
      error: 'Failed to fetch players list',
      message: error.message 
    })
  }
})

// GET /api/players-list/alphabet - Get players grouped by first letter
router.get('/alphabet', async (req, res) => {
  try {
    // Optimized query to get player counts by first letter
    const alphabetQuery = `
      SELECT 
        UPPER(LEFT(last_name, 1)) as letter,
        COUNT(DISTINCT player_id) as player_count,
        SUM(card_count) as total_cards
      FROM player
      WHERE last_name IS NOT NULL AND last_name != ''
      GROUP BY UPPER(LEFT(last_name, 1))
      ORDER BY letter
    `

    const alphabetData = await prisma.$queryRawUnsafe(alphabetQuery)
    
    const formattedData = alphabetData.map(item => ({
      letter: item.letter,
      player_count: Number(item.player_count),
      total_cards: Number(item.total_cards)
    }))

    res.json({
      alphabet: formattedData
    })
  } catch (error) {
    console.error('Error fetching alphabet data:', error)
    res.status(500).json({ 
      error: 'Failed to fetch alphabet data',
      message: error.message 
    })
  }
})

// GET /api/players-list/by-letter/:letter - Get players by first letter
router.get('/by-letter/:letter', async (req, res) => {
  try {
    const { letter } = req.params
    const { 
      page = 1, 
      limit = 50,
      sortBy = 'last_name',
      sortOrder = 'asc'
    } = req.query
    
    const currentPage = Math.max(1, parseInt(page))
    const pageSize = Math.min(Math.max(1, parseInt(limit)), 100)
    const offset = (currentPage - 1) * pageSize

    // Build sort clause
    const sortColumn = ['first_name', 'last_name', 'card_count', 'is_hof'].includes(sortBy) ? sortBy : 'last_name'
    const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC'

    // Single optimized query to get players and their teams
    const playersQuery = `
      WITH PlayerData AS (
        SELECT 
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.is_hof,
          p.card_count
        FROM player p
        WHERE UPPER(LEFT(p.last_name, 1)) = '${letter.toUpperCase()}'
        ORDER BY ${sortColumn} ${sortDirection}
        OFFSET ${offset} ROWS
        FETCH NEXT ${pageSize} ROWS ONLY
      ),
      PlayerTeams AS (
        SELECT 
          pd.player_id,
          t.team_id,
          t.name as team_name,
          t.abbreviation,
          t.primary_color,
          t.secondary_color,
          COUNT(DISTINCT c.card_id) as team_card_count
        FROM PlayerData pd
        JOIN player_team pt ON pd.player_id = pt.player
        JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
        JOIN card c ON cpt.card = c.card_id
        JOIN team t ON pt.team = t.team_id
        GROUP BY pd.player_id, t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color
      )
      SELECT 
        pd.*,
        STRING_AGG(
          CONCAT(
            '{',
            '"team_id":', pt.team_id, ',',
            '"name":"', REPLACE(pt.team_name, '"', '\"'), '",',
            '"abbreviation":"', ISNULL(pt.abbreviation, ''), '",',
            '"primary_color":"', ISNULL(pt.primary_color, ''), '",',
            '"secondary_color":"', ISNULL(pt.secondary_color, ''), '",',
            '"card_count":', pt.team_card_count,
            '}'
          ),
          '|||'
        ) WITHIN GROUP (ORDER BY pt.team_card_count DESC) as teams_json
      FROM PlayerData pd
      LEFT JOIN PlayerTeams pt ON pd.player_id = pt.player_id
      GROUP BY pd.player_id, pd.first_name, pd.last_name, pd.nick_name, pd.is_hof, pd.card_count
      ORDER BY ${sortColumn} ${sortDirection}
    `

    const playersWithTeams = await prisma.$queryRawUnsafe(playersQuery)

    // Get total count
    const countQuery = `
      SELECT COUNT(DISTINCT player_id) as total
      FROM player
      WHERE UPPER(LEFT(last_name, 1)) = '${letter.toUpperCase()}'
    `
    
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const totalCount = Number(countResult[0].total)

    // Parse the aggregated team data
    const formattedPlayers = playersWithTeams.map(player => ({
      player_id: Number(player.player_id),
      first_name: player.first_name,
      last_name: player.last_name,
      nick_name: player.nick_name,
      is_hof: player.is_hof,
      card_count: Number(player.card_count),
      teams: player.teams_json ? 
        player.teams_json.split('|||').map(teamStr => {
          try {
            const team = JSON.parse(teamStr)
            return {
              team_id: Number(team.team_id),
              name: team.name,
              abbreviation: team.abbreviation,
              primary_color: team.primary_color,
              secondary_color: team.secondary_color,
              card_count: Number(team.card_count)
            }
          } catch (e) {
            return null
          }
        }).filter(Boolean) : []
    }))

    res.json({
      letter: letter.toUpperCase(),
      players: formattedPlayers,
      pagination: {
        current_page: currentPage,
        total_pages: Math.ceil(totalCount / pageSize),
        total_count: totalCount,
        page_size: pageSize,
        has_more: currentPage * pageSize < totalCount
      }
    })
  } catch (error) {
    console.error('Error fetching players by letter:', error)
    res.status(500).json({ 
      error: 'Failed to fetch players by letter',
      message: error.message 
    })
  }
})

module.exports = router