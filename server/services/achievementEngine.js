const prisma = require('../config/prisma')
const { sql, getPool } = require('../config/mssql')

/**
 * Achievement Calculation Engine
 *
 * This service handles real-time achievement progress tracking and unlocking.
 * It hooks into user collection actions (card additions, removals, updates)
 * to automatically calculate and update achievement progress.
 */
class AchievementEngine {
  constructor() {
    this.prisma = prisma
  }

  /**
   * Get or create SQL connection pool
   */
  async getSqlPool() {
    return await getPool()
  }

  /**
   * Main entry point for checking achievements after user collection changes
   * @param {number} userId - User ID who made the collection change
   * @param {string} triggerEvent - What triggered this check ('card_added', 'card_removed', 'card_updated', etc.)
   * @param {object} eventData - Additional data about the trigger event
   */
  async checkUserAchievements(userId, triggerEvent = 'manual_check', eventData = {}) {
    try {
      console.log(`🏆 Achievement Engine: Checking achievements for user ${userId} (trigger: ${triggerEvent})`)

      // Get all active achievements that might be affected by this trigger
      const relevantAchievements = await this.getRelevantAchievements(triggerEvent)
      
      if (relevantAchievements.length === 0) {
        console.log('🏆 No relevant achievements found for trigger:', triggerEvent)
        return
      }

      console.log(`🏆 Found ${relevantAchievements.length} relevant achievements to check`)

      // Check each achievement for progress/completion
      for (const achievement of relevantAchievements) {
        await this.checkSingleAchievement(userId, achievement, triggerEvent, eventData)
      }

      // Update user's achievement statistics
      await this.updateUserAchievementStats(userId)

      // Update user streaks if applicable
      if (this.isStreakEvent(triggerEvent)) {
        await this.updateUserStreaks(userId, triggerEvent)
      }

      console.log(`✅ Achievement check completed for user ${userId}`)

    } catch (error) {
      console.error('❌ Achievement Engine Error:', error)
      throw error
    }
  }

  /**
   * Check a single achievement for a user
   */
  async checkSingleAchievement(userId, achievement, triggerEvent, eventData) {
    try {
      // Get current user progress for this achievement
      const currentProgress = await this.getCurrentProgress(userId, achievement.achievement_id)
      
      // Skip if already completed and not repeatable
      if (currentProgress.is_completed && !achievement.is_repeatable) {
        return
      }

      // Check cooldown for repeatable achievements
      if (achievement.is_repeatable && achievement.cooldown_days > 0) {
        const daysSinceCompletion = await this.getDaysSinceLastCompletion(userId, achievement.achievement_id)
        if (daysSinceCompletion < achievement.cooldown_days) {
          return // Still in cooldown
        }
      }

      // Calculate new progress using the achievement's requirement query
      const newProgress = await this.calculateProgress(userId, achievement)
      
      if (newProgress === null) {
        console.warn(`⚠️ Could not calculate progress for achievement ${achievement.achievement_id}: ${achievement.name}`)
        return
      }

      // Calculate progress percentage
      const progressPercentage = Math.min(100, (newProgress / achievement.requirement_value) * 100)
      const isCompleted = newProgress >= achievement.requirement_value

      // Only update if progress has changed
      if (newProgress !== currentProgress.progress || isCompleted !== currentProgress.is_completed) {
        await this.updateAchievementProgress(
          userId, 
          achievement.achievement_id, 
          currentProgress.progress,
          newProgress, 
          progressPercentage,
          isCompleted,
          triggerEvent,
          achievement
        )

        console.log(`🏆 Updated achievement "${achievement.name}": ${newProgress}/${achievement.requirement_value} (${progressPercentage.toFixed(1)}%)${isCompleted ? ' ✅ COMPLETED!' : ''}`)
      }

    } catch (error) {
      console.error(`❌ Error checking achievement ${achievement.achievement_id}:`, error)
    }
  }

