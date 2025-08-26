const express = require('express')
const { PrismaClient } = require('@prisma/client')
const jwt = require('jsonwebtoken')
const router = express.Router()
const prisma = new PrismaClient()

// GET /api/teams-list - Get top teams by card count
router.get('/', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const limitNum = Math.min(parseInt(limit) || 50, 100)

    console.log('Getting top teams list with limit:', limitNum)

    let recentlyViewedTeams = []

    // For authenticated users, get their recently viewed teams to include in results
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7)
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const userId = BigInt(decoded.userId)

        // Get user's recently viewed teams (last 20)
        const recentViewedQuery = `
          SELECT TOP 20
            t.team_id,
            t.name,
            t.city,
            t.abbreviation,
            t.primary_color,
            t.secondary_color,
            t.card_count,
            t.player_count,
            org.name as organization_name,
            org.abbreviation as organization_abbreviation,
            ut.created as last_visited
          FROM user_team ut
          JOIN team t ON ut.team = t.team_id
          LEFT JOIN organization org ON t.organization = org.organization_id
          WHERE ut.[user] = ${userId}
          ORDER BY ut.created DESC
        `
        
        recentlyViewedTeams = await prisma.$queryRawUnsafe(recentViewedQuery)
      } catch (jwtError) {
        // JWT verification failed, continue without recent teams
        console.log('JWT verification failed for recently viewed teams')
      }
    }

    // Get top teams by pre-calculated card and player counts (much faster!)
    const topTeamsQuery = `
      SELECT TOP ${limitNum}
        t.team_id,
        t.name,
        t.city,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        t.card_count,
        t.player_count,
        org.name as organization_name,
        org.abbreviation as organization_abbreviation
      FROM team t
      LEFT JOIN organization org ON t.organization = org.organization_id
      WHERE t.card_count > 0
      ORDER BY t.card_count DESC
    `

    const topTeams = await prisma.$queryRawUnsafe(topTeamsQuery)

    // Serialize BigInt values (using pre-calculated card_count and player_count)
    const serializedTeams = topTeams.map(team => ({
      team_id: Number(team.team_id),
      name: team.name,
      city: team.city,
      abbreviation: team.abbreviation,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      organization_name: team.organization_name,
      organization_abbreviation: team.organization_abbreviation,
      card_count: Number(team.card_count),
      player_count: Number(team.player_count)
    }))

    // If we have recently viewed teams, merge them with regular results
    let finalTeamsList = serializedTeams
    
    if (recentlyViewedTeams.length > 0) {
      // Serialize recently viewed teams
      const recentlyViewedSerialized = recentlyViewedTeams.map(team => ({
        team_id: Number(team.team_id),
        name: team.name,
        city: team.city,
        abbreviation: team.abbreviation,
        primary_color: team.primary_color,
        secondary_color: team.secondary_color,
        organization_name: team.organization_name,
        organization_abbreviation: team.organization_abbreviation,
        card_count: Number(team.card_count),
        player_count: Number(team.player_count),
        last_visited: team.last_visited
      }))

      // Create a set of recently viewed team IDs
      const recentlyViewedIds = new Set(recentlyViewedSerialized.map(t => t.team_id))
      
      // Filter out recently viewed teams from regular results to avoid duplicates
      const otherTeams = serializedTeams.filter(t => !recentlyViewedIds.has(t.team_id))
      
      // Combine: recently viewed first, then others
      finalTeamsList = [...recentlyViewedSerialized, ...otherTeams]
    }

    res.json({
      teams: finalTeamsList,
      total: finalTeamsList.length,
      recently_viewed_count: recentlyViewedTeams.length
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