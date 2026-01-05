/**
 * Search V3 - Unified SQL Query Approach
 *
 * GOAL: Reduce database round trips from 11+ to 1-2
 *
 * This is a side-by-side test endpoint. The existing search-v2.js remains untouched.
 *
 * Endpoint: GET /api/search/universal-v3
 *
 * Key differences from V2:
 * - Single UNION ALL query for all entity types (players, teams, sets, series)
 * - Pattern detection happens AFTER results come back (not before)
 * - Dramatically fewer database round trips (critical for Azure SQL latency)
 */

const express = require('express')
const { prisma, executeWithRetry } = require('../config/prisma-singleton')

const router = express.Router()

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function escapeSqlLike(str) {
  if (!str) return ''
  return str.replace(/'/g, "''")
}

function generateSlug(name) {
  if (!name) return 'unknown'
  return name
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// ============================================================================
// QUERY PARSING (No database calls - pure string analysis)
// ============================================================================

function parseQueryTokens(query) {
  const tokens = {
    original: query,
    normalized: query.toLowerCase().trim(),
    words: query.trim().split(/\s+/),
    year: null,
    cardNumber: null,
    cardTypes: {
      rookie: false,
      autograph: false,
      relic: false
    },
    serialNumber: null,
    remainingTerms: []
  }

  // Extract year (4 digits starting with 19 or 20)
  const yearMatch = query.match(/\b(19\d{2}|20\d{2})\b/)
  if (yearMatch) {
    tokens.year = parseInt(yearMatch[1])
  }

  // Extract card number patterns (complex patterns first)
  const cardNumberPatterns = [
    /\b([A-Z]{1,4}-[A-Z0-9]{1,4})\b/i,  // BD-9, CPA-JDL
    /\b([A-Z]-\d{1,3})\b/i,              // A-1, B-9
    /\b([A-Z]{1,4}\d{1,4}[A-Z]?)\b/i,    // US110, H78
    /\b(\d{1,4}[A-Z]{1,2})\b/i,          // 1T, 57b
  ]
  for (const pattern of cardNumberPatterns) {
    const match = query.match(pattern)
    if (match) {
      tokens.cardNumber = match[1]
      break
    }
  }

  // If no complex card number found, check for simple numeric card number
  // Only treat as card number if there are other terms (like a player name)
  // This handles queries like "77 jose ramirez" or "jose ramirez 77"
  if (!tokens.cardNumber) {
    const words = query.trim().split(/\s+/)
    // Look for a standalone number (1-4 digits) that's NOT a year
    for (const word of words) {
      const simpleNumMatch = word.match(/^(\d{1,4})$/)
      if (simpleNumMatch) {
        const num = parseInt(simpleNumMatch[1])
        // Ensure it's not a year (1900-2099) and there are other terms
        if (!(num >= 1900 && num <= 2099) && words.length > 1) {
          tokens.cardNumber = simpleNumMatch[1]
          break
        }
      }
    }
  }

  // Extract serial/print run (/499, /25)
  const serialMatch = query.match(/\/(\d+)\b/)
  if (serialMatch) {
    tokens.serialNumber = parseInt(serialMatch[1])
  }

  // Detect card types
  const lowerQuery = query.toLowerCase()
  if (/\b(rookie|rc|rcs)\b/.test(lowerQuery)) tokens.cardTypes.rookie = true
  if (/\b(auto|autograph|signed)\b/.test(lowerQuery)) tokens.cardTypes.autograph = true
  if (/\b(relic|jersey|patch|memorabilia)\b/.test(lowerQuery)) tokens.cardTypes.relic = true

  // Build remaining search terms (remove extracted tokens)
  let remaining = query
  if (tokens.year) remaining = remaining.replace(tokens.year.toString(), '')
  if (tokens.cardNumber) remaining = remaining.replace(new RegExp(`\\b${tokens.cardNumber}\\b`, 'i'), '')
  if (tokens.serialNumber) remaining = remaining.replace(`/${tokens.serialNumber}`, '')

  // Remove card type keywords
  remaining = remaining.replace(/\b(rookie|rc|rcs|auto|autograph|signed|relic|jersey|patch|memorabilia)\b/gi, '')

  // Clean up and split
  tokens.remainingTerms = remaining.trim().split(/\s+/).filter(t => t.length >= 2)

  return tokens
}

// ============================================================================
// UNIFIED SEARCH QUERY - Single Database Round Trip
// ============================================================================

async function executeUnifiedSearch(query, tokens, limit = 50) {
  const searchTerms = tokens.remainingTerms.length > 0
    ? tokens.remainingTerms
    : tokens.words

  // Build search pattern for LIKE queries
  const searchPattern = `%${escapeSqlLike(searchTerms.join(' '))}%`
  const individualPatterns = searchTerms.map(t => `%${escapeSqlLike(t)}%`)

  // Build the WHERE clause for multi-term searches
  // For entities (players, teams), we use OR logic - match ANY term
  // This handles "2022 topps juan soto" finding "Juan Soto" even though "topps" doesn't match
  const buildMultiTermWhereOr = (columns, alias = '') => {
    // Any term matching any column is a hit
    const allConditions = individualPatterns.map(pattern =>
      columns.map(col => `${alias}${col} LIKE '${pattern}' COLLATE Latin1_General_CI_AI`).join(' OR ')
    )
    return `(${allConditions.join(' OR ')})`
  }

  // For strict matching (when we want ALL terms to match)
  const buildMultiTermWhereAnd = (columns, alias = '') => {
    if (searchTerms.length === 1) {
      return columns.map(col => `${alias}${col} LIKE '${individualPatterns[0]}' COLLATE Latin1_General_CI_AI`).join(' OR ')
    } else {
      const termConditions = individualPatterns.map(pattern =>
        `(${columns.map(col => `${alias}${col} LIKE '${pattern}' COLLATE Latin1_General_CI_AI`).join(' OR ')})`
      )
      return termConditions.join(' AND ')
    }
  }

  // Year filter for sets
  const yearFilter = tokens.year ? `AND st.year = ${tokens.year}` : ''
  const yearFilterOnly = tokens.year ? `st.year = ${tokens.year}` : '1=1'

  const sql = `
    -- =====================================================
    -- UNIFIED SEARCH: Single query, all entity types
    -- =====================================================

    -- PLAYERS (limit to top matches by card_count)
    SELECT TOP 15
      'player' as entity_type,
      CAST(p.player_id AS VARCHAR(20)) as id,
      CONCAT(p.first_name, ' ', p.last_name) as name,
      p.first_name,
      p.last_name,
      p.nick_name,
      p.slug,
      CAST(p.card_count AS INT) as card_count,
      p.is_hof,
      NULL as year,
      NULL as set_name,
      NULL as set_slug,
      NULL as series_name,
      NULL as series_slug,
      NULL as manufacturer_name,
      NULL as abbreviation,
      NULL as city,
      NULL as primary_color,
      NULL as secondary_color,
      NULL as color_name,
      NULL as color_hex,
      NULL as print_run,
      NULL as card_number,
      0 as is_rookie,
      0 as is_autograph,
      0 as is_relic,
      0 as is_parallel,
      -- Relevance scoring
      CASE
        WHEN CONCAT(p.first_name, ' ', p.last_name) = '${escapeSqlLike(searchTerms.join(' '))}' COLLATE Latin1_General_CI_AI THEN 100
        WHEN p.last_name = '${escapeSqlLike(searchTerms[searchTerms.length - 1])}' COLLATE Latin1_General_CI_AI THEN 95
        WHEN p.first_name = '${escapeSqlLike(searchTerms[0])}' COLLATE Latin1_General_CI_AI THEN 90
        ELSE 70
      END + CASE WHEN p.is_hof = 1 THEN 5 ELSE 0 END as relevance
    FROM player p
    WHERE ${buildMultiTermWhereOr(['first_name', 'last_name', 'nick_name'], 'p.')}

    UNION ALL

    -- TEAMS (all matching teams)
    SELECT TOP 10
      'team' as entity_type,
      CAST(t.team_id AS VARCHAR(20)) as id,
      t.name,
      NULL as first_name,
      NULL as last_name,
      NULL as nick_name,
      t.slug,
      CAST(t.player_count AS INT) as card_count,
      0 as is_hof,
      NULL as year,
      NULL as set_name,
      NULL as set_slug,
      NULL as series_name,
      NULL as series_slug,
      NULL as manufacturer_name,
      t.abbreviation,
      t.city,
      t.primary_color,
      t.secondary_color,
      NULL as color_name,
      NULL as color_hex,
      NULL as print_run,
      NULL as card_number,
      0 as is_rookie,
      0 as is_autograph,
      0 as is_relic,
      0 as is_parallel,
      CASE
        WHEN t.abbreviation = '${escapeSqlLike(searchTerms[0]).toUpperCase()}' COLLATE Latin1_General_CI_AI THEN 100
        WHEN t.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI THEN 90
        WHEN t.city LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI THEN 85
        ELSE 70
      END as relevance
    FROM team t
    WHERE ${buildMultiTermWhereOr(['name', 'city', 'mascot', 'abbreviation'], 't.')}

    UNION ALL

    -- SETS (with year filter if provided)
    SELECT TOP 15
      'set' as entity_type,
      CAST(st.set_id AS VARCHAR(20)) as id,
      st.name,
      NULL as first_name,
      NULL as last_name,
      NULL as nick_name,
      st.slug,
      0 as card_count,
      0 as is_hof,
      st.year,
      st.name as set_name,
      st.slug as set_slug,
      NULL as series_name,
      NULL as series_slug,
      m.name as manufacturer_name,
      NULL as abbreviation,
      NULL as city,
      NULL as primary_color,
      NULL as secondary_color,
      NULL as color_name,
      NULL as color_hex,
      NULL as print_run,
      NULL as card_number,
      0 as is_rookie,
      0 as is_autograph,
      0 as is_relic,
      0 as is_parallel,
      CASE
        WHEN st.name = '${escapeSqlLike(searchTerms.join(' '))}' COLLATE Latin1_General_CI_AI THEN 100
        WHEN st.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI THEN 85
        WHEN m.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI THEN 80
        ELSE 70
      END + CASE WHEN st.year = ${tokens.year || 0} THEN 10 ELSE 0 END as relevance
    FROM [set] st
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    WHERE (${buildMultiTermWhereOr(['name'], 'st.')} OR ${buildMultiTermWhereOr(['name'], 'm.')})
      ${yearFilter}

    UNION ALL

    -- SERIES (with year filter if provided)
    SELECT TOP 20
      'series' as entity_type,
      CAST(s.series_id AS VARCHAR(20)) as id,
      s.name,
      NULL as first_name,
      NULL as last_name,
      NULL as nick_name,
      s.slug,
      CAST(s.card_count AS INT) as card_count,
      0 as is_hof,
      st.year,
      st.name as set_name,
      st.slug as set_slug,
      s.name as series_name,
      s.slug as series_slug,
      m.name as manufacturer_name,
      NULL as abbreviation,
      NULL as city,
      NULL as primary_color,
      NULL as secondary_color,
      c.name as color_name,
      c.hex_value as color_hex,
      s.print_run_display as print_run,
      NULL as card_number,
      0 as is_rookie,
      0 as is_autograph,
      0 as is_relic,
      CASE WHEN s.parallel_of_series IS NOT NULL THEN 1 ELSE 0 END as is_parallel,
      CASE
        WHEN s.name = '${escapeSqlLike(searchTerms.join(' '))}' COLLATE Latin1_General_CI_AI THEN 100
        WHEN s.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI THEN 85
        ELSE 70
      END + CASE WHEN st.year = ${tokens.year || 0} THEN 10 ELSE 0 END as relevance
    FROM series s
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color c ON s.color = c.color_id
    WHERE (${buildMultiTermWhereOr(['name'], 's.')} OR ${buildMultiTermWhereOr(['name'], 'st.')} OR ${buildMultiTermWhereOr(['name'], 'm.')})
      ${yearFilter}

    ORDER BY relevance DESC, card_count DESC
  `

  console.log('Executing unified search query...')
  const startTime = Date.now()

  const results = await prisma.$queryRawUnsafe(sql)

  const queryTime = Date.now() - startTime
  console.log(`Unified query returned ${results.length} results in ${queryTime}ms`)

  return { results, queryTime }
}

// ============================================================================
// CARD SEARCH - Second query only if needed
// ============================================================================

async function executeCardSearch(tokens, entityResults, limit = 30, includeCards = false) {
  // Only search cards if:
  // 1. We have specific card filters (card number, type, serial)
  // 2. The caller explicitly requested cards
  const hasCardFilters = tokens.cardNumber ||
                         tokens.cardTypes.rookie ||
                         tokens.cardTypes.autograph ||
                         tokens.cardTypes.relic ||
                         tokens.serialNumber

  // Skip card search unless explicitly requested or we have card-specific filters
  if (!hasCardFilters && !includeCards) {
    return { results: [], queryTime: 0 }
  }

  // Get player IDs for filtering - use top 5 player results sorted by relevance
  // This ensures we filter by the best matching players even with many results
  const playerResults = entityResults
    .filter(r => r.entity_type === 'player')
    .sort((a, b) => (b.relevance || 0) - (a.relevance || 0))
    .slice(0, 5) // Take top 5 matching players
  const hasPlayerResults = playerResults.length > 0

  const conditions = []

  // Player filter - now uses top matching players instead of requiring exactly 1-3 matches
  if (hasPlayerResults && hasCardFilters) {
    const playerIds = playerResults.map(p => p.id)
    conditions.push(`p.player_id IN (${playerIds.join(',')})`)
  }

  // Card number filter
  if (tokens.cardNumber) {
    conditions.push(`c.card_number LIKE '%${escapeSqlLike(tokens.cardNumber)}%'`)
  }

  // Card type filters
  if (tokens.cardTypes.rookie) conditions.push('c.is_rookie = 1')
  if (tokens.cardTypes.autograph) conditions.push('c.is_autograph = 1')
  if (tokens.cardTypes.relic) conditions.push('c.is_relic = 1')

  // Year filter
  if (tokens.year) {
    conditions.push(`st.year = ${tokens.year}`)
  }

  // Serial number filter
  if (tokens.serialNumber) {
    conditions.push(`c.print_run <= ${tokens.serialNumber}`)
  }

  if (conditions.length === 0) {
    return { results: [], queryTime: 0 }
  }

  const whereClause = conditions.join(' AND ')

  const sql = `
    SELECT TOP ${limit}
      'card' as entity_type,
      CAST(c.card_id AS VARCHAR(20)) as id,
      CONCAT('#', c.card_number, ' ', STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ')) as name,
      MIN(p.first_name) as first_name,
      MIN(p.last_name) as last_name,
      NULL as nick_name,
      NULL as slug,
      0 as card_count,
      0 as is_hof,
      st.year,
      st.name as set_name,
      st.slug as set_slug,
      s.name as series_name,
      s.slug as series_slug,
      m.name as manufacturer_name,
      NULL as abbreviation,
      NULL as city,
      NULL as primary_color,
      NULL as secondary_color,
      col.name as color_name,
      col.hex_value as color_hex,
      c.print_run,
      c.card_number,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      CASE WHEN s.parallel_of_series IS NOT NULL THEN 1 ELSE 0 END as is_parallel,
      ${tokens.cardNumber ? '105' : '85'} as relevance
    FROM card c
    JOIN series s ON c.series = s.series_id
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE ${whereClause}
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, s.slug, s.parallel_of_series, st.name, st.slug, st.year, m.name, col.name, col.hex_value
    ORDER BY st.year DESC, c.card_number
  `

  console.log('Executing card search query...')
  const startTime = Date.now()

  const results = await prisma.$queryRawUnsafe(sql)

  const queryTime = Date.now() - startTime
  console.log(`Card query returned ${results.length} results in ${queryTime}ms`)

  return { results, queryTime }
}

// ============================================================================
// RESULT FORMATTING
// ============================================================================

function formatResults(rawResults) {
  return rawResults.map(row => {
    const base = {
      type: row.entity_type,
      name: row.name,
      relevance: row.relevance
    }

    switch (row.entity_type) {
      case 'player':
        return {
          ...base,
          player_id: Number(row.id),
          first_name: row.first_name,
          last_name: row.last_name,
          nick_name: row.nick_name,
          slug: row.slug,
          card_count: row.card_count,
          is_hof: !!row.is_hof,
          teams: [] // Could fetch in a second query if needed
        }

      case 'team':
        return {
          ...base,
          team_id: Number(row.id),
          slug: row.slug,
          abbreviation: row.abbreviation,
          city: row.city,
          primary_color: row.primary_color,
          secondary_color: row.secondary_color,
          player_count: row.card_count
        }

      case 'set':
        return {
          ...base,
          set_id: Number(row.id),
          slug: row.slug,
          year: row.year,
          manufacturer_name: row.manufacturer_name
        }

      case 'series':
        return {
          ...base,
          series_id: Number(row.id),
          slug: row.series_slug,
          series_name: row.series_name,
          set_name: row.set_name,
          set_slug: row.set_slug,
          year: row.year,
          manufacturer_name: row.manufacturer_name,
          color_name: row.color_name,
          color_hex: row.color_hex,
          card_count: row.card_count,
          print_run: row.print_run,
          is_parallel: !!row.is_parallel
        }

      case 'card':
        return {
          ...base,
          card_id: Number(row.id),
          card_number: row.card_number,
          series_name: row.series_name,
          series_slug: row.series_slug,
          set_name: row.set_name,
          set_slug: row.set_slug,
          year: row.year,
          manufacturer_name: row.manufacturer_name,
          color_name: row.color_name,
          color_hex: row.color_hex,
          print_run: row.print_run ? Number(row.print_run) : null,
          is_rookie: !!row.is_rookie,
          is_autograph: !!row.is_autograph,
          is_relic: !!row.is_relic,
          is_parallel: !!row.is_parallel
        }

      default:
        return base
    }
  })
}

// ============================================================================
// API ENDPOINT
// ============================================================================

router.get('/universal-v3', async (req, res) => {
  const startTime = Date.now()

  try {
    const { q: query, limit = 50, includeCards = 'false' } = req.query
    const shouldIncludeCards = includeCards === 'true'

    console.log('\n' + '='.repeat(60))
    console.log('SEARCH V3 REQUEST (Unified Query)')
    console.log('='.repeat(60))
    console.log('Query:', query)
    console.log('Include cards:', shouldIncludeCards)

    if (!query || query.trim().length < 2) {
      return res.json({
        results: [],
        message: 'Query too short',
        searchTime: Date.now() - startTime,
        version: 'v3-unified'
      })
    }

    // Phase 1: Parse query (no DB calls)
    const tokens = parseQueryTokens(query.trim())
    console.log('Parsed tokens:', JSON.stringify(tokens, null, 2))

    // Phase 2: Execute unified entity search (1 DB call)
    const entitySearch = await executeWithRetry(async () => {
      return await executeUnifiedSearch(query, tokens, parseInt(limit))
    })

    // Phase 3: Execute card search if warranted (0-1 DB calls)
    const cardSearch = await executeWithRetry(async () => {
      return await executeCardSearch(tokens, entitySearch.results, 20, shouldIncludeCards)
    })

    // Phase 4: Combine and format results
    const allResults = [...entitySearch.results, ...cardSearch.results]
    const formattedResults = formatResults(allResults)

    // Sort by relevance
    formattedResults.sort((a, b) => b.relevance - a.relevance)

    const totalTime = Date.now() - startTime

    console.log('='.repeat(60))
    console.log('SEARCH V3 COMPLETE')
    console.log(`Total time: ${totalTime}ms (entity: ${entitySearch.queryTime}ms, cards: ${cardSearch.queryTime}ms)`)
    console.log(`Results: ${formattedResults.length}`)
    console.log('='.repeat(60) + '\n')

    res.json({
      query: query.trim(),
      results: formattedResults.slice(0, parseInt(limit)),
      totalResults: formattedResults.length,
      searchTime: totalTime,
      breakdown: {
        entityQueryTime: entitySearch.queryTime,
        cardQueryTime: cardSearch.queryTime,
        dbRoundTrips: cardSearch.queryTime > 0 ? 2 : 1
      },
      version: 'v3-unified'
    })

  } catch (error) {
    console.error('Search V3 error:', error)
    res.status(500).json({
      error: 'Search failed',
      details: error.message,
      searchTime: Date.now() - startTime,
      version: 'v3-unified'
    })
  }
})

// Health check
router.get('/v3-health', (req, res) => {
  res.json({
    status: 'OK',
    version: 'v3-unified',
    description: 'Unified SQL query approach - minimal DB round trips'
  })
})

module.exports = router
