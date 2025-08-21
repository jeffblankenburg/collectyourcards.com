const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()
const prisma = new PrismaClient()

// GET /api/players/by-slug/:slug - Get player details by slug (simplified)
router.get('/by-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params
    const nameParts = slug.toLowerCase().split('-')
    
    if (nameParts.length < 2) {
      return res.status(400).json({
        error: 'Invalid slug format',
        message: 'Slug must contain at least first and last name'
      })
    }
    
    // Use the same simple approach as the debug route that works
    const results = await prisma.$queryRaw`
      SELECT TOP 1 * FROM player 
      WHERE LOWER(first_name) LIKE ${`%${nameParts[0]}%`} 
      AND LOWER(last_name) LIKE ${`%${nameParts[1]}%`}
    `
    
    if (results.length === 0) {
      return res.status(404).json({
        error: 'Player not found',
        message: `No player found for slug: ${slug}`
      })
    }
    
    // Convert BigInt to Number for JSON serialization
    const serializedResults = results.map(row => {
      const serialized = {}
      Object.keys(row).forEach(key => {
        serialized[key] = typeof row[key] === 'bigint' ? Number(row[key]) : row[key]
      })
      return serialized
    })

    const player = serializedResults[0]
    
    // Get team statistics for team circles with card counts
    const teamResults = await prisma.$queryRaw`
      SELECT DISTINCT 
        t.team_id,
        t.name as team_name,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        COUNT(DISTINCT c.card_id) as card_count
      FROM team t
      JOIN player_team pt ON t.team_id = pt.team
      JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      JOIN card c ON cpt.card = c.card_id
      WHERE pt.player = ${player.player_id}
      GROUP BY t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color
    `
    
    const teams = teamResults.map(team => {
      // Convert BigInt fields to Number and fix field names
      const serialized = {}
      Object.keys(team).forEach(key => {
        serialized[key] = typeof team[key] === 'bigint' ? Number(team[key]) : team[key]
      })
      
      // Rename team_name to name for frontend compatibility
      return {
        team_id: serialized.team_id,
        name: serialized.team_name,
        abbreviation: serialized.abbreviation,
        primary_color: serialized.primary_color,
        secondary_color: serialized.secondary_color,
        card_count: serialized.card_count
      }
    })
    
    // Cards will be loaded via the separate cards API endpoint with infinite scrolling
    const cards = []
    const stats = {
      total_cards: player.card_count || 0,
      rookie_cards: 0,
      autograph_cards: 0,
      relic_cards: 0,
      numbered_cards: 0,
      unique_series: 0
    }
    
    res.json({
      player,
      cards,
      teams,
      stats
    })
    
  } catch (error) {
    console.error('Error fetching player details:', error)
    console.error('Error details:', error.message)
    console.error('Error stack:', error.stack)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch player details',
      details: error.message
    })
  }
})

module.exports = router