const express = require('express')
const prisma = require('../config/prisma')
const { optionalAuthMiddleware } = require('../middleware/auth')
const rateLimit = require('express-rate-limit')

const router = express.Router()

// Rate limiting
const achievementRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})

// Apply rate limiting and optional authentication (achievements can be viewed without login)
router.use(achievementRateLimit)
router.use(optionalAuthMiddleware)

// Get all achievements (public endpoint for browsing)
router.get('/', async (req, res) => {
  try {
    const { category, tier, search, limit = 50, offset = 0 } = req.query

    // Build where conditions for Prisma
    const whereConditions = {
      is_active: true
    }

    if (category) {
      whereConditions.category_id = parseInt(category)
    }

    if (tier) {
      whereConditions.tier = tier
    }

    if (search) {
      whereConditions.OR = [
        { name: { contains: search } },
        { description: { contains: search } }
      ]
    }

    // Get achievements with category information
    let baseQuery = `
      SELECT 
        a.achievement_id,
        a.category_id,
        a.subcategory,
        a.name,
        a.description,
        a.points,
        a.tier,
        a.icon_url,
        a.requirement_type,
        a.requirement_value,
        a.is_active,
        a.is_secret,
        a.is_repeatable,
        a.cooldown_days,
        c.name as category_name,
        c.icon as category_icon
      FROM achievements a
      LEFT JOIN achievement_categories c ON a.category_id = c.category_id
      WHERE a.is_active = 1
    `

    // Add filters dynamically
    const filterParams = []
    if (category) {
      baseQuery += ` AND a.category_id = ${parseInt(category)}`
    }
    if (tier) {
      baseQuery += ` AND a.tier = '${tier.replace(/'/g, "''")}'` // Escape single quotes
    }
    if (search) {
      const escapedSearch = search.replace(/'/g, "''")
      baseQuery += ` AND (a.name LIKE '%${escapedSearch}%' OR a.description LIKE '%${escapedSearch}%')`
    }

    baseQuery += `
      ORDER BY 
        CASE a.tier 
          WHEN 'Common' THEN 1
          WHEN 'Uncommon' THEN 2
          WHEN 'Rare' THEN 3
          WHEN 'Epic' THEN 4
          WHEN 'Legendary' THEN 5
          WHEN 'Mythic' THEN 6
          ELSE 7
        END,
        a.points ASC,
        a.name ASC
      OFFSET ${parseInt(offset)} ROWS
      FETCH NEXT ${parseInt(limit)} ROWS ONLY
    `

    const achievements = await prisma.$queryRawUnsafe(baseQuery)

    // Convert BigInt fields to regular numbers for JSON serialization
    const serializedAchievements = achievements.map(achievement => ({
      ...achievement,
      achievement_id: Number(achievement.achievement_id),
      category_id: Number(achievement.category_id)
    }))

    res.json({
      success: true,
      achievements: serializedAchievements,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        hasMore: serializedAchievements.length === parseInt(limit)
      }
    })

  } catch (error) {
    console.error('Error fetching achievements:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get achievement categories
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.$queryRaw`
      SELECT 
        category_id,
        name,
        description,
        icon,
        display_order
      FROM achievement_categories
      WHERE is_active = 1
      ORDER BY display_order ASC, name ASC
    `

    const serializedCategories = categories.map(category => ({
      ...category,
      category_id: Number(category.category_id)
    }))

    res.json({
      success: true,
      categories: serializedCategories
    })

  } catch (error) {
    console.error('Error fetching achievement categories:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievement categories'
    })
  }
})

// Get specific achievement details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params

    const result = await prisma.$queryRaw`
      SELECT 
        a.achievement_id,
        a.category_id,
        a.subcategory,
        a.name,
        a.description,
        a.points,
        a.tier,
        a.icon_url,
        a.requirement_type,
        a.requirement_value,
        a.requirement_query,
        a.completion_query,
        a.is_active,
        a.is_secret,
        a.is_repeatable,
        a.cooldown_days,
        c.name as category_name,
        c.icon as category_icon
      FROM achievements a
      LEFT JOIN achievement_categories c ON a.category_id = c.category_id
      WHERE a.achievement_id = ${BigInt(id)} AND a.is_active = 1
    `

    if (result.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found'
      })
    }

    const achievement = result[0]
    const serializedAchievement = {
      ...achievement,
      achievement_id: Number(achievement.achievement_id),
      category_id: Number(achievement.category_id)
    }

    res.json({
      success: true,
      achievement: serializedAchievement
    })

  } catch (error) {
    console.error('Error fetching achievement details:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievement details'
    })
  }
})

module.exports = router