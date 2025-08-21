const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()

// Initialize Prisma with error handling for production
let prisma
let databaseAvailable = false

try {
  prisma = new PrismaClient()
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
    const results = await performIntelligentSearch(searchQuery, parseInt(limit), category)
    
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
    console.log('Search patterns detected:', patterns)
    
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
  
  // Detect card numbers (various formats)
  const cardNumberRegex = /^(\d+[a-zA-Z]*|[A-Z]+-\d+|RC-\d+|SP-\d+|BDC-\d+)\s*/
  const cardNumberMatch = query.match(cardNumberRegex)
  if (cardNumberMatch) {
    patterns.cardNumber = cardNumberMatch[1]
    
    // Check if there's a player name after the card number
    const remainingText = query.substring(cardNumberMatch[0].length).trim()
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

// Search cards by number and player name using raw SQL
async function searchCardsByNumberAndPlayer(cardNumber, playerName, limit) {
  try {
    console.log(`Searching cards by number "${cardNumber}" and player "${playerName}"`)
    
    const cardPattern = `%${cardNumber}%`
    const playerPattern = `%${playerName}%`
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.name as series_name,
        st.name as set_name,
        st.year as set_year,
        m.name as manufacturer_name,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE c.card_number LIKE '${cardPattern}'
        AND (p.first_name LIKE '${playerPattern}'
             OR p.last_name LIKE '${playerPattern}'
             OR p.nick_name LIKE '${playerPattern}')
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
               s.name, st.name, st.year, m.name
    `)
    
    console.log(`Found ${results.length} cards for "${cardNumber} ${playerName}"`)
    
    return results.map(card => ({
      type: 'card',
      id: card.card_id.toString(),
      title: `#${card.card_number} ${card.player_names || 'Unknown Player'} • ${card.series_name}`,
      subtitle: null,
      description: null,
      relevanceScore: 95,
      data: {
        ...card,
        card_id: card.card_id.toString() // Convert BigInt to string
      }
    }))
  } catch (error) {
    console.error('Card number + player search error:', error)
    return []
  }
}

// Search cards by number only using raw SQL
async function searchCardsByNumber(cardNumber, limit) {
  try {
    console.log(`Searching cards by number "${cardNumber}"`)
    
    const cardPattern = `%${cardNumber}%`
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        c.card_id,
        c.card_number,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.print_run,
        s.name as series_name,
        st.name as set_name,
        st.year as set_year,
        m.name as manufacturer_name,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE c.card_number LIKE '${cardPattern}'
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
               s.name, st.name, st.year, m.name
    `)
    
    console.log(`Found ${results.length} cards for number "${cardNumber}"`)
    
    return results.map(card => ({
      type: 'card',
      id: card.card_id.toString(),
      title: `#${card.card_number} ${card.player_names || 'Unknown Player'} • ${card.series_name}`,
      subtitle: null,
      description: null,
      relevanceScore: card.card_number === cardNumber ? 100 : 80,
      data: {
        ...card,
        card_id: card.card_id.toString() // Convert BigInt to string
      }
    }))
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
      `AND (p.first_name LIKE '%${playerName}%' OR p.last_name LIKE '%${playerName}%' OR p.nick_name LIKE '%${playerName}%')` : 
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
        st.name as set_name,
        st.year as set_year,
        m.name as manufacturer_name,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names
      FROM card c
      JOIN series s ON c.series = s.series_id
      JOIN [set] st ON s.[set] = st.set_id
      JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE (${typeConditionsSql}) ${playerCondition}
      GROUP BY c.card_id, c.card_number, c.is_rookie, c.is_autograph, c.is_relic, c.print_run,
               s.name, st.name, st.year, m.name
    `)
    
    console.log(`Found ${results.length} cards for types ${cardTypes.join(', ')}`)
    
    return results.map(card => ({
      type: 'card',
      id: card.card_id.toString(),
      title: `#${card.card_number} ${card.player_names || 'Unknown Player'} • ${card.series_name}`,
      subtitle: null,
      description: null,
      relevanceScore: 85,
      data: {
        card_id: card.card_id.toString(),
        card_number: card.card_number,
        is_rookie: card.is_rookie,
        is_autograph: card.is_autograph,
        is_relic: card.is_relic,
        print_run: card.print_run,
        series_name: card.series_name,
        set_name: card.set_name,
        set_year: card.set_year,
        manufacturer_name: card.manufacturer_name,
        player_names: card.player_names
      }
    }))
  } catch (error) {
    console.error('Card type search error:', error)
    return []
  }
}

