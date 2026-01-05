/**
 * API v1 - Players Routes
 *
 * RESTful endpoints for player data.
 *
 * Endpoints:
 *   GET  /api/v1/players          - List players with pagination, filtering, sorting
 *   GET  /api/v1/players/search   - Search players by name
 *   GET  /api/v1/players/:id      - Get player by ID
 *   GET  /api/v1/players/:id/cards - Get all cards for a player
 *   GET  /api/v1/players/:id/teams - Get all teams for a player
 */

const express = require('express')
const router = express.Router()
const { prisma } = require('../../config/prisma-singleton')
const {
  successResponse,
  listResponse,
  notFoundResponse,
  validationError,
  serverError,
  parsePagination,
  parseSort
} = require('./utils/responses')

/**
 * GET /api/v1/players
 *
 * List players with pagination, filtering, and sorting.
 *
 * Query Parameters:
 *   - limit: Number of results (default: 50, max: 500)
 *   - offset: Number of results to skip (default: 0)
 *   - sort: Sort field (e.g., "last_name", "-card_count" for descending)
 *   - team_id: Filter by team
 *   - is_hof: Filter by Hall of Fame status (true/false)
 *   - letter: Filter by first letter of last name
 */
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query)
    const { team_id, is_hof, letter } = req.query

    // Build WHERE conditions
    const conditions = []
    const params = []

    if (team_id) {
      const teamIdNum = parseInt(team_id)
      if (isNaN(teamIdNum)) {
        return validationError(res, 'team_id must be a number')
      }
      conditions.push(`p.player_id IN (
        SELECT DISTINCT pt.player FROM player_team pt WHERE pt.team = ${teamIdNum}
      )`)
    }

    if (is_hof !== undefined) {
      const hofValue = is_hof === 'true' || is_hof === '1'
      conditions.push(`p.is_hof = ${hofValue ? 1 : 0}`)
    }

    if (letter) {
      const letterUpper = letter.toUpperCase().charAt(0)
      if (!/^[A-Z]$/.test(letterUpper)) {
        return validationError(res, 'letter must be a single letter A-Z')
      }
      conditions.push(`UPPER(LEFT(p.last_name, 1)) = '${letterUpper}'`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Sorting
    const sortFields = ['first_name', 'last_name', 'card_count', 'is_hof']
    const sorts = parseSort(req.query, sortFields)
    let orderClause = 'ORDER BY p.card_count DESC, p.last_name ASC'
    if (sorts && sorts.length > 0) {
      orderClause = 'ORDER BY ' + sorts.map(s => `p.${s.field} ${s.direction.toUpperCase()}`).join(', ')
    }

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT p.player_id) as total
      FROM player p
      ${whereClause}
    `
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const total = Number(countResult[0].total)

    // Main query with teams aggregated
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
          display_card_photo.photo_url as display_image
        FROM player p
        LEFT JOIN card display_card ON p.display_card = display_card.card_id
        LEFT JOIN user_card display_uc ON display_card.reference_user_card = display_uc.user_card_id
        LEFT JOIN user_card_photo display_card_photo ON display_uc.user_card_id = display_card_photo.user_card AND display_card_photo.sort_order = 1
        ${whereClause}
        ${orderClause}
        OFFSET ${offset} ROWS
        FETCH NEXT ${limit} ROWS ONLY
      ),
      PlayerTeams AS (
        SELECT
          pd.player_id,
          t.team_id,
          t.name,
          t.abbreviation,
          t.primary_color,
          t.secondary_color,
          pt.card_count as team_card_count
        FROM PlayerData pd
        JOIN player_team pt ON pd.player_id = pt.player
        JOIN team t ON pt.team = t.team_id
        WHERE pt.card_count > 0
      )
      SELECT
        pd.*,
        (
          SELECT t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color, t.team_card_count
          FROM PlayerTeams t
          WHERE t.player_id = pd.player_id
          ORDER BY t.team_card_count DESC
          FOR JSON PATH
        ) as teams
      FROM PlayerData pd
      ${orderClause.replace(/p\./g, 'pd.')}
    `

    const playersRaw = await prisma.$queryRawUnsafe(playersQuery)

    // Format response
    const players = playersRaw.map(p => ({
      player_id: Number(p.player_id),
      first_name: p.first_name,
      last_name: p.last_name,
      nick_name: p.nick_name,
      slug: p.slug,
      is_hof: Boolean(p.is_hof),
      card_count: Number(p.card_count),
      display_image: p.display_image || null,
      teams: p.teams ? JSON.parse(p.teams).map(t => ({
        team_id: Number(t.team_id),
        name: t.name,
        abbreviation: t.abbreviation,
        primary_color: t.primary_color,
        secondary_color: t.secondary_color,
        card_count: Number(t.team_card_count)
      })) : []
    }))

    return listResponse(res, players, { total, limit, offset })

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/players/search
 *
 * Search players by name.
 *
 * Query Parameters:
 *   - q: Search query (required, minimum 2 characters)
 *   - limit: Number of results (default: 20, max: 100)
 */
router.get('/search', async (req, res) => {
  try {
    const { q } = req.query
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 100)

    if (!q || q.trim().length < 2) {
      return validationError(res, 'Search query (q) must be at least 2 characters')
    }

    const searchTerm = q.trim().replace(/'/g, "''")

    const playersQuery = `
      SELECT TOP ${limit}
        p.player_id,
        p.first_name,
        p.last_name,
        p.nick_name,
        p.slug,
        p.is_hof,
        p.card_count,
        display_card_photo.photo_url as display_image
      FROM player p
      LEFT JOIN card display_card ON p.display_card = display_card.card_id
      LEFT JOIN user_card display_uc ON display_card.reference_user_card = display_uc.user_card_id
      LEFT JOIN user_card_photo display_card_photo ON display_uc.user_card_id = display_card_photo.user_card AND display_card_photo.sort_order = 1
      WHERE
        p.first_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR p.last_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR p.nick_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
      ORDER BY
        CASE
          WHEN p.last_name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
          WHEN p.first_name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 2
          ELSE 3
        END,
        p.card_count DESC
    `

    const playersRaw = await prisma.$queryRawUnsafe(playersQuery)

    const players = playersRaw.map(p => ({
      player_id: Number(p.player_id),
      first_name: p.first_name,
      last_name: p.last_name,
      nick_name: p.nick_name,
      slug: p.slug,
      is_hof: Boolean(p.is_hof),
      card_count: Number(p.card_count),
      display_image: p.display_image || null
    }))

    return successResponse(res, players)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/players/:id
 *
 * Get player details by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)

    if (isNaN(playerId)) {
      return validationError(res, 'Player ID must be a number')
    }

    // Get player
    const playerResult = await prisma.$queryRaw`
      SELECT
        p.player_id,
        p.first_name,
        p.last_name,
        p.nick_name,
        p.slug,
        p.birthdate,
        p.is_hof,
        p.card_count,
        display_card_photo.photo_url as display_image
      FROM player p
      LEFT JOIN card display_card ON p.display_card = display_card.card_id
      LEFT JOIN user_card display_uc ON display_card.reference_user_card = display_uc.user_card_id
      LEFT JOIN user_card_photo display_card_photo ON display_uc.user_card_id = display_card_photo.user_card AND display_card_photo.sort_order = 1
      WHERE p.player_id = ${playerId}
    `

    if (playerResult.length === 0) {
      return notFoundResponse(res, 'Player', playerId)
    }

    const p = playerResult[0]

    // Get teams
    const teamsResult = await prisma.$queryRaw`
      SELECT
        t.team_id,
        t.name,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        COUNT(DISTINCT c.card_id) as card_count
      FROM team t
      JOIN player_team pt ON t.team_id = pt.team
      JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      JOIN card c ON cpt.card = c.card_id
      WHERE pt.player = ${playerId}
      GROUP BY t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color
      ORDER BY card_count DESC
    `

    // Get stats
    const statsResult = await prisma.$queryRaw`
      SELECT
        COUNT(DISTINCT c.card_id) as total_cards,
        COUNT(DISTINCT CASE WHEN c.is_rookie = 1 THEN c.card_id END) as rookie_cards,
        COUNT(DISTINCT CASE WHEN c.is_autograph = 1 THEN c.card_id END) as autograph_cards,
        COUNT(DISTINCT CASE WHEN c.is_relic = 1 THEN c.card_id END) as relic_cards,
        COUNT(DISTINCT CASE WHEN c.print_run IS NOT NULL AND c.print_run > 0 THEN c.card_id END) as numbered_cards,
        COUNT(DISTINCT c.series) as unique_series
      FROM card c
      JOIN card_player_team cpt ON c.card_id = cpt.card
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      WHERE pt.player = ${playerId}
    `

    const stats = statsResult[0] || {}

    const player = {
      player_id: Number(p.player_id),
      first_name: p.first_name,
      last_name: p.last_name,
      nick_name: p.nick_name,
      slug: p.slug,
      birthdate: p.birthdate,
      is_hof: Boolean(p.is_hof),
      card_count: Number(p.card_count),
      display_image: p.display_image || null,
      teams: teamsResult.map(t => ({
        team_id: Number(t.team_id),
        name: t.name,
        abbreviation: t.abbreviation,
        primary_color: t.primary_color,
        secondary_color: t.secondary_color,
        card_count: Number(t.card_count)
      })),
      stats: {
        total_cards: Number(stats.total_cards) || 0,
        rookie_cards: Number(stats.rookie_cards) || 0,
        autograph_cards: Number(stats.autograph_cards) || 0,
        relic_cards: Number(stats.relic_cards) || 0,
        numbered_cards: Number(stats.numbered_cards) || 0,
        unique_series: Number(stats.unique_series) || 0
      }
    }

    return successResponse(res, player)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/players/:id/cards
 *
 * Get all cards for a player with pagination.
 *
 * Query Parameters:
 *   - limit: Number of results (default: 50, max: 500)
 *   - offset: Number of results to skip (default: 0)
 *   - team_id: Filter by team
 *   - is_rookie: Filter rookie cards only
 *   - is_autograph: Filter autograph cards only
 *   - is_relic: Filter relic cards only
 *   - year: Filter by year
 */
router.get('/:id/cards', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)
    const { limit, offset } = parsePagination(req.query)
    const { team_id, is_rookie, is_autograph, is_relic, year } = req.query

    if (isNaN(playerId)) {
      return validationError(res, 'Player ID must be a number')
    }

    // Verify player exists
    const playerCheck = await prisma.$queryRaw`
      SELECT player_id FROM player WHERE player_id = ${playerId}
    `
    if (playerCheck.length === 0) {
      return notFoundResponse(res, 'Player', playerId)
    }

    // Build WHERE conditions
    const conditions = [`pt.player = ${playerId}`]

    if (team_id) {
      const teamIdNum = parseInt(team_id)
      if (!isNaN(teamIdNum)) {
        conditions.push(`pt.team = ${teamIdNum}`)
      }
    }

    if (is_rookie === 'true' || is_rookie === '1') {
      conditions.push('c.is_rookie = 1')
    }

    if (is_autograph === 'true' || is_autograph === '1') {
      conditions.push('c.is_autograph = 1')
    }

    if (is_relic === 'true' || is_relic === '1') {
      conditions.push('c.is_relic = 1')
    }

    if (year) {
      const yearNum = parseInt(year)
      if (!isNaN(yearNum)) {
        conditions.push(`st.year = ${yearNum}`)
      }
    }

    const whereClause = `WHERE ${conditions.join(' AND ')}`

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT c.card_id) as total
      FROM card c
      JOIN card_player_team cpt ON c.card_id = cpt.card
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] st ON s.[set] = st.set_id
      ${whereClause}
    `
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const total = Number(countResult[0].total)

    // Cards query
    const cardsQuery = `
      SELECT
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.is_short_print,
        c.print_run,
        s.series_id,
        s.name as series_name,
        s.color as series_color,
        st.set_id,
        st.name as set_name,
        st.year,
        t.team_id,
        t.name as team_name,
        t.abbreviation as team_abbreviation,
        t.primary_color,
        t.secondary_color,
        front_photo.photo_url as front_image,
        back_photo.photo_url as back_image
      FROM card c
      JOIN card_player_team cpt ON c.card_id = cpt.card
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      JOIN team t ON pt.team = t.team_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
      LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
      LEFT JOIN user_card_photo back_photo ON uc.user_card_id = back_photo.user_card AND back_photo.sort_order = 2
      ${whereClause}
      ORDER BY st.year DESC, st.name, s.name, c.card_number
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `

    const cardsRaw = await prisma.$queryRawUnsafe(cardsQuery)

    const cards = cardsRaw.map(c => ({
      card_id: Number(c.card_id),
      card_number: c.card_number,
      is_rookie: Boolean(c.is_rookie),
      is_autograph: Boolean(c.is_autograph),
      is_relic: Boolean(c.is_relic),
      is_short_print: Boolean(c.is_short_print),
      print_run: c.print_run ? Number(c.print_run) : null,
      series: {
        series_id: Number(c.series_id),
        name: c.series_name,
        color: c.series_color
      },
      set: {
        set_id: Number(c.set_id),
        name: c.set_name,
        year: c.year ? Number(c.year) : null
      },
      team: {
        team_id: Number(c.team_id),
        name: c.team_name,
        abbreviation: c.team_abbreviation,
        primary_color: c.primary_color,
        secondary_color: c.secondary_color
      },
      images: {
        front: c.front_image || null,
        back: c.back_image || null
      }
    }))

    return listResponse(res, cards, { total, limit, offset })

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/players/:id/teams
 *
 * Get all teams a player has been associated with.
 */
router.get('/:id/teams', async (req, res) => {
  try {
    const playerId = parseInt(req.params.id)

    if (isNaN(playerId)) {
      return validationError(res, 'Player ID must be a number')
    }

    // Verify player exists
    const playerCheck = await prisma.$queryRaw`
      SELECT player_id FROM player WHERE player_id = ${playerId}
    `
    if (playerCheck.length === 0) {
      return notFoundResponse(res, 'Player', playerId)
    }

    const teamsResult = await prisma.$queryRaw`
      SELECT
        t.team_id,
        t.name,
        t.abbreviation,
        t.city,
        t.mascot,
        t.primary_color,
        t.secondary_color,
        o.name as organization_name,
        COUNT(DISTINCT c.card_id) as card_count
      FROM team t
      LEFT JOIN organization o ON t.organization = o.organization_id
      JOIN player_team pt ON t.team_id = pt.team
      LEFT JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      LEFT JOIN card c ON cpt.card = c.card_id
      WHERE pt.player = ${playerId}
      GROUP BY t.team_id, t.name, t.abbreviation, t.city, t.mascot, t.primary_color, t.secondary_color, o.name
      ORDER BY card_count DESC, t.name
    `

    const teams = teamsResult.map(t => ({
      team_id: Number(t.team_id),
      name: t.name,
      abbreviation: t.abbreviation,
      city: t.city,
      mascot: t.mascot,
      primary_color: t.primary_color,
      secondary_color: t.secondary_color,
      organization: t.organization_name,
      card_count: Number(t.card_count || 0)
    }))

    return successResponse(res, teams)

  } catch (error) {
    return serverError(res, error)
  }
})

module.exports = router
