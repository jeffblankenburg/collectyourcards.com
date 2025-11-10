const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware } = require('../middleware/auth')
const { Prisma } = require('@prisma/client')
const {
  escapeLikePattern,
  validateNumericId,
  validateNumericArray,
  escapeString
} = require('../utils/sql-security')

// Optional auth middleware
const optionalAuthMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    try {
      await authMiddleware(req, res, () => {})
    } catch (err) {
      // User not authenticated, continue without user context
    }
  }
  next()
}

// GET /api/cards - Get cards with filtering and pagination
router.get('/', optionalAuthMiddleware, async (req, res) => {
  try {
    const { 
      player_name, 
      team_id, 
      series_name,
      series_id,
      card_number,
      limit = 100, 
      page = 1 
    } = req.query


    const limitNum = Math.min(parseInt(limit) || 100, 10000) // Cap at 10000 for loading all data
    const pageNum = parseInt(page) || 1
    const offsetNum = (pageNum - 1) * limitNum

    // Build WHERE conditions for filtering
    const whereConditions = []
    let playerFilterJoin = ''

    if (player_name) {
      // Split player name into parts and sanitize
      const nameParts = player_name.trim().split(/\s+/)
      if (nameParts.length >= 2) {
        const firstName = escapeLikePattern(nameParts[0])
        const lastName = escapeLikePattern(nameParts.slice(1).join(' '))

        whereConditions.push(`EXISTS (
          SELECT 1 FROM card_player_team cpt2
          JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
          JOIN player p2 ON pt2.player = p2.player_id
          WHERE cpt2.card = c.card_id
          AND LOWER(p2.first_name) LIKE LOWER('%${firstName}%')
          AND LOWER(p2.last_name) LIKE LOWER('%${lastName}%')
        )`)
      }
    }

    if (team_id) {
      const teamIdNum = validateNumericId(team_id, 'team_id')
      whereConditions.push(`EXISTS (
        SELECT 1 FROM card_player_team cpt3
        JOIN player_team pt3 ON cpt3.player_team = pt3.player_team_id
        WHERE cpt3.card = c.card_id AND pt3.team = ${teamIdNum}
      )`)
    }

    if (series_name) {
      const safeSeriesName = escapeLikePattern(series_name)
      whereConditions.push(`LOWER(s.name) LIKE LOWER('%${safeSeriesName}%')`)
    }

    if (series_id) {
      const seriesIdNum = validateNumericId(series_id, 'series_id')
      whereConditions.push(`s.series_id = ${seriesIdNum}`)
    }

    if (card_number) {
      const safeCardNumber = card_number.replace(/'/g, "''")
      whereConditions.push(`c.card_number = '${safeCardNumber}'`)
    }

    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : ''

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM card c
      JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      ${whereClause}
    `
    
    const countResult = await prisma.$queryRawUnsafe(countQuery)
    const total = Number(countResult[0].total)

    // Get paginated cards with user collection data
    const userId = req.user?.userId
    const userIdNumber = userId ? Number(userId) : null
    const userCollectionJoin = userIdNumber ? `
      LEFT JOIN user_card uc ON c.card_id = uc.card AND uc.[user] = ${userIdNumber}
    ` : ''
    
    const cardsQuery = `
      SELECT
        c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic,
        c.print_run, c.sort_order, c.notes,
        s.name as series_name, s.series_id, s.slug as series_slug,
        col.name as color, col.hex_value as hex_color,
        ${userIdNumber ? 'ISNULL(COUNT(uc.user_card_id), 0) as user_card_count' : '0 as user_card_count'}
      FROM card c
      JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      ${userCollectionJoin}
      ${whereClause}
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic,
               c.print_run, c.sort_order, c.notes, s.name, s.series_id, s.slug,
               col.name, col.hex_value
      ORDER BY s.name ASC, c.sort_order ASC
      OFFSET ${offsetNum} ROWS FETCH NEXT ${limitNum} ROWS ONLY
    `
    
    const cardResults = await prisma.$queryRawUnsafe(cardsQuery)
    

    // Get player-team associations for these cards
    // Validate all IDs are numbers for security
    const cardIds = validateNumericArray(cardResults.map(card => card.card_id))

    let cardPlayerTeamMap = {}
    if (cardIds.length > 0) {
      // Get ALL player-team associations for the filtered cards
      // This is correct - we want all players on multi-player cards
      const safeCardIds = cardIds.join(',') // Safe - validated by validateNumericArray
      const playerTeamQuery = `
        SELECT
          cpt.card as card_id,
          p.player_id,
          p.first_name,
          p.last_name,
          t.team_id,
          t.name as team_name,
          t.abbreviation as team_abbr,
          t.primary_color,
          t.secondary_color
        FROM card_player_team cpt
        JOIN player_team pt ON cpt.player_team = pt.player_team_id
        JOIN player p ON pt.player = p.player_id
        JOIN team t ON pt.team = t.team_id
        WHERE cpt.card IN (${safeCardIds})
        ORDER BY cpt.card, p.last_name
      `

      const cardPlayerResults = await prisma.$queryRawUnsafe(playerTeamQuery)

      // Group by card_id
      cardPlayerResults.forEach(row => {
        const cardId = Number(row.card_id)
        if (!cardPlayerTeamMap[cardId]) {
          cardPlayerTeamMap[cardId] = []
        }
        
        cardPlayerTeamMap[cardId].push({
          player: {
            player_id: Number(row.player_id),
            name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            first_name: row.first_name,
            last_name: row.last_name
          },
          team: {
            team_id: Number(row.team_id),
            name: row.team_name,
            abbreviation: row.team_abbr,
            primary_color: row.primary_color,
            secondary_color: row.secondary_color
          }
        })
      })
    }

    // Transform cards to match frontend structure
    const cards = cardResults.map(card => {
      const serialized = {}
      Object.keys(card).forEach(key => {
        serialized[key] = typeof card[key] === 'bigint' ? Number(card[key]) : card[key]
      })
      
      const cardId = Number(serialized.card_id)
      
      return {
        card_id: cardId,
        card_number: serialized.card_number,
        is_rookie: serialized.is_rookie,
        is_autograph: serialized.is_autograph,
        is_relic: serialized.is_relic,
        print_run: serialized.print_run,
        sort_order: serialized.sort_order,
        notes: serialized.notes,
        user_card_count: Number(serialized.user_card_count) || 0,
        card_player_teams: cardPlayerTeamMap[cardId] || [],
        series_rel: {
          series_id: serialized.series_id,
          name: serialized.series_name,
          slug: serialized.series_slug
        },
        color_rel: serialized.color ? {
          color: serialized.color,
          hex_color: serialized.hex_color
        } : null
      }
    })

    res.json({
      cards,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: offsetNum + limitNum < total
    })

  } catch (error) {
    console.error('Error fetching cards:', error)
    console.error('Error details:', error.message)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch cards',
      details: error.message
    })
  }
})

// GET /api/cards/rainbow - Get all parallel cards with the same card number in a set
router.get('/rainbow', optionalAuthMiddleware, async (req, res) => {
  try {
    const { set_id, card_number } = req.query

    if (!set_id || !card_number) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'set_id and card_number are required'
      })
    }

    const setIdNum = parseInt(set_id)
    if (isNaN(setIdNum)) {
      return res.status(400).json({
        error: 'Invalid set_id',
        message: 'set_id must be a valid number'
      })
    }

    const userId = req.user?.userId
    const userIdNumber = userId ? Number(userId) : null
    const userCollectionJoin = userIdNumber ? `
      LEFT JOIN user_card uc ON c.card_id = uc.card AND uc.[user] = ${userIdNumber}
    ` : ''

    // Get all cards with the same card_number in all series within the set
    const cardsQuery = `
      SELECT
        c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic,
        c.print_run, c.sort_order, c.notes,
        s.series_id, s.name as series_name, s.slug as series_slug, s.is_base,
        col.name as color, col.hex_value as hex_color,
        ${userIdNumber ? 'ISNULL(COUNT(uc.user_card_id), 0) as user_card_count' : '0 as user_card_count'}
      FROM card c
      JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      ${userCollectionJoin}
      WHERE s.[set] = ${setIdNum}
        AND c.card_number = '${card_number.replace(/'/g, "''")}'
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic,
               c.print_run, c.sort_order, c.notes, s.series_id, s.name, s.slug, s.is_base,
               col.name, col.hex_value
      ORDER BY s.is_base DESC, s.name ASC
    `

    const cardResults = await prisma.$queryRawUnsafe(cardsQuery)

    // Get player-team associations for these cards
    // Validate all IDs are numbers for security
    const cardIds = validateNumericArray(cardResults.map(card => card.card_id))

    let cardPlayerTeamMap = {}
    if (cardIds.length > 0) {
      const safeCardIds = cardIds.join(',') // Safe - validated by validateNumericArray
      const playerTeamQuery = `
        SELECT
          cpt.card as card_id,
          p.player_id,
          p.first_name,
          p.last_name,
          t.team_id,
          t.name as team_name,
          t.abbreviation as team_abbr,
          t.primary_color,
          t.secondary_color
        FROM card_player_team cpt
        JOIN player_team pt ON cpt.player_team = pt.player_team_id
        JOIN player p ON pt.player = p.player_id
        JOIN team t ON pt.team = t.team_id
        WHERE cpt.card IN (${safeCardIds})
        ORDER BY cpt.card, p.last_name
      `

      const cardPlayerResults = await prisma.$queryRawUnsafe(playerTeamQuery)

      // Group by card_id
      cardPlayerResults.forEach(row => {
        const cardId = Number(row.card_id)
        if (!cardPlayerTeamMap[cardId]) {
          cardPlayerTeamMap[cardId] = []
        }

        cardPlayerTeamMap[cardId].push({
          player: {
            player_id: Number(row.player_id),
            name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
            first_name: row.first_name,
            last_name: row.last_name
          },
          team: {
            team_id: Number(row.team_id),
            name: row.team_name,
            abbreviation: row.team_abbr,
            primary_color: row.primary_color,
            secondary_color: row.secondary_color
          }
        })
      })
    }

    // Transform cards to match frontend structure
    const cards = cardResults.map(card => {
      const serialized = {}
      Object.keys(card).forEach(key => {
        serialized[key] = typeof card[key] === 'bigint' ? Number(card[key]) : card[key]
      })

      const cardId = Number(serialized.card_id)

      return {
        card_id: cardId,
        card_number: serialized.card_number,
        is_rookie: serialized.is_rookie,
        is_autograph: serialized.is_autograph,
        is_relic: serialized.is_relic,
        print_run: serialized.print_run,
        sort_order: serialized.sort_order,
        notes: serialized.notes,
        user_card_count: Number(serialized.user_card_count) || 0,
        card_player_teams: cardPlayerTeamMap[cardId] || [],
        series_rel: {
          series_id: serialized.series_id,
          name: serialized.series_name,
          slug: serialized.series_slug,
          is_base: Boolean(serialized.is_base)
        },
        color_rel: serialized.color ? {
          color: serialized.color,
          hex_color: serialized.hex_color
        } : null
      }
    })

    res.json({
      success: true,
      cards,
      total: cards.length
    })

  } catch (error) {
    console.error('Error fetching rainbow cards:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch rainbow cards',
      details: error.message
    })
  }
})

// GET /api/cards/carousel - Get random card images for home page carousel
router.get('/carousel', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 20

    // Get random card front images with navigation data
    // Query user_card_photo directly for ANY user upload (not just reference images)
    const query = `
      SELECT TOP ${limit}
        ucp.photo_url,
        ucp.user_card_photo_id,
        c.card_id,
        c.card_number,
        s.slug as series_slug,
        s.name as series_name,
        st.year as set_year,
        st.slug as set_slug,
        p.first_name,
        p.last_name,
        p.player_id
      FROM user_card_photo ucp
      JOIN user_card uc ON ucp.user_card = uc.user_card_id
      JOIN card c ON uc.card = c.card_id
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE ucp.sort_order = 1
        AND ucp.photo_url IS NOT NULL
        AND p.player_id IS NOT NULL
      ORDER BY NEWID()
    `

    const results = await prisma.$queryRawUnsafe(query)

    // Transform results and generate player slugs
    const carouselCards = results.map(row => {
      const playerSlug = `${row.first_name || ''}-${row.last_name || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9\\s-]/g, '')
        .replace(/\\s+/g, '-')
        .replace(/-+/g, '-')
        .trim()

      return {
        photo_url: row.photo_url,
        card_id: Number(row.card_id),
        card_number: row.card_number,
        series_slug: row.series_slug,
        series_name: row.series_name,
        set_year: Number(row.set_year),
        set_slug: row.set_slug,
        player_name: `${row.first_name || ''} ${row.last_name || ''}`.trim(),
        player_slug: playerSlug,
        // URL for CardDetail page
        url: `/sets/${row.set_year}/${row.set_slug}/${row.series_slug}/${encodeURIComponent(row.card_number)}/${playerSlug}`
      }
    })

    res.json({
      success: true,
      cards: carouselCards,
      total: carouselCards.length
    })

  } catch (error) {
    console.error('Error fetching carousel cards:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch carousel cards',
      details: error.message
    })
  }
})

