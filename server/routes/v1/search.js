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

/**
 * GET /api/v1/search/sets-autocomplete
 *
 * Autocomplete for sets, with optional year filtering.
 * Designed for Add Card form.
 *
 * Query Parameters:
 *   - q: Search query (required, minimum 2 characters)
 *   - year: Filter by year (optional)
 *   - limit: Number of results (default: 10, max: 20)
 */
router.get('/sets-autocomplete', async (req, res) => {
  try {
    const { q, year } = req.query
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 20)

    if (!q || q.trim().length < 2) {
      return validationError(res, 'Search query (q) must be at least 2 characters')
    }

    const searchTerm = q.trim().replace(/'/g, "''")
    const yearFilter = year ? parseInt(year) : null

    let query = `
      SELECT TOP ${limit}
        s.set_id,
        s.name,
        s.year,
        s.slug,
        s.card_count,
        m.name as manufacturer
      FROM [set] s
      LEFT JOIN manufacturer m ON s.manufacturer = m.manufacturer_id
      WHERE s.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
    `

    if (yearFilter) {
      query += ` AND s.year = ${yearFilter}`
    }

    query += `
      ORDER BY
        CASE
          WHEN s.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
          ELSE 2
        END,
        s.year DESC,
        s.card_count DESC
    `

    const setsRaw = await prisma.$queryRawUnsafe(query)
    const sets = setsRaw.map(s => ({
      set_id: Number(s.set_id),
      name: s.name,
      year: s.year ? Number(s.year) : null,
      slug: s.slug,
      card_count: Number(s.card_count || 0),
      manufacturer: s.manufacturer
    }))

    return successResponse(res, sets)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/search/series-autocomplete
 *
 * Autocomplete for series within a specific set.
 * Designed for Add Card form.
 *
 * Query Parameters:
 *   - q: Search query (optional - returns all series if not provided)
 *   - set_id: Filter by set ID (required)
 *   - limit: Number of results (default: 20, max: 50)
 */
router.get('/series-autocomplete', async (req, res) => {
  try {
    const { q, set_id } = req.query
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 20, 1), 50)

    if (!set_id) {
      return validationError(res, 'set_id is required')
    }

    const setId = parseInt(set_id)
    if (isNaN(setId) || setId <= 0) {
      return validationError(res, 'set_id must be a positive integer')
    }

    let searchTerm = ''
    if (q && q.trim().length > 0) {
      searchTerm = q.trim().replace(/'/g, "''")
    }

    let query = `
      SELECT TOP ${limit}
        s.series_id,
        s.name,
        s.color,
        s.min_print_run,
        s.print_run_display,
        s.is_base,
        s.card_count,
        s.slug,
        st.name as set_name,
        st.year
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      WHERE s.[set] = ${setId}
    `

    if (searchTerm) {
      // Handle "base" special case
      if (searchTerm.toLowerCase() === 'base' || searchTerm.toLowerCase() === 'base set') {
        query += ` AND (s.is_base = 1 OR LOWER(s.name) = LOWER(st.name))`
      } else {
        query += ` AND s.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI`
      }
    }

    query += `
      ORDER BY
        s.is_base DESC,
        CASE
          WHEN s.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
          ELSE 2
        END,
        s.card_count DESC,
        s.name ASC
    `

    const seriesRaw = await prisma.$queryRawUnsafe(query)
    const series = seriesRaw.map(s => ({
      series_id: Number(s.series_id),
      name: s.name,
      color: s.color,
      print_run: s.print_run_display || (s.min_print_run ? Number(s.min_print_run) : null),
      is_base: Boolean(s.is_base),
      card_count: Number(s.card_count || 0),
      slug: s.slug,
      set_name: s.set_name,
      year: s.year ? Number(s.year) : null
    }))

    return successResponse(res, series)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/search/players-autocomplete
 *
 * Autocomplete for players with team information.
 * Designed for Add Card form.
 *
 * Query Parameters:
 *   - q: Search query (required, minimum 2 characters)
 *   - limit: Number of results (default: 10, max: 20)
 */
router.get('/players-autocomplete', async (req, res) => {
  try {
    const { q } = req.query
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 20)

    if (!q || q.trim().length < 2) {
      return validationError(res, 'Search query (q) must be at least 2 characters')
    }

    const searchTerm = q.trim().replace(/'/g, "''")

    // Get players with their teams
    const query = `
      SELECT TOP ${limit}
        p.player_id,
        p.first_name,
        p.last_name,
        p.nick_name,
        p.slug,
        p.card_count,
        (
          SELECT TOP 1 t.team_id
          FROM player_team pt
          JOIN team t ON pt.team = t.team_id
          WHERE pt.player = p.player_id
          ORDER BY pt.player_team_id DESC
        ) as primary_team_id,
        (
          SELECT TOP 1 t.name
          FROM player_team pt
          JOIN team t ON pt.team = t.team_id
          WHERE pt.player = p.player_id
          ORDER BY pt.player_team_id DESC
        ) as primary_team_name
      FROM player p
      WHERE
        p.first_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR p.last_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        OR p.nick_name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
      ORDER BY
        CASE
          WHEN CONCAT(p.first_name, ' ', p.last_name) LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
          WHEN p.last_name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 2
          ELSE 3
        END,
        p.card_count DESC
    `

    const playersRaw = await prisma.$queryRawUnsafe(query)
    const players = playersRaw.map(p => ({
      player_id: Number(p.player_id),
      first_name: p.first_name,
      last_name: p.last_name,
      name: `${p.first_name} ${p.last_name}`.trim(),
      nick_name: p.nick_name,
      slug: p.slug,
      card_count: Number(p.card_count || 0),
      primary_team: p.primary_team_id ? {
        team_id: Number(p.primary_team_id),
        name: p.primary_team_name
      } : null
    }))

    return successResponse(res, players)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/search/teams-autocomplete
 *
 * Autocomplete for teams.
 * Designed for Add Card form.
 *
 * Query Parameters:
 *   - q: Search query (required, minimum 2 characters)
 *   - limit: Number of results (default: 10, max: 20)
 */
router.get('/teams-autocomplete', async (req, res) => {
  try {
    const { q } = req.query
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 20)

    if (!q || q.trim().length < 2) {
      return validationError(res, 'Search query (q) must be at least 2 characters')
    }

    const searchTerm = q.trim().replace(/'/g, "''")

    const query = `
      SELECT TOP ${limit}
        t.team_id,
        t.name,
        t.abbreviation,
        t.city,
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
        OR t.mascot LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
      ORDER BY
        CASE
          WHEN t.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
          WHEN t.abbreviation = '${searchTerm}' COLLATE Latin1_General_CI_AI THEN 2
          ELSE 3
        END,
        t.card_count DESC
    `

    const teamsRaw = await prisma.$queryRawUnsafe(query)
    const teams = teamsRaw.map(t => ({
      team_id: Number(t.team_id),
      name: t.name,
      abbreviation: t.abbreviation,
      city: t.city,
      primary_color: t.primary_color,
      secondary_color: t.secondary_color,
      card_count: Number(t.card_count || 0),
      organization: t.organization_name
    }))

    return successResponse(res, teams)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * GET /api/v1/search/colors-autocomplete
 *
 * Autocomplete for card colors/parallels.
 * Designed for Add Card form.
 *
 * Query Parameters:
 *   - q: Search query (optional - returns popular colors if not provided)
 *   - limit: Number of results (default: 15, max: 30)
 */
router.get('/colors-autocomplete', async (req, res) => {
  try {
    const { q } = req.query
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 15, 1), 30)

    let query
    if (q && q.trim().length > 0) {
      const searchTerm = q.trim().replace(/'/g, "''")
      query = `
        SELECT TOP ${limit}
          c.color_id,
          c.name,
          c.hex_code
        FROM color c
        WHERE c.name LIKE '%${searchTerm}%' COLLATE Latin1_General_CI_AI
        ORDER BY
          CASE
            WHEN c.name LIKE '${searchTerm}%' COLLATE Latin1_General_CI_AI THEN 1
            ELSE 2
          END,
          c.name ASC
      `
    } else {
      // Return popular/common colors when no search term
      query = `
        SELECT TOP ${limit}
          c.color_id,
          c.name,
          c.hex_code
        FROM color c
        ORDER BY c.name ASC
      `
    }

    const colorsRaw = await prisma.$queryRawUnsafe(query)
    const colors = colorsRaw.map(c => ({
      color_id: Number(c.color_id),
      name: c.name,
      hex_code: c.hex_code
    }))

    return successResponse(res, colors)

  } catch (error) {
    return serverError(res, error)
  }
})

/**
 * POST /api/v1/search/resolve-preview
 *
 * Preview entity resolution without creating records.
 * Returns resolution status for each entity.
 *
 * Request Body:
 *   - year: Year (required)
 *   - set_name: Set name (required)
 *   - series_name: Series name (optional, defaults to base series)
 *   - card_number: Card number (required)
 *   - player_name: Player name (required)
 *   - team_name: Team name (optional)
 *   - color_name: Color/parallel name (optional)
 */
router.post('/resolve-preview', async (req, res) => {
  try {
    const {
      year,
      set_name,
      series_name,
      card_number,
      player_name,
      team_name,
      color_name
    } = req.body

    // Validate required fields
    if (!year || !set_name || !card_number || !player_name) {
      return validationError(res, 'Missing required fields: year, set_name, card_number, player_name')
    }

    // Import auto-resolver functions
    const {
      matchSet,
      matchSeries,
      matchPlayer,
      matchTeam,
      matchColor,
      findExistingCard
    } = require('./crowdsource/auto-resolver')

    const resolution = {
      set: null,
      series: null,
      player: null,
      team: null,
      color: null,
      card: null,
      fully_resolved: false
    }

    // 1. Resolve set
    const setMatch = await matchSet(set_name, parseInt(year))
    if (setMatch) {
      resolution.set = {
        resolved: true,
        id: setMatch.id,
        name: setMatch.name,
        confidence: setMatch.confidence,
        status: setMatch.confidence >= 0.95 ? 'exact' : 'partial'
      }
    } else {
      resolution.set = {
        resolved: false,
        message: 'Set not found - will be created pending review',
        status: 'new'
      }
    }

    // 2. Resolve series (only if set was found)
    if (resolution.set.resolved && resolution.set.id) {
      const seriesMatch = await matchSeries(series_name || '', resolution.set.id)
      if (seriesMatch) {
        resolution.series = {
          resolved: true,
          id: seriesMatch.id,
          name: seriesMatch.name,
          confidence: seriesMatch.confidence,
          status: seriesMatch.confidence >= 0.95 ? 'exact' : 'partial'
        }
      } else if (series_name) {
        resolution.series = {
          resolved: false,
          message: 'Series not found - will be created pending review',
          status: 'new'
        }
      } else {
        resolution.series = {
          resolved: false,
          message: 'No base series found for this set',
          status: 'missing'
        }
      }
    } else {
      resolution.series = {
        resolved: false,
        message: 'Cannot resolve series without set',
        status: 'pending'
      }
    }

    // 3. Resolve player
    const playerMatch = await matchPlayer(player_name, team_name)
    if (playerMatch && playerMatch.playerId) {
      resolution.player = {
        resolved: true,
        id: playerMatch.playerId,
        name: playerMatch.playerName,
        confidence: playerMatch.confidence,
        status: playerMatch.confidence >= 0.95 ? 'exact' : 'partial',
        team_id: playerMatch.teamId,
        team_name: playerMatch.teamName
      }

      // Set team from player if not separately specified
      if (playerMatch.teamId) {
        resolution.team = {
          resolved: true,
          id: playerMatch.teamId,
          name: playerMatch.teamName,
          confidence: 1.0,
          status: 'from_player'
        }
      }
    } else {
      resolution.player = {
        resolved: false,
        message: 'Player not found - will be created pending review',
        status: 'new'
      }
    }

    // 4. Resolve team (if explicitly provided and not already resolved from player)
    if (team_name && !resolution.team) {
      const teamMatch = await matchTeam(team_name)
      if (teamMatch) {
        resolution.team = {
          resolved: true,
          id: teamMatch.id,
          name: teamMatch.name,
          confidence: teamMatch.confidence,
          status: teamMatch.confidence >= 0.95 ? 'exact' : 'partial'
        }
      } else {
        resolution.team = {
          resolved: false,
          message: 'Team not found - will be created pending review',
          status: 'new'
        }
      }
    } else if (!resolution.team) {
      resolution.team = {
        resolved: false,
        message: 'No team specified',
        status: 'not_provided'
      }
    }

    // 5. Resolve color (optional)
    if (color_name) {
      const colorMatch = await matchColor(color_name)
      if (colorMatch) {
        resolution.color = {
          resolved: true,
          id: colorMatch.id,
          name: colorMatch.name,
          confidence: colorMatch.confidence,
          status: colorMatch.confidence >= 0.95 ? 'exact' : 'partial'
        }
      } else {
        resolution.color = {
          resolved: false,
          message: 'Color not found - will be added to card notes',
          status: 'new'
        }
      }
    }

    // 6. Check if card exists
    if (resolution.series?.resolved && resolution.series?.id) {
      const playerTeamIds = resolution.player?.resolved && playerMatch?.playerTeamId
        ? [playerMatch.playerTeamId]
        : []

      const existingCard = await findExistingCard(
        resolution.series.id,
        card_number,
        playerTeamIds
      )

      if (existingCard) {
        resolution.card = {
          resolved: true,
          id: existingCard.cardId,
          card_number: existingCard.cardNumber,
          status: 'exists',
          message: 'Card already exists in database'
        }
      } else {
        resolution.card = {
          resolved: false,
          message: 'Card not in database - will be created pending review',
          status: 'new'
        }
      }
    } else {
      resolution.card = {
        resolved: false,
        message: 'Cannot check card without resolved series',
        status: 'pending'
      }
    }

    // 7. Determine if fully resolved
    resolution.fully_resolved = (
      resolution.set?.resolved && resolution.set?.confidence >= 0.95 &&
      resolution.series?.resolved &&
      resolution.player?.resolved && resolution.player?.confidence >= 0.95 &&
      resolution.card?.resolved
    )

    return successResponse(res, resolution)

  } catch (error) {
    return serverError(res, error)
  }
})

module.exports = router
