const { app } = require('@azure/functions');
const { PrismaClient } = require('@prisma/client');
const { BlobServiceClient } = require('@azure/storage-blob');
const ExcelJS = require('exceljs');

const prisma = new PrismaClient();

// Azure Blob Storage setup
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING;
const CONTAINER_NAME = 'spreadsheets';
let blobServiceClient = null;
let containerClient = null;

if (AZURE_STORAGE_CONNECTION_STRING) {
  blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING);
  containerClient = blobServiceClient.getContainerClient(CONTAINER_NAME);
}

app.timer('spreadsheet-processor', {
  schedule: '0 */1 * * * *', // Every minute
  handler: async (myTimer, context) => {
    const startTime = Date.now();
    context.log('🔍 Checking for pending spreadsheet generation jobs...');
    
    try {
      // Get the next pending job with highest priority
      const pendingJob = await prisma.spreadsheet_generation_queue.findFirst({
        where: { status: 'pending' },
        orderBy: [
          { priority: 'desc' },
          { queued_at: 'asc' }
        ],
        include: {
          set: {
            include: {
              series_series_setToset: {
                orderBy: { name: 'asc' }
              }
            }
          }
        }
      });

      if (!pendingJob) {
        context.log('📝 No pending jobs found');
        return;
      }

      context.log(`🚀 Processing job ${pendingJob.queue_id} for set: ${pendingJob.set.name}`);

      // Mark job as processing
      await prisma.spreadsheet_generation_queue.update({
        where: { queue_id: pendingJob.queue_id },
        data: {
          status: 'processing',
          started_at: new Date()
        }
      });

      // Update set status
      await prisma.set.update({
        where: { set_id: pendingJob.set_id },
        data: { checklist_generation_status: 'generating' }
      });

      // Generate the Excel file
      const result = await generateSpreadsheet(pendingJob.set, context);

      if (result.success) {
        // Mark job as completed
        await prisma.spreadsheet_generation_queue.update({
          where: { queue_id: pendingJob.queue_id },
          data: {
            status: 'completed',
            completed_at: new Date()
          }
        });

        // Update set with generated file info
        await prisma.set.update({
          where: { set_id: pendingJob.set_id },
          data: {
            checklist_blob_url: result.blobUrl,
            checklist_generated_at: new Date(),
            checklist_generation_status: 'current',
            checklist_file_size: result.fileSize,
            checklist_format: 'xlsx'
          }
        });

        // Log the successful generation
        await prisma.spreadsheet_generation_log.create({
          data: {
            set_id: pendingJob.set_id,
            trigger_type: 'background',
            trigger_details: JSON.stringify({ queue_id: pendingJob.queue_id }),
            file_size: result.fileSize,
            generation_time_ms: Date.now() - startTime,
            success: true,
            blob_url: result.blobUrl
          }
        });

        context.log(`✅ Successfully generated spreadsheet for ${pendingJob.set.name}`);
        context.log(`📊 File size: ${result.fileSize} bytes, Cards: ${result.cardCount}`);
        context.log(`🔗 Download: ${result.blobUrl}`);

      } else {
        // Mark job as failed
        await prisma.spreadsheet_generation_queue.update({
          where: { queue_id: pendingJob.queue_id },
          data: {
            status: 'failed',
            error_message: result.error,
            retry_count: { increment: 1 }
          }
        });

        // Update set status
        await prisma.set.update({
          where: { set_id: pendingJob.set_id },
          data: { checklist_generation_status: 'failed' }
        });

        // Log the failure
        await prisma.spreadsheet_generation_log.create({
          data: {
            set_id: pendingJob.set_id,
            trigger_type: 'background',
            trigger_details: JSON.stringify({ queue_id: pendingJob.queue_id }),
            success: false,
            error_message: result.error
          }
        });

        context.log(`❌ Failed to generate spreadsheet for ${pendingJob.set.name}: ${result.error}`);
      }

    } catch (error) {
      context.log(`💥 Error in spreadsheet processor: ${error.message}`, error);
    } finally {
      const processingTime = Date.now() - startTime;
      context.log(`⏱️ Processing completed in ${processingTime}ms`);
    }
  }
});

