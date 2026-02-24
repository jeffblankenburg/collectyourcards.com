const express = require('express')
const multer = require('multer')
const { prisma } = require('../config/prisma-singleton')
const { authMiddleware, requireAdmin, requireSuperAdmin } = require('../middleware/auth')
const { triggerAutoRegeneration } = require('./spreadsheet-generation')
const { optimizeImage, uploadOptimizedImage } = require('../utils/image-optimizer')
const router = express.Router()

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit per file
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error('Only JPEG, PNG, and WebP image files are allowed'))
    }
  }
})

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// Helper function to generate URL slug from series name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and') // Convert ampersands to "and" to preserve semantic meaning
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// GET /api/admin/series - Get list of series with search and filter
router.get('/series', async (req, res) => {
  try {
    const { search, set, series_id, limit } = req.query
    
    let whereClause = {}
    let orderBy = [{ name: 'asc' }]
    let takeLimit = null
    
    // Default behavior: if no search and no set filter, show 100 most recent series
    const isDefaultLoad = !search && !set && !series_id
    if (isDefaultLoad) {
      takeLimit = 100
      orderBy = [{ created: 'desc' }] // Most recently created first
    } else if (search) {
      // For search: no limit, show all matching results
      takeLimit = null
    } else {
      // For set filtering: respect limit parameter or show all
      takeLimit = limit ? Math.min(parseInt(limit), 10000) : null
    }
    
    // Filter by specific series ID if provided
    if (series_id && series_id.trim()) {
      const seriesIdInt = parseInt(series_id)
      if (seriesIdInt) {
        whereClause.series_id = BigInt(seriesIdInt)
      }
    }
    // Filter by set if provided
    else if (set && set.trim()) {
      const setId = parseInt(set)
      if (setId) {
        whereClause.set = setId
      }
    }
    
    // Add search if provided
    if (search && search.trim()) {
      if (whereClause.set) {
        // If filtering by set, search within that set
        whereClause.AND = [
          { set: whereClause.set },
          { name: { contains: search.trim() } }
        ]
        delete whereClause.set
      } else {
        // Global search
        whereClause.name = { contains: search.trim() }
      }
    }

    const queryOptions = {
      where: whereClause,
      orderBy,
      include: {
        set_series_setToset: {
          select: {
            set_id: true,
            name: true,
            year: true
          }
        },
        color_series_colorTocolor: {
          select: {
            color_id: true,
            name: true,
            hex_value: true
          }
        }
      }
    }

    // Add take limit based on our logic
    if (takeLimit) {
      queryOptions.take = takeLimit
    }

    const series = await prisma.series.findMany(queryOptions)


    // Get parallel series names if needed
    const seriesWithParallels = await Promise.all(
      series.map(async (s) => {
        let parallelOfName = null
        if (s.parallel_of_series) {
          const parallelSeries = await prisma.series.findUnique({
            where: { series_id: s.parallel_of_series },
            select: { name: true }
          })
          parallelOfName = parallelSeries?.name || null
        }
        
        return {
          series_id: Number(s.series_id),
          name: s.name,
          set_id: s.set ? Number(s.set) : null,
          set_name: s.set_series_setToset?.name || null,
          set_year: s.set_series_setToset?.year || null,
          card_count: s.card_count || 0,
          card_entered_count: s.card_entered_count || 0,
          rookie_count: s.rookie_count || 0,
          is_base: s.is_base || false,
          parallel_of_series: s.parallel_of_series ? Number(s.parallel_of_series) : null,
          parallel_of_name: parallelOfName,
          color_id: s.color ? Number(s.color) : null,
          color_name: s.color_series_colorTocolor?.name || null,
          color_hex: s.color_series_colorTocolor?.hex_value || null,
          min_print_run: s.min_print_run,
          max_print_run: s.max_print_run,
          print_run_display: s.print_run_display,
          production_code: s.production_code,
          front_image_path: s.front_image_path,
          back_image_path: s.back_image_path,
          created: s.created
        }
      })
    )

    // Get set info if filtering by set
    let setInfo = null
    if (set) {
      const setData = await prisma.set.findUnique({
        where: { set_id: parseInt(set) },
        select: {
          set_id: true,
          name: true,
          year: true
        }
      })
      if (setData) {
        setInfo = {
          set_id: Number(setData.set_id),
          name: setData.name,
          year: setData.year
        }
      }
    }

    res.json({
      series: seriesWithParallels,
      setInfo: setInfo,
      total: seriesWithParallels.length
    })

  } catch (error) {
    console.error('Error fetching series:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch series',
      details: error.message
    })
  }
})

