/**
 * Import Workflow Routes
 *
 * Orchestrates the card import process from parsing to database creation.
 * Handles XLSX uploads, pasted data, player/team matching, and bulk imports.
 *
 * @module routes/import-workflow
 */

const express = require('express')
const multer = require('multer')
const sql = require('mssql')
const router = express.Router()

// Middleware
const { authMiddleware: requireAuth, requireAdmin } = require('../middleware/auth')

// Services
const excelParser = require('../services/import/excel-parser')
const progressTracker = require('../services/import/progress-tracker')
const BatchLookupService = require('../services/import/batch-lookup')
const CardCreatorService = require('../services/import/card-creator')

// Helper function to generate URL slug
function generateSlug(name) {
  if (!name) return 'unknown'
  return name
    .toLowerCase()
    .replace(/&/g, 'and') // Convert ampersands to "and" to preserve semantic meaning
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// ============================================================================
// MULTER CONFIGURATION
// ============================================================================

const storage = multer.memoryStorage()
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') {
      cb(null, true)
    } else {
      cb(new Error('Only XLSX files are allowed'), false)
    }
  }
})

// ============================================================================
// DATABASE CONNECTION
// ============================================================================

let pool

/**
 * Parse DATABASE_URL for mssql connection
 *
 * @param {string} connectionString - SQL Server connection string
 * @returns {Object} - MSSQL connection config
 */
function parseConnectionString(connectionString) {
  // Handle SQL Server connection string format: sqlserver://host:port;param=value;param=value
  const parts = connectionString.split(';')
  const serverPart = parts[0] // sqlserver://hostname:port

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
      min: 2, // Keep 2 connections alive for import operations
      idleTimeoutMillis: 300000 // 5 minutes for large batch imports
    },
    connectionTimeout: 60000, // 60 seconds to establish connection
    requestTimeout: 300000, // 5 minutes for long-running queries
    options: {
      encrypt: params.encrypt === 'true',
      trustServerCertificate: params.trustServerCertificate === 'true'
    }
  }
  return config
}

/**
 * Connect to database (singleton pattern)
 *
 * @returns {Promise<ConnectionPool>} - MSSQL connection pool
 */
async function connectToDatabase() {
  if (!pool) {
    try {
      let config

      if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
        // Production: use DATABASE_URL parser
        config = parseConnectionString(process.env.DATABASE_URL)
        console.log('🌐 Using production DATABASE_URL connection')
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
        console.log('🏠 Using development connection to localhost')
      }

      pool = await sql.connect(config)
      console.log('✅ Database connection initialized for import routes')
    } catch (error) {
      console.error('❌ Database connection failed for import routes:', error)
      throw error
    }
  }
  return pool
}

// ============================================================================
// ROUTE HANDLERS
// ============================================================================

/**
 * GET /match-progress/:jobId
 *
 * Check progress of a matching job
 */
router.get('/match-progress/:jobId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params
    const progress = progressTracker.getProgress(jobId)
    res.json(progress)
  } catch (error) {
    console.error('Error getting match progress:', error)
    res.status(500).json({ message: 'Failed to get progress' })
  }
})

/**
 * POST /parse-xlsx
 *
 * Parse XLSX file upload
 */
router.post('/parse-xlsx', requireAuth, requireAdmin, upload.single('xlsx'), async (req, res) => {
  try {
    console.log('📁 XLSX Parse request received')
    console.log('File info:', req.file ? {
      originalname: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype
    } : 'NO FILE')

    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' })
    }

    const seriesId = req.body.seriesId
    console.log('Series ID:', seriesId)

    if (!seriesId) {
      return res.status(400).json({ message: 'Series ID is required' })
    }

    // Parse XLSX using service
    const cards = await excelParser.parseXlsxFile(req.file.buffer)

    res.json({
      success: true,
      cards: cards,
      message: `Successfully parsed ${cards.length} cards`
    })
  } catch (error) {
    console.error('Error parsing XLSX:', error)
    res.status(500).json({
      message: 'Failed to parse XLSX file',
      error: error.message
    })
  }
})

/**
 * POST /parse-pasted
 *
 * Parse pasted tab-separated data
 */
