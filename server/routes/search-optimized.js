const express = require('express')
const { prisma, executeWithRetry } = require('../config/prisma-singleton')

const router = express.Router()

// Helper function to generate URL slug from name
function generateSlug(name) {
  if (!name) return 'unknown'
  return name
    .toLowerCase()
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// Comprehensive card number detection based on actual database patterns
function detectCardNumber(query) {
  const trimmedQuery = query.trim()
  
  // Test various card number patterns in order of specificity
  const patterns = [
    // Hyphenated formats (most specific first)
    // Complex multi-segment: T87C2-39, 88ASA-VGO, IAJP-CR, 06AGA-CPJ, BTPA-74
    {
      regex: /^([A-Z0-9]{2,}[A-Z]{1,3}-[A-Z0-9]{1,3})\s*/i,
      name: 'Complex hyphenated'
    },
    // Standard hyphenated: BD-9, BDC-171, CPA-JDL, BSA-SO, RA-NP, U-78
    {
      regex: /^([A-Z]{1,4}-[A-Z0-9]{1,4})\s*/i,
      name: 'Standard hyphenated'
    },
    // Simple hyphenated: A-1, B-9, M-17
    {
      regex: /^([A-Z]-\d{1,3})\s*/i,
      name: 'Simple hyphenated'
    },
    
    // Alphanumeric without hyphens
    // Letters + numbers: US110, US300, H78, H123, USC60
    {
      regex: /^([A-Z]{1,4}\d{1,4}[A-Z]?)\s*/i,
      name: 'Letters + numbers'
    },
    // Numbers + letters: 1T, 10T, 57b, 141b
    {
      regex: /^(\d{1,4}[A-Z]{1,2})\s*/i,
      name: 'Numbers + letters'
    },
    
    // Pure numbers (least specific, check last)
    // 1, 10, 100, 147, 600, etc.
    {
      regex: /^(\d{1,4})\s*/,
      name: 'Pure numbers'
    }
  ]
  
  for (const pattern of patterns) {
    const match = trimmedQuery.match(pattern.regex)
    if (match) {
      const cardNumber = match[1]
      const remainingText = trimmedQuery.substring(match[0].length).trim()
      
      console.log(`Matched pattern "${pattern.name}" for "${cardNumber}", remaining: "${remainingText}"`)
      
      return {
        cardNumber: cardNumber,
        remainingText: remainingText,
        patternType: pattern.name
      }
    }
  }
  
  return null
}

// Analyze search query to detect patterns and intent
function analyzeSearchQuery(query) {
  const patterns = {
    cardNumber: null,
    playerName: null,
    cardNumberWithPlayer: false,
    cardTypes: [],
    yearRange: null,
    teamIndicators: [],
    qualifiers: []
  }
  
  const lowerQuery = query.toLowerCase()
  
  // Comprehensive card number detection based on actual database patterns
  const cardNumberMatch = detectCardNumber(query)
  console.log(`Card number detection for "${query}":`, cardNumberMatch)
  
  if (cardNumberMatch) {
    patterns.cardNumber = cardNumberMatch.cardNumber
    
    // Check if there's a player name after the card number
    const remainingText = cardNumberMatch.remainingText
    console.log(`Remaining text after card number "${cardNumberMatch.cardNumber}":`, `"${remainingText}"`)
    if (remainingText.length > 0) {
      patterns.playerName = remainingText
      patterns.cardNumberWithPlayer = true
    }
  }
  
  // Detect card types
  if (lowerQuery.includes('rookie') || lowerQuery.includes('rc')) {
    patterns.cardTypes.push('rookie')
  }
  if (lowerQuery.includes('autograph') || lowerQuery.includes('auto')) {
    patterns.cardTypes.push('autograph')
  }
  if (lowerQuery.includes('relic') || lowerQuery.includes('jersey') || lowerQuery.includes('patch')) {
    patterns.cardTypes.push('relic')
  }
  if (lowerQuery.includes('parallel') || lowerQuery.includes('/')) {
    patterns.cardTypes.push('parallel')
  }
  
  // Detect years
  const yearRegex = /\b(19|20)\d{2}\b/
  const yearMatch = query.match(yearRegex)
  if (yearMatch) {
    patterns.yearRange = parseInt(yearMatch[0])
  }
  
  // Detect team abbreviations
  const teamAbbrevs = ['bos', 'nyy', 'laa', 'tor', 'tb', 'bal', 'cws', 'cle', 'det', 'kc', 'min', 'hou', 'oak', 'sea', 'tex']
  teamAbbrevs.forEach(abbrev => {
    if (lowerQuery.includes(abbrev)) {
      patterns.teamIndicators.push(abbrev)
    }
  })
  
  return patterns
}

/**
 * OPTIMIZED UNIVERSAL SEARCH WITH INTELLIGENT PATTERN RECOGNITION
 * Combines the pattern recognition logic from original search with consolidated queries
 * This reduces database connections from 6 to 1-3 per search depending on patterns
 */
router.get('/universal', async (req, res) => {
  try {
    const { q: query, limit = 50, category = 'all' } = req.query
    
    console.log('Optimized search request:', { query, limit, category })
    
    if (!query || query.trim().length < 2) {
      return res.json({ results: [], suggestions: [] })
    }

    const searchQuery = query.trim()
    
    // Execute with retry logic for connection pool issues
    const results = await executeWithRetry(async () => {
      return await performIntelligentConsolidatedSearch(searchQuery, parseInt(limit), category)
    })
    
    res.json({
      query: searchQuery,
      results,
      totalResults: results.length,
      searchTime: Date.now()
    })
    
  } catch (error) {
    console.error('Optimized search error:', error)
    res.status(500).json({ 
      error: 'Search failed', 
      details: error.message 
    })
  }
})

/**
 * INTELLIGENT CONSOLIDATED SEARCH
 * Uses pattern recognition to determine which searches to run, then consolidates queries
 */
async function performIntelligentConsolidatedSearch(query, limit, category) {
  const results = []
  
  try {
    // Smart pattern recognition (same as original search)
    const patterns = analyzeSearchQuery(query)
    console.log('Search patterns detected for query "' + query + '":', patterns)
    
    // Execute searches based on detected patterns with higher limits to ensure variety
    const searchLimit = Math.min(limit * 2, 30) // Get more results to filter and rank
    
    // Build consolidated queries based on detected patterns
    const queries = []
    
    if (category === 'all' || category === 'cards') {
      // Card number + player name pattern (e.g., "108 trout", "RC-1 rookie")
      if (patterns.cardNumberWithPlayer) {
        queries.push(buildCardsByNumberAndPlayerQuery(patterns.cardNumber, patterns.playerName, searchLimit))
      }
      
      // Pure card number search
      else if (patterns.cardNumber && !patterns.playerName) {
        queries.push(buildCardsByNumberQuery(patterns.cardNumber, searchLimit))
      }
      
      // Card type searches (rookie, autograph, relic)
      if (patterns.cardTypes.length > 0) {
        queries.push(buildCardsByTypeQuery(patterns.cardTypes, patterns.playerName, searchLimit))
      }
    }
    
    if (category === 'all' || category === 'players') {
      // Player name search (full name, partial, nickname)
      queries.push(buildPlayersQuery(query, searchLimit))
    }
    
    if (category === 'all' || category === 'teams') {
      // Team search (name, city, abbreviation)
      queries.push(buildTeamsQuery(query, searchLimit))
    }
    
    if (category === 'all' || category === 'series') {
      // Series and set search
      queries.push(buildSeriesQuery(query, searchLimit))
    }
    
    // Execute consolidated query if we have any queries
    if (queries.length > 0) {
      const consolidatedResults = await executeConsolidatedQuery(queries, limit)
      results.push(...consolidatedResults)
    }
    
    // Remove duplicates and sort by relevance (same logic as original)
    const uniqueResults = removeDuplicates(results)
    return rankResults(uniqueResults, query).slice(0, limit)
    
  } catch (error) {
    console.error('Intelligent consolidated search error:', error)
    return []
  }
}

/**
 * CONSOLIDATED QUERY EXECUTOR
 * Combines multiple queries into a single UNION ALL query
 */
async function executeConsolidatedQuery(queries, limit) {
  try {
    // Combine all queries with UNION ALL if we have multiple
    let finalQuery = ''
    if (queries.length === 0) {
      return []
    } else if (queries.length === 1) {
      finalQuery = queries[0]
    } else {
      finalQuery = queries.join(' UNION ALL ')
    }
    
    // Wrap in outer query to sort by relevance and limit total results
    finalQuery = `
      SELECT TOP ${limit} *
      FROM (
        ${finalQuery}
      ) AS combined_results
      ORDER BY relevance_score DESC, primary_text ASC
    `
    
    console.log('Executing consolidated search query...')
    const startTime = Date.now()
    
    const results = await prisma.$queryRawUnsafe(finalQuery)
    
    const queryTime = Date.now() - startTime
    console.log(`Consolidated search completed in ${queryTime}ms, found ${results.length} results`)
    
    // Format results based on type
    return results.map(row => formatSearchResult(row))
    
  } catch (error) {
    console.error('Consolidated query execution error:', error)
    throw error
  }
}

// Query builders that match the original search logic but return SQL strings
function buildCardsByNumberAndPlayerQuery(cardNumber, playerName, limit) {
  const cardPattern = `%${cardNumber}%`
  const playerPattern = `%${playerName}%`
  
  // Split player name for component matching
  const nameParts = playerName.split(' ')
  const firstName = nameParts[0]
  const lastName = nameParts.slice(1).join(' ')
  
  return `
    SELECT TOP ${limit}
      'card' as result_type,
      CAST(c.card_id as varchar) as entity_id,
      c.card_number as primary_text,
      s.name as secondary_text,
      ISNULL(STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', '), 'Unknown Player') as tertiary_text,
      CASE 
        WHEN c.card_number = '${cardNumber}' THEN 100
        WHEN c.card_number LIKE '${cardPattern}' THEN 95
        ELSE 90
      END as relevance_score,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      col.hex_value as color_hex,
      col.name as color_name
    FROM card c
    JOIN series s ON c.series = s.series_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE c.card_number LIKE '${cardPattern}'
      AND (
        -- Name combinations (most likely matches)
        CONCAT(p.first_name, ' ', p.last_name) LIKE '${playerPattern}'
        OR CONCAT(p.nick_name, ' ', p.last_name) LIKE '${playerPattern}' 
        OR CONCAT(p.first_name, ' ', p.nick_name, ' ', p.last_name) LIKE '${playerPattern}'
        OR p.nick_name LIKE '${playerPattern}'
        -- Individual name components (for partial matches)
        OR (p.first_name LIKE '%${firstName}%' COLLATE Latin1_General_CI_AI AND p.last_name LIKE '%${lastName}%' COLLATE Latin1_General_CI_AI)
      )
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, s.series_id, col.name, col.hex_value
  `
}

function buildCardsByNumberQuery(cardNumber, limit) {
  const cardPattern = `%${cardNumber}%`
  
  return `
    SELECT TOP ${limit}
      'card' as result_type,
      CAST(c.card_id as varchar) as entity_id,
      c.card_number as primary_text,
      s.name as secondary_text,
      ISNULL(STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', '), 'Unknown Player') as tertiary_text,
      CASE 
        WHEN c.card_number = '${cardNumber}' THEN 100
        ELSE 85
      END as relevance_score,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      col.hex_value as color_hex,
      col.name as color_name
    FROM card c
    JOIN series s ON c.series = s.series_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE c.card_number LIKE '${cardPattern}'
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, s.series_id, col.name, col.hex_value
  `
}

function buildCardsByTypeQuery(cardTypes, playerName, limit) {
  const typeConditions = []
  if (cardTypes.includes('rookie')) typeConditions.push('c.is_rookie = 1')
  if (cardTypes.includes('autograph')) typeConditions.push('c.is_autograph = 1')
  if (cardTypes.includes('relic')) typeConditions.push('c.is_relic = 1')
  
  const typeConditionsSql = typeConditions.length > 0 ? typeConditions.join(' OR ') : '1=0'
  
  const playerCondition = playerName ? 
    `AND (p.first_name LIKE '%${playerName}%' COLLATE Latin1_General_CI_AI OR p.last_name LIKE '%${playerName}%' COLLATE Latin1_General_CI_AI OR p.nick_name LIKE '%${playerName}%' COLLATE Latin1_General_CI_AI)` : 
    ''

  return `
    SELECT TOP ${limit}
      'card' as result_type,
      CAST(c.card_id as varchar) as entity_id,
      c.card_number as primary_text,
      s.name as secondary_text,
      ISNULL(STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', '), 'Unknown Player') as tertiary_text,
      90 as relevance_score,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.print_run,
      col.hex_value as color_hex,
      col.name as color_name
    FROM card c
    JOIN series s ON c.series = s.series_id
    LEFT JOIN color col ON s.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE (${typeConditionsSql}) ${playerCondition}
    GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
             s.name, s.series_id, col.name, col.hex_value
  `
}

function buildPlayersQuery(query, limit) {
  const searchPattern = `%${query}%`
  
  console.log('Building players query for:', query, 'with pattern:', searchPattern)
  
  // Simplified query matching the original search structure  
  const sqlQuery = `
    SELECT TOP ${limit}
      'player' as result_type,
      CAST(p.player_id as varchar) as entity_id,
      CONCAT(p.first_name, ' ', p.last_name) as primary_text,
      ISNULL(p.nick_name, '') as secondary_text,
      CONCAT(CAST(ISNULL(p.card_count, 0) as varchar), ' cards') as tertiary_text,
      75 as relevance_score,
      0 as is_rookie,
      0 as is_autograph,
      0 as is_relic,
      NULL as print_run,
      NULL as color_hex,
      NULL as color_name
    FROM player p
    WHERE p.first_name LIKE '${searchPattern}'
       OR p.last_name LIKE '${searchPattern}'
       OR p.nick_name LIKE '${searchPattern}'
       OR CONCAT(p.first_name, ' ', p.last_name) LIKE '${searchPattern}'
    ORDER BY p.card_count DESC
  `
  
  console.log('Generated SQL query:', sqlQuery)
  return sqlQuery
}

function buildTeamsQuery(query, limit) {
  const searchPattern = `%${query}%`
  
  return `
    SELECT TOP ${limit}
      'team' as result_type,
      CAST(t.team_id as varchar) as entity_id,
      t.name as primary_text,
      t.city as secondary_text,
      ISNULL(o.name, 'Unknown Organization') as tertiary_text,
      85 as relevance_score,
      0 as is_rookie,
      0 as is_autograph,
      0 as is_relic,
      NULL as print_run,
      t.primary_color as color_hex,
      NULL as color_name
    FROM team t
    LEFT JOIN organization o ON t.organization = o.organization_id
    WHERE t.name LIKE '${searchPattern}'
       OR t.city LIKE '${searchPattern}'
       OR t.abbreviation LIKE '${searchPattern}'
       OR t.mascot LIKE '${searchPattern}'
  `
}

function buildSeriesQuery(query, limit) {
  const searchPattern = `%${query}%`
  
  return `
    SELECT TOP ${limit}
      'series' as result_type,
      CAST(s.series_id as varchar) as entity_id,
      s.name as primary_text,
      st.name as secondary_text,
      CONCAT(CAST(ISNULL(s.card_count, 0) as varchar), ' cards') as tertiary_text,
      90 as relevance_score,
      0 as is_rookie,
      0 as is_autograph,
      0 as is_relic,
      s.min_print_run as print_run,
      col.hex_value as color_hex,
      col.name as color_name
    FROM series s
    JOIN [set] st ON s.[set] = st.set_id
    LEFT JOIN color col ON s.color = col.color_id
    WHERE s.name LIKE '${searchPattern}'
       OR st.name LIKE '${searchPattern}'
  `
}

/**
 * Format search results based on entity type to match original search format
 */
function formatSearchResult(row) {
  const baseResult = {
    type: row.result_type,
    id: row.entity_id,
    title: row.primary_text,
    subtitle: row.secondary_text || '',
    description: row.tertiary_text || '',
    relevanceScore: Number(row.relevance_score),
    data: {
      id: row.entity_id
    }
  }
  
  // Add type-specific data to match original search format
  switch (row.result_type) {
    case 'card':
      // Format card title like original: "#123 Player Name • Series Name"
      baseResult.title = `#${row.primary_text} ${row.tertiary_text} • ${row.secondary_text}`
      baseResult.data = {
        card_id: row.entity_id,
        card_number: row.primary_text,
        is_rookie: Boolean(row.is_rookie),
        is_autograph: Boolean(row.is_autograph),
        is_relic: Boolean(row.is_relic),
        print_run: row.print_run ? Number(row.print_run) : null,
        series_name: row.secondary_text,
        player_names: row.tertiary_text,
        color_name: row.color_name,
        color_hex: row.color_hex,
        // Add navigation slugs
        series_slug: generateSlug(row.secondary_text),
        player_slug: generateSlug(row.tertiary_text)
      }
      break
      
    case 'player':
      // Format player title like original: "First Last" or "First 'Nick' Last"  
      const playerName = row.primary_text
      const nickname = row.secondary_text
      baseResult.title = nickname ? `${playerName.split(' ')[0]} "${nickname}" ${playerName.split(' ').slice(1).join(' ')}` : playerName
      baseResult.data = {
        player_id: row.entity_id,
        first_name: playerName.split(' ')[0],
        last_name: playerName.split(' ').slice(1).join(' '),
        nick_name: nickname || null,
        card_count: Number(row.tertiary_text.replace(' cards', '')) || 0,
        teams: []
      }
      break
      
    case 'team':
      baseResult.title = row.primary_text
      baseResult.data = {
        team_id: row.entity_id,
        name: row.primary_text,
        city: row.secondary_text,
        organization_name: row.tertiary_text,
        primary_color: row.color_hex,
        card_count: 0,
        player_count: 0
      }
      break
      
    case 'series':
      baseResult.title = row.primary_text
      baseResult.data = {
        series_id: row.entity_id,
        name: row.primary_text,
        series_name: row.primary_text,
        set_name: row.secondary_text,
        card_count: Number(row.tertiary_text.replace(' cards', '')) || 0,
        color_name: row.color_name,
        color_hex_value: row.color_hex,
        color_hex: row.color_hex,
        // Add navigation slugs
        slug: generateSlug(row.primary_text),
        series_slug: generateSlug(row.primary_text),
        set_slug: generateSlug(row.secondary_text)
      }
      break
  }
  
  return baseResult
}

// Helper functions from original search
function removeDuplicates(results) {
  const seen = new Set()
  return results.filter(result => {
    const key = `${result.type}-${result.id}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function rankResults(results, query) {
  return results.sort((a, b) => {
    // Primary sort by relevance score
    if (b.relevanceScore !== a.relevanceScore) {
      return b.relevanceScore - a.relevanceScore
    }
    
    // Secondary sort by type priority (cards > players > teams > series)
    const typePriority = { card: 4, player: 3, team: 2, series: 1 }
    return (typePriority[b.type] || 0) - (typePriority[a.type] || 0)
  })
}

module.exports = router
