const express = require('express')
const { PrismaClient } = require('@prisma/client')
const router = express.Router()
const prisma = new PrismaClient()

// GET /api/series-by-set/:setId - Get series for a specific set
router.get('/:setId', async (req, res) => {
  try {
    const { setId } = req.params

    console.log('Getting series for set:', setId)

    // Get series for the specified set
    const seriesBySetQuery = `
      SELECT 
        s.series_id,
        s.name,
        s.card_count,
        s.card_entered_count,
        s.rookie_count,
        s.is_base,
        s.parallel_of_series,
        parent_s.name as parent_series_name,
        s.print_run_variations,
        s.min_print_run,
        s.max_print_run,
        s.print_run_display,
        s.color as color_id,
        c.name as color_name,
        c.hex_value as color_hex_value,
        s.front_image_path,
        s.back_image_path
      FROM series s
      LEFT JOIN series parent_s ON s.parallel_of_series = parent_s.series_id
      LEFT JOIN color c ON s.color = c.color_id
      WHERE s.[set] = ${parseInt(setId)} AND s.card_count > 0
      ORDER BY s.is_base DESC, s.name ASC
    `

    const series = await prisma.$queryRawUnsafe(seriesBySetQuery)

    // Serialize BigInt values and process metadata
    const serializedSeries = series.map(serie => {
      // Extract year from series name (e.g., "1952 Bowman" -> 1952)
      const yearMatch = serie.name.match(/(\d{4})/)
      const year = yearMatch ? parseInt(yearMatch[1]) : null
      
      // Use existing print_run_display or create from min/max values
      let printRunDisplay = serie.print_run_display
      const printRunVars = Number(serie.print_run_variations || 0)
      
      if (!printRunDisplay) {
        const minPrint = serie.min_print_run ? Number(serie.min_print_run) : null
        const maxPrint = serie.max_print_run ? Number(serie.max_print_run) : null
        
        if (minPrint && maxPrint) {
          if (printRunVars === 1) {
            printRunDisplay = `/${minPrint}`
          } else {
            printRunDisplay = `up to /${maxPrint}`
          }
        }
      }
      
      return {
        series_id: Number(serie.series_id),
        name: serie.name,
        year: year,
        card_count: Number(serie.card_count),
        card_entered_count: Number(serie.card_entered_count || 0),
        rookie_count: Number(serie.rookie_count || 0),
        is_base: !!serie.is_base,
        is_parallel: !!serie.parallel_of_series,
        parallel_of_series: serie.parallel_of_series ? Number(serie.parallel_of_series) : null,
        parent_series_name: serie.parent_series_name,
        print_run_display: printRunDisplay,
        print_run_uniform: printRunVars <= 1,
        color_uniform: !!serie.color_name,
        color_id: serie.color_id ? Number(serie.color_id) : null,
        color_name: serie.color_name,
        color_hex_value: serie.color_hex_value,
        front_image_path: serie.front_image_path,
        back_image_path: serie.back_image_path
      }
    })

    res.json({
      series: serializedSeries,
      total: serializedSeries.length
    })

  } catch (error) {
    console.error('Error fetching series by set:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch series for set',
      details: error.message
    })
  }
})

module.exports = router