router.post('/parse-pasted', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('📋 Pasted data parse request received')

    const { data, seriesId } = req.body

    if (!data || !data.trim()) {
      return res.status(400).json({ message: 'No data provided' })
    }

    if (!seriesId) {
      return res.status(400).json({ message: 'Series ID is required' })
    }

    console.log('Series ID:', seriesId)
    console.log('Data length:', data.length, 'characters')

    // Parse pasted data using service
    const cards = await excelParser.parsePastedData(data)

    res.json({
      success: true,
      cards: cards,
      message: `Successfully parsed ${cards.length} cards`
    })
  } catch (error) {
    console.error('Error parsing pasted data:', error)
    res.status(500).json({
      message: 'Failed to parse pasted data',
      error: error.message
    })
  }
})

/**
 * POST /match-cards
 *
 * Match parsed cards to database players and teams
 * Uses 4-phase optimization:
 * 1. Extract unique names
 * 2. Batch lookup players/teams
 * 3. Collect actual player-team combinations
 * 4. Fast matching using cached lookups
 */
router.post('/match-cards', requireAuth, requireAdmin, async (req, res) => {
  const jobId = progressTracker.createJob('match')
  let cards = []

  try {
    const { cards: cardsFromBody, seriesId } = req.body
    cards = cardsFromBody

    if (!cards || !Array.isArray(cards)) {
      return res.status(400).json({ message: 'Cards array is required' })
    }

    console.log(`🚀 Starting OPTIMIZED matching job ${jobId} for ${cards.length} cards`)

    const pool = await connectToDatabase()
    const batchLookupService = new BatchLookupService(pool)

    // Get the organization for this series to filter player matches
    const orgResult = await pool.request()
      .input('seriesId', sql.BigInt, seriesId)
      .query(`
        SELECT o.organization_id, o.name as organization_name
        FROM series s
        JOIN [set] st ON s.[set] = st.set_id
        JOIN organization o ON st.organization = o.organization_id
        WHERE s.series_id = @seriesId
      `)

    const organizationId = orgResult.recordset.length > 0 ? orgResult.recordset[0].organization_id : null
    const organizationName = orgResult.recordset.length > 0 ? orgResult.recordset[0].organization_name : null

    console.log(`🏈 Import series organization: ${organizationName} (ID: ${organizationId})`)

    // Phase 1: Extract all unique player and team names
    progressTracker.updateProgress(jobId, {
      total: cards.length,
      processed: 0,
      status: 'extracting_names'
    })

    console.log('📋 Phase 1: Extracting unique names...')
    const allPlayerNames = new Set()
    const allTeamNames = new Set()

    cards.forEach(card => {
      // playerNames and teamNames are already arrays from excel-parser
      const playerNamesList = Array.isArray(card.playerNames) ? card.playerNames : []
      const teamNamesList = Array.isArray(card.teamNames) ? card.teamNames : []

      playerNamesList.forEach(name => allPlayerNames.add(name))
      teamNamesList.forEach(name => allTeamNames.add(name))
    })

    console.log(`📊 Found ${allPlayerNames.size} unique players, ${allTeamNames.size} unique teams`)

    // Phase 2: Batch lookup all players and teams
    progressTracker.updateProgress(jobId, {
      total: cards.length,
      processed: 0,
      status: 'batch_lookup'
    })

    console.log('🔍 Phase 2: Batch player/team lookup...')
    const [playerLookup, teamLookup] = await Promise.all([
      batchLookupService.batchFindPlayers(Array.from(allPlayerNames), organizationId),
      batchLookupService.batchFindTeams(Array.from(allTeamNames), organizationId)
    ])

    console.log(`✅ Lookup complete: ${Object.keys(playerLookup).length} players, ${Object.keys(teamLookup).length} teams`)

    // Phase 3: Collect actual player-team combinations
    console.log('🤝 Phase 3: Collecting actual player-team combinations...')
    const actualCombinations = new Set()

    cards.forEach(card => {
      // playerNames and teamNames are already arrays from excel-parser
      const playerNamesList = Array.isArray(card.playerNames) ? card.playerNames : []
      const teamNamesList = Array.isArray(card.teamNames) ? card.teamNames : []

      playerNamesList.forEach(playerName => {
        const playerMatches = playerLookup[playerName]
        if (playerMatches?.exact?.length > 0) {
          teamNamesList.forEach(teamName => {
            const teamMatches = teamLookup[teamName]
            if (teamMatches?.exact?.length > 0) {
              playerMatches.exact.forEach(player => {
                teamMatches.exact.forEach(team => {
                  actualCombinations.add(`${player.playerId}_${team.teamId}`)
                })
              })
            }
          })
        }
      })
    })

    console.log(`🔍 Found ${actualCombinations.size} actual player-team combinations to check`)
    const playerTeamLookup = await batchLookupService.batchFindActualPlayerTeams(Array.from(actualCombinations))
    console.log(`✅ Found ${Object.keys(playerTeamLookup).length} existing player_team records`)

    // Phase 4: Fast matching using lookups
    progressTracker.updateProgress(jobId, {
      total: cards.length,
      processed: 0,
      status: 'fast_matching'
    })

    console.log('⚡ Phase 4: Fast matching using cached lookups...')
    const matchedCards = await performFastMatching(
      cards,
      playerLookup,
      teamLookup,
      playerTeamLookup,
      jobId,
      pool,
      organizationId
    )

    // Mark job as complete
    progressTracker.complete(jobId, {
      matchedCards: matchedCards.length
    })

    res.json({
      success: true,
      jobId,
      matchedCards,
      message: `Successfully matched ${matchedCards.length} cards`
    })
  } catch (error) {
    console.error('❌ Error matching cards:', error)
    progressTracker.fail(jobId, error)

    res.status(500).json({
      message: 'Failed to match cards',
      error: error.message
    })
  }
})

