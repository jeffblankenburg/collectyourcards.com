const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { authMiddleware, requireAdmin } = require('../middleware/auth')
const rateLimit = require('express-rate-limit')

const router = express.Router()
const prisma = new PrismaClient({ log: ['error'] })

// Rate limiting
const adminAchievementRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 300 // Higher limit for admin operations
})

// Apply rate limiting and authentication to all routes
router.use(adminAchievementRateLimit)
router.use(authMiddleware)
router.use(requireAdmin)

// Get all achievements (admin view with full details)
router.get('/', async (req, res) => {
  try {
    const { category, tier, search, limit = 100, offset = 0 } = req.query

    // Build dynamic query based on filters
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
        a.requirement_query,
        a.completion_query,
        a.is_active,
        a.is_secret,
        a.is_repeatable,
        a.cooldown_days,
        a.created_at,
        a.updated_at,
        c.name as category_name,
        c.icon as category_icon,
        (SELECT COUNT(*) FROM user_achievements ua WHERE ua.achievement_id = a.achievement_id AND ua.is_completed = 1) as completion_count,
        (SELECT COUNT(DISTINCT ua.user_id) FROM user_achievements ua WHERE ua.achievement_id = a.achievement_id AND ua.progress > 0) as in_progress_count
      FROM achievements a
      LEFT JOIN achievement_categories c ON a.category_id = c.category_id
    `

    let whereConditions = []
    if (category) {
      whereConditions.push(`a.category_id = ${parseInt(category)}`)
    }
    if (tier) {
      whereConditions.push(`a.tier = '${tier}'`)
    }
    if (search) {
      whereConditions.push(`(a.name LIKE '%${search}%' OR a.description LIKE '%${search}%')`)
    }

    if (whereConditions.length > 0) {
      baseQuery += ` WHERE ${whereConditions.join(' AND ')}`
    }

    baseQuery += `
      ORDER BY 
        a.is_active DESC,
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

    // Convert BigInt fields
    const serializedAchievements = achievements.map(achievement => ({
      ...achievement,
      achievement_id: Number(achievement.achievement_id),
      category_id: Number(achievement.category_id),
      completion_count: Number(achievement.completion_count) || 0,
      in_progress_count: Number(achievement.in_progress_count) || 0
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
    console.error('Error fetching achievements (admin):', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievements',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get achievement categories (admin view)
router.get('/categories', async (req, res) => {
  try {
    const categories = await prisma.$queryRaw`
      SELECT 
        c.category_id,
        c.name,
        c.description,
        c.icon,
        c.display_order,
        c.is_active,
        c.created_at,
        c.updated_at,
        COUNT(a.achievement_id) as achievement_count,
        COUNT(CASE WHEN a.is_active = 1 THEN 1 END) as active_achievement_count
      FROM achievement_categories c
      LEFT JOIN achievements a ON c.category_id = a.category_id
      GROUP BY c.category_id, c.name, c.description, c.icon, c.display_order, c.is_active, c.created_at, c.updated_at
      ORDER BY c.display_order ASC, c.name ASC
    `

    const serializedCategories = categories.map(category => ({
      ...category,
      category_id: Number(category.category_id),
      achievement_count: Number(category.achievement_count) || 0,
      active_achievement_count: Number(category.active_achievement_count) || 0
    }))

    res.json({
      success: true,
      categories: serializedCategories
    })

  } catch (error) {
    console.error('Error fetching achievement categories (admin):', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievement categories'
    })
  }
})

// Create new achievement
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      category_id,
      subcategory,
      points,
      tier,
      requirement_type,
      requirement_value,
      requirement_query,
      completion_query,
      icon_url,
      is_active = true,
      is_secret = false,
      is_repeatable = false,
      cooldown_days = 0
    } = req.body

    // Basic validation
    if (!name?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Achievement name is required'
      })
    }

    if (!description?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Achievement description is required'
      })
    }

    if (!category_id || !points || points < 1) {
      return res.status(400).json({
        success: false,
        message: 'Category and valid points are required'
      })
    }

    const validTiers = ['Common', 'Uncommon', 'Rare', 'Epic', 'Legendary', 'Mythic']
    if (!validTiers.includes(tier)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid tier specified'
      })
    }

    // Check for duplicate names
    const existing = await prisma.$queryRaw`
      SELECT achievement_id FROM achievements WHERE name = ${name.trim()}
    `

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Achievement with this name already exists'
      })
    }

    // Insert the new achievement
    await prisma.$queryRaw`
      INSERT INTO achievements (
        category_id, subcategory, name, description, points, tier,
        requirement_type, requirement_value, requirement_query, completion_query,
        icon_url, is_active, is_secret, is_repeatable, cooldown_days,
        created_at, updated_at
      )
      VALUES (
        ${category_id}, ${subcategory || null}, ${name.trim()}, ${description.trim()}, ${points}, ${tier},
        ${requirement_type || 'count'}, ${requirement_value || 1}, ${requirement_query || null}, ${completion_query || null},
        ${icon_url || null}, ${is_active}, ${is_secret}, ${is_repeatable}, ${cooldown_days},
        GETDATE(), GETDATE()
      )
    `

    res.status(201).json({
      success: true,
      message: 'Achievement created successfully'
    })

  } catch (error) {
    console.error('Error creating achievement:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to create achievement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Update achievement
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params
    const { is_active } = req.body

    // For now, only support toggling active/inactive status
    if (is_active !== undefined) {
      await prisma.$queryRaw`
        UPDATE achievements
        SET is_active = ${is_active}, updated_at = GETDATE()
        WHERE achievement_id = ${BigInt(id)}
      `

      res.json({
        success: true,
        message: `Achievement ${is_active ? 'activated' : 'deactivated'} successfully`
      })
    } else {
      res.status(400).json({
        success: false,
        message: 'Only activation/deactivation is currently supported'
      })
    }

  } catch (error) {
    console.error('Error updating achievement:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to update achievement',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Delete achievement (soft delete - deactivate instead)
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params

    // Deactivate the achievement
    await prisma.$queryRaw`
      UPDATE achievements
      SET is_active = 0, updated_at = GETDATE()
      WHERE achievement_id = ${BigInt(id)}
    `

    res.json({
      success: true,
      message: 'Achievement has been deactivated'
    })

  } catch (error) {
    console.error('Error deleting achievement:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete achievement'
    })
  }
})

