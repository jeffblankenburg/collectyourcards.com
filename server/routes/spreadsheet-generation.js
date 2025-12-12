const express = require('express')
const { authMiddleware, requireAdmin, requireDataAdmin, requireSuperAdmin } = require('../middleware/auth')
const router = express.Router()
const { prisma } = require('../config/prisma-singleton')
const ExcelJS = require('exceljs')
const { BlobServiceClient } = require('@azure/storage-blob')

// Azure Blob Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING
const CONTAINER_NAME = 'spreadsheets'

// Initialize blob service client if configured
let blobServiceClient = null
let containerClient = null

if (AZURE_STORAGE_CONNECTION_STRING) {
  try {
    blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
    containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME)
    console.log('✅ Azure Blob Storage initialized for spreadsheets')
  } catch (error) {
    console.error('❌ Failed to initialize Azure Blob Storage:', error)
  }
}

// POST /api/spreadsheet-generation/queue/:setId - Queue a set for spreadsheet generation (admin only)
router.post('/queue/:setId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { setId } = req.params
    const { priority = 5 } = req.body
    
    console.log(`Queueing spreadsheet generation for set ${setId} with priority ${priority}`)
    
    // Check if set exists
    const set = await prisma.set.findUnique({
      where: { set_id: parseInt(setId) }
    })
    
    if (!set) {
      return res.status(404).json({
        error: 'Set not found',
        message: `Set with ID ${setId} does not exist`
      })
    }
    
    // Check if there's already a pending job
    const existingJob = await prisma.spreadsheet_generation_queue.findFirst({
      where: {
        set_id: parseInt(setId),
        status: { in: ['pending', 'processing'] }
      }
    })
    
    if (existingJob) {
      // Update priority if higher
      if (priority > existingJob.priority) {
        await prisma.spreadsheet_generation_queue.update({
          where: { queue_id: existingJob.queue_id },
          data: { priority: priority }
        })
      }
      
      return res.json({
        message: 'Job already queued',
        queue_id: existingJob.queue_id,
        status: existingJob.status
      })
    }
    
    // Create new job
    const job = await prisma.spreadsheet_generation_queue.create({
      data: {
        set_id: parseInt(setId),
        priority: priority,
        status: 'pending'
      }
    })
    
    // Update set status
    await prisma.set.update({
      where: { set_id: parseInt(setId) },
      data: {
        checklist_generation_status: 'pending'
      }
    })
    
    res.json({
      message: 'Spreadsheet generation queued',
      queue_id: job.queue_id,
      set_name: set.name
    })
    
  } catch (error) {
    console.error('Error queueing spreadsheet generation:', error)
    res.status(500).json({
      error: 'Failed to queue generation',
      message: error.message
    })
  }
})