// PUT /api/admin/series/:id - Update series
router.put('/series/:id', async (req, res) => {
  try {
    const { id } = req.params
    const {
      name,
      set,
      set_id,
      card_count,
      card_entered_count,
      is_base,
      parallel_of_series,
      color_id,
      min_print_run,
      max_print_run,
      print_run_display,
      production_code,
      rookie_count,
      front_image_path,
      back_image_path
    } = req.body

    // Validate series ID
    const seriesId = parseInt(id)
    if (!seriesId || isNaN(seriesId)) {
      return res.status(400).json({
        error: 'Invalid series ID',
        message: 'Series ID must be a valid number'
      })
    }

    // Check if series exists
    const existingSeries = await prisma.series.findUnique({
      where: { series_id: BigInt(seriesId) },
      select: {
        series_id: true,
        name: true,
        set: true,
        card_count: true,
        card_entered_count: true,
        is_base: true,
        parallel_of_series: true,
        color: true,
        min_print_run: true,
        max_print_run: true,
        print_run_display: true,
        production_code: true,
        rookie_count: true,
        front_image_path: true,
        back_image_path: true
      }
    })

    if (!existingSeries) {
      return res.status(404).json({
        error: 'Series not found',
        message: `Series with ID ${seriesId} does not exist`
      })
    }

    // Prepare update data
    const updateData = {
      name: name?.trim() || null,
      card_count: card_count !== undefined ? parseInt(card_count) : existingSeries.card_count,
      card_entered_count: card_entered_count !== undefined ? parseInt(card_entered_count) : existingSeries.card_entered_count,
      is_base: is_base !== undefined ? is_base : existingSeries.is_base,
      parallel_of_series: parallel_of_series ? BigInt(parallel_of_series) : null,
      min_print_run: min_print_run !== undefined ? (min_print_run ? parseInt(min_print_run) : null) : existingSeries.min_print_run,
      max_print_run: max_print_run !== undefined ? (max_print_run ? parseInt(max_print_run) : null) : existingSeries.max_print_run,
      print_run_display: print_run_display?.trim() || null,
      production_code: production_code !== undefined ? (production_code?.trim() || null) : existingSeries.production_code,
      rookie_count: rookie_count !== undefined ? parseInt(rookie_count) : existingSeries.rookie_count,
      front_image_path: front_image_path !== undefined ? (front_image_path || null) : existingSeries.front_image_path,
      back_image_path: back_image_path !== undefined ? (back_image_path || null) : existingSeries.back_image_path
    }
    
    // Handle set field (direct foreign key) - accept either 'set' or 'set_id' from frontend
    const setValue = set_id !== undefined ? set_id : set
    if (setValue !== undefined) {
      updateData.set = setValue ? parseInt(setValue) : null
    }
    
    // Handle color field (direct foreign key)
    if (color_id !== undefined) {
      updateData.color = color_id ? parseInt(color_id) : null
    }

    // Store old values for logging
    const oldValues = JSON.stringify({
      name: existingSeries.name,
      set: existingSeries.set,
      card_count: existingSeries.card_count,
      card_entered_count: existingSeries.card_entered_count,
      is_base: existingSeries.is_base,
      parallel_of_series: existingSeries.parallel_of_series ? Number(existingSeries.parallel_of_series) : null,
      min_print_run: existingSeries.min_print_run,
      max_print_run: existingSeries.max_print_run,
      print_run_display: existingSeries.print_run_display,
      production_code: existingSeries.production_code,
      rookie_count: existingSeries.rookie_count,
      front_image_path: existingSeries.front_image_path,
      back_image_path: existingSeries.back_image_path
    })

    // Update series
    const updatedSeries = await prisma.series.update({
      where: { series_id: BigInt(seriesId) },
      data: updateData,
      select: {
        series_id: true,
        name: true,
        set: true,
        card_count: true,
        card_entered_count: true,
        is_base: true,
        parallel_of_series: true,
        color: true,
        color_color_colorToseries: {
          select: {
            color_id: true,
            color: true,
            hex_value: true
          }
        },
        min_print_run: true,
        max_print_run: true,
        print_run_display: true,
        production_code: true,
        rookie_count: true,
        front_image_path: true,
        back_image_path: true
      }
    })

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'SERIES_UPDATED',
          entity_type: 'series',
          entity_id: seriesId.toString(),
          old_values: oldValues,
          new_values: JSON.stringify(updateData),
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
    }

    // Trigger auto-regeneration for the set
    const setIdForRegen = updatedSeries.set || existingSeries.set
    if (setIdForRegen) {
      triggerAutoRegeneration(setIdForRegen, 'series', { action: 'update', series_id: seriesId })
    }

    res.json({
      message: 'Series updated successfully',
      series: {
        ...updatedSeries,
        series_id: Number(updatedSeries.series_id),
        parallel_of_series: updatedSeries.parallel_of_series ? Number(updatedSeries.parallel_of_series) : null,
        color_rel: updatedSeries.color_color_colorToseries ? {
          color_id: updatedSeries.color_color_colorToseries.color_id,
          color: updatedSeries.color_color_colorToseries.color,
          hex_value: updatedSeries.color_color_colorToseries.hex_value
        } : null
      }
    })

  } catch (error) {
    console.error('Error updating series:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update series',
      details: error.message
    })
  }
})

