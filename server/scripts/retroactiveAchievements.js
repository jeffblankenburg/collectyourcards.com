/**
 * Retroactive Achievement Calculator
 * 
 * This script processes all existing users and awards achievements
 * based on their current collection state and activity history.
 * 
 * Run this AFTER deploying the achievement system to production.
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient()

// Progress tracking
let processedUsers = 0
let totalAchievementsAwarded = 0
let errors = []

/**
 * Main processing function
 */
async function processRetroactiveAchievements() {
  console.log('🏆 Starting Retroactive Achievement Processing...')
  console.log('================================================')
  
  try {
    // Get all active users
    const users = await global.sql.query(`
      SELECT user_id, email, username, created_at
      FROM [user]
      WHERE is_active = 1
      ORDER BY user_id
    `)
    
    const totalUsers = users.recordset.length
    console.log(`📊 Found ${totalUsers} active users to process\n`)
    
    // Get all active achievements
    const achievements = await global.sql.query(`
      SELECT 
        achievement_id, name, requirement_query, requirement_value,
        requirement_type, points, tier
      FROM achievements
      WHERE is_active = 1
      ORDER BY points ASC
    `)
    
    console.log(`🎮 Processing ${achievements.recordset.length} active achievements\n`)
    
    // Process each user
    for (const user of users.recordset) {
      await processUserAchievements(user, achievements.recordset)
      processedUsers++
      
      // Show progress every 10 users
      if (processedUsers % 10 === 0) {
        console.log(`Progress: ${processedUsers}/${totalUsers} users processed...`)
      }
    }
    
    // Final summary
    console.log('\n================================================')
    console.log('✅ Retroactive Achievement Processing Complete!')
    console.log(`📊 Users Processed: ${processedUsers}`)
    console.log(`🏆 Total Achievements Awarded: ${totalAchievementsAwarded}`)
    
    if (errors.length > 0) {
      console.log(`\n⚠️ Errors encountered: ${errors.length}`)
      errors.forEach(err => console.log(`  - ${err}`))
    }
    
  } catch (error) {
    console.error('❌ Fatal error during processing:', error)
  } finally {
    await prisma.$disconnect()
  }
}

/**
 * Process achievements for a single user
 */
