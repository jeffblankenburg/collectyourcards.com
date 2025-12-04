/**
 * Admin Moderation Routes
 * Handles comment moderation, user muting, and content management
 */

const express = require('express')
const router = express.Router()
const prisma = require('../config/prisma')
const { authMiddleware, requireAdmin } = require('../middleware/auth')

// GET /api/admin/moderation/recent-comments - Get recent comments for moderation (last 7 days)
router.get('/recent-comments', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 1000 } = req.query // High limit to get all comments from last 7 days
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    // Get comments from last 7 days with proper entity names
    const recentComments = await prisma.$queryRaw`
      SELECT 
        c.comment_id,
        c.comment_text,
        c.comment_type,
        c.item_id,
        c.comment_status,
        c.created_at,
        c.updated_at,
        c.is_edited,
        u.user_id,
        u.username,
        u.email,
        u.first_name,
        u.last_name,
        u.is_muted,
        u.avatar_url,
        -- Get actual entity names
        CASE 
          WHEN c.comment_type = 'series' THEN s.name
          WHEN c.comment_type = 'set' THEN set_table.name
          WHEN c.comment_type = 'card' THEN CONCAT(
            COALESCE(card_series.name, 'Unknown Series'), 
            CASE WHEN card_info.card_number IS NOT NULL 
                 THEN ' #' + CAST(card_info.card_number AS NVARCHAR) 
                 ELSE '' 
            END,
            CASE WHEN COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, '') != ' ' 
                 THEN ' - ' + COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, '') 
                 ELSE '' 
            END
          )
          ELSE 'Unknown'
        END as entity_name,
        -- Generate proper slugs for navigation
        CASE 
          WHEN c.comment_type = 'series' AND s.name IS NOT NULL THEN 
            LOWER(REPLACE(REPLACE(REPLACE(s.name, ' ', '-'), '''', ''), '/', '-'))
          WHEN c.comment_type = 'set' AND set_table.name IS NOT NULL THEN 
            LOWER(REPLACE(REPLACE(REPLACE(set_table.name, ' ', '-'), '''', ''), '/', '-'))
          WHEN c.comment_type = 'card' AND p.first_name IS NOT NULL AND p.last_name IS NOT NULL THEN 
            LOWER(REPLACE(REPLACE(p.first_name + '-' + p.last_name, ' ', '-'), '''', ''))
          ELSE NULL
        END as entity_slug,
        -- Additional card-specific data for URL construction
        CASE WHEN c.comment_type = 'card' THEN card_info.card_number ELSE NULL END as card_number,
        CASE WHEN c.comment_type = 'card' AND sets_from_card.name IS NOT NULL THEN 
          LOWER(REPLACE(REPLACE(REPLACE(sets_from_card.name, ' ', '-'), '''', ''), '/', '-'))
        ELSE NULL END as card_set_slug,
        -- Get proper years for URL construction
        CASE 
          WHEN c.comment_type = 'series' THEN COALESCE(sets_from_series.year, YEAR(sets_from_series.created))
          WHEN c.comment_type = 'set' THEN COALESCE(set_table.year, YEAR(set_table.created))
          WHEN c.comment_type = 'card' THEN COALESCE(sets_from_card.year, YEAR(sets_from_card.created))
          ELSE NULL
        END as entity_year
      FROM universal_comments c
      JOIN [user] u ON c.user_id = u.user_id
      -- Join for series comments
      LEFT JOIN series s ON c.comment_type = 'series' AND c.item_id = s.series_id
      LEFT JOIN [set] sets_from_series ON s.[set] = sets_from_series.set_id
      -- Join for set comments
      LEFT JOIN [set] set_table ON c.comment_type = 'set' AND c.item_id = set_table.set_id
      -- Join for card comments (get the card, then its series, then the set)
      LEFT JOIN card card_info ON c.comment_type = 'card' AND c.item_id = card_info.card_id
      LEFT JOIN series card_series ON card_info.series = card_series.series_id
      LEFT JOIN [set] sets_from_card ON card_series.[set] = sets_from_card.set_id
      -- Get player info for cards (just the first player for simplicity)
      LEFT JOIN card_player_team cpt ON card_info.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id  
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE c.created_at >= DATEADD(day, -7, GETDATE())
        AND c.comment_status IN ('visible', 'pending_review')
        AND c.is_deleted = 0
      ORDER BY c.created_at DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${parseInt(limit)} ROWS ONLY
    `
    
    // Get total count
    const totalResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM universal_comments
      WHERE created_at >= DATEADD(day, -7, GETDATE())
        AND comment_status IN ('visible', 'pending_review')
        AND is_deleted = 0
    `
    
    const total = Number(totalResult[0].total)
    
    // Serialize BigInt values and format response
    const serializedComments = recentComments.map(comment => ({
      comment_id: Number(comment.comment_id),
      comment_text: comment.comment_text,
      comment_type: comment.comment_type,
      item_id: Number(comment.item_id),
      comment_status: comment.comment_status,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      is_edited: comment.is_edited,
      entity_name: comment.entity_name,
      entity_slug: comment.entity_slug,
      entity_year: comment.entity_year,
      card_number: comment.card_number,
      card_set_slug: comment.card_set_slug,
      user: {
        user_id: Number(comment.user_id),
        username: comment.username,
        email: comment.email,
        first_name: comment.first_name,
        last_name: comment.last_name,
        is_muted: comment.is_muted,
        avatar_url: comment.avatar_url
      }
    }))
    
    res.json({
      comments: serializedComments,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
    
  } catch (error) {
    console.error('Error fetching recent comments:', error)
    res.status(500).json({ error: 'Failed to fetch recent comments' })
  }
})

// DELETE /api/admin/moderation/comments/:commentId - Delete comment (admin only)
router.delete('/comments/:commentId', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { commentId } = req.params
    const adminUserId = req.user.user_id
    
    const commentIdNumber = parseInt(commentId)
    if (isNaN(commentIdNumber)) {
      return res.status(400).json({ error: 'Invalid comment ID' })
    }
    
    // Check if comment exists
    const existingComment = await prisma.$queryRaw`
      SELECT comment_id, user_id, comment_text
      FROM universal_comments
      WHERE comment_id = ${commentIdNumber} AND comment_status != 'deleted'
    `
    
    if (existingComment.length === 0) {
      return res.status(404).json({ error: 'Comment not found' })
    }
    
    // Soft delete the comment with admin tracking
    await prisma.$executeRaw`
      UPDATE universal_comments
      SET comment_status = 'deleted',
          deleted_at = GETDATE(),
          deleted_by = ${Number(adminUserId)},
          updated_at = GETDATE()
      WHERE comment_id = ${commentIdNumber}
    `
    
    // Log the moderation action
    console.log(`Admin moderation: Comment ${commentIdNumber} deleted by admin ${adminUserId}`, {
      comment_text: existingComment[0].comment_text?.substring(0, 100) + '...',
      original_author: Number(existingComment[0].user_id),
      admin_id: Number(adminUserId),
      timestamp: new Date().toISOString()
    })
    
    res.json({ 
      message: 'Comment deleted successfully',
      comment_id: commentIdNumber
    })
    
  } catch (error) {
    console.error('Error deleting comment:', error)
    res.status(500).json({ error: 'Failed to delete comment' })
  }
})

// POST /api/admin/moderation/users/:userId/mute - Mute user (admin only)
router.post('/users/:userId/mute', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params
    const { reason, duration_hours = 24 } = req.body
    const adminUserId = req.user.user_id
    
    const userIdNumber = parseInt(userId)
    if (isNaN(userIdNumber)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }
    
    // Check if user exists
    const existingUser = await prisma.$queryRaw`
      SELECT user_id, username, email, is_muted
      FROM [user]
      WHERE user_id = ${userIdNumber} AND is_active = 1
    `
    
    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const user = existingUser[0]
    
    if (user.is_muted) {
      return res.status(400).json({ error: 'User is already muted' })
    }
    
    // Mute the user
    await prisma.$executeRaw`
      UPDATE [user]
      SET is_muted = 1,
          muted_at = GETDATE(),
          muted_by = ${Number(adminUserId)}
      WHERE user_id = ${userIdNumber}
    `
    
    // Log the moderation action
    console.log(`Admin moderation: User ${userIdNumber} muted by admin ${adminUserId}`, {
      username: user.username,
      email: user.email,
      reason: reason || 'No reason provided',
      duration_hours: duration_hours,
      admin_id: Number(adminUserId),
      timestamp: new Date().toISOString()
    })
    
    res.json({ 
      message: 'User muted successfully',
      user_id: userIdNumber,
      muted_at: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('Error muting user:', error)
    res.status(500).json({ error: 'Failed to mute user' })
  }
})

// POST /api/admin/moderation/users/:userId/unmute - Unmute user (admin only)
router.post('/users/:userId/unmute', authMiddleware, requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params
    const adminUserId = req.user.user_id
    
    const userIdNumber = parseInt(userId)
    if (isNaN(userIdNumber)) {
      return res.status(400).json({ error: 'Invalid user ID' })
    }
    
    // Check if user exists and is muted
    const existingUser = await prisma.$queryRaw`
      SELECT user_id, username, email, is_muted
      FROM [user]
      WHERE user_id = ${userIdNumber} AND is_active = 1
    `
    
    if (existingUser.length === 0) {
      return res.status(404).json({ error: 'User not found' })
    }
    
    const user = existingUser[0]
    
    if (!user.is_muted) {
      return res.status(400).json({ error: 'User is not currently muted' })
    }
    
    // Unmute the user
    await prisma.$executeRaw`
      UPDATE [user]
      SET is_muted = 0,
          muted_at = NULL,
          muted_by = NULL
      WHERE user_id = ${userIdNumber}
    `
    
    // Log the moderation action
    console.log(`Admin moderation: User ${userIdNumber} unmuted by admin ${adminUserId}`, {
      username: user.username,
      email: user.email,
      admin_id: Number(adminUserId),
      timestamp: new Date().toISOString()
    })
    
    res.json({ 
      message: 'User unmuted successfully',
      user_id: userIdNumber
    })
    
  } catch (error) {
    console.error('Error unmuting user:', error)
    res.status(500).json({ error: 'Failed to unmute user' })
  }
})

// GET /api/admin/moderation/stats - Get moderation statistics
router.get('/stats', authMiddleware, requireAdmin, async (req, res) => {
  try {
    // Get various moderation statistics
    const stats = await prisma.$queryRaw`
      SELECT 
        -- Comment counts by status (last 7 days)
        (SELECT COUNT(*) FROM universal_comments 
         WHERE created_at >= DATEADD(day, -7, GETDATE()) 
         AND comment_status = 'visible' AND is_deleted = 0) as visible_comments_7d,
         
        (SELECT COUNT(*) FROM universal_comments 
         WHERE created_at >= DATEADD(day, -7, GETDATE()) 
         AND is_deleted = 1) as deleted_comments_7d,
         
        (SELECT COUNT(*) FROM universal_comments 
         WHERE created_at >= DATEADD(day, -7, GETDATE()) 
         AND comment_status = 'pending_review' AND is_deleted = 0) as pending_comments_7d,
         
        -- User stats
        (SELECT COUNT(*) FROM [user] WHERE is_muted = 1) as muted_users,
        
        -- Recent activity (last 24 hours)
        (SELECT COUNT(*) FROM universal_comments 
         WHERE created_at >= DATEADD(hour, -24, GETDATE()) AND is_deleted = 0) as comments_24h
    `
    
    const statsData = stats[0]
    
    res.json({
      comments: {
        visible_last_7_days: Number(statsData.visible_comments_7d),
        deleted_last_7_days: Number(statsData.deleted_comments_7d),
        pending_review: Number(statsData.pending_comments_7d),
        total_last_24_hours: Number(statsData.comments_24h)
      },
      users: {
        active: Number(statsData.active_users),
        muted: Number(statsData.muted_users),
        new_last_24_hours: Number(statsData.new_users_24h)
      }
    })
    
  } catch (error) {
    console.error('Error fetching moderation stats:', error)
    res.status(500).json({ error: 'Failed to fetch moderation statistics' })
  }
})

module.exports = router