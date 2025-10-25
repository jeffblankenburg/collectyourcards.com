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
      const rawNotes = row[4] ? String(row[4]).trim() : '' // Notes are in column 5 (index 4) if present

      // Remove parentheses from notes (Requirement #1)
      const notes = rawNotes.replace(/[()]/g, '')

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

      // Determine if this is a rookie card (Requirement #2)
      // Check for RC, Rookie, or variations in the RC indicator column
      const isRookieCard = rcIndicator ? (
        rcIndicator.toLowerCase().includes('rc') ||
        rcIndicator.toLowerCase().includes('rookie') ||
        rcIndicator.toLowerCase() === 'yes' ||
        rcIndicator.toLowerCase() === 'true' ||
        rcIndicator === '1'
      ) : false

      return {
        sortOrder: index + 1,  // Sequential sort order starting at 1
        cardNumber,
        playerNames,
        teamNames,
        isRC: isRookieCard,
        rcIndicator: rcIndicator,  // Keep original value for display
        isAutograph: false, // Default to false - can be toggled in UI
        isRelic: false, // Default to false - can be toggled in UI
        notes: notes || ''  // Ensure notes is always a string
      }
    }).filter(card => card && card.cardNumber) // Only include valid rows with card numbers

    console.log(`Parsed ${cards.length} cards from XLSX file`)

    // PREPROCESSING: Handle duplicate card numbers and multi-player rows
    console.log('📊 Starting card preprocessing for multi-player detection...')
    const processedCards = []
    let previousCard = null // Track only the immediately previous card for consecutive duplicate detection

    for (const card of cards) {
      // Check if this card number matches the PREVIOUS card (Pattern 2: consecutive duplicates ONLY)
      if (previousCard && previousCard.cardNumber === card.cardNumber) {
        console.log(`🔗 Found CONSECUTIVE duplicate card number: ${card.cardNumber}`)

        // Merge players - always add
        previousCard.playerNames += '; ' + card.playerNames

        // Merge teams - but deduplicate if they're the same
        // This handles cases like: José Ramírez (Cleveland Guardians) + Steven Kwan (Cleveland Guardians)
        const existingTeams = previousCard.teamNames.split(/[;]/).map(t => t.trim()).filter(t => t)
        const newTeams = card.teamNames.split(/[;]/).map(t => t.trim()).filter(t => t)

        // Only add teams that aren't already in the list
        newTeams.forEach(newTeam => {
          if (!existingTeams.some(existingTeam => existingTeam.toLowerCase() === newTeam.toLowerCase())) {
            existingTeams.push(newTeam)
          }
        })

        previousCard.teamNames = existingTeams.join('; ')

        // Merge RC status (if any row has RC, mark as RC)
        previousCard.isRC = previousCard.isRC || card.isRC

        // Merge notes - but deduplicate if they're the same
        if (card.notes && card.notes !== previousCard.notes) {
          previousCard.notes += (previousCard.notes ? '; ' : '') + card.notes
        }

        console.log(`  Merged: ${card.playerNames} (${card.teamNames})`)
        console.log(`  Result: ${previousCard.playerNames} (${previousCard.teamNames})`)
        // Keep previousCard the same so we can merge into it again if needed
        continue // Skip adding as separate card
      }

      // Check for Pattern 1: Multiple players on same line (/, comma, etc.)
      const hasMultiplePlayers = /[\/,]/.test(card.playerNames)
      if (hasMultiplePlayers) {
        console.log(`👥 Found multiple players on line: ${card.cardNumber} - ${card.playerNames}`)

        // Detect delimiter: prefer / over comma
        const playerDelimiter = card.playerNames.includes('/') ? '/' : ','
        const teamDelimiter = card.teamNames.includes('/') ? '/' : ','

        // Split players and teams
        const players = card.playerNames.split(playerDelimiter).map(p => p.trim())
        const teams = card.teamNames.split(teamDelimiter).map(t => t.trim())

        console.log(`  Players (${players.length}): ${players.join(' | ')}`)
        console.log(`  Teams (${teams.length}): ${teams.join(' | ')}`)

        // Rebuild playerNames and teamNames with semicolons for consistent parsing later
        card.playerNames = players.join('; ')
        card.teamNames = teams.join('; ')

        console.log(`  After rebuild - Players: "${card.playerNames}"`)
        console.log(`  After rebuild - Teams: "${card.teamNames}"`)
      }

      // Add to result and set as previous card for next iteration
      processedCards.push(card)
      previousCard = card
    }

    // Reassign sort orders after merging duplicates
    processedCards.forEach((card, index) => {
      card.sortOrder = index + 1
    })

    console.log(`✅ Preprocessing complete: ${cards.length} rows → ${processedCards.length} unique cards`)

    res.json({
      success: true,
      cards: processedCards,
      message: `Successfully parsed ${processedCards.length} cards`
    })

  } catch (error) {
    console.error('Error parsing XLSX:', error)
    res.status(500).json({
      message: 'Failed to parse XLSX file',
      error: error.message
    })
  }
})

