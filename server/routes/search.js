const express = require('express')
const { prisma, executeWithRetry } = require('../config/prisma-singleton')

const router = express.Router()

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

// Helper function to escape SQL special characters for LIKE queries
// In SQL Server, single quotes must be escaped by doubling them
function escapeSqlLike(str) {
  if (!str) return ''
  return str.replace(/'/g, "''") // Double single quotes for SQL Server
}

// Initialize Prisma with error handling for production
let databaseAvailable = false

try {
  databaseAvailable = true
  console.log('✅ Database connection initialized for search routes')
} catch (error) {
  console.error('❌ Database connection failed for search routes:', error.message)
  console.error('   Prisma client may not be generated. This should be done during build.')
  databaseAvailable = false
}

// Health check endpoint for search routes
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    route: 'search',
    timestamp: new Date().toISOString(),
    databaseAvailable: databaseAvailable
  })
})

// Universal search endpoint with intelligent entity recognition
router.get('/universal', async (req, res) => {
  try {
    const { q: query, limit = 50, category = 'all' } = req.query
    
    console.log('Search request:', { query, limit, category })
    
    if (!query || query.trim().length < 2) {
      return res.json({ results: [], suggestions: [] })
    }

    // Check if database is available
    if (!databaseAvailable) {
      return res.json({
        results: [],
        suggestions: ['Database temporarily unavailable'],
        message: 'Search service is temporarily unavailable'
      })
    }

    const searchQuery = query.trim()
    const results = await executeWithRetry(async () => {
      return await performIntelligentSearch(searchQuery, parseInt(limit), category)
    })
    
    res.json({
      query: searchQuery,
      results,
      totalResults: results.length,
      searchTime: Date.now()
    })
    
  } catch (error) {
    console.error('Universal search error:', error)
    res.status(500).json({ 
      error: 'Search failed', 
      details: error.message 
    })
  }
})

