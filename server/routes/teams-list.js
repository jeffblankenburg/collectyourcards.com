const express = require('express')
const router = express.Router()
const jwt = require('jsonwebtoken')
const { prisma } = require('../config/prisma-singleton')
const { escapeLikePattern, sanitizeSearchTerm } = require('../utils/sql-security')

// GET /api/teams-list - Get top teams by card count
router.get('/', async (req, res) => {
  try {
    const { limit = 50, search, sortBy = 'name', sortOrder = 'asc' } = req.query
    const limitNum = Math.min(parseInt(limit) || 50, 100)

    // Build sort clause - default to name ASC for easier scanning
    const validSortColumns = ['name', 'card_count', 'player_count', 'city']
    const sortColumn = validSortColumns.includes(sortBy) ? `t.${sortBy}` : 't.name'
    const sortDirection = sortOrder === 'desc' ? 'DESC' : 'ASC'

    console.log('Getting top teams list with limit:', limitNum, search ? `and search: "${search}"` : '')

    // Build search condition for filtering teams
    let searchCondition = ''
    if (search && search.trim()) {
      const sanitized = sanitizeSearchTerm(search.trim())
      const safeSearch = escapeLikePattern(sanitized)
      searchCondition = `AND (
        LOWER(t.name) LIKE '%${safeSearch}%' COLLATE Latin1_General_CI_AI
        OR LOWER(t.city) LIKE '%${safeSearch}%' COLLATE Latin1_General_CI_AI
        OR LOWER(t.abbreviation) LIKE '%${safeSearch}%' COLLATE Latin1_General_CI_AI
        OR LOWER(org.name) LIKE '%${safeSearch}%' COLLATE Latin1_General_CI_AI
        OR LOWER(org.abbreviation) LIKE '%${safeSearch}%' COLLATE Latin1_General_CI_AI
      )`
    }

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
            t.slug,
            t.city,
            t.mascot,
            t.abbreviation,
            t.primary_color,
            t.secondary_color,
            t.card_count,
            t.player_count,
            t.organization as organization_id,
            org.name as organization_name,
            org.abbreviation as organization_abbreviation,
            ut.created as last_visited
          FROM user_team ut
          JOIN team t ON ut.team = t.team_id
          LEFT JOIN organization org ON t.organization = org.organization_id
          WHERE ut.[user] = ${userId}
          ${searchCondition}
          ORDER BY ${sortColumn} ${sortDirection}
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
        t.slug,
        t.city,
        t.mascot,
        t.abbreviation,
        t.primary_color,
        t.secondary_color,
        t.card_count,
        t.player_count,
        t.organization as organization_id,
        org.name as organization_name,
        org.abbreviation as organization_abbreviation
      FROM team t
      LEFT JOIN organization org ON t.organization = org.organization_id
      WHERE 1=1
      ${searchCondition}
      ORDER BY ${sortColumn} ${sortDirection}
    `

    const topTeams = await prisma.$queryRawUnsafe(topTeamsQuery)

    // Serialize BigInt values (using pre-calculated card_count and player_count)
    const serializedTeams = topTeams.map(team => ({
      team_id: Number(team.team_id),
      name: team.name,
      slug: team.slug,
      city: team.city,
      mascot: team.mascot,
      abbreviation: team.abbreviation,
      primary_color: team.primary_color,
      secondary_color: team.secondary_color,
      organization_id: team.organization_id ? Number(team.organization_id) : null,
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
        slug: team.slug,
        city: team.city,
        mascot: team.mascot,
        abbreviation: team.abbreviation,
        primary_color: team.primary_color,
        secondary_color: team.secondary_color,
        organization_id: team.organization_id ? Number(team.organization_id) : null,
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

      // Combine and maintain sort order (don't put recently viewed first - breaks alphabetical)
      finalTeamsList = [...recentlyViewedSerialized, ...otherTeams]

      // Re-sort the combined list to maintain proper order
      finalTeamsList.sort((a, b) => {
        const aVal = a.name?.toLowerCase() || ''
        const bVal = b.name?.toLowerCase() || ''
        return sortDirection === 'DESC' ? bVal.localeCompare(aVal) : aVal.localeCompare(bVal)
      })
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

// GET /api/teams-list/organizations - Get all organizations
router.get('/organizations', async (req, res) => {
  try {
    const organizations = await prisma.$queryRaw`
      SELECT organization_id, name, abbreviation
      FROM organization
      ORDER BY name ASC
    `

    res.json({
      organizations: organizations.map(org => ({
        organization_id: Number(org.organization_id),
        name: org.name,
        abbreviation: org.abbreviation
      }))
    })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch organizations'
    })
  }
})

module.exports = router