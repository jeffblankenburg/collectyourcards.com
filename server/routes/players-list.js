const express = require('express')
const { getPrismaClient, runBatchedQueries } = require('../utils/prisma-pool-manager')
const { optionalAuthMiddleware } = require('../middleware/auth')
const { escapeLikePattern, sanitizeSearchTerm, validateNumericId, validateNumericArray } = require('../utils/sql-security')
const router = express.Router()

// Use global Prisma instance
const prisma = getPrismaClient()

// GET /api/players-list - Get paginated list of all players with their teams
router.get('/', optionalAuthMiddleware, async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 50,
      search,
      sortBy = 'card_count',
      sortOrder = 'desc',
      team_id
    } = req.query
    
    const currentPage = Math.max(1, parseInt(page))
    const pageSize = Math.min(Math.max(1, parseInt(limit)), 100)
    const offset = (currentPage - 1) * pageSize

    // Get user ID if authenticated (set by optionalAuthMiddleware)
    const userId = req.user?.id || null

    // Build sort clause
    const sortColumn = ['first_name', 'last_name', 'card_count', 'is_hof'].includes(sortBy) ? sortBy : 'card_count'
    const sortDirection = sortOrder === 'asc' ? 'ASC' : 'DESC'

    // Build where clause for search and team filtering
    let whereConditions = []
    
    if (search && search.trim()) {
      // Sanitize and escape search term for SQL safety
      const sanitized = sanitizeSearchTerm(search.trim())
      const safeSearchTerm = escapeLikePattern(sanitized)
      whereConditions.push(`
        (
          p.first_name LIKE '%${safeSearchTerm}%' COLLATE Latin1_General_CI_AI
          OR p.last_name LIKE '%${safeSearchTerm}%' COLLATE Latin1_General_CI_AI
          OR p.nick_name LIKE '%${safeSearchTerm}%' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${safeSearchTerm}%' COLLATE Latin1_General_CI_AI
        )
      `)
    }
    
    if (team_id && team_id.trim()) {
      try {
        const teamIdNum = validateNumericId(team_id, 'team_id')
        whereConditions.push(`
          p.player_id IN (
            SELECT DISTINCT pt.player
            FROM player_team pt
            WHERE pt.team = ${teamIdNum}
          )
        `)
      } catch (err) {
        // Invalid team_id - skip filter
      }
    }
    
    const searchCondition = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}`
      : ''

    // First, get recently viewed or most visited players if user is logged in
    let recentlyViewedPlayers = []
    let mostVisitedPlayers = []

    if (userId && currentPage === 1 && !search) {
      // Get recently viewed players - OPTIMIZED SINGLE QUERY
      const recentQuery = `
        WITH RecentPlayers AS (
          SELECT TOP 5
            p.player_id,
            p.first_name,
            p.last_name,
            p.nick_name,
            p.slug,
            p.is_hof,
            p.card_count,
            (
              SELECT COUNT(DISTINCT c.card_id)
              FROM card c
              JOIN card_player_team cpt ON c.card_id = cpt.card
              JOIN player_team pt ON cpt.player_team = pt.player_team_id
              WHERE pt.player = p.player_id AND c.is_rookie = 1
            ) as rookie_count,
            (
              SELECT COUNT(DISTINCT uc.card)
              FROM user_card uc
              JOIN card c ON uc.card = c.card_id
              JOIN card_player_team cpt ON c.card_id = cpt.card
              JOIN player_team pt ON cpt.player_team = pt.player_team_id
              WHERE pt.player = p.player_id AND uc.[user] = ${userId}
            ) as user_card_count,
            MAX(pv.viewed_at) as last_viewed,
            display_card_photo.photo_url as display_card_front_image
          FROM player_views pv
          JOIN player p ON pv.player_id = p.player_id
          LEFT JOIN card display_card ON p.display_card = display_card.card_id
          LEFT JOIN user_card display_uc ON display_card.reference_user_card = display_uc.user_card_id
          LEFT JOIN user_card_photo display_card_photo ON display_uc.user_card_id = display_card_photo.user_card AND display_card_photo.sort_order = 1
          WHERE pv.user_id = ${userId}
            AND pv.viewed_at >= DATEADD(day, -30, GETDATE())
          GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.slug, p.is_hof, p.card_count, display_card_photo.photo_url
          ORDER BY MAX(pv.viewed_at) DESC
        )
        SELECT * FROM RecentPlayers
      `

      try {
        recentlyViewedPlayers = await prisma.$queryRawUnsafe(recentQuery)
      } catch (err) {
        console.error('Error fetching recently viewed players:', err)
      }

      // Get most visited players - OPTIMIZED SINGLE QUERY
      const popularQuery = `
        WITH PopularPlayers AS (
          SELECT TOP 10
            p.player_id,
            p.first_name,
            p.last_name,
            p.nick_name,
            p.slug,
            p.is_hof,
            p.card_count,
            (
              SELECT COUNT(DISTINCT c.card_id)
              FROM card c
              JOIN card_player_team cpt ON c.card_id = cpt.card
              JOIN player_team pt ON cpt.player_team = pt.player_team_id
              WHERE pt.player = p.player_id AND c.is_rookie = 1
            ) as rookie_count,
            (
              SELECT COUNT(DISTINCT uc.card)
              FROM user_card uc
              JOIN card c ON uc.card = c.card_id
              JOIN card_player_team cpt ON c.card_id = cpt.card
              JOIN player_team pt ON cpt.player_team = pt.player_team_id
              WHERE pt.player = p.player_id AND uc.[user] = ${userId}
            ) as user_card_count,
            COUNT(pv.view_id) as view_count,
            display_card_photo.photo_url as display_card_front_image
          FROM player_views pv
          JOIN player p ON pv.player_id = p.player_id
          LEFT JOIN card display_card ON p.display_card = display_card.card_id
          LEFT JOIN user_card display_uc ON display_card.reference_user_card = display_uc.user_card_id
          LEFT JOIN user_card_photo display_card_photo ON display_uc.user_card_id = display_card_photo.user_card AND display_card_photo.sort_order = 1
          WHERE pv.viewed_at >= DATEADD(day, -7, GETDATE())
          GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.slug, p.is_hof, p.card_count, display_card_photo.photo_url
          ORDER BY COUNT(pv.view_id) DESC
        )
        SELECT * FROM PopularPlayers
      `

      try {
        mostVisitedPlayers = await prisma.$queryRawUnsafe(popularQuery)
      } catch (err) {
        console.error('Error fetching most visited players:', err)
      }
    }

    // Get total count - OPTIMIZED
    const countQuery = `
      SELECT COUNT(DISTINCT p.player_id) as total
      FROM player p
      ${searchCondition}
    `
    
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const totalCount = Number(countResult[0].total)

    // Get top players with team information in a SINGLE OPTIMIZED QUERY
    const playersQuery = `
      WITH PlayerData AS (
        SELECT
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.slug,
          p.is_hof,
          p.card_count,
          (
            SELECT COUNT(DISTINCT c.card_id)
            FROM card c
            JOIN card_player_team cpt ON c.card_id = cpt.card
            JOIN player_team pt ON cpt.player_team = pt.player_team_id
            WHERE pt.player = p.player_id AND c.is_rookie = 1
          ) as rookie_count${userId ? `,
          (
            SELECT COUNT(DISTINCT uc.card)
            FROM user_card uc
            JOIN card c ON uc.card = c.card_id
            JOIN card_player_team cpt ON c.card_id = cpt.card
            JOIN player_team pt ON cpt.player_team = pt.player_team_id
            WHERE pt.player = p.player_id AND uc.[user] = ${userId}
          ) as user_card_count` : ''},
          display_card_photo.photo_url as display_card_front_image
        FROM player p
        LEFT JOIN card display_card ON p.display_card = display_card.card_id
        LEFT JOIN user_card display_uc ON display_card.reference_user_card = display_uc.user_card_id
        LEFT JOIN user_card_photo display_card_photo ON display_uc.user_card_id = display_card_photo.user_card AND display_card_photo.sort_order = 1
        ${searchCondition}
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
      GROUP BY pd.player_id, pd.first_name, pd.last_name, pd.nick_name, pd.slug, pd.is_hof, pd.card_count, pd.rookie_count${userId ? ', pd.user_card_count' : ''}, pd.display_card_front_image
      ORDER BY ${sortColumn} ${sortDirection}
    `

    const playersWithTeams = await prisma.$queryRawUnsafe(playersQuery)

    // Parse the aggregated team data
    const formattedPlayers = playersWithTeams.map(player => ({
      player_id: Number(player.player_id),
      first_name: player.first_name,
      last_name: player.last_name,
      nick_name: player.nick_name,
      slug: player.slug,
      is_hof: player.is_hof,
      card_count: Number(player.card_count),
      rookie_count: Number(player.rookie_count || 0),
      user_card_count: userId ? Number(player.user_card_count || 0) : undefined,
      display_card_front_image: player.display_card_front_image || null,
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

    // If we have recently viewed or most visited players, get their teams and merge
    let finalPlayersList = formattedPlayers
    let priorityPlayers = recentlyViewedPlayers.length > 0 ? recentlyViewedPlayers : mostVisitedPlayers
    
    if (priorityPlayers.length > 0) {
      // Get teams for priority players in a single query
      // Validate all IDs for security
      const validPriorityIds = validateNumericArray(priorityPlayers.map(p => p.player_id))
      const priorityPlayerIds = validPriorityIds.join(',')

      const priorityTeamsQuery = `
        SELECT
          pt.player as player_id,
          t.team_id,
          t.name as team_name,
          t.abbreviation,
          t.primary_color,
          t.secondary_color,
          COUNT(DISTINCT c.card_id) as team_card_count
        FROM player_team pt
        JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
        JOIN card c ON cpt.card = c.card_id
        JOIN team t ON pt.team = t.team_id
        WHERE pt.player IN (${priorityPlayerIds})
        GROUP BY pt.player, t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color
        ORDER BY pt.player, COUNT(DISTINCT c.card_id) DESC
      `

      const priorityTeams = await prisma.$queryRawUnsafe(priorityTeamsQuery)
      
      // Map teams to players
      const teamsMap = {}
      priorityTeams.forEach(team => {
        const playerId = Number(team.player_id)
        if (!teamsMap[playerId]) {
          teamsMap[playerId] = []
        }
        teamsMap[playerId].push({
          team_id: Number(team.team_id),
          name: team.team_name,
          abbreviation: team.abbreviation,
          primary_color: team.primary_color,
          secondary_color: team.secondary_color,
          card_count: Number(team.team_card_count)
        })
      })

      const priorityPlayersWithTeams = priorityPlayers.map(player => ({
        player_id: Number(player.player_id),
        first_name: player.first_name,
        last_name: player.last_name,
        nick_name: player.nick_name,
        slug: player.slug,
        is_hof: player.is_hof,
        card_count: Number(player.card_count),
        rookie_count: Number(player.rookie_count || 0),
        user_card_count: userId ? Number(player.user_card_count || 0) : undefined,
        display_card_front_image: player.display_card_front_image || null,
        teams: teamsMap[Number(player.player_id)] || [],
        is_priority: true
      }))

      // Remove priority players from regular list to avoid duplicates
      const priorityPlayerIdSet = new Set(priorityPlayers.map(p => Number(p.player_id)))
      const filteredRegularPlayers = formattedPlayers.filter(
        p => !priorityPlayerIdSet.has(p.player_id)
      )

      // Combine priority and regular players
      finalPlayersList = [...priorityPlayersWithTeams, ...filteredRegularPlayers]
    }

    res.json({
      players: finalPlayersList,
      pagination: {
        current_page: currentPage,
        total_pages: Math.ceil(totalCount / pageSize),
        total_count: totalCount,
        page_size: pageSize,
        has_more: currentPage * pageSize < totalCount
      },
      priority_type: recentlyViewedPlayers.length > 0 ? 'recently_viewed' : 
                      mostVisitedPlayers.length > 0 ? 'most_visited' : null
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
router.get('/alphabet', optionalAuthMiddleware, async (req, res) => {
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
router.get('/by-letter/:letter', optionalAuthMiddleware, async (req, res) => {
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
      GROUP BY pd.player_id, pd.first_name, pd.last_name, pd.nick_name, pd.is_hof, pd.card_count, pd.rookie_count
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
      rookie_count: Number(player.rookie_count || 0),
      user_card_count: userId ? Number(player.user_card_count || 0) : undefined,
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