// Intelligent search function that recognizes different patterns
async function performIntelligentSearch(query, limit, category) {
  const results = []
  
  try {
    // Smart pattern recognition
    const patterns = analyzeSearchQuery(query)
    console.log('Search patterns detected for query "' + query + '":', patterns)
    
    // Execute searches based on detected patterns with higher limits to ensure variety
    const searchLimit = Math.min(limit * 2, 30) // Get more results to filter and rank
    
    if (category === 'all' || category === 'cards') {
      // Card number + player name pattern (e.g., "108 bieber", "RC-1 rookie")
      if (patterns.cardNumberWithPlayer) {
        const cardResults = await searchCardsByNumberAndPlayer(patterns.cardNumber, patterns.playerName, searchLimit)
        results.push(...cardResults)
      }
      
      // Pure card number search
      else if (patterns.cardNumber && !patterns.playerName) {
        const cardResults = await searchCardsByNumber(patterns.cardNumber, searchLimit)
        results.push(...cardResults)
      }
      
      // Card type searches (rookie, autograph, relic)
      if (patterns.cardTypes.length > 0) {
        const typeResults = await searchCardsByType(patterns.cardTypes, patterns.playerName, searchLimit)
        results.push(...typeResults)
      }
    }
    
    if (category === 'all' || category === 'players') {
      // Player name search (full name, partial, nickname)
      console.log('Calling searchPlayers with:', query, searchLimit)
      const playerResults = await searchPlayers(query, searchLimit)
      console.log('searchPlayers returned:', playerResults.length, 'results')
      results.push(...playerResults)
    }
    
    if (category === 'all' || category === 'teams') {
      // Team search (name, city, abbreviation)
      const teamResults = await searchTeams(query, searchLimit)
      results.push(...teamResults)
    }
    
    if (category === 'all' || category === 'series') {
      // Series and set search
      const seriesResults = await searchSeries(query, searchLimit)
      results.push(...seriesResults)
    }
    
    // Remove duplicates and sort by relevance
    const uniqueResults = removeDuplicates(results)
    return rankResults(uniqueResults, query).slice(0, limit)
    
  } catch (error) {
    console.error('Search execution error:', error)
    return []
  }
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

// Search cards by number and player name using raw SQL with fallback logic
async function searchCardsByNumberAndPlayer(cardNumber, playerName, limit) {
  try {
    console.log(`Searching cards by number "${cardNumber}" and player "${playerName}"`)

    const cardPattern = `%${escapeSqlLike(cardNumber)}%`
    const playerPattern = `%${escapeSqlLike(playerName)}%`
    const playerPatternNoApostrophe = `%${escapeSqlLike(playerName.replace(/'/g, ''))}%`

    console.log(`Card pattern: "${cardPattern}", Player pattern: "${playerPattern}"`)

    // Split player name for component matching
    const nameParts = playerName.split(' ')
    const firstName = escapeSqlLike(nameParts[0])
    const lastName = escapeSqlLike(nameParts.slice(1).join(' '))
    const firstNameNoApostrophe = escapeSqlLike(nameParts[0].replace(/'/g, ''))
    const lastNameNoApostrophe = escapeSqlLike(nameParts.slice(1).join(' ').replace(/'/g, ''))
    console.log(`Name parts: first="${firstName}", last="${lastName}"`)
    
    // Try the combined search first (card number + player name)
    const combinedResults = await prisma.$queryRawUnsafe(`
      SELECT TOP ${Math.floor(limit * 0.7)}
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.name as series_name,
        s.slug as series_slug,
        st.name as set_name,
        st.slug as set_slug,
        st.year as set_year,
        m.name as manufacturer_name,
        s.parallel_of_series,
        col.name as color_name,
        col.hex_value as color_hex,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
        STRING_AGG(CONVERT(varchar(max), CONCAT(p.slug, '|', p.first_name, ' ', p.last_name)), '~') as players_slugs_data,
        STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''), '|', ISNULL(t.slug, ''))), '~') as teams_data
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN color col ON s.color = col.color_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE c.card_number LIKE '${cardPattern}'
        AND (
          -- Name combinations (most likely matches) - with apostrophes
          CONCAT(p.first_name, ' ', p.last_name) LIKE '${playerPattern}' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.nick_name, ' ', p.last_name) LIKE '${playerPattern}' COLLATE Latin1_General_CI_AI
          OR CONCAT(p.first_name, ' ', p.nick_name, ' ', p.last_name) LIKE '${playerPattern}' COLLATE Latin1_General_CI_AI
          OR p.nick_name LIKE '${playerPattern}' COLLATE Latin1_General_CI_AI
          -- Individual name components (for partial matches) - with apostrophes
          OR (p.first_name LIKE '%${firstName}%' COLLATE Latin1_General_CI_AI AND p.last_name LIKE '%${lastName}%' COLLATE Latin1_General_CI_AI)
          -- Name combinations (without apostrophes) - handles "oconnell" matching "o'connell"
          OR REPLACE(CONCAT(p.first_name, ' ', p.last_name), '''', '') LIKE '${playerPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
          OR REPLACE(CONCAT(p.nick_name, ' ', p.last_name), '''', '') LIKE '${playerPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
          OR (REPLACE(p.first_name, '''', '') LIKE '%${firstNameNoApostrophe}%' COLLATE Latin1_General_CI_AI AND REPLACE(p.last_name, '''', '') LIKE '%${lastNameNoApostrophe}%' COLLATE Latin1_General_CI_AI)
        )
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
               s.name, s.slug, st.name, st.slug, st.year, m.name, s.parallel_of_series, col.name, col.hex_value
      ORDER BY
        CASE WHEN c.card_number = '${escapeSqlLike(cardNumber)}' THEN 0 ELSE 1 END,  -- Exact matches first
        s.name,  -- Then series name
        STRING_AGG(p.last_name, ', ')  -- Then player last name
    `)

    console.log(`Found ${combinedResults.length} cards for exact "${cardNumber} ${playerName}" match`)
    
    // If we have good results from the combined search, return them
    if (combinedResults.length >= 5) {
      return combinedResults.map(card => formatCardResult(card, 95))
    }
    
    // Otherwise, implement fallback search strategy
    console.log(`Combined search returned few results (${combinedResults.length}), implementing fallback strategy...`)
    
    const fallbackResults = []
    
    // Add any combined results we did find (highest relevance)
    fallbackResults.push(...combinedResults.map(card => formatCardResult(card, 95)))
    
    // Search for cards with the card number pattern (regardless of player)
    const cardOnlyResults = await searchCardsByNumber(cardNumber, Math.floor(limit * 0.4))
    console.log(`Fallback: Found ${cardOnlyResults.length} cards with number "${cardNumber}"`)
    
    // Add card-only results with lower relevance score
    fallbackResults.push(...cardOnlyResults.map(result => ({
      ...result,
      relevanceScore: 75, // Lower than exact matches
      title: `${result.title} (Card #${cardNumber})`
    })))
    
    // Search for the player (regardless of card number)
    const playerOnlyResults = await searchPlayers(playerName, Math.floor(limit * 0.3))
    console.log(`Fallback: Found ${playerOnlyResults.length} players matching "${playerName}"`)
    
    // Add player results with moderate relevance
    fallbackResults.push(...playerOnlyResults.map(result => ({
      ...result,
      relevanceScore: 80, // Between card-only and exact matches
      title: `${result.title} (Player)`
    })))
    
    console.log(`Fallback search total: ${fallbackResults.length} results`)
    
    // Remove duplicates and limit results
    return removeDuplicates(fallbackResults).slice(0, limit)
    
  } catch (error) {
    console.error('Card number + player search error:', error)
    return []
  }
}

// Helper function to format card results consistently
function formatCardResult(card, relevanceScore) {
  // Parse teams data from STRING_AGG result
  let primaryTeam = null
  if (card.teams_data) {
    const teamStrings = card.teams_data.split('~')
    const firstTeam = teamStrings[0]
    if (firstTeam) {
      const [team_id, name, abbreviation, primary_color, secondary_color, slug] = firstTeam.split('|')
      if (team_id) {
        primaryTeam = {
          team_id: Number(team_id),
          name: name || null,
          abbreviation: abbreviation || null,
          primary_color: primary_color || null,
          secondary_color: secondary_color || null,
          slug: slug || null  // Use stored slug from database
        }
      }
    }
  }

  // Parse player slugs data
  let playerSlug = null
  if (card.players_slugs_data) {
    const firstPlayerSlug = card.players_slugs_data.split('~')[0]
    if (firstPlayerSlug) {
      playerSlug = firstPlayerSlug.split('|')[0]
    }
  }

  return {
    type: 'card',
    id: card.card_id.toString(),
    title: `#${card.card_number} ${card.player_names || 'Unknown Player'} • ${card.series_name}`,
    subtitle: null,
    description: null,
    relevanceScore: relevanceScore,
    data: {
      card_id: card.card_id.toString(),
      card_number: card.card_number,
      is_rookie: !!card.is_rookie,
      is_autograph: !!card.is_autograph,
      is_relic: !!card.is_relic,
      is_parallel: !!card.parallel_of_series,
      series_name: card.series_name,
      set_name: card.set_name,
      set_year: card.set_year ? Number(card.set_year) : null,
      manufacturer_name: card.manufacturer_name,
      parallel_of_series: card.parallel_of_series ? Number(card.parallel_of_series) : null,
      color_name: card.color_name,
      color_hex: card.color_hex,
      player_names: card.player_names,
      // Team data
      team_name: primaryTeam?.name,
      team_abbreviation: primaryTeam?.abbreviation,
      team_primary_color: primaryTeam?.primary_color,
      team_secondary_color: primaryTeam?.secondary_color,
      // Convert BigInt fields to numbers
      print_run: card.print_run ? Number(card.print_run) : null,
      serial_number: null, // Not available in database
      // Add navigation slugs for URLs (using stored database slugs)
      set_slug: card.set_slug,
      series_slug: card.series_slug,
      player_slug: playerSlug || 'unknown',
      card_number_slug: card.card_number ? card.card_number.toLowerCase().replace(/[^a-z0-9-]/g, '') : 'unknown',
      card_slug: `${card.card_number ? card.card_number.toLowerCase().replace(/[^a-z0-9-]/g, '') : 'unknown'}-${playerSlug || 'unknown'}`
    }
  }
}

// Search cards by number only using raw SQL
async function searchCardsByNumber(cardNumber, limit) {
  try {
    console.log(`Searching cards by number "${cardNumber}"`)

    const cardPattern = `%${escapeSqlLike(cardNumber)}%`
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.name as series_name,
        s.slug as series_slug,
        st.name as set_name,
        st.slug as set_slug,
        st.year as set_year,
        m.name as manufacturer_name,
        s.parallel_of_series,
        col.name as color_name,
        col.hex_value as color_hex,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
        STRING_AGG(CONVERT(varchar(max), CONCAT(p.slug, '|', p.first_name, ' ', p.last_name)), '~') as players_slugs_data,
        STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''), '|', ISNULL(t.slug, ''))), '~') as teams_data
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN color col ON s.color = col.color_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE c.card_number LIKE '${cardPattern}'
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
               s.name, s.slug, st.name, st.slug, st.year, m.name, s.parallel_of_series, col.name, col.hex_value
      ORDER BY
        CASE WHEN c.card_number = '${escapeSqlLike(cardNumber)}' THEN 0 ELSE 1 END,  -- Exact matches first
        s.name,  -- Then series name
        STRING_AGG(p.last_name, ', ')  -- Then player last name
    `)

    console.log(`Found ${results.length} cards for number "${cardNumber}"`)

    return results.map(card => {
      const relevanceScore = card.card_number === cardNumber ? 100 : 80
      return formatCardResult(card, relevanceScore)
    })
  } catch (error) {
    console.error('Card number search error:', error)
    return []
  }
}

// Search cards by type using raw SQL
async function searchCardsByType(cardTypes, playerName, limit) {
  try {
    console.log(`Searching cards by types ${cardTypes.join(', ')} ${playerName ? 'for player "' + playerName + '"' : ''}`)
    
    const typeConditions = []
    if (cardTypes.includes('rookie')) typeConditions.push('c.is_rookie = 1')
    if (cardTypes.includes('autograph')) typeConditions.push('c.is_autograph = 1')
    if (cardTypes.includes('relic')) typeConditions.push('c.is_relic = 1')
    
    const typeConditionsSql = typeConditions.length > 0 ? typeConditions.join(' OR ') : '1=0'

    const playerCondition = playerName ?
      `AND (
        p.first_name LIKE '%${escapeSqlLike(playerName)}%' COLLATE Latin1_General_CI_AI
        OR p.last_name LIKE '%${escapeSqlLike(playerName)}%' COLLATE Latin1_General_CI_AI
        OR p.nick_name LIKE '%${escapeSqlLike(playerName)}%' COLLATE Latin1_General_CI_AI
        OR REPLACE(p.first_name, '''', '') LIKE '%${escapeSqlLike(playerName.replace(/'/g, ''))}%' COLLATE Latin1_General_CI_AI
        OR REPLACE(p.last_name, '''', '') LIKE '%${escapeSqlLike(playerName.replace(/'/g, ''))}%' COLLATE Latin1_General_CI_AI
        OR REPLACE(p.nick_name, '''', '') LIKE '%${escapeSqlLike(playerName.replace(/'/g, ''))}%' COLLATE Latin1_General_CI_AI
      )` :
      ''

    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.name as series_name,
        s.slug as series_slug,
        st.name as set_name,
        st.slug as set_slug,
        st.year as set_year,
        m.name as manufacturer_name,
        s.parallel_of_series,
        col.name as color_name,
        col.hex_value as color_hex,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
        STRING_AGG(CONVERT(varchar(max), CONCAT(p.slug, '|', p.first_name, ' ', p.last_name)), '~') as players_slugs_data,
        STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''), '|', ISNULL(t.slug, ''))), '~') as teams_data
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN color col ON s.color = col.color_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE (${typeConditionsSql}) ${playerCondition}
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
               s.name, s.slug, st.name, st.slug, st.year, m.name, s.parallel_of_series, col.name, col.hex_value
    `)
    
    console.log(`Found ${results.length} cards for types ${cardTypes.join(', ')}`)
    
    return results.map(card => formatCardResult(card, 85))
  } catch (error) {
    console.error('Card type search error:', error)
    return []
  }
}

// Search players using raw SQL
async function searchPlayers(query, limit) {
  try {
    console.log('Searching players for:', query)

    const searchPattern = `%${escapeSqlLike(query)}%`
    const searchPatternNoApostrophe = `%${escapeSqlLike(query.replace(/'/g, ''))}%`
    console.log('Player search pattern:', searchPattern)
    console.log('Player search pattern (no apostrophe):', searchPatternNoApostrophe)

    // Check if query contains spaces (likely full name)
    const queryParts = query.trim().split(/\s+/)
    let whereClause = ''

    if (queryParts.length >= 2) {
      // Multi-word search - comprehensive fuzzy matching
      const firstName = escapeSqlLike(queryParts[0])
      const lastName = escapeSqlLike(queryParts.slice(1).join(' '))
      const firstNameNoApostrophe = escapeSqlLike(queryParts[0].replace(/'/g, ''))
      const lastNameNoApostrophe = escapeSqlLike(queryParts.slice(1).join(' ').replace(/'/g, ''))

      whereClause = `
        -- Name combinations (most likely matches first) - with apostrophes
        (CONCAT(first_name, ' ', last_name) LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI)
        OR (CONCAT(nick_name, ' ', last_name) LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI)
        OR (CONCAT(first_name, ' ', nick_name, ' ', last_name) LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI)
        OR nick_name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        -- Individual name components - with apostrophes
        OR (first_name LIKE '%${firstName}%' COLLATE Latin1_General_CI_AI AND last_name LIKE '%${lastName}%' COLLATE Latin1_General_CI_AI)
        OR (nick_name LIKE '%${firstName}%' COLLATE Latin1_General_CI_AI AND last_name LIKE '%${lastName}%' COLLATE Latin1_General_CI_AI)
        OR first_name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        OR last_name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        -- Name combinations (without apostrophes) - handles "oconnell" matching "o'connell"
        OR (REPLACE(CONCAT(first_name, ' ', last_name), '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI)
        OR (REPLACE(CONCAT(nick_name, ' ', last_name), '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI)
        OR (REPLACE(first_name, '''', '') LIKE '%${firstNameNoApostrophe}%' COLLATE Latin1_General_CI_AI AND REPLACE(last_name, '''', '') LIKE '%${lastNameNoApostrophe}%' COLLATE Latin1_General_CI_AI)
        OR REPLACE(first_name, '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
        OR REPLACE(last_name, '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
      `
    } else {
      // Single word search
      whereClause = `
        -- Individual fields and name combinations - with apostrophes
        first_name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        OR last_name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        OR nick_name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        OR CONCAT(first_name, ' ', last_name) LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        OR CONCAT(nick_name, ' ', last_name) LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        OR CONCAT(first_name, ' ', nick_name, ' ', last_name) LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
        -- Same searches without apostrophes - handles "oconnell" matching "o'connell"
        OR REPLACE(first_name, '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
        OR REPLACE(last_name, '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
        OR REPLACE(nick_name, '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
        OR REPLACE(CONCAT(first_name, ' ', last_name), '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
        OR REPLACE(CONCAT(nick_name, ' ', last_name), '''', '') LIKE '${searchPatternNoApostrophe}' COLLATE Latin1_General_CI_AI
      `
    }
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        p.player_id,
        p.first_name,
        p.last_name,
        p.nick_name,
        p.slug as player_slug,
        p.card_count,
        p.is_hof,
        STRING_AGG(CONVERT(varchar(max), CONCAT(t.team_Id, '|', t.name, '|', t.abbreviation, '|', ISNULL(t.primary_color, ''), '|', ISNULL(t.secondary_color, ''), '|', ISNULL(t.slug, ''))), '~') as teams_data
      FROM player p
      LEFT JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN team t ON pt.team = t.team_Id
      WHERE ${whereClause}
      GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.slug, p.card_count, p.is_hof
      ORDER BY p.card_count DESC
    `)
    
    console.log(`Found ${results.length} players for "${query}"`)
    
    return results.map(player => {
      // Parse teams data from STRING_AGG result
      let teams = []
      if (player.teams_data) {
        const teamStrings = player.teams_data.split('~')
        teams = teamStrings.map(teamStr => {
          const [team_id, name, abbreviation, primary_color, secondary_color, slug] = teamStr.split('|')
          return {
            team_id: Number(team_id),
            name: name || null,
            abbreviation: abbreviation || null,
            primary_color: primary_color || null,
            secondary_color: secondary_color || null,
            slug: slug || null  // Use stored slug from database
          }
        }).filter(team => team.team_id) // Filter out any malformed entries
      }

      const fullName = `${player.first_name}${player.nick_name ? ` "${player.nick_name}"` : ''} ${player.last_name}`

      return {
        type: 'player',
        id: player.player_id.toString(),
        title: fullName,
        subtitle: null,
        description: null,
        relevanceScore: calculatePlayerRelevance(player, query),
        data: {
          ...player,
          player_id: player.player_id.toString(), // Convert BigInt to string
          card_count: Number(player.card_count || 0),
          teams: teams,
          slug: player.player_slug  // Use stored slug from database
        }
      }
    })
  } catch (error) {
    console.error('Player search error:', error)
    return []
  }
}

// Search teams using raw SQL
async function searchTeams(query, limit) {
  try {
    console.log('Searching teams for:', query)

    const searchPattern = `%${escapeSqlLike(query)}%`
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        t.team_id,
        t.name,
        t.slug,
        t.city,
        t.mascot,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        o.name as organization_name,
        COUNT(DISTINCT c.card_id) as card_count,
        COUNT(DISTINCT pt.player) as player_count
      FROM team t
      JOIN organization o ON t.organization = o.organization_id
      LEFT JOIN player_team pt ON t.team_id = pt.team
      LEFT JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      LEFT JOIN card c ON cpt.card = c.card_id
      WHERE t.name LIKE '${searchPattern}'
         OR t.city LIKE '${searchPattern}'
         OR t.mascot LIKE '${searchPattern}'
         OR t.abbreviation LIKE '${searchPattern}'
      GROUP BY t.team_id, t.name, t.slug, t.city, t.mascot, t.abbreviation, t.primary_color, t.secondary_color, o.name
      ORDER BY card_count DESC
    `)
    
    console.log(`Found ${results.length} teams for "${query}"`)
    
    return results.map(team => ({
      type: 'team',
      id: team.team_id.toString(),
      title: team.name,
      subtitle: null,
      description: null,
      relevanceScore: calculateTeamRelevance(team, query),
      data: {
        ...team,
        team_id: team.team_id.toString(), // Convert BigInt to string
        card_count: Number(team.card_count || 0),
        player_count: Number(team.player_count || 0),
        slug: team.slug  // Use stored slug from database
      }
    }))
  } catch (error) {
    console.error('Team search error:', error)
    return []
  }
}

// Search series using raw SQL
async function searchSeries(query, limit) {
  try {
    console.log('Searching series for:', query)

    const searchPattern = `%${escapeSqlLike(query)}%`
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        s.series_id,
        s.name as series_name,
        s.slug as series_slug,
        s.card_count,
        s.rookie_count,
        s.is_base,
        s.parallel_of_series,
        s.print_run_display,
        parent_s.name as parallel_parent_name,
        st.name as set_name,
        st.slug as set_slug,
        st.year as set_year,
        m.name as manufacturer_name,
        col.name as color_name,
        col.hex_value as color_hex_value
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN series parent_s ON s.parallel_of_series = parent_s.series_id
      LEFT JOIN color col ON s.color = col.color_id
      WHERE s.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
         OR st.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
         OR m.name LIKE '${searchPattern}' COLLATE Latin1_General_CI_AI
    `)
    
    console.log(`Found ${results.length} series for "${query}"`)
    
    // Debug log the first result to see what we're getting
    if (results.length > 0) {
      console.log('First series result:', JSON.stringify(results[0], (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      , 2))
    }
    
    const mappedResults = results.map(series => ({
      type: 'series',
      id: series.series_id.toString(),
      title: series.series_name,
      subtitle: null,
      description: null,
      relevanceScore: 75,
      data: {
        series_id: series.series_id.toString(),
        name: series.series_name, // Map to expected field name
        series_name: series.series_name,
        card_count: Number(series.card_count || 0),
        rookie_count: Number(series.rookie_count || 0),
        rc_count: Number(series.rookie_count || 0), // Alternative field name
        is_base: !!series.is_base,
        parallel_of_series: series.parallel_of_series ? Number(series.parallel_of_series) : null,
        is_parallel: !!series.parallel_of_series,
        parallel_parent_name: series.parallel_parent_name,
        set_name: series.set_name,
        set_year: series.set_year ? Number(series.set_year) : null,
        year: series.set_year ? Number(series.set_year) : null, // Alternative field name
        manufacturer_name: series.manufacturer_name,
        color_name: series.color_name,
        color_hex_value: series.color_hex_value,
        color_hex: series.color_hex_value, // Alternative field name
        print_run_display: series.print_run_display,
        print_run: series.print_run_display ? Number(series.print_run_display) : null,
        // Add navigation slugs from database
        slug: series.series_slug,
        series_slug: series.series_slug,
        set_slug: series.set_slug
      }
    }))
    
    if (mappedResults.length > 0) {
      console.log('First mapped series result:', JSON.stringify(mappedResults[0], null, 2))
    }
    
    return mappedResults
  } catch (error) {
    console.error('Series search error:', error)
    return []
  }
}

// Helper functions
function buildCardDescription(card) {
  const badges = []
  if (card.is_rookie) badges.push('Rookie')
  if (card.is_autograph) badges.push('Autograph')
  if (card.is_relic) badges.push('Relic')
  if (card.print_run) badges.push(`/${card.print_run}`)
  
  return badges.length > 0 ? badges.join(' • ') : 'Card'
}

function calculatePlayerRelevance(player, query) {
  let score = 50
  const lowerQuery = query.toLowerCase()
  const fullName = `${player.first_name} ${player.last_name}`.toLowerCase()
  
  // Exact name match
  if (fullName === lowerQuery) score += 40
  else if (fullName.includes(lowerQuery)) score += 25
  
  // Individual name matches
  if (player.first_name.toLowerCase() === lowerQuery) score += 30
  if (player.last_name.toLowerCase() === lowerQuery) score += 30
  if (player.nick_name && player.nick_name.toLowerCase() === lowerQuery) score += 35
  
  // Hall of Fame bonus
  if (player.is_hof) score += 10
  
  // High card count bonus
  if (player.card_count > 1000) score += 5
  
  return score
}

function calculateTeamRelevance(team, query) {
  let score = 50
  const lowerQuery = query.toLowerCase()
  
  if (team.abbreviation.toLowerCase() === lowerQuery) score += 40
  if (team.name.toLowerCase().includes(lowerQuery)) score += 25
  if (team.city.toLowerCase().includes(lowerQuery)) score += 20
  if (team.mascot.toLowerCase().includes(lowerQuery)) score += 20
  
  return score
}

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