  /**
   * Calculate current progress for an achievement using its requirement query
   */
  async calculateProgress(userId, achievement) {
    try {
      if (!achievement.requirement_query) {
        console.warn(`Achievement ${achievement.achievement_id} has no requirement query`)
        return null
      }

      // Replace @user_id parameter in the query
      const query = achievement.requirement_query.replace(/@user_id/g, `${userId}`)

      // Execute the query
      const pool = await this.getSqlPool()
      const result = await pool.request().query(query)

      if (result.recordset.length === 0) {
        return 0
      }

      // Get the first numeric value from the result
      const firstRow = result.recordset[0]
      const firstValue = Object.values(firstRow)[0]

      return Number(firstValue) || 0

    } catch (error) {
      console.error('Error calculating progress:', error)
      return null
    }
  }

  /**
   * Get current user progress for an achievement
   */
  async getCurrentProgress(userId, achievementId) {
    const query = `
      SELECT
        progress,
        progress_percentage,
        is_completed,
        completed_at,
        times_completed
      FROM user_achievements
      WHERE user_id = @userId AND achievement_id = @achievementId
    `

    const pool = await this.getSqlPool()
    const request = pool.request()
    request.input('userId', sql.BigInt, userId)
    request.input('achievementId', sql.BigInt, achievementId)
    const result = await request.query(query)

    if (result.recordset.length === 0) {
      return {
        progress: 0,
        progress_percentage: 0,
        is_completed: false,
        completed_at: null,
        times_completed: 0
      }
    }

    return result.recordset[0]
  }

  /**
   * Update achievement progress in database
   */
  async updateAchievementProgress(userId, achievementId, oldProgress, newProgress, progressPercentage, isCompleted, triggerEvent, achievement) {
    try {
      const now = new Date()
      
      // Check if this is a new completion
      const wasJustCompleted = isCompleted && oldProgress < achievement.requirement_value
      const pointsAwarded = wasJustCompleted ? achievement.points : 0

      // Update or insert user_achievements record
      const upsertQuery = `
        MERGE user_achievements AS target
        USING (SELECT @userId AS user_id, @achievementId AS achievement_id) AS source
        ON (target.user_id = source.user_id AND target.achievement_id = source.achievement_id)
        WHEN MATCHED THEN
          UPDATE SET
            progress = @progress,
            progress_percentage = @progressPercentage,
            is_completed = @isCompleted,
            completed_at = CASE WHEN @wasJustCompleted = 1 THEN @now ELSE completed_at END,
            points_awarded = CASE WHEN @wasJustCompleted = 1 THEN ISNULL(points_awarded, 0) + @pointsAwarded ELSE points_awarded END,
            times_completed = CASE WHEN @wasJustCompleted = 1 THEN ISNULL(times_completed, 0) + 1 ELSE times_completed END,
            last_progress_update = @now
        WHEN NOT MATCHED THEN
          INSERT (user_id, achievement_id, progress, progress_percentage, is_completed, completed_at, points_awarded, times_completed, created_at, last_progress_update)
          VALUES (@userId, @achievementId, @progress, @progressPercentage, @isCompleted, 
                  CASE WHEN @isCompleted = 1 THEN @now ELSE NULL END, 
                  @pointsAwarded, 
                  CASE WHEN @isCompleted = 1 THEN 1 ELSE 0 END, 
                  @now, @now);
      `

      const pool = await this.getSqlPool()
      const request = pool.request()
      request.input('userId', sql.BigInt, userId)
      request.input('achievementId', sql.BigInt, achievementId)
      request.input('progress', sql.Int, newProgress)
      request.input('progressPercentage', sql.Decimal(5, 2), progressPercentage)
      request.input('isCompleted', sql.Bit, isCompleted)
      request.input('wasJustCompleted', sql.Bit, wasJustCompleted)
      request.input('pointsAwarded', sql.Int, pointsAwarded)
      request.input('now', sql.DateTime, now)
      await request.query(upsertQuery)

      // Log to achievement history
      await this.logAchievementHistory(userId, achievementId, 'progress_update', oldProgress, newProgress, pointsAwarded, triggerEvent)

      // Create notification if completed
      if (wasJustCompleted) {
        await this.createAchievementNotification(userId, achievement, pointsAwarded)
      }

    } catch (error) {
      console.error('Error updating achievement progress:', error)
      throw error
    }
  }