// GET /api/parallel-series - Get parallel series for a specific card number in a set
router.get('/parallel-series', async (req, res) => {
  try {
    const { set_id, card_number } = req.query
    
    if (!set_id || !card_number) {
      return res.status(400).json({
        error: 'Missing required parameters',
        message: 'set_id and card_number are required'
      })
    }

    const setIdNum = parseInt(set_id)
    if (isNaN(setIdNum)) {
      return res.status(400).json({
        error: 'Invalid set_id',
        message: 'set_id must be a valid number'
      })
    }

    // Helper function to generate URL slug from name
    function generateSlug(name) {
      if (!name) return 'unknown'
      return name
        .toLowerCase()
        .replace(/&/g, 'and') // Convert ampersands to "and" to preserve semantic meaning
        .replace(/'/g, '') // Remove apostrophes completely
        .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
        .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    }

    // Get all series in the set that have a card with the specified card number
    const query = `
      SELECT DISTINCT
        s.series_id,
        s.name,
        s.slug,
        s.is_base,
        s.min_print_run,
        s.max_print_run,
        s.print_run_display,
        col.name as color_name,
        col.hex_value as color_hex,
        CASE WHEN s.is_base = 1 THEN 0 ELSE 1 END as sort_order
      FROM series s
      JOIN card c ON s.series_id = c.series
      LEFT JOIN color col ON s.color = col.color_id
      WHERE s.[set] = ${setIdNum}
        AND c.card_number = '${card_number.replace(/'/g, "''")}'
      ORDER BY
        sort_order,
        s.name
    `

    const result = await prisma.$queryRawUnsafe(query)
    
    // Convert BigInt fields to numbers for JSON serialization
    const series = result.map(row => ({
      series_id: Number(row.series_id),
      name: row.name,
      slug: row.slug, // Use stored slug
      is_base: Boolean(row.is_base),
      series_slug: row.slug, // Alternative field name for compatibility
      min_print_run: row.min_print_run ? Number(row.min_print_run) : null,
      max_print_run: row.max_print_run ? Number(row.max_print_run) : null,
      print_run_display: row.print_run_display,
      color_name: row.color_name,
      color_hex: row.color_hex
    }))

    res.json({
      success: true,
      series
    })

  } catch (error) {
    console.error('Error fetching parallel series:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch parallel series',
      details: error.message
    })
  }
})

module.exports = router