// Get achievement statistics
router.get('/statistics', async (req, res) => {
  try {
    const stats = await prisma.$queryRaw`
      SELECT 
        COUNT(*) as total_achievements,
        COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_achievements,
        COUNT(CASE WHEN is_secret = 1 THEN 1 END) as secret_achievements,
        COUNT(CASE WHEN tier = 'Common' THEN 1 END) as common_count,
        COUNT(CASE WHEN tier = 'Uncommon' THEN 1 END) as uncommon_count,
        COUNT(CASE WHEN tier = 'Rare' THEN 1 END) as rare_count,
        COUNT(CASE WHEN tier = 'Epic' THEN 1 END) as epic_count,
        COUNT(CASE WHEN tier = 'Legendary' THEN 1 END) as legendary_count,
        COUNT(CASE WHEN tier = 'Mythic' THEN 1 END) as mythic_count,
        AVG(CAST(points as FLOAT)) as avg_points,
        SUM(points) as total_points
      FROM achievements
    `

    const result = stats[0] || {}

    res.json({
      success: true,
      statistics: {
        ...result,
        total_achievements: Number(result.total_achievements) || 0,
        active_achievements: Number(result.active_achievements) || 0,
        avg_points: Number(result.avg_points) || 0,
        total_points: Number(result.total_points) || 0
      }
    })

  } catch (error) {
    console.error('Error fetching achievement statistics:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievement statistics'
    })
  }
})

// Simple recalculation endpoint (placeholder for now)
router.post('/recalculate', async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Achievement recalculation system is under development'
    })
  } catch (error) {
    console.error('Error recalculating achievements:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate achievements'
    })
  }
})

module.exports = router