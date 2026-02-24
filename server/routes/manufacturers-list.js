const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

// GET /api/manufacturers-list - Get all manufacturers (public endpoint)
router.get('/', async (req, res) => {
  try {
    const manufacturers = await prisma.manufacturer.findMany({
      select: {
        manufacturer_id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    res.json({
      manufacturers: manufacturers.map(m => ({
        manufacturer_id: Number(m.manufacturer_id),
        name: m.name
      })),
      total: manufacturers.length
    })

  } catch (error) {
    console.error('Error fetching manufacturers:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch manufacturers',
      details: error.message
    })
  }
})

module.exports = router
