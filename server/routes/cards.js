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

// ============================================================================
// LRU CACHE for search results
// ============================================================================

class LRUCache {
  constructor(maxSize = 1000) {
    this.maxSize = maxSize
    this.cache = new Map()
  }

  get(key) {
    if (!this.cache.has(key)) return null
    // Move to end (most recently used)
    const value = this.cache.get(key)
    this.cache.delete(key)
    this.cache.set(key, value)
    return value
  }

  set(key, value) {
    // Remove if already exists
    if (this.cache.has(key)) {
      this.cache.delete(key)
    }
    // Add to end
    this.cache.set(key, value)
    // Remove oldest if over limit
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
  }

  clear() {
    this.cache.clear()
  }

  size() {
    return this.cache.size
  }

  stats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPercent: Math.round((this.cache.size / this.maxSize) * 100)
    }
  }
}

// Initialize search cache - larger size for detail page searches
const searchCache = new LRUCache(2000)
let cacheHits = 0
let cacheMisses = 0

// ============================================================================
// SEARCH QUERY PARSER - Intelligent search term extraction
// ============================================================================

function parseSearchQuery(searchQuery) {
  if (!searchQuery || !searchQuery.trim()) {
    return {
      keywords: [],
      isRookie: false,
      isAutograph: false,
      isRelic: false,
      isShortPrint: false,
      printRun: null,
      colors: [],
      year: null
    }
  }

  const query = searchQuery.toLowerCase().trim()
  const terms = query.split(/\s+/)

  const parsed = {
    keywords: [],
    isRookie: false,
    isAutograph: false,
    isRelic: false,
    isShortPrint: false,
    printRun: null,
    colors: [],
    year: null
  }

  const cardTypeKeywords = new Set(['rc', 'rookie', 'auto', 'autograph', 'relic', 'sp', 'shortprint', 'short-print'])
  const colorKeywords = new Set(['red', 'blue', 'green', 'gold', 'silver', 'black', 'orange', 'purple',
    'pink', 'refractor', 'shimmer', 'wave', 'prism', 'atomic'])

  for (const term of terms) {
    // Check for rookie
    if (term === 'rc' || term === 'rookie') {
      parsed.isRookie = true
      continue
    }

    // Check for autograph
    if (term === 'auto' || term === 'autograph') {
      parsed.isAutograph = true
      continue
    }

    // Check for relic
    if (term === 'relic') {
      parsed.isRelic = true
      continue
    }

    // Check for short print
    if (term === 'sp' || term === 'shortprint' || term === 'short-print') {
      parsed.isShortPrint = true
      continue
    }

    // Check for print run (e.g., "/99", "99", "/25")
    const printRunMatch = term.match(/^\/(\d+)$/) || term.match(/^(\d+)$/)
    if (printRunMatch && parseInt(printRunMatch[1]) < 1000) {
      parsed.printRun = parseInt(printRunMatch[1])
      continue
    }

    // Check for year (e.g., "2020", "2024")
    const yearMatch = term.match(/^(19|20)\d{2}$/)
    if (yearMatch) {
      parsed.year = parseInt(term)
      continue
    }

    // Check for color
    if (colorKeywords.has(term)) {
      parsed.colors.push(term)
      continue
    }

    // Everything else is a keyword (series name, set name, etc.)
    if (!cardTypeKeywords.has(term)) {
      parsed.keywords.push(term)
    }
  }

  return parsed
}

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
  const startTime = Date.now()

  try {
    const {
      player_name,
      team_id,
      series_name,
      series_id,
      card_number,
      search,  // NEW: Intelligent search parameter
      limit = 100,
      page = 1
    } = req.query

    // Parse search query if provided
    const searchParsed = search ? parseSearchQuery(search) : null

    // Create cache key for this specific query
    const userId = req.user?.userId
    const cacheKey = JSON.stringify({
      player_name,
      team_id,
      series_name,
      series_id,
      card_number,
      search,
      limit,
      page,
      userId: userId || 'anonymous'
    })

    // Check cache first
    const cached = searchCache.get(cacheKey)
    if (cached) {
      cacheHits++
      const searchTime = Date.now() - startTime
      console.log(`[Cards API] Cache HIT - ${searchTime}ms`)
      return res.json({
        ...cached,
        searchTime,
        cached: true,
        cacheStats: { hits: cacheHits, misses: cacheMisses, hitRate: `${Math.round((cacheHits / (cacheHits + cacheMisses)) * 100)}%` }
      })
    }

    cacheMisses++

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

    // Add intelligent search conditions
    if (searchParsed) {
      // Card type filters
      if (searchParsed.isRookie) {
        whereConditions.push(`c.is_rookie = 1`)
      }
      if (searchParsed.isAutograph) {
        whereConditions.push(`c.is_autograph = 1`)
      }
      if (searchParsed.isRelic) {
        whereConditions.push(`c.is_relic = 1`)
      }
      if (searchParsed.isShortPrint) {
        whereConditions.push(`c.is_short_print = 1`)
      }

      // Print run filter
      if (searchParsed.printRun) {
        whereConditions.push(`c.print_run = ${searchParsed.printRun}`)
      }

      // Year filter
      if (searchParsed.year) {
        whereConditions.push(`EXISTS (
          SELECT 1 FROM [set] st
          WHERE st.set_id = s.[set]
          AND st.year = ${searchParsed.year}
        )`)
      }

      // Color filters
      if (searchParsed.colors.length > 0) {
        const colorConditions = searchParsed.colors.map(color =>
          `LOWER(col.name) LIKE '%${escapeLikePattern(color)}%'`
        ).join(' OR ')
        whereConditions.push(`(${colorConditions})`)
      }

      // Keyword filters (series name, set name)
      if (searchParsed.keywords.length > 0) {
        const keywordConditions = searchParsed.keywords.map(keyword => {
          const safeKeyword = escapeLikePattern(keyword)
          return `(LOWER(s.name) LIKE '%${safeKeyword}%' OR EXISTS (
            SELECT 1 FROM [set] st2
            WHERE st2.set_id = s.[set]
            AND LOWER(st2.name) LIKE '%${safeKeyword}%'
          ))`
        }).join(' AND ')
        whereConditions.push(`(${keywordConditions})`)
      }
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
    const userIdNumber = userId ? Number(userId) : null
    const userCollectionJoin = userIdNumber ? `
      LEFT JOIN user_card uc ON c.card_id = uc.card AND uc.[user] = ${userIdNumber}
    ` : ''
    
    const cardsQuery = `
      SELECT
        c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.is_short_print,
        c.print_run, c.sort_order, c.notes, c.reference_user_card,
        c.front_image_path, c.back_image_path,
        s.name as series_name, s.series_id, s.slug as series_slug,
        col.name as color, col.hex_value as hex_color,
        ${userIdNumber ? 'ISNULL(COUNT(uc.user_card_id), 0) as user_card_count' : '0 as user_card_count'}
      FROM card c
      JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      ${userCollectionJoin}
      ${whereClause}
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.is_short_print,
               c.print_run, c.sort_order, c.notes, c.reference_user_card, c.front_image_path, c.back_image_path,
               s.name, s.series_id, s.slug, col.name, col.hex_value
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
        is_short_print: serialized.is_short_print,
        print_run: serialized.print_run,
        sort_order: serialized.sort_order,
        notes: serialized.notes,
        reference_user_card: serialized.reference_user_card ? Number(serialized.reference_user_card) : null,
        front_image_path: serialized.front_image_path,
        back_image_path: serialized.back_image_path,
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

    // Prepare response object
    const responseData = {
      cards,
      total,
      page: pageNum,
      limit: limitNum,
      hasMore: offsetNum + limitNum < total
    }

    // Cache the result for future requests
    searchCache.set(cacheKey, responseData)

    // Calculate search time
    const searchTime = Date.now() - startTime
    console.log(`[Cards API] Search complete - ${searchTime}ms (${searchParsed ? 'with search' : 'browse mode'})`)

    // Send response with timing
    res.json({
      ...responseData,
      searchTime,
      cached: false,
      cacheStats: { hits: cacheHits, misses: cacheMisses, hitRate: `${Math.round((cacheHits / (cacheHits + cacheMisses)) * 100)}%` }
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
    // Prevent caching - we want fresh random images every time
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private')
    res.setHeader('Pragma', 'no-cache')
    res.setHeader('Expires', '0')

    const limit = parseInt(req.query.limit) || 20

    // Get random cards with optimized front images
    // Uses card.front_image_path which contains web-optimized versions
    const query = `
      SELECT TOP ${limit}
        c.front_image_path as photo_url,
        c.card_id,
        c.card_number,
        s.slug as series_slug,
        s.name as series_name,
        st.year as set_year,
        st.slug as set_slug,
        p.first_name,
        p.last_name,
        p.player_id
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE c.front_image_path IS NOT NULL
        AND p.player_id IS NOT NULL
      ORDER BY NEWID()
    `

    const results = await prisma.$queryRawUnsafe(query)

    // Transform results and generate player slugs
    const carouselCards = results.map(row => {
      const playerSlug = `${row.first_name || ''}-${row.last_name || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
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