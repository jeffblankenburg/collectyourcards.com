const express = require('express')
const { authMiddleware, requireAdmin, requireDataAdmin, requireSuperAdmin } = require('../middleware/auth')
const router = express.Router()
const multer = require('multer')
const { BlobServiceClient } = require('@azure/storage-blob')
const { prisma } = require('../config/prisma-singleton')
const { getBlobName } = require('../utils/azure-storage')

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Only allow image files
    if (file.mimetype.startsWith('image/')) {
      cb(null, true)
    } else {
      cb(new Error('Only image files are allowed'))
    }
  }
})

// Azure Storage configuration
const AZURE_STORAGE_CONNECTION_STRING = process.env.AZURE_STORAGE_CONNECTION_STRING
const SET_CONTAINER_NAME = 'set'
const SERIES_CONTAINER_NAME = 'series'

// Helper function to generate URL slug from set name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/&/g, 'and') // Convert ampersands to "and" to preserve semantic meaning
    .replace(/'/g, '') // Remove apostrophes completely
    .replace(/[^a-z0-9]+/g, '-') // Replace other special chars with hyphens
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
}

// Helper function to generate unique set slug with sport disambiguation
async function generateUniqueSetSlug(name, organizationId) {
  let slug = generateSlug(name)

  // Check if slug already exists
  const existing = await prisma.set.findFirst({
    where: { slug }
  })

  // If slug doesn't exist, use it
  if (!existing) {
    return slug
  }

  // If slug exists, append sport name (or abbreviation as fallback)
  if (organizationId) {
    const org = await prisma.organization.findUnique({
      where: { organization_id: parseInt(organizationId) },
      select: { sport: true, abbreviation: true }
    })

    if (org?.sport) {
      return `${slug}-${org.sport.toLowerCase()}`
    } else if (org?.abbreviation) {
      // Fallback to abbreviation if sport not set
      return `${slug}-${org.abbreviation.toLowerCase()}`
    }
  }

  // Last resort: append timestamp
  return `${slug}-${Date.now()}`
}

// Helper function to generate unique player slug with birth year disambiguation
async function generateUniquePlayerSlug(firstName, lastName, birthdate) {
  const fullName = `${firstName} ${lastName}`
  let slug = generateSlug(fullName)

  // Check if slug already exists
  const existing = await prisma.player.findFirst({
    where: { slug }
  })

  // If slug doesn't exist, use it
  if (!existing) {
    return slug
  }

  // If slug exists and we have birthdate, append birth year
  if (birthdate) {
    const birthYear = new Date(birthdate).getFullYear()
    return `${slug}-${birthYear}`
  }

  // Last resort: append timestamp
  return `${slug}-${Date.now()}`
}

// Helper function to find series by slug, year, and set
async function findSeriesBySlug(year, setSlug, seriesSlug) {
  // First find the set
  const set = await findSetBySlug(year, setSlug)
  if (!set) return null

  // Then find series in that set by slug
  return await prisma.series.findFirst({
    where: {
      set: set.set_id,
      slug: seriesSlug
    },
    include: {
      set_series_setToset: {
        select: {
          name: true
        }
      }
    }
  })
}

