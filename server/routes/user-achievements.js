const express = require('express')
const { PrismaClient } = require('@prisma/client')
const { authMiddleware } = require('../middleware/auth')
const rateLimit = require('express-rate-limit')

const router = express.Router()
const prisma = new PrismaClient({ log: ['error'] })

// Rate limiting
const userAchievementRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200 // Higher limit for user-specific achievement data
})

// Apply rate limiting and authentication to all routes
router.use(userAchievementRateLimit)
router.use(authMiddleware) // All user achievement routes require authentication

// Get user's achievement progress
router.get('/progress', async (req, res) => {
  try {
    const userId = parseInt(req.user.userId)

    const progress = await prisma.$queryRaw`
      SELECT 
        ua.user_achievement_id,
        ua.achievement_id,
        ua.progress,
        ua.progress_percentage,
        ua.is_completed,
        ua.completed_at,
        ua.points_awarded,
        ua.times_completed,
        ua.last_progress_update
      FROM user_achievements ua
      WHERE ua.user_id = ${userId}
    `

    const serializedProgress = progress.map(item => ({
      ...item,
      user_achievement_id: Number(item.user_achievement_id),
      achievement_id: Number(item.achievement_id),
      progress_percentage: Number(item.progress_percentage) || 0,
      points_awarded: item.points_awarded ? Number(item.points_awarded) : null
    }))

    res.json({
      success: true,
      progress: serializedProgress
    })

  } catch (error) {
    console.error('Error fetching user achievement progress:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievement progress'
    })
  }
})

// Get user's achievement statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = parseInt(req.user.userId)

    // First try to get existing stats, if none exist, calculate them
    let statsResult = await prisma.$queryRaw`
      SELECT 
        total_points,
        total_achievements,
        common_achievements,
        uncommon_achievements,
        rare_achievements,
        epic_achievements,
        legendary_achievements,
        mythic_achievements,
        completion_percentage,
        longest_streak,
        current_streak,
        last_achievement_date,
        achievement_rate,
        points_rank,
        achievements_rank,
        percentile_rank
      FROM user_achievement_stats
      WHERE user_id = ${userId}
    `

    let stats
    if (statsResult.length === 0) {
      // Calculate basic stats if none exist
      const basicStats = await prisma.$queryRaw`
        SELECT 
          COALESCE(SUM(ua.points_awarded), 0) as total_points,
          COUNT(*) as total_achievements,
          SUM(CASE WHEN a.tier = 'Common' THEN 1 ELSE 0 END) as common_achievements,
          SUM(CASE WHEN a.tier = 'Uncommon' THEN 1 ELSE 0 END) as uncommon_achievements,
          SUM(CASE WHEN a.tier = 'Rare' THEN 1 ELSE 0 END) as rare_achievements,
          SUM(CASE WHEN a.tier = 'Epic' THEN 1 ELSE 0 END) as epic_achievements,
          SUM(CASE WHEN a.tier = 'Legendary' THEN 1 ELSE 0 END) as legendary_achievements,
          SUM(CASE WHEN a.tier = 'Mythic' THEN 1 ELSE 0 END) as mythic_achievements,
          MAX(ua.completed_at) as last_achievement_date
        FROM user_achievements ua
        INNER JOIN achievements a ON ua.achievement_id = a.achievement_id
        WHERE ua.user_id = ${userId} AND ua.is_completed = 1
      `

      stats = basicStats[0] || {
        total_points: 0,
        total_achievements: 0,
        common_achievements: 0,
        uncommon_achievements: 0,
        rare_achievements: 0,
        epic_achievements: 0,
        legendary_achievements: 0,
        mythic_achievements: 0,
        completion_percentage: 0,
        longest_streak: 0,
        current_streak: 0,
        last_achievement_date: null,
        achievement_rate: 0,
        points_rank: null,
        achievements_rank: null,
        percentile_rank: null
      }
    } else {
      stats = statsResult[0]
    }

    // Convert numeric fields
    const serializedStats = {
      ...stats,
      total_points: Number(stats.total_points) || 0,
      total_achievements: Number(stats.total_achievements) || 0,
      common_achievements: Number(stats.common_achievements) || 0,
      uncommon_achievements: Number(stats.uncommon_achievements) || 0,
      rare_achievements: Number(stats.rare_achievements) || 0,
      epic_achievements: Number(stats.epic_achievements) || 0,
      legendary_achievements: Number(stats.legendary_achievements) || 0,
      mythic_achievements: Number(stats.mythic_achievements) || 0,
      completion_percentage: Number(stats.completion_percentage) || 0,
      achievement_rate: Number(stats.achievement_rate) || 0
    }

    res.json({
      success: true,
      stats: serializedStats
    })

  } catch (error) {
    console.error('Error fetching user achievement stats:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievement statistics'
    })
  }
})

// Get user's recent achievements
router.get('/recent', async (req, res) => {
  try {
    const userId = parseInt(req.user.userId)
    const { limit = 10 } = req.query

    const recent = await prisma.$queryRaw`
      SELECT TOP (${parseInt(limit)})
        ua.achievement_id,
        ua.completed_at,
        ua.points_awarded,
        a.name,
        a.description,
        a.tier,
        a.icon_url,
        c.name as category_name
      FROM user_achievements ua
      INNER JOIN achievements a ON ua.achievement_id = a.achievement_id
      LEFT JOIN achievement_categories c ON a.category_id = c.category_id
      WHERE ua.user_id = ${userId} AND ua.is_completed = 1
      ORDER BY ua.completed_at DESC
    `

    const serializedRecent = recent.map(achievement => ({
      ...achievement,
      achievement_id: Number(achievement.achievement_id),
      points_awarded: Number(achievement.points_awarded) || 0
    }))

    res.json({
      success: true,
      recent: serializedRecent
    })

  } catch (error) {
    console.error('Error fetching recent achievements:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch recent achievements'
    })
  }
})