/**
 * POST /preview-sql
 *
 * Generate SQL preview for card creation (NO EXECUTION)
 */
router.post('/preview-sql', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { matchedCards, seriesId } = req.body

    if (!matchedCards || !Array.isArray(matchedCards)) {
      return res.status(400).json({ message: 'Matched cards array is required' })
    }

    const pool = await connectToDatabase()

    let sqlStatements = []
    let variableCounter = 0

    // Header comment
    sqlStatements.push('-- Generated SQL for Card Import')
    sqlStatements.push(`-- Series ID: ${seriesId}`)
    sqlStatements.push(`-- Generated: ${new Date().toISOString()}`)
    sqlStatements.push(`-- Total cards to import: ${matchedCards.length}`)
    sqlStatements.push('')
    sqlStatements.push('BEGIN TRANSACTION;')
    sqlStatements.push('')

    for (const card of matchedCards) {
      const cardVar = `@card${++variableCounter}`

      sqlStatements.push(`-- Card ${card.sortOrder}: ${card.cardNumber}`)

      // Card insertion
      sqlStatements.push(`DECLARE ${cardVar} BIGINT;`)
      sqlStatements.push(`INSERT INTO card (card_number, series, is_rookie, is_autograph, is_relic, notes, sort_order, created)`)
      sqlStatements.push(`VALUES ('${card.cardNumber.replace(/'/g, "''")}', ${seriesId}, ${card.isRC ? 1 : 0}, ${card.isAutograph ? 1 : 0}, ${card.isRelic ? 1 : 0}, ${card.notes ? `'${card.notes.replace(/'/g, "''")}'` : 'NULL'}, ${card.sortOrder}, GETDATE());`)
      sqlStatements.push(`SET ${cardVar} = SCOPE_IDENTITY();`)
      sqlStatements.push('')

      // Process each player for this card
      for (const player of card.players) {
        if (!player.selectedPlayer) {
          sqlStatements.push(`-- WARNING: No player selected for "${player.name}" - skipping`)
          continue
        }

        const playerId = player.selectedPlayer.playerId
        const playerName = player.selectedPlayer.playerName

        sqlStatements.push(`-- Player: ${playerName}`)

        // Find all teams this player should be associated with
        const matchedTeams = player.teamMatches?.exact || []

        for (const team of matchedTeams) {
          // Check if player_team combination exists in our import data
          const hasPlayerTeam = player.playerTeamMatches?.some(pt =>
            pt.playerId === playerId && pt.teamId === team.teamId
          )

          if (hasPlayerTeam) {
            // Find the player_team ID
            const playerTeam = player.playerTeamMatches.find(pt =>
              pt.playerId === playerId && pt.teamId === team.teamId
            )

            // Check if this is a placeholder ID from frontend (existing_playerId_teamId)
            let actualPlayerTeamId = playerTeam.playerTeamId
            if (String(playerTeam.playerTeamId).startsWith('existing_')) {
              // This was created on frontend, need to look up actual ID
              const ptResult = await pool.request()
                .input('playerId', sql.BigInt, playerId)
                .input('teamId', sql.Int, team.teamId)
                .query(`
                  SELECT player_team_id
                  FROM player_team
                  WHERE player = @playerId AND team = @teamId
                `)

              if (ptResult.recordset.length > 0) {
                actualPlayerTeamId = ptResult.recordset[0].player_team_id
                sqlStatements.push(`-- Using existing player_team: ${playerName} - ${team.teamName} (ID: ${actualPlayerTeamId})`)
                sqlStatements.push(`INSERT INTO card_player_team (card, player_team)`)
                sqlStatements.push(`VALUES (${cardVar}, ${actualPlayerTeamId});`)
              } else {
                sqlStatements.push(`-- WARNING: No player_team record found for ${playerName} - ${team.teamName}`)
                sqlStatements.push(`-- You may need to create this player_team combination first`)
              }
            } else {
              // Use the actual ID from database
              sqlStatements.push(`-- Using existing player_team: ${playerName} - ${team.teamName} (ID: ${actualPlayerTeamId})`)
              sqlStatements.push(`INSERT INTO card_player_team (card, player_team)`)
              sqlStatements.push(`VALUES (${cardVar}, ${actualPlayerTeamId});`)
            }
          } else {
            sqlStatements.push(`-- WARNING: No player_team record found for ${playerName} - ${team.teamName}`)
            sqlStatements.push(`-- You may need to create this player_team combination first`)
          }
        }

        sqlStatements.push('')
      }

      sqlStatements.push('')
    }

    sqlStatements.push('-- End of import')
    sqlStatements.push('COMMIT TRANSACTION;')
    sqlStatements.push('')
    sqlStatements.push('-- Verification queries:')
    sqlStatements.push(`SELECT COUNT(*) as cards_created FROM card WHERE series = ${seriesId} AND created >= CAST(GETDATE() AS DATE);`)
    sqlStatements.push(`SELECT COUNT(*) as card_player_teams_created FROM card_player_team cpt`)
    sqlStatements.push(`JOIN card c ON cpt.card = c.card_id`)
    sqlStatements.push(`WHERE c.series = ${seriesId} AND c.created >= CAST(GETDATE() AS DATE);`)

    const finalSQL = sqlStatements.join('\n')

    res.json({
      success: true,
      sql: finalSQL,
      cardCount: matchedCards.length,
      message: 'SQL preview generated successfully'
    })
  } catch (error) {
    console.error('Error generating SQL preview:', error)
    res.status(500).json({
      message: 'Failed to generate SQL preview',
      error: error.message
    })
  }
})