// Helper function to find set by slug and year
async function findSetBySlug(year, slug) {
  return await prisma.set.findFirst({
    where: {
      year: parseInt(year),
      slug: slug
    },
    include: {
      organization_set_organizationToorganization: {
        select: {
          name: true,
          abbreviation: true
        }
      },
      manufacturer_set_manufacturerTomanufacturer: {
        select: {
          name: true
        }
      }
    }
  })
}

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// GET /api/admin/sets - Get list of sets with search and limit
router.get('/sets', async (req, res) => {
  try {
    const { search, set_id, limit = 20, all } = req.query
    // If 'all' parameter is provided, get all sets (for dropdowns)
    const limitInt = all === 'true' ? 10000 : Math.min(parseInt(limit) || 20, 100) // Cap at 100 unless 'all' is requested

    let whereClause = {}
    let orderBy = [{ created: 'desc' }]
    
    // Filter by specific set ID if provided
    if (set_id && set_id.trim()) {
      const setIdInt = parseInt(set_id)
      if (setIdInt) {
        whereClause.set_id = setIdInt
      }
    }
    // Add search if provided
    else if (search && search.trim()) {
      whereClause = {
        OR: [
          { name: { contains: search.trim() } },
          { organization_set_organizationToorganization: { name: { contains: search.trim() } } },
          { organization_set_organizationToorganization: { abbreviation: { contains: search.trim() } } },
          { manufacturer_set_manufacturerTomanufacturer: { name: { contains: search.trim() } } }
        ]
      }
      orderBy = [{ name: 'asc' }]
    }

    const sets = await prisma.set.findMany({
      where: whereClause,
      take: limitInt,
      orderBy,
      include: {
        organization_set_organizationToorganization: {
          select: {
            name: true,
            abbreviation: true
          }
        },
        manufacturer_set_manufacturerTomanufacturer: {
          select: {
            name: true
          }
        },
        _count: {
          select: {
            series_series_setToset: true
          }
        }
      }
    })

    // Format the response data
    const formattedSets = sets.map(set => ({
      set_id: Number(set.set_id),
      name: set.name,
      year: set.year,
      organization_id: Number(set.organization || 0),
      organization: set.organization_set_organizationToorganization?.abbreviation || '',
      manufacturer_id: Number(set.manufacturer || 0),
      manufacturer: set.manufacturer_set_manufacturerTomanufacturer?.name || '',
      series_count: set._count.series_series_setToset || 0,
      card_count: set.card_count || 0,
      is_complete: set.is_complete,
      thumbnail: set.thumbnail,
      slug: generateSlug(set.name || ''),
      created: set.created
    }))

    res.json({
      sets: formattedSets,
      total: formattedSets.length
    })

  } catch (error) {
    console.error('Error fetching sets:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch sets',
      details: error.message
    })
  }
})

// GET /api/admin/sets/years - Get list of unique years
router.get('/sets/years', async (req, res) => {
  try {
    const years = await prisma.set.findMany({
      select: {
        year: true
      },
      where: {
        year: {
          not: null
        }
      },
      distinct: ['year'],
      orderBy: {
        year: 'desc'
      }
    })

    // Get counts for each year
    const yearCounts = await Promise.all(
      years.map(async (y) => {
        const count = await prisma.set.count({
          where: { year: y.year }
        })
        const seriesCount = await prisma.series.count({
          where: {
            set_series_setToset: {
              year: y.year
            }
          }
        })
        return {
          year: y.year,
          setCount: count,
          seriesCount: seriesCount
        }
      })
    )

    res.json({
      years: yearCounts,
      total: yearCounts.length
    })

  } catch (error) {
    console.error('Error fetching years:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch years',
      details: error.message
    })
  }
})

// GET /api/admin/sets/by-year/:year - Get sets for a specific year
router.get('/sets/by-year/:year', async (req, res) => {
  try {
    const { year } = req.params
    const yearInt = parseInt(year)

    if (!yearInt || isNaN(yearInt)) {
      return res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number'
      })
    }

    const sets = await prisma.set.findMany({
      where: {
        year: yearInt
      },
      select: {
        set_id: true,
        name: true,
        year: true,
        card_count: true,
        series_count: true,
        is_complete: true,
        thumbnail: true,
        organization_set_organizationToorganization: {
          select: {
            organization_id: true,
            name: true,
            abbreviation: true
          }
        },
        manufacturer_set_manufacturerTomanufacturer: {
          select: {
            manufacturer_id: true,
            name: true
          }
        },
        series_series_setToset: {
          select: {
            series_id: true
          }
        }
      },
      orderBy: {
        name: 'asc'
      }
    })

    const serializedSets = sets.map(s => ({
      set_id: s.set_id,
      name: s.name,
      slug: generateSlug(s.name),
      year: s.year,
      card_count: s.card_count || 0,
      series_count: s.series_series_setToset?.length || 0,
      is_complete: s.is_complete || false,
      thumbnail: s.thumbnail,
      organization_id: s.organization_set_organizationToorganization?.organization_id || null,
      organization_name: s.organization_set_organizationToorganization?.name || '',
      organization: s.organization_set_organizationToorganization?.abbreviation || '',
      manufacturer_id: s.manufacturer_set_manufacturerTomanufacturer?.manufacturer_id || null,
      manufacturer: s.manufacturer_set_manufacturerTomanufacturer?.name || ''
    }))

    res.json({
      sets: serializedSets,
      total: serializedSets.length
    })

  } catch (error) {
    console.error('Error fetching sets:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch sets',
      details: error.message
    })
  }
})

