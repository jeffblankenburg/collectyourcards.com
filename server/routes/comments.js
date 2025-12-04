const express = require('express')
const router = express.Router()
const prisma = require('../config/prisma')
const { authMiddleware } = require('../middleware/auth')
const { commentModerationMiddleware, mutedUserMiddleware } = require('../middleware/contentModeration')
const { onCommentAdded } = require('../middleware/achievementHooks')

// GET /api/comments/:type/:itemId - Get comments for a card/series/set
router.get('/:type/:itemId', async (req, res) => {
  try {
    const { type, itemId } = req.params
    const { page = 1, limit = 50 } = req.query
    
    // Validate comment type
    if (!['card', 'series', 'set', 'blog_post'].includes(type)) {
      return res.status(400).json({ error: 'Invalid comment type' })
    }
    
    const itemIdNumber = parseInt(itemId)
    if (isNaN(itemIdNumber)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    // Get comments with user information
    const comments = await prisma.$queryRaw`
      SELECT 
        c.comment_id,
        c.comment_text,
        c.parent_comment_id,
        c.created_at,
        c.updated_at,
        c.is_edited,
        u.user_id,
        u.username,
        u.first_name,
        u.last_name,
        u.avatar_url
      FROM universal_comments c
      JOIN [user] u ON c.user_id = u.user_id
      WHERE c.comment_type = ${type}
        AND c.item_id = ${itemIdNumber}
        AND c.is_deleted = 0
        AND c.comment_status = 'visible'
      ORDER BY c.created_at DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${parseInt(limit)} ROWS ONLY
    `
    
    // Get total count
    const totalResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM universal_comments
      WHERE comment_type = ${type}
        AND item_id = ${itemIdNumber}
        AND is_deleted = 0
        AND comment_status = 'visible'
    `
    
    const total = Number(totalResult[0].total)
    
    // Convert BigInt IDs to numbers
    const serializedComments = comments.map(comment => ({
      comment_id: Number(comment.comment_id),
      comment_text: comment.comment_text,
      parent_comment_id: comment.parent_comment_id ? Number(comment.parent_comment_id) : null,
      created_at: comment.created_at,
      updated_at: comment.updated_at,
      is_edited: comment.is_edited,
      user: {
        user_id: Number(comment.user_id),
        username: comment.username,
        display_name: comment.username, // Use username as display name
        avatar_url: comment.avatar_url,
        // Fallback for backwards compatibility
        first_name: comment.first_name,
        last_name: comment.last_name
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
    console.error('Error fetching comments:', error)
    res.status(500).json({ error: 'Failed to fetch comments' })
  }
})

// POST /api/comments/:type/:itemId - Add comment (authentication required)
router.post('/:type/:itemId', authMiddleware, mutedUserMiddleware, commentModerationMiddleware, async (req, res, next) => {
  try {
    const { type, itemId } = req.params
    const { comment_text, parent_comment_id } = req.body
    // Note: comment_text may have been filtered by contentModerationMiddleware
    const userId = req.user.userId
    
    // Validate input
    if (!['card', 'series', 'set', 'blog_post'].includes(type)) {
      return res.status(400).json({ error: 'Invalid comment type' })
    }
    
    const itemIdNumber = parseInt(itemId)
    if (isNaN(itemIdNumber)) {
      return res.status(400).json({ error: 'Invalid item ID' })
    }
    
    if (!comment_text || comment_text.trim().length < 1) {
      return res.status(400).json({ error: 'Comment text is required' })
    }
    
    if (comment_text.length > 5000) {
      return res.status(400).json({ error: 'Comment too long (max 5000 characters)' })
    }
    
    // Content moderation already handled by middleware
    
    // Validate parent comment if provided
    let parentCommentIdNumber = null
    if (parent_comment_id) {
      parentCommentIdNumber = parseInt(parent_comment_id)
      if (isNaN(parentCommentIdNumber)) {
        return res.status(400).json({ error: 'Invalid parent comment ID' })
      }
      
      // Verify parent comment exists and is for the same item
      const parentComment = await prisma.$queryRaw`
        SELECT comment_id FROM universal_comments
        WHERE comment_id = ${parentCommentIdNumber}
          AND comment_type = ${type}
          AND item_id = ${itemIdNumber}
          AND is_deleted = 0
      `
      
      if (parentComment.length === 0) {
        return res.status(400).json({ error: 'Parent comment not found' })
      }
    }
    
    // Insert comment
    const result = await prisma.$executeRaw`
      INSERT INTO universal_comments (user_id, comment_type, item_id, comment_text, parent_comment_id, comment_status)
      VALUES (${Number(userId)}, ${type}, ${itemIdNumber}, ${comment_text}, ${parentCommentIdNumber}, 'visible')
    `
    
    // Get the inserted comment with user info
    const newComment = await prisma.$queryRaw`
      SELECT TOP 1
        c.comment_id,
        c.comment_text,
        c.parent_comment_id,
        c.created_at,
        c.updated_at,
        c.is_edited,
        u.user_id,
        u.username,
        u.first_name,
        u.last_name
      FROM universal_comments c
      JOIN [user] u ON c.user_id = u.user_id
      WHERE c.user_id = ${Number(userId)}
        AND c.comment_type = ${type}
        AND c.item_id = ${itemIdNumber}
      ORDER BY c.created_at DESC
    `
    
    // Auto-subscribe user to this item for notifications
    try {
      await prisma.$executeRaw`
        IF NOT EXISTS (
          SELECT 1 FROM user_item_subscriptions 
          WHERE user_id = ${Number(userId)} 
            AND item_type = ${type} 
            AND item_id = ${itemIdNumber}
        )
        INSERT INTO user_item_subscriptions (user_id, item_type, item_id)
        VALUES (${Number(userId)}, ${type}, ${itemIdNumber})
      `
    } catch (subscriptionError) {
      console.error('Error creating subscription:', subscriptionError)
      // Don't fail the comment creation if subscription fails
    }
    
    if (newComment.length > 0) {
      const comment = newComment[0]
      
      // Store comment data for achievement hook
      req.commentId = Number(comment.comment_id)

      res.status(201).json({
        comment: {
          comment_id: Number(comment.comment_id),
          comment_text: comment.comment_text,
          parent_comment_id: comment.parent_comment_id ? Number(comment.parent_comment_id) : null,
          created_at: comment.created_at,
          updated_at: comment.updated_at,
          is_edited: comment.is_edited,
          user: {
            user_id: Number(comment.user_id),
            username: comment.username,
            display_name: comment.username, // Use username as display name
            first_name: comment.first_name,
            last_name: comment.last_name
          }
        }
      })

      // Call achievement hook after successful response
      next()
    } else {
      res.status(201).json({ message: 'Comment created successfully' })
      
      // Call achievement hook even without comment details
      next()
    }
    
  } catch (error) {
    console.error('Error creating comment:', error)
    res.status(500).json({ error: 'Failed to create comment' })
  }
}, onCommentAdded)

// PUT /api/comments/:commentId - Edit comment (authentication required, 15 minute window)
router.put('/:commentId', authMiddleware, mutedUserMiddleware, commentModerationMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params
    const { comment_text } = req.body
    const userId = req.user.userId
    
    const commentIdNumber = parseInt(commentId)
    if (isNaN(commentIdNumber)) {
      return res.status(400).json({ error: 'Invalid comment ID' })
    }
    
    if (!comment_text || comment_text.trim().length < 1) {
      return res.status(400).json({ error: 'Comment text is required' })
    }
    
    if (comment_text.length > 5000) {
      return res.status(400).json({ error: 'Comment too long (max 5000 characters)' })
    }
    
    // Content moderation already handled by middleware
    
    // Get existing comment
    const existingComment = await prisma.$queryRaw`
      SELECT comment_id, user_id, created_at, comment_text
      FROM universal_comments
      WHERE comment_id = ${commentIdNumber} AND is_deleted = 0
    `
    
    if (existingComment.length === 0) {
      return res.status(404).json({ error: 'Comment not found' })
    }
    
    const comment = existingComment[0]
    
    // Check ownership
    if (Number(comment.user_id) !== Number(userId)) {
      return res.status(403).json({ error: 'You can only edit your own comments' })
    }
    
    // Check 15-minute edit window
    const commentAge = Date.now() - new Date(comment.created_at).getTime()
    const fifteenMinutes = 15 * 60 * 1000
    
    if (commentAge > fifteenMinutes) {
      return res.status(400).json({ error: 'Comments can only be edited within 15 minutes of posting' })
    }
    
    // Don't update if text is the same
    if (comment.comment_text === comment_text) {
      return res.status(200).json({ message: 'No changes made' })
    }
    
    // Update comment
    await prisma.$executeRaw`
      UPDATE universal_comments
      SET comment_text = ${comment_text},
          updated_at = GETDATE(),
          is_edited = 1
      WHERE comment_id = ${commentIdNumber}
    `
    
    res.json({ message: 'Comment updated successfully' })
    
  } catch (error) {
    console.error('Error updating comment:', error)
    res.status(500).json({ error: 'Failed to update comment' })
  }
})

// DELETE /api/comments/:commentId - Delete comment (authentication required)
router.delete('/:commentId', authMiddleware, async (req, res) => {
  try {
    const { commentId } = req.params
    const userId = req.user.userId
    
    const commentIdNumber = parseInt(commentId)
    if (isNaN(commentIdNumber)) {
      return res.status(400).json({ error: 'Invalid comment ID' })
    }
    
    // Get existing comment
    const existingComment = await prisma.$queryRaw`
      SELECT comment_id, user_id
      FROM universal_comments
      WHERE comment_id = ${commentIdNumber} AND is_deleted = 0
    `
    
    if (existingComment.length === 0) {
      return res.status(404).json({ error: 'Comment not found' })
    }
    
    const comment = existingComment[0]
    
    // Check ownership (or admin role)
    const isOwner = Number(comment.user_id) === Number(userId)
    const isAdmin = req.user.role && ['admin', 'superadmin', 'data_admin'].includes(req.user.role)
    
    if (!isOwner && !isAdmin) {
      return res.status(403).json({ error: 'You can only delete your own comments' })
    }
    
    // Soft delete comment with audit trail
    await prisma.$executeRaw`
      UPDATE universal_comments
      SET is_deleted = 1,
          deleted_at = GETDATE(),
          deleted_by = ${Number(userId)},
          updated_at = GETDATE()
      WHERE comment_id = ${commentIdNumber}
    `
    
    res.json({ message: 'Comment deleted successfully' })
    
  } catch (error) {
    console.error('Error deleting comment:', error)
    res.status(500).json({ error: 'Failed to delete comment' })
  }
})

// GET /api/comments/set/:setId/activity - Get activity feed for a set (comments from series/cards within set)
router.get('/set/:setId/activity', async (req, res) => {
  try {
    const { setId } = req.params
    const { page = 1, limit = 20 } = req.query
    
    const setIdNumber = parseInt(setId)
    if (isNaN(setIdNumber)) {
      return res.status(400).json({ error: 'Invalid set ID' })
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    // Get comments from series and cards within this set
    const activities = await prisma.$queryRaw`
      SELECT 
        c.comment_id,
        c.comment_text,
        c.comment_type,
        c.item_id,
        c.created_at,
        c.updated_at,
        c.is_edited,
        u.user_id,
        u.username,
        u.avatar_url,
        -- Context information based on comment type
        CASE 
          WHEN c.comment_type = 'series' THEN s.name
          WHEN c.comment_type = 'card' THEN CONCAT(
            COALESCE(card_series.name, ''), 
            CASE WHEN card_info.card_number IS NOT NULL THEN ' #' + card_info.card_number ELSE '' END,
            CASE WHEN COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, '') != ' ' 
                 THEN ' - ' + COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, '') 
                 ELSE '' END
          )
          ELSE 'Unknown'
        END as context_name,
        c.comment_type as activity_type,
        c.item_id as target_id
      FROM universal_comments c
      JOIN [user] u ON c.user_id = u.user_id
      -- Join for series comments
      LEFT JOIN series s ON c.comment_type = 'series' AND c.item_id = s.series_id AND s.[set] = ${setIdNumber}
      -- Join for card comments (more complex - need to get the card's series which belongs to our set)
      LEFT JOIN card card_info ON c.comment_type = 'card' AND c.item_id = card_info.card_id
      LEFT JOIN series card_series ON card_info.series = card_series.series_id AND card_series.[set] = ${setIdNumber}
      LEFT JOIN card_player_team cpt ON card_info.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE c.is_deleted = 0
        AND (
          -- Series comments for this set
          (c.comment_type = 'series' AND s.series_id IS NOT NULL)
          OR
          -- Card comments for cards in series within this set
          (c.comment_type = 'card' AND card_series.series_id IS NOT NULL)
        )
      ORDER BY c.created_at DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${parseInt(limit)} ROWS ONLY
    `
    
    // Get total count for pagination
    const totalResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM universal_comments c
      -- Join for series comments
      LEFT JOIN series s ON c.comment_type = 'series' AND c.item_id = s.series_id AND s.[set] = ${setIdNumber}
      -- Join for card comments
      LEFT JOIN card card_info ON c.comment_type = 'card' AND c.item_id = card_info.card_id
      LEFT JOIN series card_series ON card_info.series = card_series.series_id AND card_series.[set] = ${setIdNumber}
      WHERE c.is_deleted = 0
        AND (
          (c.comment_type = 'series' AND s.series_id IS NOT NULL)
          OR
          (c.comment_type = 'card' AND card_series.series_id IS NOT NULL)
        )
    `
    
    const total = Number(totalResult[0].total)
    
    // Transform results for consistent format
    const serializedActivities = activities.map(activity => ({
      comment_id: Number(activity.comment_id),
      comment_text: activity.comment_text,
      activity_type: activity.activity_type, // 'series' or 'card'
      target_id: Number(activity.target_id),
      context_name: activity.context_name,
      created_at: activity.created_at,
      updated_at: activity.updated_at,
      is_edited: activity.is_edited,
      user: {
        user_id: Number(activity.user_id),
        username: activity.username,
        display_name: activity.username,
        avatar_url: activity.avatar_url
      }
    }))
    
    res.json({
      activities: serializedActivities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
    
  } catch (error) {
    console.error('Error fetching set activity feed:', error)
    res.status(500).json({ error: 'Failed to fetch set activity feed' })
  }
})

// GET /api/comments/series/:seriesId/activity - Get activity feed for a series (comments from cards within series)
router.get('/series/:seriesId/activity', async (req, res) => {
  try {
    const { seriesId } = req.params
    const { page = 1, limit = 20 } = req.query
    
    const seriesIdNumber = parseInt(seriesId)
    if (isNaN(seriesIdNumber)) {
      return res.status(400).json({ error: 'Invalid series ID' })
    }
    
    const offset = (parseInt(page) - 1) * parseInt(limit)
    
    // Get comments from cards within this series
    const activities = await prisma.$queryRaw`
      SELECT 
        c.comment_id,
        c.comment_text,
        c.comment_type,
        c.item_id,
        c.created_at,
        c.updated_at,
        c.is_edited,
        u.user_id,
        u.username,
        u.avatar_url,
        -- Context information for card comments
        CONCAT(
          COALESCE(card_info.card_number, ''), 
          CASE WHEN COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, '') != ' ' 
               THEN ' - ' + COALESCE(p.first_name, '') + ' ' + COALESCE(p.last_name, '') 
               ELSE '' END
        ) as context_name,
        'card' as activity_type,
        c.item_id as target_id
      FROM universal_comments c
      JOIN [user] u ON c.user_id = u.user_id
      JOIN card card_info ON c.comment_type = 'card' AND c.item_id = card_info.card_id
      LEFT JOIN card_player_team cpt ON card_info.card_id = cpt.card
      LEFT JOIN player_team pt ON cpt.player_team = pt.player_team_id
      LEFT JOIN player p ON pt.player = p.player_id
      WHERE c.is_deleted = 0
        AND c.comment_type = 'card'
        AND card_info.series = ${seriesIdNumber}
      ORDER BY c.created_at DESC
      OFFSET ${offset} ROWS
      FETCH NEXT ${parseInt(limit)} ROWS ONLY
    `
    
    // Get total count for pagination
    const totalResult = await prisma.$queryRaw`
      SELECT COUNT(*) as total
      FROM universal_comments c
      JOIN card card_info ON c.comment_type = 'card' AND c.item_id = card_info.card_id
      WHERE c.is_deleted = 0
        AND c.comment_type = 'card'
        AND card_info.series = ${seriesIdNumber}
    `
    
    const total = Number(totalResult[0]?.total || 0)
    
    // Serialize BigInt values
    const serializedActivities = activities.map(activity => ({
      comment_id: Number(activity.comment_id),
      comment_text: activity.comment_text,
      comment_type: activity.comment_type,
      item_id: Number(activity.item_id),
      created_at: activity.created_at,
      updated_at: activity.updated_at,
      is_edited: activity.is_edited,
      context_name: activity.context_name,
      activity_type: activity.activity_type,
      target_id: Number(activity.target_id),
      user: {
        user_id: Number(activity.user_id),
        username: activity.username,
        avatar_url: activity.avatar_url
      }
    }))
    
    res.json({
      activities: serializedActivities,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    })
    
  } catch (error) {
    console.error('Error fetching series activity feed:', error)
    res.status(500).json({ error: 'Failed to fetch series activity feed' })
  }
})

module.exports = router