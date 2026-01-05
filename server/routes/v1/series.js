/**
 * API v1 - Series Routes
 *
 * RESTful endpoints for card series data.
 *
 * Endpoints:
 *   GET  /api/v1/series           - List series with filtering
 *   GET  /api/v1/series/search    - Search series by name
 *   GET  /api/v1/series/:id       - Get series by ID
 *   GET  /api/v1/series/:id/cards - Get all cards in a series
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
 * GET /api/v1/series
 *
 * List series with optional filtering.
 *
 * Query Parameters:
 *   - set_id: Filter by set
 *   - is_parallel: Filter parallel series (true/false)
 *   - limit: Number of results (default: 50, max: 500)
 *   - offset: Offset for pagination
 */
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query)
    const { set_id, is_parallel } = req.query

    const conditions = []

    if (set_id) {
      const setIdNum = parseInt(set_id)
      if (!isNaN(setIdNum)) {
        conditions.push(`s.[set] = ${setIdNum}`)
      }
    }

    if (is_parallel !== undefined) {
      // is_base is the inverse of is_parallel: is_base=1 means NOT parallel
      const isBaseValue = is_parallel === 'true' || is_parallel === '1' ? 0 : 1
      conditions.push(`s.is_base = ${isBaseValue}`)
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM series s
      ${whereClause}
    `
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const total = Number(countResult[0].total)

    // Series query
    const seriesQuery = `
      SELECT
        s.series_id,
        s.name,
        s.color,
        s.min_print_run,
        s.max_print_run,
        s.print_run_display,
        s.is_base,
        s.card_count,
        s.slug,
        st.set_id,
        st.name as set_name,
        st.year
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      ${whereClause}
      ORDER BY st.year DESC, st.name, s.name
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `

    const seriesRaw = await prisma.$queryRawUnsafe(seriesQuery)

    const series = seriesRaw.map(s => ({
      series_id: Number(s.series_id),
      name: s.name,
      color: s.color,
      print_run: s.print_run_display || (s.min_print_run ? Number(s.min_print_run) : null),
      is_parallel: !Boolean(s.is_base),
      card_count: Number(s.card_count || 0),
      slug: s.slug,
      set: {
        set_id: Number(s.set_id),
        name: s.set_name,
        year: s.year ? Number(s.year) : null
      }
    }))

    return listResponse(res, series, { total, limit, offset })

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/series/search
 *
 * Search series by name.
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

    const seriesQuery = `
      SELECT TOP ${limit}
        s.series_id,
        s.name,
        s.color,
        s.min_print_run,
        s.print_run_display,
        s.is_base,
        s.card_count,
        s.slug,
        st.set_id,
        st.name as set_name,
        st.year
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      WHERE
        s.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR st.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
      ORDER BY
        CASE
          WHEN s.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
          ELSE 2
        END,
        st.year DESC,
        s.card_count DESC
    `

    const seriesRaw = await prisma.$queryRawUnsafe(seriesQuery)

    const series = seriesRaw.map(s => ({
      series_id: Number(s.series_id),
      name: s.name,
      color: s.color,
      print_run: s.print_run_display || (s.min_print_run ? Number(s.min_print_run) : null),
      is_parallel: !Boolean(s.is_base),
      card_count: Number(s.card_count || 0),
      slug: s.slug,
      set: {
        set_id: Number(s.set_id),
        name: s.set_name,
        year: s.year ? Number(s.year) : null
      }
    }))

    return successResponse(res, series)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/series/:id
 *
 * Get series details by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const seriesId = parseInt(req.params.id)

    if (isNaN(seriesId)) {
      return validationError(res, 'Series ID must be a number')
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
        s.slug,
        st.set_id,
        st.name as set_name,
        st.year,
        st.slug as set_slug
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      WHERE s.series_id = ${seriesId}
    `

    if (seriesResult.length === 0) {
      return notFoundResponse(res, 'Series', seriesId)
    }

    const s = seriesResult[0]

    // Get parallel series if this is a base series
    let parallels = []
    if (s.is_base) {
      const parallelsResult = await prisma.$queryRaw`
        SELECT
          series_id,
          name,
          color,
          min_print_run,
          print_run_display,
          card_count,
          slug
        FROM series
        WHERE parallel_of_series = ${seriesId}
        ORDER BY min_print_run ASC, name
      `
      parallels = parallelsResult.map(p => ({
        series_id: Number(p.series_id),
        name: p.name,
        color: p.color,
        print_run: p.print_run_display || (p.min_print_run ? Number(p.min_print_run) : null),
        card_count: Number(p.card_count || 0),
        slug: p.slug
      }))
    }

    const series = {
      series_id: Number(s.series_id),
      name: s.name,
      color: s.color,
      print_run: s.print_run_display || (s.min_print_run ? Number(s.min_print_run) : null),
      is_parallel: !Boolean(s.is_base),
      parallel_of_series: s.parallel_of_series ? Number(s.parallel_of_series) : null,
      card_count: Number(s.card_count || 0),
      slug: s.slug,
      set: {
        set_id: Number(s.set_id),
        name: s.set_name,
        year: s.year ? Number(s.year) : null,
        slug: s.set_slug
      },
      parallels
    }

    return successResponse(res, series)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/series/:id/cards
 *
 * Get all cards in a series with pagination.
 */
router.get('/:id/cards', async (req, res) => {
  try {
    const seriesId = parseInt(req.params.id)
    const { limit, offset } = parsePagination(req.query)
    const { is_rookie, is_autograph, is_relic } = req.query

    if (isNaN(seriesId)) {
      return validationError(res, 'Series ID must be a number')
    }

    // Verify series exists
    const seriesCheck = await prisma.$queryRaw`
      SELECT series_id FROM series WHERE series_id = ${seriesId}
    `
    if (seriesCheck.length === 0) {
      return notFoundResponse(res, 'Series', seriesId)
    }

    // Build conditions
    const conditions = [`c.series = ${seriesId}`]

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
      SELECT COUNT(*) as total
      FROM card c
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
        c.notes,
        front_photo.photo_url as front_image,
        back_photo.photo_url as back_image,
        (
          SELECT
            p.player_id,
            p.first_name,
            p.last_name,
            t.team_id,
            t.name as team_name,
            t.abbreviation
          FROM card_player_team cpt
          JOIN player_team pt ON cpt.player_team = pt.player_team_id
          JOIN player p ON pt.player = p.player_id
          JOIN team t ON pt.team = t.team_id
          WHERE cpt.card = c.card_id
          FOR JSON PATH
        ) as players
      FROM card c
      LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
      LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
      LEFT JOIN user_card_photo back_photo ON uc.user_card_id = back_photo.user_card AND back_photo.sort_order = 2
      ${whereClause}
      ORDER BY
        CASE
          WHEN ISNUMERIC(c.card_number) = 1 THEN CAST(c.card_number AS INT)
          ELSE 999999
        END,
        c.card_number
      OFFSET ${offset} ROWS
      FETCH NEXT ${limit} ROWS ONLY
    `

    const cardsRaw = await prisma.$queryRawUnsafe(cardsQuery)

    const cards = cardsRaw.map(c => {
      let players = []
      if (c.players) {
        try {
          players = JSON.parse(c.players).map(p => ({
            player_id: Number(p.player_id),
            first_name: p.first_name,
            last_name: p.last_name,
            team: {
              team_id: Number(p.team_id),
              name: p.team_name,
              abbreviation: p.abbreviation
            }
          }))
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      return {
        card_id: Number(c.card_id),
        card_number: c.card_number,
        is_rookie: Boolean(c.is_rookie),
        is_autograph: Boolean(c.is_autograph),
        is_relic: Boolean(c.is_relic),
        is_short_print: Boolean(c.is_short_print),
        print_run: c.print_run ? Number(c.print_run) : null,
        notes: c.notes,
        players,
        images: {
          front: c.front_image || null,
          back: c.back_image || null
        }
      }
    })

    return listResponse(res, cards, { total, limit, offset })

  } catch (error) {
    return serverError(res, error)
  }
})

module.exports = router