// GET /api/admin/series/by-set/:year/:setSlug - Get series for a specific set by slug
router.get('/series/by-set/:year/:setSlug', async (req, res) => {
  try {
    const { year, setSlug } = req.params
    
    // Find the set by slug
    const set = await findSetBySlug(year, setSlug)
    
    if (!set) {
      return res.status(404).json({
        error: 'Set not found',
        message: `Set with slug '${setSlug}' not found in year ${year}`
      })
    }
    
    const setIdInt = set.set_id

    const series = await prisma.series.findMany({
      where: {
        set: setIdInt
      },
      select: {
        series_id: true,
        name: true,
        card_count: true,
        card_entered_count: true,
        rookie_count: true,
        is_base: true,
        parallel_of_series: true,
        color: true,
        min_print_run: true,
        max_print_run: true,
        print_run_display: true,
        color: true,
        front_image_path: true,
        back_image_path: true,
        color_series_colorTocolor: {
          select: {
            color_id: true,
            name: true,
            hex_value: true
          }
        }
      },
      orderBy: [
        { is_base: 'desc' },
        { name: 'asc' }
      ]
    })

    // Get parallel series names for display
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
          ...s,
          series_id: Number(s.series_id),
          parallel_of_series: s.parallel_of_series ? Number(s.parallel_of_series) : null,
          parallel_of_name: parallelOfName,
          rookie_count: Number(s.rookie_count || 0),
          color_id: s.color ? Number(s.color) : null,
          color_name: s.color_series_colorTocolor?.name || null,
          color_hex_value: s.color_series_colorTocolor?.hex_value || null
        }
      })
    )

    res.json({
      series: seriesWithParallels,
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

// POST /api/admin/sets - Create new set
router.post('/sets', async (req, res) => {
  try {
    const { 
      name, 
      year,
      organization,
      manufacturer,
      is_complete,
      thumbnail
    } = req.body

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Set name is required'
      })
    }

    // Prepare creation data
    const trimmedName = name.trim()
    const slug = await generateUniqueSetSlug(trimmedName, organization) // Generate unique slug with organization disambiguation
    const createData = {
      name: trimmedName,
      slug: slug,
      year: year ? parseInt(year) : null,
      organization: organization ? parseInt(organization) : null,
      manufacturer: manufacturer ? parseInt(manufacturer) : null,
      is_complete: is_complete || false,
      thumbnail: thumbnail || null,
      card_count: 0,
      series_count: 0,
      created: new Date()
    }

    // Create new set
    const newSet = await prisma.set.create({
      data: createData,
      select: {
        set_id: true,
        name: true,
        year: true,
        organization: true,
        manufacturer: true,
        card_count: true,
        series_count: true,
        is_complete: true,
        thumbnail: true,
        created: true
      }
    })

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'SET_CREATED',
          entity_type: 'set',
          entity_id: newSet.set_id.toString(),
          old_values: null,
          new_values: JSON.stringify(createData),
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
    }

    res.status(201).json({
      message: 'Set created successfully',
      set: {
        ...newSet,
        set_id: Number(newSet.set_id)
      }
    })

  } catch (error) {
    console.error('Error creating set:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to create set',
      details: error.message
    })
  }
})