async function processUserAchievements(user, achievements) {
  const userId = Number(user.user_id)
  let userAchievements = 0
  
  try {
    for (const achievement of achievements) {
      try {
        // Calculate current progress using the achievement's requirement query
        const progress = await calculateAchievementProgress(userId, achievement)
        
        if (progress === null) continue
        
        const progressPercentage = Math.min(100, (progress / achievement.requirement_value) * 100)
        const isCompleted = progress >= achievement.requirement_value
        
        // Check if user already has this achievement
        const existing = await global.sql.query(`
          SELECT user_achievement_id, is_completed 
          FROM user_achievements 
          WHERE user_id = @userId AND achievement_id = @achievementId
        `, [
          { name: 'userId', type: 'bigint', value: userId },
          { name: 'achievementId', type: 'bigint', value: achievement.achievement_id }
        ])
        
        if (existing.recordset.length === 0 && progress > 0) {
          // Insert new achievement record
          await global.sql.query(`
            INSERT INTO user_achievements (
              user_id, achievement_id, progress, progress_percentage,
              is_completed, completed_at, points_awarded, times_completed,
              created_at, last_progress_update
            )
            VALUES (
              @userId, @achievementId, @progress, @progressPercentage,
              @isCompleted, @completedAt, @pointsAwarded, @timesCompleted,
              GETDATE(), GETDATE()
            )
          `, [
            { name: 'userId', type: 'bigint', value: userId },
            { name: 'achievementId', type: 'bigint', value: achievement.achievement_id },
            { name: 'progress', type: 'int', value: progress },
            { name: 'progressPercentage', type: 'decimal', value: progressPercentage },
            { name: 'isCompleted', type: 'bit', value: isCompleted },
            { name: 'completedAt', type: 'datetime', value: isCompleted ? new Date() : null },
            { name: 'pointsAwarded', type: 'int', value: isCompleted ? achievement.points : 0 },
            { name: 'timesCompleted', type: 'int', value: isCompleted ? 1 : 0 }
          ])
          
          if (isCompleted) {
            userAchievements++
            totalAchievementsAwarded++
            
            // Create notification
            await createAchievementNotification(userId, achievement)
            
            // Log to history
            await logAchievementHistory(userId, achievement.achievement_id, progress, isCompleted)
          }
        } else if (existing.recordset.length > 0 && !existing.recordset[0].is_completed && isCompleted) {
          // Update existing record to completed
          await global.sql.query(`
            UPDATE user_achievements
            SET 
              progress = @progress,
              progress_percentage = @progressPercentage,
              is_completed = 1,
              completed_at = GETDATE(),
              points_awarded = @pointsAwarded,
              times_completed = 1,
              last_progress_update = GETDATE()
            WHERE user_id = @userId AND achievement_id = @achievementId
          `, [
            { name: 'userId', type: 'bigint', value: userId },
            { name: 'achievementId', type: 'bigint', value: achievement.achievement_id },
            { name: 'progress', type: 'int', value: progress },
            { name: 'progressPercentage', type: 'decimal', value: progressPercentage },
            { name: 'pointsAwarded', type: 'int', value: achievement.points }
          ])
          
          userAchievements++
          totalAchievementsAwarded++
          
          await createAchievementNotification(userId, achievement)
          await logAchievementHistory(userId, achievement.achievement_id, progress, true)
        }
        
      } catch (achError) {
        // Log error but continue processing
        errors.push(`User ${userId}, Achievement ${achievement.achievement_id}: ${achError.message}`)
      }
    }
    
    // Update user achievement stats
    if (userAchievements > 0) {
      await updateUserStats(userId)
      console.log(`✅ User ${user.username || user.email}: ${userAchievements} achievements awarded`)
    }
    
  } catch (error) {
    errors.push(`User ${userId}: ${error.message}`)
  }
}

/**
 * Calculate achievement progress for a user
 */
async function calculateAchievementProgress(userId, achievement) {
  try {
    if (!achievement.requirement_query) return null
    
    // Replace @user_id parameter in the query
    const query = achievement.requirement_query.replace(/@user_id/g, userId.toString())
    
    const result = await global.sql.query(query)
    
    if (result.recordset.length === 0) return 0
    
    // Get the first numeric value from the result
    const firstRow = result.recordset[0]
    const firstValue = Object.values(firstRow)[0]
    
    return Number(firstValue) || 0
    
  } catch (error) {
    console.error(`Error calculating progress for achievement ${achievement.achievement_id}:`, error.message)
    return null
  }
}

/**
 * Create achievement notification
 */
async function createAchievementNotification(userId, achievement) {
  try {
    await global.sql.query(`
      INSERT INTO achievement_notifications (
        user_id, achievement_id, notification_type, title, message,
        icon_url, points_awarded, is_sent, is_read, created_at
      )
      VALUES (
        @userId, @achievementId, 'achievement_unlocked', @title, @message,
        @iconUrl, @pointsAwarded, 0, 0, GETDATE()
      )
    `, [
      { name: 'userId', type: 'bigint', value: userId },
      { name: 'achievementId', type: 'bigint', value: achievement.achievement_id },
      { name: 'title', type: 'nvarchar', value: `Achievement Unlocked: ${achievement.name}` },
      { name: 'message', type: 'nvarchar', value: `You've retroactively earned "${achievement.name}" and gained ${achievement.points} points!` },
      { name: 'iconUrl', type: 'nvarchar', value: null },
      { name: 'pointsAwarded', type: 'int', value: achievement.points }
    ])
  } catch (error) {
    console.error('Error creating notification:', error.message)
  }
}

/**
 * Log achievement to history
 */
