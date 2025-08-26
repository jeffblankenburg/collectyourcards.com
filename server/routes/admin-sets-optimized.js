const express = require('express')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const prisma = require('../config/prisma') // Use global optimized Prisma instance
const router = express.Router()

// All routes require admin authentication
router.use(authMiddleware)
router.use(requireAdmin)

// Cache for frequently accessed data (organizations, manufacturers, colors don't change often)
let staticDataCache = null
let staticCacheTimestamp = null
const STATIC_CACHE_DURATION = 5 * 60 * 1000 // 5 minutes for static data

// Cache for page data (years, sets, series can change more frequently)  
let pageDataCache = {}
const PAGE_CACHE_DURATION = 60 * 1000 // 1 minute for page data

// Helper function to generate URL slug from name
function generateSlug(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

// GET /api/admin/sets-optimized/static-data - Get all static dropdown data in one call
router.get('/static-data', async (req, res) => {
  try {
    const requestStart = Date.now()
    
    // Check static data cache
    const now = Date.now()
    if (staticDataCache && staticCacheTimestamp && (now - staticCacheTimestamp) < STATIC_CACHE_DURATION) {
      console.log('🚀 Static data cache hit')
      return res.json({
        ...staticDataCache,
        performance: {
          queryTime: Date.now() - requestStart,
          queriesExecuted: 0,
          cacheHit: true,
          cacheAge: Math.round((now - staticCacheTimestamp) / 1000)
        }
      })
    }
    
    // Single optimized query for all static dropdown data
    const [organizations, manufacturers, colors] = await Promise.all([
      prisma.organization.findMany({
        select: {
          organization_id: true,
          name: true,
          abbreviation: true
        },
        orderBy: { name: 'asc' }
      }),
      prisma.manufacturer.findMany({
        select: {
          manufacturer_id: true,
          name: true
        },
        orderBy: { name: 'asc' }
      }),
      prisma.color.findMany({
        select: {
          color_id: true,
          name: true,
          hex_value: true
        },
        orderBy: { name: 'asc' }
      })
    ])
    
    const response = {
      organizations,
      manufacturers,
      colors,
      performance: {
        queryTime: Date.now() - requestStart,
        queriesExecuted: 3,
        cacheHit: false
      }
    }
    
    // Cache static data
    staticDataCache = response
    staticCacheTimestamp = Date.now()
    console.log('💾 Static data cached for 5 minutes')
    
    res.json(response)
    
  } catch (error) {
    console.error('Error fetching static data:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch static data',
      details: error.message
    })
  }
})

// GET /api/admin/sets-optimized/years - Get all years with counts in one optimized query
router.get('/years', async (req, res) => {
  try {
    const requestStart = Date.now()
    const cacheKey = 'years'
    
    // Check page data cache
    if (pageDataCache[cacheKey] && (Date.now() - pageDataCache[cacheKey].timestamp) < PAGE_CACHE_DURATION) {
      console.log('🚀 Years cache hit')
      return res.json({
        ...pageDataCache[cacheKey].data,
        performance: {
          queryTime: Date.now() - requestStart,
          queriesExecuted: 0,
          cacheHit: true
        }
      })
    }
    
    // Single optimized SQL query to get years with counts
    const yearsWithCounts = await prisma.$queryRaw`
      SELECT 
        s.year,
        COUNT(DISTINCT s.set_id) as setCount,
        COUNT(DISTINCT sr.series_id) as seriesCount
      FROM [set] s
      LEFT JOIN series sr ON s.set_id = sr.[set]
      WHERE s.year IS NOT NULL
      GROUP BY s.year
      ORDER BY s.year DESC
    `
    
    const years = yearsWithCounts.map(y => ({
      year: y.year,
      setCount: Number(y.setCount || 0),
      seriesCount: Number(y.seriesCount || 0)
    }))
    
    const response = {
      years,
      total: years.length,
      performance: {
        queryTime: Date.now() - requestStart,
        queriesExecuted: 1,
        cacheHit: false
      }
    }
    
    // Cache years data
    pageDataCache[cacheKey] = {
      data: response,
      timestamp: Date.now()
    }
    
    res.json(response)
    
  } catch (error) {
    console.error('Error fetching years:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch years',
      details: error.message
    })
  }
})