// PUT /api/admin/sets/:id - Update set
router.put('/sets/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { 
      name, 
      year,
      organization,
      manufacturer,
      card_count,
      series_count,
      is_complete,
      thumbnail
    } = req.body

    // Validate set ID
    const setId = parseInt(id)
    if (!setId || isNaN(setId)) {
      return res.status(400).json({
        error: 'Invalid set ID',
        message: 'Set ID must be a valid number'
      })
    }

    // Check if set exists
    const existingSet = await prisma.set.findUnique({
      where: { set_id: setId },
      select: {
        set_id: true,
        name: true,
        year: true,
        organization: true,
        manufacturer: true,
        card_count: true,
        series_count: true,
        is_complete: true
      }
    })

    if (!existingSet) {
      return res.status(404).json({
        error: 'Set not found',
        message: `Set with ID ${setId} does not exist`
      })
    }

    // Prepare update data
    const trimmedName = name?.trim()
    const updateData = {
      name: trimmedName || null,
      slug: trimmedName ? generateSlug(trimmedName) : existingSet.slug, // Regenerate slug if name changed
      year: year ? parseInt(year) : null,
      organization: organization ? parseInt(organization) : null,
      manufacturer: manufacturer ? parseInt(manufacturer) : null,
      card_count: card_count !== undefined ? parseInt(card_count) : existingSet.card_count,
      series_count: series_count !== undefined ? parseInt(series_count) : existingSet.series_count,
      is_complete: is_complete !== undefined ? is_complete : existingSet.is_complete
    }

    // Store old values for logging
    const oldValues = JSON.stringify(existingSet)

    // Update set
    const updatedSet = await prisma.set.update({
      where: { set_id: setId },
      data: updateData,
      select: {
        set_id: true,
        name: true,
        year: true,
        organization: true,
        manufacturer: true,
        card_count: true,
        series_count: true,
        is_complete: true
      }
    })

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'SET_UPDATED',
          entity_type: 'set',
          entity_id: setId.toString(),
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
      message: 'Set updated successfully',
      set: updatedSet
    })

  } catch (error) {
    console.error('Error updating set:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to update set',
      details: error.message
    })
  }
})

// POST /api/admin/series - Create new series
router.post('/series', async (req, res) => {
  try {
    const {
      name,
      set_id,
      card_count,
      card_entered_count,
      rookie_count,
      is_base,
      parallel_of_series,
      color_id,
      min_print_run,
      max_print_run,
      print_run_display,
      production_code,
      front_image_path,
      back_image_path
    } = req.body

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Series name is required'
      })
    }

    if (!set_id) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'Set ID is required'
      })
    }

    // Prepare creation data - using nested relationship syntax for foreign keys
    const trimmedName = name.trim()
    const createData = {
      name: trimmedName,
      slug: generateSlug(trimmedName), // Generate and save slug
      card_count: card_count ? parseInt(card_count) : 0,
      card_entered_count: card_entered_count ? parseInt(card_entered_count) : 0,
      is_base: is_base || false,
      parallel_of_series: parallel_of_series ? BigInt(parallel_of_series) : null,
      min_print_run: min_print_run ? parseInt(min_print_run) : null,
      max_print_run: max_print_run ? parseInt(max_print_run) : null,
      print_run_display: print_run_display?.trim() || null,
      production_code: production_code?.trim() || null,
      front_image_path: front_image_path?.trim() || null,
      back_image_path: back_image_path?.trim() || null,
      rookie_count: rookie_count ? parseInt(rookie_count) : 0,
      // Handle foreign key relationships with nested syntax
      set_series_setToset: {
        connect: { set_id: parseInt(set_id) }
      }
    }

    // Add color relationship if provided
    if (color_id) {
      createData.color_series_colorTocolor = {
        connect: { color_id: parseInt(color_id) }
      }
    }

    // Create new series
    const newSeries = await prisma.series.create({
      data: createData,
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
        front_image_path: true,
        back_image_path: true,
        rookie_count: true
      }
    })

    // Log admin action
    try {
      // Create a serializable version for logging
      const logData = {
        name: name.trim(),
        set_id: parseInt(set_id),
        card_count: card_count ? parseInt(card_count) : 0,
        card_entered_count: card_entered_count ? parseInt(card_entered_count) : 0,
        is_base: is_base || false,
        parallel_of_series: parallel_of_series ? parallel_of_series.toString() : null,
        color_id: color_id ? parseInt(color_id) : null,
        min_print_run: min_print_run ? parseInt(min_print_run) : null,
        max_print_run: max_print_run ? parseInt(max_print_run) : null,
        print_run_display: print_run_display?.trim() || null,
        production_code: production_code?.trim() || null,
        front_image_path: front_image_path?.trim() || null,
        back_image_path: back_image_path?.trim() || null,
        rookie_count: rookie_count ? parseInt(rookie_count) : 0
      }

      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'SERIES_CREATED',
          entity_type: 'series',
          entity_id: newSeries.series_id.toString(),
          old_values: null,
          new_values: JSON.stringify(logData),
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          created: new Date()
        }
      })
    } catch (logError) {
      console.warn('Failed to log admin action:', logError.message)
    }

    res.status(201).json({
      message: 'Series created successfully',
      series: {
        ...newSeries,
        series_id: Number(newSeries.series_id),
        parallel_of_series: newSeries.parallel_of_series ? Number(newSeries.parallel_of_series) : null
      }
    })

  } catch (error) {
    console.error('Error creating series:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to create series',
      details: error.message
    })
  }
})