async function logAchievementHistory(userId, achievementId, progress, isCompleted) {
  try {
    await global.sql.query(`
      INSERT INTO achievement_history (
        user_id, achievement_id, action, previous_progress, new_progress,
        points_change, trigger_event, created_at
      )
      VALUES (
        @userId, @achievementId, @action, 0, @progress,
        @pointsChange, 'retroactive_calculation', GETDATE()
      )
    `, [
      { name: 'userId', type: 'bigint', value: userId },
      { name: 'achievementId', type: 'bigint', value: achievementId },
      { name: 'action', type: 'nvarchar', value: isCompleted ? 'completed' : 'progress_update' },
      { name: 'progress', type: 'int', value: progress },
      { name: 'pointsChange', type: 'int', value: 0 }
    ])
  } catch (error) {
    console.error('Error logging history:', error.message)
  }
}

/**
 * Update user achievement statistics
 */
async function updateUserStats(userId) {
  try {
    await global.sql.query('EXEC UpdateUserAchievementStats @userId', [
      { name: 'userId', type: 'bigint', value: userId }
    ])
  } catch (error) {
    console.error('Error updating user stats:', error.message)
  }
}

/**
 * Process login streaks retroactively
 */
async function processLoginStreaks() {
  console.log('\n📅 Processing Login Streaks...')
  
  try {
    // Get login history for streak calculation
    const loginHistory = await global.sql.query(`
      SELECT 
        user_id,
        CAST(created_at AS DATE) as login_date,
        COUNT(*) as login_count
      FROM user_auth_log
      WHERE event_type = 'login_success'
        AND success = 1
      GROUP BY user_id, CAST(created_at AS DATE)
      ORDER BY user_id, login_date
    `)
    
    // Group by user and calculate streaks
    const userStreaks = new Map()
    
    for (const record of loginHistory.recordset) {
      const userId = Number(record.user_id)
      if (!userStreaks.has(userId)) {
        userStreaks.set(userId, {
          currentStreak: 0,
          longestStreak: 0,
          lastDate: null,
          dates: []
        })
      }
      
      const user = userStreaks.get(userId)
      user.dates.push(record.login_date)
    }
    
    // Calculate streak lengths
    for (const [userId, data] of userStreaks) {
      let currentStreak = 1
      let longestStreak = 1
      
      for (let i = 1; i < data.dates.length; i++) {
        const prevDate = new Date(data.dates[i - 1])
        const currDate = new Date(data.dates[i])
        const daysDiff = Math.floor((currDate - prevDate) / (1000 * 60 * 60 * 24))
        
        if (daysDiff === 1) {
          currentStreak++
          longestStreak = Math.max(longestStreak, currentStreak)
        } else if (daysDiff > 1) {
          currentStreak = 1
        }
      }
      
      // Insert or update user_streaks table
      await global.sql.query(`
        MERGE user_streaks AS target
        USING (SELECT @userId AS user_id, 'login' AS streak_type) AS source
        ON target.user_id = source.user_id AND target.streak_type = source.streak_type
        WHEN MATCHED THEN
          UPDATE SET 
            longest_count = CASE WHEN @longest > longest_count THEN @longest ELSE longest_count END,
            updated_at = GETDATE()
        WHEN NOT MATCHED THEN
          INSERT (user_id, streak_type, current_count, longest_count, last_activity_date, streak_start_date, is_active, created_at)
          VALUES (@userId, 'login', 0, @longest, NULL, NULL, 0, GETDATE());
      `, [
        { name: 'userId', type: 'bigint', value: userId },
        { name: 'longest', type: 'int', value: longestStreak }
      ])
      
      console.log(`  User ${userId}: Longest login streak = ${longestStreak} days`)
    }
    
    console.log(`✅ Processed login streaks for ${userStreaks.size} users`)
    
  } catch (error) {
    console.error('Error processing login streaks:', error)
  }
}

// Run the script
if (require.main === module) {
  console.log('🚀 Starting Achievement Retroactive Processing')
  console.log('This may take several minutes depending on the number of users...\n')
  
  processRetroactiveAchievements()
    .then(() => processLoginStreaks())
    .then(() => {
      console.log('\n🎉 All retroactive processing complete!')
      process.exit(0)
    })
    .catch(error => {
      console.error('Fatal error:', error)
      process.exit(1)
    })
}

module.exports = { processRetroactiveAchievements, processLoginStreaks }