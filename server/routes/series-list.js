const express = require('express')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')

// GET /api/series-list - Get top series by card count
router.get('/', async (req, res) => {
  try {
    const { limit } = req.query
    const useLimit = limit && parseInt(limit) > 0
    const limitNum = useLimit ? parseInt(limit) : null

    console.log('Getting series list', useLimit ? `with limit: ${limitNum}` : 'without limit')

    // Get ALL series with pre-calculated metadata (including series with 0 cards)
    const topSeriesQuery = `
      SELECT ${useLimit ? `TOP ${limitNum}` : ''}
        s.series_id,
        s.name,
        s.card_count,
        s.parallel_of_series,
        parent_s.name as parent_series_name,
        s.print_run_variations,
        s.min_print_run,
        s.max_print_run,
        s.color as color_id,
        c.name as color_name,
        c.hex_value as color_hex_value,
        s.front_image_path,
        s.back_image_path
      FROM series s
      LEFT JOIN series parent_s ON s.parallel_of_series = parent_s.series_id
      LEFT JOIN color c ON s.color = c.color_id
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
      
      return {
        series_id: Number(series.series_id),
        name: series.name,
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
        front_image_path: series.front_image_path,
        back_image_path: series.back_image_path
      }
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

module.exports = router