// Search players using raw SQL
async function searchPlayers(query, limit) {
  try {
    console.log('Searching players for:', query)
    
    const searchPattern = `%${query}%`
    
    // Check if query contains spaces (likely full name)
    const queryParts = query.trim().split(/\s+/)
    let whereClause = ''
    
    if (queryParts.length >= 2) {
      // Multi-word search - search for full name combinations
      const firstName = queryParts[0]
      const lastName = queryParts.slice(1).join(' ')
      
      whereClause = `
        (CONCAT(first_name, ' ', last_name) LIKE '${searchPattern}')
        OR (CONCAT(first_name, ' ', nick_name, ' ', last_name) LIKE '${searchPattern}')
        OR (CONCAT(nick_name, ' ', last_name) LIKE '${searchPattern}')
        OR (first_name LIKE '%${firstName}%' AND last_name LIKE '%${lastName}%')
        OR (nick_name LIKE '%${firstName}%' AND last_name LIKE '%${lastName}%')
        OR first_name LIKE '${searchPattern}'
        OR last_name LIKE '${searchPattern}'
        OR nick_name LIKE '${searchPattern}'
      `
    } else {
      // Single word search - search individual fields and name combinations
      whereClause = `
        first_name LIKE '${searchPattern}'
        OR last_name LIKE '${searchPattern}'
        OR nick_name LIKE '${searchPattern}'
        OR CONCAT(first_name, ' ', last_name) LIKE '${searchPattern}'
        OR CONCAT(first_name, ' ', nick_name, ' ', last_name) LIKE '${searchPattern}'
        OR CONCAT(nick_name, ' ', last_name) LIKE '${searchPattern}'
      `
    }
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        player_id,
        first_name,
        last_name,
        nick_name,
        card_count,
        is_hof
      FROM player
      WHERE ${whereClause}
      ORDER BY card_count DESC
    `)
    
    console.log(`Found ${results.length} players for "${query}"`)
    
    return results.map(player => ({
      type: 'player',
      id: player.player_id.toString(),
      title: `${player.first_name} ${player.last_name}${player.nick_name ? ` "${player.nick_name}"` : ''}${player.is_hof ? ' • Hall of Fame' : ''}`,
      subtitle: null,
      description: null,
      relevanceScore: calculatePlayerRelevance(player, query),
      data: {
        ...player,
        player_id: player.player_id.toString() // Convert BigInt to string
      }
    }))
  } catch (error) {
    console.error('Player search error:', error)
    return []
  }
}

// Search teams using raw SQL
async function searchTeams(query, limit) {
  try {
    console.log('Searching teams for:', query)
    
    const searchPattern = `%${query}%`
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        t.team_id,
        t.name,
        t.city,
        t.mascot,
        t.abbreviation,
        o.name as organization_name,
        COUNT(DISTINCT c.card_id) as card_count
      FROM team t
      JOIN organization o ON t.organization = o.organization_id
      LEFT JOIN player_team pt ON t.team_id = pt.team
      LEFT JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      LEFT JOIN card c ON cpt.card = c.card_id
      WHERE t.name LIKE '${searchPattern}'
         OR t.city LIKE '${searchPattern}'
         OR t.mascot LIKE '${searchPattern}'
         OR t.abbreviation LIKE '${searchPattern}'
      GROUP BY t.team_id, t.name, t.city, t.mascot, t.abbreviation, o.name
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
        team_id: team.team_id.toString() // Convert BigInt to string
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
    
    const searchPattern = `%${query}%`
    
    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        s.series_id,
        s.name as series_name,
        s.card_count,
        st.name as set_name,
        st.year as set_year,
        m.name as manufacturer_name
      FROM series s
      JOIN [set] st ON s.[set] = st.set_id
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      WHERE s.name LIKE '${searchPattern}' COLLATE SQL_Latin1_General_CP1_CI_AS
         OR st.name LIKE '${searchPattern}' COLLATE SQL_Latin1_General_CP1_CI_AS
         OR m.name LIKE '${searchPattern}' COLLATE SQL_Latin1_General_CP1_CI_AS
    `)
    
    console.log(`Found ${results.length} series for "${query}"`)
    
    return results.map(series => ({
      type: 'series',
      id: series.series_id.toString(),
      title: `${series.series_name} • ${series.set_name} • ${series.manufacturer_name}`,
      subtitle: null,
      description: null,
      relevanceScore: 75,
      data: {
        ...series,
        series_id: series.series_id.toString() // Convert BigInt to string
      }
    }))
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