const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()
const prisma = new PrismaClient()

// GET /api/sets-list - Get top sets by card count
router.get('/', async (req, res) => {
  try {
    const { limit } = req.query
    const useLimit = limit && parseInt(limit) > 0
    const limitNum = useLimit ? parseInt(limit) : null

    console.log('Getting sets list', useLimit ? `with limit: ${limitNum}` : 'without limit')

    // Get ALL sets with their card count (including sets with 0 cards)
    const topSetsQuery = `
      SELECT ${useLimit ? `TOP ${limitNum}` : ''}
        st.set_id,
        st.name,
        st.manufacturer,
        st.organization,
        st.year,
        st.thumbnail,
        m.name as manufacturer_name,
        o.abbreviation as organization,
        ISNULL(SUM(s.card_count), 0) as total_card_count,
        COUNT(s.series_id) as series_count
      FROM [set] st
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN organization o ON st.organization = o.organization_id
      LEFT JOIN series s ON st.set_id = s.[set]
      GROUP BY st.set_id, st.name, st.manufacturer, st.organization, st.year, st.thumbnail, m.name, o.abbreviation
      ORDER BY ISNULL(SUM(s.card_count), 0) DESC, st.name ASC
    `

    const topSets = await prisma.$queryRawUnsafe(topSetsQuery)

    // Serialize BigInt values
    const serializedSets = topSets.map(set => ({
      set_id: Number(set.set_id),
      name: set.name,
      year: Number(set.year || 0),
      manufacturer_name: set.manufacturer_name,
      organization: set.organization,
      thumbnail: set.thumbnail,
      total_card_count: Number(set.total_card_count),
      series_count: Number(set.series_count)
    }))

    res.json({
      sets: serializedSets,
      total: serializedSets.length
    })

  } catch (error) {
    console.error('Error fetching sets list:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch sets list',
      details: error.message
    })
  }
})

module.exports = router