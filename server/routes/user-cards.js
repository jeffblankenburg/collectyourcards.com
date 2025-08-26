const express = require('express')
const { PrismaClient, Prisma } = require('@prisma/client')
const { authMiddleware } = require('../middleware/auth')
const router = express.Router()
const prisma = new PrismaClient()

// All routes require authentication
router.use(authMiddleware)

// POST /api/user/cards/counts - Get user's card counts for specific cards
router.post('/counts', async (req, res) => {
  try {
    const { card_ids } = req.body
    console.log('Full req.user object:', req.user)
    
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    if (!Array.isArray(card_ids) || card_ids.length === 0) {
      return res.json({ counts: {} })
    }

    console.log('Getting card counts for user:', userId, 'cards:', card_ids.length)

    // Convert card_ids to integers for proper SQL binding
    const cardIdNumbers = card_ids.map(id => parseInt(id))

    const counts = await prisma.$queryRaw`
      SELECT 
        card,
        COUNT(*) as count
      FROM user_card 
      WHERE [user] = ${BigInt(parseInt(userId))} 
      AND card IN (${Prisma.join(cardIdNumbers)})
      GROUP BY card
    `

    // Convert to object map for easier frontend consumption
    const countsMap = {}
    counts.forEach(row => {
      countsMap[Number(row.card)] = Number(row.count)
    })

    res.json({ counts: countsMap })
  } catch (error) {
    console.error('Error getting user card counts:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get user card counts'
    })
  }
})

// POST /api/user/cards - Add a card to user's collection
router.post('/', async (req, res) => {
  try {
    const userId = req.user.user_id
    const {
      card_id,
      serial_number,
      user_location,
      notes,
      aftermarket_auto,
      purchase_price,
      estimated_value,
      grading_agency,
      grade,
      grade_id
    } = req.body

    console.log('Adding card to collection:', { userId, card_id, serial_number })

    // Validate required fields
    if (!card_id) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'card_id is required'
      })
    }

    // Check if card exists
    const cardExists = await prisma.$queryRaw`
      SELECT card_id FROM card WHERE card_id = ${card_id}
    `
    
    if (cardExists.length === 0) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Card does not exist'
      })
    }

    // Insert user card
    const insertResult = await prisma.$queryRaw`
      INSERT INTO user_card (
        [user], 
        card, 
        serial_number, 
        purchase_price, 
        estimated_value, 
        grading_agency, 
        grade, 
        grade_id,
        aftermarket_auto,
        user_location, 
        notes,
        created
      ) VALUES (
        ${BigInt(parseInt(userId))},
        ${card_id},
        ${serial_number},
        ${purchase_price},
        ${estimated_value},
        ${grading_agency},
        ${grade},
        ${grade_id || null},
        ${aftermarket_auto || false},
        ${user_location},
        ${notes || null},
        GETDATE()
      )
    `

    res.status(201).json({
      message: 'Card added to collection successfully'
    })

  } catch (error) {
    console.error('Error adding card to collection:', error)
    
    // Handle duplicate key constraint
    if (error.message.includes('duplicate key') || error.message.includes('UNIQUE constraint')) {
      return res.status(409).json({
        error: 'Duplicate card',
        message: 'This card is already in your collection'
      })
    }

    res.status(500).json({
      error: 'Database error',
      message: 'Failed to add card to collection'
    })
  }
})

// GET /api/user/cards - Get user's card collection
router.get('/', async (req, res) => {
  try {
    const userId = req.user.user_id
    const { limit = 100, page = 1 } = req.query

    const limitNum = Math.min(parseInt(limit) || 100, 1000)
    const pageNum = parseInt(page) || 1
    const offsetNum = (pageNum - 1) * limitNum

    console.log('Getting user collection:', { userId, limit: limitNum, page: pageNum })

    const userCards = await prisma.$queryRaw`
      SELECT 
        uc.user_card_id,
        uc.serial_number,
        uc.purchase_price,
        uc.estimated_value,
        uc.grading_agency,
        uc.grade,
        uc.grade_id,
        uc.aftermarket_auto,
        uc.notes,
        uc.created,
        c.card_id,
        c.card_number,
        c.print_run,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        s.name as series_name,
        ul.location as user_location_name,
        ga.name as grading_agency_name
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      LEFT JOIN series s ON c.series = s.series_id
      LEFT JOIN user_location ul ON uc.user_location = ul.user_location_id
      LEFT JOIN grading_agency ga ON uc.grading_agency = ga.grading_agency_id
      WHERE uc.[user] = ${BigInt(parseInt(userId))}
      ORDER BY uc.created DESC
      OFFSET ${offsetNum} ROWS
      FETCH NEXT ${limitNum} ROWS ONLY
    `

    // Get total count
    const totalCount = await prisma.$queryRaw`
      SELECT COUNT(*) as total FROM user_card WHERE [user] = ${userId}
    `

    const serializedCards = userCards.map(card => {
      const serialized = {}
      Object.keys(card).forEach(key => {
        serialized[key] = typeof card[key] === 'bigint' ? Number(card[key]) : card[key]
      })
      return serialized
    })

    res.json({
      cards: serializedCards,
      total: Number(totalCount[0].total),
      page: pageNum,
      limit: limitNum
    })

  } catch (error) {
    console.error('Error getting user collection:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get user collection'
    })
  }
})

// DELETE /api/user/cards/:userCardId - Remove card from collection
router.delete('/:userCardId', async (req, res) => {
  try {
    const userId = req.user.user_id
    const { userCardId } = req.params

    console.log('Removing card from collection:', { userId, userCardId })

    const deleteResult = await prisma.$queryRaw`
      DELETE FROM user_card 
      WHERE user_card_id = ${parseInt(userCardId)} 
      AND [user] = ${BigInt(parseInt(userId))}
    `

    res.json({
      message: 'Card removed from collection successfully'
    })

  } catch (error) {
    console.error('Error removing card from collection:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to remove card from collection'
    })
  }
})

module.exports = router