// POST /api/admin/series/upload-images/:id - Upload series representative images
router.post('/series/upload-images/:id', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params
    const { type } = req.body // 'front' or 'back'
    const seriesId = parseInt(id)

    if (!seriesId || isNaN(seriesId)) {
      return res.status(400).json({
        error: 'Invalid series ID',
        message: 'Series ID must be a valid number'
      })
    }

    if (!type || !['front', 'back'].includes(type)) {
      return res.status(400).json({
        error: 'Invalid image type',
        message: 'Type must be "front" or "back"'
      })
    }

    if (!req.file) {
      return res.status(400).json({
        error: 'No image provided',
        message: 'Please upload an image file'
      })
    }

    // Check if series exists
    const series = await prisma.series.findUnique({
      where: { series_id: BigInt(seriesId) },
      select: {
        series_id: true,
        front_image_path: true,
        back_image_path: true
      }
    })

    if (!series) {
      return res.status(404).json({
        error: 'Series not found',
        message: `Series with ID ${seriesId} does not exist`
      })
    }

    // Optimize and upload the image
    const imageBuffer = req.file.buffer
    const optimizedBuffer = await optimizeImage(imageBuffer)
    const blobName = `series/${seriesId}_${type}.jpg`
    const imageUrl = await uploadOptimizedImage(optimizedBuffer, blobName)

    // Update series with new image path
    const updateData = type === 'front'
      ? { front_image_path: imageUrl }
      : { back_image_path: imageUrl }

    await prisma.series.update({
      where: { series_id: BigInt(seriesId) },
      data: updateData
    })

    console.log(`✓ Series ${seriesId} ${type} image uploaded: ${imageUrl}`)

    res.json({
      message: `${type === 'front' ? 'Front' : 'Back'} image uploaded successfully`,
      [`${type}_image_path`]: imageUrl
    })

  } catch (error) {
    console.error('Error uploading series image:', error)
    res.status(500).json({
      error: 'Upload failed',
      message: error.message
    })
  }
})