  /**
   * Log achievement progress change to history table
   */
  async logAchievementHistory(userId, achievementId, action, previousProgress, newProgress, pointsChange, triggerEvent) {
    const query = `
      INSERT INTO achievement_history (
        user_id, achievement_id, action, previous_progress, new_progress,
        points_change, trigger_event, created_at
      )
      VALUES (@userId, @achievementId, @action, @previousProgress, @newProgress,
              @pointsChange, @triggerEvent, GETDATE())
    `

    const pool = await this.getSqlPool()
    const request = pool.request()
    request.input('userId', sql.BigInt, userId)
    request.input('achievementId', sql.BigInt, achievementId)
    request.input('action', sql.NVarChar, action)
    request.input('previousProgress', sql.Int, previousProgress)
    request.input('newProgress', sql.Int, newProgress)
    request.input('pointsChange', sql.Int, pointsChange || 0)
    request.input('triggerEvent', sql.NVarChar, triggerEvent)
    await request.query(query)
  }

  /**
   * Create achievement notification for completed achievement
   */
  async createAchievementNotification(userId, achievement, pointsAwarded) {
    try {
      const query = `
        INSERT INTO achievement_notifications (
          user_id, achievement_id, notification_type, title, message,
          icon_url, points_awarded, is_sent, is_read, created_at
        )
        VALUES (
          @userId, @achievementId, 'achievement_unlocked', @title, @message,
          @iconUrl, @pointsAwarded, 0, 0, GETDATE()
        )
      `

      const title = `Achievement Unlocked: ${achievement.name}`
      const message = `Congratulations! You've earned "${achievement.name}" and gained ${pointsAwarded} points!`

      const pool = await this.getSqlPool()
      const request = pool.request()
      request.input('userId', sql.BigInt, userId)
      request.input('achievementId', sql.BigInt, achievement.achievement_id)
      request.input('title', sql.NVarChar, title)
      request.input('message', sql.NVarChar, message)
      request.input('iconUrl', sql.NVarChar, achievement.icon_url || null)
      request.input('pointsAwarded', sql.Int, pointsAwarded)
      await request.query(query)

      console.log(`🔔 Created achievement notification for user ${userId}: ${achievement.name}`)

    } catch (error) {
      console.error('Error creating achievement notification:', error)
    }
  }

  /**
   * Get achievements that might be affected by a trigger event
   */
  async getRelevantAchievements(triggerEvent) {
    // Map trigger events to relevant achievement types/categories
    const eventMap = {
      'card_added': ['count', 'unique', 'value'], // Collection size, unique players/teams, collection value
      'card_removed': ['count', 'unique', 'value'],
      'card_updated': ['value'],
      'comment_added': ['count'], // Comment-related achievements
      'login': ['streak'], // Login streak achievements
      'manual_check': [] // Check all achievements
    }

    const relevantTypes = eventMap[triggerEvent] || []
    
    let whereClause = 'WHERE is_active = 1'
    let queryParams = []

    if (relevantTypes.length > 0) {
      const typeConditions = relevantTypes.map((type, index) => {
        queryParams.push({ name: `type${index}`, type: 'nvarchar', value: type })
        return `requirement_type = @type${index}`
      }).join(' OR ')
      
      whereClause += ` AND (${typeConditions})`
    }

    const query = `
      SELECT
        achievement_id,
        name,
        description,
        points,
        tier,
        requirement_type,
        requirement_value,
        requirement_query,
        is_repeatable,
        cooldown_days,
        icon_url
      FROM achievements
      ${whereClause}
      ORDER BY points ASC
    `

    const pool = await this.getSqlPool()
    const request = pool.request()

    // Add parameters to request
    queryParams.forEach(param => {
      request.input(param.name, sql.NVarChar, param.value)
    })

    const result = await request.query(query)
    
    return result.recordset.map(achievement => ({
      ...achievement,
      achievement_id: Number(achievement.achievement_id)
    }))
  }

  /**
   * Update user's overall achievement statistics
   */
  async updateUserAchievementStats(userId) {
    try {
      const pool = await this.getSqlPool()
      const request = pool.request()
      request.input('userId', sql.BigInt, userId)
      await request.query('EXEC UpdateUserAchievementStats @userId')
    } catch (error) {
      console.error('Error updating user achievement stats:', error)
    }
  }