// Manually check achievement progress (for testing/debugging)
router.post('/check/:achievementId?', async (req, res) => {
  try {
    const userId = parseInt(req.user.userId)
    const { achievementId } = req.params

    // Note: This is a simplified version as stored procedures aren't available yet
    // In production, this would trigger the achievement calculation engine
    
    res.json({
      success: true,
      message: achievementId ? 'Achievement check queued successfully' : 'All achievement checks queued successfully',
      note: 'Achievement processing system is under development'
    })

  } catch (error) {
    console.error('Error checking achievement progress:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to check achievement progress'
    })
  }
})

// Get user's achievement history
router.get('/history', async (req, res) => {
  try {
    const userId = parseInt(req.user.userId)
    const { limit = 50, offset = 0 } = req.query

    const history = await prisma.$queryRaw`
      SELECT 
        ah.history_id,
        ah.achievement_id,
        ah.action,
        ah.previous_progress,
        ah.new_progress,
        ah.points_change,
        ah.trigger_event,
        ah.created_at,
        a.name as achievement_name,
        a.tier
      FROM achievement_history ah
      INNER JOIN achievements a ON ah.achievement_id = a.achievement_id
      WHERE ah.user_id = ${userId}
      ORDER BY ah.created_at DESC
      OFFSET ${parseInt(offset)} ROWS
      FETCH NEXT ${parseInt(limit)} ROWS ONLY
    `

    const serializedHistory = history.map(entry => ({
      ...entry,
      history_id: Number(entry.history_id),
      achievement_id: Number(entry.achievement_id)
    }))

    res.json({
      success: true,
      history: serializedHistory,
      pagination: {
        offset: parseInt(offset),
        limit: parseInt(limit),
        hasMore: serializedHistory.length === parseInt(limit)
      }
    })

  } catch (error) {
    console.error('Error fetching achievement history:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch achievement history'
    })
  }
})

// Get user's streak information
router.get('/streaks', async (req, res) => {
  try {
    const userId = parseInt(req.user.userId)

    const streaks = await prisma.$queryRaw`
      SELECT 
        streak_type,
        current_count,
        longest_count,
        last_activity_date,
        streak_start_date,
        is_active
      FROM user_streaks
      WHERE user_id = ${userId}
      ORDER BY longest_count DESC
    `

    res.json({
      success: true,
      streaks
    })

  } catch (error) {
    console.error('Error fetching user streaks:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch streak information'
    })
  }
})

// Get user's notifications
router.get('/notifications', async (req, res) => {
  try {
    const userId = parseInt(req.user.userId)
    const { unread_only = 'false', limit = 20 } = req.query

    let notifications
    if (unread_only === 'true') {
      notifications = await prisma.$queryRaw`
        SELECT TOP (${parseInt(limit)})
          notification_id,
          achievement_id,
          notification_type,
          title,
          message,
          icon_url,
          points_awarded,
          is_sent,
          is_read,
          created_at,
          sent_at,
          read_at
        FROM achievement_notifications
        WHERE user_id = ${userId} AND is_read = 0
        ORDER BY created_at DESC
      `
    } else {
      notifications = await prisma.$queryRaw`
        SELECT TOP (${parseInt(limit)})
          notification_id,
          achievement_id,
          notification_type,
          title,
          message,
          icon_url,
          points_awarded,
          is_sent,
          is_read,
          created_at,
          sent_at,
          read_at
        FROM achievement_notifications
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
      `
    }

    const serializedNotifications = notifications.map(notification => ({
      ...notification,
      notification_id: Number(notification.notification_id),
      achievement_id: notification.achievement_id ? Number(notification.achievement_id) : null
    }))

    res.json({
      success: true,
      notifications: serializedNotifications
    })

  } catch (error) {
    console.error('Error fetching achievement notifications:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications'
    })
  }
})

// Mark notification as read
router.put('/notifications/:id/read', async (req, res) => {
  try {
    const userId = parseInt(req.user.userId)
    const { id } = req.params

    await prisma.$queryRaw`
      UPDATE achievement_notifications
      SET is_read = 1, read_at = GETDATE()
      WHERE notification_id = ${parseInt(id)} AND user_id = ${userId}
    `

    res.json({
      success: true,
      message: 'Notification marked as read'
    })

  } catch (error) {
    console.error('Error marking notification as read:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read'
    })
  }
})

// Mark all notifications as read
router.put('/notifications/mark-all-read', async (req, res) => {
  try {
    const userId = parseInt(req.user.userId)

    await prisma.$queryRaw`
      UPDATE achievement_notifications
      SET is_read = 1, read_at = GETDATE()
      WHERE user_id = ${userId} AND is_read = 0
    `

    res.json({
      success: true,
      message: 'All notifications marked as read'
    })

  } catch (error) {
    console.error('Error marking all notifications as read:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to mark notifications as read'
    })
  }
})

module.exports = router