// Parse pasted data (tab-separated)
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

    // Split into rows and parse as tab-separated values
    const rows = data.trim().split('\n').map(row => row.split('\t'))

    console.log('Total rows found:', rows.length)
    console.log('First 3 rows:', rows.slice(0, 3))

    if (rows.length === 0) {
      return res.status(400).json({ message: 'No data rows found' })
    }

    // Skip first row if it looks like headers
    const firstRow = rows[0]
    const hasHeaders = firstRow.some(cell =>
      cell && (
        cell.toLowerCase().includes('card') ||
        cell.toLowerCase().includes('player') ||
        cell.toLowerCase().includes('team')
      )
    )

    const dataRows = hasHeaders ? rows.slice(1) : rows
    console.log('Processing rows:', dataRows.length, '(skipped header:', hasHeaders, ')')

    // Process the data - same format as XLSX: Card Number, Player Name(s), Team Name(s), RC Indicator, Notes
    const cards = dataRows.map((row, index) => {
      // Skip empty rows
      if (!row || row.length === 0 || !row[0] || !row[0].trim()) {
        return null
      }

      const cardNumber = row[0] ? String(row[0]).trim() : ''
      const playerNames = row[1] ? String(row[1]).trim() : ''
      const teamNames = row[2] ? String(row[2]).trim() : ''
      const rcIndicator = row[3] ? String(row[3]).trim() : ''
      const rawNotes = row[4] ? String(row[4]).trim() : ''

      // Remove parentheses from notes
      const notes = rawNotes.replace(/[()]/g, '')

      // Debug first few rows
      if (index < 5) {
        console.log(`Row ${index + 1} mapping:`)
        console.log('  cardNumber:', cardNumber)
        console.log('  playerNames:', playerNames)
        console.log('  teamNames:', teamNames)
        console.log('  rcIndicator:', rcIndicator)
        console.log('  notes:', notes)
      }

      // Determine if this is a rookie card
      const isRookieCard = rcIndicator ? (
        rcIndicator.toLowerCase().includes('rc') ||
        rcIndicator.toLowerCase().includes('rookie') ||
        rcIndicator.toLowerCase() === 'yes' ||
        rcIndicator.toLowerCase() === 'true' ||
        rcIndicator === '1'
      ) : false

      return {
        sortOrder: index + 1,
        cardNumber,
        playerNames,
        teamNames,
        isRC: isRookieCard,
        rcIndicator: rcIndicator,
        isAutograph: false,
        isRelic: false,
        notes: notes || ''
      }
    }).filter(card => card && card.cardNumber)

    console.log(`Parsed ${cards.length} cards from pasted data`)

    // PREPROCESSING: Handle duplicate card numbers and multi-player rows (same logic as XLSX)
    console.log('📊 Starting card preprocessing for multi-player detection...')
    const processedCards = []
    let previousCard = null // Track only the immediately previous card for consecutive duplicate detection

    for (const card of cards) {
      // Check if this card number matches the PREVIOUS card (Pattern 2: consecutive duplicates ONLY)
      if (previousCard && previousCard.cardNumber === card.cardNumber) {
        console.log(`🔗 Found CONSECUTIVE duplicate card number: ${card.cardNumber}`)

        // Merge players - always add
        previousCard.playerNames += '; ' + card.playerNames

        // Merge teams - but deduplicate if they're the same
        const existingTeams = previousCard.teamNames.split(/[;]/).map(t => t.trim()).filter(t => t)
        const newTeams = card.teamNames.split(/[;]/).map(t => t.trim()).filter(t => t)

        // Only add teams that aren't already in the list
        newTeams.forEach(newTeam => {
          if (!existingTeams.some(existingTeam => existingTeam.toLowerCase() === newTeam.toLowerCase())) {
            existingTeams.push(newTeam)
          }
        })

        previousCard.teamNames = existingTeams.join('; ')

        // Merge RC status (if any row has RC, mark as RC)
        previousCard.isRC = previousCard.isRC || card.isRC

        // Merge notes - but deduplicate if they're the same
        if (card.notes && card.notes !== previousCard.notes) {
          previousCard.notes += (previousCard.notes ? '; ' : '') + card.notes
        }

        console.log(`  Merged: ${card.playerNames} (${card.teamNames})`)
        console.log(`  Result: ${previousCard.playerNames} (${previousCard.teamNames})`)
        // Keep previousCard the same so we can merge into it again if needed
        continue // Skip adding as separate card
      }

      // Check for Pattern 1: Multiple players on same line (/, comma, etc.)
      const hasMultiplePlayers = /[\/,]/.test(card.playerNames)
      if (hasMultiplePlayers) {
        console.log(`👥 Found multiple players on line: ${card.cardNumber} - ${card.playerNames}`)

        // Detect delimiter: prefer / over comma
        const playerDelimiter = card.playerNames.includes('/') ? '/' : ','
        const teamDelimiter = card.teamNames.includes('/') ? '/' : ','

        // Split players and teams
        const players = card.playerNames.split(playerDelimiter).map(p => p.trim())
        const teams = card.teamNames.split(teamDelimiter).map(t => t.trim())

        console.log(`  Players (${players.length}): ${players.join(' | ')}`)
        console.log(`  Teams (${teams.length}): ${teams.join(' | ')}`)

        // Rebuild playerNames and teamNames with semicolons for consistent parsing later
        card.playerNames = players.join('; ')
        card.teamNames = teams.join('; ')

        console.log(`  After rebuild - Players: "${card.playerNames}"`)
        console.log(`  After rebuild - Teams: "${card.teamNames}"`)
      }

      // Add to result and set as previous card for next iteration
      processedCards.push(card)
      previousCard = card
    }

    // Reassign sort orders after merging duplicates
    processedCards.forEach((card, index) => {
      card.sortOrder = index + 1
    })

    console.log(`✅ Preprocessing complete: ${cards.length} rows → ${processedCards.length} unique cards`)

    res.json({
      success: true,
      cards: processedCards,
      message: `Successfully parsed ${processedCards.length} cards`
    })

  } catch (error) {
    console.error('Error parsing pasted data:', error)
    res.status(500).json({
      message: 'Failed to parse pasted data',
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
      const playerNamesList = (card.playerNames || '').split(/[,;]/).map(name => name.trim()).filter(name => name)
      const teamNamesList = (card.teamNames || '').split(/[,;]/).map(name => name.trim()).filter(name => name)
      
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
      const playerNamesList = (card.playerNames || '').split(/[,;]/).map(name => name.trim()).filter(name => name)
      const teamNamesList = (card.teamNames || '').split(/[,;]/).map(name => name.trim()).filter(name => name)
      
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
      const playerNamesList = (card.playerNames || '').split(/[,;]/).map(name => name.trim()).filter(name => name)
      const teamNamesList = (card.teamNames || '').split(/[,;]/).map(name => name.trim()).filter(name => name)

      // Process ALL teams on the card first (for Team(s) column display)
      const allCardTeams = { exact: [], fuzzy: [] }
      teamNamesList.forEach(teamName => {
        const teamMatch = teamLookup[teamName]
        if (teamMatch) {
          allCardTeams.exact.push(...teamMatch.exact)
          allCardTeams.fuzzy.push(...teamMatch.fuzzy)
        }
      })

      for (let playerIdx = 0; playerIdx < playerNamesList.length; playerIdx++) {
        const playerName = playerNamesList[playerIdx]
        // Use cached lookups instead of individual queries
        const playerMatches = playerLookup[playerName] || { exact: [], fuzzy: [] }

        // SMART TEAM MATCHING FOR PLAYER_TEAM RECORDS: Match player to team by position
        // This is ONLY used to determine which player_team records to check/create
        // The Team(s) column will show ALL teams from the spreadsheet
        let playerTeamGuess = []
        let isAmbiguous = false

        if (teamNamesList.length === playerNamesList.length) {
          // Perfect match: each player gets their corresponding team
          playerTeamGuess = [teamNamesList[playerIdx]]
          console.log(`✅ Position match: Player "${playerName}" → Team "${teamNamesList[playerIdx]}"`)
        } else if (teamNamesList.length === 1) {
          // All players on same team
          playerTeamGuess = teamNamesList
          console.log(`✅ Single team: Player "${playerName}" → Team "${teamNamesList[0]}"`)
        } else if (playerIdx === 0) {
          // First player always gets first team
          playerTeamGuess = [teamNamesList[0]]
          console.log(`✅ First player: Player "${playerName}" → First team "${teamNamesList[0]}"`)
        } else if (playerIdx === playerNamesList.length - 1 && playerIdx >= teamNamesList.length) {
          // Last player when index exceeds team count: assign to last team
          playerTeamGuess = [teamNamesList[teamNamesList.length - 1]]
          console.log(`✅ Last player overflow: Player "${playerName}" (index ${playerIdx}) → Last team "${teamNamesList[teamNamesList.length - 1]}"`)
        } else if (playerIdx < teamNamesList.length) {
          // Middle players: ambiguous if we have more players than teams
          if (playerNamesList.length > teamNamesList.length) {
            // Ambiguous - could be any team
            playerTeamGuess = teamNamesList // Show all teams as options
            isAmbiguous = true
            console.log(`⚠️ Ambiguous position: Player "${playerName}" (index ${playerIdx}) could be on any team - showing all options`)
          } else {
            // Clear position match
            playerTeamGuess = [teamNamesList[playerIdx]]
            console.log(`✅ Position match: Player "${playerName}" (index ${playerIdx}) → Team "${teamNamesList[playerIdx]}"`)
          }
        } else {
          // Shouldn't reach here, but fallback to ambiguous
          playerTeamGuess = teamNamesList
          isAmbiguous = true
          console.log(`⚠️ Fallback ambiguous: Player "${playerName}" (index ${playerIdx}) - showing all teams`)
        }

        // Collect teams for player_team checking (based on position guess)
        const playerTeamCheckTeams = { exact: [], fuzzy: [] }

        console.log(`📋 Team situation for "${playerName}": teamNamesList.length=${teamNamesList.length}, playerTeamGuess.length=${playerTeamGuess.length}`)
        console.log(`📋 teamNamesList:`, teamNamesList)
        console.log(`📋 playerTeamGuess:`, playerTeamGuess)

        // If NO teams specified, recommend "no-name" teams
        if (teamNamesList.length === 0 || playerTeamGuess.length === 0) {
          console.log(`⚠️ No team specified for "${playerName}" - recommending no-name teams`)
          console.log(`🔍 Querying for no-name teams with organizationId: ${organizationId}`)

          // Get no-name teams from database
          const noNameTeamsQuery = `
            SELECT
              team_id as teamId,
              name as teamName,
              organization,
              primary_color as primaryColor,
              secondary_color as secondaryColor,
              abbreviation
            FROM team
            WHERE (name IS NULL OR name = '' OR LOWER(name) = 'no name')
            ${organizationId ? `AND (organization = ${organizationId} OR organization IS NULL)` : ''}
            ORDER BY organization DESC NULLS LAST
          `

          console.log(`🔍 Executing query:`, noNameTeamsQuery)
          const noNameTeamsResult = await pool.request().query(noNameTeamsQuery)
          console.log(`📊 Query returned ${noNameTeamsResult.recordset.length} results`)

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
              console.log(`   ✅ Recommending: "${teamObj.teamName}" (teamId: ${teamObj.teamId}, org: ${teamObj.organization || 'none'})`)
            })
          } else {
            console.log(`❌ No no-name teams found in database`)
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

        // Get player_team combinations from cached lookup (only for guessed teams)
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

        // Check for auto-selection (more practical logic)
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
        
        // Optional: More strict auto-selection if you want to require teams too
        // if (playerMatches?.exact?.length === 1 && playerTeamCheckTeams?.exact?.length > 0) {
        //   const exactPlayer = playerMatches.exact[0]
        //
        //   // Check if all teams match and player_team records exist
        //   const allTeamsHavePlayerTeam = teamNamesList.every(teamName => {
        //     const matchingTeam = playerTeamCheckTeams.exact.find(team =>
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
          teamNames: teamNamesList, // ALL team names from spreadsheet (not filtered by player)
          teamMatches: allCardTeams, // ALL teams from card (not filtered by player)
          playerTeamCheckTeams: playerTeamCheckTeams, // Position-matched teams for THIS player (for player_team checking)
          playerTeamMatches: playerTeamMatches, // Only player_team records for this player with position-matched teams
          selectedPlayer: selectedPlayer,
          selectedTeams: selectedTeams,
          selectedPlayerTeams: selectedPlayerTeams
        })
      }

      matchedCards.push({
        ...card,
        teamNames: teamNamesList,       // ALL team names from spreadsheet
        teamMatches: allCardTeams,      // ALL matched teams from database
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
    
    let createdCount = 0
    const newPlayerIds = new Map() // Cache for newly created players
    
    try {
      console.log(`🔄 Processing ${matchedCards.length} cards...`)
      
      for (let i = 0; i < matchedCards.length; i++) {
        const card = matchedCards[i]
        console.log(`📋 Processing card ${i + 1}/${matchedCards.length}: ${card.cardNumber}`)
        // Create the card record first
        console.log(`  🃏 Creating card record for ${card.cardNumber}`)
        const cardResult = await transaction.request()
          .input('cardNumber', sql.NVarChar, card.cardNumber)
          .input('seriesId', sql.BigInt, seriesId)
          .input('isRookie', sql.Bit, Boolean(card.isRC))
          .input('isAutograph', sql.Bit, Boolean(card.isAutograph))
          .input('isRelic', sql.Bit, Boolean(card.isRelic))
          .input('printRun', sql.Int, card.printRun || null)
          .input('colorId', sql.Int, card.colorId || null)
          .input('notes', sql.NVarChar, card.notes || null)
          .input('sortOrder', sql.Int, card.sortOrder || 0)
          .query(`
            INSERT INTO card (card_number, series, is_rookie, is_autograph, is_relic, print_run, color, notes, sort_order, created)
            VALUES (@cardNumber, @seriesId, @isRookie, @isAutograph, @isRelic, @printRun, @colorId, @notes, @sortOrder, GETDATE());
            SELECT SCOPE_IDENTITY() AS card_id;
          `)
        
        const cardId = cardResult.recordset[0].card_id
        console.log(`  ✅ Card created with ID: ${cardId}`)
        
        // Process each player for this card
        console.log(`  👥 Processing ${card.players?.length || 0} players for card ${card.cardNumber}`)
        for (let j = 0; j < (card.players?.length || 0); j++) {
          const player = card.players[j]
          console.log(`    🔍 Processing player ${j + 1}: ${player.name}`)
          console.log(`    📊 Player data:`, {
            name: player.name,
            hasSelectedPlayer: !!player.selectedPlayer,
            selectedPlayerTeams: player.selectedPlayerTeams?.length || 0
          })

          // Check if we have selected player and player_team records
          if (player.selectedPlayer && player.selectedPlayerTeams && player.selectedPlayerTeams.length > 0) {
            console.log(`    ✅ Using existing player with ${player.selectedPlayerTeams.length} player_team records`)
            const playerId = BigInt(player.selectedPlayer.playerId)

            // Create card_player_team records for each player_team relationship
            for (const playerTeam of player.selectedPlayerTeams) {
              // Check if this is a placeholder ID from frontend (existing_playerId_teamId)
              let actualPlayerTeamId = playerTeam.playerTeamId

              if (String(playerTeam.playerTeamId).startsWith('existing_')) {
                console.log(`    🔍 Detected placeholder ID: ${playerTeam.playerTeamId}, looking up actual player_team_id`)
                // This was created on frontend, need to look up actual ID
                const ptResult = await transaction.request()
                  .input('playerId', sql.BigInt, playerId)
                  .input('teamId', sql.Int, playerTeam.teamId)
                  .query(`
                    SELECT player_team_id
                    FROM player_team
                    WHERE player = @playerId AND team = @teamId
                  `)

                if (ptResult.recordset.length > 0) {
                  actualPlayerTeamId = ptResult.recordset[0].player_team_id
                  console.log(`    ✅ Found actual player_team_id: ${actualPlayerTeamId}`)
                } else {
                  console.error(`    ❌ Could not find player_team record for player ${playerId} and team ${playerTeam.teamId}`)
                  continue // Skip this player_team
                }
              }

              const playerTeamId = BigInt(actualPlayerTeamId)
              console.log(`    🔗 Creating card_player_team: cardId=${cardId}, playerTeamId=${playerTeamId} (${playerTeam.playerName} - ${playerTeam.teamName})`)

              await transaction.request()
                .input('cardId', sql.BigInt, cardId)
                .input('playerTeamId', sql.BigInt, playerTeamId)
                .query(`
                  INSERT INTO card_player_team (card, player_team)
                  VALUES (@cardId, @playerTeamId)
                `)
              console.log(`    ✅ Card-player-team relationship created`)
            }
          } else if (player.selectedPlayer && player.selectedTeams && player.selectedTeams.length > 0) {
            // Player selected but no player_team records exist yet - need to create them
            console.log(`    🆕 Creating player_team records for existing player: ${player.selectedPlayer.playerName}`)
            const playerId = BigInt(player.selectedPlayer.playerId)

            for (const team of player.selectedTeams) {
              const teamId = parseInt(team.teamId)
              console.log(`    🔗 Creating player_team: playerId=${playerId}, teamId=${teamId} (${team.teamName})`)

              // Check if player_team already exists
              const existingPlayerTeam = await transaction.request()
                .input('playerId', sql.BigInt, playerId)
                .input('teamId', sql.Int, teamId)
                .query(`
                  SELECT player_team_id FROM player_team
                  WHERE player = @playerId AND team = @teamId
                `)

              let playerTeamId
              if (existingPlayerTeam.recordset.length > 0) {
                playerTeamId = existingPlayerTeam.recordset[0].player_team_id
                console.log(`    ♻️ Using existing player_team: ${playerTeamId}`)
              } else {
                const playerTeamResult = await transaction.request()
                  .input('playerId', sql.BigInt, playerId)
                  .input('teamId', sql.Int, teamId)
                  .query(`
                    INSERT INTO player_team (player, team)
                    VALUES (@playerId, @teamId);
                    SELECT SCOPE_IDENTITY() AS player_team_id;
                  `)
                playerTeamId = playerTeamResult.recordset[0].player_team_id
                console.log(`    ✅ Created player_team: ${playerTeamId}`)
              }

              // Create card_player_team record
              console.log(`    🔗 Creating card_player_team: cardId=${cardId}, playerTeamId=${playerTeamId}`)
              await transaction.request()
                .input('cardId', sql.BigInt, cardId)
                .input('playerTeamId', sql.BigInt, playerTeamId)
                .query(`
                  INSERT INTO card_player_team (card, player_team)
                  VALUES (@cardId, @playerTeamId)
                `)
              console.log(`    ✅ Card-player-team relationship created`)
            }
          } else {
            // Need to create new player
            console.log(`    🆕 Creating new player: ${player.name}`)
            const playerName = player.name
            let firstName = playerName, lastName = ''

            const nameParts = playerName.split(' ')
            if (nameParts.length > 1) {
              firstName = nameParts[0]
              lastName = nameParts.slice(1).join(' ')
            }

            console.log(`    📝 Name parsing: "${playerName}" → first: "${firstName}", last: "${lastName}"`)

            // Check if we already created this player
            const playerKey = playerName.toLowerCase()
            let playerId
            if (newPlayerIds.has(playerKey)) {
              playerId = newPlayerIds.get(playerKey)
              console.log(`    ♻️ Using cached player ID: ${playerId}`)
            } else {
              // Create new player
              console.log(`    ➕ Creating new player in database`)
              const playerResult = await transaction.request()
                .input('firstName', sql.NVarChar, firstName || null)
                .input('lastName', sql.NVarChar, lastName || null)
                .query(`
                  INSERT INTO player (first_name, last_name)
                  VALUES (@firstName, @lastName);
                  SELECT SCOPE_IDENTITY() AS player_id;
                `)

              playerId = playerResult.recordset[0].player_id
              newPlayerIds.set(playerKey, playerId)
              console.log(`    ✅ New player created with ID: ${playerId}`)
            }

            console.log(`    ⚠️ New player created but no team associations - card will have no player_team relationships`)
          }
        }
        
        createdCount++
      }
      
      await transaction.commit()
      console.log(`🎉 Successfully imported ${createdCount} cards`)
      
      res.json({
        success: true,
        created: createdCount,
        message: `Successfully imported ${createdCount} cards`
      })
      
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

// Helper function to normalize team names for matching
function normalizeTeamName(name) {
  return normalizeAccents(name.trim().toLowerCase())
    .replace(/\s+/g, '') // Remove ALL spaces so "Wolf Pack" matches "Wolfpack"
    .replace(/[.-]/g, '') // Remove periods and hyphens
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

    // Include NCAA players when searching for professional leagues
    // Organization IDs: 1=MLB, 2=NFL, 3=NBA, 4=NHL, 5=NCAA
    const organizationFilter = organizationId ? [parseInt(organizationId)] : null
    if (organizationFilter && [1, 2, 3, 4].includes(parseInt(organizationId))) {
      organizationFilter.push(5) // Always include NCAA for pro leagues
      console.log(`🎓 Including NCAA players in batch search (orgs: ${organizationFilter.join(', ')})`)
    }

    // Get all players WITH their teams for suggestions
    let baseQuery = `
      SELECT DISTINCT
        p.player_id as playerId,
        LTRIM(RTRIM(COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, ''))) as playerName,
        p.first_name as firstName,
        p.last_name as lastName,
        p.nick_name as nickName,
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

    if (organizationFilter) {
      // Create parameters for each organization ID in the filter
      organizationFilter.forEach((orgId, index) => {
        request.input(`org${index}`, sql.Int, orgId)
      })
      baseQuery += `
        WHERE (
          NOT EXISTS (SELECT 1 FROM player_team pt_check WHERE pt_check.player = p.player_id)
          OR
          p.player_id IN (
            SELECT DISTINCT pt2.player
            FROM player_team pt2
            JOIN team t2 ON pt2.team = t2.team_id
            WHERE t2.organization IN (${organizationFilter.map((_, i) => `@org${i}`).join(', ')})
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
            nickName: row.nickName,
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
      
      // Find exact matches (check both regular name and nickname + last_name)
      const exactMatches = allPlayersGrouped.filter(player => {
        const normalizedPlayerName = normalizePlayerName(player.playerName || '')
        const isRegularMatch = normalizedPlayerName === normalizedSearchName

        // Also check nickname + last_name (e.g., "Minnie Minoso")
        let isNicknameMatch = false
        if (player.nickName && player.lastName) {
          const nickNameVariation = normalizePlayerName(`${player.nickName} ${player.lastName}`)
          isNicknameMatch = nickNameVariation === normalizedSearchName
        }

        const isMatch = isRegularMatch || isNicknameMatch

        if (isMatch) {
          if (isNicknameMatch) {
            console.log(`✅ EXACT NICKNAME MATCH: "${searchName}" matches "${player.nickName} ${player.lastName}" (${player.playerName}) with ${player.teams.length} teams`)
          } else {
            console.log(`✅ EXACT MATCH: "${searchName}" matches "${player.playerName}" with ${player.teams.length} teams`)
          }
        }

        return isMatch
      })
      
      // Find fuzzy matches (only if no exact matches found)
      let fuzzyMatches = []
      if (exactMatches.length === 0) {
        // Check if this is a single-name search (like "Ichiro")
        const isSingleName = !normalizedSearchName.includes(' ')

        fuzzyMatches = allPlayersGrouped.filter(player => {
          // Construct full name from database fields
          const dbFullName = `${player.firstName || ''} ${player.lastName || ''}`.trim()
          const normalizedDbName = normalizePlayerName(dbFullName)

          if (!normalizedDbName) return false

          // Special handling for single-name searches (e.g., "Ichiro")
          if (isSingleName) {
            const normalizedFirstName = normalizePlayerName(player.firstName || '')
            const normalizedLastName = normalizePlayerName(player.lastName || '')

            // Check if search matches just the first name
            if (normalizedFirstName === normalizedSearchName) {
              console.log(`👤 SINGLE NAME MATCH (first name): "${searchName}" matches "${dbFullName}"`)
              player.similarity = 0.95 // High priority for single-name matches
              player.distance = 0
              return true
            }

            // Check if search matches just the last name
            if (normalizedLastName === normalizedSearchName) {
              console.log(`👤 SINGLE NAME MATCH (last name): "${searchName}" matches "${dbFullName}"`)
              player.similarity = 0.95
              player.distance = 0
              return true
            }
          }

          // Calculate similarity between search string and database full name
          const distance = levenshteinDistance(normalizedSearchName, normalizedDbName)
          const maxLength = Math.max(normalizedSearchName.length, normalizedDbName.length)
          const similarity = 1 - (distance / maxLength)

          // Also check nickname variation if available
          let nickSimilarity = 0
          let nickDistance = 999
          if (player.nickName && player.lastName) {
            const nickFullName = `${player.nickName} ${player.lastName}`.trim()
            const normalizedNickName = normalizePlayerName(nickFullName)
            nickDistance = levenshteinDistance(normalizedSearchName, normalizedNickName)
            const nickMaxLength = Math.max(normalizedSearchName.length, normalizedNickName.length)
            nickSimilarity = 1 - (nickDistance / nickMaxLength)
          }

          // Use the best similarity score
          const bestSimilarity = Math.max(similarity, nickSimilarity)
          const bestDistance = Math.min(distance, nickDistance)

          // Match if BOTH distance is close AND similarity is reasonable
          // Very close matches (distance <= 2) are always accepted
          // Medium distance (3) requires good similarity to avoid false positives
          const isFuzzyMatch = bestDistance <= 2 || (bestDistance <= 3 && bestSimilarity > 0.75) || bestSimilarity > 0.85

          if (isFuzzyMatch) {
            if (nickSimilarity > similarity) {
              console.log(`🔍 FUZZY NICKNAME MATCH: "${searchName}" ~= "${player.nickName} ${player.lastName}" (similarity: ${bestSimilarity.toFixed(2)}, distance: ${bestDistance}, teams: ${player.teams.length})`)
            } else {
              console.log(`🔍 FUZZY MATCH: "${searchName}" ~= "${dbFullName}" (similarity: ${bestSimilarity.toFixed(2)}, distance: ${bestDistance}, teams: ${player.teams.length})`)
            }
            player.similarity = bestSimilarity
            player.distance = bestDistance
          }

          return isFuzzyMatch
        })

        // Sort fuzzy matches by similarity (best first)
        fuzzyMatches.sort((a, b) => b.similarity - a.similarity)

        // If we have a perfect single-name match (similarity = 1.0), prioritize it heavily
        // and limit other results
        const hasPerfectMatch = fuzzyMatches.some(p => p.similarity === 1.0)
        if (hasPerfectMatch) {
          // Show perfect match(es) first, then only top 2 others
          const perfectMatches = fuzzyMatches.filter(p => p.similarity === 1.0)
          const otherMatches = fuzzyMatches.filter(p => p.similarity < 1.0).slice(0, 2)
          fuzzyMatches = [...perfectMatches, ...otherMatches]
        } else {
          // No perfect match, show top 5
          fuzzyMatches = fuzzyMatches.slice(0, 5)
        }
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
    console.log(`🏟️ Team names to lookup:`, teamNames)
    console.log(`🏟️ Organization ID:`, organizationId)
    const teamLookup = {}

    if (teamNames.length === 0) return teamLookup

    // Create parameterized query for all teams using OR conditions
    const request = pool.request()

    // Build OR conditions for name matching (with full normalization including spaces)
    const nameConditions = teamNames.map((teamName, index) => {
      const normalizedName = normalizeTeamName(teamName)
      request.input(`team${index}`, sql.NVarChar, normalizedName)
      console.log(`  🔧 Parameter @team${index} = "${normalizedName}" (original: "${teamName}")`)
      // Need to normalize database values too - remove spaces, periods, hyphens
      return `(
        REPLACE(REPLACE(REPLACE(LOWER(t.name), ' ', ''), '.', ''), '-', '') = @team${index}
        OR
        REPLACE(REPLACE(REPLACE(LOWER(t.abbreviation), ' ', ''), '.', ''), '-', '') = @team${index}
      )`
    }).join(' OR ')

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
        t.secondary_color as secondaryColor
      FROM team t
      WHERE (${nameConditions})
      ${organizationId ? 'AND t.organization = @organizationId' : ''}
      ORDER BY t.name
    `

    console.log(`🔍 Executing exact match query:`, exactQuery.substring(0, 500))
    const exactResult = await request.query(exactQuery)
    console.log(`📊 Exact match query returned ${exactResult.recordset.length} results`)

    // Group results by team name (check both name and abbreviation with full normalization)
    teamNames.forEach(teamName => {
      const normalizedTeamName = normalizeTeamName(teamName)

      // Debug: show what we're searching for
      console.log(`🔍 Searching for team: "${teamName}"`)
      console.log(`  📝 Normalized input: "${normalizedTeamName}"`)
      console.log(`  📊 Comparing against ${exactResult.recordset.length} teams from database`)

      const matches = exactResult.recordset.filter(team => {
        // Normalize both sides for comparison (removes spaces, accents, periods, hyphens)
        const normalizedTeamNameFromDB = normalizeTeamName(team.teamName)
        const normalizedAbbrevFromDB = team.abbreviation ? normalizeTeamName(team.abbreviation) : ''

        const nameMatch = normalizedTeamNameFromDB === normalizedTeamName
        const abbrevMatch = normalizedAbbrevFromDB === normalizedTeamName

        // Detailed logging for debugging
        if (team.teamName.toLowerCase().includes('expos') || team.teamName.toLowerCase().includes('montreal')) {
          console.log(`  🔍 Checking "${team.teamName}":`)
          console.log(`     DB normalized: "${normalizedTeamNameFromDB}"`)
          console.log(`     Input normalized: "${normalizedTeamName}"`)
          console.log(`     Match: ${nameMatch}`)
        }

        if (nameMatch || abbrevMatch) {
          console.log(`  ✅ MATCH: "${teamName}" matches "${team.teamName}"`)
        }

        return nameMatch || abbrevMatch
      }).map(team => ({
        teamId: String(team.teamId),
        teamName: team.teamName,
        city: team.city,
        abbreviation: team.abbreviation,
        primaryColor: team.primaryColor,
        secondaryColor: team.secondaryColor
      }))

      console.log(`✅ Found ${matches.length} matches for "${teamName}":`, matches.map(m => m.teamName))

      // If we have multiple matches and organizationId is specified, log a warning
      // This shouldn't happen since we filter by organization in the query
      if (matches.length > 1 && organizationId) {
        console.warn(`⚠️ Multiple matches found for "${teamName}" within organization ${organizationId}:`, matches.map(m => m.teamName))
      }

      teamLookup[teamName] = {
        exact: matches,
        fuzzy: []
      }
    })

    // For teams with no exact matches, try fuzzy matching (Requirement #3)
    const teamsWithoutMatches = teamNames.filter(teamName =>
      teamLookup[teamName].exact.length === 0
    )

    console.log(`📊 Team match status:`)
    teamNames.forEach(teamName => {
      console.log(`  "${teamName}": ${teamLookup[teamName].exact.length} exact matches`)
    })

    if (teamsWithoutMatches.length > 0) {
      console.log(`🔍 Attempting fuzzy matching for ${teamsWithoutMatches.length} teams without exact matches`)
      console.log(`🔍 Teams needing fuzzy match:`, teamsWithoutMatches)

      for (const teamName of teamsWithoutMatches) {
        const fuzzyRequest = pool.request()
        const normalizedSearchTerm = normalizeTeamName(teamName)
        fuzzyRequest.input('teamName', sql.NVarChar, `%${normalizedSearchTerm}%`)
        if (organizationId) {
          fuzzyRequest.input('organizationId', sql.Int, organizationId)
        }

        const fuzzyQuery = `
          SELECT
            t.team_id as teamId,
            t.name as teamName,
            t.city as city,
            t.abbreviation as abbreviation,
            t.primary_color as primaryColor,
            t.secondary_color as secondaryColor,
            CASE WHEN REPLACE(REPLACE(REPLACE(LOWER(t.name), ' ', ''), '.', ''), '-', '') LIKE @teamName + '%' THEN 0 ELSE 1 END as matchPriority
          FROM team t
          WHERE (
            REPLACE(REPLACE(REPLACE(LOWER(t.name), ' ', ''), '.', ''), '-', '') LIKE @teamName
            OR
            REPLACE(REPLACE(REPLACE(LOWER(t.abbreviation), ' ', ''), '.', ''), '-', '') LIKE @teamName
          )
          ${organizationId ? 'AND t.organization = @organizationId' : ''}
          ORDER BY matchPriority, t.name
        `

        const fuzzyResult = await fuzzyRequest.query(fuzzyQuery)

        if (fuzzyResult.recordset.length > 0) {
          teamLookup[teamName].fuzzy = fuzzyResult.recordset.map(team => ({
            teamId: String(team.teamId),
            teamName: team.teamName,
            city: team.city,
            abbreviation: team.abbreviation,
            primaryColor: team.primaryColor,
            secondaryColor: team.secondaryColor,
            matchType: 'fuzzy' // Mark as fuzzy match for UI
          }))
          console.log(`✨ Found ${fuzzyResult.recordset.length} fuzzy matches for "${teamName}":`,
            fuzzyResult.recordset.map(r => r.teamName).join(', '))
        }
      }
    }

    const exactCount = Object.values(teamLookup).filter(t => t.exact.length > 0).length
    const fuzzyCount = Object.values(teamLookup).filter(t => t.fuzzy.length > 0).length
    console.log(`✅ Batch team lookup complete: ${exactCount} exact matches, ${fuzzyCount} fuzzy matches`)
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

    // Include NCAA players when searching for professional leagues
    // Organization IDs: 1=MLB, 2=NFL, 3=NBA, 4=NHL, 5=NCAA
    const organizationFilter = organizationId ? [parseInt(organizationId)] : null
    if (organizationFilter && [1, 2, 3, 4].includes(parseInt(organizationId))) {
      organizationFilter.push(5) // Always include NCAA for pro leagues
      console.log(`🎓 Including NCAA players in search (orgs: ${organizationFilter.join(', ')})`)
    }

    // Normalize the player name (remove extra spaces, periods, accents, lowercase)
    const cleanPlayerName = normalizePlayerName(playerName)

    console.log(`🔍 Normalized search name: "${cleanPlayerName}"`)

    // Exact match search (case-insensitive, normalized spaces, filtered by organization)
    const exactRequest = pool.request()
    exactRequest.input('fullName', sql.NVarChar, cleanPlayerName)
    if (organizationFilter) {
      // Create parameters for each organization ID in the filter
      organizationFilter.forEach((orgId, index) => {
        exactRequest.input(`org${index}`, sql.Int, orgId)
      })
    }
    
    const exactQuery = `
      SELECT DISTINCT
        p.player_id as playerId,
        LTRIM(RTRIM(COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, ''))) as playerName,
        p.first_name as firstName,
        p.last_name as lastName,
        p.nick_name as nickName,
        t.team_id as teamId,
        t.name as teamName,
        t.primary_color as primaryColor,
        t.secondary_color as secondaryColor,
        t.abbreviation as abbreviation
      FROM player p
      LEFT JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE (
        -- Match on first_name + last_name
        LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
          p.first_name + ' ' + p.last_name,
          'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = @fullName
        OR
        -- Match on nickname + last_name (e.g., "Minnie Minoso")
        (p.nick_name IS NOT NULL AND
         LOWER(LTRIM(RTRIM(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(
           p.nick_name + ' ' + p.last_name,
           'á', 'a'), 'é', 'e'), 'í', 'i'), 'ó', 'o'), 'ú', 'u'), 'ñ', 'n'), '.', ''), '  ', ' ')))) = @fullName)
      )
      ${organizationFilter ? `AND (
        -- Include players with NO teams (zero team associations)
        NOT EXISTS (SELECT 1 FROM player_team pt_check WHERE pt_check.player = p.player_id)
        OR
        -- Include players with teams in the specified organizations (e.g., NFL + NCAA)
        p.player_id IN (
          SELECT DISTINCT pt2.player
          FROM player_team pt2
          JOIN team t2 ON pt2.team = t2.team_id
          WHERE t2.organization IN (${organizationFilter.map((_, i) => `@org${i}`).join(', ')})
        )
      )` : ''}
      ORDER BY playerName, teamName
    `
    
    const exactResult = await exactRequest.query(exactQuery)
    console.log(`✅ Found ${exactResult.recordset.length} exact matches`)
    
    // Get all players for close match analysis (filtered by organization)
    const allPlayersRequest = pool.request()
    if (organizationFilter) {
      // Create parameters for each organization ID in the filter
      organizationFilter.forEach((orgId, index) => {
        allPlayersRequest.input(`org${index}`, sql.Int, orgId)
      })
    }

    const allPlayersQuery = `
      SELECT DISTINCT
        p.player_id as playerId,
        LTRIM(RTRIM(COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, ''))) as playerName,
        p.first_name as firstName,
        p.last_name as lastName,
        p.nick_name as nickName,
        t.team_id as teamId,
        t.name as teamName,
        t.primary_color as primaryColor,
        t.secondary_color as secondaryColor,
        t.abbreviation as abbreviation
      FROM player p
      LEFT JOIN player_team pt ON p.player_id = pt.player
      LEFT JOIN team t ON pt.team = t.team_id
      ${organizationFilter ? `WHERE (
        -- Include players with NO teams (zero team associations)
        NOT EXISTS (SELECT 1 FROM player_team pt_check WHERE pt_check.player = p.player_id)
        OR
        -- Include players with teams in the specified organizations (e.g., NFL + NCAA)
        p.player_id IN (
          SELECT DISTINCT pt2.player
          FROM player_team pt2
          JOIN team t2 ON pt2.team = t2.team_id
          WHERE t2.organization IN (${organizationFilter.map((_, i) => `@org${i}`).join(', ')})
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

      // Also check nickname + last_name variation
      let nickNameVariation = null
      if (player.nickName && player.lastName) {
        nickNameVariation = normalizePlayerName(`${player.nickName} ${player.lastName}`)
      }

      // Calculate Levenshtein distance for both name variations
      const distance = levenshteinDistance(cleanPlayerName, dbPlayerName)
      const maxLength = Math.max(cleanPlayerName.length, dbPlayerName.length)
      const similarity = 1 - (distance / maxLength)

      // Also check nickname similarity if available
      let nickSimilarity = 0
      let nickDistance = 999
      if (nickNameVariation) {
        nickDistance = levenshteinDistance(cleanPlayerName, nickNameVariation)
        const nickMaxLength = Math.max(cleanPlayerName.length, nickNameVariation.length)
        nickSimilarity = 1 - (nickDistance / nickMaxLength)
      }

      // Use the best similarity score
      const bestSimilarity = Math.max(similarity, nickSimilarity)
      const bestDistance = Math.min(distance, nickDistance)

      // More strict criteria for fuzzy matches:
      // 1. Very close match (1-2 character difference for typos)
      // 2. OR high similarity (> 85%) for close variations
      // 3. OR last name exact match with similar first name
      const nameParts = cleanPlayerName.split(' ')
      const dbNameParts = dbPlayerName.split(' ')
      const lastNameMatch = nameParts.length > 1 && dbNameParts.length > 1 &&
                           nameParts[nameParts.length - 1] === dbNameParts[dbNameParts.length - 1]

      if (bestDistance <= 2 || bestSimilarity > 0.85 || (lastNameMatch && bestSimilarity > 0.7)) {
        fuzzyMatches.push({
          ...player,
          distance: bestDistance,
          similarity: bestSimilarity
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
            nickName: row.nickName,
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
      const normalizedTeamName = normalizeTeamName(teamName)

      // First try exact match (filtered by organization)
      const exactRequest = pool.request()
      exactRequest.input('teamName', sql.NVarChar, normalizedTeamName)
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
        WHERE (
          REPLACE(REPLACE(REPLACE(LOWER(t.name), ' ', ''), '.', ''), '-', '') = @teamName
          OR
          REPLACE(REPLACE(REPLACE(LOWER(t.abbreviation), ' ', ''), '.', ''), '-', '') = @teamName
        )
        ${organizationId ? 'AND t.organization = @organizationId' : ''}
        ORDER BY t.name
      `

      const exactResult = await exactRequest.query(exactQuery)

      // Add exact matches, avoiding duplicates based on team_id
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

      // If no exact match found, try fuzzy matching (Requirement #3)
      // This helps match "Angels" to "Los Angeles Angels" or "Anaheim Angels"
      if (exactResult.recordset.length === 0) {
        console.log(`🔍 No exact match for "${teamName}", trying fuzzy match...`)

        const fuzzyRequest = pool.request()
        fuzzyRequest.input('teamName', sql.NVarChar, `%${normalizedTeamName}%`)
        if (organizationId) {
          fuzzyRequest.input('organizationId', sql.Int, organizationId)
        }

        const fuzzyQuery = `
          SELECT
            t.team_id as teamId,
            t.name as teamName,
            t.city as city,
            t.abbreviation as abbreviation,
            t.primary_color as primaryColor,
            t.secondary_color as secondaryColor,
            CASE WHEN REPLACE(REPLACE(REPLACE(LOWER(t.name), ' ', ''), '.', ''), '-', '') LIKE @teamName + '%' THEN 0 ELSE 1 END as matchPriority
          FROM team t
          WHERE (
            REPLACE(REPLACE(REPLACE(LOWER(t.name), ' ', ''), '.', ''), '-', '') LIKE @teamName
            OR
            REPLACE(REPLACE(REPLACE(LOWER(t.abbreviation), ' ', ''), '.', ''), '-', '') LIKE @teamName
          )
          ${organizationId ? 'AND t.organization = @organizationId' : ''}
          ORDER BY matchPriority, t.name
        `

        const fuzzyResult = await fuzzyRequest.query(fuzzyQuery)

        // Add fuzzy matches, avoiding duplicates
        fuzzyResult.recordset.forEach(row => {
          const existingExact = matches.exact.find(m => m.teamId === String(row.teamId))
          const existingFuzzy = matches.fuzzy.find(m => m.teamId === String(row.teamId))
          if (!existingExact && !existingFuzzy) {
            matches.fuzzy.push({
              teamId: String(row.teamId),
              teamName: row.teamName,
              city: row.city,
              abbreviation: row.abbreviation,
              primaryColor: row.primaryColor,
              secondaryColor: row.secondaryColor,
              matchType: 'fuzzy' // Mark as fuzzy match for UI
            })
          }
        })

        if (fuzzyResult.recordset.length > 0) {
          console.log(`✨ Found ${fuzzyResult.recordset.length} fuzzy matches for "${cleanTeamName}":`,
            fuzzyResult.recordset.map(r => r.teamName).join(', '))
        }
      }
    }

    console.log(`✅ Found ${matches.exact.length} exact team matches, ${matches.fuzzy.length} fuzzy matches`)
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
        VALUES (@firstName, @lastName);
        SELECT SCOPE_IDENTITY() AS player_id, @firstName AS first_name, @lastName AS last_name;
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
        VALUES (@teamName, @city, @abbreviation, @organizationId);
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
      message: 'Failed to create player-team combination',
      error: error.message 
    })
  }
})

module.exports = router