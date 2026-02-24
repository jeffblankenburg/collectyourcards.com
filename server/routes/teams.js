const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

// GET /api/teams/:id - Get team details by ID
router.get('/:id', async (req, res) => {
  try {
    const teamId = parseInt(req.params.id)

    if (isNaN(teamId)) {
      return res.status(400).json({
        error: 'Invalid team ID',
        message: 'Team ID must be a number'
      })
    }

    console.log(`🔍 Fetching team with ID: ${teamId}`)

    // Get team by ID
    const results = await prisma.$queryRaw`
      SELECT
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
      WHERE t.team_id = ${teamId}
    `

    if (results.length === 0) {
      console.log(`❌ No team found with ID: ${teamId}`)
      return res.status(404).json({
        error: 'Team not found',
        message: `No team found with ID: ${teamId}`
      })
    }

    const team = results[0]
    console.log(`✅ Found team: ${team.name}`)

    res.json({
      team: {
        team_id: Number(team.team_id),
        name: team.name,
        slug: team.slug,
        city: team.city,
        mascot: team.mascot,
        abbreviation: team.abbreviation,
        primary_color: team.primary_color,
        secondary_color: team.secondary_color,
        card_count: Number(team.card_count || 0),
        player_count: Number(team.player_count || 0),
        organization_id: team.organization_id ? Number(team.organization_id) : null,
        organization_name: team.organization_name,
        organization_abbreviation: team.organization_abbreviation
      }
    })

  } catch (error) {
    console.error('Error fetching team by ID:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch team details',
      details: error.message
    })
  }
})

// POST /api/teams/track-visit - Track team visit (authenticated users only)
router.post('/track-visit', async (req, res) => {
  try {
    const { team_id } = req.body
    
    if (!team_id) {
      return res.status(400).json({
        error: 'Missing team_id',
        message: 'team_id is required'
      })
    }

    // Check if team exists using raw query since Prisma model names don't match table names
    const teamExists = await prisma.$queryRaw`
      SELECT team_id FROM team WHERE team_id = ${parseInt(team_id)}
    `

    if (teamExists.length === 0) {
      return res.status(404).json({
        error: 'Team not found',
        message: `No team found with ID: ${team_id}`
      })
    }

    // For authenticated users, track in user_team table
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const jwt = require('jsonwebtoken')
        const token = authHeader.substring(7)
        const decoded = jwt.verify(token, process.env.JWT_SECRET)
        const userId = BigInt(decoded.userId)

        // Check if relationship already exists
        const existingRelation = await prisma.$queryRaw`
          SELECT user_team_id FROM user_team 
          WHERE [user] = ${userId} AND team = ${parseInt(team_id)}
        `

        if (existingRelation.length === 0) {
          // Create new user-team relationship
          await prisma.$executeRaw`
            INSERT INTO user_team ([user], team, created)
            VALUES (${userId}, ${parseInt(team_id)}, GETDATE())
          `
        } else {
          // Update the created timestamp to track latest visit
          await prisma.$executeRaw`
            UPDATE user_team 
            SET created = GETDATE()
            WHERE user_team_id = ${existingRelation[0].user_team_id}
          `
        }
        
        return res.json({ success: true, tracked: 'authenticated' })
      } catch (jwtError) {
        // JWT verification failed, treat as anonymous
      }
    }

    // For anonymous users, just return success without tracking
    res.json({ success: true, tracked: 'anonymous' })

  } catch (error) {
    console.error('Error tracking team visit:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to track team visit',
      details: error.message
    })
  }
})

// GET /api/teams/:id/history - Get change history for a team
router.get('/:id/history', async (req, res) => {
  try {
    const teamId = parseInt(req.params.id)
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)

    if (isNaN(teamId)) {
      return res.status(400).json({ error: 'Invalid team ID' })
    }

    // Fetch all approved submissions for this team (the audit trail)
    const submissions = await prisma.team_edit_submissions.findMany({
      where: {
        team_id: teamId,
        status: 'approved'
      },
      orderBy: {
        created_at: 'desc'
      },
      take: limit,
      include: {
        user_team_edit_submissions_user_idTouser: {
          select: {
            user_id: true,
            username: true,
            email: true,
            name: true,
            avatar_url: true
          }
        }
      }
    })

    // Transform the data for the frontend
    const history = submissions.map(sub => {
      const changes = []

      // Compare previous vs proposed for each field
      // Only show changes where proposed is not null (meaning it was actually changed)
      if (sub.proposed_name !== null && sub.previous_name !== sub.proposed_name) {
        changes.push({
          field: 'Name',
          from: sub.previous_name || '(empty)',
          to: sub.proposed_name || '(empty)'
        })
      }
      if (sub.proposed_city !== null && sub.previous_city !== sub.proposed_city) {
        changes.push({
          field: 'City',
          from: sub.previous_city || '(empty)',
          to: sub.proposed_city || '(empty)'
        })
      }
      if (sub.proposed_mascot !== null && sub.previous_mascot !== sub.proposed_mascot) {
        changes.push({
          field: 'Mascot',
          from: sub.previous_mascot || '(empty)',
          to: sub.proposed_mascot || '(empty)'
        })
      }
      if (sub.proposed_abbreviation !== null && sub.previous_abbreviation !== sub.proposed_abbreviation) {
        changes.push({
          field: 'Abbreviation',
          from: sub.previous_abbreviation || '(empty)',
          to: sub.proposed_abbreviation || '(empty)'
        })
      }
      if (sub.proposed_primary_color !== null && sub.previous_primary_color !== sub.proposed_primary_color) {
        changes.push({
          field: 'Primary Color',
          from: sub.previous_primary_color || '(none)',
          to: sub.proposed_primary_color || '(none)'
        })
      }
      if (sub.proposed_secondary_color !== null && sub.previous_secondary_color !== sub.proposed_secondary_color) {
        changes.push({
          field: 'Secondary Color',
          from: sub.previous_secondary_color || '(none)',
          to: sub.proposed_secondary_color || '(none)'
        })
      }

      const user = sub.user_team_edit_submissions_user_idTouser
      return {
        id: Number(sub.submission_id),
        timestamp: sub.reviewed_at || sub.created_at,
        user: {
          id: Number(user.user_id),
          username: user.username,
          name: user.name || user.email?.split('@')[0] || 'Unknown',
          avatar_url: user.avatar_url
        },
        changes,
        review_notes: sub.review_notes,
        is_admin_edit: sub.review_notes?.includes('Admin direct edit')
      }
    }).filter(h => h.changes.length > 0)

    res.json({
      history,
      total: history.length
    })

  } catch (error) {
    console.error('Error fetching team history:', error)
    res.status(500).json({
      error: 'Failed to fetch team history',
      message: error.message
    })
  }
})

module.exports = router