// PUT /api/admin/series/:id - Update series (moved from admin-series.js)
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
      production_code,
      primary_color_name,
      primary_color_hex,
      photo_url,
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

    // Prepare update data - excluding fields that need special handling
    const trimmedName = name?.trim()
    const updateData = {
      name: trimmedName || null,
      slug: trimmedName ? generateSlug(trimmedName) : existingSeries.slug, // Regenerate slug if name changed
      card_count: card_count !== undefined ? parseInt(card_count) : existingSeries.card_count,
      card_entered_count: card_entered_count !== undefined ? parseInt(card_entered_count) : existingSeries.card_entered_count,
      is_base: is_base !== undefined ? is_base : existingSeries.is_base,
      parallel_of_series: parallel_of_series ? BigInt(parallel_of_series) : null,
      min_print_run: min_print_run !== undefined ? (min_print_run ? parseInt(min_print_run) : null) : existingSeries.min_print_run,
      max_print_run: max_print_run !== undefined ? (max_print_run ? parseInt(max_print_run) : null) : existingSeries.max_print_run,
      print_run_display: print_run_display?.trim() || null,
      production_code: production_code !== undefined ? (production_code?.trim() || null) : existingSeries.production_code,
      front_image_path: front_image_path?.trim() || null,
      back_image_path: back_image_path?.trim() || null
    }
    
    // Handle foreign key relationships properly
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
      production_code: existingSeries.production_code,
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
        min_print_run: true,
        max_print_run: true,
        print_run_display: true,
        production_code: true,
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

// GET /api/admin/organizations and manufacturers for dropdowns
router.get('/organizations', async (req, res) => {
  try {
    const organizations = await prisma.organization.findMany({
      select: {
        organization_id: true,
        name: true,
        abbreviation: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    res.json({
      organizations,
      total: organizations.length
    })

  } catch (error) {
    console.error('Error fetching organizations:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch organizations',
      details: error.message
    })
  }
})

router.get('/manufacturers', async (req, res) => {
  try {
    const manufacturers = await prisma.manufacturer.findMany({
      select: {
        manufacturer_id: true,
        name: true
      },
      orderBy: {
        name: 'asc'
      }
    })

    res.json({
      manufacturers,
      total: manufacturers.length
    })

  } catch (error) {
    console.error('Error fetching manufacturers:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch manufacturers',
      details: error.message
    })
  }
})

// GET /api/admin/cards/by-series/:year/:setSlug/:seriesSlug - Get cards for a specific series
router.get('/cards/by-series/:year/:setSlug/:seriesSlug', async (req, res) => {
  try {
    const { year, setSlug, seriesSlug } = req.params
    
    // Find the series by slug
    const series = await findSeriesBySlug(year, setSlug, seriesSlug)
    
    if (!series) {
      return res.status(404).json({
        error: 'Series not found',
        message: `Series with slug '${seriesSlug}' not found in set '${setSlug}' for year ${year}`
      })
    }

    // Use a simpler approach - just get basic card data and let the frontend use the existing cards API
    const cards = await prisma.card.findMany({
      where: {
        series: series.series_id
      },
      select: {
        card_id: true,
        card_number: true,
        sort_order: true,
        is_rookie_card: true,
        year: true,
        notes: true
      },
      orderBy: [
        { sort_order: 'asc' },
        { card_number: 'asc' }
      ]
    })

    res.json({
      cards: cards.map(card => ({
        card_id: card.card_id,
        card_number: card.card_number,
        sort_order: card.sort_order,
        player_name: '',
        player_id: null,
        team_name: '',
        team_city: '',
        team_abbreviation: '',
        series_name: series.name || '',
        series_color_name: series.primary_color_name || '',
        series_color_hex: series.primary_color_hex || '',
        is_rookie_card: card.is_rookie_card || false,
        year: card.year,
        notes: card.notes || ''
      })),
      total: cards.length,
      series: {
        series_id: Number(series.series_id),
        name: series.name,
        slug: seriesSlug,
        set_name: series.set_series_setToset?.name || ''
      }
    })

  } catch (error) {
    console.error('Error fetching cards by series:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch cards',
      details: error.message
    })
  }
})

