const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const router = express.Router()
const prisma = new PrismaClient()

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// GET /api/admin/series - Get list of series with search and filter
router.get('/series', async (req, res) => {
  try {
    const { search, set, series_id, limit = 100 } = req.query
    const limitInt = Math.min(parseInt(limit) || 100, 500) // Cap at 500

    let whereClause = {}
    let orderBy = [{ name: 'asc' }]
    
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

    const series = await prisma.series.findMany({
      where: whereClause,
      take: limitInt,
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
    })

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
      card_count,
      card_entered_count,
      is_base,
      parallel_of_series,
      color_id,
      min_print_run,
      max_print_run,
      print_run_display,
      rookie_count
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
        rookie_count: true
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
      rookie_count: rookie_count !== undefined ? parseInt(rookie_count) : existingSeries.rookie_count
    }
    
    // Handle foreign key relationships
    if (set !== undefined) {
      updateData.set_series_setToset = {
        connect: { set_id: parseInt(set) }
      }
    }
    
    if (color_id !== undefined) {
      if (color_id) {
        updateData.color_series_colorTocolor = {
          connect: { color_id: parseInt(color_id) }
        }
      } else {
        updateData.color_series_colorTocolor = {
          disconnect: true
        }
      }
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
      rookie_count: existingSeries.rookie_count
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
        min_print_run: true,
        max_print_run: true,
        print_run_display: true,
        rookie_count: true
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

    res.json({
      message: 'Series updated successfully',
      series: {
        ...updatedSeries,
        series_id: Number(updatedSeries.series_id),
        parallel_of_series: updatedSeries.parallel_of_series ? Number(updatedSeries.parallel_of_series) : null
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

module.exports = router