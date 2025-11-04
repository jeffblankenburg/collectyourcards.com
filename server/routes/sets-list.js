const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

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
        st.slug,
        st.manufacturer as manufacturer_id,
        st.organization as organization_id,
        st.year,
        st.thumbnail,
        st.is_complete,
        m.name as manufacturer_name,
        o.abbreviation as organization_abbrev,
        o.name as organization_name,
        ISNULL(SUM(s.card_count), 0) as total_card_count,
        COUNT(s.series_id) as series_count
      FROM [set] st
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN organization o ON st.organization = o.organization_id
      LEFT JOIN series s ON st.set_id = s.[set]
      GROUP BY st.set_id, st.name, st.slug, st.manufacturer, st.organization, st.year, st.thumbnail, st.is_complete, m.name, o.abbreviation, o.name
      ORDER BY ISNULL(SUM(s.card_count), 0) DESC, st.name ASC
    `

    const topSets = await prisma.$queryRawUnsafe(topSetsQuery)

    // Serialize BigInt values
    const serializedSets = topSets.map(set => ({
      set_id: Number(set.set_id),
      name: set.name,
      slug: set.slug, // Include stored slug
      year: Number(set.year || 0),
      manufacturer_id: Number(set.manufacturer_id || 0),
      manufacturer_name: set.manufacturer_name,
      organization_id: Number(set.organization_id || 0),
      organization: set.organization_abbrev,
      organization_name: set.organization_name,
      thumbnail: set.thumbnail,
      total_card_count: Number(set.total_card_count),
      series_count: Number(set.series_count),
      is_complete: Boolean(set.is_complete)
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