/**
 * POST /create-cards
 *
 * Create matched cards in database with all relationships
 */
router.post('/create-cards', requireAuth, requireAdmin, async (req, res) => {
  try {
    console.log('🚀 Starting card creation process...')
    const { matchedCards, seriesId } = req.body

    console.log(`📊 Import request: ${matchedCards?.length || 0} cards, seriesId: ${seriesId}`)

    if (!matchedCards || !Array.isArray(matchedCards)) {
      console.error('❌ Invalid request: matchedCards is required')
      return res.status(400).json({ message: 'Matched cards array is required' })
    }

    if (!seriesId) {
      console.error('❌ Invalid request: seriesId is required')
      return res.status(400).json({ message: 'Series ID is required' })
    }

    const pool = await connectToDatabase()
    console.log('✅ Database connection established')

    const transaction = new sql.Transaction(pool)
    await transaction.begin()
    console.log('✅ Transaction started')

    try {
      // Use CardCreatorService to handle all card creation logic
      const cardCreatorService = new CardCreatorService()
      const result = await cardCreatorService.createCards(matchedCards, seriesId, transaction)

      await transaction.commit()
      console.log(`🎉 Successfully imported ${result.created} cards`)

      res.json(result)
    } catch (transactionError) {
      console.error('❌ Transaction error:', transactionError)
      console.error('Stack trace:', transactionError.stack)
      await transaction.rollback()
      console.log('🔄 Transaction rolled back')
      throw transactionError
    }
  } catch (error) {
    console.error('❌ Error creating cards:', error)
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      code: error.code,
      number: error.number,
      state: error.state,
      procedure: error.procedure
    })

    res.status(500).json({
      message: 'Failed to create cards',
      error: error.message,
      details: error.code ? `SQL Error ${error.number}: ${error.message}` : error.message
    })
  }
})

/**
 * POST /create-player
 *
 * Create a new player entity
 */
