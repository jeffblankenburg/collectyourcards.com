const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

// GET /api/colors - Get all colors (public endpoint)
router.get('/', async (req, res) => {
  try {
    const colors = await prisma.color.findMany({
      select: {
        color_id: true,
        name: true,
        hex_value: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    // Serialize BigInt values
    const serializedColors = colors.map(color => ({
      color_id: Number(color.color_id),
      name: color.name,
      hex_value: color.hex_value
    }))

    res.json({
      colors: serializedColors,
      total: serializedColors.length
    })

  } catch (error) {
    console.error('Error fetching colors:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch colors',
      details: error.message
    })
  }
})

module.exports = router