// GET /api/admin/series/colors - Get available colors for dropdown
router.get('/series/colors', async (req, res) => {
  try {
    const colors = await prisma.color.findMany({
      select: {
        color_id: true,
        name: true,
        hex_value: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    res.json({
      colors,
      total: colors.length
    })

  } catch (error) {
    console.error('Error fetching colors:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch colors',
      details: error.message
    })
  }
})

// POST /api/admin/series/:id/duplicate - Create a parallel series by duplicating all cards
router.post('/series/:id/duplicate', async (req, res) => {
  try {
    console.log('[Duplicate Series] Starting duplication for series:', req.params.id)
    console.log('[Duplicate Series] Request body:', req.body)
    console.log('[Duplicate Series] User:', req.user)

    const seriesId = BigInt(req.params.id)
    const { name, color_id, print_run, card_range } = req.body

    if (!name || !name.trim()) {
      console.log('[Duplicate Series] Validation failed: name is required')
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Series name is required'
      })
    }

    // Parse card range if provided (format: "1-100" or "1-50,75-100")
    let cardNumberFilter = null
    if (card_range && card_range.trim()) {
      try {
        const ranges = card_range.split(',').map(r => r.trim())
        const sortOrders = []

        for (const range of ranges) {
          if (range.includes('-')) {
            const [start, end] = range.split('-').map(n => parseInt(n.trim()))
            if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
              throw new Error(`Invalid range: ${range}`)
            }
            for (let i = start; i <= end; i++) {
              sortOrders.push(i)
            }
          } else {
            const num = parseInt(range.trim())
            if (isNaN(num) || num < 1) {
              throw new Error(`Invalid card number: ${range}`)
            }
            sortOrders.push(num)
          }
        }

        cardNumberFilter = sortOrders
        console.log('[Duplicate Series] Card range filter:', card_range, '→', sortOrders.length, 'cards')
      } catch (rangeError) {
        console.log('[Duplicate Series] Invalid card range:', rangeError.message)
        return res.status(400).json({
          error: 'Invalid input',
          message: `Invalid card range format: ${rangeError.message}. Use format like "1-100" or "1-50,75-100"`
        })
      }
    }

    // Get the original series
    console.log('[Duplicate Series] Fetching original series...')
    const originalSeries = await prisma.series.findUnique({
      where: { series_id: seriesId },
      include: {
        set_series_setToset: true // Get set information
      }
    })

    if (!originalSeries) {
      console.log('[Duplicate Series] Series not found:', req.params.id)
      return res.status(404).json({
        error: 'Not found',
        message: 'Series not found'
      })
    }

    console.log('[Duplicate Series] Found original series:', originalSeries.name)

    // Create the new parallel series
    console.log('[Duplicate Series] Creating new series...')
    const trimmedName = name.trim()
    const newSeries = await prisma.series.create({
      data: {
        name: trimmedName,
        slug: generateSlug(trimmedName),
        set: originalSeries.set,
        card_count: originalSeries.card_count,
        card_entered_count: originalSeries.card_entered_count,
        is_base: false, // Parallels are never base
        parallel_of_series: seriesId,
        color: color_id ? parseInt(color_id) : null,
        min_print_run: print_run ? parseInt(print_run) : null,
        max_print_run: print_run ? parseInt(print_run) : null,
        print_run_display: print_run ? print_run.toString() : null,
        rookie_count: originalSeries.rookie_count,
        front_image_path: originalSeries.front_image_path,
        back_image_path: originalSeries.back_image_path,
        created: new Date()
      }
    })
    console.log('[Duplicate Series] New series created with ID:', newSeries.series_id.toString())

    // Get cards from original series (filtered by card range if specified)
    console.log('[Duplicate Series] Fetching original cards...')
    const whereClause = { series: seriesId }

    // Apply card range filter if specified
    if (cardNumberFilter) {
      whereClause.sort_order = { in: cardNumberFilter }
    }

    const originalCards = await prisma.card.findMany({
      where: whereClause,
      include: {
        card_player_team_card_player_team_cardTocard: {
          include: {
            player_team_card_player_team_player_teamToplayer_team: true
          }
        }
      },
      orderBy: { sort_order: 'asc' }
    })
    console.log('[Duplicate Series] Found', originalCards.length, 'cards to duplicate', cardNumberFilter ? `(filtered to ${cardNumberFilter.length} specified cards)` : '(all cards)')

    // Duplicate all cards for the new series
    let cardsCreated = 0
    for (const card of originalCards) {
      const newCard = await prisma.card.create({
        data: {
          sort_order: card.sort_order,
          card_number: card.card_number,
          is_rookie: card.is_rookie,
          is_autograph: card.is_autograph,
          is_relic: card.is_relic,
          print_run: print_run ? parseInt(print_run) : null,
          series: newSeries.series_id,
          color: color_id ? parseInt(color_id) : null,
          notes: card.notes,
          created: new Date()
        }
      })

      // Duplicate player_team associations
      if (card.card_player_team_card_player_team_cardTocard && card.card_player_team_card_player_team_cardTocard.length > 0) {
        for (const cpt of card.card_player_team_card_player_team_cardTocard) {
          await prisma.card_player_team.create({
            data: {
              card: newCard.card_id,
              player_team: cpt.player_team
            }
          })
        }
      }
      
      cardsCreated++
    }

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'SERIES_DUPLICATED',
          entity_type: 'series',
          entity_id: newSeries.series_id.toString(),
          old_values: JSON.stringify({ original_series_id: Number(seriesId) }),
          new_values: JSON.stringify({
            name,
            color_id,
            print_run,
            card_range: card_range || 'all',
            cards_created: cardsCreated
          }),
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
    }

    // Trigger auto-regeneration for the set
    if (originalSeries.set) {
      triggerAutoRegeneration(originalSeries.set, 'series', { action: 'duplicate', series_id: Number(newSeries.series_id), cards_created: cardsCreated })
    }

    res.json({
      success: true,
      message: `Successfully created parallel series "${name}" with ${cardsCreated} cards`,
      series_id: Number(newSeries.series_id),
      cards_created: cardsCreated
    })

  } catch (error) {
    console.error('[Duplicate Series] Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta,
      stack: error.stack
    })
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to duplicate series',
      details: error.message,
      code: error.code
    })
  }
})

