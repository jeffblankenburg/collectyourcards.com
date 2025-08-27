const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { authMiddleware } = require('../middleware/auth')
const router = express.Router()
const prisma = new PrismaClient()

// All routes require authentication
router.use(authMiddleware)

// GET /api/user/locations - Get user's locations
router.get('/', async (req, res) => {
  try {
    console.log('Full user object:', req.user)
    
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    console.log('Getting user locations for user:', userId)
    console.log('User ID type:', typeof userId)

    // First, let's see if there are ANY records in the table
    const allLocations = await prisma.$queryRaw`
      SELECT COUNT(*) as total_count FROM user_location
    `
    console.log('Total records in user_location table:', allLocations)

    // Let's also check what user values exist
    const userValues = await prisma.$queryRaw`
      SELECT DISTINCT [user] as user_id FROM user_location
    `
    console.log('Distinct user values in table:', userValues)

    const locations = await prisma.$queryRaw`
      SELECT 
        user_location_id,
        location,
        card_count,
        is_dashboard
      FROM user_location 
      WHERE [user] = ${BigInt(parseInt(userId))}
      ORDER BY location
    `

    console.log('Raw query result:', locations)
    console.log('Number of locations found:', locations.length)

    const serializedLocations = locations.map(location => {
      const serialized = {}
      Object.keys(location).forEach(key => {
        serialized[key] = typeof location[key] === 'bigint' ? Number(location[key]) : location[key]
      })
      return serialized
    })

    res.json({
      locations: serializedLocations
    })

  } catch (error) {
    console.error('Error getting user locations:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get user locations'
    })
  }
})

// POST /api/user/locations - Create a new location
router.post('/', async (req, res) => {
  try {
    const userId = req.user.userId
    const { location, is_dashboard = true } = req.body

    if (!location || location.trim() === '') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Location name is required'
      })
    }

    console.log('Creating user location:', { userId, location })

    const insertResult = await prisma.$queryRaw`
      INSERT INTO user_location ([user], location, card_count, is_dashboard)
      OUTPUT INSERTED.user_location_id
      VALUES (${BigInt(parseInt(userId))}, ${location.trim()}, 0, ${is_dashboard})
    `

    const newLocationId = insertResult[0].user_location_id

    res.status(201).json({
      message: 'Location created successfully',
      location_id: Number(newLocationId)
    })

  } catch (error) {
    console.error('Error creating user location:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to create location'
    })
  }
})

// PUT /api/user/locations/:locationId - Update a location
router.put('/:locationId', async (req, res) => {
  try {
    const userId = req.user.userId
    const { locationId } = req.params
    const { location, is_dashboard } = req.body

    if (!location || location.trim() === '') {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Location name is required'
      })
    }

    console.log('Updating user location:', { userId, locationId, location })

    const updateResult = await prisma.$queryRaw`
      UPDATE user_location 
      SET 
        location = ${location.trim()},
        is_dashboard = ${is_dashboard}
      WHERE user_location_id = ${parseInt(locationId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    res.json({
      message: 'Location updated successfully'
    })

  } catch (error) {
    console.error('Error updating user location:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update location'
    })
  }
})

// DELETE /api/user/locations/:locationId - Delete a location
router.delete('/:locationId', async (req, res) => {
  try {
    const userId = req.user.userId
    const { locationId } = req.params
    const { reassign_to } = req.body

    console.log('Deleting user location:', { userId, locationId, reassign_to })

    // Check if location has cards
    const cardCount = await prisma.$queryRaw`
      SELECT COUNT(*) as count 
      FROM user_card 
      WHERE user_location = ${parseInt(locationId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    const hasCards = Number(cardCount[0].count) > 0

    if (hasCards && !reassign_to) {
      return res.status(400).json({
        error: 'Location has cards',
        message: 'Cannot delete location that contains cards. Provide reassign_to location ID.'
      })
    }

    // If there are cards and reassign_to is provided, reassign them
    if (hasCards && reassign_to) {
      // Verify reassign_to location belongs to user
      const targetLocation = await prisma.$queryRaw`
        SELECT user_location_id 
        FROM user_location 
        WHERE user_location_id = ${parseInt(reassign_to)} 
        AND [user] = ${BigInt(parseInt(userId))}
      `

      if (targetLocation.length === 0) {
        return res.status(400).json({
          error: 'Invalid target location',
          message: 'The target location does not exist or does not belong to you.'
        })
      }

      // Reassign all cards to the new location
      await prisma.$queryRaw`
        UPDATE user_card 
        SET user_location = ${parseInt(reassign_to)}
        WHERE user_location = ${parseInt(locationId)} 
        AND [user] = ${BigInt(parseInt(userId))}
      `

      console.log(`Reassigned ${cardCount[0].count} cards from location ${locationId} to ${reassign_to}`)
    }

    // Now delete the location
    const deleteResult = await prisma.$queryRaw`
      DELETE FROM user_location 
      WHERE user_location_id = ${parseInt(locationId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    res.json({
      message: hasCards ? 'Cards reassigned and location deleted successfully' : 'Location deleted successfully',
      cards_reassigned: hasCards ? Number(cardCount[0].count) : 0
    })

  } catch (error) {
    console.error('Error deleting user location:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to delete location'
    })
  }
})

module.exports = router