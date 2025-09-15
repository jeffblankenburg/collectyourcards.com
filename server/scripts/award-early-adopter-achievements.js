/**
 * Award Early Adopter Achievements to Existing Users
 * Recognizes platform pioneers who joined before 2026
 */

const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({ log: ['error'] })

async function awardEarlyAdopterAchievements() {
  console.log('🏆 Awarding Early Adopter achievements to existing users...\n')

  try {
    // Get all users who created accounts before 2026
    const earlyUsers = await prisma.$queryRaw`
      SELECT user_id, email, first_name, last_name, created_at
      FROM [user]
      WHERE created_at < '2026-01-01'
      ORDER BY user_id ASC
    `

    console.log(`👥 Found ${earlyUsers.length} early users (joined before 2026)\n`)

    if (earlyUsers.length === 0) {
      console.log('No early users found - all accounts created after 2026')
      return
    }

    // Get early adopter achievements from database
    const earlyAdopterAchievements = await prisma.$queryRaw`
      SELECT achievement_id, name, requirement_type, requirement_value, points, tier
      FROM achievements
      WHERE category_id = 7
    `

    console.log(`🎯 Processing ${earlyAdopterAchievements.length} early adopter achievements...\n`)

    let totalAchievementsAwarded = 0
    const userAchievementCounts = new Map()

    for (const user of earlyUsers) {
      const userId = Number(user.user_id)
      const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email
      const userCreatedAt = new Date(user.created_at)
      const userNumber = userId // Assuming user_id represents creation order
      
      console.log(`👤 Processing ${userName} (User #${userId}, joined ${userCreatedAt.toDateString()})`)
      
      let userAchievements = 0
      let userPoints = 0

      for (const achievement of earlyAdopterAchievements) {
        const achievementId = Number(achievement.achievement_id)
        let shouldAward = false

        // Check if achievement should be awarded based on requirement type
        switch (achievement.requirement_type) {
          case 'account_created_before_2026':
            shouldAward = userCreatedAt < new Date('2026-01-01')
            break

          case 'first_100_users':
            shouldAward = userId <= 100
            break

          case 'user_id_1':
            shouldAward = userId === 1
            break

          case 'beta_login_2025':
            shouldAward = userCreatedAt < new Date('2026-01-01') // All early users for now
            break

          case 'first_card_before_2026':
            // Check if user has any cards (indicating they engaged with the platform)
            const cardCount = await prisma.$queryRaw`
              SELECT COUNT(*) as count FROM user_card WHERE [user] = ${userId}
            `
            shouldAward = Number(cardCount[0].count) > 0
            break

          case 'first_comment_before_2026':
            // Check if user has made any comments (when comment system is implemented)
            // For now, skip this achievement
            shouldAward = false
            break

          case 'early_platform_exploration':
            // Award to all early users who engaged (have cards)
            const hasCards = await prisma.$queryRaw`
              SELECT COUNT(*) as count FROM user_card WHERE [user] = ${userId}
            `
            shouldAward = Number(hasCards[0].count) > 0
            break

          case 'complete_profile_early':
            // Check if user has a complete profile
            shouldAward = user.first_name && user.last_name
            break

          case 'founder_interaction':
            // Award to user #1 only (as example founder interaction)
            shouldAward = userId === 1
            break

          default:
            // For now, skip achievements that require specific tracking
            shouldAward = false
            break
        }

        if (shouldAward) {
          try {
            // Check if user already has this achievement
            const existingAchievement = await prisma.$queryRaw`
              SELECT achievement_id FROM user_achievements 
              WHERE user_id = ${userId} AND achievement_id = ${achievementId}
            `

            if (existingAchievement.length === 0) {
              // Award the achievement
              await prisma.$queryRaw`
                INSERT INTO user_achievements (
                  user_id, achievement_id, progress, progress_percentage,
                  is_completed, completed_at, points_awarded, times_completed,
                  last_progress_update
                ) VALUES (
                  ${userId}, ${achievementId}, 1, 100, 1, GETDATE(),
                  ${achievement.points}, 1, GETDATE()
                )
              `

              // Log to achievement history
              await prisma.$queryRaw`
                INSERT INTO achievement_history (
                  user_id, achievement_id, action, previous_progress,
                  new_progress, points_change, trigger_event, created_at
                ) VALUES (
                  ${userId}, ${achievementId}, 'completed', 0, 1,
                  ${achievement.points}, 'early_adopter_retroactive', GETDATE()
                )
              `

              console.log(`  ✅ ${achievement.name} (+${achievement.points} pts)`)
              userAchievements++
              userPoints += achievement.points
              totalAchievementsAwarded++
            } else {
              console.log(`  ⚠️  Already has: ${achievement.name}`)
            }
          } catch (error) {
            console.log(`  ❌ Error awarding ${achievement.name}: ${error.message}`)
          }
        }
      }

      userAchievementCounts.set(userId, { achievements: userAchievements, points: userPoints })
      
      if (userAchievements > 0) {
        console.log(`  🎉 Awarded ${userAchievements} achievements worth ${userPoints} points`)
      } else {
        console.log(`  📝 No new achievements awarded`)
      }
      console.log('')
    }

    // Update user achievement stats for all affected users
    console.log('📊 Updating user achievement statistics...\n')
    
    for (const [userId, counts] of userAchievementCounts) {
      if (counts.achievements > 0) {
        try {
          // Get current achievement stats
          const currentStats = await prisma.$queryRaw`
            SELECT * FROM user_achievement_stats WHERE user_id = ${userId}
          `

          if (currentStats.length > 0) {
            // Update existing stats
            await prisma.$queryRaw`
              UPDATE user_achievement_stats 
              SET total_points = total_points + ${counts.points},
                  total_achievements = total_achievements + ${counts.achievements},
                  last_achievement_date = GETDATE(),
                  updated_at = GETDATE()
              WHERE user_id = ${userId}
            `
          } else {
            // Create new stats entry
            await prisma.$queryRaw`
              INSERT INTO user_achievement_stats (
                user_id, total_points, total_achievements,
                common_achievements, uncommon_achievements, rare_achievements,
                epic_achievements, legendary_achievements, mythic_achievements,
                completion_percentage, longest_streak, current_streak,
                last_achievement_date, achievement_rate, created_at, updated_at
              ) VALUES (
                ${userId}, ${counts.points}, ${counts.achievements},
                0, 0, 0, 0, 0, 0, 0, 0, 0, GETDATE(), 0, GETDATE(), GETDATE()
              )
            `
          }
          
          console.log(`📈 Updated stats for User #${userId}`)
        } catch (error) {
          console.log(`❌ Error updating stats for User #${userId}: ${error.message}`)
        }
      }
    }

    console.log(`\n🎉 Early Adopter achievement processing complete!`)
    console.log(`👥 Processed ${earlyUsers.length} early users`)
    console.log(`🏆 Awarded ${totalAchievementsAwarded} total achievements`)
    console.log(`🌟 Recognition for platform pioneers who joined before 2026!`)

  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the script
awardEarlyAdopterAchievements()