// DELETE /api/admin/series/:id - Delete a series and all its cards
// DANGEROUS OPERATION - Requires superadmin
router.delete('/series/:id', requireSuperAdmin, async (req, res) => {
  try {
    const seriesId = BigInt(req.params.id)
    
    // Get the series first to confirm it exists and get info for logging
    const series = await prisma.series.findUnique({
      where: { series_id: seriesId },
      include: {
        set_series_setToset: true
      }
    })

    if (!series) {
      return res.status(404).json({ 
        error: 'Not found', 
        message: 'Series not found' 
      })
    }

    // Count cards to be deleted
    const cardCount = await prisma.card.count({
      where: { series: seriesId }
    })

    // Start transaction to delete everything
    await prisma.$transaction(async (tx) => {
      // Get all card IDs first
      const cardIds = await tx.card.findMany({
        where: { series: seriesId },
        select: { card_id: true }
      })
      const cardIdArray = cardIds.map(c => c.card_id)

      if (cardIdArray.length > 0) {
        // Delete card_player_team records first (foreign key constraint)
        await tx.card_player_team.deleteMany({
          where: {
            card: { in: cardIdArray }
          }
        })
      }

      // Delete all cards in the series
      await tx.card.deleteMany({
        where: { series: seriesId }
      })

      // Clear series references in series_submissions (don't delete the submissions, just unlink)
      await tx.series_submissions.updateMany({
        where: { created_series_id: seriesId },
        data: { created_series_id: null }
      })
      await tx.series_submissions.updateMany({
        where: { existing_series_id: seriesId },
        data: { existing_series_id: null }
      })

      // Delete card_submissions that reference this series
      await tx.card_submissions.deleteMany({
        where: { series_id: seriesId }
      })

      // Delete user_series_completion records
      await tx.user_series_completion.deleteMany({
        where: { series_id: seriesId }
      })

      // Clear series references in sales (don't delete sales, just unlink)
      await tx.sale.updateMany({
        where: { series_id: seriesId },
        data: { series_id: null }
      })

      // Finally delete the series itself
      await tx.series.delete({
        where: { series_id: seriesId }
      })
    })

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'SERIES_DELETED',
          entity_type: 'series',
          entity_id: seriesId.toString(),
          old_values: JSON.stringify({ 
            name: series.name, 
            set_name: series.set_series_setToset?.name,
            cards_deleted: cardCount 
          }),
          new_values: null,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
    }

    // Trigger auto-regeneration for the set
    if (series.set) {
      triggerAutoRegeneration(series.set, 'series', { action: 'delete', series_name: series.name, cards_deleted: cardCount })
    }

    res.json({
      success: true,
      message: `Successfully deleted series "${series.name}" and ${cardCount} cards`
    })

  } catch (error) {
    console.error('Error deleting series:', error)
    res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to delete series'
    })
  }
})

