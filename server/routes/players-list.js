const express = require('express')
const { PrismaClient } = require('@prisma/client')
const jwt = require('jsonwebtoken')
const router = express.Router()
const prisma = new PrismaClient()

// GET /api/players-list - Get top players by card count, optionally filtered by team
router.get('/', async (req, res) => {
  try {
    const { limit = 50, team_id, include_most_visited = 'false' } = req.query
    const limitNum = Math.min(parseInt(limit) || 50, 100)
    const includeMostVisited = include_most_visited === 'true'

    console.log('Getting top players list with limit:', limitNum, team_id ? `filtered by team_id: ${team_id}` : '', includeMostVisited ? '(including most visited)' : '')

    let topPlayersQuery
    let recentlyViewedPlayers = []
    let mostVisitedPlayers = []

    // For authenticated users, get their recently viewed players to include in results
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7)
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const userId = BigInt(decoded.userId)

        // Get user's recently viewed players (last 20), filtered by team if specified
        let recentViewedQuery
        if (team_id) {
          // When filtering by team, only get recently viewed players that belong to that team
          recentViewedQuery = `
            SELECT TOP 20
              p.player_id,
              p.first_name,
              p.last_name,
              p.nick_name,
              p.is_hof,
              p.card_count,
              up.created as last_visited
            FROM user_player up
            JOIN player p ON up.player = p.player_id
            JOIN player_team pt ON p.player_id = pt.player
            WHERE up.[user] = ${userId}
            AND pt.team = ${parseInt(team_id)}
            ORDER BY up.created DESC
          `
        } else {
          // When not filtering by team, get all recently viewed players
          recentViewedQuery = `
            SELECT TOP 20
              p.player_id,
              p.first_name,
              p.last_name,
              p.nick_name,
              p.is_hof,
              p.card_count,
              up.created as last_visited
            FROM user_player up
            JOIN player p ON up.player = p.player_id
            WHERE up.[user] = ${userId}
            ORDER BY up.created DESC
          `
        }
        
        recentlyViewedPlayers = await prisma.$queryRawUnsafe(recentViewedQuery)
      } catch (jwtError) {
        // JWT verification failed, continue without recent players
        console.log('JWT verification failed for recently viewed players')
      }
    } else {
      // For non-authenticated users, get globally most visited players
      if (!team_id) {
        const mostVisitedQuery = `
          SELECT TOP 20
            p.player_id,
            p.first_name,
            p.last_name,
            p.nick_name,
            p.is_hof,
            p.card_count,
            COUNT(up.user_player_id) as visit_count
          FROM player p
          LEFT JOIN user_player up ON p.player_id = up.player
          WHERE p.card_count > 0
          GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.is_hof, p.card_count
          HAVING COUNT(up.user_player_id) > 0
          ORDER BY COUNT(up.user_player_id) DESC, p.card_count DESC
        `
        
        mostVisitedPlayers = await prisma.$queryRawUnsafe(mostVisitedQuery)
      }
    }

    // Get top players by card count with their team information
    
    if (team_id) {
      // When filtering by team, get players for that team but with their TOTAL card count
      topPlayersQuery = `
        SELECT TOP ${limitNum}
          p.player_id,
          p.first_name,
          p.last_name,
          p.nick_name,
          p.is_hof,
          (
            SELECT COUNT(DISTINCT c2.card_id)
            FROM card_player_team cpt2
            JOIN card c2 ON cpt2.card = c2.card_id
            JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
            WHERE pt2.player = p.player_id
          ) as card_count
        FROM player p
        JOIN player_team pt ON p.player_id = pt.player
        JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
        JOIN card c ON cpt.card = c.card_id
        WHERE pt.team = ${parseInt(team_id)}
        GROUP BY p.player_id, p.first_name, p.last_name, p.nick_name, p.is_hof
        ORDER BY card_count DESC
      `
    } else {
      // Original query for all players
      topPlayersQuery = `
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
    }

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

    // If we have recently viewed players or most visited players, merge them with regular results
    let finalPlayersList = playersWithTeams
    let priorityPlayers = recentlyViewedPlayers.length > 0 ? recentlyViewedPlayers : mostVisitedPlayers
    
    if (priorityPlayers.length > 0) {
      // Get team information for priority players (recently viewed or most visited)
      const priorityPlayersWithTeams = await Promise.all(
        priorityPlayers.map(async (player) => {
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
            last_visited: player.last_visited,
            visit_count: player.visit_count ? Number(player.visit_count) : undefined,
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

      // Create a set of priority player IDs
      const priorityPlayerIds = new Set(priorityPlayersWithTeams.map(p => p.player_id))
      
      // Filter out priority players from regular results to avoid duplicates
      const otherPlayers = playersWithTeams.filter(p => !priorityPlayerIds.has(p.player_id))
      
      // Combine: priority players first, then others
      finalPlayersList = [...priorityPlayersWithTeams, ...otherPlayers]
    }

    res.json({
      players: finalPlayersList,
      total: finalPlayersList.length,
      recently_viewed_count: recentlyViewedPlayers.length,
      most_visited_count: mostVisitedPlayers.length
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