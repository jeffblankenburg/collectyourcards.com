/**
 * API v1 - Teams Routes
 *
 * RESTful endpoints for team data.
 *
 * Endpoints:
 *   GET  /api/v1/teams           - List teams with filtering, sorting
 *   GET  /api/v1/teams/search    - Search teams by name
 *   GET  /api/v1/teams/:id       - Get team by ID
 *   GET  /api/v1/teams/:id/players - Get all players for a team
 *   GET  /api/v1/teams/:id/cards  - Get all cards for a team
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
 * GET /api/v1/teams
 *
 * List all teams with optional filtering.
 *
 * Query Parameters:
 *   - organization: Filter by organization ID
 *   - sort: Sort field (e.g., "name", "-card_count")
 */
router.get('/', async (req, res) => {
  try {
    const { organization } = req.query

    const conditions = []

    if (organization) {
      const orgId = parseInt(organization)
      if (!isNaN(orgId)) {
        conditions.push(`t.organization = ${orgId}`)
      }
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    const teamsQuery = `
      SELECT
        t.team_id,
        t.name,
        t.abbreviation,
        t.city,
        t.mascot,
        t.primary_color,
        t.secondary_color,
        t.card_count,
        t.player_count,
        o.name as organization_name
      FROM team t
      LEFT JOIN organization o ON t.organization = o.organization_id
      ${whereClause}
      ORDER BY t.name
    `

    const teamsRaw = await prisma.$queryRawUnsafe(teamsQuery)

    const teams = teamsRaw.map(t => ({
      team_id: Number(t.team_id),
      name: t.name,
      abbreviation: t.abbreviation,
      city: t.city,
      mascot: t.mascot,
      primary_color: t.primary_color,
      secondary_color: t.secondary_color,
      organization: t.organization_name,
      card_count: Number(t.card_count || 0),
      player_count: Number(t.player_count || 0)
    }))

    return successResponse(res, teams)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/teams/search
 *
 * Search teams by name.
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

    const teamsQuery = `
      SELECT TOP ${limit}
        t.team_id,
        t.name,
        t.abbreviation,
        t.city,
        t.mascot,
        t.primary_color,
        t.secondary_color,
        t.card_count,
        o.name as organization_name
      FROM team t
      LEFT JOIN organization o ON t.organization = o.organization_id
      WHERE
        t.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR t.abbreviation LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR t.city LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
      ORDER BY
        CASE
          WHEN t.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
          WHEN t.abbreviation = '${searchTerm}' COLLATE Latin1_General_CI_AI THEN 2
          ELSE 3
        END,
        t.card_count DESC
    `

    const teamsRaw = await prisma.$queryRawUnsafe(teamsQuery)

    const teams = teamsRaw.map(t => ({
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

/**
 * GET /api/v1/teams/:id
 *
 * Get team details by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const teamId = parseInt(req.params.id)

    if (isNaN(teamId)) {
      return validationError(res, 'Team ID must be a number')
    }

    const teamResult = await prisma.$queryRaw`
      SELECT
        t.team_id,
        t.name,
        t.abbreviation,
        t.city,
        t.mascot,
        t.primary_color,
        t.secondary_color,
        t.card_count,
        t.player_count,
        o.name as organization_name
      FROM team t
      LEFT JOIN organization o ON t.organization = o.organization_id
      WHERE t.team_id = ${teamId}
    `

    if (teamResult.length === 0) {
      return notFoundResponse(res, 'Team', teamId)
    }

    const t = teamResult[0]

    const team = {
      team_id: Number(t.team_id),
      name: t.name,
      abbreviation: t.abbreviation,
      city: t.city,
      mascot: t.mascot,
      primary_color: t.primary_color,
      secondary_color: t.secondary_color,
      organization: t.organization_name,
      card_count: Number(t.card_count || 0),
      player_count: Number(t.player_count || 0)
    }

    return successResponse(res, team)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/teams/:id/players
 *
 * Get all players for a team with pagination.
 */
router.get('/:id/players', async (req, res) => {
  try {
    const teamId = parseInt(req.params.id)
    const { limit, offset } = parsePagination(req.query)

    if (isNaN(teamId)) {
      return validationError(res, 'Team ID must be a number')
    }

    // Verify team exists
    const teamCheck = await prisma.$queryRaw`
      SELECT team_id FROM team WHERE team_id = ${teamId}
    `
    if (teamCheck.length === 0) {
      return notFoundResponse(res, 'Team', teamId)
    }

    // Count query
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT pt.player) as total
      FROM player_team pt
      WHERE pt.team = ${teamId}
    `
    const total = Number(countResult[0].total)

    // Players query
    const playersQuery = `
      SELECT
        p.player_id,
        p.first_name,
        p.last_name,
        p.nick_name,
        p.slug,
        p.is_hof,
        pt.card_count,
        display_card_photo.photo_url as display_image
      FROM player p
      JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN card display_card ON p.display_card = display_card.card_id
      LEFT JOIN user_card display_uc ON display_card.reference_user_card = display_uc.user_card_id
      LEFT JOIN user_card_photo display_card_photo ON display_uc.user_card_id = display_card_photo.user_card AND display_card_photo.sort_order = 1
      WHERE pt.team = ${teamId}
      ORDER BY pt.card_count DESC, p.last_name
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `

    const playersRaw = await prisma.$queryRawUnsafe(playersQuery)

    const players = playersRaw.map(p => ({
      player_id: Number(p.player_id),
      first_name: p.first_name,
      last_name: p.last_name,
      nick_name: p.nick_name,
      slug: p.slug,
      is_hof: Boolean(p.is_hof),
      card_count: Number(p.card_count || 0),
      display_image: p.display_image || null
    }))

    return listResponse(res, players, { total, limit, offset })

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/teams/:id/cards
 *
 * Get all cards for a team with pagination.
 */
router.get('/:id/cards', async (req, res) => {
  try {
    const teamId = parseInt(req.params.id)
    const { limit, offset } = parsePagination(req.query)
    const { year, is_rookie, is_autograph, is_relic } = req.query

    if (isNaN(teamId)) {
      return validationError(res, 'Team ID must be a number')
    }

    // Verify team exists
    const teamCheck = await prisma.$queryRaw`
      SELECT team_id FROM team WHERE team_id = ${teamId}
    `
    if (teamCheck.length === 0) {
      return notFoundResponse(res, 'Team', teamId)
    }

    // Build conditions
    const conditions = [`pt.team = ${teamId}`]

    if (year) {
      const yearNum = parseInt(year)
      if (!isNaN(yearNum)) {
        conditions.push(`st.year = ${yearNum}`)
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
      SELECT DISTINCT
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.series_id,
        s.name as series_name,
        st.set_id,
        st.name as set_name,
        st.year,
        p.player_id,
        p.first_name,
        p.last_name,
        front_photo.photo_url as front_image
      FROM card c
      JOIN card_player_team cpt ON c.card_id = cpt.card
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      JOIN player p ON pt.player = p.player_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
      LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
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
      print_run: c.print_run ? Number(c.print_run) : null,
      series: {
        series_id: c.series_id ? Number(c.series_id) : null,
        name: c.series_name
      },
      set: {
        set_id: c.set_id ? Number(c.set_id) : null,
        name: c.set_name,
        year: c.year ? Number(c.year) : null
      },
      player: {
        player_id: Number(c.player_id),
        first_name: c.first_name,
        last_name: c.last_name
      },
      front_image: c.front_image || null
    }))

    return listResponse(res, cards, { total, limit, offset })

  } catch (error) {
    return serverError(res, error)
  }
})

module.exports = router
