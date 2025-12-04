const express = require('express')
const router = express.Router()
const { authMiddleware: authenticateToken } = require('../middleware/auth')
const prisma = require('../config/prisma')

// Get notifications for the authenticated user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const { limit = 20, offset = 0 } = req.query

    const notifications = await prisma.$queryRaw`
      SELECT 
        notification_id,
        notification_type,
        title,
        message,
        related_comment_id,
        related_user_id,
        item_type,
        item_id,
        is_read,
        created_at
      FROM user_notifications
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      OFFSET ${parseInt(offset)} ROWS
      FETCH NEXT ${parseInt(limit)} ROWS ONLY
    `

    // Get total count for pagination
    const countResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM user_notifications
      WHERE user_id = ${userId}
    `

    // Serialize BigInt fields
    const serializedNotifications = notifications.map(n => ({
      ...n,
      notification_id: Number(n.notification_id),
      related_comment_id: n.related_comment_id ? Number(n.related_comment_id) : null,
      related_user_id: n.related_user_id ? Number(n.related_user_id) : null,
      item_id: n.item_id ? Number(n.item_id) : null
    }))

    res.json({
      notifications: serializedNotifications,
      total: Number(countResult[0].total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    })
  } catch (error) {
    console.error('Error fetching notifications:', error)
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      meta: error.meta
    })
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Get unread notifications count
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)

    const result = await prisma.$queryRaw`
      SELECT COUNT(*) as count
      FROM user_notifications
      WHERE user_id = ${userId} AND is_read = 0
    `

    res.json({
      count: Number(result[0].count)
    })
  } catch (error) {
    console.error('Error fetching unread count:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch unread count',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Mark a notification as read
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const notificationId = BigInt(req.params.id)

    // Verify ownership
    const notification = await prisma.$queryRaw`
      SELECT notification_id
      FROM user_notifications
      WHERE notification_id = ${notificationId} AND user_id = ${userId}
    `

    if (!notification || notification.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      })
    }

    // Mark as read
    await prisma.$queryRaw`
      UPDATE user_notifications
      SET is_read = 1
      WHERE notification_id = ${notificationId} AND user_id = ${userId}
    `

    res.json({
      success: true,
      message: 'Notification marked as read'
    })
  } catch (error) {
    console.error('Error marking notification as read:', error)
    res.status(500).json({ 
      success: false, 
      message: 'Failed to mark notification as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Mark all notifications as read
router.put('/mark-all-read', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)

    const result = await prisma.$queryRaw`
      UPDATE user_notifications
      SET is_read = 1
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
      message: 'Failed to mark all notifications as read',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Delete all read notifications (MUST come before /:id to avoid route collision)
router.delete('/clear-read', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)

    const result = await prisma.$queryRaw`
      DELETE FROM user_notifications
      WHERE user_id = ${userId} AND is_read = 1
    `

    res.json({
      success: true,
      message: 'Read notifications cleared'
    })
  } catch (error) {
    console.error('Error clearing read notifications:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to clear read notifications',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Delete a notification
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const userId = BigInt(req.user.userId)
    const notificationId = BigInt(req.params.id)

    // Verify ownership and delete
    const result = await prisma.$queryRaw`
      DELETE FROM user_notifications
      WHERE notification_id = ${notificationId} AND user_id = ${userId}
    `

    res.json({
      success: true,
      message: 'Notification deleted'
    })
  } catch (error) {
    console.error('Error deleting notification:', error)
    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    })
  }
})

// Create a test notification (for development)
if (process.env.NODE_ENV === 'development') {
  router.post('/test', authenticateToken, async (req, res) => {
    try {
      const userId = BigInt(req.user.userId)
      const { title, message, type = 'info' } = req.body

      await prisma.$queryRaw`
        INSERT INTO user_notifications (
          user_id, 
          notification_type, 
          title, 
          message, 
          created_at
        )
        VALUES (
          ${userId},
          ${type},
          ${title || 'Test Notification'},
          ${message || 'This is a test notification'},
          GETDATE()
        )
      `

      res.json({
        success: true,
        message: 'Test notification created'
      })
    } catch (error) {
      console.error('Error creating test notification:', error)
      res.status(500).json({ 
        success: false, 
        message: 'Failed to create test notification',
        error: error.message
      })
    }
  })
}

module.exports = router