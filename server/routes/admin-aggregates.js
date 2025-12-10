const express = require('express')
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const { sql, getDbConfig } = require('../config/mssql')
const router = express.Router()

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// POST /api/admin/aggregates/update - Update aggregate fields
router.post('/aggregates/update', async (req, res) => {
  try {
    const { type } = req.body
    
    if (!type) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Aggregate type is required'
      })
    }

    let rowsUpdated = 0

    const config = getDbConfig()
    config.requestTimeout = 300000 // 5 minutes for large aggregate queries

    let pool
    try {
      pool = await sql.connect(config)
    } catch (connectionError) {
      console.error('Failed to connect to database:', connectionError)
      return res.status(500).json({
        error: 'Database connection error',
        message: 'Failed to connect to database',
        details: connectionError.message
      })
    }

    try {
    switch (type) {
      case 'rookie_count':
        // Update rookie count for each series
        const rookieResult = await pool.request().query(`
          UPDATE series
          SET rookie_count = (
            SELECT COUNT(*)
            FROM card
            WHERE card.series = series.series_id
            AND card.is_rookie = 1
          )
        `)
        rowsUpdated = rookieResult.rowsAffected[0]
        console.log(`Updated rookie counts for ${rowsUpdated} series`)
        break

      case 'card_entered_count':
        // Update cards entered count for each series
        const enteredResult = await pool.request().query(`
          UPDATE series
          SET card_entered_count = (
            SELECT COUNT(*)
            FROM card
            WHERE card.series = series.series_id
          )
        `)
        rowsUpdated = enteredResult.rowsAffected[0]
        console.log(`Updated cards entered counts for ${rowsUpdated} series`)
        break

      case 'card_count':
        // This is typically the expected total cards in a series
        // Usually set manually, but we can update based on highest card number
        const cardCountResult = await pool.request().query(`
          UPDATE series
          SET card_count = (
            SELECT MAX(TRY_CAST(card_number AS INT))
            FROM card
            WHERE card.series = series.series_id
            AND TRY_CAST(card_number AS INT) IS NOT NULL
          )
          WHERE EXISTS (
            SELECT 1 FROM card
            WHERE card.series = series.series_id
            AND TRY_CAST(card_number AS INT) IS NOT NULL
          )
        `)
        rowsUpdated = cardCountResult.rowsAffected[0]
        console.log(`Updated card counts for ${rowsUpdated} series`)
        break

      case 'player_card_count':
        // OPTIMIZED: Update card counts using CTE in a single query
        console.log('🚀 Starting optimized player card count update...')
        
        // Use a CTE (Common Table Expression) to calculate and update in one query
        const playerResult = await pool.request().query(`
          -- Calculate counts and update in a single operation
          WITH PlayerCardCounts AS (
            SELECT 
              pt.player as player_id,
              COUNT(DISTINCT c.card_id) as card_count
            FROM player_team pt
            INNER JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
            INNER JOIN card c ON cpt.card = c.card_id
            GROUP BY pt.player
          )
          UPDATE p
          SET p.card_count = COALESCE(pcc.card_count, 0)
          FROM player p
          LEFT JOIN PlayerCardCounts pcc ON p.player_id = pcc.player_id
        `)
        
        rowsUpdated = playerResult.rowsAffected[0]
        console.log(`✅ Updated card counts for ${rowsUpdated} players`)
        break

      case 'team_card_count':
        // OPTIMIZED: Update team card counts using CTE in a single query
        console.log('🚀 Starting optimized team card count update...')

        // Use a CTE to calculate and update in one query
        const teamResult = await pool.request().query(`
          -- Calculate counts and update in a single operation
          WITH TeamCardCounts AS (
            SELECT
              pt.team as team_id,
              COUNT(DISTINCT c.card_id) as card_count
            FROM player_team pt
            INNER JOIN card_player_team cpt ON pt.player_team_id = cpt.player_team
            INNER JOIN card c ON cpt.card = c.card_id
            GROUP BY pt.team
          )
          UPDATE t
          SET t.card_count = COALESCE(tcc.card_count, 0)
          FROM team t
          LEFT JOIN TeamCardCounts tcc ON t.team_Id = tcc.team_id
        `)

        rowsUpdated = teamResult.rowsAffected[0]
        console.log(`✅ Updated card counts for ${rowsUpdated} teams`)
        break

      case 'series_print_run':
        // Update series print_run fields based on card data
        console.log('🚀 Starting series print_run aggregation...')

        // Use a CTE to calculate print_run statistics for each series
        const printRunResult = await pool.request().query(`
          -- Calculate print_run statistics and update in a single operation
          WITH SeriesPrintRunStats AS (
            SELECT
              c.series as series_id,
              MIN(c.print_run) as min_pr,
              MAX(c.print_run) as max_pr,
              COUNT(DISTINCT c.print_run) as variations,
              -- Generate display string:
              -- If all cards have same print_run: "/{value}"
              -- If cards have different print_runs: "up to /{max_value}"
              CASE
                WHEN COUNT(DISTINCT c.print_run) = 1 THEN '/' + CAST(MAX(c.print_run) AS NVARCHAR(50))
                WHEN COUNT(DISTINCT c.print_run) > 1 THEN 'up to /' + CAST(MAX(c.print_run) AS NVARCHAR(50))
                ELSE NULL
              END as display_string
            FROM card c
            WHERE c.print_run IS NOT NULL
            GROUP BY c.series
          )
          UPDATE s
          SET
            s.min_print_run = sprs.min_pr,
            s.max_print_run = sprs.max_pr,
            s.print_run_variations = sprs.variations,
            s.print_run_display = sprs.display_string
          FROM series s
          INNER JOIN SeriesPrintRunStats sprs ON s.series_id = sprs.series_id
        `)

        rowsUpdated = printRunResult.rowsAffected[0]
        console.log(`✅ Updated print_run data for ${rowsUpdated} series`)
        break

      default:
        return res.status(400).json({
          error: 'Invalid type',
          message: `Unknown aggregate type: ${type}`
        })
    }

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'AGGREGATES_UPDATED',
          entity_type: 'aggregates',
          entity_id: type,
          new_values: JSON.stringify({ rowsUpdated }),
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
    }

    res.json({
      success: true,
      message: `Successfully updated ${type} aggregates`,
      rowsUpdated
    })

    } catch (queryError) {
      console.error('Error executing aggregate query:', queryError)
      res.status(500).json({
        error: 'Database error',
        message: 'Failed to update aggregates',
        details: queryError.message
      })
    } finally {
      // Always close the pool connection
      if (pool) {
        try {
          await pool.close()
          console.log('SQL connection pool closed')
        } catch (closeError) {
          console.error('Error closing SQL pool:', closeError)
        }
      }
    }

  } catch (error) {
    console.error('Error updating aggregates:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update aggregates',
      details: error.message
    })
  }
})

