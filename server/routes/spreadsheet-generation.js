const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { BlobServiceClient } = require('@azure/storage-blob')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const ExcelJS = require('exceljs')

const router = express.Router()
const prisma = new PrismaClient()

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

// POST /api/spreadsheet-generation/generate/:setId - Generate spreadsheet immediately (admin only)
router.post('/generate/:setId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { setId } = req.params
    const startTime = Date.now()
    
    console.log(`Starting immediate spreadsheet generation for set ${setId}`)
    
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
      return res.status(404).json({
        error: 'Set not found',
        message: `Set with ID ${setId} does not exist`
      })
    }
    
    // Update status to generating
    await prisma.set.update({
      where: { set_id: parseInt(setId) },
      data: {
        checklist_generation_status: 'generating'
      }
    })
    
    console.log(`⚠️ Excel generation temporarily disabled - queueing job instead`)
    
    // Queue the job for background processing instead of blocking
    const job = await prisma.spreadsheet_generation_queue.create({
      data: {
        set_id: parseInt(setId),
        priority: 10, // High priority for manual requests
        status: 'pending'
      }
    })
    
    // Update set status to indicate it's been queued
    await prisma.set.update({
      where: { set_id: parseInt(setId) },
      data: {
        checklist_generation_status: 'pending'
      }
    })
    
    const processingTime = Date.now() - startTime
    
    return res.json({
      message: 'Spreadsheet generation queued for background processing',
      set_name: set.name,
      queue_id: job.queue_id,
      status: 'queued',
      processing_time_ms: processingTime,
      note: 'Generation will be completed by background worker - check status endpoint for updates'
    })
    
    // TODO: Move this Excel generation logic to Azure Function
    /* 
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
                 c.print_run, c.notes, s.name, col.name
        ORDER BY c.sort_order
      `)
      
      allCards.push(...cards.map(card => ({
        ...card,
        card_id: Number(card.card_id),
        sort_order: Number(card.sort_order)
      })))
    }
    
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
    
    const headers = ['Series', 'Card #', 'Player(s)', 'Team(s)', 'Print Run', 'Color', 'Rookie', 'Autograph', 'Relic', 'Notes']
    
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
    summarySheet.addRow([])
    
    // Series breakdown
    summarySheet.addRow(['Series Breakdown']).font = { bold: true, size: 12 }
    const seriesHeaderRow = summarySheet.addRow(['Series Name', 'Card Count', 'Rookie Cards', 'Autographs', 'Relics'])
    seriesHeaderRow.font = { bold: true }
    
    // Group cards by series for statistics
    const seriesStats = {}
    allCards.forEach(card => {
      const seriesName = card.series_name
      if (!seriesStats[seriesName]) {
        seriesStats[seriesName] = { total: 0, rookies: 0, autos: 0, relics: 0 }
      }
      seriesStats[seriesName].total++
      if (card.is_rookie) seriesStats[seriesName].rookies++
      if (card.is_autograph) seriesStats[seriesName].autos++
      if (card.is_relic) seriesStats[seriesName].relics++
    })
    
    Object.entries(seriesStats).forEach(([seriesName, stats]) => {
      summarySheet.addRow([seriesName, stats.total, stats.rookies, stats.autos, stats.relics])
    })
    
    autoSizeColumns(summarySheet)
    
    // TAB 3+: Individual Parallel Parent Series
    // Get unique parallel parents (series that have parallels)
    const parallelParentsRaw = await prisma.$queryRawUnsafe(`
      SELECT DISTINCT 
        parent.series_id,
        parent.name as parent_name,
        COUNT(child.series_id) as parallel_count
      FROM series parent
      INNER JOIN series child ON parent.series_id = child.parallel_of_series
      WHERE parent.[set] = ${parseInt(setId)}
      GROUP BY parent.series_id, parent.name
      ORDER BY parent.name
    `)
    
    const parallelParents = parallelParentsRaw.map(p => ({
      series_id: Number(p.series_id),
      parent_name: p.parent_name,
      parallel_count: Number(p.parallel_count)
    }))
    
    // Add standalone series (not parallel parents but also not parallels themselves)
    const standaloneSeriesIds = set.series_series_setToset
      .filter(s => !s.parallel_of_series) // Not a parallel
      .map(s => s.series_id)
      .filter(id => !parallelParents.some(p => Number(p.series_id) === id)) // Not a parallel parent
    
    const standaloneSeries = await prisma.series.findMany({
      where: {
        series_id: { in: standaloneSeriesIds }
      },
      orderBy: { name: 'asc' }
    })
    
    // Helper function to sanitize worksheet names
    const sanitizeSheetName = (name) => {
      return name.replace(/[*?:\\/\[\]]/g, '_').substring(0, 31)
    }
    
    // Track used worksheet names to avoid duplicates
    const usedNames = new Set(['Master List', 'Summary'])
    
    // Create tabs for parallel parents
    for (const parent of parallelParents) {
      const parentId = parent.series_id
      let baseTabName = sanitizeSheetName(parent.parent_name)
      let tabName = baseTabName
      let counter = 1
      
      // Ensure unique worksheet name
      while (usedNames.has(tabName)) {
        tabName = sanitizeSheetName(`${parent.parent_name}_${counter}`)
        counter++
      }
      usedNames.add(tabName)
      
      const seriesSheet = workbook.addWorksheet(tabName)
      
      // Get all parallels for this parent
      const parallelsRaw = await prisma.$queryRawUnsafe(`
        SELECT series_id, name, color, min_print_run, max_print_run, print_run_display
        FROM series 
        WHERE parallel_of_series = ${parentId} OR series_id = ${parentId}
        ORDER BY name
      `)
      
      const parallels = parallelsRaw.map(p => ({
        series_id: Number(p.series_id),
        name: p.name,
        color: p.color,
        min_print_run: p.min_print_run ? Number(p.min_print_run) : null,
        max_print_run: p.max_print_run ? Number(p.max_print_run) : null,
        print_run_display: p.print_run_display
      }))
      
      // Add parallel summary at top
      seriesSheet.addRow([`${parent.parent_name} - Parallel Summary`]).font = { bold: true, size: 12 }
      seriesSheet.addRow([])
      
      const parallelHeaderRow = seriesSheet.addRow(['Parallel/Color', 'Print Run', 'Series ID'])
      parallelHeaderRow.font = { bold: true }
      
      parallels.forEach(parallel => {
        const printRun = parallel.print_run_display || 
          (parallel.min_print_run && parallel.max_print_run ? 
            (parallel.min_print_run === parallel.max_print_run ? 
              `/${parallel.min_print_run}` : 
              `/${parallel.min_print_run}-${parallel.max_print_run}`) : 
            'Standard')
        seriesSheet.addRow([parallel.name, printRun, parallel.series_id])
      })
      
      seriesSheet.addRow([])
      seriesSheet.addRow([])
      
      // Add card checklist for parent series
      addStyledHeaders(seriesSheet, headers)
      
      const parentCards = allCards.filter(card => 
        parallels.some(p => Number(p.series_id) === card.card_id) // This logic needs fixing
      )
      
      // Actually get the correct cards for this parallel family
      const familyCards = allCards.filter(card => {
        const cardSeriesName = card.series_name
        return parallels.some(p => p.name === cardSeriesName)
      })
      
      familyCards.forEach(card => {
        addCardRow(seriesSheet, card)
      })
      
      autoSizeColumns(seriesSheet)
      seriesSheet.views = [{ state: 'frozen', ySplit: parallels.length + 5 }]
    }
    
    // Create tabs for standalone series
    for (const series of standaloneSeries) {
      let baseTabName = sanitizeSheetName(series.name)
      let tabName = baseTabName
      let counter = 1
      
      // Ensure unique worksheet name
      while (usedNames.has(tabName)) {
        tabName = sanitizeSheetName(`${series.name}_${counter}`)
        counter++
      }
      usedNames.add(tabName)
      
      const seriesSheet = workbook.addWorksheet(tabName)
      
      addStyledHeaders(seriesSheet, headers)
      
      const seriesCards = allCards.filter(card => card.series_name === series.name)
      seriesCards.forEach(card => {
        addCardRow(seriesSheet, card)
      })
      
      autoSizeColumns(seriesSheet)
      seriesSheet.views = [{ state: 'frozen', ySplit: 1 }]
    }
    
    // Generate Excel buffer
    const excelBuffer = await workbook.xlsx.writeBuffer()
    const fileSize = excelBuffer.length
    
    let blobUrl = null
    
    // Upload to Azure Blob Storage if configured
    if (containerClient) {
      try {
        const blobName = `${set.name.replace(/[^a-z0-9]/gi, '_')}_collectyourcards.xlsx`
        const blockBlobClient = containerClient.getBlockBlobClient(blobName)
        
        await blockBlobClient.upload(excelBuffer, fileSize, {
          blobHTTPHeaders: {
            blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            blobContentDisposition: `attachment; filename="${set.name.replace(/[^a-z0-9]/gi, '_')}_collectyourcards.xlsx"`
          }
        })
        
        blobUrl = blockBlobClient.url
        console.log(`✅ Uploaded spreadsheet to Azure: ${blobUrl}`)
      } catch (uploadError) {
        console.error('Failed to upload to Azure:', uploadError)
        // Continue without blob storage - return the CSV directly
      }
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
    
    // Log the generation
    await prisma.spreadsheet_generation_log.create({
      data: {
        set_id: parseInt(setId),
        trigger_type: 'manual',
        trigger_details: JSON.stringify({ user_id: req.user.userId }),
        file_size: fileSize,
        generation_time_ms: generationTime,
        success: true,
        blob_url: blobUrl
      }
    })
    */
    
    // This would normally return the generated file info, but for now just return queue info
    // res.json({
    //   message: 'Spreadsheet generated successfully',
    //   set_name: set.name,
    //   card_count: allCards.length,
    //   file_size: fileSize,
    //   generation_time_ms: generationTime,
    //   blob_url: blobUrl,
    //   format: 'xlsx'
    // })
    
  } catch (error) {
    console.error('Error generating spreadsheet:', error)
    
    // Update status to failed
    await prisma.set.update({
      where: { set_id: parseInt(req.params.setId) },
      data: {
        checklist_generation_status: 'failed'
      }
    }).catch(console.error)
    
    // Log the failure
    await prisma.spreadsheet_generation_log.create({
      data: {
        set_id: parseInt(req.params.setId),
        trigger_type: 'manual',
        trigger_details: JSON.stringify({ user_id: req.user.userId }),
        success: false,
        error_message: error.message
      }
    }).catch(console.error)
    
    res.status(500).json({
      error: 'Failed to generate spreadsheet',
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

module.exports = router