// Helper function to get parallel information for a series
async function getParallelInfo(seriesId, parallelOfSeries) {
  if (parallelOfSeries) {
    // This series is a parallel, get all parallels of the same parent
    const parallelsRaw = await prisma.$queryRawUnsafe(`
      SELECT series_id, name, color, min_print_run, max_print_run, print_run_display
      FROM series 
      WHERE parallel_of_series = ${parallelOfSeries} OR series_id = ${parallelOfSeries}
      ORDER BY name
    `);
    
    return parallelsRaw.map(p => ({
      series_id: Number(p.series_id),
      name: p.name,
      color: p.color,
      min_print_run: p.min_print_run ? Number(p.min_print_run) : null,
      max_print_run: p.max_print_run ? Number(p.max_print_run) : null,
      print_run_display: p.print_run_display
    }));
  } else {
    // Check if this series has parallels (is a parent)
    const parallelsRaw = await prisma.$queryRawUnsafe(`
      SELECT series_id, name, color, min_print_run, max_print_run, print_run_display
      FROM series 
      WHERE parallel_of_series = ${seriesId} OR series_id = ${seriesId}
      ORDER BY name
    `);
    
    if (parallelsRaw.length > 1) {
      return parallelsRaw.map(p => ({
        series_id: Number(p.series_id),
        name: p.name,
        color: p.color,
        min_print_run: p.min_print_run ? Number(p.min_print_run) : null,
        max_print_run: p.max_print_run ? Number(p.max_print_run) : null,
        print_run_display: p.print_run_display
      }));
    }
  }
  
  // No parallels found, return just this series
  return [{
    series_id: seriesId,
    name: 'Base Series',
    color: null,
    min_print_run: null,
    max_print_run: null,
    print_run_display: null
  }];
}

