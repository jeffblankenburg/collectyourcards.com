const express = require('express')
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware } = require('../middleware/auth')

const router = express.Router()

// Update series metadata (colors and print runs) based on card data
router.post('/update-from-cards', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!['admin', 'superadmin', 'data_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const { dryRun = true } = req.body // Default to dry run for safety

    console.log(`Starting series metadata update (dry run: ${dryRun})...`)

    // Get all series to analyze
    const allSeries = await prisma.$queryRawUnsafe(`
      SELECT series_id, name, print_run_display, parallel_of_series
      FROM series
      ORDER BY series_id
    `)

    const updates = []
    let seriesProcessed = 0
    let seriesUpdated = 0

    for (const series of allSeries) {
      seriesProcessed++

      // Get all print_run values for cards in this series
      const cardPrintRuns = await prisma.$queryRawUnsafe(`
        SELECT DISTINCT print_run
        FROM card
        WHERE series = ${series.series_id}
          AND print_run IS NOT NULL
        ORDER BY print_run DESC
      `)

      // Determine the appropriate print_run_display
      let newPrintRunDisplay = null

      if (cardPrintRuns.length > 0) {
        const printRunValues = cardPrintRuns.map(row => Number(row.print_run))

        if (printRunValues.length === 1) {
          // All cards have the same print run
          newPrintRunDisplay = `/${printRunValues[0]}`
        } else {
          // Cards have different print runs - use the highest
          const maxPrintRun = Math.max(...printRunValues)
          newPrintRunDisplay = `up to /${maxPrintRun}`
        }
      }

      // Check if we need to update
      const currentValue = series.print_run_display
      const needsUpdate = newPrintRunDisplay && newPrintRunDisplay !== currentValue

      if (needsUpdate) {
        seriesUpdated++

        updates.push({
          series_id: Number(series.series_id),
          series_name: series.name,
          old_print_run_display: currentValue,
          new_print_run_display: newPrintRunDisplay,
          card_count: cardPrintRuns.length
        })

        // Apply update if not a dry run
        if (!dryRun) {
          await prisma.$queryRawUnsafe(`
            UPDATE series
            SET print_run_display = '${newPrintRunDisplay.replace(/'/g, "''")}'
            WHERE series_id = ${series.series_id}
          `)
        }
      }

      // Log progress every 100 series
      if (seriesProcessed % 100 === 0) {
        console.log(`Processed ${seriesProcessed}/${allSeries.length} series...`)
      }
    }

    console.log(`Series metadata update complete!`)
    console.log(`Processed: ${seriesProcessed} series`)
    console.log(`Updated: ${seriesUpdated} series`)

    res.json({
      success: true,
      dryRun,
      summary: {
        total_series_processed: seriesProcessed,
        series_updated: seriesUpdated,
        series_unchanged: seriesProcessed - seriesUpdated
      },
      updates: updates.slice(0, 100) // Return first 100 updates for preview
    })

  } catch (error) {
    console.error('Series metadata update error:', error)
    res.status(500).json({
      error: 'Failed to update series metadata',
      message: error.message
    })
  }
})

// Get preview of changes without applying them
router.get('/preview-updates', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (!['admin', 'superadmin', 'data_admin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Unauthorized' })
    }

    const limit = parseInt(req.query.limit) || 20

    // Get series that would be updated
    const seriesNeedingUpdate = await prisma.$queryRawUnsafe(`
      SELECT TOP ${limit}
        s.series_id,
        s.name,
        s.print_run_display,
        COUNT(DISTINCT c.print_run) as unique_print_runs,
        MAX(c.print_run) as max_print_run,
        COUNT(c.card_id) as total_cards
      FROM series s
      JOIN card c ON s.series_id = c.series
      WHERE c.print_run IS NOT NULL
      GROUP BY s.series_id, s.name, s.print_run_display
      HAVING COUNT(DISTINCT c.print_run) > 0
      ORDER BY s.series_id DESC
    `)

    const previews = seriesNeedingUpdate.map(series => {
      const uniqueCount = Number(series.unique_print_runs)
      const maxPrintRun = Number(series.max_print_run)

      let suggestedValue = null
      if (uniqueCount === 1) {
        suggestedValue = `/${maxPrintRun}`
      } else {
        suggestedValue = `up to /${maxPrintRun}`
      }

      return {
        series_id: Number(series.series_id),
        series_name: series.name,
        current_value: series.print_run_display,
        suggested_value: suggestedValue,
        needs_update: suggestedValue !== series.print_run_display,
        total_cards: Number(series.total_cards),
        unique_print_runs: uniqueCount
      }
    })

    res.json({
      success: true,
      previews: previews.filter(p => p.needs_update),
      total_shown: previews.filter(p => p.needs_update).length
    })

  } catch (error) {
    console.error('Preview error:', error)
    res.status(500).json({
      error: 'Failed to preview updates',
      message: error.message
    })
  }
})

module.exports = router
