const express = require('express')
const router = express.Router()
const { authenticateUser, requireAuth } = require('../middleware/auth')
const rateLimit = require('express-rate-limit')

// Rate limiting
const achievementRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
})

// Apply rate limiting and authentication to all routes
router.use(achievementRateLimit)
router.use(authenticateUser)

// Get all achievements (public endpoint for browsing)
router.get('/', async (req, res) => {
  try {
    const { category, tier, search, limit = 50, offset = 0 } = req.query

    let whereConditions = ['a.is_active = 1']
    let queryParams = []
    let paramIndex = 1

    // Add filters
    if (category) {
      whereConditions.push(`a.category_id = @param${paramIndex}`)
      queryParams.push({ name: `param${paramIndex}`, type: 'int', value: parseInt(category) })
      paramIndex++
    }

    if (tier) {
      whereConditions.push(`a.tier = @param${paramIndex}`)
      queryParams.push({ name: `param${paramIndex}`, type: 'nvarchar', value: tier })
      paramIndex++
    }

    if (search) {
      whereConditions.push(`(a.name LIKE @param${paramIndex} OR a.description LIKE @param${paramIndex})`)
      queryParams.push({ name: `param${paramIndex}`, type: 'nvarchar', value: `%${search}%` })
      paramIndex++
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''

    const query = `
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
      ${whereClause}
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
      OFFSET @offset ROWS
      FETCH NEXT @limit ROWS ONLY
    `

    // Add pagination params
    queryParams.push(
      { name: 'offset', type: 'int', value: parseInt(offset) },
      { name: 'limit', type: 'int', value: parseInt(limit) }
    )

    const achievements = await global.sql.query(query, queryParams)

    // Convert BigInt fields
    const serializedAchievements = achievements.recordset.map(achievement => ({
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
    const query = `
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

    const categories = await global.sql.query(query)

    const serializedCategories = categories.recordset.map(category => ({
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

    const query = `
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
      WHERE a.achievement_id = @achievementId AND a.is_active = 1
    `

    const result = await global.sql.query(query, [
      { name: 'achievementId', type: 'bigint', value: id }
    ])

    if (result.recordset.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Achievement not found'
      })
    }

    const achievement = result.recordset[0]
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