// POST /api/admin/sets/upload-thumbnail - Upload thumbnail to Azure Storage
router.post('/sets/upload-thumbnail', authMiddleware, requireAdmin, upload.single('thumbnail'), async (req, res) => {
  try {
    const { setId } = req.body
    const file = req.file

    if (!file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      })
    }

    if (!setId) {
      return res.status(400).json({
        success: false,
        message: 'Set ID is required'
      })
    }

    // Validate file type
    if (!file.mimetype.startsWith('image/')) {
      return res.status(400).json({
        success: false,
        message: 'Only image files are allowed'
      })
    }

    // Check if Azure Storage is configured
    if (!AZURE_STORAGE_CONNECTION_STRING || AZURE_STORAGE_CONNECTION_STRING === 'your-azure-storage-connection-string-here') {
      console.error('Azure Storage not configured. Please add AZURE_STORAGE_CONNECTION_STRING to .env file')
      console.error('Format: DefaultEndpointsProtocol=https;AccountName=YOUR_ACCOUNT_NAME;AccountKey=YOUR_ACCOUNT_KEY;EndpointSuffix=core.windows.net')
      return res.status(500).json({
        success: false,
        message: 'Azure Storage not configured. Please add AZURE_STORAGE_CONNECTION_STRING to .env file.'
      })
    }

    // Create Azure Storage client
    let blobServiceClient
    try {
      blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
    } catch (error) {
      console.error('Invalid Azure Storage connection string:', error.message)
      return res.status(500).json({
        success: false,
        message: 'Invalid Azure Storage configuration. Please check the connection string format.'
      })
    }
    
    const containerClient = blobServiceClient.getContainerClient(SET_CONTAINER_NAME)

    // Ensure container exists
    await containerClient.createIfNotExists({
      access: 'blob' // Allow public read access to blobs
    })

    // Generate blob name using just the set_id for easy manual management
    // Use environment-aware blob name (dev/ prefix in development)
    const fileExtension = file.originalname.split('.').pop()
    const blobName = getBlobName(`${setId}.${fileExtension}`)
    
    // Get blob client
    const blockBlobClient = containerClient.getBlockBlobClient(blobName)

    // Upload file to Azure Storage
    await blockBlobClient.uploadData(file.buffer, {
      blobHTTPHeaders: {
        blobContentType: file.mimetype
      }
    })

    // Get the public URL
    const thumbnailUrl = blockBlobClient.url

    // Update the set record with the new thumbnail URL
    await prisma.set.update({
      where: { set_id: parseInt(setId) },
      data: { thumbnail: thumbnailUrl }
    })

    res.json({
      success: true,
      message: 'Thumbnail uploaded successfully',
      thumbnailUrl: thumbnailUrl
    })

  } catch (error) {
    console.error('Error uploading thumbnail:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to upload thumbnail',
      details: error.message
    })
  }
})

