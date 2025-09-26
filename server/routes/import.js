const express = require('express')
const multer = require('multer')
const XLSX = require('xlsx')
const router = express.Router()
const sql = require('mssql')
const { authMiddleware: requireAuth, requireAdmin } = require('../middleware/auth')

// Progress tracking store (in production, use Redis or database)
const matchingProgress = new Map()

// Configure multer for file uploads
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

// Parse DATABASE_URL for mssql connection
const parseConnectionString = (connectionString) => {
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

// Database connection
let pool
async function connectToDatabase() {
  if (!pool) {
    try {
      let config;
      
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

// Progress endpoint
router.get('/match-progress/:jobId', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { jobId } = req.params
    const progress = matchingProgress.get(jobId) || { 
      total: 0, 
      processed: 0, 
      status: 'not_found' 
    }
    res.json(progress)
  } catch (error) {
    console.error('Error getting match progress:', error)
    res.status(500).json({ message: 'Failed to get progress' })
  }
})

// Parse XLSX file endpoint
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

    // Parse XLSX file
    console.log('📊 Starting XLSX parsing...')
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    console.log('Workbook sheet names:', workbook.SheetNames)
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    console.log('Using sheet:', sheetName)
    
    // Convert to JSON - assuming no headers, so use column letters as keys
    const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) // header: 1 returns array of arrays
    
    console.log('Raw XLSX data (first 3 rows):', rawData.slice(0, 3))
    console.log('Total rows found:', rawData.length)
    
    if (rawData.length === 0) {
      return res.status(400).json({ message: 'No data found in spreadsheet' })
    }

    // Process and normalize the data
    // Standard file structure: [Card Number, Player Name(s), Team Name(s), RC Indicator]
    const cards = rawData.map((row, index) => {
      // Skip empty rows
      if (!row || row.length === 0 || !row[0]) {
        return null
      }

      const cardNumber = row[0] ? String(row[0]).trim() : ''
      const playerNames = row[1] ? String(row[1]).trim() : ''
      const teamNames = row[2] ? String(row[2]).trim() : ''
      const rcIndicator = row[3] ? String(row[3]).trim() : '' // RC is in column 4 (index 3)
      const notes = row[4] ? String(row[4]).trim() : '' // Notes are in column 5 (index 4) if present

      // Debug first few rows
      if (index < 5) {
        console.log(`Row ${index + 1} mapping:`)
        console.log('  cardNumber:', cardNumber)
        console.log('  playerNames:', playerNames)
        console.log('  teamNames:', teamNames)
        console.log('  rcIndicator (col 4):', rcIndicator)
        console.log('  notes (col 5):', notes)
        console.log('  raw row:', row)
      }

      return {
        sortOrder: index + 1,  // Sequential sort order starting at 1
        cardNumber,
        playerNames,
        teamNames,
        isRC: rcIndicator ? (rcIndicator.toLowerCase() === 'rc' || rcIndicator.toLowerCase() === 'rookie' || rcIndicator.toLowerCase() === 'yes' || rcIndicator.toLowerCase() === 'true' || rcIndicator === '1') : false,
        rcIndicator: rcIndicator,  // Keep original value for display
        isAutograph: false, // Default to false - can be toggled in UI
        isRelic: false, // Default to false - can be toggled in UI
        notes: notes || ''  // Ensure notes is always a string
      }
    }).filter(card => card && card.cardNumber) // Only include valid rows with card numbers

    console.log(`Parsed ${cards.length} cards from XLSX file`)
    
    res.json({ 
      success: true,
      cards,
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

// Match cards with database records - OPTIMIZED for large datasets
router.post('/match-cards', requireAuth, requireAdmin, async (req, res) => {
  // Create progress tracking job (declare outside try block for error handling)
  const jobId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  
  try {
    const { cards, seriesId } = req.body
    
    if (!cards || !Array.isArray(cards)) {
      return res.status(400).json({ message: 'Cards array is required' })
    }
    
    console.log(`🚀 Starting OPTIMIZED matching job ${jobId} for ${cards.length} cards`)

    const pool = await connectToDatabase()
    
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
    
    // OPTIMIZATION 1: Extract all unique player and team names upfront
    matchingProgress.set(jobId, {
      total: cards.length,
      processed: 0,
      status: 'extracting_names',
      currentCard: null
    })
    
    console.log('📋 Phase 1: Extracting unique names...')
    const allPlayerNames = new Set()
    const allTeamNames = new Set()
    
    cards.forEach(card => {
      const playerNamesList = (card.playerNames || '').split(/[,;&]/).map(name => name.trim()).filter(name => name)
      const teamNamesList = (card.teamNames || '').split(/[,;&]/).map(name => name.trim()).filter(name => name)
      
      playerNamesList.forEach(name => allPlayerNames.add(name))
      teamNamesList.forEach(name => allTeamNames.add(name))
    })
    
    console.log(`📊 Found ${allPlayerNames.size} unique players, ${allTeamNames.size} unique teams`)
    
    // OPTIMIZATION 2: Batch lookup all players and teams
    matchingProgress.set(jobId, {
      total: cards.length,
      processed: 0,
      status: 'batch_lookup',
      currentCard: null
    })
    
    console.log('🔍 Phase 2: Batch player/team lookup...')
    const [playerLookup, teamLookup] = await Promise.all([
      batchFindPlayers(pool, Array.from(allPlayerNames), organizationId),
      batchFindTeams(pool, Array.from(allTeamNames), organizationId)
    ])
    
    console.log(`✅ Lookup complete: ${Object.keys(playerLookup).length} players, ${Object.keys(teamLookup).length} teams`)
    
    // OPTIMIZATION 3: Collect actual player-team combinations from cards
    console.log('🤝 Phase 3: Collecting actual player-team combinations...')
    const actualCombinations = new Set()
    
    cards.forEach(card => {
      const playerNamesList = (card.playerNames || '').split(/[,;&]/).map(name => name.trim()).filter(name => name)
      const teamNamesList = (card.teamNames || '').split(/[,;&]/).map(name => name.trim()).filter(name => name)
      
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
    const playerTeamLookup = await batchFindActualPlayerTeams(pool, Array.from(actualCombinations))
    console.log(`✅ Found ${Object.keys(playerTeamLookup).length} existing player_team records`)
    
    // OPTIMIZATION 4: Fast matching using lookups
    matchingProgress.set(jobId, {
      total: cards.length,
      processed: 0,
      status: 'fast_matching',
      currentCard: null
    })
    
    console.log('⚡ Phase 4: Fast matching using cached lookups...')
    const matchedCards = []
    let processedCount = 0

    for (const card of cards) {
      processedCount++
      
      // Update progress every 50 cards to reduce overhead
      if (processedCount % 50 === 0 || processedCount === cards.length) {
        matchingProgress.set(jobId, {
          total: cards.length,
          processed: processedCount,
          status: 'fast_matching',
          currentCard: `Card ${card.sortOrder}: ${card.cardNumber}`
        })
        console.log(`📊 Fast matching progress: ${processedCount}/${cards.length}`)
      }
      
      const cardPlayers = []
      
      // Parse player names (could be comma-separated)
      const playerNamesList = (card.playerNames || '').split(/[,;&]/).map(name => name.trim()).filter(name => name)
      
      for (const playerName of playerNamesList) {
        // Use cached lookups instead of individual queries
        const playerMatches = playerLookup[playerName] || { exact: [], fuzzy: [] }
        
        // Parse team names for this card
        const teamNamesList = (card.teamNames || '').split(/[,;&]/).map(name => name.trim()).filter(name => name)
        const teamMatches = { exact: [], fuzzy: [] }
        
        // Collect team matches from cached lookup
        teamNamesList.forEach(teamName => {
          const teamMatch = teamLookup[teamName]
          if (teamMatch) {
            teamMatches.exact.push(...teamMatch.exact)
          }
        })
        
        // Get player_team combinations from cached lookup
        const playerTeamMatches = []
        if (playerMatches.exact.length > 0 && teamMatches.exact.length > 0) {
          playerMatches.exact.forEach(player => {
            teamMatches.exact.forEach(team => {
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
        
        // Check for auto-selection (more practical logic)
        let selectedPlayer = null
        let selectedTeams = []
        let selectedPlayerTeams = []
        
        // AUTO-SELECT if we have exactly one player match
        if (playerMatches?.exact?.length === 1) {
          selectedPlayer = playerMatches.exact[0]
          console.log(`🎯 Auto-selected player: "${selectedPlayer.playerName}" for "${playerName}"`)
          
          // If we also have team matches, auto-select them too
          if (teamMatches?.exact?.length > 0) {
            selectedTeams = teamMatches.exact
            console.log(`🎯 Auto-selected ${selectedTeams.length} teams: ${selectedTeams.map(t => t.teamName).join(', ')}`)
            
            // If we have existing player_team records, include them
            selectedPlayerTeams = playerTeamMatches
            if (selectedPlayerTeams.length > 0) {
              console.log(`✅ Found ${selectedPlayerTeams.length} existing player_team records`)
            }
          }
        } else if (playerMatches?.exact?.length > 1) {
          console.log(`⚠️ Multiple players found for "${playerName}": ${playerMatches.exact.map(p => p.playerName).join(', ')}`)
        } else {
          console.log(`❌ No players found for "${playerName}"`)
        }
        
        // Optional: More strict auto-selection if you want to require teams too
        // if (playerMatches?.exact?.length === 1 && teamMatches?.exact?.length > 0) {
        //   const exactPlayer = playerMatches.exact[0]
        //   
        //   // Check if all teams match and player_team records exist
        //   const allTeamsHavePlayerTeam = teamNamesList.every(teamName => {
        //     const matchingTeam = teamMatches.exact.find(team => 
        //       team.teamName.toLowerCase().includes(teamName.toLowerCase())
        //     )
        //     if (!matchingTeam) return false
        //     
        //     // Check if player_team record exists
        //     return playerTeamMatches.some(pt => 
        //       pt.playerId === exactPlayer.playerId && pt.teamId === matchingTeam.teamId
        //     )
        //   })
        //   
        //   if (allTeamsHavePlayerTeam) {
        //     selectedPlayer = exactPlayer
        //     console.log(`🎯 Perfect match with teams: "${selectedPlayer.playerName}"`)
        //   }
        // }

        cardPlayers.push({
          name: playerName,
          playerMatches: playerMatches,
          teamNames: teamNamesList,
          teamMatches: teamMatches,
          playerTeamMatches: playerTeamMatches,
          selectedPlayer: selectedPlayer,
          selectedTeams: selectedTeams,
          selectedPlayerTeams: selectedPlayerTeams
        })
      }

      matchedCards.push({
        ...card,
        players: cardPlayers
      })
    }

    // Mark as completed
    matchingProgress.set(jobId, {
      total: cards.length,
      processed: cards.length,
      status: 'completed',
      currentCard: null
    })
    
    console.log(`✅ Matching job ${jobId} completed`)
    
    res.json({
      success: true,
      matchedCards,
      jobId,
      organizationId,
      organizationName
    })

  } catch (error) {
    console.error('Error matching cards:', error)
    
    // Update progress to show error
    if (jobId) {
      matchingProgress.set(jobId, {
        total: cards.length,
        processed: processedCount,
        status: 'error',
        currentCard: null,
        error: error.message
      })
    }
    
    res.status(500).json({ 
      message: 'Failed to match cards',
      error: error.message 
    })
  }
})

// Generate SQL preview for card creation (NO EXECUTION)
router.post('/preview-sql', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { matchedCards, seriesId } = req.body
    
    if (!matchedCards || !Array.isArray(matchedCards)) {
      return res.status(400).json({ message: 'Matched cards array is required' })
    }

    const pool = await connectToDatabase()
    
    let sqlStatements = []
    let variableCounter = 0
    const newPlayerNames = new Map() // Track new players to avoid duplicates
    
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

// Create cards in database
router.post('/create-cards', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { matchedCards, seriesId } = req.body
    
    if (!matchedCards || !Array.isArray(matchedCards)) {
      return res.status(400).json({ message: 'Matched cards array is required' })
    }

    const pool = await connectToDatabase()
    const transaction = new sql.Transaction(pool)
    
    await transaction.begin()
    
    let createdCount = 0
    const newPlayerIds = new Map() // Cache for newly created players
    
    try {
      for (const card of matchedCards) {
        // Create the card record first
        const cardResult = await transaction.request()
          .input('cardNumber', sql.NVarChar, card.cardNumber)
          .input('seriesId', sql.BigInt, seriesId)
          .input('isRookie', sql.Bit, card.isRC)
          .input('isAutograph', sql.Bit, card.isAutograph)
          .input('isRelic', sql.Bit, card.isRelic)
          .input('notes', sql.NVarChar, card.notes || null)
          .input('sortOrder', sql.Int, card.sortOrder)
          .query(`
            INSERT INTO card (card_number, series, is_rookie, is_autograph, is_relic, notes, sort_order, created)
            OUTPUT INSERTED.card_id
            VALUES (@cardNumber, @seriesId, @isRookie, @isAutograph, @isRelic, @notes, @sortOrder, GETDATE())
          `)
        
        const cardId = cardResult.recordset[0].card_id
        
        // Process each player for this card
        for (const player of card.players) {
          let playerId, teamId
          
          if (player.selectedMatch) {
            // Use existing player/team combination
            playerId = player.selectedMatch.playerId
            teamId = player.selectedMatch.teamId
          } else {
            // Need to create new player
            const playerName = player.name
            let firstName = '', lastName = playerName
            
            const nameParts = playerName.split(' ')
            if (nameParts.length > 1) {
              firstName = nameParts[0]
              lastName = nameParts.slice(1).join(' ')
            }
            
            // Check if we already created this player
            const playerKey = playerName.toLowerCase()
            if (newPlayerIds.has(playerKey)) {
              playerId = newPlayerIds.get(playerKey)
            } else {
              // Create new player
              const playerResult = await transaction.request()
                .input('firstName', sql.NVarChar, firstName)
                .input('lastName', sql.NVarChar, lastName)
                .query(`
                  INSERT INTO player (first_name, last_name)
                  OUTPUT INSERTED.player_id
                  VALUES (@firstName, @lastName)
                `)
              
              playerId = playerResult.recordset[0].player_id
              newPlayerIds.set(playerKey, playerId)
            }
            
            // For new players, we'll need to determine team or use a default
            // For now, let's use a default team or skip team association
            teamId = null
          }
          
          // Create player_team record if we have both player and team
          let playerTeamId = null
          if (playerId && teamId) {
            // Check if player_team combination already exists
            const existingPlayerTeam = await transaction.request()
              .input('playerId', sql.BigInt, playerId)
              .input('teamId', sql.Int, teamId)
              .query(`
                SELECT player_team_id FROM player_team 
                WHERE player = @playerId AND team = @teamId
              `)
            
            if (existingPlayerTeam.recordset.length > 0) {
              playerTeamId = existingPlayerTeam.recordset[0].player_team_id
            } else {
              const playerTeamResult = await transaction.request()
                .input('playerId', sql.BigInt, playerId)
                .input('teamId', sql.Int, teamId)
                .query(`
                  INSERT INTO player_team (player, team)
                  OUTPUT INSERTED.player_team_id
                  VALUES (@playerId, @teamId)
                `)
              
              playerTeamId = playerTeamResult.recordset[0].player_team_id
            }
          }
          
          // Create card_player_team record
          if (playerTeamId) {
            await transaction.request()
              .input('cardId', sql.BigInt, cardId)
              .input('playerTeamId', sql.BigInt, playerTeamId)
              .query(`
                INSERT INTO card_player_team (card, player_team)
                VALUES (@cardId, @playerTeamId)
              `)
          }
        }
        
        createdCount++
      }
      
      await transaction.commit()
      
      res.json({
        success: true,
        created: createdCount,
        message: `Successfully imported ${createdCount} cards`
      })
      
    } catch (error) {
      await transaction.rollback()
      throw error
    }
    
  } catch (error) {
    console.error('Error creating cards:', error)
    res.status(500).json({ 
      message: 'Failed to create cards',
      error: error.message 
    })
  }
})

// Helper function to find column value by possible header names
function findColumnValue(row, possibleHeaders) {
  for (const header of possibleHeaders) {
    for (const key of Object.keys(row)) {
      if (key.toLowerCase().includes(header.toLowerCase())) {
        return row[key]
      }
    }
  }
  return null
}

// Helper function to normalize accented characters
function normalizeAccents(str) {
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
}

// Helper function to normalize player names for matching
function normalizePlayerName(name) {
  return normalizeAccents(name.trim().toLowerCase())
    .replace(/\./g, '') // Remove periods like "J.T." -> "JT"  
    .replace(/\s+/g, ' ') // Normalize spaces
}

// Helper function to calculate Levenshtein distance between two strings
function levenshteinDistance(str1, str2) {
  const m = str1.length
  const n = str2.length
  const dp = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0))
  
  for (let i = 0; i <= m; i++) dp[i][0] = i
  for (let j = 0; j <= n; j++) dp[0][j] = j
  
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1]
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
      }
    }
  }
  
  return dp[m][n]
}

// OPTIMIZED: Batch lookup for all players at once - SIMPLIFIED VERSION
async function batchFindPlayers(pool, playerNames, organizationId = null) {
  try {
    console.log(`🔍 Batch lookup for ${playerNames.length} unique players`)
    const playerLookup = {}
    
    if (playerNames.length === 0) return playerLookup
    
    console.log('🔍 Sample player names to search:', playerNames.slice(0, 5))
    
    // Get all players WITH their teams for suggestions
    let baseQuery = `
      SELECT DISTINCT 
        p.player_id as playerId,
        p.first_name + ' ' + p.last_name as playerName,
        p.first_name as firstName,
        p.last_name as lastName,
        t.team_id as teamId,
        t.name as teamName,
        t.primary_color as primaryColor,
        t.secondary_color as secondaryColor,
        t.abbreviation as abbreviation
      FROM player p
      LEFT JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN team t ON pt.team = t.team_id
    `
    
    const request = pool.request()
    
    if (organizationId) {
      request.input('organizationId', sql.Int, organizationId)
      baseQuery += `
        WHERE (
          NOT EXISTS (SELECT 1 FROM player_team pt_check WHERE pt_check.player = p.player_id)
          OR 
          p.player_id IN (
            SELECT DISTINCT pt2.player 
            FROM player_team pt2 
            JOIN team t2 ON pt2.team = t2.team_id 
            WHERE t2.organization = @organizationId
          )
        )
      `
    }
    
    baseQuery += ` ORDER BY p.first_name, p.last_name`
    
    console.log('🔍 Running player lookup query...')
    const allPlayersResult = await request.query(baseQuery)
    console.log(`📊 Found ${allPlayersResult.recordset.length} total player-team records in database`)
    
    // Group players by ID to consolidate teams (same as original logic)
    const groupPlayersByTeam = (recordset) => {
      const playerMap = new Map()
      recordset.forEach(row => {
        const playerId = String(row.playerId)
        if (!playerMap.has(playerId)) {
          playerMap.set(playerId, {
            playerId,
            playerName: row.playerName,
            firstName: row.firstName,
            lastName: row.lastName,
            teams: []
          })
        }
        
        if (row.teamId) {
          // Check for duplicate teams before adding
          const existingTeam = playerMap.get(playerId).teams.find(team => team.teamId === String(row.teamId))
          if (!existingTeam) {
            playerMap.get(playerId).teams.push({
              teamId: String(row.teamId),
              teamName: row.teamName,
              primaryColor: row.primaryColor,
              secondaryColor: row.secondaryColor,
              abbreviation: row.abbreviation
            })
          }
        }
      })
      
      return Array.from(playerMap.values())
    }
    
    const allPlayersGrouped = groupPlayersByTeam(allPlayersResult.recordset)
    console.log(`📊 Grouped into ${allPlayersGrouped.length} unique players`)
    
    // Match in JavaScript with both exact and fuzzy matching
    playerNames.forEach(searchName => {
      const normalizedSearchName = normalizePlayerName(searchName)
      console.log(`🔍 Searching for: "${searchName}" -> normalized: "${normalizedSearchName}"`)
      
      // Find exact matches
      const exactMatches = allPlayersGrouped.filter(player => {
        const normalizedPlayerName = normalizePlayerName(player.playerName || '')
        const isMatch = normalizedPlayerName === normalizedSearchName
        
        if (isMatch) {
          console.log(`✅ EXACT MATCH: "${searchName}" matches "${player.playerName}" with ${player.teams.length} teams`)
        }
        
        return isMatch
      })
      
      // Find fuzzy matches (only if no exact matches found)
      let fuzzyMatches = []
      if (exactMatches.length === 0) {
        fuzzyMatches = allPlayersGrouped.filter(player => {
          const dbPlayerName = normalizePlayerName(player.playerName || '')
          if (!dbPlayerName) return false
          
          // Calculate similarity
          const distance = levenshteinDistance(normalizedSearchName, dbPlayerName)
          const maxLength = Math.max(normalizedSearchName.length, dbPlayerName.length)
          const similarity = 1 - (distance / maxLength)
          
          // Check for close matches
          const nameParts = normalizedSearchName.split(' ')
          const dbNameParts = dbPlayerName.split(' ')
          const lastNameMatch = nameParts.length > 1 && dbNameParts.length > 1 && 
                               nameParts[nameParts.length - 1] === dbNameParts[dbNameParts.length - 1]
          
          const isFuzzyMatch = distance <= 2 || similarity > 0.85 || (lastNameMatch && similarity > 0.7)
          
          if (isFuzzyMatch) {
            console.log(`🔍 FUZZY MATCH: "${searchName}" ~= "${player.playerName}" (similarity: ${similarity.toFixed(2)}, teams: ${player.teams.length})`)
            // Add similarity score to player object
            player.similarity = similarity
            player.distance = distance
          }
          
          return isFuzzyMatch
        })
        
        // Sort fuzzy matches by similarity (best first) and take top 5
        fuzzyMatches.sort((a, b) => b.similarity - a.similarity)
        fuzzyMatches = fuzzyMatches.slice(0, 5)
      }
      
      playerLookup[searchName] = {
        exact: exactMatches,
        fuzzy: fuzzyMatches
      }
      
      console.log(`🎯 "${searchName}": found ${exactMatches.length} exact + ${fuzzyMatches.length} fuzzy matches`)
    })
    
    console.log(`✅ Batch player lookup complete: ${Object.keys(playerLookup).length} names processed`)
    
    // Log summary
    const totalMatches = Object.values(playerLookup).reduce((sum, result) => sum + result.exact.length, 0)
    console.log(`📊 Summary: ${totalMatches} total matches found across all names`)
    
    return playerLookup
    
  } catch (error) {
    console.error('Error in batch player lookup:', error)
    return {}
  }
}

// OPTIMIZED: Batch lookup for all teams at once
async function batchFindTeams(pool, teamNames, organizationId = null) {
  try {
    console.log(`🏟️ Batch lookup for ${teamNames.length} unique teams`)
    const teamLookup = {}
    
    if (teamNames.length === 0) return teamLookup
    
    // Create parameterized query for all teams
    const nameConditions = teamNames.map((_, index) => `@team${index}`).join(', ')
    
    const request = pool.request()
    teamNames.forEach((teamName, index) => {
      request.input(`team${index}`, sql.NVarChar, teamName.trim())
    })
    
    if (organizationId) {
      request.input('organizationId', sql.Int, organizationId)
    }
    
    const exactQuery = `
      SELECT DISTINCT 
        t.team_id as teamId,
        t.name as teamName,
        t.city as city,
        t.abbreviation as abbreviation,
        t.primary_color as primaryColor,
        t.secondary_color as secondaryColor,
        LOWER(t.name) as lowerName,
        LOWER(t.abbreviation) as lowerAbbrev
      FROM team t
      WHERE (LOWER(t.name) IN (${nameConditions}) OR LOWER(t.abbreviation) IN (${nameConditions}))
      ${organizationId ? 'AND t.organization = @organizationId' : ''}
      ORDER BY t.name
    `
    
    const exactResult = await request.query(exactQuery)
    
    // Group results by team name (check both name and abbreviation)
    teamNames.forEach(teamName => {
      const lowerTeamName = teamName.toLowerCase()
      const matches = exactResult.recordset.filter(team => 
        team.lowerName === lowerTeamName || team.lowerAbbrev === lowerTeamName
      ).map(team => ({
        teamId: String(team.teamId),
        teamName: team.teamName,
        city: team.city,
        abbreviation: team.abbreviation,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor
      }))
      
      teamLookup[teamName] = {
        exact: matches,
        fuzzy: []
      }
    })
    
    console.log(`✅ Batch team lookup complete: ${Object.keys(teamLookup).length} names processed`)
    return teamLookup
    
  } catch (error) {
    console.error('Error in batch team lookup:', error)
    return {}
  }
}

// OPTIMIZED: Batch lookup for specific player_team combinations only
async function batchFindActualPlayerTeams(pool, combinationKeys) {
  try {
    console.log(`🤝 Batch lookup for ${combinationKeys.length} specific player_team combinations`)
    const playerTeamLookup = {}
    
    if (combinationKeys.length === 0) return playerTeamLookup
    
    // Parse the keys back to player/team IDs
    const combinations = combinationKeys.map(key => {
      const [playerId, teamId] = key.split('_')
      return { playerId, teamId, key }
    })
    
    // Batch query all specific combinations
    const conditions = combinations.map((_, index) => 
      `(pt.player = @player${index} AND pt.team = @team${index})`
    ).join(' OR ')
    
    const request = pool.request()
    combinations.forEach((combo, index) => {
      request.input(`player${index}`, sql.BigInt, combo.playerId)
      request.input(`team${index}`, sql.Int, combo.teamId)
    })
    
    const query = `
      SELECT 
        pt.player_team_id as playerTeamId,
        pt.player as playerId,
        pt.team as teamId
      FROM player_team pt
      WHERE ${conditions}
    `
    
    console.log(`🔍 Running player_team query with ${combinations.length} combinations`)
    const result = await request.query(query)
    console.log(`📊 Query returned ${result.recordset.length} existing player_team records`)
    
    // Index results by player_team key
    result.recordset.forEach(row => {
      const key = `${row.playerId}_${row.teamId}`
      playerTeamLookup[key] = {
        playerTeamId: String(row.playerTeamId),
        playerId: String(row.playerId),
        teamId: String(row.teamId)
      }
      console.log(`✅ Found player_team record: ${key} -> ${row.playerTeamId}`)
    })
    
    console.log(`✅ Batch player_team lookup complete: ${Object.keys(playerTeamLookup).length} combinations found`)
    return playerTeamLookup
    
  } catch (error) {
    console.error('Error in batch player_team lookup:', error)
    return {}
  }
}

// LEGACY: Old inefficient batch lookup (kept for reference)
async function batchFindPlayerTeams(pool, playerLookup, teamLookup) {
  // This was creating too many unnecessary combinations
  // Replaced with batchFindActualPlayerTeams above
  return {}
}

// LEGACY: Individual player lookup (kept for compatibility)
async function findPlayerMatches(pool, playerName, organizationId = null) {
  try {
    console.log(`🔍 Searching for player: "${playerName}"${organizationId ? ` (org filter: ${organizationId})` : ' (no org filter)'}`)
    
    if (!playerName || typeof playerName !== 'string' || !playerName.trim()) {
      console.log('⚠️ No player name provided or invalid player name:', playerName)
      return { exact: [], fuzzy: [] }
    }
    
    // Normalize the player name (remove extra spaces, periods, accents, lowercase)
    const cleanPlayerName = normalizePlayerName(playerName)
    
    console.log(`🔍 Normalized search name: "${cleanPlayerName}"`)
    
    // Exact match search (case-insensitive, normalized spaces, filtered by organization)
    const exactRequest = pool.request()
    exactRequest.input('fullName', sql.NVarChar, cleanPlayerName)
    if (organizationId) {
      exactRequest.input('organizationId', sql.Int, organizationId)
    }
    
    const exactQuery = `
      SELECT DISTINCT 
        p.player_id as playerId,
        p.first_name + ' ' + p.last_name as playerName,
        p.first_name as firstName,
        p.last_name as lastName,
        t.team_id as teamId,
        t.name as teamName,
        t.primary_color as primaryColor,
        t.secondary_color as secondaryColor,
        t.abbreviation as abbreviation
      FROM player p
      LEFT JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
        p.first_name + ' ' + p.last_name, 
        'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = @fullName
      ${organizationId ? `AND (
        -- Include players with NO teams (zero team associations)
        NOT EXISTS (SELECT 1 FROM player_team pt_check WHERE pt_check.player = p.player_id)
        OR 
        -- Include players with teams in the specified organization
        p.player_id IN (
          SELECT DISTINCT pt2.player 
          FROM player_team pt2 
          JOIN team t2 ON pt2.team = t2.team_id 
          WHERE t2.organization = @organizationId
        )
      )` : ''}
      ORDER BY playerName, teamName
    `
    
    const exactResult = await exactRequest.query(exactQuery)
    console.log(`✅ Found ${exactResult.recordset.length} exact matches`)
    
    // Get all players for close match analysis (filtered by organization)
    const allPlayersRequest = pool.request()
    if (organizationId) {
      allPlayersRequest.input('organizationId', sql.Int, organizationId)
    }
    
    const allPlayersQuery = `
      SELECT DISTINCT 
        p.player_id as playerId,
        p.first_name + ' ' + p.last_name as playerName,
        p.first_name as firstName,
        p.last_name as lastName,
        t.team_id as teamId,
        t.name as teamName,
        t.primary_color as primaryColor,
        t.secondary_color as secondaryColor,
        t.abbreviation as abbreviation
      FROM player p
      LEFT JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN team t ON pt.team = t.team_id
      ${organizationId ? `WHERE (
        -- Include players with NO teams (zero team associations)
        NOT EXISTS (SELECT 1 FROM player_team pt_check WHERE pt_check.player = p.player_id)
        OR 
        -- Include players with teams in the specified organization
        p.player_id IN (
          SELECT DISTINCT pt2.player 
          FROM player_team pt2 
          JOIN team t2 ON pt2.team = t2.team_id 
          WHERE t2.organization = @organizationId
        )
      )` : ''}
      ORDER BY playerName, teamName
    `
    
    const allPlayersResult = await allPlayersRequest.query(allPlayersQuery)
    
    // Calculate similarity scores and filter for close matches
    const fuzzyMatches = []
    const processedPlayerIds = new Set()
    const exactPlayerIds = new Set(exactResult.recordset.map(r => r.playerId))
    
    for (const player of allPlayersResult.recordset) {
      // Skip if already in exact matches
      if (exactPlayerIds.has(player.playerId)) continue
      
      // Skip if we've already processed this player
      if (processedPlayerIds.has(player.playerId)) continue
      
      const dbPlayerName = normalizePlayerName(player.playerName || '')
      
      // Skip players with no name
      if (!dbPlayerName) continue
      
      // Calculate Levenshtein distance
      const distance = levenshteinDistance(cleanPlayerName, dbPlayerName)
      const maxLength = Math.max(cleanPlayerName.length, dbPlayerName.length)
      const similarity = 1 - (distance / maxLength)
      
      // More strict criteria for fuzzy matches:
      // 1. Very close match (1-2 character difference for typos)
      // 2. OR high similarity (> 85%) for close variations
      // 3. OR last name exact match with similar first name
      const nameParts = cleanPlayerName.split(' ')
      const dbNameParts = dbPlayerName.split(' ')
      const lastNameMatch = nameParts.length > 1 && dbNameParts.length > 1 && 
                           nameParts[nameParts.length - 1] === dbNameParts[dbNameParts.length - 1]
      
      if (distance <= 2 || similarity > 0.85 || (lastNameMatch && similarity > 0.7)) {
        fuzzyMatches.push({
          ...player,
          distance,
          similarity
        })
        processedPlayerIds.add(player.playerId)
      }
    }
    
    // Sort by similarity (closest matches first) and take top 5
    fuzzyMatches.sort((a, b) => b.similarity - a.similarity)
    const topFuzzyMatches = fuzzyMatches.slice(0, 5)
    
    console.log(`🔍 Found ${topFuzzyMatches.length} close fuzzy matches`)
    
    // Group by player to consolidate teams
    const groupPlayersByTeam = (recordset) => {
      const playerMap = new Map()
      recordset.forEach(row => {
        const playerId = String(row.playerId)
        if (!playerMap.has(playerId)) {
          playerMap.set(playerId, {
            playerId,
            playerName: row.playerName,
            firstName: row.firstName,
            lastName: row.lastName,
            teams: []
          })
        }
        
        if (row.teamId) {
          // Check for duplicate teams before adding
          const existingTeam = playerMap.get(playerId).teams.find(team => team.teamId === String(row.teamId))
          if (!existingTeam) {
            playerMap.get(playerId).teams.push({
              teamId: String(row.teamId),
              teamName: row.teamName,
              primaryColor: row.primaryColor,
              secondaryColor: row.secondaryColor,
              abbreviation: row.abbreviation
            })
          }
        }
      })
      
      // Debug output
      const result = Array.from(playerMap.values())
      result.forEach(player => {
        if (player.playerName.toLowerCase().includes('realmuto')) {
          console.log(`🔍 Debug - ${player.playerName} teams:`, player.teams.map(t => t.abbreviation))
        }
      })
      
      return result
    }

    return {
      exact: groupPlayersByTeam(exactResult.recordset),
      fuzzy: groupPlayersByTeam(topFuzzyMatches)
    }
    
  } catch (error) {
    console.error('Error finding player matches:', error)
    return { exact: [], fuzzy: [] }
  }
}

// Helper function to find team matches
async function findTeamMatches(pool, teamNames, organizationId = null) {
  try {
    console.log(`🏟️ Searching for teams: "${teamNames.join(', ')}"`)
    const matches = { exact: [], fuzzy: [] }
    
    if (!teamNames || teamNames.length === 0) {
      return matches
    }
    
    for (const teamName of teamNames) {
      const cleanTeamName = teamName.trim()
      
      // Exact match only - no fuzzy matching for teams (filtered by organization)
      const exactRequest = pool.request()
      exactRequest.input('teamName', sql.NVarChar, cleanTeamName)
      if (organizationId) {
        exactRequest.input('organizationId', sql.Int, organizationId)
      }
      
      const exactQuery = `
        SELECT DISTINCT 
          t.team_id as teamId,
          t.name as teamName,
          t.city as city,
          t.abbreviation as abbreviation,
          t.primary_color as primaryColor,
          t.secondary_color as secondaryColor
        FROM team t
        WHERE (LOWER(t.name) = LOWER(@teamName) OR LOWER(t.abbreviation) = LOWER(@teamName))
        ${organizationId ? 'AND t.organization = @organizationId' : ''}
        ORDER BY t.name
      `
      
      const exactResult = await exactRequest.query(exactQuery)
      
      // Add matches, but avoid duplicates based on team_id
      exactResult.recordset.forEach(row => {
        const existingMatch = matches.exact.find(m => m.teamId === String(row.teamId))
        if (!existingMatch) {
          matches.exact.push({
            teamId: String(row.teamId),
            teamName: row.teamName,
            city: row.city,
            abbreviation: row.abbreviation,
            primaryColor: row.primaryColor,
            secondaryColor: row.secondaryColor
          })
        }
      })
    }
    
    console.log(`✅ Found ${matches.exact.length} team matches`)
    return matches
    
  } catch (error) {
    console.error('Error finding team matches:', error)
    return { exact: [], fuzzy: [] }
  }
}

// Helper function to find player_team matches
async function findPlayerTeamMatches(pool, playerMatches, teamMatches) {
  try {
    console.log(`🤝 Searching for player_team combinations`)
    const matches = []
    
    if (!playerMatches?.exact?.length || !teamMatches?.exact?.length) {
      console.log(`⚠️ No exact player or team matches to check player_team combinations`)
      return matches
    }
    
    for (const player of playerMatches.exact) {
      for (const team of teamMatches.exact) {
        console.log(`🔍 Checking player_team: ${player.playerName} (${player.playerId}) + ${team.teamName} (${team.teamId})`)
        
        const request = pool.request()
        request.input('playerId', sql.BigInt, player.playerId)
        request.input('teamId', sql.Int, team.teamId)
        
        const query = `
          SELECT pt.player_team_id as playerTeamId
          FROM player_team pt
          WHERE pt.player = @playerId AND pt.team = @teamId
        `
        
        const result = await request.query(query)
        
        if (result.recordset.length > 0) {
          const match = {
            playerTeamId: String(result.recordset[0].playerTeamId),
            playerId: player.playerId,
            teamId: team.teamId,
            playerName: player.playerName,
            teamName: team.teamName
          }
          matches.push(match)
          console.log(`✅ Found player_team match: ${match.playerName} - ${match.teamName} (ID: ${match.playerTeamId})`)
        } else {
          console.log(`❌ No player_team record found for ${player.playerName} - ${team.teamName}`)
        }
      }
    }
    
    console.log(`✅ Found ${matches.length} total player_team matches`)
    return matches
    
  } catch (error) {
    console.error('Error finding player_team matches:', error)
    return []
  }
}

// Create new player endpoint
router.post('/create-player', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { firstName, lastName } = req.body
    
    if (!firstName || !lastName) {
      return res.status(400).json({ message: 'First name and last name are required' })
    }
    
    const pool = await connectToDatabase()
    
    const result = await pool.request()
      .input('firstName', sql.NVarChar, firstName.trim())
      .input('lastName', sql.NVarChar, lastName.trim())
      .query(`
        INSERT INTO player (first_name, last_name)
        OUTPUT INSERTED.player_id, INSERTED.first_name, INSERTED.last_name
        VALUES (@firstName, @lastName)
      `)
    
    const newPlayer = result.recordset[0]
    
    res.json({
      success: true,
      player: {
        playerId: String(newPlayer.player_id),
        playerName: `${newPlayer.first_name} ${newPlayer.last_name}`,
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

// Create new team endpoint
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
    
    const result = await pool.request()
      .input('teamName', sql.NVarChar, teamName.trim())
      .input('city', sql.NVarChar, city?.trim() || null)
      .input('abbreviation', sql.NVarChar, abbreviation?.trim() || null)
      .input('organizationId', sql.Int, organizationId)
      .query(`
        INSERT INTO team (name, city, abbreviation, organization)
        OUTPUT INSERTED.team_id, INSERTED.name, INSERTED.city, INSERTED.abbreviation, INSERTED.primary_color, INSERTED.secondary_color
        VALUES (@teamName, @city, @abbreviation, @organizationId)
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

// Create new player_team endpoint
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
        OUTPUT INSERTED.player_team_id
        VALUES (@playerId, @teamId)
      `)
    
    // Get the full details for response
    const detailsResult = await pool.request()
      .input('playerTeamId', sql.BigInt, result.recordset[0].player_team_id)
      .query(`
        SELECT 
          pt.player_team_id as playerTeamId,
          p.first_name + ' ' + p.last_name as playerName,
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
      message: 'Failed to create player-team combination',
      error: error.message 
    })
  }
})

module.exports = router