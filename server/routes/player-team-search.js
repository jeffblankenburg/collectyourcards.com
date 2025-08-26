const express = require('express')
const { PrismaClient } = require('@prisma/client')

const router = express.Router()

// Initialize Prisma with error handling for production
let prisma
let databaseAvailable = false

try {
  prisma = new PrismaClient()
  databaseAvailable = true
  console.log('✅ Database connection initialized for player-team-search routes')
} catch (error) {
  console.error('❌ Database connection failed for player-team-search routes:', error.message)
  databaseAvailable = false
}

// GET /api/player-team-search - Search for player-team combinations
router.get('/', async (req, res) => {
  try {
    const { q: query, limit = 50 } = req.query
    
    if (!query || query.trim().length < 2) {
      return res.json({ playerTeamCombinations: [] })
    }

    // Check if database is available
    if (!databaseAvailable) {
      return res.json({
        playerTeamCombinations: [],
        message: 'Search service is temporarily unavailable'
      })
    }

    const searchTerm = query.trim()
    const searchLimit = Math.min(parseInt(limit) || 50, 100)
    
    console.log(`Searching for player-team combinations with term: "${searchTerm}", limit: ${searchLimit}`)

    // Search for players and their team relationships
    // This query finds players that match the search term and returns all their team associations
    const playerTeamCombinations = await prisma.$queryRawUnsafe(`
      SELECT 
        p.player_id,
        p.first_name,
        p.last_name,
        p.nick_name,
        t.team_id,
        t.name as team_name,
        t.abbreviation as team_abbreviation,
        t.primary_color,
        t.secondary_color
      FROM player p
      JOIN player_team pt ON p.player_id = pt.player
      JOIN team t ON pt.team = t.team_id
      WHERE (
        p.first_name LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
        OR p.last_name LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
        OR p.nick_name LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
        OR CONCAT(p.first_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
        OR CONCAT(p.first_name, ' ', p.nick_name, ' ', p.last_name) LIKE '%${searchTerm}%' COLLATE SQL_Latin1_General_CP1_CI_AS
      )
      ORDER BY p.last_name, p.first_name, t.name
    `)

    console.log(`Found ${playerTeamCombinations.length} player-team combinations`)

    // Transform results to match expected frontend format
    const formattedResults = playerTeamCombinations.map(result => ({
      player: {
        player_id: Number(result.player_id),
        first_name: result.first_name,
        last_name: result.last_name,
        nick_name: result.nick_name,
        name: `${result.first_name} ${result.last_name}`.trim()
      },
      team: {
        team_id: Number(result.team_id),
        name: result.team_name,
        abbreviation: result.team_abbreviation,
        primary_color: result.primary_color,
        secondary_color: result.secondary_color
      }
    }))

    // Apply limit to final results
    const limitedResults = formattedResults.slice(0, searchLimit)

    res.json({
      playerTeamCombinations: limitedResults,
      query: searchTerm,
      totalFound: formattedResults.length,
      returned: limitedResults.length
    })

  } catch (error) {
    console.error('Player-team search error:', error)
    res.status(500).json({
      error: 'Search failed',
      message: 'Failed to search player-team combinations',
      details: error.message,
      playerTeamCombinations: []
    })
  }
})

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    route: 'player-team-search',
    timestamp: new Date().toISOString(),
    databaseAvailable: databaseAvailable
  })
})

module.exports = router