// POST /api/admin/series/copy-cards - Copy cards from one series to existing target series
// This is for partial set releases (e.g., Heritage High Number)
router.post('/series/copy-cards', async (req, res) => {
  try {
    console.log('[Copy Cards] Starting card copy operation')
    console.log('[Copy Cards] Request body:', JSON.stringify(req.body, null, 2))
    console.log('[Copy Cards] source_series_id type:', typeof req.body.source_series_id)
    console.log('[Copy Cards] target_series_ids:', req.body.target_series_ids, 'isArray:', Array.isArray(req.body.target_series_ids))

    const { source_series_id, target_series_ids, card_range, copy_options } = req.body

    // Validate inputs
    if (!source_series_id) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Source series ID is required'
      })
    }

    if (!target_series_ids || !Array.isArray(target_series_ids) || target_series_ids.length === 0) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'At least one target series ID is required'
      })
    }

    // Parse card range if provided (format: "501-725" or "1-50,75-100")
    let sortOrderFilter = null
    if (card_range && card_range.trim()) {
      try {
        const ranges = card_range.split(',').map(r => r.trim())
        const sortOrders = []

        for (const range of ranges) {
          if (range.includes('-')) {
            const [start, end] = range.split('-').map(n => parseInt(n.trim()))
            if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
              throw new Error(`Invalid range: ${range}`)
            }
            for (let i = start; i <= end; i++) {
              sortOrders.push(i)
            }
          } else {
            const num = parseInt(range.trim())
            if (isNaN(num) || num < 1) {
              throw new Error(`Invalid card number: ${range}`)
            }
            sortOrders.push(num)
          }
        }

        sortOrderFilter = sortOrders
        console.log('[Copy Cards] Card range filter:', card_range, '→', sortOrders.length, 'cards')
      } catch (rangeError) {
        console.log('[Copy Cards] Invalid card range:', rangeError.message)
        return res.status(400).json({
          error: 'Invalid input',
          message: `Invalid card range format: ${rangeError.message}. Use format like "501-725" or "1-50,75-100"`
        })
      }
    }

    // Verify source series exists
    const sourceSeries = await prisma.series.findUnique({
      where: { series_id: BigInt(source_series_id) },
      include: {
        set_series_setToset: {
          select: { set_id: true, name: true }
        }
      }
    })

    if (!sourceSeries) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Source series not found'
      })
    }

    // Get source cards with player associations
    const whereClause = { series: BigInt(source_series_id) }
    if (sortOrderFilter) {
      whereClause.sort_order = { in: sortOrderFilter }
    }

    const sourceCards = await prisma.card.findMany({
      where: whereClause,
      include: {
        card_player_team_card_player_team_cardTocard: {
          select: { player_team: true }
        }
      },
      orderBy: { sort_order: 'asc' }
    })

    console.log('[Copy Cards] Found', sourceCards.length, 'source cards to copy')

    if (sourceCards.length === 0) {
      return res.status(400).json({
        error: 'No cards found',
        message: 'No cards found in source series matching the specified range'
      })
    }

    // Process each target series
    const results = []
    let totalCardsCreated = 0
    let totalSkipped = 0

    for (const targetSeriesId of target_series_ids) {
      const targetBigInt = BigInt(targetSeriesId)

      // Verify target series exists
      const targetSeries = await prisma.series.findUnique({
        where: { series_id: targetBigInt },
        select: {
          series_id: true,
          name: true,
          color: true,
          min_print_run: true,
          set: true
        }
      })

      if (!targetSeries) {
        results.push({
          series_id: Number(targetSeriesId),
          series_name: 'Unknown',
          status: 'error',
          message: 'Target series not found',
          cards_created: 0,
          cards_skipped: 0
        })
        continue
      }

      // Get existing card sort_orders in target series to avoid duplicates
      const existingCards = await prisma.card.findMany({
        where: { series: targetBigInt },
        select: { sort_order: true }
      })
      const existingSortOrders = new Set(existingCards.map(c => c.sort_order))

      let cardsCreated = 0
      let cardsSkipped = 0

      // Copy cards that don't already exist
      for (const sourceCard of sourceCards) {
        if (existingSortOrders.has(sourceCard.sort_order)) {
          cardsSkipped++
          continue
        }

        // Create the new card - use target series' color and print_run
        // Note: card_number_indexed is a computed column, so we don't include it
        const newCard = await prisma.card.create({
          data: {
            sort_order: sourceCard.sort_order,
            card_number: sourceCard.card_number,
            is_rookie: sourceCard.is_rookie,
            is_autograph: sourceCard.is_autograph,
            is_relic: sourceCard.is_relic,
            print_run: targetSeries.min_print_run || null, // Use target series' print run
            series: targetBigInt,
            color: targetSeries.color, // Use target series' color
            notes: sourceCard.notes,
            is_short_print: sourceCard.is_short_print,
            created: new Date()
          }
        })

        // Copy player_team associations
        if (sourceCard.card_player_team_card_player_team_cardTocard &&
            sourceCard.card_player_team_card_player_team_cardTocard.length > 0) {
          for (const cpt of sourceCard.card_player_team_card_player_team_cardTocard) {
            await prisma.card_player_team.create({
              data: {
                card: newCard.card_id,
                player_team: cpt.player_team
              }
            })
          }
        }

        cardsCreated++
      }

      // Update target series card_entered_count
      const newCardCount = await prisma.card.count({
        where: { series: targetBigInt }
      })
      await prisma.series.update({
        where: { series_id: targetBigInt },
        data: { card_entered_count: newCardCount }
      })

      results.push({
        series_id: Number(targetSeriesId),
        series_name: targetSeries.name,
        status: 'success',
        cards_created: cardsCreated,
        cards_skipped: cardsSkipped
      })

      totalCardsCreated += cardsCreated
      totalSkipped += cardsSkipped

      // Trigger auto-regeneration for the set
      if (targetSeries.set) {
        triggerAutoRegeneration(targetSeries.set, 'cards', {
          action: 'copy',
          source_series_id: Number(source_series_id),
          target_series_id: Number(targetSeriesId),
          cards_created: cardsCreated
        })
      }
    }

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'CARDS_COPIED',
          entity_type: 'series',
          entity_id: source_series_id.toString(),
          old_values: null,
          new_values: JSON.stringify({
            source_series_id: Number(source_series_id),
            source_series_name: sourceSeries.name,
            card_range: card_range || 'all',
            source_cards_count: sourceCards.length,
            target_count: target_series_ids.length,
            total_created: totalCardsCreated,
            total_skipped: totalSkipped,
            results
          }),
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('[Copy Cards] Failed to log admin action:', logError.message)
    }

    res.json({
      success: true,
      message: `Copied cards to ${results.filter(r => r.status === 'success').length} series`,
      summary: {
        source_series: sourceSeries.name,
        source_cards_count: sourceCards.length,
        total_cards_created: totalCardsCreated,
        total_cards_skipped: totalSkipped,
        target_series_count: target_series_ids.length
      },
      results
    })

  } catch (error) {
    console.error('[Copy Cards] Error:', error.message)
    console.error('[Copy Cards] Stack:', error.stack)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to copy cards',
      details: error.message,
      stack: process.env.NODE_ENV !== 'production' ? error.stack : undefined
    })
  }
})

