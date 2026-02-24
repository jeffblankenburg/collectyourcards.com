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

// GET /api/sets-list/search - Search sets by name
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query

    if (!q || q.length < 2) {
      return res.json({ sets: [] })
    }

    const searchTerm = q.replace(/'/g, "''") // Escape single quotes
    const limitNum = Math.min(parseInt(limit) || 10, 50)

    const results = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limitNum}
        st.set_id,
        st.name,
        st.slug,
        st.year,
        m.name as manufacturer_name,
        ISNULL(SUM(s.card_count), 0) as total_card_count
      FROM [set] st
      LEFT JOIN manufacturer m ON st.manufacturer = m.manufacturer_id
      LEFT JOIN series s ON st.set_id = s.[set]
      WHERE st.name LIKE '%${searchTerm}%'
         OR m.name LIKE '%${searchTerm}%'
         OR CONCAT(st.year, ' ', st.name) LIKE '%${searchTerm}%'
      GROUP BY st.set_id, st.name, st.slug, st.year, m.name
      ORDER BY
        CASE WHEN st.name LIKE '${searchTerm}%' THEN 0 ELSE 1 END,
        st.year DESC,
        st.name
    `)

    const sets = results.map(s => ({
      set_id: Number(s.set_id),
      name: s.name,
      slug: s.slug,
      year: Number(s.year || 0),
      manufacturer_name: s.manufacturer_name,
      total_card_count: Number(s.total_card_count)
    }))

    res.json({ sets })
  } catch (error) {
    console.error('Error searching sets:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to search sets'
    })
  }
})

// GET /api/sets-list/:id/history - Get change history for a set
router.get('/:id/history', async (req, res) => {
  try {
    const setId = parseInt(req.params.id)
    const limit = Math.min(parseInt(req.query.limit) || 50, 100)

    if (isNaN(setId)) {
      return res.status(400).json({ error: 'Invalid set ID' })
    }

    // Fetch all approved submissions for this set (the audit trail)
    const submissions = await prisma.set_submissions.findMany({
      where: {
        set_id: setId,
        status: 'approved'
      },
      orderBy: {
        created_at: 'desc'
      },
      take: limit,
      include: {
        user_set_submissions_user_idTouser: {
          select: {
            user_id: true,
            email: true,
            name: true,
            avatar_url: true
          }
        }
      }
    })

    // Transform the data for the frontend
    const history = submissions.map(sub => {
      const changes = []

      // Compare previous vs proposed for each field
      if (sub.previous_name !== sub.proposed_name) {
        changes.push({
          field: 'Name',
          from: sub.previous_name || '(empty)',
          to: sub.proposed_name || '(empty)'
        })
      }
      if (sub.previous_year !== sub.proposed_year) {
        changes.push({
          field: 'Year',
          from: sub.previous_year?.toString() || '(none)',
          to: sub.proposed_year?.toString() || '(none)'
        })
      }
      if (sub.previous_sport !== sub.proposed_sport) {
        changes.push({
          field: 'Sport',
          from: sub.previous_sport || '(none)',
          to: sub.proposed_sport || '(none)'
        })
      }
      if (sub.previous_manufacturer !== sub.proposed_manufacturer) {
        changes.push({
          field: 'Manufacturer',
          from: sub.previous_manufacturer || '(none)',
          to: sub.proposed_manufacturer || '(none)'
        })
      }
      if (sub.previous_description !== sub.proposed_description) {
        changes.push({
          field: 'Description',
          from: sub.previous_description || '(empty)',
          to: sub.proposed_description || '(empty)'
        })
      }

      const user = sub.user_set_submissions_user_idTouser
      return {
        id: Number(sub.submission_id),
        timestamp: sub.reviewed_at || sub.created_at,
        user: {
          id: Number(user.user_id),
          name: user.name || user.email?.split('@')[0] || 'Unknown',
          avatar_url: user.avatar_url
        },
        changes,
        review_notes: sub.review_notes,
        is_admin_edit: sub.review_notes?.includes('Admin direct edit')
      }
    }).filter(h => h.changes.length > 0)

    res.json({
      history,
      total: history.length
    })

  } catch (error) {
    console.error('Error fetching set history:', error)
    res.status(500).json({
      error: 'Failed to fetch set history',
      message: error.message
    })
  }
})

// GET /api/sets-list/:id/series - Get all series for a set (public endpoint)
router.get('/:id/series', async (req, res) => {
  try {
    const setId = parseInt(req.params.id)

    if (isNaN(setId)) {
      return res.status(400).json({ error: 'Invalid set ID' })
    }

    const series = await prisma.series.findMany({
      where: {
        set: setId
      },
      select: {
        series_id: true,
        name: true,
        card_count: true,
        is_base: true,
        parallel_of_series: true,
        color: true,
        color_series_colorTocolor: {
          select: {
            name: true,
            hex_value: true
          }
        }
      },
      orderBy: [
        { is_base: 'desc' },
        { name: 'asc' }
      ]
    })

    const serializedSeries = series.map(s => ({
      series_id: Number(s.series_id),
      name: s.name,
      card_count: Number(s.card_count || 0),
      is_base: s.is_base,
      parallel_of_series: s.parallel_of_series ? Number(s.parallel_of_series) : null,
      color_id: s.color ? Number(s.color) : null,
      color_name: s.color_series_colorTocolor?.name || null,
      color_hex: s.color_series_colorTocolor?.hex_value || null
    }))

    res.json({
      series: serializedSeries,
      total: serializedSeries.length
    })

  } catch (error) {
    console.error('Error fetching series for set:', error)
    res.status(500).json({
      error: 'Failed to fetch series',
      message: error.message
    })
  }
})

module.exports = router