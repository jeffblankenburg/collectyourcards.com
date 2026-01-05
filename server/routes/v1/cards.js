/**
 * API v1 - Cards Routes
 *
 * RESTful endpoints for card data.
 *
 * Endpoints:
 *   GET  /api/v1/cards           - List cards with filtering, pagination
 *   GET  /api/v1/cards/search    - Search cards
 *   GET  /api/v1/cards/:id       - Get card by ID
 *   GET  /api/v1/cards/bulk      - Get multiple cards by IDs
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
 * GET /api/v1/cards
 *
 * List cards with filtering and pagination.
 *
 * Query Parameters:
 *   - limit: Number of results (default: 50, max: 500)
 *   - offset: Offset for pagination
 *   - series_id: Filter by series
 *   - set_id: Filter by set
 *   - player_id: Filter by player
 *   - team_id: Filter by team
 *   - year: Filter by year
 *   - is_rookie: Filter rookie cards
 *   - is_autograph: Filter autograph cards
 *   - is_relic: Filter relic cards
 *   - ids: Comma-separated list of card IDs for bulk lookup
 */
router.get('/', async (req, res) => {
  try {
    const { limit, offset } = parsePagination(req.query)
    const {
      series_id,
      set_id,
      player_id,
      team_id,
      year,
      is_rookie,
      is_autograph,
      is_relic,
      ids
    } = req.query

    // Handle bulk lookup via ids parameter
    if (ids) {
      const idList = ids.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
      if (idList.length === 0) {
        return validationError(res, 'ids must be a comma-separated list of numbers')
      }
      if (idList.length > 100) {
        return validationError(res, 'Maximum 100 IDs allowed per request')
      }

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
          st.set_id,
          st.name as set_name,
          st.year,
          front_photo.photo_url as front_image,
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
        LEFT JOIN series s ON c.series = s.series_id
        LEFT JOIN [set] st ON s.[set] = st.set_id
        LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
        LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
        WHERE c.card_id IN (${idList.join(',')})
        ORDER BY c.card_id
      `

      const cardsRaw = await prisma.$queryRawUnsafe(cardsQuery)

      const cards = cardsRaw.map(c => formatCard(c))

      return successResponse(res, cards)
    }

    // Build conditions for filtered list
    const conditions = []
    const joins = new Set()

    if (series_id) {
      const seriesIdNum = parseInt(series_id)
      if (!isNaN(seriesIdNum)) {
        conditions.push(`c.series = ${seriesIdNum}`)
      }
    }

    if (set_id) {
      const setIdNum = parseInt(set_id)
      if (!isNaN(setIdNum)) {
        conditions.push(`st.set_id = ${setIdNum}`)
      }
    }

    if (player_id) {
      const playerIdNum = parseInt(player_id)
      if (!isNaN(playerIdNum)) {
        joins.add('JOIN card_player_team cpt ON c.card_id = cpt.card')
        joins.add('JOIN player_team pt ON cpt.player_team = pt.player_team_id')
        conditions.push(`pt.player = ${playerIdNum}`)
      }
    }

    if (team_id) {
      const teamIdNum = parseInt(team_id)
      if (!isNaN(teamIdNum)) {
        if (!joins.has('JOIN card_player_team cpt ON c.card_id = cpt.card')) {
          joins.add('JOIN card_player_team cpt ON c.card_id = cpt.card')
          joins.add('JOIN player_team pt ON cpt.player_team = pt.player_team_id')
        }
        conditions.push(`pt.team = ${teamIdNum}`)
      }
    }

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

    const joinClause = Array.from(joins).join('\n')
    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

    // Count query
    const countQuery = `
      SELECT COUNT(DISTINCT c.card_id) as total
      FROM card c
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] st ON s.[set] = st.set_id
      ${joinClause}
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
        s.color as series_color,
        st.set_id,
        st.name as set_name,
        st.year,
        front_photo.photo_url as front_image
      FROM card c
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
      LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
      ${joinClause}
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
        name: c.series_name,
        color: c.series_color
      },
      set: {
        set_id: c.set_id ? Number(c.set_id) : null,
        name: c.set_name,
        year: c.year ? Number(c.year) : null
      },
      front_image: c.front_image || null
    }))

    return listResponse(res, cards, { total, limit, offset })

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/cards/search
 *
 * Search cards by player name, set name, etc.
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

    const cardsQuery = `
      SELECT TOP ${limit}
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
        front_photo.photo_url as front_image,
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
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
      LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
      WHERE EXISTS (
        SELECT 1
        FROM card_player_team cpt
        JOIN player_team pt ON cpt.player_team = pt.player_team_id
        JOIN player p ON pt.player = p.player_id
        WHERE cpt.card = c.card_id
          AND (
            p.first_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
            OR p.last_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
            OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          )
      )
      OR s.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
      OR st.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
      ORDER BY st.year DESC, st.name
    `

    const cardsRaw = await prisma.$queryRawUnsafe(cardsQuery)

    const cards = cardsRaw.map(c => formatCard(c))

    return successResponse(res, cards)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/cards/:id
 *
 * Get card details by ID.
 */
