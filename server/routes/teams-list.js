const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()
const prisma = new PrismaClient()

// GET /api/teams-list - Get top teams by card count
router.get('/', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const limitNum = Math.min(parseInt(limit) || 50, 100)

    console.log('Getting top teams list with limit:', limitNum)

    // Get top teams by card count
    const topTeams = await prisma.$queryRaw`
      SELECT TOP ${limitNum}
        t.team_id,
        t.name,
        t.city,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        org.name as organization_name,
        COUNT(DISTINCT c.card_id) as card_count,
        COUNT(DISTINCT p.player_id) as player_count
      FROM team t
      LEFT JOIN organization org ON t.organization = org.organization_id
      JOIN player_team pt ON t.team_id = pt.team
      JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      JOIN card c ON cpt.card = c.card_id
      JOIN player p ON pt.player = p.player_id
      GROUP BY t.team_id, t.name, t.city, t.abbreviation, t.primary_color, t.secondary_color, org.name
      ORDER BY COUNT(DISTINCT c.card_id) DESC
    `

    // Serialize BigInt values
    const serializedTeams = topTeams.map(team => ({
      team_id: Number(team.team_id),
      name: team.name,
      city: team.city,
      abbreviation: team.abbreviation,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      organization_name: team.organization_name,
      card_count: Number(team.card_count),
      player_count: Number(team.player_count)
    }))

    res.json({
      teams: serializedTeams,
      total: serializedTeams.length
    })

  } catch (error) {
    console.error('Error fetching teams list:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch teams list',
      details: error.message
    })
  }
})

module.exports = router