const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const { optionalAuthMiddleware } = require('../middleware/auth')

// GET /api/series-list - Get top series by card count
router.get('/', optionalAuthMiddleware, async (req, res) => {
  try {
    const { limit } = req.query
    const useLimit = limit && parseInt(limit) > 0
    const limitNum = useLimit ? parseInt(limit) : null
    const userId = req.user?.id

    console.log('Getting series list', useLimit ? `with limit: ${limitNum}` : 'without limit', userId ? `for user ${userId}` : '(no user)')

    // Get ALL series with pre-calculated metadata (including series with 0 cards)
    // If user is authenticated, also include their completion data
    const topSeriesQuery = `
      SELECT ${useLimit ? `TOP ${limitNum}` : ''}
        s.series_id,
        s.name,
        s.slug,
        s.card_count,
        s.parallel_of_series,
        parent_s.name as parent_series_name,
        s.print_run_variations,
        s.min_print_run,
        s.max_print_run,
        s.production_code,
        s.color as color_id,
        c.name as color_name,
        c.hex_value as color_hex_value,
        s.front_image_path,
        s.back_image_path
        ${userId ? `,
        usc.is_complete,
        usc.completion_percentage,
        usc.owned_cards` : ''}
      FROM series s
      LEFT JOIN series parent_s ON s.parallel_of_series = parent_s.series_id
      LEFT JOIN color c ON s.color = c.color_id
      ${userId ? `LEFT JOIN user_series_completion usc ON s.series_id = usc.series_id AND usc.user_id = ${parseInt(userId)}` : ''}
      ORDER BY s.name DESC
    `

    const topSeries = await prisma.$queryRawUnsafe(topSeriesQuery)

    // Serialize BigInt values (works with current database schema)
    const serializedSeries = topSeries.map(series => {
      // Extract year from series name (e.g., "1952 Bowman" -> 1952)
      const yearMatch = series.name.match(/(\d{4})/)
      const year = yearMatch ? parseInt(yearMatch[1]) : null
      
      // Create print run display from min/max values
      let printRunDisplay = null
      const minPrint = series.min_print_run ? Number(series.min_print_run) : null
      const maxPrint = series.max_print_run ? Number(series.max_print_run) : null
      const printRunVars = Number(series.print_run_variations || 0)
      
      if (minPrint && maxPrint) {
        if (printRunVars === 1) {
          printRunDisplay = `/${minPrint}`
        } else {
          printRunDisplay = `up to /${maxPrint}`
        }
      }
      
      const result = {
        series_id: Number(series.series_id),
        name: series.name,
        slug: series.slug,
        year: year,
        card_count: Number(series.card_count),
        is_parallel: !!series.parallel_of_series,
        parallel_of_series: series.parallel_of_series ? Number(series.parallel_of_series) : null,
        parent_series_name: series.parent_series_name,
        print_run_display: printRunDisplay,
        print_run_uniform: printRunVars <= 1,
        color_uniform: !!series.color_name,
        color_id: series.color_id ? Number(series.color_id) : null,
        color_name: series.color_name,
        color_hex_value: series.color_hex_value,
        production_code: series.production_code,
        front_image_path: series.front_image_path,
        back_image_path: series.back_image_path
      }

      // Add completion data if user is authenticated
      if (userId) {
        result.is_complete = series.is_complete || false
        result.completion_percentage = series.completion_percentage ? Number(series.completion_percentage) : 0
        result.owned_cards = series.owned_cards ? Number(series.owned_cards) : 0
      }

      return result
    })

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

// GET /api/series-list/:id - Get series details by ID
router.get('/:id', optionalAuthMiddleware, async (req, res) => {
  try {
    const seriesId = parseInt(req.params.id)
    const userId = req.user?.id

    if (isNaN(seriesId)) {
      return res.status(400).json({
        error: 'Invalid series ID',
        message: 'Series ID must be a number'
      })
    }

    console.log(`🔍 Fetching series with ID: ${seriesId}`)

    // Get series by ID with all related data
    const results = await prisma.$queryRawUnsafe(`
      SELECT
        s.series_id,
        s.name,
        s.slug,
        s.card_count,
        s.parallel_of_series,
        parent_s.name as parent_series_name,
        s.print_run_variations,
        s.min_print_run,
        s.max_print_run,
        s.production_code,
        s.color as color_id,
        c.name as color_name,
        c.hex_value as color_hex_value,
        s.front_image_path,
        s.back_image_path,
        st.set_id,
        st.name as set_name,
        st.slug as set_slug,
        st.year as set_year
        ${userId ? `,
        usc.is_complete,
        usc.completion_percentage,
        usc.owned_cards` : ''}
      FROM series s
      LEFT JOIN series parent_s ON s.parallel_of_series = parent_s.series_id
      LEFT JOIN color c ON s.color = c.color_id
      LEFT JOIN [set] st ON s.[set] = st.set_id
      ${userId ? `LEFT JOIN user_series_completion usc ON s.series_id = usc.series_id AND usc.user_id = ${parseInt(userId)}` : ''}
      WHERE s.series_id = ${seriesId}
    `)

    if (results.length === 0) {
      console.log(`❌ No series found with ID: ${seriesId}`)
      return res.status(404).json({
        error: 'Series not found',
        message: `No series found with ID: ${seriesId}`
      })
    }

    const series = results[0]
    console.log(`✅ Found series: ${series.name}`)

    // Create print run display
    let printRunDisplay = null
    const minPrint = series.min_print_run ? Number(series.min_print_run) : null
    const maxPrint = series.max_print_run ? Number(series.max_print_run) : null
    const printRunVars = Number(series.print_run_variations || 0)

    if (minPrint && maxPrint) {
      if (printRunVars === 1) {
        printRunDisplay = `/${minPrint}`
      } else {
        printRunDisplay = `up to /${maxPrint}`
      }
    }

    const response = {
      series: {
        series_id: Number(series.series_id),
        name: series.name,
        slug: series.slug,
        card_count: Number(series.card_count || 0),
        is_parallel: !!series.parallel_of_series,
        parallel_of_series: series.parallel_of_series ? Number(series.parallel_of_series) : null,
        parent_series_name: series.parent_series_name,
        print_run_display: printRunDisplay,
        print_run_uniform: printRunVars <= 1,
        color_id: series.color_id ? Number(series.color_id) : null,
        color_name: series.color_name,
        color_hex_value: series.color_hex_value,
        production_code: series.production_code,
        front_image_path: series.front_image_path,
        back_image_path: series.back_image_path,
        set_id: series.set_id ? Number(series.set_id) : null,
        set_name: series.set_name,
        set_slug: series.set_slug,
        set_year: series.set_year ? Number(series.set_year) : null
      }
    }

    // Add completion data if user is authenticated
    if (userId) {
      response.series.is_complete = series.is_complete || false
      response.series.completion_percentage = series.completion_percentage ? Number(series.completion_percentage) : 0
      response.series.owned_cards = series.owned_cards ? Number(series.owned_cards) : 0
    }

    res.json(response)

  } catch (error) {
    console.error('Error fetching series by ID:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch series details',
      details: error.message
    })
  }
})

module.exports = router