// GET /api/admin/series/preview-copy - Preview which cards would be copied
router.get('/series/preview-copy', async (req, res) => {
  try {
    const { source_series_id, card_range } = req.query

    if (!source_series_id) {
      return res.status(400).json({
        error: 'Invalid input',
        message: 'Source series ID is required'
      })
    }

    // Parse card range if provided
    let sortOrderFilter = null
    if (card_range && card_range.trim()) {
      try {
        const ranges = card_range.split(',').map(r => r.trim())
        const sortOrders = []

        for (const range of ranges) {
          if (range.includes('-')) {
            const [start, end] = range.split('-').map(n => parseInt(n.trim()))
            if (isNaN(start) || isNaN(end) || start < 1 || end < start) {
              throw new Error(`Invalid range: ${range}`)
            }
            for (let i = start; i <= end; i++) {
              sortOrders.push(i)
            }
          } else {
            const num = parseInt(range.trim())
            if (isNaN(num) || num < 1) {
              throw new Error(`Invalid card number: ${range}`)
            }
            sortOrders.push(num)
          }
        }

        sortOrderFilter = sortOrders
      } catch (rangeError) {
        return res.status(400).json({
          error: 'Invalid input',
          message: `Invalid card range format: ${rangeError.message}`
        })
      }
    }

    // Get series info
    const series = await prisma.series.findUnique({
      where: { series_id: BigInt(source_series_id) },
      include: {
        set_series_setToset: {
          select: { set_id: true, name: true, year: true }
        }
      }
    })

    if (!series) {
      return res.status(404).json({
        error: 'Not found',
        message: 'Source series not found'
      })
    }

    // Get cards preview
    const whereClause = { series: BigInt(source_series_id) }
    if (sortOrderFilter) {
      whereClause.sort_order = { in: sortOrderFilter }
    }

    const cards = await prisma.card.findMany({
      where: whereClause,
      include: {
        card_player_team_card_player_team_cardTocard: {
          include: {
            player_team_card_player_team_player_teamToplayer_team: {
              include: {
                player_player_team_playerToplayer: {
                  select: { first_name: true, last_name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { sort_order: 'asc' },
      take: 50 // Limit preview to first 50 cards
    })

    const totalCards = await prisma.card.count({
      where: whereClause
    })

    res.json({
      series: {
        series_id: Number(series.series_id),
        name: series.name,
        set_name: series.set_series_setToset?.name,
        set_year: series.set_series_setToset?.year
      },
      total_cards: totalCards,
      preview_cards: cards.map(card => ({
        card_id: Number(card.card_id),
        card_number: card.card_number,
        sort_order: card.sort_order,
        is_rookie: card.is_rookie,
        players: card.card_player_team_card_player_team_cardTocard.map(cpt => {
          const pt = cpt.player_team_card_player_team_player_teamToplayer_team
          const player = pt?.player_player_team_playerToplayer
          return player ? `${player.first_name} ${player.last_name}` : null
        }).filter(Boolean)
      })),
      showing_first: Math.min(50, totalCards),
      has_more: totalCards > 50
    })

  } catch (error) {
    console.error('[Preview Copy] Error:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to preview cards',
      details: error.message
    })
  }
})

module.exports = router