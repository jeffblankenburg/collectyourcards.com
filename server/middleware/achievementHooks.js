const achievementEngine = require('../services/achievementEngine')

/**
 * Achievement Hooks Middleware
 * 
 * This middleware automatically triggers achievement checks when users
 * perform actions that could affect their achievement progress.
 */

/**
 * Hook for when a user adds a card to their collection
 * This should be called after successful card addition
 */
async function onCardAdded(req, res, next) {
  if (!req.user || !req.user.user_id) {
    return next()
  }

  // Extract card data from request or response
  const cardData = {
    cardId: req.body.card_id || req.cardId,
    isRookie: req.body.is_rookie || req.cardData?.is_rookie,
    isAutograph: req.body.is_autograph || req.cardData?.is_autograph,
    isRelic: req.body.is_relic || req.cardData?.is_relic,
    purchasePrice: req.body.purchase_price,
    estimatedValue: req.body.estimated_value
  }

  try {
    // Trigger achievement check asynchronously (don't block the response)
    setImmediate(async () => {
      try {
        await achievementEngine.checkUserAchievements(
          req.user.user_id, 
          'card_added', 
          cardData
        )
      } catch (error) {
        console.error('Achievement check failed for card_added:', error)
      }
    })
  } catch (error) {
    console.error('Achievement hook error (card_added):', error)
  }

  next()
}

/**
 * Hook for when a user removes a card from their collection
 */
async function onCardRemoved(req, res, next) {
  if (!req.user || !req.user.user_id) {
    return next()
  }

  const cardData = {
    cardId: req.params.id || req.cardId,
    userCardId: req.params.userCardId || req.userCardId
  }

  try {
    setImmediate(async () => {
      try {
        await achievementEngine.checkUserAchievements(
          req.user.user_id, 
          'card_removed', 
          cardData
        )
      } catch (error) {
        console.error('Achievement check failed for card_removed:', error)
      }
    })
  } catch (error) {
    console.error('Achievement hook error (card_removed):', error)
  }

  next()
}

/**
 * Hook for when a user updates a card in their collection
 */
async function onCardUpdated(req, res, next) {
  if (!req.user || !req.user.user_id) {
    return next()
  }

  const cardData = {
    cardId: req.body.card_id || req.cardId,
    userCardId: req.params.id || req.userCardId,
    oldValues: req.oldCardValues, // Should be populated by route handler
    newValues: req.body
  }

  try {
    setImmediate(async () => {
      try {
        await achievementEngine.checkUserAchievements(
          req.user.user_id, 
          'card_updated', 
          cardData
        )
      } catch (error) {
        console.error('Achievement check failed for card_updated:', error)
      }
    })
  } catch (error) {
    console.error('Achievement hook error (card_updated):', error)
  }

  next()
}

/**
 * Hook for when a user adds a comment
 */
async function onCommentAdded(req, res, next) {
  if (!req.user || !req.user.user_id) {
    return next()
  }

  const commentData = {
    commentId: req.commentId,
    itemType: req.params.type || req.body.comment_type,
    itemId: req.params.itemId || req.body.item_id,
    commentText: req.body.comment_text
  }

  try {
    setImmediate(async () => {
      try {
        await achievementEngine.checkUserAchievements(
          req.user.user_id, 
          'comment_added', 
          commentData
        )
      } catch (error) {
        console.error('Achievement check failed for comment_added:', error)
      }
    })
  } catch (error) {
    console.error('Achievement hook error (comment_added):', error)
  }

  next()
}

/**
 * Hook for user login events
 * This should be called after successful authentication
 */
async function onUserLogin(req, res, next) {
  if (!req.user || !req.user.user_id) {
    return next()
  }

  try {
    setImmediate(async () => {
      try {
        await achievementEngine.checkUserAchievements(
          req.user.user_id, 
          'login',
          {
            loginTime: new Date(),
            ipAddress: req.ip,
            userAgent: req.get('User-Agent')
          }
        )
      } catch (error) {
        console.error('Achievement check failed for login:', error)
      }
    })
  } catch (error) {
    console.error('Achievement hook error (login):', error)
  }

  next()
}

/**
 * Utility function to manually trigger achievement checks
 * This can be called from route handlers when needed
 */
async function triggerAchievementCheck(userId, eventType, eventData = {}) {
  try {
    await achievementEngine.checkUserAchievements(userId, eventType, eventData)
  } catch (error) {
    console.error(`Achievement check failed for ${eventType}:`, error)
    throw error
  }
}

/**
 * Utility function to check specific achievement for user
 */
async function checkSpecificAchievement(userId, achievementId) {
  try {
    // Get the specific achievement
    const achievementQuery = `
      SELECT achievement_id, name, description, points, tier, requirement_type, 
             requirement_value, requirement_query, is_repeatable, cooldown_days, icon_url
      FROM achievements 
      WHERE achievement_id = @achievementId AND is_active = 1
    `
    
    const result = await global.sql.query(achievementQuery, [
      { name: 'achievementId', type: 'bigint', value: achievementId }
    ])

    if (result.recordset.length === 0) {
      throw new Error('Achievement not found')
    }

    const achievement = {
      ...result.recordset[0],
      achievement_id: Number(result.recordset[0].achievement_id)
    }

    await achievementEngine.checkSingleAchievement(userId, achievement, 'manual_check', {})
    await achievementEngine.updateUserAchievementStats(userId)

  } catch (error) {
    console.error('Specific achievement check failed:', error)
    throw error
  }
}

/**
 * Batch check all achievements for a user
 * Use this sparingly as it can be expensive
 */
async function checkAllUserAchievements(userId) {
  try {
    await achievementEngine.checkUserAchievements(userId, 'manual_check', {})
  } catch (error) {
    console.error('Batch achievement check failed:', error)
    throw error
  }
}

module.exports = {
  // Middleware hooks
  onCardAdded,
  onCardRemoved, 
  onCardUpdated,
  onCommentAdded,
  onUserLogin,
  
  // Utility functions
  triggerAchievementCheck,
  checkSpecificAchievement,
  checkAllUserAchievements
}