  /**
   * Update user streaks for streak-based events
   */
  async updateUserStreaks(userId, triggerEvent) {
    try {
      const streakTypeMap = {
        'login': 'login',
        'card_added': 'card_addition',
        'comment_added': 'comment'
      }

      const streakType = streakTypeMap[triggerEvent]
      if (!streakType) return

      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD

      // Check if user already has activity today for this streak type
      const existingQuery = `
        SELECT current_count, last_activity_date
        FROM user_streaks
        WHERE user_id = @userId AND streak_type = @streakType
      `

      const pool = await this.getSqlPool()
      let request = pool.request()
      request.input('userId', sql.BigInt, userId)
      request.input('streakType', sql.NVarChar, streakType)
      const existing = await request.query(existingQuery)

      if (existing.recordset.length === 0) {
        // Create new streak
        const insertQuery = `
          INSERT INTO user_streaks (
            user_id, streak_type, current_count, longest_count,
            last_activity_date, streak_start_date, is_active, created_at
          )
          VALUES (@userId, @streakType, 1, 1, @today, @today, 1, GETDATE())
        `

        request = pool.request()
        request.input('userId', sql.BigInt, userId)
        request.input('streakType', sql.NVarChar, streakType)
        request.input('today', sql.Date, today)
        await request.query(insertQuery)

      } else {
        const streak = existing.recordset[0]
        const lastDate = streak.last_activity_date.toISOString().split('T')[0]

        if (lastDate === today) {
          // Already updated today, skip
          return
        }

        const yesterday = new Date()
        yesterday.setDate(yesterday.getDate() - 1)
        const yesterdayStr = yesterday.toISOString().split('T')[0]

        if (lastDate === yesterdayStr) {
          // Continue streak
          const newCount = streak.current_count + 1
          const updateQuery = `
            UPDATE user_streaks
            SET
              current_count = @newCount,
              longest_count = CASE WHEN @newCount > longest_count THEN @newCount ELSE longest_count END,
              last_activity_date = @today,
              is_active = 1
            WHERE user_id = @userId AND streak_type = @streakType
          `

          request = pool.request()
          request.input('userId', sql.BigInt, userId)
          request.input('streakType', sql.NVarChar, streakType)
          request.input('newCount', sql.Int, newCount)
          request.input('today', sql.Date, today)
          await request.query(updateQuery)

        } else {
          // Streak broken, start new one
          const resetQuery = `
            UPDATE user_streaks
            SET
              current_count = 1,
              last_activity_date = @today,
              streak_start_date = @today,
              is_active = 1
            WHERE user_id = @userId AND streak_type = @streakType
          `

          request = pool.request()
          request.input('userId', sql.BigInt, userId)
          request.input('streakType', sql.NVarChar, streakType)
          request.input('today', sql.Date, today)
          await request.query(resetQuery)
        }
      }

    } catch (error) {
      console.error('Error updating user streaks:', error)
    }
  }

  /**
   * Check if trigger event should update streaks
   */
  isStreakEvent(triggerEvent) {
    return ['login', 'card_added', 'comment_added'].includes(triggerEvent)
  }

  /**
   * Get days since last completion for repeatable achievements
   */
  async getDaysSinceLastCompletion(userId, achievementId) {
    const query = `
      SELECT DATEDIFF(day, MAX(completed_at), GETDATE()) as days_since
      FROM user_achievements
      WHERE user_id = @userId AND achievement_id = @achievementId AND is_completed = 1
    `

    const pool = await this.getSqlPool()
    const request = pool.request()
    request.input('userId', sql.BigInt, userId)
    request.input('achievementId', sql.BigInt, achievementId)
    const result = await request.query(query)

    return result.recordset[0]?.days_since || 999 // Return high number if never completed
  }

  /**
   * Cleanup method
   */
  async disconnect() {
    if (this.prisma) {
      await this.prisma.$disconnect()
    }
  }
}

// Create singleton instance
const achievementEngine = new AchievementEngine()

module.exports = achievementEngine