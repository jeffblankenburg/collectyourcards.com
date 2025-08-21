const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()
const prisma = new PrismaClient()

// GET /api/players-list - Get top players by card count
router.get('/', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const limitNum = Math.min(parseInt(limit) || 50, 100)

    console.log('Getting top players list with limit:', limitNum)

    // Get top players by card count with their team information
    const topPlayersQuery = `
      SELECT TOP ${limitNum}
        p.player_id,
        p.first_name,
        p.last_name,
        p.nick_name,
        p.is_hof,
        COUNT(DISTINCT c.card_id) as card_count
      FROM player p
      JOIN player_team pt ON p.player_id = pt.player
      JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
      JOIN card c ON cpt.card = c.card_id
      GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.is_hof
      ORDER BY COUNT(DISTINCT c.card_id) DESC
    `

    const topPlayers = await prisma.$queryRawUnsafe(topPlayersQuery)

    // Get team information for each player
    const playersWithTeams = await Promise.all(
      topPlayers.map(async (player) => {
        const teamsQuery = `
          SELECT DISTINCT 
            t.team_id,
            t.name as team_name,
            t.abbreviation,
            t.primary_color,
            t.secondary_color,
            COUNT(DISTINCT c.card_id) as team_card_count
          FROM team t
          JOIN player_team pt ON t.team_id = pt.team
          JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
          JOIN card c ON cpt.card = c.card_id
          WHERE pt.player = ${player.player_id}
          GROUP BY t.team_id, t.name, t.abbreviation, t.primary_color, t.secondary_color
          ORDER BY COUNT(DISTINCT c.card_id) DESC
        `

        const teams = await prisma.$queryRawUnsafe(teamsQuery)

        return {
          player_id: Number(player.player_id),
          first_name: player.first_name,
          last_name: player.last_name,
          nick_name: player.nick_name,
          is_hof: player.is_hof,
          card_count: Number(player.card_count),
          teams: teams.map(team => ({
            team_id: Number(team.team_id),
            name: team.team_name,
            abbreviation: team.abbreviation,
            primary_color: team.primary_color,
            secondary_color: team.secondary_color,
            card_count: Number(team.team_card_count)
          }))
        }
      })
    )

    res.json({
      players: playersWithTeams,
      total: playersWithTeams.length
    })

  } catch (error) {
    console.error('Error fetching players list:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch players list',
      details: error.message
    })
  }
})

module.exports = router