router.post('/create-player', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName } = req.body

    if (!firstName) {
      return res.status(400).json({ message: 'First name is required' })
    }

    const pool = await connectToDatabase()

    // Allow null/empty lastName for single-name subjects (mascots, fruits, etc.)
    const lastNameValue = lastName?.trim() || null

    // Generate slug from full name or first name only
    const trimmedFirstName = firstName.trim()
    const fullName = lastNameValue ? `${trimmedFirstName} ${lastNameValue}` : trimmedFirstName
    const slug = generateSlug(fullName)

    const result = await pool.request()
      .input('firstName', sql.NVarChar, trimmedFirstName)
      .input('lastName', sql.NVarChar, lastNameValue)
      .input('slug', sql.NVarChar, slug)
      .query(`
        INSERT INTO player (first_name, last_name, slug)
        VALUES (@firstName, @lastName, @slug);
        SELECT SCOPE_IDENTITY() AS player_id, @firstName AS first_name, @lastName AS last_name;
      `)

    const newPlayer = result.recordset[0]

    // Construct playerName properly for single-name players
    const playerName = newPlayer.last_name
      ? `${newPlayer.first_name} ${newPlayer.last_name}`.trim()
      : newPlayer.first_name

    res.json({
      success: true,
      player: {
        playerId: String(newPlayer.player_id),
        playerName: playerName,
        firstName: newPlayer.first_name,
        lastName: newPlayer.last_name
      }
    })
  } catch (error) {
    console.error('Error creating player:', error)
    res.status(500).json({
      message: 'Failed to create player',
      error: error.message
    })
  }
})

/**
 * POST /create-team
 *
 * Create a new team entity
 */
router.post('/create-team', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { teamName, city, abbreviation, organizationId } = req.body

    if (!teamName) {
      return res.status(400).json({ message: 'Team name is required' })
    }

    if (!organizationId) {
      return res.status(400).json({ message: 'Organization ID is required' })
    }

    const pool = await connectToDatabase()

    // Generate slug from team name
    const trimmedTeamName = teamName.trim()
    const slug = generateSlug(trimmedTeamName)

    const result = await pool.request()
      .input('teamName', sql.NVarChar, trimmedTeamName)
      .input('slug', sql.NVarChar, slug)
      .input('city', sql.NVarChar, city?.trim() || null)
      .input('abbreviation', sql.NVarChar, abbreviation?.trim() || null)
      .input('organizationId', sql.Int, organizationId)
      .query(`
        INSERT INTO team (name, slug, city, abbreviation, organization)
        VALUES (@teamName, @slug, @city, @abbreviation, @organizationId);
        SELECT SCOPE_IDENTITY() AS team_id, @teamName AS name, @city AS city, @abbreviation AS abbreviation,
               NULL AS primary_color, NULL AS secondary_color;
      `)

    const newTeam = result.recordset[0]

    res.json({
      success: true,
      team: {
        teamId: String(newTeam.team_id),
        teamName: newTeam.name,
        city: newTeam.city,
        abbreviation: newTeam.abbreviation,
        primaryColor: newTeam.primary_color,
        secondaryColor: newTeam.secondary_color
      }
    })
  } catch (error) {
    console.error('Error creating team:', error)
    res.status(500).json({
      message: 'Failed to create team',
      error: error.message
    })
  }
})

/**
 * POST /create-player-team
 *
 * Create a new player-team relationship
 */
router.post('/create-player-team', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { playerId, teamId } = req.body

    console.log(`🎯 Create player_team request: playerId=${playerId} (${typeof playerId}), teamId=${teamId} (${typeof teamId})`)

    if (!playerId || !teamId) {
      console.log('❌ Missing playerId or teamId in request body')
      return res.status(400).json({ message: 'Player ID and team ID are required' })
    }

    const pool = await connectToDatabase()

    // Check if combination already exists
    const existingCheck = await pool.request()
      .input('playerId', sql.BigInt, playerId)
      .input('teamId', sql.Int, teamId)
      .query(`
        SELECT player_team_id FROM player_team
        WHERE player = @playerId AND team = @teamId
      `)

    if (existingCheck.recordset.length > 0) {
      return res.status(400).json({ message: 'Player-team combination already exists' })
    }

    const result = await pool.request()
      .input('playerId', sql.BigInt, playerId)
      .input('teamId', sql.Int, teamId)
      .query(`
        INSERT INTO player_team (player, team)
        VALUES (@playerId, @teamId);
        SELECT SCOPE_IDENTITY() AS player_team_id;
      `)

    // Get the full details for response
    const detailsResult = await pool.request()
      .input('playerTeamId', sql.BigInt, result.recordset[0].player_team_id)
      .query(`
        SELECT
          pt.player_team_id as playerTeamId,
          LTRIM(RTRIM(COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, ''))) as playerName,
          t.name as teamName,
          pt.player as playerId,
          pt.team as teamId
        FROM player_team pt
        JOIN player p ON pt.player = p.player_id
        JOIN team t ON pt.team = t.team_id
        WHERE pt.player_team_id = @playerTeamId
      `)

    const playerTeam = detailsResult.recordset[0]

    res.json({
      success: true,
      playerTeam: {
        playerTeamId: String(playerTeam.playerTeamId),
        playerId: String(playerTeam.playerId),
        teamId: String(playerTeam.teamId),
        playerName: playerTeam.playerName,
        teamName: playerTeam.teamName
      }
    })
  } catch (error) {
    console.error('Error creating player-team:', error)
    res.status(500).json({
      message: 'Failed to create player-team relationship',
      error: error.message
    })
  }
})

