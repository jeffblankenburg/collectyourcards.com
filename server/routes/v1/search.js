/**
 * API v1 - Search Routes
 *
 * Universal search and autocomplete endpoints.
 *
 * Endpoints:
 *   GET  /api/v1/search            - Universal search across all entities
 *   GET  /api/v1/search/autocomplete - Quick autocomplete suggestions
 */

const express = require('express')
const router = express.Router()
const { prisma } = require('../../config/prisma-singleton')
const {
  successResponse,
  validationError,
  serverError
} = require('./utils/responses')

/**
 * GET /api/v1/search
 *
 * Universal search across players, teams, sets, and series.
 *
 * Query Parameters:
 *   - q: Search query (required, minimum 2 characters)
 *   - types: Comma-separated entity types to search (players,teams,sets,series)
 *   - limit: Number of results per type (default: 10, max: 50)
 */
router.get('/', async (req, res) => {
  try {
    const { q, types } = req.query
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 50)

    if (!q || q.trim().length < 2) {
      return validationError(res, 'Search query (q) must be at least 2 characters')
    }

    const searchTerm = q.trim().replace(/'/g, "''")

    // Parse types to search (default: all)
    const typeList = types
      ? types.split(',').map(t => t.trim().toLowerCase())
      : ['players', 'teams', 'sets', 'series']

    const results = {}

    // Search players
    if (typeList.includes('players')) {
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
          OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          OR p.nick_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        ORDER BY
          CASE
            WHEN p.last_name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
            WHEN CONCAT(p.first_name, ' ', p.last_name) LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 2
            ELSE 3
          END,
          p.card_count DESC
      `

      const playersRaw = await prisma.$queryRawUnsafe(playersQuery)
      results.players = playersRaw.map(p => ({
        player_id: Number(p.player_id),
        first_name: p.first_name,
        last_name: p.last_name,
        nick_name: p.nick_name,
        slug: p.slug,
        is_hof: Boolean(p.is_hof),
        card_count: Number(p.card_count || 0),
        display_image: p.display_image || null
      }))
    }

    // Search teams
    if (typeList.includes('teams')) {
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
      results.teams = teamsRaw.map(t => ({
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
    }

    // Search sets
    if (typeList.includes('sets')) {
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
      results.sets = setsRaw.map(s => ({
        set_id: Number(s.set_id),
        name: s.name,
        year: s.year ? Number(s.year) : null,
        slug: s.slug,
        card_count: Number(s.card_count || 0),
        manufacturer: s.manufacturer,
        organization: s.organization
      }))
    }

    // Search series
    if (typeList.includes('series')) {
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
      results.series = seriesRaw.map(s => ({
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
    }

    return successResponse(res, results)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/search/autocomplete
 *
 * Quick autocomplete suggestions for search boxes.
 * Returns minimal data for fast response times.
 *
 * Query Parameters:
 *   - q: Search query (required, minimum 1 character)
 *   - type: Entity type to search (players, teams, sets, series) - optional, defaults to players
 *   - limit: Number of results (default: 8, max: 20)
 */
router.get('/autocomplete', async (req, res) => {
  try {
    const { q, type = 'players' } = req.query
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 8, 1), 20)

    if (!q || q.trim().length < 1) {
      return validationError(res, 'Search query (q) must be at least 1 character')
    }

    const searchTerm = q.trim().replace(/'/g, "''")
    let suggestions = []

    switch (type.toLowerCase()) {
      case 'players':
        const playersQuery = `
          SELECT TOP ${limit}
            p.player_id as id,
            CONCAT(p.first_name, ' ', p.last_name) as label,
            p.slug,
            'player' as type
          FROM player p
          WHERE
            p.first_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
            OR p.last_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
            OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          ORDER BY
            CASE
              WHEN CONCAT(p.first_name, ' ', p.last_name) LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
              ELSE 2
            END,
            p.card_count DESC
        `
        const playersRaw = await prisma.$queryRawUnsafe(playersQuery)
        suggestions = playersRaw.map(p => ({
          id: Number(p.id),
          label: p.label,
          slug: p.slug,
          type: p.type
        }))
        break

      case 'teams':
        const teamsQuery = `
          SELECT TOP ${limit}
            t.team_id as id,
            t.name as label,
            t.abbreviation as secondary,
            'team' as type
          FROM team t
          WHERE
            t.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
            OR t.abbreviation LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          ORDER BY
            CASE
              WHEN t.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
              ELSE 2
            END,
            t.card_count DESC
        `
        const teamsRaw = await prisma.$queryRawUnsafe(teamsQuery)
        suggestions = teamsRaw.map(t => ({
          id: Number(t.id),
          label: t.label,
          secondary: t.secondary,
          type: t.type
        }))
        break

      case 'sets':
        const setsQuery = `
          SELECT TOP ${limit}
            s.set_id as id,
            s.name as label,
            s.year,
            s.slug,
            'set' as type
          FROM [set] s
          WHERE
            s.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          ORDER BY
            CASE
              WHEN s.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
              ELSE 2
            END,
            s.year DESC
        `
        const setsRaw = await prisma.$queryRawUnsafe(setsQuery)
        suggestions = setsRaw.map(s => ({
          id: Number(s.id),
          label: s.label,
          year: s.year ? Number(s.year) : null,
          slug: s.slug,
          type: s.type
        }))
        break

      case 'series':
        const seriesQuery = `
          SELECT TOP ${limit}
            s.series_id as id,
            s.name as label,
            st.name as set_name,
            s.slug,
            'series' as type
          FROM series s
          JOIN [set] st ON s.[set] = st.set_id
          WHERE
            s.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
          ORDER BY
            CASE
              WHEN s.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
              ELSE 2
            END,
            s.card_count DESC
        `
        const seriesRaw = await prisma.$queryRawUnsafe(seriesQuery)
        suggestions = seriesRaw.map(s => ({
          id: Number(s.id),
          label: s.label,
          set_name: s.set_name,
          slug: s.slug,
          type: s.type
        }))
        break

      default:
        return validationError(res, 'Invalid type. Must be one of: players, teams, sets, series')
    }

    return successResponse(res, suggestions)

  } catch (error) {
    return serverError(res, error)
  }
})

module.exports = router
