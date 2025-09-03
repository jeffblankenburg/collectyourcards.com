const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

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

module.exports = router