// POST /api/admin/series/upload-images/:seriesId - Upload front/back images for a series
router.post('/series/upload-images/:seriesId', authMiddleware, requireAdmin, upload.fields([
  { name: 'front_image', maxCount: 1 },
  { name: 'back_image', maxCount: 1 }
]), async (req, res) => {
  try {
    const { seriesId } = req.params
    const files = req.files

    if (!files || (!files.front_image && !files.back_image)) {
      return res.status(400).json({
        success: false,
        message: 'At least one image file is required'
      })
    }

    if (!seriesId) {
      return res.status(400).json({
        success: false,
        message: 'Series ID is required'
      })
    }

    // Validate series exists
    const existingSeries = await prisma.series.findUnique({
      where: { series_id: BigInt(seriesId) },
      select: { series_id: true, name: true }
    })

    if (!existingSeries) {
      return res.status(404).json({
        success: false,
        message: 'Series not found'
      })
    }

    // Check if Azure Storage is configured
    if (!AZURE_STORAGE_CONNECTION_STRING || AZURE_STORAGE_CONNECTION_STRING === 'your-azure-storage-connection-string-here') {
      return res.status(500).json({
        success: false,
        message: 'Azure Storage not configured. Please add AZURE_STORAGE_CONNECTION_STRING to .env file.'
      })
    }

    // Create Azure Storage client
    let blobServiceClient
    try {
      blobServiceClient = BlobServiceClient.fromConnectionString(AZURE_STORAGE_CONNECTION_STRING)
    } catch (error) {
      console.error('Invalid Azure Storage connection string:', error.message)
      return res.status(500).json({
        success: false,
        message: 'Invalid Azure Storage configuration. Please check the connection string format.'
      })
    }
    
    const containerClient = blobServiceClient.getContainerClient(SERIES_CONTAINER_NAME)

    // Ensure container exists
    await containerClient.createIfNotExists({
      access: 'blob' // Allow public read access to blobs
    })

    const updateData = {}
    const uploadResults = {}

    // Process front image if provided
    if (files.front_image && files.front_image[0]) {
      const frontFile = files.front_image[0]
      
      // Validate file type
      if (!frontFile.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'Only image files are allowed'
        })
      }

      const frontExtension = frontFile.originalname.split('.').pop()
      // Use environment-aware blob name (dev/ prefix in development)
      const frontBlobName = getBlobName(`${seriesId}-front.${frontExtension}`)
      const frontBlockBlobClient = containerClient.getBlockBlobClient(frontBlobName)

      // Upload front image to Azure Storage
      await frontBlockBlobClient.uploadData(frontFile.buffer, {
        blobHTTPHeaders: {
          blobContentType: frontFile.mimetype
        }
      })

      updateData.front_image_path = frontBlockBlobClient.url
      uploadResults.front_image_url = frontBlockBlobClient.url
    }

    // Process back image if provided
    if (files.back_image && files.back_image[0]) {
      const backFile = files.back_image[0]
      
      // Validate file type
      if (!backFile.mimetype.startsWith('image/')) {
        return res.status(400).json({
          success: false,
          message: 'Only image files are allowed'
        })
      }

      const backExtension = backFile.originalname.split('.').pop()
      // Use environment-aware blob name (dev/ prefix in development)
      const backBlobName = getBlobName(`${seriesId}-back.${backExtension}`)
      const backBlockBlobClient = containerClient.getBlockBlobClient(backBlobName)

      // Upload back image to Azure Storage
      await backBlockBlobClient.uploadData(backFile.buffer, {
        blobHTTPHeaders: {
          blobContentType: backFile.mimetype
        }
      })

      updateData.back_image_path = backBlockBlobClient.url
      uploadResults.back_image_url = backBlockBlobClient.url
    }

    // Update the series record with the new image URLs
    await prisma.series.update({
      where: { series_id: BigInt(seriesId) },
      data: updateData
    })

    // Log admin action
    try {
      await prisma.admin_action_log.create({
        data: {
          user_id: BigInt(req.user.userId),
          action_type: 'SERIES_IMAGES_UPLOADED',
          entity_type: 'series',
          entity_id: seriesId.toString(),
          old_values: null,
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
      success: true,
      message: 'Images uploaded successfully',
      ...uploadResults
    })

  } catch (error) {
    console.error('Error uploading series images:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to upload images',
      details: error.message
    })
  }
})

module.exports = router