// GET /api/admin/sets-optimized/by-year/:year - Get sets for year with all related data in one query
router.get('/by-year/:year', async (req, res) => {
  try {
    const { year } = req.params
    const yearInt = parseInt(year)
    const requestStart = Date.now()
    const cacheKey = `sets_${year}`
    
    if (!yearInt || isNaN(yearInt)) {
      return res.status(400).json({
        error: 'Invalid year',
        message: 'Year must be a valid number'
      })
    }
    
    // Check cache
    if (pageDataCache[cacheKey] && (Date.now() - pageDataCache[cacheKey].timestamp) < PAGE_CACHE_DURATION) {
      console.log(`🚀 Sets for year ${year} cache hit`)
      return res.json({
        ...pageDataCache[cacheKey].data,
        performance: {
          queryTime: Date.now() - requestStart,
          queriesExecuted: 0,
          cacheHit: true
        }
      })
    }
    
    // Single optimized SQL query to get all set data with relationships
    const setsWithData = await prisma.$queryRaw`
      SELECT 
        s.set_id,
        s.name,
        s.year,
        s.card_count,
        s.series_count,
        s.is_complete,
        s.thumbnail,
        o.organization_id,
        o.name as organization_name,
        o.abbreviation as organization_abbreviation,
        m.manufacturer_id,
        m.name as manufacturer_name,
        COUNT(sr.series_id) as actual_series_count
      FROM [set] s
      LEFT JOIN organization o ON s.organization = o.organization_id
      LEFT JOIN manufacturer m ON s.manufacturer = m.manufacturer_id
      LEFT JOIN series sr ON s.set_id = sr.[set]
      WHERE s.year = ${yearInt}
      GROUP BY 
        s.set_id, s.name, s.year, s.card_count, s.series_count, s.is_complete, s.thumbnail,
        o.organization_id, o.name, o.abbreviation,
        m.manufacturer_id, m.name
      ORDER BY s.name ASC
    `
    
    const sets = setsWithData.map(s => ({
      set_id: s.set_id,
      name: s.name,
      slug: generateSlug(s.name),
      year: s.year,
      card_count: s.card_count || 0,
      series_count: Number(s.actual_series_count) || 0,
      is_complete: s.is_complete || false,
      thumbnail: s.thumbnail,
      organization_id: s.organization_id,
      organization_name: s.organization_name || '',
      organization: s.organization_abbreviation || '',
      manufacturer_id: s.manufacturer_id,
      manufacturer: s.manufacturer_name || ''
    }))
    
    const response = {
      sets,
      total: sets.length,
      performance: {
        queryTime: Date.now() - requestStart,
        queriesExecuted: 1,
        cacheHit: false
      }
    }
    
    // Cache sets data
    pageDataCache[cacheKey] = {
      data: response,
      timestamp: Date.now()
    }
    
    res.json(response)
    
  } catch (error) {
    console.error('Error fetching sets:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch sets',
      details: error.message
    })
  }
})

// GET /api/admin/sets-optimized/series/:year/:setSlug - Get series for set with all data in one query
router.get('/series/:year/:setSlug', async (req, res) => {
  try {
    const { year, setSlug } = req.params
    const requestStart = Date.now()
    const cacheKey = `series_${year}_${setSlug}`
    
    // Check cache
    if (pageDataCache[cacheKey] && (Date.now() - pageDataCache[cacheKey].timestamp) < PAGE_CACHE_DURATION) {
      console.log(`🚀 Series for ${year}/${setSlug} cache hit`)
      return res.json({
        ...pageDataCache[cacheKey].data,
        performance: {
          queryTime: Date.now() - requestStart,
          queriesExecuted: 0,
          cacheHit: true
        }
      })
    }
    
    // Single optimized SQL query to get series with all relationships
    const seriesWithData = await prisma.$queryRaw`
      SELECT 
        sr.series_id,
        sr.name,
        sr.card_count,
        sr.card_entered_count,
        sr.rookie_count,
        sr.is_base,
        sr.parallel_of_series,
        sr.color as color_id,
        sr.min_print_run,
        sr.max_print_run,
        sr.print_run_display,
        sr.front_image_path,
        sr.back_image_path,
        c.name as color_name,
        c.hex_value as color_hex_value,
        parent_sr.name as parallel_of_name,
        s.name as set_name,
        s.set_id
      FROM series sr
      JOIN [set] s ON sr.[set] = s.set_id
      LEFT JOIN color c ON sr.color = c.color_id
      LEFT JOIN series parent_sr ON sr.parallel_of_series = parent_sr.series_id
      WHERE s.year = ${parseInt(year)}
        AND LOWER(REPLACE(REPLACE(REPLACE(s.name, ' ', '-'), '.', ''), '''', '')) = ${setSlug.toLowerCase()}
      ORDER BY sr.is_base DESC, sr.name ASC
    `
    
    if (seriesWithData.length === 0) {
      return res.status(404).json({
        error: 'Set not found',
        message: `Set with slug '${setSlug}' not found in year ${year}`
      })
    }
    
    const series = seriesWithData.map(s => ({
      series_id: Number(s.series_id),
      name: s.name,
      card_count: s.card_count,
      card_entered_count: s.card_entered_count,
      rookie_count: Number(s.rookie_count || 0),
      is_base: s.is_base,
      parallel_of_series: s.parallel_of_series ? Number(s.parallel_of_series) : null,
      parallel_of_name: s.parallel_of_name,
      color_id: s.color_id ? Number(s.color_id) : null,
      color_name: s.color_name,
      color_hex_value: s.color_hex_value,
      min_print_run: s.min_print_run,
      max_print_run: s.max_print_run,
      print_run_display: s.print_run_display,
      front_image_path: s.front_image_path,
      back_image_path: s.back_image_path
    }))
    
    const response = {
      series,
      total: series.length,
      set: {
        set_id: Number(seriesWithData[0].set_id),
        name: seriesWithData[0].set_name
      },
      performance: {
        queryTime: Date.now() - requestStart,
        queriesExecuted: 1,
        cacheHit: false
      }
    }
    
    // Cache series data
    pageDataCache[cacheKey] = {
      data: response,
      timestamp: Date.now()
    }
    
    res.json(response)
    
  } catch (error) {
    console.error('Error fetching series:', error)
    res.status(500).json({
      error: 'Database error',
      message: 'Failed to fetch series',
      details: error.message
    })
  }
})

module.exports = router