// GET /api/admin/aggregates/status - Get current aggregate status
router.get('/aggregates/status', async (req, res) => {
  let pool
  try {
    const config = getDbConfig()
    config.requestTimeout = 300000 // 5 minutes for large aggregate queries

    pool = await sql.connect(config)

    // Check for series with mismatched counts
    const seriesIssues = await pool.request().query(`
      SELECT 
        s.series_id,
        s.name,
        s.rookie_count as stored_rookie_count,
        s.card_entered_count as stored_entered_count,
        (SELECT COUNT(*) FROM card WHERE series = s.series_id AND is_rookie = 1) as actual_rookie_count,
        (SELECT COUNT(*) FROM card WHERE series = s.series_id) as actual_entered_count
      FROM series s
      WHERE 
        s.rookie_count != (SELECT COUNT(*) FROM card WHERE series = s.series_id AND is_rookie = 1)
        OR s.card_entered_count != (SELECT COUNT(*) FROM card WHERE series = s.series_id)
    `)

    // Check for players with mismatched counts
    const playerIssues = await pool.request().query(`
      SELECT 
        p.player_id,
        p.first_name,
        p.last_name,
        p.card_count as stored_count,
        (SELECT COUNT(DISTINCT c.card_id)
         FROM card c
         INNER JOIN card_player_team cpt ON c.card_id = cpt.card
         INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
         WHERE pt.player = p.player_id) as actual_count
      FROM player p
      WHERE 
        p.card_count != (
          SELECT COUNT(DISTINCT c.card_id)
          FROM card c
          INNER JOIN card_player_team cpt ON c.card_id = cpt.card
          INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
          WHERE pt.player = p.player_id
        )
    `)

    res.json({
      seriesWithIssues: seriesIssues.recordset.length,
      playersWithIssues: playerIssues.recordset.length,
      issues: {
        series: seriesIssues.recordset.slice(0, 10), // Show first 10
        players: playerIssues.recordset.slice(0, 10)  // Show first 10
      }
    })

  } catch (error) {
    console.error('Error checking aggregate status:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to check aggregate status',
      details: error.message
    })
  } finally {
    // Always close the pool connection
    if (pool) {
      try {
        await pool.close()
        console.log('SQL connection pool closed (status endpoint)')
      } catch (closeError) {
        console.error('Error closing SQL pool:', closeError)
      }
    }
  }
})

module.exports = router