// ============================================================================
// PRIVATE HELPER METHODS
// ============================================================================

/**
 * Perform fast matching using cached lookups
 *
 * This logic is complex and extracted to keep the route handler clean.
 * It matches players/teams for each card using position-based logic.
 *
 * @private
 * @param {Array} cards - Parsed cards
 * @param {Object} playerLookup - Pre-fetched player matches
 * @param {Object} teamLookup - Pre-fetched team matches
 * @param {Object} playerTeamLookup - Pre-fetched player_team records
 * @param {string} jobId - Progress tracking job ID
 * @param {ConnectionPool} pool - Database connection pool
 * @param {number} organizationId - Organization ID for no-name team lookup
 * @returns {Promise<Array>} - Matched cards
 */
async function performFastMatching(cards, playerLookup, teamLookup, playerTeamLookup, jobId, pool, organizationId) {
  const matchedCards = []
  let processedCount = 0

  for (const card of cards) {
    processedCount++

    // Update progress every 50 cards to reduce overhead
    if (processedCount % 50 === 0 || processedCount === cards.length) {
      progressTracker.updateProgress(jobId, {
        processed: processedCount,
        currentCard: `Card ${card.sortOrder}: ${card.cardNumber}`
      })
      console.log(`📊 Fast matching progress: ${processedCount}/${cards.length}`)
    }

    const cardPlayers = []

    // playerNames and teamNames are already arrays from excel-parser
    const playerNamesList = Array.isArray(card.playerNames) ? card.playerNames : []
    const teamNamesList = Array.isArray(card.teamNames) ? card.teamNames : []

    // Process ALL teams on the card first (for Team(s) column display)
    const allCardTeams = { exact: [], fuzzy: [] }
    teamNamesList.forEach(teamName => {
      const teamMatch = teamLookup[teamName]
      if (teamMatch) {
        allCardTeams.exact.push(...teamMatch.exact)
        allCardTeams.fuzzy.push(...teamMatch.fuzzy)
      }
    })

    // Match each player to their team
    for (let playerIdx = 0; playerIdx < playerNamesList.length; playerIdx++) {
      const playerName = playerNamesList[playerIdx]
      const playerMatches = playerLookup[playerName] || { exact: [], fuzzy: [] }

      // SMART TEAM MATCHING FOR PLAYER_TEAM RECORDS: Match player to team by position
      let playerTeamGuess = guessPlayerTeams(playerIdx, playerNamesList.length, teamNamesList)

      console.log(`📋 Team situation for "${playerName}": teamNamesList.length=${teamNamesList.length}, playerTeamGuess.length=${playerTeamGuess.length}`)

      // Collect teams for player_team checking (based on position guess)
      const playerTeamCheckTeams = { exact: [], fuzzy: [] }

      // Handle NO TEAM case - recommend "no name" teams
      if (teamNamesList.length === 0 || playerTeamGuess.length === 0) {
        console.log(`⚠️ No team specified for "${playerName}" - recommending no-team placeholder teams`)

        // Get placeholder teams for non-team subjects (mascots, stadiums, etc.)
        // Specific match for: NULL, empty string, "No Name", "No Team", "No Team Assigned"
        // Must have NULL organization to ensure it's truly a placeholder team
        const noNameTeamsQuery = `
          SELECT
            team_id as teamId,
            name as teamName,
            organization,
            primary_color as primaryColor,
            secondary_color as secondaryColor,
            abbreviation
          FROM team
          WHERE organization IS NULL
          AND (
            name IS NULL
            OR name = ''
            OR LOWER(LTRIM(RTRIM(name))) IN ('no name', 'no team', 'no team assigned', 'none')
          )
          ORDER BY
            CASE WHEN LOWER(name) LIKE 'no team%' THEN 0 ELSE 1 END,
            team_id
        `

        const noNameTeamsResult = await pool.request().query(noNameTeamsQuery)

        if (noNameTeamsResult.recordset.length > 0) {
          console.log(`✅ Found ${noNameTeamsResult.recordset.length} no-name teams`)
          noNameTeamsResult.recordset.forEach(team => {
            const teamObj = {
              teamId: String(team.teamId),
              teamName: team.teamName || 'No Name',
              organization: team.organization,
              primaryColor: team.primaryColor,
              secondaryColor: team.secondaryColor,
              abbreviation: team.abbreviation
            }
            playerTeamCheckTeams.exact.push(teamObj)
          })

          // Check if player_team records exist for these no-team combinations
          // This wasn't done in Phase 3 because these teams weren't in the import data
          if (playerMatches.exact.length > 0) {
            const noTeamConditions = []
            playerMatches.exact.forEach((player, pIdx) => {
              noNameTeamsResult.recordset.forEach((team, tIdx) => {
                const key = `${player.playerId}_${team.teamId}`
                // Only check if not already in lookup from Phase 3
                if (!playerTeamLookup[key]) {
                  noTeamConditions.push(`(pt.player = @noTeamPlayer${pIdx}_${tIdx} AND pt.team = @noTeamTeam${pIdx}_${tIdx})`)
                }
              })
            })

            if (noTeamConditions.length > 0) {
              const noTeamRequest = pool.request()
              let conditionIdx = 0
              playerMatches.exact.forEach((player, pIdx) => {
                noNameTeamsResult.recordset.forEach((team, tIdx) => {
                  const key = `${player.playerId}_${team.teamId}`
                  if (!playerTeamLookup[key]) {
                    noTeamRequest.input(`noTeamPlayer${pIdx}_${tIdx}`, sql.BigInt, player.playerId)
                    noTeamRequest.input(`noTeamTeam${pIdx}_${tIdx}`, sql.Int, team.teamId)
                  }
                })
              })

              const noTeamQuery = `
                SELECT
                  pt.player_team_id as playerTeamId,
                  pt.player as playerId,
                  pt.team as teamId
                FROM player_team pt
                WHERE ${noTeamConditions.join(' OR ')}
              `

              const noTeamResult = await noTeamRequest.query(noTeamQuery)
              console.log(`🔍 Found ${noTeamResult.recordset.length} existing player_team records for no-team combinations`)

              // Add to lookup for use below
              noTeamResult.recordset.forEach(row => {
                const key = `${row.playerId}_${row.teamId}`
                playerTeamLookup[key] = {
                  playerTeamId: String(row.playerTeamId),
                  playerId: String(row.playerId),
                  teamId: String(row.teamId)
                }
              })
            }
          }
        }
      } else {
        // Normal team matching
        playerTeamGuess.forEach(teamName => {
          const teamMatch = teamLookup[teamName]
          if (teamMatch) {
            playerTeamCheckTeams.exact.push(...teamMatch.exact)
            playerTeamCheckTeams.fuzzy.push(...teamMatch.fuzzy)
          }
        })
      }

      // Get player_team combinations from cached lookup
      const playerTeamMatches = []
      if (playerMatches.exact.length > 0 && playerTeamCheckTeams.exact.length > 0) {
        playerMatches.exact.forEach(player => {
          playerTeamCheckTeams.exact.forEach(team => {
            const ptKey = `${player.playerId}_${team.teamId}`
            const playerTeam = playerTeamLookup[ptKey]
            if (playerTeam) {
              playerTeamMatches.push({
                ...playerTeam,
                playerName: player.playerName,
                teamName: team.teamName
              })
              console.log(`✅ Found existing player_team: ${player.playerName} - ${team.teamName}`)
            } else {
              console.log(`⚠️ Missing player_team record: ${player.playerName} - ${team.teamName}`)
            }
          })
        })
      }

      console.log(`🔍 Player "${playerName}": ${playerTeamCheckTeams.exact.length} teams in position guess, ${playerTeamMatches.length} player_team records exist`)

      // Auto-selection logic
      let selectedPlayer = null
      let selectedTeams = []
      let selectedPlayerTeams = []

      // AUTO-SELECT if we have exactly one player match
      if (playerMatches?.exact?.length === 1) {
        selectedPlayer = playerMatches.exact[0]
        console.log(`🎯 Auto-selected player: "${selectedPlayer.playerName}" for "${playerName}"`)

        // If we also have team matches in the position guess, auto-select them
        if (playerTeamCheckTeams?.exact?.length > 0) {
          selectedTeams = playerTeamCheckTeams.exact
          console.log(`🎯 Auto-selected ${selectedTeams.length} teams: ${selectedTeams.map(t => t.teamName).join(', ')}`)

          // If we have existing player_team records, include them
          selectedPlayerTeams = playerTeamMatches
          if (selectedPlayerTeams.length > 0) {
            console.log(`✅ Found ${selectedPlayerTeams.length} existing player_team records`)
          }
        }
      } else if (playerMatches?.exact?.length > 1) {
        console.log(`⚠️ Multiple players found for "${playerName}": ${playerMatches.exact.map(p => p.playerName).join(', ')}`)

        // SMART DISAMBIGUATION: If multiple players with same name, but only one matches the card's team(s)
        if (playerTeamCheckTeams?.exact?.length > 0) {
          const playersWithTeamMatch = []

          // Check each player to see if they have player_team records with any of the card's teams
          for (const player of playerMatches.exact) {
            const hasTeamMatch = playerTeamCheckTeams.exact.some(team => {
              const ptKey = `${player.playerId}_${team.teamId}`
              return playerTeamLookup[ptKey] !== undefined
            })

            if (hasTeamMatch) {
              playersWithTeamMatch.push(player)
            }
          }

          // If exactly ONE player matches the team, auto-select them
          if (playersWithTeamMatch.length === 1) {
            selectedPlayer = playersWithTeamMatch[0]
            selectedTeams = playerTeamCheckTeams.exact

            // Get the player_team records for this specific player
            selectedPlayerTeams = playerTeamMatches.filter(pt =>
              pt.playerId === selectedPlayer.playerId
            )

            console.log(`🎯 Auto-selected disambiguated player: "${selectedPlayer.playerName}" (player_id: ${selectedPlayer.playerId}) - matched by team`)
            console.log(`✅ Found ${selectedPlayerTeams.length} player_team records for disambiguated player`)
          } else {
            console.log(`⚠️ Could not disambiguate: ${playersWithTeamMatch.length} players match the card's teams`)
          }
        }
      } else {
        console.log(`❌ No players found for "${playerName}"`)
      }

      cardPlayers.push({
        name: playerName,
        playerMatches: playerMatches,
        teamNames: teamNamesList, // ALL team names from spreadsheet (not filtered by player)
        teamMatches: allCardTeams, // ALL teams from card (not filtered by player)
        playerTeamCheckTeams: playerTeamCheckTeams, // Position-matched teams for THIS player
        playerTeamMatches: playerTeamMatches, // Only player_team records for this player with position-matched teams
        selectedPlayer: selectedPlayer,
        selectedTeams: selectedTeams,
        selectedPlayerTeams: selectedPlayerTeams
      })
    }

    matchedCards.push({
      ...card,
      teamNames: teamNamesList, // ALL team names from spreadsheet
      teamMatches: allCardTeams, // ALL matched teams from database
      players: cardPlayers
    })
  }

  return matchedCards
}

/**
 * Guess which team(s) a player belongs to based on position
 *
 * @private
 * @param {number} playerIdx - Player index in list
 * @param {number} playerCount - Total number of players
 * @param {Array} teamNamesList - List of team names
 * @returns {Array} - Array of team names for this player
 */
function guessPlayerTeams(playerIdx, playerCount, teamNamesList) {
  if (teamNamesList.length === playerCount) {
    // Perfect match: each player gets their corresponding team
    return [teamNamesList[playerIdx]]
  } else if (teamNamesList.length === 1) {
    // All players on same team
    return teamNamesList
  } else if (playerIdx === 0) {
    // First player always gets first team
    return [teamNamesList[0]]
  } else if (playerIdx === playerCount - 1 && playerIdx >= teamNamesList.length) {
    // Last player when index exceeds team count: assign to last team
    return [teamNamesList[teamNamesList.length - 1]]
  } else if (playerIdx < teamNamesList.length) {
    // Clear position match or ambiguous
    if (playerCount > teamNamesList.length) {
      // Ambiguous - show all teams as options
      return teamNamesList
    } else {
      return [teamNamesList[playerIdx]]
    }
  } else {
    // Fallback: ambiguous
    return teamNamesList
  }
}

module.exports = router
