/**
 * API v1 - Sets Routes
 *
 * RESTful endpoints for card set data.
 *
 * Endpoints:
 *   GET  /api/v1/sets           - List sets with filtering, sorting
 *   GET  /api/v1/sets/search    - Search sets by name
 *   GET  /api/v1/sets/:id       - Get set by ID
 *   GET  /api/v1/sets/:id/series - Get all series in a set
 *   GET  /api/v1/sets/:id/cards  - Get all cards in a set
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
  parsePagination
} = require('./utils/responses')

/**
 * GET /api/v1/sets
 *
 * List all sets with optional filtering.
 *
 * Query Parameters:
 *   - year: Filter by year
 *   - sport: Filter by sport
 *   - manufacturer: Filter by manufacturer
 *   - limit: Number of results (default: 50, max: 500)
 *   - offset: Offset for pagination
 */
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query)
    const { year, organization, manufacturer } = req.query

    const conditions = []

    if (year) {
      const yearNum = parseInt(year)
      if (!isNaN(yearNum)) {
        conditions.push(`s.year = ${yearNum}`)
      }
    }

    if (organization) {
      const orgId = parseInt(organization)
      if (!isNaN(orgId)) {
        conditions.push(`s.organization = ${orgId}`)
      }
    }

    if (manufacturer) {
      conditions.push(`m.name LIKE '%${manufacturer.replace(/'/g, "''")}%'`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM [set] s
      LEFT JOIN manufacturer m ON s.manufacturer = m.manufacturer_id
      ${whereClause}
    `
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const total = Number(countResult[0].total)

    // Sets query
    const setsQuery = `
      SELECT
        s.set_id,
        s.name,
        s.year,
        s.slug,
        s.card_count,
        s.series_count,
        m.name as manufacturer,
        o.name as organization
      FROM [set] s
      LEFT JOIN manufacturer m ON s.manufacturer = m.manufacturer_id
      LEFT JOIN organization o ON s.organization = o.organization_id
      ${whereClause}
      ORDER BY s.year DESC, s.name
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `

    const setsRaw = await prisma.$queryRawUnsafe(setsQuery)

    const sets = setsRaw.map(s => ({
      set_id: Number(s.set_id),
      name: s.name,
      year: s.year ? Number(s.year) : null,
      slug: s.slug,
      card_count: Number(s.card_count || 0),
      series_count: Number(s.series_count || 0),
      manufacturer: s.manufacturer,
      organization: s.organization
    }))

    return listResponse(res, sets, { total, limit, offset })

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/sets/search
 *
 * Search sets by name.
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

    const setsQuery = `
      SELECT TOP ${limit}
        s.set_id,
        s.name,
        s.year,
        s.slug,
        s.card_count,
        m.name as manufacturer,
        o.name as organization
      FROM [set] s
      LEFT JOIN manufacturer m ON s.manufacturer = m.manufacturer_id
      LEFT JOIN organization o ON s.organization = o.organization_id
      WHERE
        s.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR CAST(s.year as varchar(4)) LIKE '%${searchTerm}%'
      ORDER BY
        CASE
          WHEN s.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
          ELSE 2
        END,
        s.year DESC,
        s.card_count DESC
    `

    const setsRaw = await prisma.$queryRawUnsafe(setsQuery)

    const sets = setsRaw.map(s => ({
      set_id: Number(s.set_id),
      name: s.name,
      year: s.year ? Number(s.year) : null,
      slug: s.slug,
      card_count: Number(s.card_count || 0),
      manufacturer: s.manufacturer,
      organization: s.organization
    }))

    return successResponse(res, sets)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/sets/:id
 *
 * Get set details by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const setId = parseInt(req.params.id)

    if (isNaN(setId)) {
      return validationError(res, 'Set ID must be a number')
    }

    const setResult = await prisma.$queryRaw`
      SELECT
        s.set_id,
        s.name,
        s.year,
        s.slug,
        s.card_count,
        s.series_count,
        s.is_complete,
        m.name as manufacturer,
        o.name as organization
      FROM [set] s
      LEFT JOIN manufacturer m ON s.manufacturer = m.manufacturer_id
      LEFT JOIN organization o ON s.organization = o.organization_id
      WHERE s.set_id = ${setId}
    `

    if (setResult.length === 0) {
      return notFoundResponse(res, 'Set', setId)
    }

    const s = setResult[0]

    const set = {
      set_id: Number(s.set_id),
      name: s.name,
      year: s.year ? Number(s.year) : null,
      slug: s.slug,
      card_count: Number(s.card_count || 0),
      series_count: Number(s.series_count || 0),
      is_complete: Boolean(s.is_complete),
      manufacturer: s.manufacturer,
      organization: s.organization
    }

    return successResponse(res, set)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/sets/:id/series
 *
 * Get all series in a set.
 */
router.get('/:id/series', async (req, res) => {
  try {
    const setId = parseInt(req.params.id)

    if (isNaN(setId)) {
      return validationError(res, 'Set ID must be a number')
    }

    // Verify set exists
    const setCheck = await prisma.$queryRaw`
      SELECT set_id FROM [set] WHERE set_id = ${setId}
    `
    if (setCheck.length === 0) {
      return notFoundResponse(res, 'Set', setId)
    }

    const seriesResult = await prisma.$queryRaw`
      SELECT
        s.series_id,
        s.name,
        s.color,
        s.min_print_run,
        s.print_run_display,
        s.is_base,
        s.parallel_of_series,
        s.card_count,
        s.slug
      FROM series s
      WHERE s.[set] = ${setId}
      ORDER BY
        CASE WHEN s.is_base = 1 THEN 0 ELSE 1 END,
        s.name
    `

    const series = seriesResult.map(s => ({
      series_id: Number(s.series_id),
      name: s.name,
      color: s.color,
      print_run: s.print_run_display || (s.min_print_run ? Number(s.min_print_run) : null),
      is_parallel: !Boolean(s.is_base),
      parallel_of_series: s.parallel_of_series ? Number(s.parallel_of_series) : null,
      card_count: Number(s.card_count || 0),
      slug: s.slug
    }))

    return successResponse(res, series)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/sets/:id/cards
 *
 * Get all cards in a set with pagination.
 */
router.get('/:id/cards', async (req, res) => {
  try {
    const setId = parseInt(req.params.id)
    const { limit, offset } = parsePagination(req.query)
    const { series_id, is_rookie, is_autograph, is_relic } = req.query

    if (isNaN(setId)) {
      return validationError(res, 'Set ID must be a number')
    }

    // Verify set exists
    const setCheck = await prisma.$queryRaw`
      SELECT set_id FROM [set] WHERE set_id = ${setId}
    `
    if (setCheck.length === 0) {
      return notFoundResponse(res, 'Set', setId)
    }

    // Build conditions
    const conditions = [`st.set_id = ${setId}`]

    if (series_id) {
      const seriesIdNum = parseInt(series_id)
      if (!isNaN(seriesIdNum)) {
        conditions.push(`s.series_id = ${seriesIdNum}`)
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

    // Count
    const countQuery = `
      SELECT COUNT(DISTINCT c.card_id) as total
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
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
        c.print_run,
        s.series_id,
        s.name as series_name,
        s.color as series_color,
        front_photo.photo_url as front_image,
        (
          SELECT STRING_AGG(p.first_name + ' ' + p.last_name, ', ')
          FROM card_player_team cpt
          JOIN player_team pt ON cpt.player_team = pt.player_team_id
          JOIN player p ON pt.player = p.player_id
          WHERE cpt.card = c.card_id
        ) as players
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
      LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
      ${whereClause}
      ORDER BY s.name, c.card_number
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
        series_id: Number(c.series_id),
        name: c.series_name,
        color: c.series_color
      },
      players: c.players,
      front_image: c.front_image || null
    }))

    return listResponse(res, cards, { total, limit, offset })

  } catch (error) {
    return serverError(res, error)
  }
})

module.exports = router
