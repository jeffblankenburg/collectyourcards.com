const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()
const prisma = new PrismaClient()

// GET /api/grading-agencies - Get all grading agencies
router.get('/', async (req, res) => {
  try {
    console.log('Getting grading agencies')

    const agencies = await prisma.$queryRaw`
      SELECT 
        grading_agency_id,
        name,
        abbreviation
      FROM grading_agency 
      ORDER BY name
    `

    const serializedAgencies = agencies.map(agency => {
      const serialized = {}
      Object.keys(agency).forEach(key => {
        serialized[key] = typeof agency[key] === 'bigint' ? Number(agency[key]) : agency[key]
      })
      return serialized
    })

    res.json({
      agencies: serializedAgencies
    })

  } catch (error) {
    console.error('Error getting grading agencies:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to get grading agencies'
    })
  }
})

module.exports = router