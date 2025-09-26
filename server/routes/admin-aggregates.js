const express = require('express')
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const sql = require('mssql')
const router = express.Router()

// Parse DATABASE_URL for mssql connection
const parseConnectionString = (connectionString) => {
  // Handle SQL Server connection string format: sqlserver://host:port;param=value;param=value
  const parts = connectionString.split(';')
  const serverPart = parts[0] // sqlserver://localhost:1433
  
  // Extract server and port from first part
  const serverMatch = serverPart.match(/sqlserver:\/\/([^:]+):?(\d+)?/)
  const server = serverMatch ? serverMatch[1] : 'localhost'
  const port = serverMatch && serverMatch[2] ? parseInt(serverMatch[2]) : 1433
  
  // Parse remaining parameters
  const params = {}
  parts.slice(1).forEach(part => {
    const [key, value] = part.split('=')
    if (key && value) {
      params[key] = value
    }
  })
  
  const config = {
    server: server,
    port: port,
    database: params.database || 'CollectYourCards',
    user: params.user || 'sa',
    password: params.password || '',
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000
    },
    options: {
      encrypt: params.encrypt === 'true',
      trustServerCertificate: params.trustServerCertificate === 'true'
    }
  }
  return config
}

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
    
    let config;
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
      // Production: use DATABASE_URL parser
      config = parseConnectionString(process.env.DATABASE_URL)
    } else {
      // Development: use existing environment variables
      config = {
        server: process.env.DB_SERVER || 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 1433,
        database: process.env.DB_NAME || 'CollectYourCards',
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || 'Password123',
        options: {
          encrypt: false,
          trustServerCertificate: true
        }
      }
    }
    
    const pool = await sql.connect(config)

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
            SELECT MAX(CAST(card_number AS INT))
            FROM card
            WHERE card.series = series.series_id
            AND ISNUMERIC(card_number) = 1
          )
          WHERE EXISTS (
            SELECT 1 FROM card 
            WHERE card.series = series.series_id 
            AND ISNUMERIC(card_number) = 1
          )
        `)
        rowsUpdated = cardCountResult.rowsAffected[0]
        console.log(`Updated card counts for ${rowsUpdated} series`)
        break

      case 'player_card_count':
        // Update card count for each player
        const playerResult = await pool.request().query(`
          UPDATE player
          SET card_count = (
            SELECT COUNT(DISTINCT c.card_id)
            FROM card c
            INNER JOIN card_player_team cpt ON c.card_id = cpt.card
            INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
            WHERE pt.player = player.player_id
          )
        `)
        rowsUpdated = playerResult.rowsAffected[0]
        console.log(`Updated card counts for ${rowsUpdated} players`)
        break

      case 'team_card_count':
        // Update card count for each team
        const teamResult = await pool.request().query(`
          UPDATE team
          SET card_count = (
            SELECT COUNT(DISTINCT c.card_id)
            FROM card c
            INNER JOIN card_player_team cpt ON c.card_id = cpt.card
            INNER JOIN player_team pt ON cpt.player_team = pt.player_team_id
            WHERE pt.team = team.team_Id
          )
        `)
        rowsUpdated = teamResult.rowsAffected[0]
        console.log(`Updated card counts for ${rowsUpdated} teams`)
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
  try {
    let config;
    if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
      // Production: use DATABASE_URL parser
      config = parseConnectionString(process.env.DATABASE_URL)
    } else {
      // Development: use existing environment variables
      config = {
        server: process.env.DB_SERVER || 'localhost',
        port: process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 1433,
        database: process.env.DB_NAME || 'CollectYourCards',
        user: process.env.DB_USER || 'sa',
        password: process.env.DB_PASSWORD || 'Password123',
        options: {
          encrypt: false,
          trustServerCertificate: true
        }
      }
    }
    
    const pool = await sql.connect(config)
    
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
  }
})

module.exports = router