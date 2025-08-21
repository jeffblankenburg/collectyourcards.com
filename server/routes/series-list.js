const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()
const prisma = new PrismaClient()

// GET /api/series-list - Get top series by card count
router.get('/', async (req, res) => {
  try {
    const { limit = 50 } = req.query
    const limitNum = Math.min(parseInt(limit) || 50, 100)

    console.log('Getting top series list with limit:', limitNum)

    // Get top series by card count
    const topSeries = await prisma.$queryRaw`
      SELECT TOP ${limitNum}
        s.series_id,
        s.name,
        s.year,
        m.name as manufacturer_name,
        COUNT(DISTINCT c.card_id) as card_count,
        COUNT(DISTINCT p.player_id) as player_count,
        MIN(c.sort_order) as min_card_number,
        MAX(c.sort_order) as max_card_number
      FROM series s
      LEFT JOIN manufacturer m ON s.manufacturer = m.manufacturer_id
      JOIN card c ON s.series_id = c.series
      JOIN card_player_team cpt ON c.card_id = cpt.card
      JOIN player_team pt ON cpt.player_team = pt.player_team_id
      JOIN player p ON pt.player = p.player_id
      GROUP BY s.series_id, s.name, s.year, m.name
      ORDER BY COUNT(DISTINCT c.card_id) DESC
    `

    // Serialize BigInt values
    const serializedSeries = topSeries.map(series => ({
      series_id: Number(series.series_id),
      name: series.name,
      year: Number(series.year),
      manufacturer_name: series.manufacturer_name,
      card_count: Number(series.card_count),
      player_count: Number(series.player_count),
      min_card_number: Number(series.min_card_number),
      max_card_number: Number(series.max_card_number)
    }))

    res.json({
      series: serializedSeries,
      total: serializedSeries.length
    })

  } catch (error) {
    console.error('Error fetching series list:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch series list',
      details: error.message
    })
  }
})

module.exports = router