// Excel generation function (moved from Express server)
async function generateSpreadsheet(set, context) {
  try {
    context.log(`📋 Starting Excel generation for ${set.name} (${set.series_series_setToset.length} series)`);
    
    // Fetch all cards for all series in the set, properly sorted
    const allCards = [];
    
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
      `);
      
      allCards.push(...cards.map(card => ({
        ...card,
        card_id: Number(card.card_id),
        sort_order: Number(card.sort_order)
      })));
    }

    context.log(`📊 Processing ${allCards.length} cards across ${set.series_series_setToset.length} series`);

    // Create Excel workbook with multi-tab structure
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'CollectYourCards.com';
    workbook.lastModifiedBy = 'CollectYourCards.com';
    workbook.created = new Date();
    workbook.modified = new Date();
    
    // Helper functions
    const addStyledHeaders = (worksheet, headers) => {
      const headerRow = worksheet.addRow(headers);
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      return headerRow;
    };
    
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
      ]);
      
      // Conditional formatting
      if (card.is_rookie) {
        row.getCell(7).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE699' } };
      }
      if (card.is_autograph) {
        row.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD5E8D4' } };
      }
      if (card.is_relic) {
        row.getCell(9).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFCE5CD' } };
      }
      
      return row;
    };
    
    const autoSizeColumns = (worksheet) => {
      worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: false }, cell => {
          const columnLength = cell.value ? cell.value.toString().length : 0;
          if (columnLength > maxLength) {
            maxLength = columnLength;
          }
        });
        column.width = Math.min(maxLength + 2, 50);
      });
    };

    const sanitizeSheetName = (name) => {
      return name.replace(/[*?:\\/\\[\\]]/g, '_').substring(0, 31);
    };
    
    const headers = ['Series', 'Card #', 'Player(s)', 'Team(s)', 'Print Run', 'Color', 'Rookie', 'Autograph', 'Relic', 'Notes'];
    
    // TAB 1: Master List (Complete checklist)
    context.log('📋 Creating Master List tab...');
    const masterSheet = workbook.addWorksheet('Master List');
    addStyledHeaders(masterSheet, headers);
    
    allCards.forEach(card => {
      addCardRow(masterSheet, card);
    });
    
    autoSizeColumns(masterSheet);
    masterSheet.views = [{ state: 'frozen', ySplit: 1 }];
    
    // TAB 2: Summary Sheet
    context.log('📊 Creating Summary tab...');
    const summarySheet = workbook.addWorksheet('Summary');
    
    // Set overview
    summarySheet.addRow(['Set Overview']).font = { bold: true, size: 14 };
    summarySheet.addRow([]);
    summarySheet.addRow(['Set Name:', set.name]);
    summarySheet.addRow(['Year:', set.year || 'N/A']);
    summarySheet.addRow(['Total Cards:', allCards.length]);
    summarySheet.addRow(['Total Series:', set.series_series_setToset.length]);
    summarySheet.addRow(['Generated:', new Date().toLocaleString()]);
    summarySheet.addRow([]);
    
    // Series breakdown
    summarySheet.addRow(['Series Breakdown']).font = { bold: true, size: 12 };
    const seriesHeaderRow = summarySheet.addRow(['Series Name', 'Card Count', 'Rookie Cards', 'Autographs', 'Relics']);
    seriesHeaderRow.font = { bold: true };
    
    // Group cards by series for statistics
    const seriesStats = {};
    allCards.forEach(card => {
      const seriesName = card.series_name;
      if (!seriesStats[seriesName]) {
        seriesStats[seriesName] = { total: 0, rookies: 0, autos: 0, relics: 0 };
      }
      seriesStats[seriesName].total++;
      if (card.is_rookie) seriesStats[seriesName].rookies++;
      if (card.is_autograph) seriesStats[seriesName].autos++;
      if (card.is_relic) seriesStats[seriesName].relics++;
    });
    
    Object.entries(seriesStats).forEach(([seriesName, stats]) => {
      summarySheet.addRow([seriesName, stats.total, stats.rookies, stats.autos, stats.relics]);
    });
    
    autoSizeColumns(summarySheet);
    
    // TAB 3+: Individual Series Tabs with Parallel Information
    context.log('📑 Creating individual series tabs with parallel info...');
    const usedNames = new Set(['Master List', 'Summary']);
    
    for (const series of set.series_series_setToset) {
      let baseTabName = sanitizeSheetName(series.name);
      let tabName = baseTabName;
      let counter = 1;
      
      // Ensure unique worksheet name
      while (usedNames.has(tabName)) {
        tabName = sanitizeSheetName(`${series.name}_${counter}`);
        counter++;
      }
      usedNames.add(tabName);
      
      const seriesSheet = workbook.addWorksheet(tabName);
      
      // Get parallel information for this series (if it has parallels or is a parallel)
      const parallelInfo = await getParallelInfo(series.series_id, series.parallel_of_series);
      
      if (parallelInfo.length > 1) {
        // Add parallel summary at top
        const titleRow = seriesSheet.addRow([`${series.name} - Available Parallels`]);
        titleRow.font = { bold: true, size: 12 };
        seriesSheet.addRow([]);
        
        const parallelHeaderRow = seriesSheet.addRow(['Parallel/Color', 'Print Run', 'Series']);
        parallelHeaderRow.font = { bold: true };
        parallelHeaderRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0F0F0' }
        };
        
        parallelInfo.forEach(parallel => {
          const printRun = parallel.print_run_display || 
            (parallel.min_print_run && parallel.max_print_run ? 
              (parallel.min_print_run === parallel.max_print_run ? 
                `/${parallel.min_print_run}` : 
                `/${parallel.min_print_run}-${parallel.max_print_run}`) : 
              'Standard');
          
          seriesSheet.addRow([
            parallel.name,
            printRun,
            parallel.color || 'Base'
          ]);
        });
        
        seriesSheet.addRow([]);
        seriesSheet.addRow([]);
      }
      
      // Add card checklist headers
      const headerRowNum = seriesSheet.rowCount + 1;
      addStyledHeaders(seriesSheet, headers);
      
      // Add cards for this series
      const seriesCards = allCards.filter(card => card.series_name === series.name);
      seriesCards.forEach(card => {
        addCardRow(seriesSheet, card);
      });
      
      autoSizeColumns(seriesSheet);
      
      // Freeze header row (accounting for parallel summary)
      const freezeRow = parallelInfo.length > 1 ? parallelInfo.length + 5 : 1;
      seriesSheet.views = [{ state: 'frozen', ySplit: freezeRow }];
    }
    
    // Generate Excel buffer
    context.log('💾 Generating Excel buffer...');
    const excelBuffer = await workbook.xlsx.writeBuffer();
    const fileSize = excelBuffer.length;

    let blobUrl = null;
    
    // Upload to Azure Blob Storage
    if (containerClient) {
      try {
        const blobName = `${set.name.replace(/[^a-z0-9]/gi, '_')}_collectyourcards.xlsx`;
        const blockBlobClient = containerClient.getBlockBlobClient(blobName);
        
        await blockBlobClient.upload(excelBuffer, fileSize, {
          blobHTTPHeaders: {
            blobContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            blobContentDisposition: `attachment; filename="${set.name.replace(/[^a-z0-9]/gi, '_')}_collectyourcards.xlsx"`
          }
        });
        
        blobUrl = blockBlobClient.url;
        context.log(`🔗 Uploaded to Azure Blob: ${blobUrl}`);
      } catch (uploadError) {
        context.log(`❌ Failed to upload to Azure Blob: ${uploadError.message}`);
        throw new Error(`Blob upload failed: ${uploadError.message}`);
      }
    } else {
      throw new Error('Azure Blob Storage not configured');
    }

    return {
      success: true,
      blobUrl,
      fileSize,
      cardCount: allCards.length
    };

  } catch (error) {
    context.log(`❌ Excel generation failed: ${error.message}`, error);
    return {
      success: false,
      error: error.message
    };
  }
}