// Helper function to generate spreadsheet for a set
async function generateSpreadsheetForSet(setId, triggerType = 'manual', triggerDetails = {}) {
  const startTime = Date.now()

  console.log(`📊 Starting spreadsheet generation for set ${setId}`)

  // Get set details
  const set = await prisma.set.findUnique({
    where: { set_id: parseInt(setId) },
    include: {
      series_series_setToset: {
        orderBy: { name: 'asc' }
      }
    }
  })

  if (!set) {
    throw new Error(`Set with ID ${setId} does not exist`)
  }

  // Update status to generating
  await prisma.set.update({
    where: { set_id: parseInt(setId) },
    data: {
      checklist_generation_status: 'generating'
    }
  })

  // Fetch all cards for all series in the set, properly sorted
  const allCards = []

  for (const series of set.series_series_setToset) {
    const cards = await prisma.$queryRawUnsafe(`
      SELECT
        c.card_id,
        c.card_number,
        c.sort_order,
        c.is_rookie,
        c.is_autograph,
        c.is_relic,
        c.is_short_print,
        c.print_run,
        c.notes,
        s.name as series_name,
        col.name as color_name,
        STRING_AGG(CONCAT(p.first_name, ' ', p.last_name), ', ') as player_names,
        STRING_AGG(t.name, ', ') as team_names
      FROM card c
      INNER JOIN series s ON c.series = s.series_id
      LEFT JOIN color col ON c.color = col.color_id
      LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      LEFT JOIN team t ON pt.team = t.team_id
      WHERE c.series = ${series.series_id}
      GROUP BY c.card_id, c.card_number, c.sort_order, c.is_rookie, c.is_autograph, c.is_relic,
               c.is_short_print, c.print_run, c.notes, s.name, col.name
      ORDER BY c.sort_order
    `)

    allCards.push(...cards.map(card => ({
      ...card,
      card_id: Number(card.card_id),
      sort_order: Number(card.sort_order)
    })))
  }

  // Fetch card-to-team and card-to-player mappings for Teams and Players tabs
  // This query gets individual team associations per card (not aggregated)
  const cardTeamMappings = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT
      c.card_id,
      c.card_number,
      c.sort_order,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.is_short_print,
      c.print_run,
      c.notes,
      s.name as series_name,
      col.name as color_name,
      t.name as team_name,
      t.team_Id as team_id,
      (SELECT STRING_AGG(CONCAT(p2.first_name, ' ', p2.last_name), ', ')
       FROM card_player_team cpt2
       INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
       INNER JOIN player p2 ON pt2.player = p2.player_id
       WHERE cpt2.card = c.card_id) as player_names
    FROM card c
    INNER JOIN series s ON c.series = s.series_id
    LEFT JOIN color col ON c.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN team t ON pt.team = t.team_id
    WHERE s.[set] = ${set.set_id}
      AND t.name IS NOT NULL
    ORDER BY t.name, s.name, c.sort_order
  `)

  // Fetch card-to-player mappings for Players tab
  const cardPlayerMappings = await prisma.$queryRawUnsafe(`
    SELECT DISTINCT
      c.card_id,
      c.card_number,
      c.sort_order,
      c.is_rookie,
      c.is_autograph,
      c.is_relic,
      c.is_short_print,
      c.print_run,
      c.notes,
      s.name as series_name,
      col.name as color_name,
      CONCAT(p.first_name, ' ', p.last_name) as player_name,
      p.last_name as player_last_name,
      p.first_name as player_first_name,
      p.player_id,
      (SELECT STRING_AGG(t2.name, ', ')
       FROM card_player_team cpt2
       INNER JOIN player_team pt2 ON cpt2.player_team = pt2.player_team_id
       INNER JOIN team t2 ON pt2.team = t2.team_Id
       WHERE cpt2.card = c.card_id) as team_names
    FROM card c
    INNER JOIN series s ON c.series = s.series_id
    LEFT JOIN color col ON c.color = col.color_id
    LEFT JOIN card_player_team cpt ON c.card_id = cpt.card
    LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
    LEFT JOIN player p ON pt.player = p.player_id
    WHERE s.[set] = ${set.set_id}
      AND p.first_name IS NOT NULL
    ORDER BY p.last_name, p.first_name, s.name, c.sort_order
  `)

  console.log(`📋 Found ${allCards.length} cards for set "${set.name}"`)

  // Create Excel workbook
  const workbook = new ExcelJS.Workbook()
  workbook.creator = 'CollectYourCards.com'
  workbook.lastModifiedBy = 'CollectYourCards.com'
  workbook.created = new Date()
  workbook.modified = new Date()

  // Helper function to add styled headers
  const addStyledHeaders = (worksheet, headers) => {
    const headerRow = worksheet.addRow(headers)
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } }
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    }
    return headerRow
  }

  // Helper function to add card data row
  const addCardRow = (worksheet, card) => {
    const row = worksheet.addRow([
      card.series_name || '',
      card.card_number || '',
      card.player_names || '',
      card.team_names || '',
      card.print_run ? `/${card.print_run}` : '',
      card.color_name || '',
      card.is_rookie ? 'Y' : '',
      card.is_autograph ? 'Y' : '',
      card.is_relic ? 'Y' : '',
      card.is_short_print ? 'Y' : '',
      card.notes || ''
    ])

    // Conditional formatting
    if (card.is_rookie) {
      row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } }
    }
    if (card.is_autograph) {
      row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8D4' } }
    }
    if (card.is_relic) {
      row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } }
    }
    if (card.is_short_print) {
      row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC0CB' } }
    }

    return row
  }

  // Helper function to auto-size columns
  const autoSizeColumns = (worksheet) => {
    worksheet.columns.forEach(column => {
      let maxLength = 0
      column.eachCell({ includeEmpty: false }, cell => {
        const columnLength = cell.value ? cell.value.toString().length : 0
        if (columnLength > maxLength) {
          maxLength = columnLength
        }
      })
      column.width = Math.min(maxLength + 2, 50)
    })
  }

  const headers = ['Series', 'Card #', 'Player(s)', 'Team(s)', 'Print Run', 'Color', 'RC', 'Auto', 'Relic', 'SP', 'Notes']

  // TAB 1: Master List (Complete checklist)
  const masterSheet = workbook.addWorksheet('Master List')
  addStyledHeaders(masterSheet, headers)

  allCards.forEach(card => {
    addCardRow(masterSheet, card)
  })

  autoSizeColumns(masterSheet)
  masterSheet.views = [{ state: 'frozen', ySplit: 1 }]

  // TAB 2: Summary Sheet
  const summarySheet = workbook.addWorksheet('Summary')

  // Set overview
  summarySheet.addRow(['Set Overview']).font = { bold: true, size: 14 }
  summarySheet.addRow([])
  summarySheet.addRow(['Set Name:', set.name])
  summarySheet.addRow(['Year:', set.year || 'N/A'])
  summarySheet.addRow(['Total Cards:', allCards.length])
  summarySheet.addRow(['Total Series:', set.series_series_setToset.length])
  summarySheet.addRow(['Generated:', new Date().toLocaleString()])
  summarySheet.addRow(['Source:', 'CollectYourCards.com'])
  summarySheet.addRow([])

  // Series breakdown
  summarySheet.addRow(['Series Breakdown']).font = { bold: true, size: 12 }
  const seriesHeaderRow = summarySheet.addRow(['Series Name', 'Card Count', 'RC', 'Auto', 'Relic', 'SP'])
  seriesHeaderRow.font = { bold: true }

  // Group cards by series for statistics
  const seriesStats = {}
  allCards.forEach(card => {
    const seriesName = card.series_name
    if (!seriesStats[seriesName]) {
      seriesStats[seriesName] = { total: 0, rookies: 0, autos: 0, relics: 0, shortPrints: 0 }
    }
    seriesStats[seriesName].total++
    if (card.is_rookie) seriesStats[seriesName].rookies++
    if (card.is_autograph) seriesStats[seriesName].autos++
    if (card.is_relic) seriesStats[seriesName].relics++
    if (card.is_short_print) seriesStats[seriesName].shortPrints++
  })

  Object.entries(seriesStats).forEach(([seriesName, stats]) => {
    summarySheet.addRow([seriesName, stats.total, stats.rookies, stats.autos, stats.relics, stats.shortPrints])
  })

  summarySheet.addRow([])

  // Team breakdown with players
  summarySheet.addRow(['Teams & Players']).font = { bold: true, size: 14 }
  summarySheet.addRow([])

  // Build team -> player -> card count structure from cardTeamMappings and cardPlayerMappings
  const teamPlayerStats = {}
  cardTeamMappings.forEach(mapping => {
    const teamName = mapping.team_name
    if (!teamPlayerStats[teamName]) {
      teamPlayerStats[teamName] = { totalCards: 0, players: {} }
    }
    teamPlayerStats[teamName].totalCards++
  })

  // Get player counts per team from cardPlayerMappings (which has team info)
  cardPlayerMappings.forEach(mapping => {
    // Each mapping has team_names (comma-separated if multiple)
    const teams = (mapping.team_names || '').split(', ').filter(t => t)
    const playerName = mapping.player_name

    teams.forEach(teamName => {
      if (teamPlayerStats[teamName]) {
        if (!teamPlayerStats[teamName].players[playerName]) {
          teamPlayerStats[teamName].players[playerName] = 0
        }
        teamPlayerStats[teamName].players[playerName]++
      }
    })
  })

  // Sort teams alphabetically and output
  const sortedTeams = Object.keys(teamPlayerStats).sort((a, b) => a.localeCompare(b))

  sortedTeams.forEach(teamName => {
    const teamData = teamPlayerStats[teamName]
    const cardWord = teamData.totalCards === 1 ? 'card' : 'cards'

    // Team header
    summarySheet.addRow([`${teamName} (${teamData.totalCards} ${cardWord})`]).font = { bold: true, size: 12 }

    // Sort players alphabetically and list them
    const sortedPlayers = Object.keys(teamData.players).sort((a, b) => a.localeCompare(b))
    sortedPlayers.forEach(playerName => {
      const playerCardCount = teamData.players[playerName]
      const playerCardWord = playerCardCount === 1 ? 'card' : 'cards'
      summarySheet.addRow([`    ${playerName}`, playerCardCount])
    })

    summarySheet.addRow([])
  })

  autoSizeColumns(summarySheet)

  // TAB 3: Teams (Cards grouped by team, sorted by team name then series)
  const teamsSheet = workbook.addWorksheet('Teams')

  // Group cards by team
  const cardsByTeam = {}
  cardTeamMappings.forEach(mapping => {
    const teamName = mapping.team_name
    if (!cardsByTeam[teamName]) {
      cardsByTeam[teamName] = []
    }
    cardsByTeam[teamName].push(mapping)
  })

  // Sort teams alphabetically and add to worksheet
  const sortedTeamNames = Object.keys(cardsByTeam).sort((a, b) => a.localeCompare(b))

  sortedTeamNames.forEach((teamName) => {
    const teamCards = cardsByTeam[teamName]

    // Add section header - bold and larger text for easy scanning
    teamsSheet.addRow([`${teamName} (${teamCards.length} ${teamCards.length === 1 ? 'card' : 'cards'})`]).font = { bold: true, size: 14 }

    // Add column headers
    addStyledHeaders(teamsSheet, headers)

    // Add cards for this team
    teamCards.forEach(mapping => {
      const row = teamsSheet.addRow([
        mapping.series_name || '',
        mapping.card_number || '',
        mapping.player_names || '',
        mapping.team_name || '',
        mapping.print_run ? `/${mapping.print_run}` : '',
        mapping.color_name || '',
        mapping.is_rookie ? 'Y' : '',
        mapping.is_autograph ? 'Y' : '',
        mapping.is_relic ? 'Y' : '',
        mapping.is_short_print ? 'Y' : '',
        mapping.notes || ''
      ])

      if (mapping.is_rookie) {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } }
      }
      if (mapping.is_autograph) {
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8D4' } }
      }
      if (mapping.is_relic) {
        row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } }
      }
      if (mapping.is_short_print) {
        row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC0CB' } }
      }
    })

    // Add blank row between sections
    teamsSheet.addRow([])
  })

  autoSizeColumns(teamsSheet)

  console.log(`📋 Added ${sortedTeamNames.length} teams to Teams tab`)

  // TAB 4: Players (Cards grouped by player, sorted by player name then series)
  const playersSheet = workbook.addWorksheet('Players')

  // Group cards by player
  const cardsByPlayer = {}
  cardPlayerMappings.forEach(mapping => {
    const playerKey = `${mapping.player_last_name}|||${mapping.player_first_name}|||${mapping.player_id}`
    if (!cardsByPlayer[playerKey]) {
      cardsByPlayer[playerKey] = {
        displayName: mapping.player_name,
        cards: []
      }
    }
    cardsByPlayer[playerKey].cards.push(mapping)
  })

  // Sort players by last name, then first name
  const sortedPlayerKeys = Object.keys(cardsByPlayer).sort((a, b) => {
    const [lastA, firstA] = a.split('|||')
    const [lastB, firstB] = b.split('|||')
    const lastNameCompare = lastA.localeCompare(lastB)
    if (lastNameCompare !== 0) return lastNameCompare
    return firstA.localeCompare(firstB)
  })

  sortedPlayerKeys.forEach((playerKey) => {
    const playerData = cardsByPlayer[playerKey]
    const playerCards = playerData.cards

    // Add section header - bold and larger text for easy scanning
    playersSheet.addRow([`${playerData.displayName} (${playerCards.length} ${playerCards.length === 1 ? 'card' : 'cards'})`]).font = { bold: true, size: 14 }

    // Add column headers
    addStyledHeaders(playersSheet, headers)

    // Add cards for this player
    playerCards.forEach(mapping => {
      const row = playersSheet.addRow([
        mapping.series_name || '',
        mapping.card_number || '',
        mapping.player_name || '',
        mapping.team_names || '',
        mapping.print_run ? `/${mapping.print_run}` : '',
        mapping.color_name || '',
        mapping.is_rookie ? 'Y' : '',
        mapping.is_autograph ? 'Y' : '',
        mapping.is_relic ? 'Y' : '',
        mapping.is_short_print ? 'Y' : '',
        mapping.notes || ''
      ])

      if (mapping.is_rookie) {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } }
      }
      if (mapping.is_autograph) {
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8D4' } }
      }
      if (mapping.is_relic) {
        row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } }
      }
      if (mapping.is_short_print) {
        row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFC0CB' } }
      }
    })

    // Add blank row between sections
    playersSheet.addRow([])
  })

  autoSizeColumns(playersSheet)

  console.log(`📋 Added ${sortedPlayerKeys.length} players to Players tab`)

  // Generate Excel buffer
  const excelBuffer = await workbook.xlsx.writeBuffer()
  const fileSize = excelBuffer.length

  let blobUrl = null

  // Upload to Azure Blob Storage if configured
  if (containerClient) {
    try {
      // Create safe filename from set name
      const safeSetName = set.name.replace(/[^a-z0-9]/gi, '_').substring(0, 100)
      const blobName = `${safeSetName}_checklist.xlsx`
      const blockBlobClient = containerClient.getBlockBlobClient(blobName)

      await blockBlobClient.upload(excelBuffer, fileSize, {
        blobHTTPHeaders: {
          blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          blobContentDisposition: `attachment; filename="${safeSetName}_checklist.xlsx"`
        }
      })

      blobUrl = blockBlobClient.url
      console.log(`✅ Uploaded spreadsheet to Azure: ${blobUrl}`)
    } catch (uploadError) {
      console.error('Failed to upload to Azure:', uploadError)
      throw new Error(`Failed to upload spreadsheet: ${uploadError.message}`)
    }
  } else {
    throw new Error('Azure Blob Storage not configured')
  }

  const generationTime = Date.now() - startTime

  // Update set with generation info
  await prisma.set.update({
    where: { set_id: parseInt(setId) },
    data: {
      checklist_blob_url: blobUrl,
      checklist_generated_at: new Date(),
      checklist_generation_status: 'current',
      checklist_file_size: fileSize,
      checklist_format: 'xlsx'
    }
  })

  console.log(`✅ Generated spreadsheet for "${set.name}" in ${generationTime}ms (${allCards.length} cards, ${fileSize} bytes)`)

  return {
    set_id: setId,
    set_name: set.name,
    card_count: allCards.length,
    file_size: fileSize,
    generation_time_ms: generationTime,
    blob_url: blobUrl,
    format: 'xlsx'
  }
}

// POST /api/spreadsheet-generation/generate/:setId - Generate spreadsheet immediately (admin only)
router.post('/generate/:setId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { setId } = req.params

    const result = await generateSpreadsheetForSet(setId, 'manual', { user_id: req.user?.userId })

    res.json({
      message: 'Spreadsheet generated successfully',
      ...result
    })
  } catch (error) {
    console.error('Error generating spreadsheet:', error)

    // Update status to failed
    await prisma.set.update({
      where: { set_id: parseInt(req.params.setId) },
      data: {
        checklist_generation_status: 'failed'
      }
    }).catch(console.error)

    res.status(500).json({
      error: 'Failed to generate spreadsheet',
      message: error.message
    })
  }
})

// POST /api/spreadsheet-generation/generate-all-complete - Generate spreadsheets for all complete sets (admin only)
router.post('/generate-all-complete', authMiddleware, requireAdmin, async (req, res) => {
  try {
    // Find all sets marked as complete that either:
    // 1. Have never had a checklist generated
    // 2. Have been modified since last generation (based on checklist_generation_status)
    const completeSets = await prisma.$queryRaw`
      SELECT
        s.set_id,
        s.name,
        s.year,
        s.checklist_generation_status,
        s.checklist_generated_at,
        (SELECT COUNT(*) FROM series ser WHERE ser.[set] = s.set_id) as series_count,
        (SELECT COUNT(*) FROM card c
         INNER JOIN series ser ON c.series = ser.series_id
         WHERE ser.[set] = s.set_id) as card_count
      FROM [set] s
      WHERE s.is_complete = 1
      ORDER BY s.year DESC, s.name ASC
    `

    if (completeSets.length === 0) {
      return res.json({
        message: 'No complete sets found',
        generated: 0,
        failed: 0,
        results: []
      })
    }

    console.log(`📊 Starting bulk spreadsheet generation for ${completeSets.length} complete sets`)

    const results = []
    let successCount = 0
    let failCount = 0

    for (const set of completeSets) {
      const setId = Number(set.set_id)
      try {
        console.log(`📋 Generating spreadsheet for: ${set.name} (${set.year})`)
        const result = await generateSpreadsheetForSet(setId, 'bulk', { user_id: req.user?.userId })
        results.push({
          set_id: setId,
          set_name: set.name,
          year: set.year,
          success: true,
          card_count: result.card_count,
          file_size: result.file_size,
          generation_time_ms: result.generation_time_ms,
          blob_url: result.blob_url
        })
        successCount++
      } catch (error) {
        console.error(`❌ Failed to generate spreadsheet for ${set.name}:`, error.message)
        results.push({
          set_id: setId,
          set_name: set.name,
          year: set.year,
          success: false,
          error: error.message
        })
        failCount++
      }
    }

    console.log(`✅ Bulk generation complete: ${successCount} succeeded, ${failCount} failed`)

    res.json({
      message: `Generated spreadsheets for ${successCount} of ${completeSets.length} complete sets`,
      generated: successCount,
      failed: failCount,
      total_sets: completeSets.length,
      results
    })

  } catch (error) {
    console.error('Error in bulk spreadsheet generation:', error)
    res.status(500).json({
      error: 'Failed to generate spreadsheets',
      message: error.message
    })
  }
})

// GET /api/spreadsheet-generation/complete-sets - Get list of complete sets with their checklist status (admin only)
router.get('/complete-sets', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const completeSets = await prisma.$queryRaw`
      SELECT
        s.set_id,
        s.name,
        s.year,
        s.is_complete,
        s.checklist_blob_url,
        s.checklist_generated_at,
        s.checklist_generation_status,
        s.checklist_file_size,
        s.checklist_format,
        (SELECT COUNT(*) FROM series ser WHERE ser.[set] = s.set_id) as series_count,
        (SELECT COUNT(*) FROM card c
         INNER JOIN series ser ON c.series = ser.series_id
         WHERE ser.[set] = s.set_id) as card_count
      FROM [set] s
      WHERE s.is_complete = 1
      ORDER BY s.year DESC, s.name ASC
    `

    const serializedSets = completeSets.map(set => ({
      set_id: Number(set.set_id),
      name: set.name,
      year: set.year,
      is_complete: set.is_complete,
      checklist_blob_url: set.checklist_blob_url,
      checklist_generated_at: set.checklist_generated_at,
      checklist_generation_status: set.checklist_generation_status || 'never_generated',
      checklist_file_size: set.checklist_file_size ? Number(set.checklist_file_size) : null,
      checklist_format: set.checklist_format,
      series_count: Number(set.series_count),
      card_count: Number(set.card_count)
    }))

    res.json({
      total_complete_sets: serializedSets.length,
      sets_with_checklists: serializedSets.filter(s => s.checklist_blob_url).length,
      sets_without_checklists: serializedSets.filter(s => !s.checklist_blob_url).length,
      sets: serializedSets
    })

  } catch (error) {
    console.error('Error fetching complete sets:', error)
    res.status(500).json({
      error: 'Failed to fetch complete sets',
      message: error.message
    })
  }
})

// GET /api/spreadsheet-generation/status/:setId - Get generation status
router.get('/status/:setId', async (req, res) => {
  try {
    const { setId } = req.params
    
    const set = await prisma.set.findUnique({
      where: { set_id: parseInt(setId) },
      select: {
        set_id: true,
        name: true,
        checklist_blob_url: true,
        checklist_generated_at: true,
        checklist_generation_status: true,
        checklist_file_size: true,
        checklist_format: true
      }
    })
    
    if (!set) {
      return res.status(404).json({
        error: 'Set not found'
      })
    }
    
    // Check for pending jobs
    const pendingJob = await prisma.spreadsheet_generation_queue.findFirst({
      where: {
        set_id: parseInt(setId),
        status: { in: ['pending', 'processing'] }
      }
    })
    
    res.json({
      set_id: set.set_id,
      set_name: set.name,
      status: set.checklist_generation_status || 'never_generated',
      blob_url: set.checklist_blob_url,
      generated_at: set.checklist_generated_at,
      file_size: set.checklist_file_size,
      format: set.checklist_format,
      pending_job: pendingJob ? {
        queue_id: pendingJob.queue_id,
        status: pendingJob.status,
        queued_at: pendingJob.queued_at
      } : null
    })
    
  } catch (error) {
    console.error('Error getting generation status:', error)
    res.status(500).json({
      error: 'Failed to get status',
      message: error.message
    })
  }
})

// GET /api/spreadsheet-generation/queue - Get queue status (admin only)
router.get('/queue', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const queue = await prisma.spreadsheet_generation_queue.findMany({
      where: {
        status: { in: ['pending', 'processing'] }
      },
      include: {
        set: {
          select: {
            name: true,
            year: true
          }
        }
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'desc' },
        { queued_at: 'asc' }
      ]
    })
    
    res.json({
      queue_length: queue.length,
      jobs: queue.map(job => ({
        queue_id: job.queue_id,
        set_id: job.set_id,
        set_name: job.set.name,
        set_year: job.set.year,
        priority: job.priority,
        status: job.status,
        queued_at: job.queued_at,
        started_at: job.started_at,
        retry_count: job.retry_count
      }))
    })
    
  } catch (error) {
    console.error('Error getting queue status:', error)
    res.status(500).json({
      error: 'Failed to get queue',
      message: error.message
    })
  }
})

// Auto-generation trigger with debouncing
// Keeps track of pending regenerations to avoid duplicate work
const pendingRegenerations = new Map()
const DEBOUNCE_DELAY = 5000 // 5 seconds - wait for batch changes to complete

/**
 * Triggers automatic spreadsheet regeneration for a set when data changes.
 * Only regenerates if the set is marked as complete.
 * Debounced to handle batch updates efficiently.
 *
 * @param {number} setId - The set ID to regenerate
 * @param {string} triggerSource - What triggered the regeneration (card, series, set, card_player_team)
 * @param {object} details - Additional details about the change
 */
async function triggerAutoRegeneration(setId, triggerSource, details = {}) {
  if (!setId) {
    console.log('⚠️ Auto-regen skipped: No setId provided')
    return
  }

  const setIdNum = parseInt(setId)

  // Clear any existing pending regeneration for this set
  if (pendingRegenerations.has(setIdNum)) {
    clearTimeout(pendingRegenerations.get(setIdNum))
  }

  // Schedule regeneration after debounce delay
  const timeoutId = setTimeout(async () => {
    pendingRegenerations.delete(setIdNum)

    try {
      // Check if set is complete before regenerating
      const set = await prisma.set.findUnique({
        where: { set_id: setIdNum },
        select: { set_id: true, name: true, is_complete: true }
      })

      if (!set) {
        console.log(`⚠️ Auto-regen skipped: Set ${setIdNum} not found`)
        return
      }

      if (!set.is_complete) {
        console.log(`⚠️ Auto-regen skipped: Set "${set.name}" is not marked as complete`)
        return
      }

      console.log(`🔄 Auto-regenerating spreadsheet for "${set.name}" (triggered by: ${triggerSource})`)

      await generateSpreadsheetForSet(setIdNum, 'auto', {
        trigger_source: triggerSource,
        ...details
      })

      console.log(`✅ Auto-regeneration complete for "${set.name}"`)

    } catch (error) {
      console.error(`❌ Auto-regeneration failed for set ${setIdNum}:`, error.message)
      // Update status to indicate regeneration is needed
      await prisma.set.update({
        where: { set_id: setIdNum },
        data: { checklist_generation_status: 'stale' }
      }).catch(() => {})
    }
  }, DEBOUNCE_DELAY)

  pendingRegenerations.set(setIdNum, timeoutId)
  console.log(`📋 Queued auto-regeneration for set ${setIdNum} (trigger: ${triggerSource}, debounce: ${DEBOUNCE_DELAY}ms)`)
}

/**
 * Helper to get the set ID from a series ID
 */
async function getSetIdFromSeriesId(seriesId) {
  const series = await prisma.series.findUnique({
    where: { series_id: BigInt(seriesId) },
    select: { set: true }
  })
  return series?.set || null
}

/**
 * Helper to get the set ID from a card ID
 */
async function getSetIdFromCardId(cardId) {
  const card = await prisma.card.findUnique({
    where: { card_id: BigInt(cardId) },
    select: {
      series_series: {
        select: { set: true }
      }
    }
  })
  return card?.series_series?.set || null
}

module.exports = router
module.exports.triggerAutoRegeneration = triggerAutoRegeneration
module.exports.getSetIdFromSeriesId = getSetIdFromSeriesId
module.exports.getSetIdFromCardId = getSetIdFromCardId