const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { authMiddleware } = require('../middleware/auth')
const router = express.Router()
const prisma = new PrismaClient()

// All routes require authentication
router.use(authMiddleware)

// GET /api/user/collection/stats - Get user's collection statistics
router.get('/', async (req, res) => {
  try {
    const userId = req.user?.userId
    if (!userId) {
      return res.status(401).json({
        error: 'Authentication error',
        message: 'User ID not found in authentication token'
      })
    }

    console.log('Getting collection stats for user:', userId)
    console.log('User ID type:', typeof userId)

    // Convert userId to number for SQL Server
    const userIdNumber = Number(userId)
    console.log('Converted user ID:', userIdNumber, 'type:', typeof userIdNumber)

    // Get basic card counts
    const totalCards = await prisma.user_card.count({
      where: {
        user: userIdNumber
      }
    })

    // Get graded cards count (cards with a grade) - just check for not null
    const gradedCards = await prisma.user_card.count({
      where: {
        user: userIdNumber,
        grade: {
          not: null
        }
      }
    })

    // Get card type counts, unique series, and unique players using simple raw SQL
    const cardTypeCounts = await prisma.$queryRaw`
      SELECT 
        SUM(CASE WHEN c.is_rookie = 1 THEN 1 ELSE 0 END) as rookie_count,
        SUM(CASE WHEN c.is_autograph = 1 THEN 1 ELSE 0 END) as autograph_count,
        SUM(CASE WHEN c.is_relic = 1 THEN 1 ELSE 0 END) as relic_count,
        COUNT(DISTINCT c.series) as unique_series_count,
        COUNT(DISTINCT pt.player) as unique_players_count
      FROM user_card uc
      JOIN card c ON uc.card = c.card_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      WHERE uc.[user] = ${userIdNumber}
    `

    const cardTypes = cardTypeCounts[0]
    console.log('Card type counts:', cardTypes)

    // Get total value using a separate simple query to avoid conversion issues
    let totalValue = 0
    try {
      const valueResult = await prisma.$queryRaw`
        SELECT 
          ISNULL(SUM(
            CASE 
              WHEN ISNUMERIC(uc.estimated_value) = 1 
              THEN CAST(uc.estimated_value as decimal(10,2))
              ELSE 0 
            END
          ), 0) as total_value
        FROM user_card uc
        WHERE uc.[user] = ${userIdNumber}
      `
      totalValue = Number(valueResult[0]?.total_value || 0)
      console.log('Total value calculated:', totalValue)
    } catch (valueError) {
      console.log('Error calculating total value, using 0:', valueError.message)
      totalValue = 0
    }

    console.log('Basic counts - Total:', totalCards, 'Graded:', gradedCards)

    // Return stats with all counts
    const stats = {
      total_cards: totalCards,
      total_value: totalValue,
      unique_players: Number(cardTypes.unique_players_count || 0),
      unique_series: Number(cardTypes.unique_series_count || 0),
      rookie_cards: Number(cardTypes.rookie_count || 0),
      autograph_cards: Number(cardTypes.autograph_count || 0),
      relic_cards: Number(cardTypes.relic_count || 0),
      graded_cards: gradedCards
    }

    console.log('Collection stats:', stats)

    res.json({
      stats: stats
    })

  } catch (error) {
    console.error('Error getting collection stats:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get collection statistics'
    })
  }
})

module.exports = router