router.get('/:id', async (req, res) => {
  try {
    const cardId = parseInt(req.params.id)

    if (isNaN(cardId)) {
      return validationError(res, 'Card ID must be a number')
    }

    const cardResult = await prisma.$queryRaw`
      SELECT
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.is_short_print,
        c.print_run,
        c.notes,
        s.series_id,
        s.name as series_name,
        s.color as series_color,
        s.slug as series_slug,
        st.set_id,
        st.name as set_name,
        st.year,
        st.slug as set_slug,
        front_photo.photo_url as front_image,
        back_photo.photo_url as back_image,
        (
          SELECT
            p.player_id,
            p.first_name,
            p.last_name,
            p.slug as player_slug,
            t.team_id,
            t.name as team_name,
            t.abbreviation,
            t.primary_color,
            t.secondary_color
          FROM card_player_team cpt
          JOIN player_team pt ON cpt.player_team = pt.player_team_id
          JOIN player p ON pt.player = p.player_id
          JOIN team t ON pt.team = t.team_id
          WHERE cpt.card = ${cardId}
          FOR JSON PATH
        ) as players
      FROM card c
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN user_card uc ON c.reference_user_card = uc.user_card_id
      LEFT JOIN user_card_photo front_photo ON uc.user_card_id = front_photo.user_card AND front_photo.sort_order = 1
      LEFT JOIN user_card_photo back_photo ON uc.user_card_id = back_photo.user_card AND back_photo.sort_order = 2
      WHERE c.card_id = ${cardId}
    `

    if (cardResult.length === 0) {
      return notFoundResponse(res, 'Card', cardId)
    }

    const c = cardResult[0]

    let players = []
    if (c.players) {
      try {
        players = JSON.parse(c.players).map(p => ({
          player_id: Number(p.player_id),
          first_name: p.first_name,
          last_name: p.last_name,
          slug: p.player_slug,
          team: {
            team_id: Number(p.team_id),
            name: p.team_name,
            abbreviation: p.abbreviation,
            primary_color: p.primary_color,
            secondary_color: p.secondary_color
          }
        }))
      } catch (e) {
        // Ignore JSON parse errors
      }
    }

    const card = {
      card_id: Number(c.card_id),
      card_number: c.card_number,
      is_rookie: Boolean(c.is_rookie),
      is_autograph: Boolean(c.is_autograph),
      is_relic: Boolean(c.is_relic),
      is_short_print: Boolean(c.is_short_print),
      print_run: c.print_run ? Number(c.print_run) : null,
      notes: c.notes,
      series: {
        series_id: Number(c.series_id),
        name: c.series_name,
        color: c.series_color,
        slug: c.series_slug
      },
      set: {
        set_id: Number(c.set_id),
        name: c.set_name,
        year: c.year ? Number(c.year) : null,
        slug: c.set_slug
      },
      players,
      images: {
        front: c.front_image || null,
        back: c.back_image || null
      }
    }

    return successResponse(res, card)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * Helper function to format card response
 */
function formatCard(c) {
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
    print_run: c.print_run ? Number(c.print_run) : null,
    series: {
      series_id: c.series_id ? Number(c.series_id) : null,
      name: c.series_name,
      color: c.series_color
    },
    set: {
      set_id: c.set_id ? Number(c.set_id) : null,
      name: c.set_name,
      year: c.year ? Number(c.year) : null
    },
    players,
    front_image: c.front_image || null
  }
}

module.exports = router
